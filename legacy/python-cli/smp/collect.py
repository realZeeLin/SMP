"""阶段一：数据采集。

- `Period`：周报/月报统计窗口；
- `plan_queries`：按委员（分层）+ 专委会组织生成查询计划；
- Provider：`deepseek`（DeepSeek 开放搜索）、`jsonl`（导入人工报送/其它爬虫结果）；
- 月报默认复用当月各期周报的原始数据，再补充搜索。
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from .config import Settings
from .llm import DeepSeek, LLMError
from .models import Member
from .profiles import OrgDirectory, ProfileStore
from .textutil import month_range, read_jsonl, stable_hash, week_range, write_jsonl

log = logging.getLogger(__name__)


@dataclass
class Period:
    kind: str          # weekly | monthly
    start: date
    end: date

    @classmethod
    def resolve(cls, kind: str, ref: date | None = None, previous: bool = True) -> "Period":
        """默认取 ref（今天）之前最近一个完整周期。"""
        ref = ref or date.today()
        if kind == "weekly":
            s, e = week_range(ref)
            if previous and e >= ref:
                s, e = week_range(s - timedelta(days=1))
        elif kind == "monthly":
            s, e = month_range(ref)
            if previous and e >= ref:
                s, e = month_range(s - timedelta(days=1))
        else:
            raise ValueError(kind)
        return cls(kind, s, e)

    @property
    def label(self) -> str:
        if self.kind == "weekly":
            y, w, _ = self.start.isocalendar()
            return f"{y}-W{w:02d}"
        return f"{self.start.year}-{self.start.month:02d}"

    @property
    def run_name(self) -> str:
        return f"{self.kind}-{self.label}"

    def contains(self, d: date | None, tolerance_days: int = 0) -> bool:
        if d is None:
            return False
        return self.start - timedelta(days=tolerance_days) <= d <= self.end

    def to_dict(self) -> dict:
        return {"kind": self.kind, "start": self.start.isoformat(), "end": self.end.isoformat(), "label": self.label}


@dataclass
class Query:
    text: str
    member_id: str | None = None
    kind: str = "member"   # member | org


def plan_queries(settings: Settings, members: list[Member], orgs: OrgDirectory, period: Period,
                 only: set[str] | None = None) -> list[Query]:
    cfg = settings.get("collect", {})
    templates = cfg.get("member_queries") or ["{name} {org}"]
    core_roles = set((cfg.get("tiers") or {}).get("core_roles") or [])
    n_core = (cfg.get("tiers") or {}).get("core_query_count", len(templates))
    n_default = (cfg.get("tiers") or {}).get("default_query_count", 1)
    out: list[Query] = []
    for m in members:
        if m.status != "active" or (only and m.id not in only):
            continue
        n = n_core if core_roles & set(m.roles) else n_default
        for t in templates[:n]:
            q = t.format(name=m.name, org=m.org, org_short=orgs.short(m.org), year=period.start.year)
            out.append(Query(q, m.id, "member"))
    if not only:
        for t in cfg.get("org_queries") or []:
            out.append(Query(t.format(year=period.start.year), None, "org"))
    # 去重
    seen, uniq = set(), []
    for q in out:
        if (q.text, q.member_id) not in seen:
            seen.add((q.text, q.member_id))
            uniq.append(q)
    return uniq


def _time_extra(settings: Settings, period: Period) -> dict:
    tpl = settings.get("deepseek.search.time_range_body") or {}
    tol = settings.get("collect.date_tolerance_days", 3)
    start = (period.start - timedelta(days=tol)).isoformat()
    return {k: (v.format(start=start, end=period.end.isoformat()) if isinstance(v, str) else v) for k, v in tpl.items()}


def collect_deepseek(settings: Settings, queries: list[Query], period: Period) -> tuple[list[dict], list[dict]]:
    ds = DeepSeek(settings)
    if not ds.available:
        raise LLMError("collect.provider=deepseek 需要配置 DEEPSEEK_API_KEY（或改用 --provider jsonl 导入数据）")
    extra = _time_extra(settings, period)
    now = datetime.now().isoformat(timespec="seconds")
    rows, qlog = [], []

    def run(q: Query):
        return q, ds.search(q.text, extra=extra)

    with ThreadPoolExecutor(max_workers=settings.get("collect.concurrency", 4)) as pool:
        futures = [pool.submit(run, q) for q in queries]
        for fut in as_completed(futures):
            try:
                q, results = fut.result()
            except LLMError as e:
                log.warning("搜索失败：%s", e)
                qlog.append({"error": str(e)})
                continue
            qlog.append({"query": q.text, "member_id": q.member_id, "kind": q.kind, "n": len(results)})
            for r in results:
                rows.append({
                    "raw_id": stable_hash(r.get("url", ""), r.get("title", ""), q.text),
                    "title": r.get("title", ""), "url": r.get("url", ""),
                    "snippet": r.get("snippet", ""), "content": r.get("content", ""),
                    "site": r.get("site", ""), "published": str(r.get("published") or "") or None,
                    "query": q.text, "query_member_id": q.member_id,
                    "provider": "deepseek", "fetched_at": now,
                })
    return rows, qlog


def collect_jsonl(path: Path) -> list[dict]:
    """导入外部数据：每行至少含 title、url，可选 content/snippet/published/site/member_id/query。"""
    rows = []
    for r in read_jsonl(path):
        rows.append({
            "raw_id": r.get("raw_id") or stable_hash(r.get("url", ""), r.get("title", "")),
            "title": r.get("title", ""), "url": r.get("url", ""),
            "snippet": r.get("snippet", ""), "content": r.get("content", ""),
            "site": r.get("site", ""), "published": r.get("published"),
            "query": r.get("query", ""), "query_member_id": r.get("member_id") or r.get("query_member_id"),
            "provider": r.get("provider", "jsonl"), "fetched_at": r.get("fetched_at"),
        })
    return rows


def verify_with_fetch(settings: Settings, rows: list[dict]) -> list[dict]:
    """用 Fetch API 回查正文：补全 content，剔除无法访问的链接（防止搜索结果失效/错链）。"""
    ds = DeepSeek(settings)
    out = []
    for r in rows:
        if r.get("content") and len(r["content"]) > 200:
            out.append(r)
            continue
        try:
            page = ds.fetch(r["url"])
        except LLMError as e:
            log.info("链接回查失败，丢弃：%s %s", r["url"], e)
            continue
        r["content"] = page.get("content") or r.get("content", "")
        r["published"] = r.get("published") or page.get("published") or None
        out.append(r)
    return out


def weekly_raw_for_month(settings: Settings, period: Period) -> list[dict]:
    rows = []
    runs = settings.path("runs")
    for d in sorted(runs.glob("weekly-*")):
        meta = next(iter(read_jsonl(d / "period.jsonl")), None)
        if not meta:
            continue
        s, e = date.fromisoformat(meta["start"]), date.fromisoformat(meta["end"])
        if e >= period.start and s <= period.end:
            rows.extend(read_jsonl(d / "raw.jsonl"))
    return rows


def run_collect(settings: Settings, members: list[Member], profiles: ProfileStore, period: Period,
                run_dir: Path, provider: str | None = None, input_path: Path | None = None,
                only: set[str] | None = None) -> dict:
    provider = provider or settings.get("collect.provider", "deepseek")
    run_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(run_dir / "period.jsonl", [period.to_dict()])
    rows: list[dict] = []
    qlog: list[dict] = []
    if period.kind == "monthly":
        reused = weekly_raw_for_month(settings, period)
        rows.extend(reused)
        log.info("月报复用周报原始数据 %d 条", len(reused))
    if provider == "deepseek":
        queries = plan_queries(settings, members, profiles.orgs, period, only)
        log.info("查询计划 %d 条", len(queries))
        got, qlog = collect_deepseek(settings, queries, period)
        if settings.get("collect.verify_urls"):
            got = verify_with_fetch(settings, got)
        rows.extend(got)
    elif provider == "jsonl":
        if not input_path:
            raise ValueError("provider=jsonl 需要 --input 指定文件")
        rows.extend(collect_jsonl(input_path))
    elif provider != "none":
        raise ValueError(f"未知 provider: {provider}")
    # 原始层按 raw_id 去重
    uniq = {r["raw_id"]: r for r in rows}
    n = write_jsonl(run_dir / "raw.jsonl", uniq.values())
    if qlog:
        write_jsonl(run_dir / "queries.jsonl", qlog)
    return {"raw": n, "queries": len(qlog), "provider": provider}
