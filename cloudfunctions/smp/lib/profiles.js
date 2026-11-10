'use strict';
/** 委员画像：空模板、自动字段（拼音英文名/单位别名/常见名/重名）、完整度、消歧视图。 */
const { normOrg } = require('./text');

let pinyinFn = null;
try { pinyinFn = require('pinyin-pro').pinyin; } catch (e) { /* 可选依赖 */ }

const COMPOUND = new Set(['欧阳', '司马', '上官', '诸葛', '东方', '皇甫', '尉迟', '公孙', '慕容', '令狐', '长孙', '宇文', '司徒', '夏侯']);

const emptyProfile = () => ({
  aliases: [], title: '', department: '', researchAreas: [], keywords: [], negativeKeywords: [],
  orgAliases: [], homepage: '', scholar: { dblp: '', googleScholar: '', orcid: '', aminer: '' },
  trustedDomains: [], excludeUrlPatterns: [], bio: '', notes: '', verified: false,
  enriched: { date: '', sources: [], fields: [] },
});

function syllables(name) {
  if (!pinyinFn || !name || name.includes('·')) return null;
  const arr = pinyinFn(name, { toneType: 'none', type: 'array', surname: 'head' });
  return arr.every((s) => /^[a-zü]+$/i.test(s)) ? arr.map((s) => s.replace('ü', 'v')) : null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function englishNames(name) {
  const syl = syllables(name);
  if (!syl || syl.length < 2) return [];
  const n = COMPOUND.has(name.slice(0, 2)) && name.length > 2 ? 2 : 1;
  const sur = cap(syl.slice(0, n).join(''));
  const given = cap(syl.slice(n).join(''));
  return [`${given} ${sur}`, `${sur} ${given}`];
}

function initialOf(name) {
  const syl = syllables(name);
  return syl ? syl[0][0].toUpperCase() : '#';
}

function orgNames(org, aliasMap, extra = []) {
  org = normOrg(org);
  const names = [org, ...((aliasMap || {})[org] || [])];
  if (org.startsWith('中国科学院')) names.push(org.replace('中国科学院', '中科院'));
  const base = org.split('（')[0];
  if (base !== org) names.push(base + org.slice(base.length).replace(/[（）]/g, ''));
  return [...new Set(names.concat(extra).filter(Boolean))];
}

function orgShort(org, aliasMap) {
  const al = (aliasMap || {})[normOrg(org)] || [];
  return al.find((a) => !/^[\x00-\x7f]+$/.test(a)) || org;
}

const isCommonName = (name, surnames) => name.length === 2 && (surnames || []).includes(name[0]);

function buildAuto(member, aliasMap, homonyms, commonSurnames) {
  return {
    englishNames: englishNames(member.name),
    orgNames: orgNames(member.org, aliasMap),
    commonName: isCommonName(member.name, commonSurnames),
    homonyms: (homonyms[member.name] || []).filter((id) => id !== member._id),
  };
}

function completeness(p) {
  p = p || {};
  const keys = ['title', 'researchAreas', 'keywords', 'homepage', 'bio'];
  return Math.round((keys.filter((k) => (Array.isArray(p[k]) ? p[k].length : p[k])).length / keys.length) * 100) / 100;
}

/** 消歧使用：姓名写法（含英文名、别名）与单位写法（含历史单位）。 */
function nameVariants(m) {
  const p = m.profile || {};
  return [...new Set([m.name, ...(p.aliases || []), ...((m.auto || {}).englishNames || [])].filter(Boolean))];
}

function memberOrgNames(m, aliasMap) {
  const p = m.profile || {};
  const auto = (m.auto || {}).orgNames || orgNames(m.org, aliasMap);
  const hist = (m.orgHistory || []).map((h) => h.org).filter(Boolean);
  return [...new Set([...auto, ...(p.orgAliases || []), ...hist])];
}

module.exports = { emptyProfile, englishNames, initialOf, orgNames, orgShort, isCommonName, buildAuto, completeness, nameVariants, memberOrgNames };
