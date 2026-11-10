'use strict';
/** 学术相关性过滤 + 栏目分类 + 级别识别。只收录学术动态（学术活动/荣誉获奖/成果/项目/任职服务/影响力）。 */

const CATEGORIES = {
  org: '专委会动态', honor: '学术荣誉', research: '学术成果', project: '科研项目',
  activity: '学术活动', service: '学术任职与服务', influence: '学术影响力', other: '其他学术动态',
};

const CATEGORY_TERMS = {
  honor: ['获奖', '荣获', '奖励', '特等奖', '一等奖', '二等奖', '三等奖', '最佳论文', 'Best Paper', '当选院士', '院士', 'Fellow',
    '杰出青年', '杰青', '优青', '长江学者', '万人计划', '拔尖人才', '称号', '荣誉', '表彰', '学术奖', '科技奖', '自然科学奖',
    '科技进步奖', '技术发明奖', '钱伟长', '吴文俊', '颁奖', '授予'],
  research: ['论文', '发表', '录用', '成果', '研究揭示', '首次提出', '提出了', '数据集', '开源', '专著', '出版', '专利', '标准',
    'Nature', 'Science', '期刊', '顶会', 'ACL', 'EMNLP', 'AAAI', 'IJCAI', 'NeurIPS', 'ICML', 'ICLR', 'KDD', 'SIGIR', 'WWW',
    'TPAMI', 'TKDE', '大模型', '算法', '封面文章'],
  project: ['立项', '获批', '资助', '重点项目', '重大项目', '重点研发计划', '自然科学基金', '社科基金', '科研项目', '课题', '结题', '验收', '专项'],
  activity: ['报告', '讲座', '演讲', '主旨', '特邀', 'Keynote', '论坛', '研讨会', '学术会议', '大会', '出席', '举办', '召开', '做客',
    '访问', '交流', '讲习班', 'Tutorial', '分享', '沙龙', '工作坊', 'Workshop', '峰会'],
  service: ['担任', '出任', '任命', '聘任', '当选理事长', '理事长', '副理事长', '程序委员会', 'PC Chair', 'Program Chair', 'Area Chair',
    '领域主席', '大会主席', '主编', '副主编', '编委', '理事', '专委会主任', '常务理事', '评审专家', '顾问'],
  influence: ['高被引', '被引', '引用', '前2%', '全球前', '榜单', '排名', 'AI 2000', 'AI2000', '影响力', '专访', '采访', '观点', '撰文',
    '署名文章', '解读', '评论', '访谈'],
};

const HONOR_STRONG = ['最佳论文', '获奖', '荣获', '院士', 'Fellow', '杰出青年', '杰青', '优青', '长江学者', '特等奖', '一等奖', '二等奖',
  '三等奖', '科技奖', '自然科学奖', '颁奖', '表彰', '会士'];
const SERVICE_STRONG = ['理事长', '程序委员会', '主编', '大会主席', 'PC Chair', 'Program Chair', '编委'];
const INFLUENCE_STRONG = ['榜单', '高被引', '前2%', 'AI 2000', 'AI2000'];

const LEVEL_TERMS = [
  [1.0, ['院士', 'Fellow', '国家最高', '国家自然科学奖', '国家科技进步奖', '国家技术发明奖', '杰出青年', '杰青', '长江学者', '最佳论文',
    'Best Paper', '特等奖', '一等奖', 'Nature', 'Science', '重大项目', '理事长', '全球前2%', '高被引科学家']],
  [0.7, ['优青', '二等奖', '省部级', '重点项目', '重点研发计划', 'CCF-A', '顶会', 'ACL', 'EMNLP', 'AAAI', 'IJCAI', 'NeurIPS', 'ICML',
    'ICLR', 'KDD', 'SIGIR', '主旨', 'Keynote', '大会报告', '主编', '程序委员会主席', 'PC Chair', '大会主席', '国际', 'AI 2000', 'AI2000', '高被引']],
  [0.4, ['三等奖', '优秀', '特邀', '编委', '领域主席', 'Area Chair', '面上项目', '青年基金', '省级']],
];

const count = (text, terms) => terms.reduce((n, t) => n + (t && text.includes(t) ? 1 : 0), 0);
const anyIn = (text, terms) => terms.some((t) => text.includes(t));

function academicCheck(cfg, title, context) {
  cfg = cfg || {};
  if (cfg.enabled === false) return [true, ''];
  const bad = (cfg.exclude_title_terms || []).find((t) => title.includes(t));
  if (bad) return [false, `标题命中排除类型:${bad}`];
  const acad = 2 * count(title, cfg.signal_terms || []) + count(context, cfg.signal_terms || []);
  const non = 2 * count(title, cfg.non_academic_terms || []) + count(context, cfg.non_academic_terms || []);
  if (acad < (cfg.min_signal || 1)) return [false, '无学术信号'];
  if (non > acad) return [false, '非学术内容'];
  return [true, ''];
}

function classify(title, text, isOrgNews) {
  if (isOrgNews) return 'org';
  if (anyIn(title, SERVICE_STRONG) && !anyIn(title, HONOR_STRONG)) return 'service';
  if (anyIn(title, HONOR_STRONG) || (title.includes('当选') && !anyIn(title, SERVICE_STRONG))) return 'honor';
  if (anyIn(title, INFLUENCE_STRONG)) return 'influence';
  let best = 'other'; let bestScore = 0;
  for (const [cat, terms] of Object.entries(CATEGORY_TERMS)) {
    const s = 2 * count(title, terms) + count(String(text).slice(0, 1500), terms);
    if (s > bestScore) { best = cat; bestScore = s; }
  }
  return best;
}

function detectLevel(title, text) {
  const full = `${title} ${String(text).slice(0, 2000)}`;
  for (const [level, terms] of LEVEL_TERMS) {
    const hit = terms.find((t) => full.includes(t));
    if (hit) return [title.includes(hit) ? level : level * 0.75, hit];
  }
  return [0.2, ''];
}

module.exports = { CATEGORIES, academicCheck, classify, detectLevel };
