'use strict';
/**
 * 重要性打分（0~100）与排序摘选（默认 30~50 条）。
 * score = 100 × Σ wᵢ·fᵢ × (0.6+0.4·置信度) × [跨期已发布 0.3] × [无日期 0.8] + [专委会动态 +15]
 */
const { domainOf, daysBetween } = require('./text');

const TYPE_WEIGHTS = { org: 1, honor: 1, research: 0.8, project: 0.75, service: 0.65, influence: 0.6, activity: 0.5, other: 0.3 };

function makeAuthority(table = {}) {
  const def = table.default ?? 0.45;
  const entries = Object.entries(table).filter(([k]) => k !== 'default').sort((a, b) => b[0].length - a[0].length);
  /**
   * 信源权威度：优先使用配置表（域名后缀）；未收录的域名用 DeepSeek 返回的 authority（0~4）折算，仍未知则取默认值。
   */
  return (domain, dsAuthority = -1) => {
    const d = String(domain || '').toLowerCase();
    const hit = entries.find(([suf]) => d === suf || d.endsWith(`.${suf}`));
    if (hit) return hit[1];
    return Number.isFinite(dsAuthority) && dsAuthority >= 0 ? Math.max(0.2, Math.min(1, dsAuthority / 4)) : def;
  };
}

const r3 = (x) => Math.round(x * 1000) / 1000;

function scoreEvent(ev, period, cfg, rolesOf, authority) {
  const w = cfg.weights || {};
  const rw = cfg.role_weights || {};
  const f = {};
  f.type = TYPE_WEIGHTS[ev.category] ?? 0.3;
  f.level = ev.level || 0.2;
  const roleVals = ev.memberIds.flatMap((m) => (rolesOf[m] || []).map((r) => rw[r] ?? 0.5));
  f.role = roleVals.length ? Math.max(...roleVals) : 0.5;
  f.authority = ev.sources.length ? Math.max(...ev.sources.map((s) => authority(domainOf(s.url), s.dsAuthority))) : authority('');
  const sites = new Set(ev.sources.map((s) => domainOf(s.url)));
  f.coverage = Math.min(1, Math.log2(1 + sites.size) / Math.log2(6));
  const text = `${ev.title} ${String(ev.text).slice(0, 2000)}`;
  f.relevance = Math.min(1, (cfg.relevance_terms || []).filter((t) => text.includes(t)).length / 3);
  if (ev.published) {
    const span = Math.max(1, daysBetween(period.start, period.end));
    f.recency = Math.max(0, Math.min(1, 0.5 + 0.5 * daysBetween(period.start, ev.published) / span));
  } else f.recency = 0.3;
  const base = Object.entries(f).reduce((s, [k, v]) => s + (w[k] || 0) * v, 0);
  const confFactor = 0.6 + 0.4 * (ev.isOrgNews ? 1 : ev.confidence);
  let factor = confFactor;
  if (ev.previouslyPublished) factor *= cfg.previously_published_factor ?? 0.3;
  if (!ev.published) factor *= cfg.undated_factor ?? 0.8;
  const bonus = ev.isOrgNews ? (cfg.org_news_bonus ?? 15) : 0;
  ev.score = Math.round(Math.min(100, 100 * base * factor + bonus) * 10) / 10;
  ev.scoreDetail = { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, r3(v)])), confFactor: r3(confFactor), factor: r3(factor), bonus };
  return ev.score;
}

/**
 * @param manual Map(eventId|url → 'keep'|'drop')
 */
function select(events, kindCfg = {}, globalCfg = {}, manual = new Map()) {
  const minItems = kindCfg.min_items ?? 30;
  const maxItems = kindCfg.max_items ?? 50;
  const perMember = kindCfg.per_member_cap ?? 2;
  const floor = globalCfg.floor_score ?? 12;
  const caps = globalCfg.category_caps || {};
  const decay = globalCfg.diversity_decay ?? 0.75;
  const report = { manualDrop: 0, previouslyPublished: 0, noMember: 0 };
  const pool = [];
  events.forEach((ev) => { ev.selected = false; ev.rank = null; });
  for (const ev of events) {
    const d = manual.get(ev.eventId) || ev.sources.map((s) => manual.get(s.url)).find(Boolean);
    if (d === 'drop') { report.manualDrop++; ev.decision = 'drop'; continue; }
    if (d === 'keep') { ev.selected = true; ev.decision = 'keep'; pool.push(ev); continue; }
    if (ev.previouslyPublished) { report.previouslyPublished++; continue; }
    if (!ev.memberIds.length && !ev.isOrgNews) { report.noMember++; continue; }
    pool.push(ev);
  }
  const chosen = pool.filter((e) => e.selected);
  const mc = {}; const cc = {};
  const bump = (e) => { e.memberIds.forEach((m) => { mc[m] = (mc[m] || 0) + 1; }); cc[e.category] = (cc[e.category] || 0) + 1; };
  chosen.forEach(bump);
  const adjusted = (e) => (e.memberIds.length ? e.score * decay ** Math.max(...e.memberIds.map((m) => mc[m] || 0)) : e.score);
  const catOk = (e) => caps[e.category] === undefined || (cc[e.category] || 0) + 1 <= Math.ceil(caps[e.category] * maxItems);
  let threshold = kindCfg.min_score ?? 25;
  for (;;) {
    while (chosen.length < maxItems) {
      const cands = pool.filter((e) => !e.selected && (e.isOrgNews || adjusted(e) >= threshold)
        && e.memberIds.every((m) => (mc[m] || 0) < perMember) && catOk(e));
      if (!cands.length) break;
      cands.sort((a, b) => (b.isOrgNews - a.isOrgNews) || (adjusted(b) - adjusted(a)));
      const best = cands[0];
      best.selected = true; chosen.push(best); bump(best);
    }
    if (chosen.length >= minItems || threshold <= floor) break;
    threshold = Math.max(floor, threshold - 5);
  }
  chosen.sort((a, b) => (b.isOrgNews - a.isOrgNews) || (b.score - a.score));
  chosen.forEach((e, i) => { e.rank = i + 1; });
  return { chosen, report: { ...report, thresholdUsed: threshold, selected: chosen.length, candidates: pool.length,
    shortfall: Math.max(0, minItems - chosen.length) } };
}

module.exports = { TYPE_WEIGHTS, makeAuthority, scoreEvent, select };
