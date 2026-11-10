'use strict';
/**
 * 组织日常学术动态（信息流）服务：
 *  refresh       管理端按钮：按范围（专委会+社媒派SMP / 核心委员 / 全体委员）与天数创建拉取任务，复用采集任务队列
 *  list          信息流检索（标题/来源/委员姓名/摘要），可按 全部/专委会/委员 筛选
 *  importUrls    粘贴社媒派SMP 等文章链接 → DeepSeek Fetch 抓正文 → 入信息流
 *  pullWechat    （可选）用公众号接口拉取社媒派SMP 已发布文章（需 WX_MP_APPID / WX_MP_SECRET 与 IP 白名单）
 *  upsert        多来源同一篇文章合并（_id = 规范化 URL 哈希）
 */
const { DeepSeek, postJson } = require('../lib/deepseek');
const { MemberIndex, Disambiguator } = require('../lib/disambiguate');
const F = require('../lib/feed');
const T = require('../lib/text');

const RUNNING = ['pending', 'running'];

function createFeed(store) {
  const { db, _, col, getAll, addMany, getDoc } = store;

  async function upsert(docs) {
    let n = 0;
    for (const d of docs) {
      const old = await getDoc('feed', d._id);
      const { _id, ...rest } = d;
      const merged = old ? {
        ...old, ...rest,
        fromSmpAccount: Boolean(old.fromSmpAccount || d.fromSmpAccount), isOrgNews: Boolean(old.isOrgNews || d.isOrgNews),
        memberIds: [...new Set([...(old.memberIds || []), ...(d.memberIds || [])])],
        memberNames: [...new Set([...(old.memberNames || []), ...(d.memberNames || [])])],
        summary: String(d.summary || '').length >= String(old.summary || '').length ? d.summary : old.summary,
        published: old.published || d.published, sources: [...new Set([...(old.sources || [old.source]), d.source].filter(Boolean))],
      } : { ...rest, sources: [d.source] };
      delete merged._id;
      merged.keywords = [merged.title, merged.site, ...(merged.memberNames || [])].join(' ');
      merged.fetchedAt = db.serverDate();
      await col('feed').doc(_id).set({ data: merged });
      n++;
    }
    return n;
  }

  async function running() {
    const { data } = await col('feed_jobs').where({ status: 'running' }).orderBy('createdAt', 'desc').limit(1).get();
    return data[0] || null;
  }

  async function refresh({ scope = 'org', days }, user) {
    if (scope === 'all' && user.role !== 'admin') throw new Error('拉取全体委员动态需要管理员权限');
    const cur = await running();
    if (cur) return { jobId: cur._id, existed: true, job: cur };
    const settings = await store.settings();
    const win = F.feedWindow(Math.min(90, Number(days) || (settings.feed || {}).default_days || 7));
    const members = await getAll(col('members').where({ status: 'active' }));
    const queries = F.planFeedQueries(settings, members, await store.aliasMap(), scope, win);
    const jobId = `feedjob-${Date.now()}`;
    const now = db.serverDate();
    await col('feed_jobs').doc(jobId).set({ data: { scope, days: Number(days) || 7, start: win.start, end: win.end, status: 'running',
      progress: { tasks: queries.length, done: 0, failed: 0 }, stats: { kept: 0 }, estimate: F.estimate(queries.length),
      createdBy: user.openid || 'system', createdAt: now } });
    await addMany('tasks', queries.map((q) => ({ issueId: jobId, type: 'search', query: q.query, oriQuestion: q.oriQuestion || '',
      memberId: q.memberId, kind: q.kind, status: 'pending', attempts: 0, createdAt: now })));
    return { jobId, tasks: queries.length, estimate: F.estimate(queries.length) };
  }

  /** 供采集队列调用：处理一个属于拉取任务的检索结果。 */
  async function handleResults(t, results, ctx) {
    const out = await F.toFeedItems(results, { settings: ctx.settings, window: ctx.period, disambiguator: ctx.dis, queryMemberId: t.memberId });
    await upsert(out.items);
    return out.stats;
  }

  async function finishIfDone(jobId) {
    const { total } = await col('tasks').where({ issueId: jobId, status: _.in(RUNNING) }).count();
    if (total) return false;
    await col('feed_jobs').doc(jobId).update({ data: { status: 'done', finishedAt: db.serverDate() } });
    return true;
  }

  async function list({ q = '', filter = 'all', page = 0 }) {
    const conds = [];
    if (filter === 'org') conds.push({ isOrgNews: true });
    if (filter === 'member') conds.push({ 'memberIds.0': _.exists(true) });
    if (q && q.trim()) {
      const re = db.RegExp({ regexp: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' });
      conds.push(_.or([{ keywords: re }, { summary: re }]));
    }
    const where = conds.length ? _.and(conds) : {};
    const { data } = await col('feed').where(where).orderBy('published', 'desc').skip(page * 20).limit(20).field({ text: false }).get();
    const { total } = await col('feed').where(where).count();
    return { list: data, total, hasMore: data.length === 20 };
  }

  async function status() {
    const { data: jobs } = await col('feed_jobs').orderBy('createdAt', 'desc').limit(5).get();
    const [{ total }, { total: own }] = await Promise.all([col('feed').count(), col('feed').where({ fromSmpAccount: true }).count()]);
    const settings = await store.settings();
    const sync = await getDoc('config', 'wechat_sync');
    // 各范围的预计检索次数（按当前名单与配置实时计算）
    const members = await getAll(col('members').where({ status: 'active' }), { name: true, org: true, roles: true, status: true });
    const aliases = await store.aliasMap();
    const win = F.feedWindow((settings.feed || {}).default_days || 7);
    const estimates = Object.fromEntries(['org', 'core', 'all'].map((k) => [k, F.estimate(F.planFeedQueries(settings, members, aliases, k, win).length)]));
    return { jobs, total, own, estimates, accounts: (settings.feed || {}).accounts || [],
      wechatConfigured: Boolean(process.env.WX_MP_APPID && process.env.WX_MP_SECRET), wechatLast: sync || null };
  }

  async function disambiguator(settings, ds) {
    const members = await getAll(col('members').where({ status: 'active' }));
    return new Disambiguator(settings, new MemberIndex(members, await store.aliasMap()), await getAll(col('overrides')), ds);
  }

  /** 手工导入文章链接（默认视为社媒派SMP 等自有账号文章）。 */
  async function importUrls({ urls = [], own = true }) {
    const settings = await store.settings();
    const ds = new DeepSeek(settings.deepseek, store.cacheStore);
    if (!ds.available) throw new Error('未配置 DEEPSEEK_API_KEY，无法抓取文章');
    const list = [...new Set(String(Array.isArray(urls) ? urls.join('\n') : urls).match(/https?:\/\/[^\s，,]+/g) || [])].slice(0, 10);
    if (!list.length) throw new Error('未识别到文章链接');
    const dis = await disambiguator(settings, ds);
    const accounts = (settings.feed || {}).accounts || ['社媒派SMP'];
    const results = [];
    for (const url of list) {
      try {
        const page = await ds.fetch(url);
        const content = String(page.content || '');
        const r = { title: page.title || url, url, content, site: own ? accounts[0] : T.domainOf(url),
          published: T.parseDate(content.slice(0, 600)) || T.todayCN() };
        const out = await F.toFeedItems([r], { settings, window: F.feedWindow(3650), disambiguator: dis, source: own ? 'wechat_mp' : 'manual' });
        await upsert(out.items);
        results.push({ url, ok: out.items.length > 0, title: r.title, members: out.items[0] ? out.items[0].memberNames : [] });
      } catch (e) {
        results.push({ url, ok: false, error: e.status === 403 ? '目标站点拒绝抓取（403）' : e.status === 404 ? '未能获取正文（404）' : String(e.message || e).slice(0, 120) });
      }
    }
    return { results };
  }

  /** 公众号接口拉取已发布文章（可选）。需公众号 AppID/AppSecret，且公众号后台 IP 白名单包含云函数出口 IP。 */
  async function pullWechat() {
    const appid = process.env.WX_MP_APPID; const secret = process.env.WX_MP_SECRET;
    if (!appid || !secret) throw new Error('未配置 WX_MP_APPID / WX_MP_SECRET（云函数环境变量）');
    const settings = await store.settings();
    const cfg = (settings.feed || {}).wechat_mp || {};
    const tk = await postJson('https://api.weixin.qq.com/cgi-bin/stable_token', { grant_type: 'client_credential', appid, secret }, {}, 15000);
    if (!tk.access_token) throw new Error(wxError(tk));
    const resp = await postJson(`https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${tk.access_token}`,
      { offset: 0, count: Math.min(20, cfg.count || 20), no_content: 1 }, {}, 15000);
    if (resp.errcode) throw new Error(wxError(resp));
    const docs = F.wechatArticlesToFeed(resp, cfg.account_name || ((settings.feed || {}).accounts || ['社媒派SMP'])[0]);
    const n = await upsert(docs);
    await col('config').doc('wechat_sync').set({ data: { at: db.serverDate(), count: n } });
    return { synced: n };
  }

  return { upsert, refresh, handleResults, finishIfDone, list, status, importUrls, pullWechat, running };
}

function wxError(r) {
  const hints = { 40164: '调用 IP 不在公众号白名单：请在公众号后台“设置与开发 → 基本配置 → IP 白名单”加入云函数出口 IP（需开通固定出口 IP）',
    40125: 'AppSecret 无效', 40013: 'AppID 无效', 48001: '公众号未获得该接口权限' };
  return `公众号接口错误 ${r.errcode}：${hints[r.errcode] || r.errmsg || ''}`;
}

module.exports = { createFeed };
