'use strict';
/**
 * 组织日常学术动态（信息流）：纯逻辑。
 * - 来源：DeepSeek 检索（专委会 + 社媒派SMP 公众号 + 委员）、公众号接口（可选）、手工导入文章链接、期刊分析结果；
 * - 社媒派SMP 等专委会自有账号的文章不分栏，统一进入信息流，并打上 fromSmpAccount 标记便于识别和检索；
 * - 信息流条目以规范化 URL 的哈希为 _id，多来源同一篇文章自动合并。
 */
const T = require('./text');
const { planQueries, buildSearchQuery } = require('./collect');
const { normalizeResult, contextOf } = require('./analyze');
const { academicCheck, classify, detectLevel } = require('./classify');

const feedId = (url, title = '') => `f${T.stableHash(T.canonicalUrl(url) || `urn:${title}`)}`;

/** 滚动时间窗：今天往前 days 天。 */
function feedWindow(days = 7, today = T.todayCN()) {
  return { kind: 'feed', start: T.addDays(today, -Math.max(1, days)), end: today, label: `近${days}天`, id: 'feed' };
}

/** 是否为专委会自有公众号（如“社媒派SMP”）的文章。 */
function isOwnAccount(r, accounts) {
  const host = T.domainOf(r.url || '');
  const text = `${r.site || ''} ${r.title || ''} ${String(r.content || r.summary || r.snippet || '').slice(0, 300)}`;
  return (accounts || []).some((a) => a && text.includes(a)) && (host === 'mp.weixin.qq.com' || String(r.site || '').includes(accounts[0]) || /转载自|来源[:：]/.test(text));
}

/**
 * 查询计划。scope：org（专委会 + 公众号）| core（另加核心层委员）| all（另加全体委员）。
 */
function planFeedQueries(settings, members, aliasMap, scope, window) {
  const f = settings.feed || {};
  const orgQs = [...(settings.collect.org_queries || []), ...(f.account_queries || [])]
    .map((t) => ({ query: t.replace(/\{year\}/g, window.start.slice(0, 4)), memberId: null, kind: 'org' }));
  let memberQs = [];
  if (scope === 'core' || scope === 'all') {
    const core = new Set(((settings.collect.tiers || {}).core_roles) || []);
    const pick = scope === 'all' ? members : members.filter((m) => (m.roles || []).some((r) => core.has(r)));
    const only = new Set(pick.map((m) => m._id));
    // 日常动态每人只用第一条查询模板，控制调用量
    const s = { ...settings, collect: { ...settings.collect, tiers: { core_query_count: 1, default_query_count: 1 } } };
    memberQs = planQueries(s, members, aliasMap, window, only).filter((q) => q.kind === 'member');
  }
  return [...orgQs, ...memberQs].map((q) => ({ ...q, query: buildSearchQuery(q.query, window, settings) }));
}

/** 估算：查询次数与费用（Search $0.75 / 1000 次成功请求）。 */
const estimate = (n) => ({ queries: n, usd: Math.round(n * 0.075) / 100 });

/**
 * 把一批检索结果转换为信息流条目。
 * 规则：自有公众号文章一律保留；专委会新闻保留；其余需命中委员且通过学术过滤。
 */
async function toFeedItems(results, { settings, window, disambiguator, queryMemberId = null, source = 'search' }) {
  const accounts = (settings.feed || {}).accounts || ['社媒派SMP'];
  const out = []; const stats = { raw: results.length, kept: 0, skipped: 0 };
  for (const r of results) {
    const n = normalizeResult(r, window, settings, queryMemberId);
    if (!n.item) { stats.skipped++; continue; }
    const it = n.item;
    const own = source === 'wechat_mp' || isOwnAccount(r, accounts);
    it.mentions = await disambiguator.run(it);
    const live = it.mentions.filter((m) => m.status !== 'rejected');
    if (!own && !it.isOrgNews) {
      if (!live.length) { stats.skipped++; continue; }
      if (!academicCheck(settings.academic_filter, it.title, contextOf(it))[0]) { stats.skipped++; continue; }
    }
    const ctx = contextOf(it, 150);
    const category = classify(it.title, ctx, it.isOrgNews || own);
    const [level] = detectLevel(it.title, ctx);
    out.push(feedDoc({ ...it, category, level, fromSmpAccount: own, source, site: own ? (r.site || accounts[0]) : it.site, mentions: live }));
    stats.kept++;
  }
  return { items: out, stats };
}

function feedDoc(it) {
  const confirmed = (it.mentions || []).filter((m) => m.status !== 'rejected');
  return {
    _id: feedId(it.url, it.title),
    title: it.title, url: it.url, site: it.site || T.domainOf(it.url), domain: it.domain || T.domainOf(it.url),
    published: it.published || null,
    summary: T.firstSentences(String(it.text || '').replace(it.title, ''), 160),
    text: String(it.text || '').slice(0, 800),
    memberIds: confirmed.map((m) => m.memberId), memberNames: confirmed.map((m) => m.name),
    needsReview: confirmed.some((m) => m.status === 'ambiguous'),
    category: it.category || 'other', level: it.level || 0.2,
    isOrgNews: Boolean(it.isOrgNews || it.fromSmpAccount), fromSmpAccount: Boolean(it.fromSmpAccount),
    source: it.source || 'search',
    keywords: [it.title, it.site, ...confirmed.map((m) => m.name)].join(' '),
  };
}

/** 期刊分析出的事件同步进信息流（同一链接与日常拉取合并）。 */
function eventToFeed(ev, accounts = ['社媒派SMP']) {
  const own = (ev.sources || []).some((s) => accounts.some((a) => String(s.site || '').includes(a)));
  return {
    _id: feedId(ev.url, ev.title), title: ev.headline || ev.title, url: ev.url, site: ev.site, domain: T.domainOf(ev.url),
    published: ev.published || null, summary: ev.blurb || T.firstSentences(ev.text || '', 160), text: String(ev.text || '').slice(0, 800),
    memberIds: ev.memberIds, memberNames: ev.memberNames, needsReview: Boolean(ev.needsReview),
    category: ev.category, level: ev.level, isOrgNews: Boolean(ev.isOrgNews || own), fromSmpAccount: own, source: 'issue',
    keywords: [ev.title, ev.site, ...(ev.memberNames || [])].join(' '),
  };
}

/** 公众号接口 freepublish/batchget 返回 → 信息流条目（自有账号文章）。 */
function wechatArticlesToFeed(resp, accountName = '社媒派SMP') {
  const out = [];
  for (const it of (resp && resp.item) || []) {
    const news = (it.content && it.content.news_item) || [];
    const ts = it.update_time || (it.content && it.content.update_time);
    for (const n of news) {
      if (!n.url || n.is_deleted) continue;
      out.push(feedDoc({ title: n.title, url: n.url, site: accountName, domain: 'mp.weixin.qq.com', published: ts ? T.parseDate(ts) : null,
        text: n.digest || '', isOrgNews: true, fromSmpAccount: true, category: 'org', source: 'wechat_mp', mentions: [] }));
    }
  }
  return out;
}

module.exports = { feedId, feedWindow, isOwnAccount, planFeedQueries, estimate, toFeedItems, feedDoc, eventToFeed, wechatArticlesToFeed };
