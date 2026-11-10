"""重要性打分（0~100），每项得分都记录在 score_detail 中，便于编辑理解与调参。

score = 100 × Σ wᵢ·fᵢ × 置信度系数 × 惩罚系数 + 加分
  f_type      栏目基础权重（荣誉/专委会 > 成果 > 项目 > 任职服务 > 影响力 > 活动）
  f_level     级别（院士/Fellow/国家级/最佳论文 … ）
  f_role      委员在专委会中的身份（取事件中最高者）
  f_authority 信源权威度（政府/学会/高校官网 > 主流媒体 > 门户 > 自媒体）
  f_coverage  报道覆盖度（不同来源数，对数）
  f_relevance 与社会媒体处理/NLP/计算社会科学领域的相关性
  f_recency   在统计窗口内越新越高
"""
from __future__ import annotations

import math
from datetime import date

from ..config import Settings
from ..models import Event

TYPE_WEIGHTS = {"org": 1.0, "honor": 1.0, "research": 0.8, "project": 0.75, "service": 0.65,
                "influence": 0.6, "activity": 0.5, "other": 0.3}


class Authority:
    def __init__(self, table: dict[str, float]):
        self.default = table.get("default", 0.45)
        self.table = sorted(((k, v) for k, v in table.items() if k != "default"), key=lambda kv: -len(kv[0]))

    def __call__(self, domain: str) -> float:
        domain = (domain or "").lower()
        for suffix, v in self.table:
            if domain == suffix or domain.endswith("." + suffix):
                return v
        return self.default


class Scorer:
    def __init__(self, settings: Settings, roles_of: dict[str, list[str]]):
        cfg = settings.get("scoring", {})
        self.w = cfg.get("weights", {})
        self.role_w = cfg.get("role_weights", {})
        self.authority = Authority(cfg.get("source_authority", {}))
        self.relevance_terms = cfg.get("relevance_terms", [])
        self.prev_factor = cfg.get("previously_published_factor", 0.3)
        self.undated_factor = cfg.get("undated_factor", 0.8)
        self.org_bonus = cfg.get("org_news_bonus", 15)
        self.roles_of = roles_of

    def score(self, ev: Event, period_start: date, period_end: date) -> float:
        f = {}
        f["type"] = TYPE_WEIGHTS.get(ev.category, 0.3)
        f["level"] = ev.level
        f["role"] = max((self.role_w.get(r, 0.5) for mid in ev.member_ids for r in self.roles_of.get(mid, [])), default=0.5)
        f["authority"] = max(self.authority(_domain(s["url"])) for s in ev.sources) if ev.sources else self.authority.default
        n_sites = len({_domain(s["url"]) for s in ev.sources})
        f["coverage"] = min(1.0, math.log2(1 + n_sites) / math.log2(6))
        text = ev.title + " " + ev.text[:2000]
        hits = sum(1 for t in self.relevance_terms if t in text)
        f["relevance"] = min(1.0, hits / 3)
        if ev.published:
            span = max(1, (period_end - period_start).days)
            f["recency"] = max(0.0, min(1.0, 0.5 + 0.5 * (ev.published - period_start).days / span))
        else:
            f["recency"] = 0.3
        base = sum(self.w.get(k, 0) * v for k, v in f.items())
        conf_factor = 0.6 + 0.4 * (ev.confidence if not ev.is_org_news else 1.0)
        factor = conf_factor
        if ev.previously_published:
            factor *= self.prev_factor
        if not ev.published:
            factor *= self.undated_factor
        bonus = self.org_bonus if ev.is_org_news else 0
        total = round(min(100.0, 100 * base * factor + bonus), 1)
        ev.score = total
        ev.score_detail = {**{k: round(v, 3) for k, v in f.items()}, "conf_factor": round(conf_factor, 3),
                           "factor": round(factor, 3), "bonus": bonus}
        return total


def _domain(url: str) -> str:
    from ..textutil import domain_of
    return domain_of(url)
