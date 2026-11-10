'use strict';
/** 文本、URL、日期通用工具（业务日期一律用 'YYYY-MM-DD' 字符串，按北京时间计算）。 */
const crypto = require('crypto');

const SPACES = /[\s　 ]+/g;
const CJK = /[一-鿿]/;

const normName = (s) => String(s || '').replace(SPACES, '').trim();
const normOrg = (s) => String(s || '').normalize('NFKC').replace(SPACES, '').replace(/\(/g, '（').replace(/\)/g, '）');
const isCjk = (ch) => CJK.test(ch || '');

/** 只把全角字母数字转半角，保留中文全角标点。 */
function cleanText(s) {
  return String(s || '')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\f\v　 ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const compact = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function shingles(s, k = 3) {
  const t = compact(s);
  const out = new Set();
  if (!t) return out;
  if (t.length <= k) { out.add(t); return out; }
  for (let i = 0; i <= t.length - k; i++) out.add(t.slice(i, i + k));
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const stableHash = (...parts) => crypto.createHash('sha1').update(parts.join('␟')).digest('hex').slice(0, 12);
const sha1 = (s) => crypto.createHash('sha1').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');

// ---------- URL ----------
const TRACKING = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'spm', 'from',
  'isappinstalled', 'scene', 'srcid', 'share_token', 'chksm', 'sessionid', 'clicktime', 'enterid', 'ref', 'fbclid', 'gclid']);

function canonicalUrl(url) {
  if (!url) return '';
  let u;
  try { u = new URL(String(url).trim()); } catch (e) { return String(url).trim(); }
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.startsWith('m.') && host.split('.').length >= 3) host = host.slice(2);
  let params = [...u.searchParams.entries()].filter(([k, v]) => v !== '' && !TRACKING.has(k.toLowerCase()));
  if (host === 'mp.weixin.qq.com' && params.length) params = params.filter(([k]) => ['__biz', 'mid', 'idx', 'sn'].includes(k));
  params.sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const q = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
  return `https://${host}${path}${q}`;
}

function domainOf(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch (e) { return ''; }
}

// ---------- 日期 ----------
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const toDate = (s) => new Date(`${s}T00:00:00Z`);

function validYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? fmt(dt) : null;
}

/** 解析多种日期写法，返回 'YYYY-MM-DD' 或 null。 */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    const ms = v > 1e11 ? v : v * 1000;
    const d = new Date(ms + 8 * 3600e3);
    return isNaN(d) ? null : fmt(d);
  }
  const s = String(v).trim();
  let m = s.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  return null;
}

const todayCN = () => fmt(new Date(Date.now() + 8 * 3600e3));
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400e3);

function weekRange(s) {
  const d = toDate(s);
  const wd = (d.getUTCDay() + 6) % 7; // 周一=0
  const start = addDays(s, -wd);
  return [start, addDays(start, 6)];
}

function monthRange(s) {
  const d = toDate(s);
  const start = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const end = fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
  return [start, end];
}

function isoWeek(s) {
  const d = toDate(s);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400e3 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return [year, week];
}

function firstSentences(text, max = 120) {
  const t = cleanText(text).replace(/\n/g, ' ');
  const parts = t.split(/(?<=[。！？!?；;])/);
  let out = '';
  for (const p of parts) {
    if (!p.trim()) continue;
    if (out && out.length + p.length > max) break;
    out += p.trim();
  }
  return out.length > max ? out.slice(0, max - 1) + '…' : out;
}

const TITLE_SUFFIX = /\s*(?:[-_|｜—]{1,2}|\s{2,})\s*[^-_|｜—\s]{2,16}\s*$/;
const REPRINT = /\s*[（(【[]\s*(?:转载|转|图|视频|组图|附视频)\s*[)）】\]]\s*$/;

/** '某某获奖-某大学新闻网' → '某某获奖'。 */
function stripSiteSuffix(title) {
  let t = cleanText(title);
  for (let i = 0; i < 2; i++) {
    const t2 = t.replace(TITLE_SUFFIX, '').replace(REPRINT, '');
    if (t2.length < 8 || t2 === t) break;
    t = t2;
  }
  return t.replace(REPRINT, '');
}

module.exports = {
  normName, normOrg, isCjk, cleanText, compact, shingles, jaccard, stableHash, sha1,
  canonicalUrl, domainOf, parseDate, todayCN, addDays, daysBetween, weekRange, monthRange, isoWeek,
  firstSentences, stripSiteSuffix,
};
