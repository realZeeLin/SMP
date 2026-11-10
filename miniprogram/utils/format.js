/** 展示用常量与格式化（与云函数 lib/classify.js 栏目保持一致）。 */
/** 栏目颜色：iOS 系统色；背景为同色 15% 透明度（浅色/深色模式通用）。glyph 为栏目图标。 */
const CATEGORY = {
  org: { name: '专委会动态', color: '#5856D6', bg: 'rgba(88,86,214,0.15)', glyph: 'building' },
  honor: { name: '学术荣誉', color: '#FF9500', bg: 'rgba(255,149,0,0.15)', glyph: 'sparkles' },
  research: { name: '学术成果', color: '#30B0C7', bg: 'rgba(48,176,199,0.15)', glyph: 'doc' },
  project: { name: '科研项目', color: '#AF52DE', bg: 'rgba(175,82,222,0.15)', glyph: 'chart' },
  activity: { name: '学术活动', color: '#007AFF', bg: 'rgba(0,122,255,0.15)', glyph: 'globe' },
  service: { name: '学术任职', color: '#A2845E', bg: 'rgba(162,132,94,0.15)', glyph: 'person' },
  influence: { name: '学术影响力', color: '#FF2D55', bg: 'rgba(255,45,85,0.15)', glyph: 'bolt' },
  other: { name: '其他动态', color: '#8E8E93', bg: 'rgba(142,142,147,0.15)', glyph: 'info' },
};

const STATUS = {
  collecting: { name: '采集中', tone: 'blue', color: '#007AFF' },
  analyzing: { name: '分析中', tone: 'blue', color: '#007AFF' },
  reviewing: { name: '待复核', tone: 'orange', color: '#FF9500' },
  published: { name: '已发布', tone: 'green', color: '#34C759' },
  failed: { name: '失败', tone: 'red', color: '#FF3B30' },
};

const ROLE_SHORT = {
  指导委员会主任: '指导委主任', 指导委员会副主任: '指导委副主任', 指导委员会委员: '指导委员',
  主任: '主任', 副主任: '副主任', 秘书长: '秘书长', 副秘书长: '副秘书长', 秘书: '秘书',
  荣誉委员: '荣誉委员', 常务委员: '常务委员', 委员: '委员', 海外委员: '海外委员',
};

const DECISION = { keep: '已保留', drop: '已剔除', wrong_person: '认错人', confirm: '已确认' };

const pad = (n) => String(n).padStart(2, '0');
const md = (s) => (s ? `${+s.slice(5, 7)}.${pad(+s.slice(8, 10))}` : '');
const cnDate = (s) => (s ? `${+s.slice(5, 7)}月${+s.slice(8, 10)}日` : '');

function issueNo(issue) {
  if (!issue) return '';
  return issue.kind === 'weekly' ? `第 ${+issue.label.split('-W')[1]} 期` : `${+issue.label.slice(5)} 月刊`;
}

function decorateIssue(i) {
  if (!i) return i;
  const p = i.progress || {};
  return {
    ...i,
    no: issueNo(i),
    short: i.kind === 'weekly' ? String(+i.label.split('-W')[1]) : String(+i.label.slice(5)),
    year: i.label.slice(0, 4),
    kindName: i.kind === 'weekly' ? '周报' : '月报',
    range: `${md(i.start)} — ${md(i.end)}`,
    statusName: (STATUS[i.status] || {}).name || i.status,
    tone: (STATUS[i.status] || {}).tone || 'gray',
    statusColor: (STATUS[i.status] || {}).color || '#8E8E93',
    monthCn: `${+i.start.slice(5, 7)}月`,
    percent: p.tasks ? Math.round((p.done / p.tasks) * 100) : 100,
  };
}

function decorateEvent(e) {
  const c = CATEGORY[e.category] || CATEGORY.other;
  return { ...e, catName: c.name, catColor: c.color, catBg: c.bg, catGlyph: c.glyph, dateText: cnDate(e.published),
    confPct: Math.round((e.confidence || 0) * 100), decisionName: DECISION[e.decision] || '', scoreText: (e.score || 0).toFixed(1) };
}

module.exports = { CATEGORY, STATUS, ROLE_SHORT, DECISION, md, cnDate, issueNo, decorateIssue, decorateEvent };
