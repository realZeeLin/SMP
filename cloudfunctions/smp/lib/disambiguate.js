'use strict';
/**
 * 委员人物消歧。
 * 1) 姓名识别：名单姓名 + 别名（英文名等）按长度降序匹配，长名优先占位（“张伟男”≠“张伟”）；
 *    两字姓名做右边界校验（“王博士”≠“王博”）。
 * 2) 证据打分 0~1：单位邻近/共现、学术语境、研究关键词、可信域名、查询来源、专委会语境（+）；
 *    同名者特征词、紧邻其他单位、常见名（−）。
 * 3) 名单内重名按证据择优，分不开则待复核；中间段可交给 DeepSeek 裁决；人工结论（overrides）优先。
 */
const { isCjk } = require('./text');
const { nameVariants, memberOrgNames } = require('./profiles');

const OK_FOLLOW = ['教授', '研究员', '老师', '博士', '院士', '副', '团队', '课题组', '等', '和', '与', '及', '的', '在', '是', '为',
  '表示', '指出', '认为', '介绍', '应邀', '获', '荣获', '当选', '担任', '出任', '带领', '作', '做', '发表', '主持', '出席', '参加',
  '同志', '先生', '女士', '院长', '主任', '校长', '书记', '所长', '主席', '委员', '说', '也', '将', '于', '被', '以', '从', '还',
  '首席', '讲席', '特聘', '长聘', '博导', '获得', '入选', '一行', '率', '牵头', '领衔', '指导', '合作', '共同', '分享', '解读', '撰文',
  '提出', '实验室', '组', '就', '向', '对', '给', '作为', '已', '曾', '现任', '任', '受邀', '致辞', '演讲', '报告', '讲座', '团', '课题',
  '副教授', '讲师', '研究', '领导', '老', '等人'];

