'use strict';
/**
 * 云函数 smp：小程序唯一的后端入口（action 路由）+ 定时触发器（每分钟推进采集队列、按计划创建周报/月报）。
 * 调用：wx.cloud.callFunction({ name: 'smp', data: { action: 'issue.get', id: 'weekly-2026-W45' } })
 * 返回：{ ok: true, data } 或 { ok: false, error }
 */
const cloud = require('wx-server-sdk');
const { createStore, isMissingCollection } = require('./service/store');
const { createPipeline } = require('./service/pipeline');
const { createApi } = require('./service/api');
const { createFeed } = require('./service/feed');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const store = createStore(cloud);
const feed = createFeed(store);
const pipeline = createPipeline(store, cloud, feed);
const api = createApi(store, pipeline);

// action → [所需角色, 处理函数]；editor 可复核、改稿、触发采集；admin 另可改配置、导入名单、发布
const ROUTES = {
  'auth.me': [null, (e, u) => api.me(u.openid)],
  'auth.bootstrap': [null, (e, u) => api.bootstrap(u.openid, e.name)],
  'admin.init': ['admin', (e, u) => api.init(u.openid)],
  // 一键建表 + 默认配置 + 导入名单：尚无管理员时（首次部署，含云开发控制台“云端测试”）可直接调用，之后仅管理员可用
  'admin.setupDb': ['setup', (e, u) => api.init(u.openid || 'console')],
  'admin.add': ['admin', (e) => api.addAdmin(e)],

  dashboard: ['editor', () => api.dashboard()],
  'issue.list': ['editor', (e) => api.issueList(e)],
  'issue.get': ['editor', (e) => api.issueGet(e)],
  'issue.start': ['editor', (e, u) => pipeline.start(e, u.openid)],
  'issue.pump': ['editor', (e) => pipeline.pump({ issueId: e.id, budgetMs: 15000 })],
  'issue.analyze': ['editor', async (e) => { const r = await pipeline.analyze(e.id); await pipeline.compose(e.id); return r; }],
  'issue.compose': ['editor', (e) => pipeline.compose(e.id)],
  'issue.export': ['editor', (e) => pipeline.exportHtml(e.id)],
  'issue.publish': ['admin', (e) => pipeline.publish(e.id)],

  'event.list': ['editor', (e) => api.eventList(e)],
  'event.get': ['editor', (e) => api.eventGet(e)],
  'event.decide': ['editor', (e, u) => api.eventDecide(e, u.openid)],
  'event.edit': ['editor', (e, u) => api.eventEdit(e, u.openid)],

  'member.list': ['editor', (e) => api.memberList(e)],
  'member.get': ['editor', (e) => api.memberGet(e)],
  'member.update': ['editor', (e, u) => api.memberUpdate(e, u.openid)],
  'member.enrich': ['editor', (e) => api.memberEnrich(e)],

  'roster.preview': ['admin', (e) => api.rosterPreview(e)],
  'roster.apply': ['admin', (e, u) => api.rosterApply(e, u.openid)],
  'roster.versions': ['editor', () => api.rosterVersions()],

  // 组织日常学术动态（信息流）
  'feed.list': ['editor', (e) => feed.list(e)],
  'feed.status': ['editor', () => feed.status()],
  'feed.refresh': ['editor', (e, u) => feed.refresh(e, u)],
  'feed.pump': ['editor', async (e) => { const job = await feed.running(); return job ? pipeline.pump({ issueId: job._id, budgetMs: 15000 }) : { processed: 0, idle: true }; }],
  'feed.import': ['editor', (e) => feed.importUrls(e)],
  'feed.pullWechat': ['admin', () => feed.pullWechat()],

  'settings.get': ['editor', () => api.settingsGet()],
  'settings.update': ['admin', (e, u) => api.settingsUpdate(e, u.openid)],
};

const RANK = { editor: 1, admin: 2 };

exports.main = async (event) => {
  // 定时触发器：event.Type === 'Timer'
  if (event && event.Type === 'Timer') {
    try { return { ok: true, data: await pipeline.scheduled(new Date()) }; } catch (e) {
      if (isMissingCollection(e)) return { ok: true, data: { skipped: '数据库尚未初始化', collections: await store.ensureCollections() } };
      console.error(e); return { ok: false, error: e.message };
    }
  }
  const { OPENID } = cloud.getWXContext();
  const route = ROUTES[event.action];
  if (!route) return { ok: false, error: `未知操作：${event.action}` };
  try {
    let user;
    try {
      user = await api.me(OPENID);
    } catch (e) {
      if (!isMissingCollection(e)) throw e;
      await store.ensureCollections(); // 首次部署：集合尚未创建，自动建表后重试
      user = await api.me(OPENID);
    }
    const [need, fn] = route;
    if (need === 'setup') {
      if (!user.bootstrapable && user.role !== 'admin') return { ok: false, error: '需要管理员权限', code: 403 };
    } else if (need && (RANK[user.role] || 0) < RANK[need]) {
      return { ok: false, error: need === 'admin' ? '需要管理员权限' : '无访问权限，请联系管理员', code: 403 };
    }
    try {
      return { ok: true, data: await fn(event, user) };
    } catch (e) {
      if (!isMissingCollection(e)) throw e;
      await store.ensureCollections(); // 新版本新增的集合（如 feed / feed_jobs）：自动补建后重试一次
      return { ok: true, data: await fn(event, user) };
    }
  } catch (e) {
    console.error(event.action, e);
    return { ok: false, error: e.message || String(e) };
  }
};
