"""离线演示：虚构名单 + 虚构报道，跑通 名单导入 → 名单变更 → 分析 → 成稿 全流程。

说明：演示中的人名均为虚构，报道内容为程序生成，不对应任何真实人物与事件；
不调用任何外部接口。真实生产请使用 data/roster/sources/ 中的正式名单与 DeepSeek 采集。
"""
from __future__ import annotations

import random
import shutil
from datetime import date, timedelta
from pathlib import Path

import yaml

from .analyze.classify import classify
from .config import Settings
from .collect import Period, run_collect
from .pipeline import Workspace, analyze, compose
from .roster import parse_roster_text
from .textutil import write_jsonl

ROSTER_V1 = """委员介绍（演示用虚构名单）
指导委员会主任
甄学文 清华大学
主任
贾知远 哈尔滨工业大学
副主任
林知远 浙江大学
顾云帆 华中科技大学
秘书长
沈若溪 中国人民大学
常务委员
林知远 复旦大学
陈　锐 北京大学
陈锐思 南京大学
柳青禾 中国科学院计算技术研究所
苏墨言 武汉大学
何清扬 山东大学
宋知秋 天津大学
委员
方以宁 大连理工大学
程思远 北京师范大学
叶闻舟 新加坡国立大学
温如初 西安交通大学
陆鸣谦 东南大学
韩照临 中山大学
孟书禾 苏州大学
许砚秋 北京邮电大学
邵听澜 厦门大学
秦望舒 吉林大学
唐逸尘 南开大学
裴语冰 华南理工大学
"""

# v2：新增 1 人、离任 1 人、1 人单位变更、1 人身份变化
ROSTER_V2 = (ROSTER_V1
             .replace("唐逸尘 南开大学\n", "")                                   # 离任
             .replace("裴语冰 华南理工大学", "裴语冰 深圳大学")                    # 单位变更
             .replace("程思远 北京师范大学\n", "")
             .replace("宋知秋 天津大学\n", "宋知秋 天津大学\n程思远 北京师范大学\n")  # 委员 → 常务委员
             + "钟予安 上海交通大学\n")                                          # 新增

AREAS = ["自然语言处理", "社交网络分析", "知识图谱", "大语言模型", "计算社会科学", "信息检索", "推荐系统", "网络舆情分析"]
SITES = [("news.{u}.edu.cn", "{org}新闻网"), ("www.xinhuanet.com", "新华网"), ("www.sohu.com", "搜狐"),
         ("mp.weixin.qq.com", "微信公众号"), ("www.cipsc.org.cn", "中国中文信息学会"), ("www.sciencenet.cn", "科学网")]
UNI = {"清华大学": "tsinghua", "哈尔滨工业大学": "hit", "浙江大学": "zju", "华中科技大学": "hust", "中国人民大学": "ruc",
       "复旦大学": "fudan", "北京大学": "pku", "南京大学": "nju", "中国科学院计算技术研究所": "ict", "武汉大学": "whu",
       "山东大学": "sdu", "天津大学": "tju", "大连理工大学": "dlut", "北京师范大学": "bnu", "新加坡国立大学": "nus",
       "西安交通大学": "xjtu", "东南大学": "seu", "中山大学": "sysu", "苏州大学": "suda", "北京邮电大学": "bupt",
       "厦门大学": "xmu", "吉林大学": "jlu", "南开大学": "nankai", "华南理工大学": "scut", "深圳大学": "szu",
       "上海交通大学": "sjtu"}

