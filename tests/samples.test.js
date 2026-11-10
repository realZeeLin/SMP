'use strict';
/** 样式示例数据：来源真实、委员与名单一致、无同名误收、成稿结构完整。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const samples = require('../miniprogram/data/samples.js');
const { parseRoster } = require('../cloudfunctions/smp/lib/roster');

const roster = parseRoster(fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'data', 'roster-2026-11-10.txt'), 'utf8'));

test('周报/月报示例', () => {
  for (const [kind, s] of Object.entries(samples)) {
    assert.equal(s.kind, kind);
    const events = s.sections.flatMap((x) => x.events);
    assert.equal(events.length, s.count);
    assert.deepEqual(events.map((e) => e.rank), events.map((_, i) => i + 1));
    for (const e of events) {
      assert.match(e.url, /^https:\/\/ir\.hit\.edu\.cn\//);
      for (const m of e.members) {
        assert.ok(roster.some((r) => r.name === m.name && r.org === m.org), `${m.name}（${m.org}）应在名单中`);
        assert.ok(e.headline.includes(m.name) || e.blurb.includes(m.name), `${e.headline} 应提及 ${m.name}`);
      }
      for (const bad of ['王震', '王硕', '刘洋', '付国宏']) assert.ok(!e.members.some((m) => m.name === bad), `${bad} 为同名/待复核，不应收录`);
    }
    assert.ok(s.html.includes('<section') && !s.html.includes('class='));
    assert.ok(s.markdown.startsWith('# '));
  }
  assert.ok(samples.monthly.count >= 30 && samples.monthly.count <= 50, '月报示例条数在 30~50');
  assert.ok(samples.weekly.count < samples.monthly.count);
});
