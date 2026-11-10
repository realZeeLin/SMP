'use strict';
/** 数据库访问层：分页读取、批量写入、配置合并、DeepSeek 缓存存储。 */
const defaults = require('../data/default_settings.json');
const defaultAliases = require('../data/org_aliases.json');

const PAGE = 100;

/** 数据库设计中的全部集合（见 database/schema.md）。 */
const COLLECTIONS = ['admins', 'members', 'roster_versions', 'roster_changes', 'issues', 'tasks', 'raw_batches', 'items',
  'filtered', 'events', 'overrides', 'archive', 'cache', 'config', 'feed', 'feed_jobs'];
const COLLECTION_NOT_EXIST = -502005;
const isMissingCollection = (e) => Boolean(e) && (e.errCode === COLLECTION_NOT_EXIST || /-502005|collection not exist/i.test(String(e.message || e)));

function createStore(cloud) {
  const db = cloud.database();
  const _ = db.command;
  const col = (name) => db.collection(name);

  async function getAll(query, fields) {
    const out = [];
    let q = fields ? query.field(fields) : query;
    for (let skip = 0; ; skip += PAGE) {
      const { data } = await q.skip(skip).limit(PAGE).get();
      out.push(...data);
      if (data.length < PAGE) break;
    }
    return out;
  }

  async function addMany(name, docs, chunk = 20) {
    for (let i = 0; i < docs.length; i += chunk) {
      await Promise.all(docs.slice(i, i + chunk).map((d) => col(name).add({ data: d })));
    }
  }

  async function setMany(name, docs, chunk = 20) {
    for (let i = 0; i < docs.length; i += chunk) {
      await Promise.all(docs.slice(i, i + chunk).map(({ _id, ...rest }) => col(name).doc(_id).set({ data: rest })));
    }
  }

  async function removeWhere(name, where) {
    // 服务端 where().remove() 每次最多删除一批，循环直至删除干净
    for (let i = 0; i < 50; i++) {
      const r = await col(name).where(where).remove();
      if (!r.stats || !r.stats.removed) break;
    }
  }

  async function getDoc(name, id) {
    const { data } = await col(name).where({ _id: id }).limit(1).get();
    return data[0] || null;
  }

  const deepMerge = (a, b) => {
    if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
    const out = { ...(a || {}) };
    for (const [k, v] of Object.entries(b)) out[k] = (typeof v === 'object' && v && !Array.isArray(v)) ? deepMerge(out[k], v) : v;
    return out;
  };

  async function settings() {
    const doc = await getDoc('config', 'settings');
    return deepMerge(defaults, (doc && doc.value) || {});
  }

  async function aliasMap() {
    const doc = await getDoc('config', 'org_aliases');
    return (doc && doc.map) || defaultAliases;
  }

  /** DeepSeek 响应缓存（cache 集合）。 */
  const TTL_DAYS = { search: 30, fetch: 30, chat: 90 };
  const cacheStore = {
    async get(ns, key) {
      const doc = await getDoc('cache', key);
      if (!doc) return null;
      if (doc.expireAt && new Date(doc.expireAt) < new Date()) return null;
      return doc.value;
    },
    async set(ns, key, value) {
      const expireAt = new Date(Date.now() + (TTL_DAYS[ns] || 30) * 86400e3);
      await col('cache').doc(key).set({ data: { ns, value, createdAt: db.serverDate(), expireAt } });
    },
  };

  /** 一键建表：逐个创建集合；已存在则跳过（创建失败时用 count() 确认是否已存在）。幂等，可重复执行。 */
  async function ensureCollections() {
    const result = { created: [], existed: [], failed: [] };
    for (const name of COLLECTIONS) {
      try {
        await db.createCollection(name);
        result.created.push(name);
      } catch (e) {
        try { await col(name).count(); result.existed.push(name); } catch (e2) { result.failed.push({ name, error: String(e.message || e) }); }
      }
    }
    return result;
  }

  return { db, _, col, getAll, addMany, setMany, removeWhere, getDoc, settings, aliasMap, cacheStore, deepMerge, ensureCollections };
}

module.exports = { createStore, COLLECTIONS, isMissingCollection };
