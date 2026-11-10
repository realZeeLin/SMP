/**
 * 周报 / 月报样式示例（静态，不随数据更新）。
 * 数据来源（真实公开报道）：哈工大 SCIR 新闻《第十三届全国社会媒体处理大会成功举办！》（2025-12-23），
 * 页面注明“本文转载自社媒派SMP公众号”：https://ir.hit.edu.cn/2025/1223/c19589a385099/page.htm
 * 每条条目只使用该文明确写出的事实；委员姓名与单位经名单（2026-11-10 版）校验。
 * 报道中与名单同名但单位不符者（王震/西北工业大学、王硕/启元实验室、刘洋/清华大学）按消歧规则不收录；
 * 付国宏（报道单位苏州大学，名单为黑龙江大学）属单位变化待复核，示例中不收录。
 * 运行：node design/samples/build-samples.js → miniprogram/data/samples.js
 */
const fs = require('fs');
const path = require('path');
const fnDir = path.join(__dirname, '..', '..', 'cloudfunctions', 'smp');
const { parseRoster } = require(path.join(fnDir, 'lib', 'roster'));
const { renderMarkdown, renderWechatHtml } = require(path.join(fnDir, 'lib', 'compose'));
const { CATEGORIES } = require(path.join(fnDir, 'lib', 'classify'));

const SOURCE = { url: 'https://ir.hit.edu.cn/2025/1223/c19589a385099/page.htm', site: '社媒派SMP（哈工大SCIR转载）' };
const roster = parseRoster(fs.readFileSync(path.join(fnDir, 'data', 'roster-2026-11-10.txt'), 'utf8'));
const CONF = '11月20日—23日';

