'use strict';
/** 统计周期与查询计划（纯函数）。 */
const { todayCN, addDays, weekRange, monthRange, isoWeek } = require('./text');
const { orgShort } = require('./profiles');

/** 默认取 ref 之前最近一个完整周期；current=true 取 ref 所在周期。 */
function resolvePeriod(kind, ref = todayCN(), current = false) {
  let [start, end] = kind === 'weekly' ? weekRange(ref) : monthRange(ref);
  if (!current && end >= ref) [start, end] = kind === 'weekly' ? weekRange(addDays(start, -1)) : monthRange(addDays(start, -1));
  let label;
  if (kind === 'weekly') { const [y, w] = isoWeek(start); label = `${y}-W${String(w).padStart(2, '0')}`; } else label = start.slice(0, 7);
  return { kind, start, end, label, id: `${kind}-${label}` };
}

const inPeriod = (d, p, tolerance = 0) => Boolean(d) && d >= addDays(p.start, -tolerance) && d <= p.end;

function planQueries(settings, members, aliasMap, period, only = null) {
  const c = settings.collect || {};
  const templates = c.member_queries || ['{name} {org}'];
  const tiers = c.tiers || {};
  const core = new Set(tiers.core_roles || []);
  const year = period.start.slice(0, 4);
  const fill = (t, m) => t.replace(/\{name\}/g, m.name).replace(/\{org\}/g, m.org)
    .replace(/\{org_short\}/g, orgShort(m.org, aliasMap)).replace(/\{year\}/g, year);
  const out = [];
  for (const m of members) {
    if (m.status !== 'active' || (only && !only.has(m._id))) continue;
    const n = (m.roles || []).some((r) => core.has(r)) ? (tiers.core_query_count || templates.length) : (tiers.default_query_count || 1);
    const ori = (c.ori_question_override || (settings.deepseek && settings.deepseek.search && settings.deepseek.search.ori_question) || '');
    templates.slice(0, n).forEach((t) => out.push({ query: fill(t, m), memberId: m._id, kind: 'member', oriQuestion: ori ? fill(ori, m) : '' }));
  }
  if (!only) (c.org_queries || []).forEach((t) => out.push({ query: t.replace(/\{year\}/g, year), memberId: null, kind: 'org' }));
  const seen = new Set();
  return out.filter((q) => { const k = `${q.query}|${q.memberId}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * 组装 DeepSeek Search 查询：基础查询 + 时间/语言操作符（after: / before: / lang:），总长不超过 128 字。
 * 文档：after:/before: 按发布日期限定，lang:zh,en 限定语言。
 */
function buildSearchQuery(base, period, settings) {
  const s = (settings.deepseek && settings.deepseek.search) || {};
  const max = s.max_query_chars || 128;
  const ops = [];
  if (s.date_operators !== false && period) {
    const tol = (settings.collect || {}).date_tolerance_days ?? 3;
    ops.push(`after:${addDays(period.start, -tol - 1)}`, `before:${addDays(period.end, 1)}`);
  }
  if (s.lang) ops.push(`lang:${s.lang}`);
  const suffix = ops.length ? ` ${ops.join(' ')}` : '';
  return String(base).slice(0, Math.max(1, max - suffix.length)).trim() + suffix;
}

module.exports = { resolvePeriod, inPeriod, planQueries, buildSearchQuery };
