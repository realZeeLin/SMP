"""流程编排：采集 → 分析 → 成稿 → 发布归档，以及人工复核回写。

每期一个目录 runs/<kind>-<label>/，各阶段产物：
  period.jsonl        统计窗口
  raw.jsonl           采集原始结果
  queries.jsonl       查询日志
  items.jsonl         清洗 + 消歧后的报道（含每位候选委员的置信度与证据）
  filtered.jsonl      被过滤的条目及原因（无委员 / 非学术 / 窗口外 …）
  events.jsonl        去重聚类后的全部候选事件（含打分明细、是否入选）
  analysis_report.json
  issue.json / draft.md / draft_wechat.html / review.csv
"""
from __future__ import annotations

import csv
import json
import logging
from datetime import date
from pathlib import Path

import yaml

from .analyze.classify import AcademicFilter, classify, detect_level
from .analyze.dedup import build_events, cluster, mark_history
from .analyze.disambiguate import Disambiguator, MemberIndex
from .analyze.normalize import normalize
from .analyze.scoring import Scorer
from .analyze.select import select
from .collect import Period
from .compose.writer import build_issue, render, write_review_sheet
from .config import Settings
from .models import Event, NewsItem
from .profiles import OrgDirectory, ProfileStore
from .roster import Roster
from .textutil import append_jsonl, read_jsonl, write_jsonl

log = logging.getLogger(__name__)


class Workspace:
    def __init__(self, settings: Settings):
        self.s = settings
        self.roster = Roster(settings.path("roster"), settings.path("roster_history"))
        self.orgs = OrgDirectory(settings.path("org_aliases"))
        self.profiles = ProfileStore(settings.path("profiles"), self.orgs,
                                     settings.get("disambiguation.common_surnames", []))

    @property
    def overrides_path(self) -> Path:
        return self.s.path("overrides") if self.s.get("paths.overrides") else self.s.root / "data" / "overrides.yaml"

    def overrides(self) -> dict:
        p = self.overrides_path
        return (yaml.safe_load(p.read_text(encoding="utf-8")) or {}) if p.exists() else {}

    def save_overrides(self, data: dict) -> None:
        self.overrides_path.parent.mkdir(parents=True, exist_ok=True)
        self.overrides_path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")

    def member_info(self) -> dict[str, dict]:
        return {m.id: {"id": m.id, "name": m.name, "org": m.org, "roles": m.roles} for m in self.roster.members}

    def run_dir(self, period: Period) -> Path:
        return self.s.path("runs") / period.run_name

    def archive_path(self) -> Path:
        return self.s.path("archive") / "events.jsonl"


def load_period(run_dir: Path) -> Period:
    meta = next(iter(read_jsonl(run_dir / "period.jsonl")))
    return Period(meta["kind"], date.fromisoformat(meta["start"]), date.fromisoformat(meta["end"]))


def _context(item: NewsItem, window: int = 80) -> str:
    text = item.title + "\n" + item.text
    if item.is_org_news:
        return text[:800]
    parts = []
    for m in item.mentions:
        if m.status == "rejected":
            continue
        i = text.find(m.name)
        while i != -1 and len(parts) < 6:
            parts.append(text[max(0, i - window): i + len(m.name) + window])
            i = text.find(m.name, i + 1)
    return " ".join(parts) or text[:300]


