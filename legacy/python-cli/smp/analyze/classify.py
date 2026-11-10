"""学术相关性过滤 + 栏目分类 + 级别识别（规则为主，可由 LLM 复核）。

本工具定位是“委员学术动态”：只收录学术活动、学术荣誉/获奖、学术成果、科研项目、
学术任职与服务、学术影响力等。商业、娱乐、生活类及行政通知类内容被过滤。
"""
from __future__ import annotations

from ..config import Settings

CATEGORY_TERMS: dict[str, list[str]] = {
    "honor": ["获奖", "荣获", "奖励", "特等奖", "一等奖", "二等奖", "三等奖", "最佳论文", "Best Paper", "当选院士",
              "院士", "Fellow", "杰出青年", "杰青", "优青", "长江学者", "万人计划", "拔尖人才", "称号", "荣誉", "表彰",
              "学术奖", "科技奖", "自然科学奖", "科技进步奖", "技术发明奖", "钱伟长", "吴文俊", "颁奖", "授予"],
    "research": ["论文", "发表", "录用", "成果", "研究揭示", "首次提出", "提出了", "数据集", "开源", "专著", "出版",
                 "专利", "标准", "Nature", "Science", "期刊", "顶会", "ACL", "EMNLP", "AAAI", "IJCAI", "NeurIPS",
                 "ICML", "ICLR", "KDD", "SIGIR", "WWW", "TPAMI", "TKDE", "大模型", "算法", "封面文章"],
    "project": ["立项", "获批", "资助", "重点项目", "重大项目", "重点研发计划", "自然科学基金", "社科基金", "科研项目",
                "课题", "结题", "验收", "专项"],
    "activity": ["报告", "讲座", "演讲", "主旨", "特邀", "Keynote", "论坛", "研讨会", "学术会议", "大会", "出席",
                 "举办", "召开", "做客", "访问", "交流", "讲习班", "Tutorial", "分享", "沙龙", "工作坊", "Workshop", "峰会"],
    "service": ["担任", "出任", "任命", "聘任", "当选理事长", "理事长", "副理事长", "程序委员会", "PC Chair",
                "Program Chair", "Area Chair", "领域主席", "大会主席", "主编", "副主编", "编委", "理事", "专委会主任",
                "常务理事", "评审专家", "顾问"],
    "influence": ["高被引", "被引", "引用", "前2%", "全球前", "榜单", "排名", "AI 2000", "AI2000", "影响力",
                  "专访", "采访", "观点", "撰文", "署名文章", "解读", "评论", "访谈"],
}

LEVEL_TERMS: list[tuple[float, list[str]]] = [
    (1.0, ["院士", "Fellow", "国家最高", "国家自然科学奖", "国家科技进步奖", "国家技术发明奖", "杰出青年", "杰青",
           "长江学者", "最佳论文", "Best Paper", "特等奖", "一等奖", "Nature", "Science", "重大项目", "理事长",
           "全球前2%", "高被引科学家"]),
    (0.7, ["优青", "二等奖", "省部级", "重点项目", "重点研发计划", "CCF-A", "顶会", "ACL", "EMNLP", "AAAI",
           "IJCAI", "NeurIPS", "ICML", "ICLR", "KDD", "SIGIR", "主旨", "Keynote", "大会报告", "主编",
           "程序委员会主席", "PC Chair", "大会主席", "国际", "AI 2000", "AI2000", "高被引"]),
    (0.4, ["三等奖", "优秀", "特邀", "编委", "领域主席", "Area Chair", "面上项目", "青年基金", "省级"]),
]


def _count(text: str, terms: list[str]) -> int:
    return sum(1 for t in terms if t and t in text)


class AcademicFilter:
    def __init__(self, settings: Settings):
        cfg = settings.get("academic_filter", {}) or {}
        self.enabled = cfg.get("enabled", True)
        self.min_signal = cfg.get("min_signal", 1)
        self.signal = cfg.get("signal_terms", [])
        self.non = cfg.get("non_academic_terms", [])
        self.exclude_title = cfg.get("exclude_title_terms", [])

    def check(self, title: str, context: str) -> tuple[bool, str]:
        """context 为委员姓名附近的文本（或专委会新闻全文）。返回 (是否通过, 原因)。"""
        if not self.enabled:
            return True, ""
        bad = [t for t in self.exclude_title if t in title]
        if bad:
            return False, f"标题命中排除类型:{bad[0]}"
        acad = 2 * _count(title, self.signal) + _count(context, self.signal)
        non = 2 * _count(title, self.non) + _count(context, self.non)
        if acad < self.min_signal:
            return False, "无学术信号"
        if non > acad:
            return False, f"非学术内容主导({non}>{acad})"
        return True, ""


# 标题强信号优先：如“论文获最佳论文奖”应归入荣誉而非成果
HONOR_STRONG = ["最佳论文", "获奖", "荣获", "院士", "Fellow", "杰出青年", "杰青", "优青", "长江学者", "特等奖",
                "一等奖", "二等奖", "三等奖", "科技奖", "自然科学奖", "颁奖", "表彰", "会士"]
SERVICE_STRONG = ["理事长", "程序委员会", "主编", "大会主席", "PC Chair", "Program Chair", "编委"]
INFLUENCE_STRONG = ["榜单", "高被引", "前2%", "AI 2000", "AI2000"]


def classify(title: str, text: str, is_org_news: bool = False) -> tuple[str, dict]:
    if is_org_news:
        return "org", {"org": 99}
    if any(t in title for t in SERVICE_STRONG) and not any(t in title for t in HONOR_STRONG):
        return "service", {"service": 99}
    if any(t in title for t in HONOR_STRONG) or ("当选" in title and not any(t in title for t in SERVICE_STRONG)):
        return "honor", {"honor": 99}
    if any(t in title for t in INFLUENCE_STRONG):
        return "influence", {"influence": 99}
    scores = {}
    for cat, terms in CATEGORY_TERMS.items():
        scores[cat] = 2 * _count(title, terms) + _count(text[:1500], terms)
    best = max(scores, key=lambda c: scores[c])
    return (best if scores[best] > 0 else "other"), scores


def detect_level(title: str, text: str) -> tuple[float, str]:
    full = title + " " + text[:2000]
    for level, terms in LEVEL_TERMS:
        hit = next((t for t in terms if t in full), None)
        if hit:
            # 标题命中视为主体事件；仅正文命中（如背景介绍里的“院士”）打折
            return (level if hit in title else level * 0.75), hit
    return 0.2, ""
