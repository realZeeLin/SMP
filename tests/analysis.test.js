'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { L, settings, aliasMap, buildMembers } = require('./helpers');
const T = L('text');
const { MemberIndex, Disambiguator } = L('disambiguate');
const { academicCheck, classify, detectLevel } = L('classify');
const { resolvePeriod, planQueries } = L('collect');
const { select } = L('rank');
const { factGuard } = L('compose');
const { processBatch, finalize } = L('analyze');

const ROSTER = '委员\n王　博 哈尔滨工业大学\n王　博 天津大学\n张伟男 哈尔滨工业大学\n李　斌 武汉大学\n李斌阳 国际关系学院\n苏墨言 武汉大学\n';

function run(members, title, text = '', overrides = []) {
  const d = new Disambiguator(settings, new MemberIndex(members, aliasMap), overrides);
  return d.run({ title, text, url: 'https://a.edu.cn/1', canonicalUrl: 'https://a.edu.cn/1', domain: 'a.edu.cn', queryMemberIds: [] });
}
const key = (members, ms) => Object.fromEntries(ms.map((m) => [`${m.name}@${members.find((x) => x._id === m.memberId).org}`, m]));

test('文本工具', () => {
  assert.equal(T.canonicalUrl('http://www.a.edu.cn/x/?utm_source=wx&id=3'), 'https://a.edu.cn/x?id=3');
  assert.equal(T.parseDate('2026年11月3日 10:00'), '2026-11-03');
  assert.equal(T.parseDate('2026-02-30'), null);
  assert.equal(T.stripSiteSuffix('张三教授当选会士-某某大学新闻网'), '张三教授当选会士');
  assert.equal(T.cleanText('你好，ＡＢＣ１２'), '你好，ABC12');
});

test('统计周期', () => {
  assert.deepEqual(resolvePeriod('weekly', '2026-11-10'), { kind: 'weekly', start: '2026-11-02', end: '2026-11-08', label: '2026-W45', id: 'weekly-2026-W45' });
  const m = resolvePeriod('monthly', '2026-11-10');
  assert.deepEqual([m.start, m.end, m.id], ['2026-10-01', '2026-10-31', 'monthly-2026-10']);
  assert.equal(resolvePeriod('weekly', '2027-01-04').label, '2026-W53');
});

test('查询计划分层', () => {
  const ms = buildMembers('主任\n甲一 清华大学\n委员\n乙二 北京大学\n');
  const qs = planQueries(settings, ms, aliasMap, resolvePeriod('weekly', '2026-11-10'));
  assert.equal(qs.filter((q) => q.memberId === ms[0]._id).length, 2);
  assert.equal(qs.filter((q) => q.memberId === ms[1]._id).length, 1);
  assert.ok(qs.some((q) => q.kind === 'org'));
});

test('消歧：重名按单位判定', async () => {
  const ms = buildMembers(ROSTER);
  const r = key(ms, await run(ms, '天津大学王博教授团队论文获最佳论文奖', '天津大学王博教授团队的研究论文获奖。'));
  assert.equal(r['王博@天津大学'].status, 'confirmed');
  assert.equal(r['王博@哈尔滨工业大学'].status, 'rejected');
});

test('消歧：重名无证据 → 待复核', async () => {
  const ms = buildMembers(ROSTER);
  const r = await run(ms, '王博教授作学术报告', '王博教授在论坛作报告。');
  assert.ok(r.every((m) => m.status !== 'confirmed'));
});

test('消歧：边界与长名优先', async () => {
  const ms = buildMembers(ROSTER);
  assert.equal((await run(ms, '哈尔滨工业大学王博士生获奖', '王博士生代表发言')).length, 0);
  assert.deepEqual((await run(ms, '哈尔滨工业大学张伟男教授作报告')).map((m) => m.name), ['张伟男']);
  assert.deepEqual((await run(ms, '国际关系学院李斌阳教授出席学术会议')).map((m) => m.name), ['李斌阳']);
});

test('消歧：同名演员否定、英文名识别、人工覆盖', async () => {
  const ms = buildMembers(ROSTER);
  assert.equal((await run(ms, '演员苏墨言主演新剧开机', '演员苏墨言近日主演的新剧开机。'))[0].status, 'rejected');
  const en = await run(ms, 'Keynote by Prof. Moyan Su, Wuhan University', 'Moyan Su from Wuhan University gave a keynote.');
  assert.equal(en[0].status, 'confirmed');
  const mid = ms.find((m) => m.name === '苏墨言')._id;
  const ov = await run(ms, '武汉大学苏墨言教授获奖', '武汉大学苏墨言教授获奖', [{ type: 'mention', url: 'https://a.edu.cn/1', memberId: mid, decision: 'reject' }]);
  assert.deepEqual([ov[0].status, ov[0].method], ['rejected', 'manual']);
});

