"""成稿：标题/摘要改写（DeepSeek，带事实校验）→ 按栏目编排 → 输出 Markdown / 公众号 HTML / 复核表。

事实校验（fact guard）：LLM 改写结果若
  - 未出现委员姓名，或
  - 出现了原文中没有的数字（年份、名次、金额等），或
  - 超长
则回退为抽取式摘要，避免“幻觉”上稿。
"""
from __future__ import annotations

import csv
import logging
import re
from collections import OrderedDict
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..collect import Period
from ..config import Settings
from ..llm import DeepSeek, LLMError
from ..models import CATEGORIES, Event
from ..textutil import first_sentences

log = logging.getLogger(__name__)
TEMPLATES = Path(__file__).parent / "templates"
_NUM = re.compile(r"\d+(?:\.\d+)?")


def fact_guard(candidate: str, source: str, names: list[str], max_chars: int) -> tuple[bool, str]:
    if not candidate or len(candidate) > max_chars * 1.3:
        return False, "长度异常"
    if names and not any(n in candidate for n in names):
        return False, "缺少委员姓名"
    src_nums = set(_NUM.findall(source))
    extra = [n for n in _NUM.findall(candidate) if n not in src_nums]
    if extra:
        return False, f"出现原文没有的数字:{extra[:3]}"
    return True, ""


def extractive(ev: Event, max_chars: int) -> tuple[str, str]:
    headline = ev.title.strip()
    body = ev.text.replace(ev.title, "", 1)
    blurb = first_sentences(body, max_chars) or headline
    return headline, blurb


def rewrite_with_llm(ds: DeepSeek, events: list[Event], max_chars: int, batch: int = 8) -> None:
    system = ("你是中国中文信息学会社会媒体处理专委会（SMP）公众号编辑，撰写委员学术动态简讯。"
              "要求：1) 严格依据提供的原文，不得添加原文没有的事实、数字、头衔或评价；"
              f"2) headline 不超过 30 字，以委员姓名开头；3) summary 为 1~2 句、不超过 {max_chars} 字，客观平实；"
              "4) 只写学术相关内容；5) 输出 JSON：{\"items\": [{\"id\": ..., \"headline\": ..., \"summary\": ...}]}")
    for i in range(0, len(events), batch):
        chunk = events[i : i + batch]
        payload = [{"id": e.event_id, "members": e.member_names, "title": e.title, "text": e.text[:1200]} for e in chunk]
        try:
            data = ds.chat_json(system, f"请改写以下条目：{payload}")
        except LLMError as e:
            log.warning("LLM 改写失败，使用抽取式摘要：%s", e)
            continue
        got = {str(x.get("id")): x for x in (data.get("items") or [])} if isinstance(data, dict) else {}
        for e in chunk:
            x = got.get(e.event_id)
            if not x:
                continue
            src = e.title + " " + e.text
            ok1, why1 = fact_guard(x.get("headline", ""), src, e.member_names, 40)
            ok2, why2 = fact_guard(x.get("summary", ""), src, [], max_chars)
            if ok1:
                e.headline = x["headline"].strip()
            if ok2:
                e.blurb = x["summary"].strip()
            if not (ok1 and ok2):
                e.review_notes.append(f"LLM 改写未通过校验，已回退:{why1 or why2}")


def editor_note(ds: DeepSeek | None, period: Period, sections: dict, n: int) -> str:
    highlights = [e.headline for evs in sections.values() for e in evs][:8]
    default = (f"本期共收录委员学术动态 {n} 条，涵盖"
               + "、".join(f"{CATEGORIES[c]}{len(v)}条" for c, v in sections.items())
               + "。欢迎各位委员通过专委会秘书处报送动态线索。")
    if not (ds and ds.available):
        return default
    try:
        data = ds.chat_json(
            "你是 SMP 专委会公众号编辑。根据给定的本期要点写一段 80~120 字的编者按，客观平实，只概括给出的要点，"
            "不要编造。输出 JSON：{\"note\": \"...\"}",
            f"周期：{period.start}~{period.end}；条目数：{n}；要点：{highlights}")
        note = str(data.get("note", "")).strip()
        ok, _ = fact_guard(note, " ".join(highlights) + f" {n} {period.start} {period.end}", [], 200)
        return note if ok else default
    except LLMError:
        return default


