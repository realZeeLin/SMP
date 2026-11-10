'use strict';
/**
 * 成稿：抽取式摘要 → DeepSeek 改写（事实校验）→ 按栏目编排 → Markdown / 公众号内联样式 HTML。
 * 事实校验：缺少委员姓名、出现原文没有的数字、长度异常 → 回退抽取式，并在复核备注中说明。
 */
const { firstSentences, isoWeek } = require('./text');
const { CATEGORIES } = require('./classify');

const NUM = /\d+(?:\.\d+)?/g;

function factGuard(candidate, source, names, maxChars) {
  if (!candidate || candidate.length > maxChars * 1.3) return [false, '长度异常'];
  if (names && names.length && !names.some((n) => candidate.includes(n))) return [false, '缺少委员姓名'];
  const src = new Set(String(source).match(NUM) || []);
  const extra = (candidate.match(NUM) || []).filter((n) => !src.has(n));
  if (extra.length) return [false, `出现原文没有的数字:${extra.slice(0, 3).join(',')}`];
  return [true, ''];
}

function extractive(ev, maxChars) {
  const body = String(ev.text || '').replace(ev.title, '');
  return [ev.title.trim(), firstSentences(body, maxChars) || ev.title];
}

async function rewrite(ds, events, maxChars, batch = 8) {
  const system = '你是中国中文信息学会社会媒体处理专委会（SMP）公众号编辑，撰写委员学术动态简讯。要求：'
    + '1) 严格依据提供的原文，不得添加原文没有的事实、数字、头衔或评价；2) headline 不超过 30 字，以委员姓名开头；'
    + `3) summary 为 1~2 句、不超过 ${maxChars} 字，客观平实；4) 只写学术相关内容；`
    + '5) 输出 JSON：{"items":[{"id":...,"headline":...,"summary":...}]}';
  for (let i = 0; i < events.length; i += batch) {
    const chunk = events.slice(i, i + batch);
    const payload = chunk.map((e) => ({ id: e.eventId, members: e.memberNames, title: e.title, text: String(e.text).slice(0, 1200) }));
    let data;
    try { data = await ds.chatJson(system, `请改写以下条目：${JSON.stringify(payload)}`); } catch (e) { continue; }
    const got = new Map(((data && data.items) || []).map((x) => [String(x.id), x]));
    for (const e of chunk) {
      const x = got.get(e.eventId);
      if (!x) continue;
      const src = `${e.title} ${e.text}`;
      const [ok1, why1] = factGuard(String(x.headline || ''), src, e.memberNames, 40);
      const [ok2, why2] = factGuard(String(x.summary || ''), src, [], maxChars);
      if (ok1) e.headline = x.headline.trim();
      if (ok2) e.blurb = x.summary.trim();
      if (!(ok1 && ok2)) e.reviewNotes = [...(e.reviewNotes || []), `AI 改写未通过校验，已回退:${why1 || why2}`];
    }
  }
}

function issueTitle(period, cfg) {
  if (period.kind === 'weekly') {
    const [y, w] = isoWeek(period.start);
    const md = (s) => `${s.slice(5, 7)}.${s.slice(8, 10)}`;
    return (cfg.title_weekly || 'SMP 委员动态周报').replace('{year}', y).replace('{week}', w).replace('{start}', md(period.start)).replace('{end}', md(period.end));
  }
  return (cfg.title_monthly || 'SMP 委员动态月报').replace('{year}', period.start.slice(0, 4)).replace('{month}', String(+period.start.slice(5, 7)));
}

async function editorNote(ds, period, sections, n) {
  const fallback = `本期共收录委员学术动态 ${n} 条，涵盖${sections.map((s) => `${s.name}${s.events.length}条`).join('、')}。欢迎各位委员通过专委会秘书处报送动态线索。`;
  if (!ds || !ds.available) return fallback;
  const highlights = sections.flatMap((s) => s.events.map((e) => e.headline)).slice(0, 8);
  try {
    const r = await ds.chatJson('你是 SMP 专委会公众号编辑。根据给定的本期要点写一段 80~120 字的编者按，客观平实，只概括给出的要点，不要编造。输出 JSON：{"note":"..."}',
      `周期：${period.start}~${period.end}；条目数：${n}；要点：${JSON.stringify(highlights)}`);
    const note = String((r && r.note) || '').trim();
    return factGuard(note, `${highlights.join(' ')} ${n} ${period.start} ${period.end}`, [], 200)[0] ? note : fallback;
  } catch (e) { return fallback; }
}