test('学术过滤与分类', () => {
  const af = settings.academic_filter;
  assert.ok(academicCheck(af, '张三教授作主旨报告', '张三教授在学术会议作主旨报告')[0]);
  assert.ok(!academicCheck(af, '某校与公司签约仪式', '张三出席签约仪式，双方开展战略合作，关注融资与估值')[0]);
  assert.ok(!academicCheck(af, '2027年招生简章', '张三教授 研究')[0]);
  assert.equal(classify('张三团队论文获ACL最佳论文奖', ''), 'honor');
  assert.equal(classify('张三担任ACL 2027程序委员会主席', ''), 'service');
  assert.equal(classify('张三入选全球前2%顶尖科学家榜单', ''), 'influence');
  assert.equal(classify('张三教授作特邀报告', '学术论坛'), 'activity');
  assert.equal(detectLevel('张三当选IEEE Fellow', '')[0], 1);
});

const ev = (i, score, mids, cat = 'research') => ({ eventId: `e${i}`, title: `t${i}`, url: `https://x/${i}`, category: cat, memberIds: mids,
  score, sources: [{ url: `https://x/${i}` }], isOrgNews: false, previouslyPublished: false });

test('摘选 30~50 条、每人上限、阈值放宽、人工保留', () => {
  const evs = Array.from({ length: 120 }, (_, i) => ev(i, 90 - i * 0.5, [`M${i % 40}`]));
  const { chosen } = select(evs, { min_items: 30, max_items: 50, min_score: 25, per_member_cap: 2 }, { floor_score: 12 });
  assert.ok(chosen.length >= 30 && chosen.length <= 50);
  const cnt = {};
  chosen.forEach((e) => e.memberIds.forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; }));
  assert.ok(Math.max(...Object.values(cnt)) <= 2);
  const few = Array.from({ length: 35 }, (_, i) => ev(i, 20, [`M${i}`]));
  const r = select(few, { min_items: 30, max_items: 50, min_score: 25 }, { floor_score: 12 });
  assert.equal(r.chosen.length, 35);
  const m = [ev(1, 10, ['M1']), ev(2, 90, ['M2']), { ...ev(3, 95, ['M3']), previouslyPublished: true }];
  const r2 = select(m, { min_items: 1, max_items: 5, min_score: 50 }, { floor_score: 40 }, new Map([['e1', 'keep']]));
  assert.deepEqual(r2.chosen.map((e) => e.eventId).sort(), ['e1', 'e2']);
});

test('事实校验', () => {
  const src = '清华大学张三教授当选2026年IEEE Fellow';
  assert.ok(factGuard('张三教授当选IEEE Fellow', src, ['张三'], 120)[0]);
  assert.ok(!factGuard('张三教授当选2027年IEEE Fellow', src, ['张三'], 120)[0]);
  assert.ok(!factGuard('某教授当选IEEE Fellow', src, ['张三'], 120)[0]);
});

test('增量处理 + 汇总：转载合并为一个事件、跨期去重只比同类刊期', async () => {
  const ms = buildMembers('委员\n苏墨言 武汉大学\n');
  const period = resolvePeriod('weekly', '2026-11-10');
  const dis = new Disambiguator(settings, new MemberIndex(ms, aliasMap));
  const res = [
    { title: '武汉大学苏墨言教授当选IEEE Fellow-武汉大学新闻网', url: 'https://news.whu.edu.cn/1', content: '武汉大学苏墨言教授当选IEEE Fellow，表彰其在自然语言处理领域的学术贡献。', published: '2026-11-03' },
    { title: '苏墨言当选IEEE Fellow', url: 'https://www.sohu.com/a/2', content: '据报道，武汉大学苏墨言教授当选IEEE Fellow，表彰其学术贡献。', published: '2026-11-04' },
    { title: '苏墨言教授作学术报告', url: 'https://news.whu.edu.cn/3', content: '武汉大学苏墨言教授在学术论坛作报告。', published: '2026-09-01' },
  ];
  const b = await processBatch(res, { settings, period, disambiguator: dis, queryMemberId: ms[0]._id });
  assert.equal(b.stats.kept, 2);
  assert.equal(b.stats.outOfWindow, 1);
  const weeklyArchive = [{ kind: 'monthly', issueDate: '2026-10-31', urls: ['https://news.whu.edu.cn/1'], memberIds: [], category: 'honor', title: '' }];
  const out = finalize(b.kept, { settings, period, members: ms, archive: weeklyArchive });
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].sources.length, 2);
  assert.equal(out.events[0].category, 'honor');
  assert.equal(out.events[0].previouslyPublished, false);
  assert.ok(out.events[0].selected);
});

test('DeepSeek Search 查询：操作符与 128 字上限', () => {
  const { buildSearchQuery } = L('collect');
  const p = resolvePeriod('weekly', '2026-11-10');
  const q = buildSearchQuery('唐杰 清华大学 学术', p, settings);
  assert.equal(q, '唐杰 清华大学 学术 after:2026-10-29 before:2026-11-09 lang:zh,en');
  assert.ok(buildSearchQuery('长'.repeat(300), p, settings).length <= 128);
  const { mapResult } = L('deepseek');
  const r = mapResult({ title: 't', url: 'u', snippet: 's', summary: 'long', content: '', site_name: 'X', date: '2026-11-03T00:00:00+00:00', authority: 3, rerank_score: 2.1 });
  assert.deepEqual([r.snippet, r.summary, r.site, r.published, r.authority, r.rerankScore], ['s', 'long', 'X', '2026-11-03T00:00:00+00:00', 3, 2.1]);
});
