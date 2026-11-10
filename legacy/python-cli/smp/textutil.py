"""文本、URL、日期等通用工具（纯标准库实现）。"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_SPACES = re.compile(r"[\s　 ]+")
_CJK = re.compile(r"[一-鿿]")
_PUNCT = re.compile(r"[\W_]+", re.UNICODE)
_FW_ALNUM = {c: c - 0xFEE0 for c in list(range(0xFF10, 0xFF1A)) + list(range(0xFF21, 0xFF3B)) + list(range(0xFF41, 0xFF5B))}


def norm_name(name: str) -> str:
    """去掉全角/半角空格：'李　生' → '李生'。"""
    return _SPACES.sub("", name or "").strip()


def norm_org(org: str) -> str:
    s = unicodedata.normalize("NFKC", org or "")
    s = _SPACES.sub("", s)
    # NFKC 会把全角括号转半角，统一回全角便于与名单一致
    return s.replace("(", "（").replace(")", "）")


def clean_text(text: str) -> str:
    # 不做 NFKC：会把中文全角标点（，：）转为半角。只把全角字母数字转半角。
    s = (text or "").translate(_FW_ALNUM)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"[ \t\r\f\v　 ]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def compact(text: str) -> str:
    """去除标点与空白，用于相似度计算。"""
    return _PUNCT.sub("", unicodedata.normalize("NFKC", text or "").lower())


def is_cjk(ch: str) -> bool:
    return bool(_CJK.match(ch))


def shingles(text: str, k: int = 3) -> set[str]:
    s = compact(text)
    if len(s) <= k:
        return {s} if s else set()
    return {s[i : i + k] for i in range(len(s) - k + 1)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def stable_hash(*parts: str, n: int = 12) -> str:
    h = hashlib.sha1("␟".join(parts).encode("utf-8")).hexdigest()
    return h[:n]


# ---------------- URL ----------------
_TRACKING = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm",
             "from", "isappinstalled", "scene", "srcid", "share_token", "chksm", "sessionid",
             "clicktime", "enterid", "ref", "fbclid", "gclid"}


def canonical_url(url: str) -> str:
    if not url:
        return ""
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return url.strip()
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host.startswith("m.") and host.count(".") >= 2:
        host = host[2:]
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=False) if k.lower() not in _TRACKING]
    # 微信文章：__biz/mid/idx/sn 唯一确定一篇
    if host == "mp.weixin.qq.com" and query:
        keep = {"__biz", "mid", "idx", "sn"}
        query = [(k, v) for k, v in query if k in keep]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit(("https", host, path, urlencode(sorted(query)), ""))


def domain_of(url: str) -> str:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


# ---------------- 日期 ----------------
_DATE_PATTERNS = [
    re.compile(r"(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})"),
    re.compile(r"(20\d{2})(\d{2})(\d{2})"),
]


def parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        ts = value / 1000 if value > 1e11 else value
        try:
            return datetime.fromtimestamp(ts).date()
        except (OverflowError, OSError, ValueError):
            return None
    s = str(value).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    for pat in _DATE_PATTERNS:
        m = pat.search(s)
        if m:
            try:
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                continue
    return None


def week_range(d: date) -> tuple[date, date]:
    start = d - timedelta(days=d.weekday())
    return start, start + timedelta(days=6)


def month_range(d: date) -> tuple[date, date]:
    start = d.replace(day=1)
    nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, nxt - timedelta(days=1)


# ---------------- JSONL ----------------
def read_jsonl(path: Path) -> Iterator[dict]:
    if not path.exists():
        return
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def write_jsonl(path: Path, rows: Iterable[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
            n += 1
    return n


def append_jsonl(path: Path, rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def first_sentences(text: str, max_chars: int = 120) -> str:
    text = clean_text(text).replace("\n", " ")
    parts = re.split(r"(?<=[。！？!?；;])", text)
    out = ""
    for p in parts:
        if not p.strip():
            continue
        if len(out) + len(p) > max_chars and out:
            break
        out += p.strip()
    if len(out) > max_chars:
        out = out[: max_chars - 1] + "…"
    return out