/** 编排：按栏目顺序分组、组内按分数排序、全局重新编号。会修改 events 的 headline/blurb/rank。 */
async function buildIssue(settings, period, events, membersById, ds = null) {
  const cfg = settings.compose || {};
  const maxChars = cfg.summary_max_chars || 120;
  events.forEach((e) => { if (!e.headline || !e.blurb) { const [h, b] = extractive(e, maxChars); e.headline = e.headline || h; e.blurb = e.blurb || b; } });
  const fresh = events.filter((e) => !e.manualEdited);
  if (ds && ds.available && cfg.use_llm !== false) await rewrite(ds, fresh, maxChars);
  const order = cfg.section_order || Object.keys(CATEGORIES);
  const sections = [];
  let n = 0;
  for (const key of order) {
    const evs = events.filter((e) => e.category === key).sort((a, b) => b.score - a.score);
    if (!evs.length) continue;
    evs.forEach((e) => { e.rank = ++n; });
    sections.push({ key, name: CATEGORIES[key], events: evs });
  }
  const view = (e) => ({ rank: e.rank, eventId: e.eventId, headline: e.headline, blurb: e.blurb, url: e.url, site: e.site,
    date: e.published ? `${+e.published.slice(5, 7)}月${+e.published.slice(8, 10)}日` : '',
    members: e.memberIds.map((m) => ({ id: m, name: (membersById[m] || {}).name || m, org: (membersById[m] || {}).org || '' })),
    nSources: e.sources.length });
  const issue = { title: issueTitle(period, cfg), period, count: n,
    editorNote: await editorNote(ds && cfg.use_llm !== false ? ds : null, period, sections, n),
    sections: sections.map((s) => ({ key: s.key, name: s.name, events: s.events.map(view) })) };
  issue.markdown = renderMarkdown(issue);
  issue.html = renderWechatHtml(issue);
  return issue;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const memberLine = (ms, sep) => ms.map((m) => `${m.name}（${m.org}）`).join(sep);

function renderMarkdown(issue) {
  const L = [`# ${issue.title}`, '', `> 统计周期：${issue.period.start} — ${issue.period.end}　|　本期收录 ${issue.count} 条委员学术动态`, '',
    `**编者按**　${issue.editorNote}`, ''];
  issue.sections.forEach((s, i) => {
    L.push(`## ${i + 1}. ${s.name}`, '');
    s.events.forEach((e) => {
      L.push(`**${e.rank}. ${e.headline}**`, '', e.blurb, '');
      L.push(`${e.members.length ? `委员：${memberLine(e.members, '、')}　` : ''}来源：${e.site}${e.date ? ` · ${e.date}` : ''}${e.nSources > 1 ? `（另有 ${e.nSources - 1} 家报道）` : ''} [${e.rank}]`, '');
    });
  });
  L.push('---', '', '### 参考链接', '');
  issue.sections.forEach((s) => s.events.forEach((e) => L.push(`- [${e.rank}] ${e.url}`)));
  L.push('', '*信息来源于公开报道，如有出入请联系专委会秘书处更正。欢迎委员报送学术动态线索。*');
  return L.join('\n');
}

/** 公众号排版：全部内联样式（公众号编辑器会过滤 class/style 标签）；外链不可点击，以“来源 [n]”与文末参考链接呈现。
 *  视觉与小程序一致：Apple 风格——系统字体、#1D1D1F 正文、系统蓝强调、浅灰卡片、彩色栏目标识。 */
const CAT_COLOR = { org: '#5856D6', honor: '#FF9500', research: '#30B0C7', project: '#AF52DE', activity: '#007AFF', service: '#A2845E', influence: '#FF2D55', other: '#8E8E93' };

function renderWechatHtml(issue) {
  const C = { text: '#1D1D1F', sub: '#6E6E73', faint: '#86868B', blue: '#0071E3', line: '#D2D2D7', soft: '#F5F5F7' };
  const font = "font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Helvetica Neue',sans-serif;";
  const out = [];
  out.push(`<section style="${font}font-size:16px;color:${C.text};line-height:1.7;letter-spacing:0.2px;">`);
  out.push(`<section style="padding:8px 0 20px;">`
    + `<p style="margin:0;font-size:13px;font-weight:600;color:${C.blue};">SMP 委员学术动态 · ${issue.period.kind === 'monthly' ? '月报' : '周报'}</p>`
    + `<p style="margin:6px 0 0;font-size:24px;line-height:1.25;font-weight:700;color:${C.text};">${esc(issue.title)}</p>`
    + `<p style="margin:10px 0 0;font-size:13px;color:${C.faint};">${esc(issue.period.start)} — ${esc(issue.period.end)}　·　${issue.count} 条动态</p></section>`);
  out.push(`<section style="background:${C.soft};border-radius:14px;padding:16px 18px;margin:0 0 28px;">`
    + `<p style="margin:0 0 6px;font-size:15px;font-weight:700;">编者按</p><p style="margin:0;font-size:15px;color:${C.sub};">${esc(issue.editorNote)}</p></section>`);
  issue.sections.forEach((s) => {
    const color = CAT_COLOR[s.key] || C.blue;
    out.push(`<section style="margin:30px 0 6px;"><p style="margin:0;font-size:20px;font-weight:700;">`
      + `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${color};margin-right:8px;vertical-align:middle;"></span>${esc(s.name)}</p></section>`);
    s.events.forEach((e) => {
      out.push(`<section style="padding:14px 0;border-bottom:1px solid ${C.line};">`
        + `<p style="margin:0 0 4px;font-size:17px;line-height:1.45;font-weight:600;">${esc(e.headline)}</p>`
        + `<p style="margin:0 0 6px;font-size:15px;color:${C.sub};text-align:justify;">${esc(e.blurb)}</p>`
        + `<p style="margin:0;font-size:12px;color:${C.faint};">${e.members.length ? `<span style="color:${C.blue};">${esc(e.members.map((m) => m.name).join('、'))}</span>　` : ''}`
        + `${esc(e.site)}${e.date ? ` · ${esc(e.date)}` : ''}　[${e.rank}]</p></section>`);
    });
  });
  out.push(`<section style="margin-top:30px;font-size:12px;color:${C.faint};"><p style="margin:0 0 6px;font-weight:600;color:${C.sub};">参考链接</p>`);
  issue.sections.forEach((s) => s.events.forEach((e) => out.push(`<p style="margin:0;word-break:break-all;">[${e.rank}] ${esc(e.url)}</p>`)));
  out.push('<p style="margin:14px 0 0;">信息来源于公开报道，如有出入请联系专委会秘书处更正。欢迎委员报送学术动态线索。</p></section></section>');
  return out.join('\n');
}

module.exports = { factGuard, extractive, buildIssue, renderMarkdown, renderWechatHtml, issueTitle };