def _date_cn(d: date | None) -> str:
    return f"{d.month}月{d.day}日" if d else ""


def build_issue(settings: Settings, period: Period, events: list[Event], member_info: dict[str, dict],
                use_llm: bool | None = None) -> dict:
    cfg = settings.get("compose", {})
    max_chars = cfg.get("summary_max_chars", 120)
    use_llm = cfg.get("use_llm", True) if use_llm is None else use_llm
    ds = DeepSeek(settings) if use_llm else None
    for e in events:
        e.headline, e.blurb = extractive(e, max_chars)
    if ds and ds.available:
        rewrite_with_llm(ds, events, max_chars)
    order = cfg.get("section_order") or list(CATEGORIES)
    sections: "OrderedDict[str, list[Event]]" = OrderedDict()
    for cat in order:
        evs = [e for e in events if e.category == cat]
        if evs:
            sections[cat] = sorted(evs, key=lambda e: -e.score)
    n = 0
    for evs in sections.values():
        for e in evs:
            n += 1
            e.rank = n
    if period.kind == "weekly":
        y, w, _ = period.start.isocalendar()
        title = cfg.get("title_weekly", "SMP 委员动态周报").format(
            year=y, week=w, start=period.start.strftime("%m.%d"), end=period.end.strftime("%m.%d"))
    else:
        title = cfg.get("title_monthly", "SMP 委员动态月报").format(year=period.start.year, month=period.start.month)
    involved = OrderedDict()
    for evs in sections.values():
        for e in evs:
            for mid in e.member_ids:
                involved.setdefault(mid, member_info.get(mid, {}))
    return {
        "title": title, "period": period.to_dict(), "editor_note": editor_note(ds, period, sections, n),
        "sections": [{"key": k, "name": CATEGORIES[k], "events": [_ev_view(e, member_info) for e in v]} for k, v in sections.items()],
        "members": list(involved.values()), "count": n,
    }


def _ev_view(e: Event, member_info: dict[str, dict]) -> dict:
    return {
        "rank": e.rank, "headline": e.headline, "blurb": e.blurb, "url": e.url, "site": e.site,
        "date": _date_cn(e.published), "members": [member_info.get(m, {"name": m}) for m in e.member_ids],
        "n_sources": len(e.sources), "score": e.score, "needs_review": e.needs_review,
    }


def render(issue: dict, out_dir: Path) -> dict[str, Path]:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    out = {}
    for name, tpl in (("draft.md", "issue.md.j2"), ("draft_wechat.html", "wechat.html.j2")):
        p = out_dir / name
        p.write_text(env.get_template(tpl).render(**issue), encoding="utf-8")
        out[name] = p
    return out


def write_review_sheet(events: list[Event], path: Path, member_info: dict[str, dict]) -> None:
    """编辑复核表：decision 列填 keep / drop，人物列可改；用 `smp review apply` 回写。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["decision", "selected", "rank", "score", "category", "needs_review", "members", "member_ids",
                    "confidence", "headline", "title", "date", "site", "url", "n_sources", "notes", "score_detail", "event_id"])
        for e in sorted(events, key=lambda e: (not e.selected, e.rank or 999, -e.score)):
            w.writerow(["", "Y" if e.selected else "", e.rank or "", e.score, CATEGORIES.get(e.category, e.category),
                        "Y" if e.needs_review else "",
                        "、".join(f"{member_info.get(m, {}).get('name', m)}({member_info.get(m, {}).get('org', '')})" for m in e.member_ids),
                        ";".join(e.member_ids), e.confidence, e.headline, e.title,
                        e.published.isoformat() if e.published else "", e.site, e.url, len(e.sources),
                        " | ".join(e.review_notes), e.score_detail, e.event_id])
