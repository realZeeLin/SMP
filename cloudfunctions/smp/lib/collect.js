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
    templates.slice(0, n).forEach((t) => out.push({ query: fill(t, m), memberId: m._id, kind: 'member' }));
  }
  if (!only) (c.org_queries || []).forEach((t) => out.push({ query: t.replace(/\{year\}/g, year), memberId: null, kind: 'org' }));
  const seen = new Set();
  return out.filter((q) => { const k = `${q.query}|${q.memberId}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

module.exports = { resolvePeriod, inPeriod, planQueries };
