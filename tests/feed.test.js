'use strict';
/** 组织日常学术动态：纯逻辑单测 + 云函数端到端（拉取按钮 → 任务队列 → 信息流 → 检索 → 链接导入）。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');
const { createMockCloud } = require('./mock-cloud');
const { L, settings, aliasMap, buildMembers } = require('./helpers');
const F = L('feed');
const { MemberIndex, Disambiguator } = L('disambiguate');

const ARTICLE = {
  title: '第十三届全国社会媒体处理大会成功举办！', url: 'https://mp.weixin.qq.com/s?__biz=SMP&mid=1&idx=1&sn=abc&chksm=x',
  site_name: '社媒派SMP', date: '2026-11-08T08:00:00+08:00', authority: 3, rerank_score: 2,
  content: '编者按：第十三届全国社会媒体处理大会（CIPS-SMP 2025）在湖北武汉召开。哈尔滨工业大学刘挺教授在大会上作《认知安全：策略与技术》主旨报告。',
};

test('信息流：自有公众号识别、查询计划与估算、文档构造', async () => {
  assert.ok(F.isOwnAccount({ url: ARTICLE.url, site: '社媒派SMP', title: ARTICLE.title, content: '' }, ['社媒派SMP']));
  assert.ok(F.isOwnAccount({ url: 'https://ir.hit.edu.cn/x', site: '哈工大SCIR', title: 't', content: '声明：本文转载自社媒派SMP公众号' }, ['社媒派SMP']));
  assert.ok(!F.isOwnAccount({ url: 'https://www.sohu.com/a/1', site: '搜狐', title: 't', content: '某某' }, ['社媒派SMP']));
  const ms = buildMembers('主任\n甲一 清华大学\n委员\n乙二 北京大学\n');
  const win = F.feedWindow(7, '2026-11-10');
  assert.deepEqual([win.start, win.end], ['2026-11-03', '2026-11-10']);
  const org = F.planFeedQueries(settings, ms, aliasMap, 'org', win);
  assert.ok(org.some((q) => q.query.startsWith('社媒派SMP site:mp.weixin.qq.com')) && org.every((q) => q.kind === 'org'));
  assert.ok(org.every((q) => q.query.includes('after:') && q.query.length <= 128));
  assert.equal(F.planFeedQueries(settings, ms, aliasMap, 'core', win).filter((q) => q.kind === 'member').length, 1);
  assert.equal(F.planFeedQueries(settings, ms, aliasMap, 'all', win).filter((q) => q.kind === 'member').length, 2);
  assert.deepEqual(F.estimate(400), { queries: 400, usd: 0.3 });
  // 自有账号文章即使不含学术信号也保留；普通无委员报道丢弃
  const dis = new Disambiguator(settings, new MemberIndex(buildMembers('指导委员会副主任\n刘　挺 哈尔滨工业大学\n'), aliasMap));
  const out = await F.toFeedItems([ { ...ARTICLE, site: ARTICLE.site_name, published: ARTICLE.date },
    { title: '某公司发布新品', url: 'https://www.sohu.com/a/9', site: '搜狐', content: '新品上市促销', published: '2026-11-08' } ],
  { settings, window: F.feedWindow(7, '2026-11-10'), disambiguator: dis });
  assert.equal(out.items.length, 1);
  const d = out.items[0];
  assert.equal(d.fromSmpAccount, true);
  assert.deepEqual(d.memberNames, ['刘挺']);
  assert.equal(d._id, F.feedId('https://mp.weixin.qq.com/s?__biz=SMP&mid=1&idx=1&sn=abc'), '追踪参数不影响合并键');
  const wx = F.wechatArticlesToFeed({ item: [{ update_time: 1762560000, content: { news_item: [{ title: '公众号文章', url: 'https://mp.weixin.qq.com/s/xyz', digest: '摘要' }] } }] });
  assert.equal(wx[0].fromSmpAccount, true);
  assert.equal(wx[0].source, 'wechat_mp');
});

test('信息流端到端：拉取按钮、检索、权限、链接导入', async () => {
  const mock = createMockCloud();
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (req, ...rest) { return req === 'wx-server-sdk' ? 'wx-server-sdk' : origResolve.call(this, req, ...rest); };
  require.cache['wx-server-sdk'] = { id: 'wx-server-sdk', filename: 'wx-server-sdk', loaded: true, exports: mock };
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  const { DeepSeek } = L('deepseek');
  const today = L('text').todayCN();
  DeepSeek.prototype.post = async function (p, body) {
    if (p.includes('/v1/tools/search')) {
      if (body.query.includes('社媒派SMP')) return { results: [{ ...ARTICLE, date: `${today}T08:00:00+08:00` }] };
      return { results: [] };
    }
    if (p.includes('/v1/tools/fetch')) {
      return { title: '社媒派SMP｜专委会学术沙龙回顾', content: `${today}\n社媒派SMP\n清华大学唐杰教授在专委会学术沙龙作报告。` };
    }
    return { choices: [{ message: { content: '{}' } }] };
  };
  const fn = require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'index.js'));
  const call = async (action, data = {}) => { const r = await fn.main({ action, ...data }); if (!r.ok) throw new Error(`${action}: ${r.error}`); return r.data; };

  mock.state.openid = 'o_admin';
  await call('auth.bootstrap', { name: '秘书处' });
  await call('settings.update', { patch: { deepseek: { qps: 1000 } } });
  await call('admin.add', { openid: 'o_editor', name: '编辑', role: 'editor' });

  // 编辑可拉取专委会范围；全体委员需管理员
  mock.state.openid = 'o_editor';
  assert.equal((await fn.main({ action: 'feed.refresh', scope: 'all' })).ok, false);
  const job = await call('feed.refresh', { scope: 'org', days: 7 });
  assert.equal(job.tasks, settings.collect.org_queries.length + settings.feed.account_queries.length);
  assert.equal((await call('feed.refresh', { scope: 'org' })).existed, true, '同一时间只运行一个拉取任务');
  for (let i = 0; i < 5; i++) { const r = await call('feed.pump'); if (r.idle) break; }
  const st = await call('feed.status');
  assert.equal(st.jobs[0].status, 'done');
  assert.equal(st.own, 1);

  // 信息流：同一篇文章被多个查询命中只保留一条；可按委员姓名检索
  const all = await call('feed.list', {});
  assert.equal(all.total, 1);
  assert.equal(all.list[0].fromSmpAccount, true);
  assert.deepEqual(all.list[0].memberNames, ['刘挺']);
  assert.equal((await call('feed.list', { q: '刘挺' })).total, 1);
  assert.equal((await call('feed.list', { q: '不存在的关键词' })).total, 0);
  assert.equal((await call('feed.list', { filter: 'member' })).total, 1);

  // 手工导入社媒派SMP 文章链接
  const imp = await call('feed.import', { urls: '请导入 https://mp.weixin.qq.com/s/abcdef 这篇' });
  assert.equal(imp.results[0].ok, true);
  assert.deepEqual(imp.results[0].members, ['唐杰']);
  assert.equal((await call('feed.list', { q: '唐杰' })).list[0].fromSmpAccount, true);

  // 公众号接口未配置时给出明确提示（仅管理员）
  mock.state.openid = 'o_admin';
  const wx = await fn.main({ action: 'feed.pullWechat' });
  assert.match(wx.error, /WX_MP_APPID/);
  const big = await call('feed.refresh', { scope: 'all', days: 7 });
  assert.ok(big.tasks > 400 && big.estimate.usd >= 0.3);
});