TEMPLATES = [
    ("honor", "{org}{name}教授当选{award}", "近日，{award}新晋名单正式公布，{org}{name}教授当选。{name}教授长期从事{area}研究，在相关领域发表高水平学术论文百余篇。"),
    ("honor", "{org}{name}团队论文获{venue}最佳论文奖", "在近日召开的{venue}国际学术会议上，{org}{name}教授团队关于{area}的论文荣获最佳论文奖。该研究提出了新的建模方法。"),
    ("research", "{name}教授团队在{venue}发表{area}研究成果", "近日，{org}{name}教授团队在{area}方向取得研究进展，相关论文被{venue}录用并发表，研究提出了一种新的算法框架。"),
    ("project", "{name}教授牵头的国家重点研发计划项目获批立项", "日前，由{org}{name}教授牵头申报的国家重点研发计划项目“面向{area}的关键技术研究”获批立项，项目将开展为期三年的研究。"),
    ("activity", "{name}教授应邀在{conf}作主旨报告", "{conf}于近日举行，{org}{name}教授应邀作题为《{area}：挑战与机遇》的主旨报告，与参会学者深入交流。"),
    ("activity", "{org}举办{area}学术论坛 {name}教授作特邀报告", "本次学术论坛聚焦{area}前沿问题，{org}{name}教授作特邀报告，分享了团队最新研究进展。"),
    ("service", "{name}教授担任{conf}程序委员会主席", "据大会官网消息，{org}{name}教授将担任{conf}程序委员会主席，负责大会学术论文评审组织工作。"),
    ("influence", "{name}入选全球前2%顶尖科学家榜单", "最新发布的全球前2%顶尖科学家榜单中，{org}{name}教授入选，其在{area}领域的研究论文被引用次数位居前列。"),
    ("influence", "{name}教授接受专访：谈{area}的未来", "在近日的一次专访中，{org}{name}教授就{area}的学术发展趋势发表观点，认为基础研究与开源生态同样重要。"),
]
AWARDS = ["IEEE Fellow", "ACM Fellow", "中国中文信息学会会士", "国家杰出青年科学基金获得者"]
VENUES = ["ACL 2026", "EMNLP 2026", "AAAI 2027", "KDD 2026", "SIGIR 2026", "WWW 2026"]
CONFS = ["CCL 2026", "NLPCC 2026", "CCKS 2026", "CIKM 2026", "全国计算语言学大会"]


def _site(org: str, rnd: random.Random) -> tuple[str, str]:
    host, name = rnd.choice(SITES)
    return host.format(u=UNI.get(org, "univ")), name.format(org=org)


def synth_items(members: list, period: Period, seed: int = 7) -> tuple[list[dict], list[dict]]:
    rnd = random.Random(seed)
    rows: list[dict] = []
    n = 0

    def add(title, text, org, day, member_id=None, host=None, site=None):
        nonlocal n
        n += 1
        if host is None:
            host, site = _site(org, rnd)
        d = period.start + timedelta(days=day)
        rows.append({"title": title + f"-{site}", "url": f"https://{host}/demo/{d:%Y/%m%d}/{n:04d}.htm",
                     "content": text, "site": site, "published": d.isoformat(), "member_id": member_id,
                     "provider": "demo"})

    for i, m in enumerate(members):
        k = 3 if i < 6 else 2
        for t in rnd.sample(TEMPLATES, k):
            cat, tt, tx = t
            kw = dict(name=m.name, org=m.org, area=rnd.choice(AREAS), award=rnd.choice(AWARDS),
                      venue=rnd.choice(VENUES), conf=rnd.choice(CONFS))
            title, text = tt.format(**kw), tx.format(**kw)
            day = rnd.randint(0, 6)
            add(title, text, m.org, day, m.id)
            if cat in ("honor", "project") and rnd.random() < 0.7:  # 转载 / 多家报道同一事件
                add(title.replace("教授", ""), "据报道，" + text, m.org, min(6, day + 1), host="www.xinhuanet.com", site="新华网")
                add(title + "（转载）", text, m.org, min(6, day + 1), host="www.sohu.com", site="搜狐")

    # 专委会自身动态
    add("SMP 2026 第十五届全国社会媒体处理大会成功召开",
        f"由中国中文信息学会社会媒体处理专委会主办的全国社会媒体处理大会近日召开，{members[0].name}教授、{members[1].name}教授出席并致辞，大会设置多场学术报告与论坛。",
        "中国中文信息学会", 2, host="www.cipsc.org.cn", site="中国中文信息学会")
    # 同名干扰：演员（应被否定）
    add(f"演员{members[9].name}主演新剧开机", f"演员{members[9].name}近日主演的都市剧开机，该剧导演表示……", "", 3,
        host="ent.sina.com.cn", site="新浪娱乐")
    # 名单内重名：林知远（复旦）
    add("复旦大学林知远教授团队发表社交网络分析研究论文",
        "复旦大学林知远教授团队在社交网络分析方向取得进展，论文被WWW 2026录用。", "复旦大学", 4,
        host="news.fudan.edu.cn", site="复旦大学新闻网")
    # 长名优先：陈锐思（南京大学）不应识别为陈锐；陈锐敏（非委员）也不应识别为陈锐
    add("南京大学陈锐思教授作学术报告", "南京大学陈锐思教授在学术论坛作报告，介绍知识图谱研究进展。", "南京大学", 5,
        host="news.nju.edu.cn", site="南京大学新闻网")
    add("陈锐敏同学获优秀毕业生称号", "学院学生陈锐敏获评优秀毕业生。", "北京大学", 5, host="news.pku.edu.cn", site="北京大学新闻网")
    # 非学术内容（应被学术过滤剔除）
    add(f"{members[3].org}与某科技公司举行战略合作签约仪式",
        f"签约仪式上，{members[3].name}出席。双方将在商业领域开展战略合作，公司估值与融资进展亦受关注。", members[3].org, 1)
    # 窗口外（应被过滤）
    add(f"{members[2].name}教授作学术报告", f"{members[2].org}{members[2].name}教授作学术报告。", members[2].org, -40)
    archive = [{"event_id": "demo-prev", "issue": "weekly-demo-prev", "issue_date": (period.start - timedelta(days=7)).isoformat(),
                "published": (period.start - timedelta(days=8)).isoformat(), "category": classify(rows[0]["title"], "")[0],
                "title": rows[0]["title"], "member_ids": [members[0].id], "urls": [rows[0]["url"]], "score": 80}]
    return rows, archive


