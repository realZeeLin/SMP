'use strict';
/**
 * 委员名单：解析（官网文本 / CSV）与版本同步（纯函数，不涉及数据库）。
 * 同步规则：
 *  - 姓名 + 单位一致 → 同一人，沿用 ID，比较身份变化；
 *  - 姓名一致、单位不同，且新旧名单中该姓名都只剩一人 → 单位变更（沿用 ID，提示人工确认）；
 *  - 新出现 → 新 ID；旧有新无 → inactive（离任，保留档案）。
 */
const { normName, normOrg } = require('./text');

const ROLE_ORDER = ['指导委员会主任', '指导委员会副主任', '指导委员会委员', '主任', '副主任', '秘书长', '副秘书长', '秘书',
  '荣誉委员', '常务委员', '委员', '海外委员'];

const roleRank = (roles) => Math.min(...(roles || []).map((r) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : 99)), 99);
const sortRoles = (roles) => [...new Set(roles)].sort((a, b) => roleRank([a]) - roleRank([b]));
const sameRoles = (a, b) => JSON.stringify(sortRoles(a)) === JSON.stringify(sortRoles(b));

function parseRosterText(text) {
  const entries = new Map();
  let role = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim();
    if (!line) continue;
    if (ROLE_ORDER.includes(line)) { role = line; continue; }
    if (!role) continue;
    let disp; let org;
    const i = line.indexOf(' ');
    if (i > 0) { disp = line.slice(0, i); org = line.slice(i + 1); } else {
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      org = parts.pop(); disp = parts.join(' ');
    }
    const name = normName(disp);
    org = normOrg(org);
    if (!name || name.length > 12) continue;
    const key = `${name}@${org}`;
    if (entries.has(key)) {
      const e = entries.get(key);
      if (!e.roles.includes(role)) e.roles.push(role);
    } else entries.set(key, { displayName: disp.trim(), name, org, roles: [role] });
  }
  return [...entries.values()];
}

function parseRosterCsv(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = lines.shift().split(',').map((h) => h.trim());
  const idx = (k) => head.indexOf(k);
  const out = new Map();
  for (const l of lines) {
    const cols = l.split(',');
    const name = normName(cols[idx('name')]);
    if (!name) continue;
    const org = normOrg(cols[idx('org')] || '');
    const roles = String(cols[idx('roles')] || '委员').split(/[;；、|]/).map((r) => r.trim()).filter(Boolean);
    const key = `${name}@${org}`;
    if (out.has(key)) out.get(key).roles = [...new Set(out.get(key).roles.concat(roles))];
    else out.set(key, { displayName: name, name, org, roles });
  }
  return [...out.values()];
}

const parseRoster = (text) => (/^﻿?name,/.test(String(text).trim()) ? parseRosterCsv(text) : parseRosterText(text));

function nextIdFactory(members) {
  let max = 0;
  for (const m of members) { const mm = /^M(\d+)$/.exec(m._id); if (mm) max = Math.max(max, +mm[1]); }
  return () => `M${String(++max).padStart(4, '0')}`;
}

/**
 * @param existing 现有 members 文档（含 inactive）
 * @param entries  parseRoster 的结果
 * @returns {{ upserts: object[], changes: object[], summary: object }}
 */
function syncRoster(existing, entries, effective) {
  const members = existing.map((m) => JSON.parse(JSON.stringify(m)));
  const byKey = new Map(members.map((m) => [`${m.name}@${normOrg(m.org)}`, m]));
  const matched = new Set();
  const touched = new Set();
  const changes = [];
  const summary = { added: 0, removed: 0, reactivated: 0, roleChanged: 0, orgChanged: 0, unchanged: 0 };
  const pending = [];

  for (const e of entries) {
    const m = byKey.get(`${e.name}@${e.org}`);
    if (!m || matched.has(m._id)) { pending.push(e); continue; }
    matched.add(m._id);
    let changed = false;
    if (m.status !== 'active') {
      m.status = 'active'; m.left = null; changed = true;
      summary.reactivated++; changes.push({ type: 'reactivated', memberId: m._id, name: m.name });
    }
    if (!sameRoles(m.roles, e.roles)) {
      changes.push({ type: 'role_changed', memberId: m._id, name: m.name, before: m.roles, after: sortRoles(e.roles) });
      m.roles = sortRoles(e.roles); changed = true; summary.roleChanged++;
    }
    if (m.displayName !== e.displayName) { m.displayName = e.displayName; changed = true; }
    if (changed) touched.add(m._id); else summary.unchanged++;
  }

  const pendingCount = {};
  pending.forEach((e) => { pendingCount[e.name] = (pendingCount[e.name] || 0) + 1; });
  const nextId = nextIdFactory(members);
  for (const e of pending) {
    const cands = members.filter((m) => m.name === e.name && !matched.has(m._id) && m.status === 'active');
    if (cands.length === 1 && pendingCount[e.name] === 1) {
      const m = cands[0];
      matched.add(m._id); touched.add(m._id);
      changes.push({ type: 'org_changed', memberId: m._id, name: m.name, before: m.org, after: e.org });
      const hist = m.orgHistory || [{ org: m.org, since: m.joined || effective }];
      hist[hist.length - 1].until = effective;
      hist.push({ org: e.org, since: effective });
      m.orgHistory = hist; m.org = e.org; summary.orgChanged++;
      if (!sameRoles(m.roles, e.roles)) {
        changes.push({ type: 'role_changed', memberId: m._id, name: m.name, before: m.roles, after: sortRoles(e.roles) });
        m.roles = sortRoles(e.roles); summary.roleChanged++;
      }
      continue;
    }
    const m = { _id: nextId(), name: e.name, displayName: e.displayName, org: e.org, roles: sortRoles(e.roles),
      status: 'active', joined: effective, left: null, orgHistory: [{ org: e.org, since: effective }] };
    members.push(m); matched.add(m._id); touched.add(m._id);
    changes.push({ type: 'added', memberId: m._id, name: m.name, after: { org: m.org, roles: m.roles } });
    summary.added++;
  }

  for (const m of members) {
    if (!matched.has(m._id) && m.status === 'active') {
      m.status = 'inactive'; m.left = effective; touched.add(m._id);
      changes.push({ type: 'removed', memberId: m._id, name: m.name, before: { org: m.org, roles: m.roles } });
      summary.removed++;
    }
  }
  members.forEach((m) => { m.roleRank = roleRank(m.roles); });
  return { members, upserts: members.filter((m) => touched.has(m._id)), changes, summary };
}

function homonymMap(members) {
  const g = {};
  members.filter((m) => m.status === 'active').forEach((m) => { (g[m.name] = g[m.name] || []).push(m._id); });
  return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length > 1));
}

module.exports = { ROLE_ORDER, roleRank, parseRoster, parseRosterText, parseRosterCsv, syncRoster, homonymMap };
