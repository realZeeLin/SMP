"""排序摘选：从候选事件中选出 min_items~max_items 条（默认 30~50）。

策略（贪心 + 多样性）：
- 先排除：人工标记 drop、跨期已发布、无委员且非专委会新闻；
- 人工标记 keep 的条目强制入选；专委会自身动态优先；
- 其余按“调整后分数”贪心选取：同一委员第 n 条按 diversity_decay^(n-1) 衰减，
  超过每人上限不选；某栏目超过占比上限不选；
- 分数 ≥ min_score 的选满为止（不超过 max_items）；不足 min_items 时逐步放宽到 floor_score；
- 待复核（人物不确定）条目可入选，但在复核清单中高亮。
"""
from __future__ import annotations

import math
from collections import Counter

from ..models import Event


def select(events: list[Event], cfg: dict, global_cfg: dict, manual: dict[str, str] | None = None) -> tuple[list[Event], dict]:
    manual = manual or {}
    min_items = cfg.get("min_items", 30)
    max_items = cfg.get("max_items", 50)
    min_score = cfg.get("min_score", 25)
    per_member = cfg.get("per_member_cap", 2)
    floor = global_cfg.get("floor_score", 12)
    caps = global_cfg.get("category_caps", {}) or {}
    decay = global_cfg.get("diversity_decay", 0.75)

    report = Counter()
    pool = []
    for ev in events:
        d = manual.get(ev.event_id) or next((manual[s["url"]] for s in ev.sources if s["url"] in manual), None)
        if d == "drop":
            report["manual_drop"] += 1
            continue
        if d == "keep":
            ev.selected = True
            pool.append(ev)
            continue
        if ev.previously_published:
            report["previously_published"] += 1
            continue
        if not ev.member_ids and not ev.is_org_news:
            report["no_member"] += 1
            continue
        pool.append(ev)

    chosen: list[Event] = [e for e in pool if e.selected]
    member_count = Counter(m for e in chosen for m in e.member_ids)
    cat_count = Counter(e.category for e in chosen)
    rest = sorted([e for e in pool if not e.selected], key=lambda e: (-e.is_org_news, -e.score))

    def adjusted(e: Event) -> float:
        if not e.member_ids:
            return e.score
        n = max(member_count[m] for m in e.member_ids)
        return e.score * (decay ** n)

    def cat_ok(e: Event) -> bool:
        cap = caps.get(e.category)
        return cap is None or cat_count[e.category] + 1 <= math.ceil(cap * max_items)

    threshold = min_score
    while True:
        progressed = True
        while progressed and len(chosen) < max_items:
            progressed = False
            cands = [e for e in rest if not e.selected and (e.is_org_news or adjusted(e) >= threshold)
                     and all(member_count[m] < per_member for m in e.member_ids) and cat_ok(e)]
            if not cands:
                break
            best = max(cands, key=lambda e: (e.is_org_news, adjusted(e)))
            best.selected = True
            chosen.append(best)
            member_count.update(best.member_ids)
            cat_count[best.category] += 1
            progressed = True
        if len(chosen) >= min_items or threshold <= floor:
            break
        threshold = max(floor, threshold - 5)
    report["threshold_used"] = threshold
    if len(chosen) < min_items:
        report["shortfall"] = min_items - len(chosen)

    chosen.sort(key=lambda e: (-e.is_org_news, -e.score))
    for i, e in enumerate(chosen, 1):
        e.rank = i
    report["selected"] = len(chosen)
    report["candidates"] = len(pool)
    return chosen, dict(report)
