"""清洗：规范化 URL、解析日期、按统计窗口过滤、同 URL 合并。"""
from __future__ import annotations

import re

from ..collect import Period
from ..models import NewsItem
from ..textutil import canonical_url, clean_text, domain_of, parse_date, stable_hash

_URL_DATE = re.compile(r"(20\d{2})[/_-]?(\d{2})[/_-]?(\d{2})")
_TITLE_SUFFIX = re.compile(r"\s*(?:[-_|｜—]{1,2}|\s{2,})\s*[^-_|｜—\s]{2,16}\s*$")
_REPRINT = re.compile(r"\s*[（(【\[]\s*(?:转载|转|图|视频|组图|附视频)\s*[)）】\]]\s*$")


def strip_site_suffix(title: str) -> str:
    """'xxx获奖-哈尔滨工业大学新闻网' → 'xxx获奖'。"""
    t = clean_text(title)
    for _ in range(2):  # 可能有多级后缀：“标题 - 栏目 - 网站”
        t2 = _REPRINT.sub("", _TITLE_SUFFIX.sub("", t))
        if len(t2) < 8 or t2 == t:
            break
        t = t2
    return _REPRINT.sub("", t)


def _date_from_url(url: str):
    m = _URL_DATE.search(url or "")
    return parse_date(f"{m.group(1)}-{m.group(2)}-{m.group(3)}") if m else None


def normalize(raw_rows: list[dict], period: Period, org_terms: list[str],
              tolerance_days: int = 3, keep_undated: bool = True) -> tuple[list[NewsItem], dict]:
    merged: dict[str, NewsItem] = {}
    stats = {"raw": len(raw_rows), "out_of_window": 0, "undated": 0, "no_title": 0}
    for r in raw_rows:
        title = strip_site_suffix(r.get("title") or "")
        if not title:
            stats["no_title"] += 1
            continue
        url = r.get("url") or ""
        curl = canonical_url(url) or f"urn:title:{stable_hash(title)}"
        pub = parse_date(r.get("published")) or _date_from_url(url)
        if pub is None:
            stats["undated"] += 1
            if not keep_undated:
                continue
        elif not period.contains(pub, tolerance_days):
            stats["out_of_window"] += 1
            continue
        body = clean_text(r.get("content") or "")
        snippet = clean_text(r.get("snippet") or "")
        text = body if len(body) >= len(snippet) else snippet
        if snippet and snippet not in text:
            text = snippet + "\n" + text
        qm = r.get("query_member_id")
        item = merged.get(curl)
        if item:
            if qm and qm not in item.query_member_ids:
                item.query_member_ids.append(qm)
            if len(text) > len(item.text):
                item.text = text
            item.published = item.published or pub
            continue
        domain = domain_of(url)
        merged[curl] = NewsItem(
            item_id=stable_hash(curl), title=title, url=url, canonical_url=curl,
            site=r.get("site") or domain, domain=domain, published=pub, text=text,
            query_member_ids=[qm] if qm else [],
        )
    for it in merged.values():
        full = it.title + " " + it.text
        it.is_org_news = any(t in full for t in org_terms) or bool(
            re.search(r"SMP\s*20\d{2}", full) and "社会媒体" in full)
    stats["items"] = len(merged)
    return list(merged.values()), stats
