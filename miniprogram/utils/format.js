/** 展示用常量与格式化（与云函数 lib/classify.js 栏目保持一致）。 */
const CATEGORY = {
  org: { name: '专委会动态', color: '#1B2B48', bg: '#E8ECF3' },
  honor: { name: '学术荣誉', color: '#9A7438', bg: '#F5EEDF' },
  research: { name: '学术成果', color: '#2F6F62', bg: '#E3F0EC' },
  project: { name: '科研项目', color: '#5E4E8C', bg: '#ECE8F4' },
  activity: { name: '学术活动', color: '#2F5D8C', bg: '#E4EDF6' },
  service: { name: '学术任职', color: '#7A5B3A', bg: '#F1EAE2' },
  influence: { name: '学术影响力', color: '#A04F48', bg: '#F6E7E5' },
  other: { name: '其他动态', color: '#6B717A', bg: '#EEEFF1' },
};

const STATUS = {
  collecting: { name: '采集中', tone: 'blue' },
  analyzing: { name: '分析中', tone: 'blue' },
  reviewing: { name: '待复核', tone: 'gold' },
  published: { name: '已发布', tone: 'green' },
  failed: { name: '失败', tone: 'red' },
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
    percent: p.tasks ? Math.round((p.done / p.tasks) * 100) : 100,
  };
}

function decorateEvent(e) {
  const c = CATEGORY[e.category] || CATEGORY.other;
  return { ...e, catName: c.name, catColor: c.color, catBg: c.bg, dateText: cnDate(e.published),
    confPct: Math.round((e.confidence || 0) * 100), decisionName: DECISION[e.decision] || '', scoreText: (e.score || 0).toFixed(1) };
}

module.exports = { CATEGORY, STATUS, ROLE_SHORT, DECISION, md, cnDate, issueNo, decorateIssue, decorateEvent };
