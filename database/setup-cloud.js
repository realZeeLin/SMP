/**
 * 本地一键配置云数据库（可选；云函数 admin.setupDb 已能自动建表，本脚本额外完成“权限 + 索引”）：
 *   1) 创建 16 个集合（已存在则跳过）
 *   2) 权限设为“仅管理端可读写”（ADMINONLY，等价于安全规则 {read:false, write:false}）
 *   3) 按 indexes.json 创建索引（已存在则跳过）
 *
 * 用法（密钥只从环境变量读取，不要写进文件）：
 *   cd database && npm install
 *   SMP_ENV_ID=<云开发环境ID> TENCENTCLOUD_SECRETID=<SecretId> TENCENTCLOUD_SECRETKEY=<SecretKey> node setup-cloud.js
 *   加 --dry-run 只打印将要执行的操作。
 * SecretId/SecretKey 在腾讯云“访问管理 → API 密钥”创建，需对该云开发环境有管理权限。
 */
const path = require('path');
const indexes = require('./indexes.json');

const COLLECTIONS = ['admins', 'members', 'roster_versions', 'roster_changes', 'issues', 'tasks', 'raw_batches', 'items',
  'filtered', 'events', 'overrides', 'archive', 'cache', 'config', 'feed', 'feed_jobs'];
const dry = process.argv.includes('--dry-run');

function toCreateIndex(spec) {
  return {
    IndexName: spec.name,
    MgoKeySchema: {
      MgoIsUnique: Boolean(spec.unique),
      MgoIndexKeys: Object.entries(spec.keys).map(([Name, dir]) => ({ Name, Direction: String(dir) })),
    },
  };
}

async function main() {
  const { SMP_ENV_ID: envId, TENCENTCLOUD_SECRETID: secretId, TENCENTCLOUD_SECRETKEY: secretKey } = process.env;
  if (dry) {
    COLLECTIONS.forEach((c) => console.log(`[dry-run] 集合 ${c}：创建（若不存在）+ 权限 ADMINONLY`));
    for (const [c, list] of Object.entries(indexes)) if (Array.isArray(list)) list.forEach((s) => console.log(`[dry-run] 索引 ${c}.${s.name}`, JSON.stringify(toCreateIndex(s).MgoKeySchema)));
    return;
  }
  if (!envId || !secretId || !secretKey) {
    console.error('请设置环境变量 SMP_ENV_ID、TENCENTCLOUD_SECRETID、TENCENTCLOUD_SECRETKEY（或加 --dry-run 预览）');
    process.exit(1);
  }
  let CloudBase;
  try { CloudBase = require('@cloudbase/manager-node'); } catch (e) {
    console.error('缺少依赖，请先在 database/ 目录执行 npm install'); process.exit(1);
  }
  const app = new (CloudBase.default || CloudBase)({ secretId, secretKey, envId });
  const { database, permission } = app;
  const report = { collections: [], permissions: [], indexes: [] };

  for (const c of COLLECTIONS) {
    const r = await database.createCollectionIfNotExists(c);
    report.collections.push(`${c}: ${r.IsCreated ? '已创建' : '已存在'}`);
    try {
      await permission.modifyResourcePermission({ resourceType: 'collection', resource: c, permission: 'ADMINONLY' });
      report.permissions.push(`${c}: 仅管理端可读写`);
    } catch (e) {
      report.permissions.push(`${c}: 设置失败（${e.message}），请在控制台手动设置为“仅管理端可读写”或自定义规则 {"read":false,"write":false}`);
    }
  }
  for (const [c, list] of Object.entries(indexes)) {
    if (!Array.isArray(list)) continue;
    for (const spec of list) {
      const { Exists } = await database.checkIndexExists(c, spec.name);
      if (Exists) { report.indexes.push(`${c}.${spec.name}: 已存在`); continue; }
      await database.updateCollection(c, { CreateIndexes: [toCreateIndex(spec)] });
      report.indexes.push(`${c}.${spec.name}: 已创建`);
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error('执行失败：', e.message || e); process.exit(1); });
module.exports = { toCreateIndex, COLLECTIONS };
