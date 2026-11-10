/**
 * 生成云开发控制台可直接导入的 JSON Lines 种子数据（备选方式，与云函数初始化写入的结构一致）：
 *   seed/members.json   401 位委员（名单 + 空画像 + 自动字段）
 *   seed/config.json    系统配置（settings、org_aliases）
 * 用法：node database/build-seed.js（需先在 cloudfunctions/smp 下 npm install 以生成拼音字段）
 * 导入：云开发控制台 → 数据库 → 选择集合 → 导入 → 选择文件，冲突处理选 Upsert。
 */
const fs = require('fs');
const path = require('path');
const fnDir = path.join(__dirname, '..', 'cloudfunctions', 'smp');
const { parseRoster, syncRoster, homonymMap, roleRank } = require(path.join(fnDir, 'lib', 'roster'));
const { emptyProfile, buildAuto, initialOf, completeness } = require(path.join(fnDir, 'lib', 'profiles'));
const settings = require(path.join(fnDir, 'data', 'default_settings.json'));
const aliases = require(path.join(fnDir, 'data', 'org_aliases.json'));

const effective = '2026-11-10';
const text = fs.readFileSync(path.join(fnDir, 'data', `roster-${effective}.txt`), 'utf8');
const { members } = syncRoster([], parseRoster(text), effective);
const hom = homonymMap(members);
const out = path.join(__dirname, 'seed');
fs.mkdirSync(out, { recursive: true });
const lines = members.map((m) => JSON.stringify({ ...m, roleRank: roleRank(m.roles), initial: initialOf(m.name), profile: emptyProfile(),
  completeness: completeness(emptyProfile()), auto: buildAuto(m, aliases, hom, settings.disambiguation.common_surnames),
  stats: { eventCount: 0, lastEventAt: null, lastIssue: null } }));
fs.writeFileSync(path.join(out, 'members.json'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'config.json'), [JSON.stringify({ _id: 'settings', value: {} }), JSON.stringify({ _id: 'org_aliases', map: aliases })].join('\n') + '\n');
console.log(`seed/members.json ${lines.length} 条；seed/config.json 2 条`);
