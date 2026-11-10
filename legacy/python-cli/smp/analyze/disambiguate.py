"""委员人物消歧：判断报道中的“某某”是否就是名单里的这位委员。

流程：
1. 姓名识别：名单姓名 + 画像别名（英文名等）按长度降序匹配，长名优先占位
   （避免“张伟男”被识别成“张伟”、“李斌阳”被识别成“李斌”）；
   两字姓名做右边界校验（“王博士”≠“王博”，“李生物”≠“李生”）。
2. 证据打分（0~1）：单位邻近/共现、学术语境、研究方向关键词、可信域名、
   查询来源、专委会语境；同名者特征词、邻近其他单位、常见名等为负证据。
3. 名单内重名（如两位“王博”、两位“刘洋”、两位“李倩”）按证据择优，分不开则标记复核。
4. 介于阈值之间的交给 DeepSeek 裁决（可关），仍无法确定则进入人工复核清单。
5. 人工复核结论写入 data/overrides.yaml，之后各期自动生效。
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from ..config import Settings
from ..llm import DeepSeek, LLMError
from ..models import Member, Mention, NewsItem
from ..profiles import ProfileStore
from ..textutil import is_cjk

log = logging.getLogger(__name__)

# 两字姓名后允许紧跟的词（右边界合法）
OK_FOLLOW = (
    "教授", "研究员", "老师", "博士", "院士", "副", "团队", "课题组", "等", "和", "与", "及", "的", "在", "是", "为",
    "表示", "指出", "认为", "介绍", "应邀", "获", "荣获", "当选", "担任", "出任", "带领", "作", "做", "发表", "主持",
    "出席", "参加", "同志", "先生", "女士", "院长", "主任", "校长", "书记", "所长", "主席", "委员", "说", "也", "将",
    "于", "被", "以", "从", "还", "首席", "讲席", "特聘", "长聘", "博导", "获得", "入选", "一行", "率", "牵头", "领衔",
    "指导", "合作", "共同", "分享", "解读", "撰文", "提出", "实验室", "组", "就", "向", "对", "给", "作为", "已", "曾",
    "现任", "任", "受邀", "致辞", "演讲", "报告", "讲座", "团", "课题", "副教授", "讲师", "研究", "领导", "老", "等人",
)


def contains(text: str, term: str) -> bool:
    """英文词（如 HIT、PKU）按整词、区分大小写匹配；中文按子串匹配。"""
    if not term:
        return False
    if term.isascii():
        return re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", text) is not None
    return term in text


@dataclass
class Occurrence:
    member_ids: list[str]
    variant: str
    start: int
    end: int
    boundary_ok: bool


class MemberIndex:
    def __init__(self, members: list[Member], profiles: ProfileStore):
        self.members = {m.id: m for m in members if m.status == "active"}
        self.profiles = profiles
        variants: dict[str, list[str]] = {}
        for mid in self.members:
            for v in profiles.name_variants(mid) or [self.members[mid].name]:
                variants.setdefault(v, []).append(mid)
        self.variants = sorted(variants.items(), key=lambda kv: -len(kv[0]))
        self.org_names = {mid: profiles.org_names(mid) for mid in self.members}
        all_orgs = set(profiles.orgs.all_names())
        for names in self.org_names.values():
            all_orgs.update(n for n in names if not n.isascii() and len(n) >= 2)
        self.all_orgs = sorted(all_orgs, key=len, reverse=True)

    def find(self, text: str) -> list[Occurrence]:
        taken = [False] * len(text)
        out: list[Occurrence] = []
        lower = text.lower()
        for variant, mids in self.variants:
            if variant.isascii():
                for m in re.finditer(r"(?<![A-Za-z])" + re.escape(variant.lower()) + r"(?![A-Za-z])", lower):
                    s, e = m.span()
                    if any(taken[s:e]):
                        continue
                    taken[s:e] = [True] * (e - s)
                    out.append(Occurrence(mids, variant, s, e, True))
                continue
            start = 0
            while (i := text.find(variant, start)) != -1:
                e = i + len(variant)
                start = i + 1
                if any(taken[i:e]):
                    continue
                ok = self._boundary_ok(text, i, e, variant)
                if ok:
                    taken[i:e] = [True] * (e - i)
                out.append(Occurrence(mids, variant, i, e, ok))
        return out

    @staticmethod
    def _boundary_ok(text: str, s: int, e: int, name: str) -> bool:
        if len(name) >= 3:
            return True
        if e >= len(text) or not is_cjk(text[e]):
            return True
        return text.startswith(OK_FOLLOW, e)


class Disambiguator:
    def __init__(self, settings: Settings, index: MemberIndex, overrides: dict | None = None):
        self.s = settings
        self.idx = index
        cfg = settings.get("disambiguation", {})
        self.window = cfg.get("context_window", 60)
        self.hi = cfg.get("confirm_threshold", 0.6)
        self.lo = cfg.get("reject_threshold", 0.4)
        self.academic = cfg.get("academic_terms", [])
        self.negative = cfg.get("negative_terms", [])
        self.smp_terms = cfg.get("smp_terms", [])
        self.use_llm = cfg.get("use_llm_for_ambiguous", True)
        self.llm_budget = cfg.get("llm_max_calls", 300)
        self.ds = DeepSeek(settings) if self.use_llm else None
        self.overrides = {}
        for o in (overrides or {}).get("mentions", []) or []:
            self.overrides[(o.get("url", ""), o.get("member_id"))] = o.get("decision")

    # ---------- 单个候选打分 ----------
    def score(self, item: NewsItem, text: str, mid: str, occs: list[Occurrence]) -> tuple[float, list[str]]:
        prof = self.idx.profiles.get(mid)
        ev: list[str] = []
        conf = 0.30
        for pat in prof.get("exclude_url_patterns") or []:
            if pat and pat in item.url:
                return 0.0, [f"命中排除链接规则:{pat}"]
        windows = [text[max(0, o.start - self.window): o.end + self.window] for o in occs]
        near = " ".join(windows)
        orgs = self.idx.org_names.get(mid, [])
        org_near = next((o for o in orgs if contains(near, o)), None)
        if org_near:
            conf += 0.35
            ev.append(f"单位邻近:{org_near}")
        elif (org_any := next((o for o in orgs if contains(text, o)), None)):
            conf += 0.20
            ev.append(f"单位共现:{org_any}")
        else:
            tight = " ".join(text[max(0, o.start - 20): o.end + 20] for o in occs)
            other = next((o for o in self.idx.all_orgs if o in tight and o not in orgs), None)
            if other:
                conf -= 0.15
                ev.append(f"邻近其他单位:{other}")
        if any(t in near for t in self.academic):
            conf += 0.10
            ev.append("学术语境")
        kws = [k for k in (prof.get("keywords") or []) + (prof.get("research_areas") or []) if k]
        hits = [k for k in kws if k in text]
        if hits:
            conf += min(0.20, 0.05 * len(hits))
            ev.append("研究方向:" + "、".join(hits[:4]))
        if any(d and d in item.domain for d in prof.get("trusted_domains") or []):
            conf += 0.30
            ev.append("可信域名")
        neg = [t for t in self.negative + list(prof.get("negative_keywords") or []) if t and t in near]
        if neg:
            conf -= 0.35
            ev.append("同名者特征:" + "、".join(neg[:3]))
        if mid in item.query_member_ids:
            conf += 0.10
            ev.append("查询来源")
        if any(t in text for t in self.smp_terms):
            conf += 0.10
            ev.append("专委会语境")
        if any(o.start < len(item.title) for o in occs):
            conf += 0.05
            ev.append("标题提及")
        auto = prof.get("auto") or {}
        if auto.get("common_name"):
            conf -= 0.10
            ev.append("常见姓名")
        return max(0.0, min(1.0, conf)), ev

    def _status(self, c: float) -> str:
        return "confirmed" if c >= self.hi else ("rejected" if c < self.lo else "ambiguous")

    # ---------- LLM 裁决 ----------
    def _llm(self, item: NewsItem, text: str, mid: str, occs: list[Occurrence]) -> tuple[str, float, str] | None:
        if not (self.ds and self.ds.available) or self.llm_budget <= 0:
            return None
        self.llm_budget -= 1
        p = self.idx.profiles.get(mid)
        snippet = " …… ".join(text[max(0, o.start - 150): o.end + 150] for o in occs[:3])
        profile = {k: p.get(k) for k in ("name", "org", "roles", "title", "research_areas", "keywords", "aliases") if p.get(k)}
        system = ("你是学术人物消歧助手。判断新闻中提到的人是否为给定档案中的学者本人。"
                  "只依据文本证据，不要臆测。输出 JSON：{\"same_person\": \"yes|no|unsure\", \"confidence\": 0~1, \"reason\": \"一句话\"}")
        user = f"人物档案：{profile}\n\n新闻标题：{item.title}\n新闻片段：{snippet[:1200]}"
        try:
            r = self.ds.chat_json(system, user)
            return str(r.get("same_person", "unsure")), float(r.get("confidence", 0.5)), str(r.get("reason", ""))
        except (LLMError, ValueError, TypeError, AttributeError) as e:
            log.warning("LLM 消歧失败：%s", e)
            return None

    # ---------- 主流程 ----------
    def run(self, item: NewsItem) -> list[Mention]:
        text = item.title + "\n" + item.text
        occs = self.idx.find(text)
        by_member: dict[str, list[Occurrence]] = {}
        for o in occs:
            if not o.boundary_ok:
                continue
            for mid in o.member_ids:
                by_member.setdefault(mid, []).append(o)
        mentions: list[Mention] = []
        for mid, mo in by_member.items():
            conf, ev = self.score(item, text, mid, mo)
            mentions.append(Mention(member_id=mid, name=self.idx.members[mid].name, confidence=round(conf, 3),
                                    status=self._status(conf), evidence=ev))
        self._resolve_homonyms(mentions)
        for m in mentions:
            if m.status == "ambiguous":
                res = self._llm(item, text, m.member_id, by_member[m.member_id])
                if res:
                    verdict, c, reason = res
                    if verdict == "yes":
                        m.confidence = round(max(m.confidence, 0.5 + 0.5 * c), 3)
                    elif verdict == "no":
                        m.confidence = round(min(m.confidence, 0.5 - 0.5 * c), 3)
                    m.status = self._status(m.confidence)
                    m.method = "rules+llm"
                    m.evidence.append(f"LLM:{verdict}({c:.2f}) {reason}"[:120])
            decision = self.overrides.get((item.url, m.member_id)) or self.overrides.get((item.canonical_url, m.member_id))
            if decision in ("confirm", "reject"):
                m.status = "confirmed" if decision == "confirm" else "rejected"
                m.confidence = 1.0 if decision == "confirm" else 0.0
                m.method = "manual"
        return mentions

    @staticmethod
    def _resolve_homonyms(mentions: list[Mention]) -> None:
        groups: dict[str, list[Mention]] = {}
        for m in mentions:
            groups.setdefault(m.name, []).append(m)
        for name, ms in groups.items():
            if len(ms) < 2:
                continue
            ms.sort(key=lambda x: -x.confidence)
            best, second = ms[0], ms[1]
            if best.confidence - second.confidence >= 0.15:
                for m in ms[1:]:
                    m.status = "rejected"
                    m.evidence.append(f"名单内重名，判归 {best.member_id}")
            else:
                for m in ms:
                    if m.status != "rejected":
                        m.status = "ambiguous"
                    m.evidence.append("名单内重名且证据不足以区分")
