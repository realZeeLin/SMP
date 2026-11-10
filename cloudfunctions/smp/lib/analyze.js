'use strict';
/**
 * 分析流水线（纯逻辑，不依赖数据库，便于测试）：
 *  processBatch：单个查询的搜索结果 → 清洗 → 消歧 → 学术过滤 → 分类分级（采集时增量执行）
 *  finalize：本期全部保留条目 → 同链接合并 → 去重聚类 → 跨期比对 → 打分 → 摘选
 */
const T = require('./text');
const { inPeriod } = require('./collect');
const { academicCheck, classify, detectLevel } = require('./classify');
const { applyMentionOverrides } = require('./disambiguate');
const { cluster, buildEvents, markHistory } = require('./dedup');
const { makeAuthority, scoreEvent, select } = require('./rank');

const URL_DATE = /(20\d{2})[/_-]?(\d{2})[/_-]?(\d{2})/;

function normalizeResult(r, period, settings, queryMemberId) {
  const title = T.stripSiteSuffix(r.title || '');
  if (!title) return { reason: '无标题' };
  const url = r.url || '';
  const canonicalUrl = T.canonicalUrl(url) || `urn:title:${T.stableHash(title)}`;
  let published = T.parseDate(r.published);
  if (!published) { const m = URL_DATE.exec(url); if (m) published = T.parseDate(`${m[1]}-${m[2]}-${m[3]}`); }
  const c = settings.collect || {};
  if (published && !inPeriod(published, period, c.date_tolerance_days ?? 3)) return { reason: '窗口外', title, url };
  if (!published && c.keep_undated === false) return { reason: '无日期', title, url };
  const body = T.cleanText(r.content || '');
  const snippet = T.cleanText(r.snippet || '');
  let text = body.length >= snippet.length ? body : snippet;
  if (snippet && !text.includes(snippet)) text = `${snippet}\n${text}`;
  text = text.slice(0, c.content_max_chars || 1500);
  const full = `${title} ${text}`;
  const isOrgNews = (c.org_news_terms || []).some((t) => full.includes(t)) || (/SMP\s*20\d{2}/.test(full) && full.includes('社会媒体'));
  return { item: { itemId: T.stableHash(canonicalUrl), canonicalUrl, url, title, site: r.site || T.domainOf(url), domain: T.domainOf(url),
    published, text, queryMemberIds: queryMemberId ? [queryMemberId] : [], isOrgNews } };
}

function contextOf(item, window = 80) {
  const text = `${item.title}\n${item.text}`;
  if (item.isOrgNews) return text.slice(0, 800);
  const parts = [];
  for (const m of item.mentions || []) {
    if (m.status === 'rejected') continue;
    let i = text.indexOf(m.name);
    while (i !== -1 && parts.length < 6) { parts.push(text.slice(Math.max(0, i - window), i + m.name.length + window)); i = text.indexOf(m.name, i + 1); }
  }
  return parts.join(' ') || text.slice(0, 300);
}

/**
 * @returns {{kept: object[], filtered: object[], stats: object}}
 */
async function processBatch(results, { settings, period, disambiguator, queryMemberId = null }) {
  const stats = { raw: results.length, kept: 0, outOfWindow: 0, noMember: 0, nonAcademic: 0 };
  const kept = []; const filtered = [];
  for (const r of results) {
    const n = normalizeResult(r, period, settings, queryMemberId);
    if (!n.item) { if (n.reason === '窗口外') stats.outOfWindow++; continue; }
    const it = n.item;
    it.mentions = await disambiguator.run(it);
    const live = it.mentions.filter((m) => m.status !== 'rejected');
    if (!it.isOrgNews && !live.length) {
      stats.noMember++;
      if (it.mentions.length) filtered.push({ title: it.title, url: it.url, reason: '同名者/人物不符', memberNames: it.mentions.map((m) => m.name) });
      continue;
    }
    const [ok, why] = academicCheck(settings.academic_filter, it.title, contextOf(it));
    if (!ok) {
      stats.nonAcademic++;
      filtered.push({ title: it.title, url: it.url, reason: why.startsWith('标题') ? '排除类型' : '非学术内容', detail: why, memberNames: live.map((m) => m.name) });
      continue;
    }
    const ctx = contextOf(it, 150);
    it.category = classify(it.title, ctx, it.isOrgNews);
    [it.level, it.levelHit] = detectLevel(it.title, ctx);
    kept.push(it); stats.kept++;
  }
  return { kept, filtered, stats };
}

/** 同一 canonicalUrl 在多个查询中出现 → 合并查询来源、取每位委员最高置信度。 */
function mergeItems(items) {
  const map = new Map();
  for (const it of items) {
    const cur = map.get(it.canonicalUrl);
    if (!cur) { map.set(it.canonicalUrl, JSON.parse(JSON.stringify(it))); continue; }
    cur.queryMemberIds = [...new Set([...cur.queryMemberIds, ...(it.queryMemberIds || [])])];
    if (String(it.text).length > String(cur.text).length) cur.text = it.text;
    cur.published = cur.published || it.published;
    for (const m of it.mentions || []) {
      const i = cur.mentions.findIndex((x) => x.memberId === m.memberId);
      if (i === -1) cur.mentions.push(m); else if (m.confidence > cur.mentions[i].confidence) cur.mentions[i] = m;
    }
  }
  return [...map.values()];
}

/**
 * @param ctx { settings, period, members, overrides, archive }
 */
function finalize(items, ctx) {
  const { settings, period, members, overrides = [], archive = [] } = ctx;
  const merged = mergeItems(items);
  const mentionOv = new Map(overrides.filter((o) => o.type === 'mention').map((o) => [`${o.url}|${o.memberId}`, o.decision]));
  merged.forEach((it) => applyMentionOverrides(it, it.mentions, mentionOv));
  const alive = merged.filter((it) => it.isOrgNews || it.mentions.some((m) => m.status !== 'rejected'));
  const authority = makeAuthority((settings.scoring || {}).source_authority);
  const groups = cluster(alive, settings.dedup);
  const events = buildEvents(alive, groups, authority, (settings.disambiguation || {}).confirm_threshold ?? 0.6, period.id);
  const sameKind = archive.filter((a) => a.kind === period.kind);
  const prev = markHistory(events, sameKind, period.start, (settings.dedup || {}).history_days ?? 90);
  const rolesOf = Object.fromEntries(members.map((m) => [m._id, m.roles]));
  const orgOf = Object.fromEntries(members.map((m) => [m._id, m.org]));
  events.forEach((ev) => { ev.memberOrgs = ev.memberIds.map((m) => orgOf[m] || ''); scoreEvent(ev, period, settings.scoring || {}, rolesOf, authority); });
  const manual = new Map();
  overrides.filter((o) => o.type === 'event').forEach((o) => { if (o.eventId) manual.set(o.eventId, o.decision); if (o.url) manual.set(o.url, o.decision); });
  const sel = settings.selection || {};
  const { chosen, report } = select(events, sel[period.kind] || {}, sel, manual);
  const categories = {};
  chosen.forEach((e) => { categories[e.category] = (categories[e.category] || 0) + 1; });
  events.sort((a, b) => b.score - a.score);
  return { events, chosen, report: { items: merged.length, alive: alive.length, events: events.length, previouslyPublished: prev,
    ...report, categories, needsReview: chosen.filter((e) => e.needsReview).length } };
}

module.exports = { normalizeResult, contextOf, processBatch, mergeItems, finalize };
