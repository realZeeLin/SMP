'use strict';
/** 面向小程序页面的读写接口：工作台、期刊、事件复核、委员与画像、名单变更、设置、权限。 */
const fs = require('fs');
const path = require('path');
const { parseRoster, syncRoster, homonymMap, roleRank, ROLE_ORDER } = require('../lib/roster');
const { emptyProfile, buildAuto, initialOf, completeness } = require('../lib/profiles');
const { CATEGORIES } = require('../lib/classify');
const { DeepSeek } = require('../lib/deepseek');
const { todayCN } = require('../lib/text');

const PROFILE_FIELDS = Object.keys(emptyProfile());

function createApi(store, pipeline) {
  const { db, _, col, getAll, addMany, getDoc, deepMerge } = store;

  // ---------------- 权限 ----------------
  async function me(openid) {
    const { data } = await col('admins').where({ openid }).limit(1).get();
    const { total } = await col('admins').count();
    return { openid, role: data[0] ? data[0].role : null, name: data[0] ? data[0].name : '', bootstrapable: total === 0 };
  }

  async function bootstrap(openid, name) {
    await store.ensureCollections();
    const { total } = await col('admins').count();
    if (total > 0) throw new Error('已存在管理员，请联系管理员添加');
    await col('admins').add({ data: { openid, name: name || '管理员', role: 'admin', createdAt: db.serverDate() } });
    return init(openid);
  }

  async function addAdmin({ openid, name, role = 'editor' }) {
    await col('admins').add({ data: { openid, name, role, createdAt: db.serverDate() } });
    return { ok: true };
  }

  /** 初始化：建表 → 写入默认配置 → 导入随函数打包的名单（各步均幂等，已有数据不覆盖）。 */
  async function init(operator) {
    const out = { collections: await store.ensureCollections() };
    if (!(await getDoc('config', 'settings'))) { await col('config').doc('settings').set({ data: { value: {}, updatedAt: db.serverDate() } }); out.settings = 'created'; }
    if (!(await getDoc('config', 'org_aliases'))) {
      await col('config').doc('org_aliases').set({ data: { map: require('../data/org_aliases.json'), updatedAt: db.serverDate() } });
      out.orgAliases = 'created';
    }
    // 以“名单版本记录”判断是否导入完成（版本记录在全部委员写入后才生成）：
    // 若上次导入中途超时，members 只有部分数据但没有版本记录，再次执行会补齐缺失委员。
    const { total: versions } = await col('roster_versions').count();
    if (!versions) {
      const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'roster-2026-11-10.txt'), 'utf8');
      out.roster = await rosterApply({ text, effective: '2026-11-10', source: '官网委员名单 2026-11-10' }, operator);
    }
    return out;
  }

  // ---------------- 工作台 ----------------
  async function dashboard() {
    const [{ data: issues }, members, { total: pendingReview }, { data: changes }] = await Promise.all([
      col('issues').orderBy('start', 'desc').limit(6).field({ html: false, markdown: false }).get(),
      col('members').where({ status: 'active' }).count(),
      col('events').where({ selected: true, needsReview: true, decision: '' }).count(),
      col('roster_changes').orderBy('date', 'desc').limit(5).get(),
    ]);
    const latest = (k) => issues.find((i) => i.kind === k) || null;
    return { weekly: latest('weekly'), monthly: latest('monthly'), recent: issues, memberCount: members.total, pendingReview, changes, today: todayCN() };
  }

  // ---------------- 期刊 ----------------
  async function issueList({ kind, page = 0 }) {
    const where = kind ? { kind } : {};
    const { data } = await col('issues').where(where).orderBy('start', 'desc').skip(page * 20).limit(20).field({ html: false, markdown: false }).get();
    return { list: data, hasMore: data.length === 20 };
  }

  async function issueGet({ id }) {
    const issue = await getDoc('issues', id);
    if (!issue) throw new Error('期刊不存在');
    const events = await getAll(col('events').where({ issueId: id, selected: true }).orderBy('rank', 'asc'),
      { text: false, sources: false, scoreDetail: false });
    return { issue, events, categories: CATEGORIES };
  }

  // ---------------- 事件 / 复核 ----------------
  async function eventList({ issueId, tab = 'selected', page = 0 }) {
    let where = { issueId };
    if (tab === 'selected') where.selected = true;
    else if (tab === 'review') where = { issueId, needsReview: true, selected: true };
    else if (tab === 'candidates') where.selected = false;
    if (tab === 'filtered') {
      const { data } = await col('filtered').where({ issueId }).skip(page * 20).limit(20).get();
      return { list: data, hasMore: data.length === 20 };
    }
    const order = tab === 'selected' ? ['rank', 'asc'] : ['score', 'desc'];
    const { data } = await col('events').where(where).orderBy(...order).skip(page * 20).limit(20).field({ text: false }).get();
    return { list: data, hasMore: data.length === 20 };
  }

  async function eventGet({ id }) {
    const ev = await getDoc('events', id);
    if (!ev) throw new Error('事件不存在');
    const { data: members } = await col('members').where({ _id: _.in(ev.memberIds) }).field({ name: true, org: true, roles: true, 'profile.title': true }).get();
    return { event: ev, members, categories: CATEGORIES };
  }

  /** 复核决定：立即更新事件状态，并写入 overrides 长期生效；期刊标记 dirty，提示“重新编排”。 */
  async function eventDecide({ id, decision }, operator) {
    const ev = await getDoc('events', id);
    const now = db.serverDate();
    const patch = { decision, editedBy: operator, updatedAt: now };
    if (decision === 'keep') { patch.selected = true; patch.needsReview = false; }
    if (decision === 'drop') patch.selected = false;
    if (decision === 'confirm') patch.needsReview = false;
    if (decision === 'wrong_person') { patch.selected = false; patch.needsReview = false; }
    await col('events').doc(id).update({ data: patch });
    if (decision === 'keep' || decision === 'drop') {
      await col('overrides').where({ type: 'event', eventId: ev.eventId }).remove();
      await col('overrides').add({ data: { type: 'event', eventId: ev.eventId, url: ev.url, decision, operator, createdAt: now } });
    } else {
      const docs = [];
      for (const s of ev.sources) for (const m of ev.memberIds) {
        docs.push({ type: 'mention', url: s.url, memberId: m, decision: decision === 'wrong_person' ? 'reject' : 'confirm', operator, createdAt: now });
      }
      await addMany('overrides', docs);
    }
    await col('issues').doc(ev.issueId).update({ data: { dirty: true, updatedAt: now } });
    return { ok: true };
  }

  async function eventEdit({ id, headline, blurb, category }, operator) {
    const patch = { manualEdited: true, editedBy: operator, updatedAt: db.serverDate() };
    if (headline !== undefined) patch.headline = String(headline).slice(0, 60);
    if (blurb !== undefined) patch.blurb = String(blurb).slice(0, 300);
    if (category && CATEGORIES[category]) patch.category = category;
    await col('events').doc(id).update({ data: patch });
    const ev = await getDoc('events', id);
    await col('issues').doc(ev.issueId).update({ data: { dirty: true } });
    return { ok: true };
  }

  // ---------------- 委员 / 画像 ----------------
  async function memberList({ q = '', role = '', status = 'active', page = 0, pageSize = 30, sort = 'role' }) {
    const size = Math.min(Math.max(+pageSize || 30, 1), 100);
    const conds = [];
    if (status) conds.push({ status });
    if (role) conds.push({ roles: role });
    if (q) {
      const re = db.RegExp({ regexp: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' });
      conds.push(_.or([{ name: re }, { org: re }, { 'profile.researchAreas': re }]));
    }
    const where = conds.length ? _.and(conds) : {};
    let query = col('members').where(where);
    query = sort === 'initial' ? query.orderBy('initial', 'asc').orderBy('name', 'asc') : query.orderBy('roleRank', 'asc').orderBy('initial', 'asc');
    const { data } = await query.skip(page * size).limit(size)
      .field({ name: true, displayName: true, org: true, roles: true, initial: true, completeness: true, stats: true, status: true, 'profile.title': true, 'profile.verified': true, 'auto.homonyms': true })
      .get();
    const { total } = await col('members').where(where).count();
    return { list: data, total, hasMore: data.length === size, roles: ROLE_ORDER };
  }

  async function memberGet({ id }) {
    const m = await getDoc('members', id);
    if (!m) throw new Error('委员不存在');
    const [{ data: changes }, { data: timeline }, { data: recent }] = await Promise.all([
      col('roster_changes').where({ memberId: id }).orderBy('date', 'desc').limit(20).get(),
      col('archive').where({ memberIds: id }).orderBy('published', 'desc').limit(30).get(),
      col('events').where({ memberIds: id }).orderBy('published', 'desc').limit(10).field({ text: false, sources: false }).get(),
    ]);
    const homonyms = (m.auto && m.auto.homonyms && m.auto.homonyms.length)
      ? (await col('members').where({ _id: _.in(m.auto.homonyms) }).field({ name: true, org: true }).get()).data : [];
    return { member: m, changes, timeline, recent, homonyms, categories: CATEGORIES };
  }

  async function memberUpdate({ id, profile }, operator) {
    const m = await getDoc('members', id);
    const clean = {};
    for (const k of PROFILE_FIELDS) if (profile[k] !== undefined) clean[k] = profile[k];
    const merged = { ...m.profile, ...clean };
    await col('members').doc(id).update({ data: { profile: _.set(merged), completeness: completeness(merged), updatedAt: db.serverDate(), updatedBy: operator } });
    return { ok: true, completeness: completeness(merged) };
  }

  async function memberEnrich({ id }) {
    const settings = await store.settings();
    const ds = new DeepSeek(settings.deepseek, store.cacheStore);
    if (!ds.available) throw new Error('未配置 DEEPSEEK_API_KEY');
    const m = await getDoc('members', id);
    const results = await ds.search(`${m.name} ${m.org} 教授 研究方向 个人主页`, { [(settings.deepseek.search || {}).count_field || 'count']: 10 });
    const ctx = results.slice(0, 10).map((r) => ({ title: r.title, url: r.url, snippet: String(r.snippet || r.content || '').slice(0, 400) }));
    const data = await ds.chatJson('你是学术人物画像助手。根据搜索结果为指定学者整理画像。只使用与该学者（姓名+单位一致）相符的信息，不确定的字段留空，不要编造。'
      + '输出 JSON：{"title":"职称/职务","department":"院系","researchAreas":["≤6个"],"keywords":["可用于识别此人的特征词，如实验室/团队/代表成果，≤8个"],'
      + '"homepage":"URL","aliases":["英文名写法"],"bio":"80字以内简介","sources":["使用到的URL"]}', `学者：${m.name}，单位：${m.org}\n搜索结果：${JSON.stringify(ctx)}`);
    const p = { ...m.profile };
    const fields = [];
    for (const k of ['title', 'department', 'homepage', 'bio']) if (data[k] && !p[k]) { p[k] = String(data[k]).trim(); fields.push(k); }
    for (const k of ['researchAreas', 'keywords', 'aliases']) {
      const v = (data[k] || []).map((x) => String(x).trim()).filter(Boolean);
      if (v.length && !(p[k] || []).length) { p[k] = v; fields.push(k); }
    }
    if (fields.length) {
      p.enriched = { date: todayCN(), sources: (data.sources || []).slice(0, 5), fields };
      p.verified = false;
      await col('members').doc(id).update({ data: { profile: _.set(p), completeness: completeness(p), updatedAt: db.serverDate() } });
    }
    return { fields, profile: p };
  }

  // ---------------- 名单变更 ----------------
  async function rosterPreview({ text, effective }) {
    const entries = parseRoster(text);
    if (!entries.length) throw new Error('未解析到委员，请检查格式（身份标题行 + “姓名 单位”行，或 CSV：name,org,roles）');
    const existing = await getAll(col('members'));
    const r = syncRoster(existing, entries, effective || todayCN());
    return { total: entries.length, summary: r.summary, changes: r.changes.slice(0, 200) };
  }

  async function rosterApply({ text, effective, source }, operator) {
    effective = effective || todayCN();
    const entries = parseRoster(text);
    if (!entries.length) throw new Error('未解析到委员');
    const existing = await getAll(col('members'));
    const r = syncRoster(existing, entries, effective);
    const aliases = await store.aliasMap();
    const settings = await store.settings();
    const hom = homonymMap(r.members);
    const existingIds = new Set(existing.map((m) => m._id));
    const now = db.serverDate();
    const upsertIds = new Set(r.upserts.map((m) => m._id));
    const all = r.members.map((m) => {
      const prev = existing.find((x) => x._id === m._id) || {};
      const profile = prev.profile || emptyProfile();
      return { ...m, roleRank: roleRank(m.roles), initial: initialOf(m.name), profile, completeness: completeness(profile),
        auto: buildAuto(m, aliases, hom, settings.disambiguation.common_surnames), stats: prev.stats || { eventCount: 0, lastEventAt: null, lastIssue: null } };
    });
    // 新增 → set 整个文档；已有 → 只更新名单字段与自动字段（不触碰 profile 与 stats）
    for (let i = 0; i < all.length; i += 20) {
      await Promise.all(all.slice(i, i + 20).map((m) => {
        const { _id, profile, stats, ...rosterFields } = m;
        if (!existingIds.has(_id)) return col('members').doc(_id).set({ data: { ...rosterFields, profile, stats, updatedAt: now } });
        const prev = existing.find((x) => x._id === _id);
        if (!upsertIds.has(_id) && JSON.stringify(prev.auto) === JSON.stringify(m.auto)) return null;
        return col('members').doc(_id).update({ data: { ...rosterFields, auto: _.set(m.auto), orgHistory: _.set(m.orgHistory || []), updatedAt: now } });
      }));
    }
    const { _id: versionId } = await col('roster_versions').add({ data: { effective, source: source || '', total: entries.length, summary: r.summary, operator, createdAt: now } });
    await addMany('roster_changes', r.changes.map((c) => ({ ...c, versionId, date: effective, createdAt: now })));
    return { versionId, total: entries.length, summary: r.summary };
  }

  async function rosterVersions() {
    const { data } = await col('roster_versions').orderBy('createdAt', 'desc').limit(20).get();
    return { list: data };
  }

  // ---------------- 设置 ----------------
  async function settingsGet() {
    const settings = await store.settings();
    const doc = await getDoc('config', 'settings');
    const { data: admins } = await col('admins').get();
    return { settings, overrides: (doc && doc.value) || {}, apiKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY), admins };
  }

  async function settingsUpdate({ patch }, operator) {
    const doc = await getDoc('config', 'settings');
    const value = deepMerge((doc && doc.value) || {}, patch || {});
    await col('config').doc('settings').set({ data: { value, updatedAt: db.serverDate(), updatedBy: operator } });
    return { ok: true };
  }

  return { me, bootstrap, addAdmin, init, dashboard, issueList, issueGet, eventList, eventGet, eventDecide, eventEdit,
    memberList, memberGet, memberUpdate, memberEnrich, rosterPreview, rosterApply, rosterVersions, settingsGet, settingsUpdate };
}

module.exports = { createApi };
