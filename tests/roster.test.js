'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { L } = require('./helpers');
const { parseRoster, parseRosterText, syncRoster, homonymMap } = L('roster');
const { englishNames, initialOf } = L('profiles');

const REAL = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'data', 'roster-2026-11-10.txt'), 'utf8');

test('解析官网名单：401 人、三组重名', () => {
  const es = parseRoster(REAL);
  assert.equal(es.length, 401);
  assert.deepEqual([es[0].name, es[0].roles], ['李生', ['指导委员会主任']]);
  const { members } = syncRoster([], es, '2026-11-10');
  assert.deepEqual(Object.keys(homonymMap(members)).sort(), ['刘洋', '李倩', '王博'].sort());
  assert.equal(members[0]._id, 'M0001');
});

test('名单变更：新增/离任/身份/单位/恢复，ID 稳定', () => {
  const v1 = '主任\n甲一 清华大学\n委员\n乙二 北京大学\n丙三 复旦大学\n丁四 浙江大学\n';
  const v2 = '主任\n甲一 清华大学\n常务委员\n乙二 北京大学\n委员\n丙三 南京大学\n戊五 武汉大学\n';
  const s1 = syncRoster([], parseRosterText(v1), '2026-01-01');
  const ids = Object.fromEntries(s1.members.map((m) => [m.name, m._id]));
  const s2 = syncRoster(s1.members, parseRosterText(v2), '2026-06-01');
  assert.deepEqual(s2.summary, { added: 1, removed: 1, reactivated: 0, roleChanged: 1, orgChanged: 1, unchanged: 1 });
  const bing = s2.members.find((m) => m.name === '丙三');
  assert.equal(bing._id, ids['丙三']);
  assert.deepEqual(bing.orgHistory.map((h) => h.org), ['复旦大学', '南京大学']);
  assert.equal(s2.members.find((m) => m.name === '丁四').status, 'inactive');
  assert.equal(s2.upserts.length, 4);
  const s3 = syncRoster(s2.members, parseRosterText(`${v2}丁四 浙江大学\n`), '2026-09-01');
  assert.equal(s3.summary.reactivated, 1);
  assert.equal(s3.members.find((m) => m.name === '丁四')._id, ids['丁四']);
});

test('CSV 名单', () => {
  const es = parseRoster('name,org,roles\n甲一,清华大学,主任;常务委员\n');
  assert.deepEqual(es[0].roles, ['主任', '常务委员']);
});

test('拼音英文名与首字母（含复姓、多音姓）', () => {
  assert.deepEqual(englishNames('唐杰'), ['Jie Tang', 'Tang Jie']);
  assert.deepEqual(englishNames('欧阳文涛'), ['Wentao Ouyang', 'Ouyang Wentao']);
  assert.equal(initialOf('单伟'), 'S');
  assert.deepEqual(englishNames('吐尔地·托合提'), []);
});
