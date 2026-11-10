"""新闻动态去重：同文转载合并 → 同一事件聚类 → 与历史已发布内容比对。

三层去重：
1. 文档级：规范化 URL 相同（清洗阶段已合并）；正文 3-gram Jaccard ≥ 阈值或标题高度相似 → 转载/洗稿；
2. 事件级：同一委员 + 同一栏目 + 日期相近 + （标题相似 或 命中同一关键荣誉/会议词）→ 同一件事的多家报道；
3. 跨期：与过去 N 天已发布事件比对（URL 或 委员+栏目+标题相似），避免周报/月报重复上稿。
为控制计算量，只在“共享至少一位委员”（或同为专委会新闻）的分块内两两比较。
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from itertools import combinations

from ..models import Event, NewsItem
from ..textutil import canonical_url, jaccard, shingles, stable_hash


class UnionFind:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def title_sim(a: str, b: str) -> float:
    return jaccard(shingles(a, 2), shingles(b, 2))


def _member_set(it: NewsItem) -> set[str]:
    return {m.member_id for m in it.mentions if m.status in ("confirmed", "ambiguous")}


def cluster(items: list[NewsItem], meta: dict[str, dict], cfg: dict) -> list[list[int]]:
    """meta[item_id] = {category, level_hit}；返回聚类后的下标分组。"""
    k = cfg.get("shingle_size", 3)
    near = cfg.get("near_dup_jaccard", 0.6)
    tsim = cfg.get("title_sim", 0.72)
    esim = cfg.get("event_title_sim", 0.3)
    window = cfg.get("event_window_days", 7)
    sh = [shingles(it.title + it.text[:600], k) for it in items]
    uf = UnionFind(len(items))
    blocks: dict[str, list[int]] = defaultdict(list)
    for i, it in enumerate(items):
        for mid in _member_set(it):
            blocks[mid].append(i)
        if it.is_org_news:
            blocks["__org__"].append(i)
    compared: set[tuple[int, int]] = set()
    for idxs in blocks.values():
        for i, j in combinations(idxs, 2):
            if (i, j) in compared:
                continue
            compared.add((i, j))
            a, b = items[i], items[j]
            ts = title_sim(a.title, b.title)
            if ts >= tsim or jaccard(sh[i], sh[j]) >= near:
                uf.union(i, j)
                continue
            ma, mb = meta[a.item_id], meta[b.item_id]
            if ma["category"] != mb["category"]:
                continue
            if a.published and b.published and abs((a.published - b.published).days) > window:
                continue
            same_key = ma.get("level_hit") and ma.get("level_hit") == mb.get("level_hit") and ma["category"] in ("honor", "service")
            if ts >= esim or same_key:
                uf.union(i, j)
    groups: dict[int, list[int]] = defaultdict(list)
    for i in range(len(items)):
        groups[uf.find(i)].append(i)
    return list(groups.values())


def build_events(items: list[NewsItem], groups: list[list[int]], meta: dict[str, dict],
                 authority, confirm_threshold: float) -> list[Event]:
    events = []
    for g in groups:
        its = [items[i] for i in g]
        its.sort(key=lambda it: (authority(it.domain), len(it.text)), reverse=True)
        rep = its[0]
        best: dict[str, tuple[float, str, str]] = {}
        for it in its:
            for m in it.mentions:
                if m.status == "rejected":
                    continue
                if m.member_id not in best or m.confidence > best[m.member_id][0]:
                    best[m.member_id] = (m.confidence, m.name, m.status)
        mids = sorted(best, key=lambda x: -best[x][0])
        conf = max((best[x][0] for x in mids), default=1.0 if rep.is_org_news else 0.0)
        notes = []
        amb = [best[x][1] for x in mids if best[x][2] == "ambiguous"]
        if amb:
            notes.append("人物待确认:" + "、".join(amb))
        dates = [it.published for it in its if it.published]
        cat = meta[rep.item_id]["category"]
        events.append(Event(
            event_id=stable_hash(*sorted(it.canonical_url for it in its)),
            title=rep.title, url=rep.url, site=rep.site, published=min(dates) if dates else None,
            category=cat, level=meta[rep.item_id]["level"],
            member_ids=mids, member_names=[best[x][1] for x in mids],
            confidence=round(conf, 3), needs_review=bool(amb) or (conf < confirm_threshold and not rep.is_org_news),
            review_notes=notes, is_org_news=any(it.is_org_news for it in its),
            sources=[{"title": it.title, "url": it.url, "site": it.site,
                      "published": it.published.isoformat() if it.published else None} for it in its],
            item_ids=[it.item_id for it in its], text=rep.text[:3000],
        ))
    return events


def mark_history(events: list[Event], archive: list[dict], period_start: date, days: int) -> int:
    cutoff = period_start - timedelta(days=days)
    recent = [a for a in archive if (a.get("published") or a.get("issue_date") or "9999") >= cutoff.isoformat()]
    urls = {canonical_url(u) for a in recent for u in a.get("urls", [])}
    n = 0
    for ev in events:
        ev_urls = {canonical_url(s["url"]) for s in ev.sources}
        hit = bool(ev_urls & urls)
        if not hit:
            for a in recent:
                if a.get("category") == ev.category and set(a.get("member_ids", [])) & set(ev.member_ids) \
                        and title_sim(a.get("title", ""), ev.title) >= 0.5:
                    hit = True
                    break
        if hit:
            ev.previously_published = True
            n += 1
    return n

