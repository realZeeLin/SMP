'use strict';
/**
 * DeepSeek 客户端：Chat（OpenAI 兼容）、开放搜索 Search API、网页抓取 Fetch API。
 * 接口依据官方文档（2026-11-10 核对）：https://api-docs.deepseek.com/guides/search
 *  - POST /v1/tools/search  {query(1~128字), count(1~50), need_content, ori_question, localization}
 *    → {results:[{title,url,snippet,summary,content,site_name,site_icon,date,authority(-1~4),rerank_score(0~3)}]}
 *  - POST /v1/tools/fetch   {url} → {title, content(Markdown)}
 *  - POST /chat/completions model: deepseek-flash | deepseek-v4-pro；thinking 默认开启，结构化任务关闭
 *  - 错误：408/429/5xx 可重试；400/401/402/403/404/413 不重试
 * - API Key 只存在云函数环境变量 DEEPSEEK_API_KEY 中，前端不可见；
 * - 请求字段与结果字段位置可在 config.settings.deepseek 中调整，以适配官方接口演进；
 * - 响应写入 cache 集合（由调用方注入 store），重跑不重复计费。
 */
const https = require('https');
const { URL } = require('url');
const { sha1 } = require('./text');

class DeepSeekError extends Error {}

const FIELD_ALIASES = {
  title: ['title', 'name', 'headline'],
  url: ['url', 'link', 'href', 'source_url'],
  snippet: ['snippet', 'description', 'abstract'],
  summary: ['summary'],
  content: ['content', 'text', 'markdown', 'body', 'page_content'],
  published: ['publish_time', 'published', 'published_at', 'date', 'datePublished', 'publish_date', 'time'],
  site: ['site_name', 'siteName', 'site', 'source', 'host'],
};

function mapResult(r) {
  const out = {};
  for (const [field, keys] of Object.entries(FIELD_ALIASES)) {
    const k = keys.find((x) => r && r[x]);
    out[field] = k ? r[k] : '';
  }
  // DeepSeek 提供的质量信号：authority -1~4（-1 未知），rerank_score 0~3
  out.authority = r && Number.isFinite(r.authority) ? r.authority : -1;
  out.rerankScore = r && Number.isFinite(r.rerank_score) ? r.rerank_score : null;
  return out;
}

const RETRYABLE = new Set([408, 429]);

function extractJson(text) {
  let t = String(text || '').trim();
  const m = t.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (m) t = m[1].trim();
  try { return JSON.parse(t); } catch (e) { /* 继续尝试 */ }
  for (const [o, c] of [['{', '}'], ['[', ']']]) {
    const i = t.indexOf(o); const j = t.lastIndexOf(c);
    if (i !== -1 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { /* next */ } }
  }
  throw new DeepSeekError(`无法解析模型 JSON 输出：${t.slice(0, 120)}`);
}

function postJson(url, body, headers, timeout) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const req = https.request({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, ...headers }, timeout }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) return reject(Object.assign(new DeepSeekError(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`), { status: res.statusCode }));
        try { resolve(JSON.parse(text)); } catch (e) { reject(new DeepSeekError(`非 JSON 响应：${text.slice(0, 200)}`)); }
      });
    });
    req.on('timeout', () => req.destroy(new DeepSeekError('请求超时')));
    req.on('error', reject);
    req.end(data);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class DeepSeek {
  /**
   * @param {object} cfg   settings.deepseek
   * @param {object} store { get(ns,key)->Promise<any|null>, set(ns,key,value)->Promise }
   * @param {Function} transport 可注入（测试用），签名同 postJson
   */
  constructor(cfg, store, apiKey = process.env.DEEPSEEK_API_KEY, transport = postJson) {
    this.cfg = cfg || {};
    this.store = store;
    this.key = apiKey || '';
    this.base = (this.cfg.base_url || 'https://api.deepseek.com').replace(/\/$/, '');
    this.transport = transport;
  }

  get available() { return Boolean(this.key); }

  async post(path, body) {
    if (!this.key) throw new DeepSeekError('未配置 DEEPSEEK_API_KEY（云函数环境变量）');
    const url = path.startsWith('http') ? path : this.base + path;
    const retries = this.cfg.max_retries ?? 3;
    let last;
    for (let i = 0; i <= retries; i++) {
      try {
        return await this.transport(url, body, { Authorization: `Bearer ${this.key}` }, this.cfg.timeout_ms || 20000);
      } catch (e) {
        last = e;
        if (e.status && e.status < 500 && !RETRYABLE.has(e.status)) break; // 400/401/402余额不足/403/404/413 不重试
        await sleep(Math.min(1000 * 2 ** i, 8000));
      }
    }
    throw last;
  }

  async cached(ns, body, fn) {
    const key = `${ns}:${sha1(body)}`;
    if (this.store) {
      const hit = await this.store.get(ns, key);
      if (hit !== null && hit !== undefined) return hit;
    }
    const value = await fn();
    if (this.store) await this.store.set(ns, key, value);
    return value;
  }

  async chat(messages, { json = false, temperature = 0.2 } = {}) {
    const body = { model: this.cfg.chat_model || 'deepseek-flash', messages, temperature };
    // 默认开启思考模式；抽取、改写等结构化任务关闭以降低时延与成本（思考模式下 temperature 不生效）
    if (this.cfg.thinking) body.thinking = { type: this.cfg.thinking };
    if (json) body.response_format = { type: 'json_object' };
    return this.cached('chat', body, async () => (await this.post('/chat/completions', body)).choices[0].message.content);
  }

  async chatJson(system, user) {
    return extractJson(await this.chat([{ role: 'system', content: system }, { role: 'user', content: user }], { json: true }));
  }

  async search(query, extra = {}) {
    const c = this.cfg.search || {};
    const q = String(query).slice(0, c.max_query_chars || 128);
    const body = { [c.query_field || 'query']: q, [c.count_field || 'count']: Math.min(50, c.count || 20), ...(c.extra_body || {}), ...extra };
    if (body.ori_question) body.ori_question = String(body.ori_question).slice(0, 128);
    return this.cached('search', body, async () => {
      const data = await this.post(c.endpoint || '/v1/tools/search', body);
      let results = null;
      for (const k of c.results_path || ['results']) {
        let cur = data && data[k];
        if (cur && !Array.isArray(cur) && typeof cur === 'object') cur = Object.values(cur).find(Array.isArray);
        if (Array.isArray(cur)) { results = cur; break; }
      }
      if (!results && Array.isArray(data)) results = data;
      const min = c.min_rerank_score;
      return (results || []).filter((r) => r && typeof r === 'object')
        .filter((r) => !(Number.isFinite(min) && Number.isFinite(r.rerank_score) && r.rerank_score < min))
        .map(mapResult);
    });
  }

  async fetch(url) {
    const c = this.cfg.fetch || {};
    const body = { [c.url_field || 'url']: url };
    return this.cached('fetch', body, async () => {
      const data = await this.post(c.endpoint || '/v1/tools/fetch', body);
      const payload = data && typeof data.data === 'object' ? data.data : data;
      return mapResult(payload || {});
    });
  }
}

module.exports = { DeepSeek, DeepSeekError, mapResult, extractJson };