// [栏目, 标题, 摘要, 委员, 日期, 是否进周报]
const ITEMS = [
  ['org', '第十三届全国社会媒体处理大会在武汉召开', '大会由专委会主办、华中科技大学计算机科学与技术学院承办，以“走向人类社会的大模型”为主题，汇聚全国1100余位专家学者和190多家单位。专委会主任唐杰致辞，强调技术的最终落点在于服务人民、服务社会。', ['唐杰'], CONF, true],
  ['org', '专委会召开2025年度工作会议', '大会期间同步召开中国中文信息学会社会媒体处理专委会2025年度工作会议，并向大会合作单位颁发感谢牌。', [], CONF, false],
  ['org', '2025 CIPS-SMP清智大模型基金公布获资助项目名单', '本期基金由专委会联合北京智谱华章科技股份有限公司、星连资本共同发布，名单于大会闭幕式上公布，旨在助力科研发展。', [], '11月23日', true],
  ['org', 'SMP 2026将在北京举办，由中国传媒大学承办', '大会闭幕式宣布，第十四届全国社会媒体处理大会将于北京举办，由中国传媒大学承办。', [], '11月23日', true],
  ['honor', '刘元兴获2025年“CIPS-SMP清智大模型”第三期基金资助', '哈尔滨工业大学刘元兴副研究员获得2025年“CIPS-SMP清智大模型”第三期基金资助。', ['刘元兴'], '11月23日', true],
  ['activity', '孙茂松作《生成式人工智能对社会媒体处理的可能影响》主旨报告', '报告指出，生成式人工智能将从内容生产、信息分发、用户互动与治理机制等多个维度深刻影响社会媒体处理的发展方向，大模型赋能社会媒体处理正处于关键窗口期。', ['孙茂松'], CONF, true],
  ['activity', '刘挺作《认知安全：策略与技术》主旨报告', '报告围绕“认知安全”主题，从感知、决策、干预等关键层面进行探讨，并分享了团队在认知安全领域的工作进展。', ['刘挺'], CONF, true],
  ['activity', '东昱晓作《AgentRL：智能体基座大模型的强化扩展框架与算法》青年主旨报告', '报告从训练框架、基础能力与应用场景层面，分享了团队在基座大模型智能体强化学习方向的探索。', ['东昱晓'], CONF, true],
  ['activity', '赵妍妍在情感计算论坛作《个性化与角色化的共情对话技术》报告', '哈尔滨工业大学赵妍妍教授在情感计算分论坛作主题报告。', ['赵妍妍'], CONF, true],
  ['activity', '刘元兴在社交机器人论坛作《增强社交智能体的批判思维能力与说服力》报告', '哈尔滨工业大学刘元兴副研究员在社交机器人分论坛作主题报告。', ['刘元兴'], CONF, false],
  ['activity', '张文涛主讲“大模型GUI智能体与大模型数据基础设施”讲习班', '大会前沿讲习班中，北京大学张文涛与香港科技大学何俊贤针对大模型GUI智能体与数据基础设施开展专题讲解。', ['张文涛'], '11月20日—21日', false],
  ['activity', '桑基韬主讲“大模型智能体训练评估与大模型模拟”讲习班', '北京交通大学桑基韬教授与清华大学高宸在前沿讲习班作主题分享。', ['桑基韬'], '11月20日—21日', false],
  ['activity', '张静、王翔、陈旭在SMP-FoLM大模型青年论坛作主题分享', '论坛聚焦大模型技术发展趋势，共同探讨大模型未来发展的颠覆性技术方向。', ['张静', '王翔', '陈旭'], CONF, true],
  ['activity', '刘德喜在数据挖掘论坛作主题分享', '论坛系统呈现数据挖掘在前沿AI场景下的最新理论突破与落地实践。', ['刘德喜'], CONF, false],
  ['activity', '魏忠钰、邱伟云在计算历史学论坛作主题分享', '论坛聚焦人文与计算之间的“问题”与“方法”，探讨构建人文研究新范式的路径。', ['魏忠钰', '邱伟云'], CONF, false],
  ['activity', '杨巨峰、徐童在情感计算论坛作主题分享', '论坛探索情感计算在心理辅助、内容创作、具身交互等场景中的未来路径。', ['杨巨峰', '徐童'], CONF, false],
  ['activity', '赵蓓在计算传播学论坛作主题分享', '论坛聚焦社交媒体中的情绪演化、标签博弈及主流媒体舆论传播等议题。', ['赵蓓'], CONF, false],
  ['activity', '林衍凯在基础模型论坛作主题分享', '论坛围绕“基础模型的大规模强化学习”主题展开研讨。', ['林衍凯'], CONF, false],
  ['activity', '李佳、谢倩倩在智慧金融论坛作主题分享', '论坛围绕多模态智能、图机器学习、大语言模型、多智能体等方向，探讨AI驱动下金融服务的创新与安全挑战。', ['李佳', '谢倩倩'], CONF, false],
  ['activity', '李霏在社交机器人论坛作主题分享', '论坛共同勾勒未来人机社会共生的新图景。', ['李霏'], CONF, false],
  ['service', '丁效担任大会程序委员会主席', '丁效教授在开幕式上汇报大会筹备情况，并以专委会秘书长身份在闭幕式上作大会总结。', ['丁效'], CONF, true],
  ['service', '东昱晓主持SMP-FoLM大模型青年论坛', '清华大学东昱晓副教授主持大模型青年论坛。', ['东昱晓'], CONF, false],
  ['service', '杨洋、许嘉蓉担任数据挖掘论坛主席', '浙江大学杨洋教授与复旦大学许嘉蓉副研究员共同担任论坛主席。', ['杨洋', '许嘉蓉'], CONF, false],
  ['service', '陈旭担任AI for Social Science论坛主席', '中国人民大学陈旭预聘副教授担任论坛主席，共同探索AI与社会融合发展的新路径。', ['陈旭'], CONF, false],
  ['service', '左家莉担任计算历史学论坛主席', '江西师范大学左家莉副教授担任论坛主席。', ['左家莉'], CONF, false],
  ['service', '段俊文担任情感计算论坛主席', '中南大学段俊文副教授担任论坛主席。', ['段俊文'], CONF, false],
  ['service', '张伦担任计算传播学论坛主席', '北京师范大学张伦教授担任论坛主席。', ['张伦'], CONF, false],
  ['service', '杨亮担任智慧司法学论坛主席', '大连理工大学杨亮副教授担任论坛主席，论坛探讨人工智能在法治体系中的创新应用与治理挑战。', ['杨亮'], CONF, false],
  ['service', '刘知远担任基础模型论坛主席', '清华大学刘知远长聘副教授担任论坛主席，论坛深入剖析强化学习如何为大模型智能水平提升注入活力。', ['刘知远'], CONF, true],
  ['service', '敖翔担任智慧金融论坛主席', '中国科学院计算技术研究所敖翔副研究员担任论坛主席。', ['敖翔'], CONF, false],
  ['service', '张伟男担任社交机器人论坛主席', '哈尔滨工业大学人工智能学院执行院长张伟男担任论坛主席。', ['张伟男'], CONF, true],
  ['service', '万怀宇、杨成担任评测论坛主席', '论坛同时举行SMP 2025大模型报告生成挑战赛的颁奖和分享。', ['万怀宇', '杨成'], CONF, true],
  ['service', '涂存超担任企业论坛主席', '幂律智能CEO涂存超与星连资本合伙人李文珏共同担任论坛主席，从企业应用实践角度探讨大模型落地。', ['涂存超'], CONF, false],
];