def analyze(ws: Workspace, run_dir: Path) -> dict:
    s = ws.s
    period = load_period(run_dir)
    raw = list(read_jsonl(run_dir / "raw.jsonl"))
    items, nstats = normalize(raw, period, s.get("collect.org_news_terms", []),
                              s.get("collect.date_tolerance_days", 3), s.get("collect.keep_undated", True))
    report: dict = {"period": period.to_dict(), "normalize": nstats}

    # 1) 人物消歧
    index = MemberIndex(ws.roster.active, ws.profiles)
    overrides = ws.overrides()
    dis = Disambiguator(s, index, overrides)
    kept, filtered = [], []
    mstat = {"confirmed": 0, "ambiguous": 0, "rejected": 0}
    for it in items:
        it.mentions = dis.run(it)
        for m in it.mentions:
            mstat[m.status] += 1
        if it.is_org_news or any(m.status != "rejected" for m in it.mentions):
            kept.append(it)
        else:
            filtered.append({"item_id": it.item_id, "title": it.title, "url": it.url, "reason": "未匹配到委员或人物被否定",
                             "mentions": [m.model_dump() for m in it.mentions]})
    report["disambiguation"] = mstat

    # 2) 学术相关性过滤 + 分类
    af = AcademicFilter(s)
    meta: dict[str, dict] = {}
    academic: list[NewsItem] = []
    for it in kept:
        ok, why = af.check(it.title, _context(it))
        if not ok:
            filtered.append({"item_id": it.item_id, "title": it.title, "url": it.url, "reason": why})
            continue
        cat, cat_scores = classify(it.title, _context(it, 150), it.is_org_news)
        level, hit = detect_level(it.title, _context(it, 150))
        meta[it.item_id] = {"category": cat, "level": level, "level_hit": hit, "cat_scores": cat_scores}
        academic.append(it)
    report["academic_filter"] = {"kept": len(academic), "dropped": len(kept) - len(academic)}

    # 3) 去重聚类 + 跨期比对
    scorer = Scorer(s, {m.id: m.roles for m in ws.roster.members})
    groups = cluster(academic, meta, s.get("dedup", {}))
    events = build_events(academic, groups, meta, scorer.authority, s.get("disambiguation.confirm_threshold", 0.6))
    # 跨期去重只与同类刊期比较：月报是当月汇总，应允许收录已在周报出现过的事件
    archive = [a for a in read_jsonl(ws.archive_path()) if str(a.get("issue", "")).startswith(period.kind)]
    prev = mark_history(events, archive, period.start, s.get("dedup.history_days", 90))
    report["dedup"] = {"items": len(academic), "events": len(events), "previously_published": prev}

    # 4) 打分 + 摘选
    for ev in events:
        scorer.score(ev, period.start, period.end)
    manual = {}
    for o in overrides.get("events", []) or []:
        for k in (o.get("event_id"), o.get("url")):
            if k:
                manual[k] = o.get("decision")
    chosen, sel_report = select(events, s.get(f"selection.{period.kind}", {}), s.get("selection", {}), manual)
    report["selection"] = sel_report
    report["categories"] = {c: sum(1 for e in chosen if e.category == c) for c in {e.category for e in chosen}}
    report["needs_review"] = sum(1 for e in chosen if e.needs_review)

    write_jsonl(run_dir / "items.jsonl", (it.model_dump(mode="json") for it in items))
    write_jsonl(run_dir / "filtered.jsonl", filtered)
    write_jsonl(run_dir / "events.jsonl", (e.model_dump(mode="json") for e in sorted(events, key=lambda e: -e.score)))
    (run_dir / "analysis_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def load_events(run_dir: Path) -> list[Event]:
    return [Event(**r) for r in read_jsonl(run_dir / "events.jsonl")]


def compose(ws: Workspace, run_dir: Path, use_llm: bool | None = None) -> dict:
    period = load_period(run_dir)
    events = load_events(run_dir)
    chosen = [e for e in events if e.selected]
    info = ws.member_info()
    issue = build_issue(ws.s, period, chosen, info, use_llm)
    # 回写改写后的标题/摘要与最终序号
    by_id = {e.event_id: e for e in chosen}
    for e in events:
        if e.event_id in by_id:
            e.headline, e.blurb, e.rank = by_id[e.event_id].headline, by_id[e.event_id].blurb, by_id[e.event_id].rank
    write_jsonl(run_dir / "events.jsonl", (e.model_dump(mode="json") for e in events))
    (run_dir / "issue.json").write_text(json.dumps(issue, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    files = render(issue, run_dir)
    write_review_sheet(events, run_dir / "review.csv", info)
    return {"count": issue["count"], "files": [str(p) for p in files.values()] + [str(run_dir / "review.csv")]}


def publish(ws: Workspace, run_dir: Path) -> int:
    """定稿发布后执行：写入归档，用于跨期去重与委员画像活动时间线。"""
    period = load_period(run_dir)
    chosen = [e for e in load_events(run_dir) if e.selected]
    existing = {r.get("event_id") + r.get("issue", "") for r in read_jsonl(ws.archive_path())}
    rows = []
    for e in chosen:
        if e.event_id + period.run_name in existing:
            continue
        rows.append({"event_id": e.event_id, "issue": period.run_name, "issue_date": period.end.isoformat(),
                     "published": e.published.isoformat() if e.published else None, "category": e.category,
                     "title": e.title, "headline": e.headline, "member_ids": e.member_ids,
                     "urls": [s["url"] for s in e.sources], "score": e.score})
    append_jsonl(ws.archive_path(), rows)
    return len(rows)


def apply_review(ws: Workspace, csv_path: Path) -> dict:
    """读取编辑填写的 review.csv：decision 列支持
       keep          强制入选
       drop          不入选
       wrong_person  人物识别错误（对该链接的这些委员记为否定，今后不再匹配）
       confirm       人物确认无误（今后该链接直接确认）
    """
    data = ws.overrides()
    data.setdefault("events", [])
    data.setdefault("mentions", [])
    today = date.today().isoformat()
    n = {"keep": 0, "drop": 0, "wrong_person": 0, "confirm": 0}
    # 同一事件的所有转载链接一并处理
    ev_path = csv_path.parent / "events.jsonl"
    sources = {r["event_id"]: [x["url"] for x in r.get("sources", [])] for r in read_jsonl(ev_path)} if ev_path.exists() else {}
    with csv_path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            d = (row.get("decision") or "").strip().lower()
            if d not in n:
                continue
            n[d] += 1
            if d in ("keep", "drop"):
                data["events"] = [o for o in data["events"] if o.get("event_id") != row["event_id"]]
                data["events"].append({"event_id": row["event_id"], "url": row["url"], "decision": d, "date": today})
            else:
                urls = sources.get(row["event_id"]) or [row["url"]]
                for mid in filter(None, (row.get("member_ids") or "").split(";")):
                    for url in urls:
                        data["mentions"] = [o for o in data["mentions"] if not (o.get("url") == url and o.get("member_id") == mid)]
                        data["mentions"].append({"url": url, "member_id": mid,
                                                 "decision": "reject" if d == "wrong_person" else "confirm", "date": today})
    ws.save_overrides(data)
    return n


def member_activity(ws: Workspace, member_id: str, limit: int = 20) -> list[dict]:
    rows = [r for r in read_jsonl(ws.archive_path()) if member_id in r.get("member_ids", [])]
    rows.sort(key=lambda r: r.get("published") or r.get("issue_date") or "", reverse=True)
    return rows[:limit]
