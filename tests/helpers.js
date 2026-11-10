'use strict';
const path = require('path');
const L = (m) => require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'lib', m));
const settings = JSON.parse(JSON.stringify(require('../cloudfunctions/smp/data/default_settings.json')));
const aliasMap = require('../cloudfunctions/smp/data/org_aliases.json');
settings.disambiguation.use_llm_for_ambiguous = false;

const { parseRosterText, syncRoster, homonymMap } = L('roster');
const { emptyProfile, buildAuto, initialOf } = L('profiles');

/** 由名单文本构造 members 文档（含画像与自动字段）。 */
function buildMembers(text, effective = '2026-01-01') {
  const { members } = syncRoster([], parseRosterText(text), effective);
  const hom = homonymMap(members);
  return members.map((m) => ({ ...m, initial: initialOf(m.name), profile: emptyProfile(),
    auto: buildAuto(m, aliasMap, hom, settings.disambiguation.common_surnames) }));
}

module.exports = { L, settings, aliasMap, buildMembers };
