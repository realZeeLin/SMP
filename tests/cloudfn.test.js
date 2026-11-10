'use strict';
/**
 * 云函数端到端测试（内存模拟云数据库 + 模拟 DeepSeek 接口）：
 * 管理员初始化 → 导入官网名单（401 人）→ 名单变更 → 创建周报 → 队列采集 → 分析 → 成稿 → 复核 → 重新编排 → 发布 → 画像时间线。
 * 资讯内容均为测试用虚构文本，人物为虚构名单。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');
const { createMockCloud } = require('./mock-cloud');

const mock = createMockCloud();
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'wx-server-sdk' ? 'wx-server-sdk' : origResolve.call(this, req, ...rest); };
require.cache['wx-server-sdk'] = { id: 'wx-server-sdk', filename: 'wx-server-sdk', loaded: true, exports: mock };

process.env.DEEPSEEK_API_KEY = 'sk-test';
const { DeepSeek } = require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'lib', 'deepseek'));
const calls = { search: 0, chat: 0 };

const FICTIONAL = `主任\n甄学文 清华大学\n副主任\n林知远 浙江大学\n常务委员\n林知远 复旦大学\n苏墨言 武汉大学\n委员\n${
  ['方以宁 大连理工大学', '程思远 北京师范大学', '温如初 西安交通大学', '陆鸣谦 东南大学', '韩照临 中山大学', '孟书禾 苏州大学',
    '许砚秋 北京邮电大学', '邵听澜 厦门大学', '秦望舒 吉林大学', '唐逸尘 南开大学', '裴语冰 华南理工大学'].join('\n')}\n`;

DeepSeek.prototype.post = async function (p, body) {
  if (p.includes('/v1/tools/search')) {
    calls.search++;
    const q = body.query;
    if (q.includes('社会媒体处理')) {
      return { results: [{ title: 'SMP 2026 全国社会媒体处理大会召开', url: 'https://www.cipsc.org.cn/n/2026/1104/1.htm', publish_time: '2026-11-04',
        content: '由中国中文信息学会社会媒体处理专委会主办的全国社会媒体处理大会召开，甄学文教授出席并致辞。' }] };
    }
    const [name, org] = q.split(' ');
    const h = require('crypto').createHash('sha1').update(name + org).digest('hex').slice(0, 12);
    return { data: { results: [
      { title: `${org}${name}教授当选IEEE Fellow-${org}新闻网`, url: `https://news.example.edu.cn/${h}/1.htm`, publish_time: '2026-11-03',
        content: `近日，${org}${name}教授当选IEEE Fellow，表彰其在自然语言处理领域的学术贡献。` },
      { title: `${name}当选IEEE Fellow`, url: `https://www.sohu.com/a/${h}`, publish_time: '2026-11-04',
        content: `据报道，${org}${name}教授当选IEEE Fellow，表彰其学术贡献。` },
      { title: `${name}教授应邀作主旨报告`, url: `https://conf.example.org/${h}`, publish_time: '2026-11-06',
        content: `${org}${name}教授应邀在学术会议作主旨报告，介绍大语言模型研究进展。` },
      { title: `演员${name}新剧开机`, url: `https://ent.example.com/${h}`, publish_time: '2026-11-05', content: `演员${name}主演的新剧开机，导演表示……` },
    ] } };
  }
  if (p.includes('/chat/completions')) {
    calls.chat++;
    const user = body.messages[1].content;
    if (user.startsWith('请改写')) {
      const items = JSON.parse(user.slice('请改写以下条目：'.length));
      return { choices: [{ message: { content: JSON.stringify({ items: items.map((x, i) => ({ id: x.id,
        headline: i === 0 ? `${x.members[0] || ''}获2099年大奖` : `${x.members[0] || ''}${x.title.replace(/^.*?(当选|应邀)/, '$1')}`.slice(0, 30),
        summary: x.text.slice(0, 60) })) }) } }] };
    }
    return { choices: [{ message: { content: JSON.stringify({ note: '本期汇集委员学术荣誉与学术活动等动态。' }) } }] };
  }
  throw new Error(`unexpected ${p}`);
};

const fn = require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'index.js'));
const call = async (action, data = {}) => {
  const r = await fn.main({ action, ...data });
  if (!r.ok) throw new Error(`${action}: ${r.error}`);
  return r.data;
};

test('云函数端到端', async () => {
  // 权限：未授权用户被拒绝；首位用户可成为管理员并完成初始化
  mock.state.openid = 'o_stranger';
  assert.equal((await fn.main({ action: 'dashboard' })).code, 403);
  mock.state.openid = 'o_admin';
  const boot = await call('auth.bootstrap', { name: '秘书处' });
  assert.equal(boot.roster.total, 401);
  assert.equal((await call('member.list', { q: '王博' })).total, 2);
  mock.state.openid = 'o_other';
  assert.equal((await fn.main({ action: 'auth.bootstrap' })).ok, false);
  mock.state.openid = 'o_admin';

  // 名单变更：换成虚构名单（401 人离任，15 人新增），预览不落库
  const pv = await call('roster.preview', { text: FICTIONAL, effective: '2026-11-09' });
  assert.equal(pv.summary.added, 15);
  assert.equal((await call('member.list', {})).total, 401);
  const ap = await call('roster.apply', { text: FICTIONAL, effective: '2026-11-09', source: 'test' });
  assert.deepEqual([ap.summary.added, ap.summary.removed], [15, 401]);
  const ml = await call('member.list', {});
  assert.equal(ml.total, 15);
  assert.equal(ml.list[0].name, '甄学文');

  await call('settings.update', { patch: { deepseek: { qps: 1000 } } });

  // 创建周报 → 推进采集直至完成（完成后自动分析+成稿）
  const st = await call('issue.start', { kind: 'weekly', ref: '2026-11-10' });
  assert.equal(st.issueId, 'weekly-2026-W45');
  assert.ok(st.tasks > 13);
  let issue;
  for (let i = 0; i < 20; i++) {
    await call('issue.pump', { id: st.issueId });
    ({ issue } = await call('issue.get', { id: st.issueId }));
    if (issue.status !== 'collecting') break;
  }
  assert.equal(issue.status, 'reviewing');
  assert.equal(issue.progress.done, st.tasks);
  assert.ok(issue.stats.filtered['同名者/人物不符'] > 0, '演员同名条目应被过滤');

  const { events } = await call('issue.get', { id: st.issueId });
  assert.ok(events.length >= 20, `入选 ${events.length}`);
  assert.equal(events[0].category, 'org');
  const fellows = events.filter((e) => e.category === 'honor');
  assert.equal(fellows.length, 15, '每位委员的 Fellow 报道（两家）应合并为一条');
  // 林知远两位同名委员：各自归属正确
  const lin = events.filter((e) => e.memberNames.includes('林知远') && e.category === 'honor');
  assert.equal(new Set(lin.map((e) => e.memberIds[0])).size, 2);
  // 事实校验：首条改写引入“2099”应被拒绝并回退
  assert.ok(!events.some((e) => e.headline.includes('2099')));
  assert.ok(issue.html.includes('<section') && !issue.html.includes('class='));
  assert.ok(issue.markdown.includes('编者按'));

  // 复核：剔除一条、标记认错人 → 重新编排
  const target = events.find((e) => e.category === 'activity');
  await call('event.decide', { id: target._id, decision: 'drop' });
  const wrong = events.find((e) => e.category === 'honor' && e.memberNames[0] === '苏墨言');
  await call('event.decide', { id: wrong._id, decision: 'wrong_person' });
  await call('event.edit', { id: events[1]._id, headline: '编辑修改后的标题' });
  assert.equal((await call('issue.get', { id: st.issueId })).issue.dirty, true);
  await call('issue.analyze', { id: st.issueId });
  const after = await call('issue.get', { id: st.issueId });
  assert.ok(!after.events.some((e) => e.eventId === target.eventId));
  assert.ok(!after.events.some((e) => e.memberNames.includes('苏墨言') && e.category === 'honor'));
  assert.ok(after.events.some((e) => e.headline === '编辑修改后的标题'), '手工修改的标题应保留');
  assert.equal(after.issue.dirty, false);

  const tabs = await call('event.list', { issueId: st.issueId, tab: 'filtered' });
  assert.ok(tabs.list.length > 0);

  // 导出与发布
  const ex = await call('issue.export', { id: st.issueId });
  assert.ok(ex.url.startsWith('https://') && mock.state.files['exports/weekly-2026-W45.html'].includes('<!DOCTYPE html>'));
  await call('issue.publish', { id: st.issueId });
  const zhen = (await call('member.list', { q: '甄学文' })).list[0];
  const mg = await call('member.get', { id: zhen._id });
  assert.ok(mg.timeline.length >= 1);
  assert.ok(mg.member.stats.eventCount >= 1);
  assert.equal(mg.changes[0].type, 'added');

  // 画像编辑
  const up = await call('member.update', { id: zhen._id, profile: { title: '教授', researchAreas: ['自然语言处理'], keywords: ['知识工程实验室'] } });
  assert.ok(up.completeness > 0.5);

  // 重跑同一期：缓存命中，不重复调用搜索
  const before = calls.search;
  await call('issue.start', { kind: 'weekly', ref: '2026-11-10', force: true });
  for (let i = 0; i < 20; i++) { const r = await call('issue.pump', { id: st.issueId }); if (!r.processed) break; }
  assert.equal(calls.search, before);

  const dash = await call('dashboard');
  assert.equal(dash.memberCount, 15);
  assert.equal(dash.weekly._id, 'weekly-2026-W45');

  // 定时触发器入口
  const timer = await fn.main({ Type: 'Timer', TriggerName: 'smp-every-minute' });
  assert.equal(timer.ok, true);
});
