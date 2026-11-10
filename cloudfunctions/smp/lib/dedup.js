'use strict';
/**
 * 三层去重：文档级（转载/洗稿）→ 事件级（同一委员同类事件多家报道）→ 跨期（与同类刊期已发布内容比对）。
 * 只在“共享至少一位委员”（或同为专委会新闻）的分块内两两比较。
 */
const { shingles, jaccard, stableHash, canonicalUrl, daysBetween, addDays } = require('./text');

const titleSim = (a, b) => jaccard(shingles(a, 2), shingles(b, 2));
const memberSet = (it) => new Set((it.mentions || []).filter((m) => m.status !== 'rejected').map((m) => m.memberId));

function cluster(items, cfg = {}) {
  const k = cfg.shingle_size || 3;
  const near = cfg.near_dup_jaccard ?? 0.6;
  const tsim = cfg.title_sim ?? 0.72;
  const esim = cfg.event_title_sim ?? 0.3;
  const win = cfg.event_window_days ?? 7;
  const sh = items.map((it) => shingles(it.title + String(it.text || '').slice(0, 600), k));
  const parent = items.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const blocks = {};
  items.forEach((it, i) => {
    memberSet(it).forEach((mid) => (blocks[mid] = blocks[mid] || []).push(i));
    if (it.isOrgNews) (blocks.__org__ = blocks.__org__ || []).push(i);
  });
  const seen = new Set();
  for (const idxs of Object.values(blocks)) {
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const i = idxs[x]; const j = idxs[y];
        const key = i < j ? `${i},${j}` : `${j},${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = items[i]; const b = items[j];
        const ts = titleSim(a.title, b.title);
        if (ts >= tsim || jaccard(sh[i], sh[j]) >= near) { union(i, j); continue; }
        if (a.category !== b.category) continue;
        if (a.published && b.published && Math.abs(daysBetween(a.published, b.published)) > win) continue;
        const sameKey = a.levelHit && a.levelHit === b.levelHit && ['honor', 'service'].includes(a.category);
        if (ts >= esim || sameKey) union(i, j);
      }
    }
  }
  const groups = {};
  items.forEach((_, i) => (groups[find(i)] = groups[find(i)] || []).push(i));
  return Object.values(groups);
}

function buildEvents(items, groups, authority, confirmThreshold, issueId) {
  return groups.map((g) => {
    const its = g.map((i) => items[i]).sort((a, b) => (authority(b.domain) - authority(a.domain)) || (String(b.text).length - String(a.text).length));
    const rep = its[0];
    const best = new Map();
    for (const it of its) {
      for (const m of it.mentions || []) {
        if (m.status === 'rejected') continue;
        const cur = best.get(m.memberId);
        if (!cur || m.confidence > cur.confidence) best.set(m.memberId, m);
      }
    }
    const mids = [...best.keys()].sort((a, b) => best.get(b).confidence - best.get(a).confidence);
    const conf = mids.length ? best.get(mids[0]).confidence : (rep.isOrgNews ? 1 : 0);
    const amb = mids.filter((x) => best.get(x).status === 'ambiguous').map((x) => best.get(x).name);
    const dates = its.map((it) => it.published).filter(Boolean).sort();
    return {
      issueId,
      eventId: stableHash(...its.map((it) => it.canonicalUrl).sort()),
      title: rep.title, url: rep.url, site: rep.site, published: dates[0] || null,
      category: rep.category, level: rep.level,
      memberIds: mids, memberNames: mids.map((x) => best.get(x).name),
      memberEvidence: mids.map((x) => { const m = best.get(x); return { memberId: x, name: m.name, confidence: m.confidence, status: m.status, method: m.method, evidence: m.evidence || [] }; }),
      confidence: conf,
      needsReview: amb.length > 0 || (conf < confirmThreshold && !rep.isOrgNews),
      reviewNotes: amb.length ? [`人物待确认:${amb.join('、')}`] : [],
      isOrgNews: its.some((it) => it.isOrgNews),
      previouslyPublished: false,
      sources: its.map((it) => ({ title: it.title, url: it.url, site: it.site, published: it.published })),
      text: String(rep.text || '').slice(0, 1500),
      score: 0, scoreDetail: {}, selected: false, rank: null, headline: '', blurb: '', decision: '',
    };
  });
}

/** archive 只传入同类刊期（周报对周报、月报对月报）。 */
function markHistory(events, archive, periodStart, days = 90) {
  const cutoff = addDays(periodStart, -days);
  const recent = archive.filter((a) => (a.published || a.issueDate || '9999') >= cutoff);
  const urls = new Set(recent.flatMap((a) => (a.urls || []).map(canonicalUrl)));
  let n = 0;
  for (const ev of events) {
    let hit = ev.sources.some((s) => urls.has(canonicalUrl(s.url)));
    if (!hit) {
      hit = recent.some((a) => a.category === ev.category && (a.memberIds || []).some((m) => ev.memberIds.includes(m))
        && titleSim(a.title || '', ev.title) >= 0.5);
    }
    if (hit) { ev.previouslyPublished = true; n++; }
  }
  return n;
}

module.exports = { titleSim, cluster, buildEvents, markHistory };