function member(name) {
  const ms = roster.filter((m) => m.name === name);
  if (ms.length !== 1) throw new Error(`名单中 ${name} 匹配 ${ms.length} 人，需指定单位`);
  return { name, org: ms[0].org };
}

function build(kind, items, period, title, note) {
  const order = ['org', 'honor', 'research', 'project', 'activity', 'service', 'influence', 'other'];
  let rank = 0;
  const sections = order.map((key) => ({ key, name: CATEGORIES[key], events: items.filter((x) => x[0] === key).map((x) => ({
    rank: ++rank, headline: x[1], blurb: x[2], url: SOURCE.url, site: SOURCE.site, date: x[4], members: x[3].map(member), nSources: 1,
  })) })).filter((s) => s.events.length);
  const issue = { kind, title, period: { kind, ...period }, count: rank, editorNote: note, sections, source: SOURCE,
    disclaimer: '样式示例：内容取自社媒派SMP公众号关于 CIPS-SMP 2025 的公开报道（经哈工大SCIR转载），不随数据更新。' };
  issue.markdown = renderMarkdown(issue);
  issue.html = renderWechatHtml(issue);
  return issue;
}

const weeklyItems = ITEMS.filter((x) => x[5]);
const samples = {
  weekly: build('weekly', weeklyItems, { start: '2025-11-17', end: '2025-11-23', label: '2025-W47' },
    'SMP 委员动态周报 | 2025年第47期（11.17—11.23）',
    `本周，第十三届全国社会媒体处理大会（CIPS-SMP 2025）在武汉召开。本期精选委员在大会期间的主旨报告、学术服务与基金资助等动态 ${weeklyItems.length} 条，并附 SMP 2026 承办信息。`),
  monthly: build('monthly', ITEMS, { start: '2025-11-01', end: '2025-11-30', label: '2025-11' },
    'SMP 委员动态月报 | 2025年11月',
    `11 月，第十三届全国社会媒体处理大会（CIPS-SMP 2025）在武汉召开，大会以“走向人类社会的大模型”为主题，汇聚 1100 余位专家学者。本期收录委员在大会期间的主旨报告、论坛主持与主题分享等学术动态 ${ITEMS.length} 条，并附专委会年度工作会议、清智大模型基金与 SMP 2026 承办信息。`),
};

const out = path.join(__dirname, '..', '..', 'miniprogram', 'data', 'samples.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `/* 自动生成：node design/samples/build-samples.js（数据来源见该脚本头注释），请勿手改 */\nmodule.exports = ${JSON.stringify(samples, null, 1)};\n`);
console.log(`weekly ${samples.weekly.count} 条，monthly ${samples.monthly.count} 条 → ${path.relative(process.cwd(), out)}`);
module.exports = { ITEMS, samples };
