'use strict';
/** wx-server-sdk 的内存模拟（覆盖本项目用到的数据库与存储 API 子集），用于云函数端到端测试。 */
const crypto = require('crypto');

class Cmd { constructor(op, v) { this.op = op; this.v = v; } and(o) { return new Cmd('and', [this, o]); } }
class Upd { constructor(op, v) { this.op = op; this.v = v; } }
class Re { constructor({ regexp, options }) { this.re = new RegExp(regexp, options); } }

const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let cur = o;
  ks.slice(0, -1).forEach((k) => { if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
}

function matchVal(val, cond) {
  if (cond instanceof Cmd) {
    const { op, v } = cond;
    if (op === 'and') return v.every((c) => matchVal(val, c));
    if (op === 'exists') return v ? val !== undefined : val === undefined;
    if (op === 'in') return Array.isArray(val) ? val.some((x) => v.includes(x)) : v.includes(val);
    if (val === undefined || val === null) return false;
    const cmp = val instanceof Date ? val.getTime() : val; const w = v instanceof Date ? v.getTime() : v;
    return { lt: cmp < w, lte: cmp <= w, gt: cmp > w, gte: cmp >= w }[op];
  }
  if (cond instanceof Re) return Array.isArray(val) ? val.some((x) => cond.re.test(String(x))) : cond.re.test(String(val ?? ''));
  if (Array.isArray(val) && !Array.isArray(cond)) return val.includes(cond);
  return val === cond || (cond === '' && val === undefined);
}

function matches(doc, where) {
  if (!where || !Object.keys(where).length) return true;
  if (where instanceof Cmd) {
    if (where.op === 'and') return where.v.every((w) => matches(doc, w));
    if (where.op === 'or') return where.v.some((w) => matches(doc, w));
  }
  return Object.entries(where).every(([k, c]) => matchVal(getPath(doc, k), c));
}

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(v) ? new Date(v) : v)));

function applyUpdate(doc, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Upd) {
      if (v.op === 'inc') setPath(doc, k, (getPath(doc, k) || 0) + v.v);
      if (v.op === 'set') setPath(doc, k, clone(v.v));
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      for (const [k2, v2] of Object.entries(v)) applyUpdate(doc, { [`${k}.${k2}`]: v2 });
      if (!Object.keys(v).length && getPath(doc, k) === undefined) setPath(doc, k, {});
    } else setPath(doc, k, clone(v));
  }
}

function project(doc, fields) {
  if (!fields) return clone(doc);
  const vals = Object.values(fields);
  if (vals.every((v) => v === false)) {
    const d = clone(doc); Object.keys(fields).forEach((k) => delete d[k]); return d;
  }
  const out = { _id: doc._id };
  Object.entries(fields).forEach(([k, v]) => { if (v) { const x = getPath(doc, k); if (x !== undefined) setPath(out, k, clone(x)); } });
  return out;
}

class Query {
  constructor(db, name, where = {}, opts = {}) { this.db = db; this.name = name; this.w = where; this.o = { order: [], skip: 0, limit: 100, ...opts }; }
  _q(o) { return new Query(this.db, this.name, this.w, { ...this.o, ...o }); }
  where(w) {
    // 与 @cloudbase/database 一致：条件对象的值不能全部为 undefined
    if (!(w instanceof Cmd) && w && typeof w === 'object') {
      const keys = Object.keys(w);
      if (keys.length && !keys.some((k) => w[k] !== undefined)) throw new Error('查询参数对象值不能均为undefined');
    }
    return new Query(this.db, this.name, w, this.o);
  }
  orderBy(f, d) { return this._q({ order: [...this.o.order, [f, d]] }); }
  skip(n) { return this._q({ skip: n }); }
  limit(n) { return this._q({ limit: n }); }
  field(f) { return this._q({ field: f }); }
  _rows() { this.db.check(this.name); return this.db.rows(this.name).filter((d) => matches(d, this.w)); }
  async get() {
    const rows = this._rows();
    for (const [f, d] of [...this.o.order].reverse()) {
      rows.sort((a, b) => { const x = getPath(a, f); const y = getPath(b, f); const s = x === y ? 0 : (x ?? '') < (y ?? '') ? -1 : 1; return d === 'desc' ? -s : s; });
    }
    return { data: rows.slice(this.o.skip, this.o.skip + this.o.limit).map((d) => project(d, this.o.field)) };
  }
  async count() { return { total: this._rows().length }; }
  async update({ data }) { const rows = this._rows(); rows.forEach((d) => applyUpdate(d, data)); return { stats: { updated: rows.length } }; }
  async remove() {
    const all = this.db.rows(this.name); const keep = all.filter((d) => !matches(d, this.w));
    const n = all.length - keep.length; this.db.data[this.name] = keep; return { stats: { removed: n } };
  }
}

class Collection extends Query {
  constructor(db, name) { super(db, name); }
  async add({ data }) { this.db.check(this.name); const _id = crypto.randomBytes(8).toString('hex'); this.db.rows(this.name).push({ _id, ...clone(data) }); return { _id }; }
  doc(id) {
    const db = this.db; const name = this.name;
    const find = () => db.rows(name).find((d) => d._id === id);
    return {
      async get() { const d = find(); if (!d) throw new Error('document not exists'); return { data: clone(d) }; },
      async set({ data }) { db.check(name); const rows = db.rows(name); const i = rows.findIndex((d) => d._id === id); const doc = { _id: id, ...clone(data) }; if (i >= 0) rows[i] = doc; else rows.push(doc); return {}; },
      async update({ data }) { const d = find(); if (!d) throw new Error('document not exists'); applyUpdate(d, data); return { stats: { updated: 1 } }; },
      async remove() { db.data[name] = db.rows(name).filter((d) => d._id !== id); return {}; },
    };
  }
}

/** strict=true 时模拟真实云数据库：集合须先 createCollection，否则报 -502005。 */
function createMockCloud({ strict = false } = {}) {
  const state = { openid: 'o_admin', files: {} };
  const dbObj = {
    data: {},
    check(name) {
      if (strict && !(name in this.data)) throw Object.assign(new Error('database collection not exists'), { errCode: -502005 });
    },
    async createCollection(name) {
      if (name in this.data) throw Object.assign(new Error(`collection ${name} already exists`), { errCode: -501001 });
      this.data[name] = [];
      return { errMsg: 'createCollection:ok' };
    },
    rows(name) { return (this.data[name] = this.data[name] || []); },
    collection(name) { return new Collection(this, name); },
    command: {
      lt: (v) => new Cmd('lt', v), lte: (v) => new Cmd('lte', v), gt: (v) => new Cmd('gt', v), gte: (v) => new Cmd('gte', v),
      in: (v) => new Cmd('in', v), exists: (v) => new Cmd('exists', v), and: (arr) => new Cmd('and', arr), or: (arr) => new Cmd('or', arr),
      inc: (v) => new Upd('inc', v), set: (v) => new Upd('set', v),
    },
    serverDate: () => new Date(),
    RegExp: (o) => new Re(o),
  };
  return {
    state, db: dbObj, DYNAMIC_CURRENT_ENV: 'mock',
    init() {}, database: () => dbObj,
    getWXContext: () => ({ OPENID: state.openid }),
    async uploadFile({ cloudPath, fileContent }) { state.files[cloudPath] = fileContent.toString(); return { fileID: `cloud://mock/${cloudPath}` }; },
    async getTempFileURL({ fileList }) { return { fileList: fileList.map((f) => ({ fileID: f, tempFileURL: f.replace('cloud://', 'https://tmp.') })) }; },
  };
}

module.exports = { createMockCloud };