def run_demo(out: Path) -> str:
    out = Path(out)
    if out.exists():
        shutil.rmtree(out)
    (out / "config").mkdir(parents=True)
    root_cfg = Path(__file__).resolve().parent.parent / "config"
    cfg = yaml.safe_load((root_cfg / "settings.yaml").read_text(encoding="utf-8"))
    cfg["deepseek"]["api_key"] = ""
    cfg["compose"]["use_llm"] = False
    cfg["disambiguation"]["use_llm_for_ambiguous"] = False
    # 演示数据量小：周报下限放宽为 20 条
    cfg["selection"]["weekly"]["min_items"] = 20
    (out / "config" / "settings.yaml").write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")
    shutil.copy(root_cfg / "org_aliases.yaml", out / "config" / "org_aliases.yaml")
    import os
    os.environ.pop("DEEPSEEK_API_KEY", None)
    s = Settings.load(out / "config" / "settings.yaml")
    lines = []

    ws = Workspace(s)
    d1 = ws.roster.sync(parse_roster_text(ROSTER_V1), date(2026, 1, 1), source="demo_v1")
    ws.profiles.sync_from_roster(ws.roster.members, ws.roster.homonyms())
    lines.append("【名单 v1 导入】" + d1.render().splitlines()[0])
    ws = Workspace(s)
    d2 = ws.roster.sync(parse_roster_text(ROSTER_V2), date(2026, 10, 1), source="demo_v2")
    ws.profiles.sync_from_roster(ws.roster.members, ws.roster.homonyms())
    lines.append("【名单 v2 变更】\n" + d2.render())

    ws = Workspace(s)
    period = Period.resolve("weekly", date(2026, 11, 10))
    rows, archive = synth_items(ws.roster.active, period)
    src = out / "demo_input.jsonl"
    write_jsonl(src, rows)
    write_jsonl(s.path("archive") / "events.jsonl", archive)
    rd = ws.run_dir(period)
    run_collect(s, ws.roster.active, ws.profiles, period, rd, "jsonl", src)
    rep = analyze(ws, rd)
    c = compose(ws, rd, use_llm=False)
    lines.append(f"【分析】原始 {rep['normalize']['raw']} 条 → 清洗 {rep['normalize']['items']} → 学术 {rep['academic_filter']['kept']} "
                 f"→ 事件 {rep['dedup']['events']}（跨期已发布 {rep['dedup']['previously_published']}）→ 入选 {rep['selection']['selected']}")
    lines.append(f"【消歧】{rep['disambiguation']}")
    lines.append("【成稿】" + "；".join(c["files"]))
    return "\n".join(lines)