const isAscii = (s) => /^[\x00-\x7f]+$/.test(s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function contains(text, term) {
  if (!term) return false;
  if (isAscii(term)) return new RegExp(`(?<![A-Za-z])${escapeRe(term)}(?![A-Za-z])`).test(text);
  return text.includes(term);
}

class MemberIndex {
  constructor(members, aliasMap, extraOrgNames = []) {
    this.members = new Map(members.filter((m) => m.status === 'active').map((m) => [m._id, m]));
    const variants = new Map();
    for (const m of this.members.values()) {
      for (const v of nameVariants(m)) { if (!variants.has(v)) variants.set(v, []); variants.get(v).push(m._id); }
    }
    this.variants = [...variants.entries()].sort((a, b) => b[0].length - a[0].length);
    this.orgNames = new Map([...this.members.values()].map((m) => [m._id, memberOrgNames(m, aliasMap)]));
    const all = new Set(extraOrgNames.filter((n) => !isAscii(n) && n.length >= 2));
    Object.entries(aliasMap || {}).forEach(([k, v]) => { all.add(k); (v || []).forEach((a) => { if (!isAscii(a) && a.length >= 2) all.add(a); }); });
    for (const names of this.orgNames.values()) names.forEach((n) => { if (!isAscii(n) && n.length >= 2) all.add(n); });
    this.allOrgs = [...all].sort((a, b) => b.length - a.length);
  }

  find(text) {
    const taken = new Uint8Array(text.length);
    const out = [];
    const lower = text.toLowerCase();
    const free = (s, e) => { for (let i = s; i < e; i++) if (taken[i]) return false; return true; };
    const take = (s, e) => { for (let i = s; i < e; i++) taken[i] = 1; };
    for (const [variant, ids] of this.variants) {
      if (isAscii(variant)) {
        const re = new RegExp(`(?<![A-Za-z])${escapeRe(variant.toLowerCase())}(?![A-Za-z])`, 'g');
        let m;
        while ((m = re.exec(lower))) {
          const s = m.index; const e = s + m[0].length;
          if (!free(s, e)) continue;
          take(s, e); out.push({ ids, variant, start: s, end: e, ok: true });
        }
        continue;
      }
      let from = 0; let i;
      while ((i = text.indexOf(variant, from)) !== -1) {
        const e = i + variant.length; from = i + 1;
        if (!free(i, e)) continue;
        const ok = variant.length >= 3 || e >= text.length || !isCjk(text[e]) || OK_FOLLOW.some((w) => text.startsWith(w, e));
        if (ok) take(i, e);
        out.push({ ids, variant, start: i, end: e, ok });
      }
    }
    return out;
  }
}

class Disambiguator {
  constructor(settings, index, overrides = [], ds = null) {
    const c = settings.disambiguation || {};
    this.c = c;
    this.idx = index;
    this.window = c.context_window || 60;
    this.hi = c.confirm_threshold ?? 0.6;
    this.lo = c.reject_threshold ?? 0.4;
    this.ds = c.use_llm_for_ambiguous === false ? null : ds;
    this.llmBudget = c.llm_max_calls ?? 120;
    this.overrides = new Map();
    overrides.filter((o) => o.type === 'mention').forEach((o) => this.overrides.set(`${o.url}|${o.memberId}`, o.decision));
  }

  status(c) { return c >= this.hi ? 'confirmed' : c < this.lo ? 'rejected' : 'ambiguous'; }

  score(item, text, mid, occs) {
    const m = this.idx.members.get(mid);
    const p = m.profile || {};
    const ev = [];
    let conf = 0.3;
    const ex = (p.excludeUrlPatterns || []).find((pat) => pat && item.url.includes(pat));
    if (ex) return [0, [`命中排除链接规则:${ex}`]];
    const near = occs.map((o) => text.slice(Math.max(0, o.start - this.window), o.end + this.window)).join(' ');
    const orgs = this.idx.orgNames.get(mid) || [];
    const orgNear = orgs.find((o) => contains(near, o));
    if (orgNear) { conf += 0.35; ev.push(`单位邻近:${orgNear}`); } else {
      const orgAny = orgs.find((o) => contains(text, o));
      if (orgAny) { conf += 0.2; ev.push(`单位共现:${orgAny}`); } else {
        const tight = occs.map((o) => text.slice(Math.max(0, o.start - 20), o.end + 20)).join(' ');
        const other = this.idx.allOrgs.find((o) => tight.includes(o) && !orgs.includes(o));
        if (other) { conf -= 0.15; ev.push(`邻近其他单位:${other}`); }
      }
    }
    if ((this.c.academic_terms || []).some((t) => near.includes(t))) { conf += 0.1; ev.push('学术语境'); }
    const kws = [...(p.keywords || []), ...(p.researchAreas || [])].filter(Boolean);
    const hits = kws.filter((k) => text.includes(k));
    if (hits.length) { conf += Math.min(0.2, 0.05 * hits.length); ev.push(`研究方向:${hits.slice(0, 4).join('、')}`); }
    if ((p.trustedDomains || []).some((d) => d && item.domain.includes(d))) { conf += 0.3; ev.push('可信域名'); }
    const neg = [...(this.c.negative_terms || []), ...(p.negativeKeywords || [])].filter((t) => t && near.includes(t));
    if (neg.length) { conf -= 0.35; ev.push(`同名者特征:${neg.slice(0, 3).join('、')}`); }
    if ((item.queryMemberIds || []).includes(mid)) { conf += 0.1; ev.push('查询来源'); }
    if ((this.c.smp_terms || []).some((t) => text.includes(t))) { conf += 0.1; ev.push('专委会语境'); }
    if (occs.some((o) => o.start < item.title.length)) { conf += 0.05; ev.push('标题提及'); }
    if ((m.auto || {}).commonName) { conf -= 0.1; ev.push('常见姓名'); }
    return [Math.round(Math.max(0, Math.min(1, conf)) * 1000) / 1000, ev];
  }

  async llmJudge(item, text, mid, occs) {
    if (!this.ds || !this.ds.available || this.llmBudget <= 0) return null;
    this.llmBudget--;
    const m = this.idx.members.get(mid);
    const p = m.profile || {};
    const profile = { name: m.name, org: m.org, roles: m.roles, title: p.title, researchAreas: p.researchAreas, keywords: p.keywords };
    const snippet = occs.slice(0, 3).map((o) => text.slice(Math.max(0, o.start - 150), o.end + 150)).join(' …… ').slice(0, 1200);
    try {
      const r = await this.ds.chatJson(
        '你是学术人物消歧助手。判断新闻中提到的人是否为给定档案中的学者本人。只依据文本证据，不要臆测。'
        + '输出 JSON：{"same_person":"yes|no|unsure","confidence":0~1,"reason":"一句话"}',
        `人物档案：${JSON.stringify(profile)}\n\n新闻标题：${item.title}\n新闻片段：${snippet}`);
      return [String(r.same_person || 'unsure'), Number(r.confidence ?? 0.5), String(r.reason || '')];
    } catch (e) { return null; }
  }

  async run(item) {
    const text = `${item.title}\n${item.text}`;
    const byMember = new Map();
    for (const o of this.idx.find(text)) {
      if (!o.ok) continue;
      o.ids.forEach((id) => { if (!byMember.has(id)) byMember.set(id, []); byMember.get(id).push(o); });
    }
    const mentions = [];
    for (const [mid, occs] of byMember) {
      const [conf, ev] = this.score(item, text, mid, occs);
      mentions.push({ memberId: mid, name: this.idx.members.get(mid).name, confidence: conf, status: this.status(conf), evidence: ev, method: 'rules' });
    }
    resolveHomonyms(mentions);
    for (const m of mentions) {
      if (m.status === 'ambiguous') {
        const r = await this.llmJudge(item, text, m.memberId, byMember.get(m.memberId));
        if (r) {
          const [verdict, c, reason] = r;
          if (verdict === 'yes') m.confidence = Math.max(m.confidence, 0.5 + 0.5 * c);
          else if (verdict === 'no') m.confidence = Math.min(m.confidence, 0.5 - 0.5 * c);
          m.confidence = Math.round(m.confidence * 1000) / 1000;
          m.status = this.status(m.confidence); m.method = 'rules+llm';
          m.evidence.push(`LLM:${verdict}(${c.toFixed(2)}) ${reason}`.slice(0, 120));
        }
      }
    }
    applyMentionOverrides(item, mentions, this.overrides);
    return mentions;
  }
}

function resolveHomonyms(mentions) {
  const groups = {};
  mentions.forEach((m) => { (groups[m.name] = groups[m.name] || []).push(m); });
  for (const ms of Object.values(groups)) {
    if (ms.length < 2) continue;
    ms.sort((a, b) => b.confidence - a.confidence);
    if (ms[0].confidence - ms[1].confidence >= 0.15) {
      ms.slice(1).forEach((m) => { m.status = 'rejected'; m.evidence.push(`名单内重名，判归 ${ms[0].memberId}`); });
    } else {
      ms.forEach((m) => { if (m.status !== 'rejected') m.status = 'ambiguous'; m.evidence.push('名单内重名且证据不足以区分'); });
    }
  }
}

/** 人工结论覆盖（可在分析阶段对已存储条目重复应用）。 */
function applyMentionOverrides(item, mentions, overrideMap) {
  for (const m of mentions) {
    const d = overrideMap.get(`${item.url}|${m.memberId}`) || overrideMap.get(`${item.canonicalUrl}|${m.memberId}`);
    if (d === 'confirm' || d === 'reject') {
      m.status = d === 'confirm' ? 'confirmed' : 'rejected';
      m.confidence = d === 'confirm' ? 1 : 0;
      m.method = 'manual';
    }
  }
}

module.exports = { MemberIndex, Disambiguator, contains, resolveHomonyms, applyMentionOverrides };
