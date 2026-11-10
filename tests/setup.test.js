'use strict';
/** 一键初始化：全新云环境（集合都不存在）→ 自动建表 → 初始化配置与名单；以及权限与幂等性。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');
const { createMockCloud } = require('./mock-cloud');

const mock = createMockCloud({ strict: true });
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'wx-server-sdk' ? 'wx-server-sdk' : origResolve.call(this, req, ...rest); };
require.cache['wx-server-sdk'] = { id: 'wx-server-sdk', filename: 'wx-server-sdk', loaded: true, exports: mock };
const fn = require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'index.js'));
const { COLLECTIONS } = require(path.join(__dirname, '..', 'cloudfunctions', 'smp', 'service', 'store.js'));

test('全新环境：首次调用自动建表；admin.setupDb 一键完成建表、配置与名单导入', async () => {
  // 定时触发器先于初始化运行时不报错，并顺带建表
  const timer = await fn.main({ Type: 'Timer' });
  assert.equal(timer.ok, true);
  assert.deepEqual(Object.keys(mock.db.data).sort(), [...COLLECTIONS].sort());

  // 云开发控制台“云端测试”（无 OPENID）在尚无管理员时可执行 setupDb
  mock.state.openid = '';
  const r = await fn.main({ action: 'admin.setupDb' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.collections.existed.length, COLLECTIONS.length);
  assert.equal(r.data.roster.total, 401);
  assert.equal(mock.db.data.members.length, 401);
  assert.ok(mock.db.data.config.find((d) => d._id === 'settings'));

  // 幂等：再次执行不重复导入
  const r2 = await fn.main({ action: 'admin.setupDb' });
  assert.equal(r2.ok, true);
  assert.equal(r2.data.roster, undefined);
  assert.equal(mock.db.data.members.length, 401);

  // 有管理员之后，非管理员不能再执行
  mock.state.openid = 'o_admin';
  assert.equal((await fn.main({ action: 'auth.bootstrap', name: '秘书处' })).ok, true);
  mock.state.openid = 'o_other';
  assert.equal((await fn.main({ action: 'admin.setupDb' })).code, 403);
  mock.state.openid = 'o_admin';
  assert.equal((await fn.main({ action: 'admin.setupDb' })).ok, true);
});
