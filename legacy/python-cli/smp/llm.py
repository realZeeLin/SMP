"""DeepSeek 客户端：Chat（OpenAI 兼容）、开放搜索 Search API、Fetch API。

- 所有调用带磁盘缓存（同一请求重跑不重复计费）、限速与指数退避重试；
- Search/Fetch 的请求字段与结果字段可在 settings.yaml 中配置，以适配官方接口演进；
- 结果字段做宽松映射（title/url/snippet/content/publish_time 等多种写法）。
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from pathlib import Path
from typing import Any

import requests

from .config import Settings


class LLMError(RuntimeError):
    pass


class _RateLimiter:
    def __init__(self, qps: float):
        self.interval = 1.0 / qps if qps and qps > 0 else 0
        self.lock = threading.Lock()
        self.next_at = 0.0

    def wait(self) -> None:
        if not self.interval:
            return
        with self.lock:
            now = time.monotonic()
            delay = self.next_at - now
            self.next_at = max(now, self.next_at) + self.interval
        if delay > 0:
            time.sleep(delay)


class DiskCache:
    def __init__(self, root: Path):
        self.root = root

    def _p(self, ns: str, key: Any) -> Path:
        h = hashlib.sha1(json.dumps(key, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        return self.root / ns / h[:2] / f"{h}.json"

    def get(self, ns: str, key: Any):
        p = self._p(ns, key)
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
        return None

    def set(self, ns: str, key: Any, value: Any) -> None:
        p = self._p(ns, key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


_FIELD_ALIASES = {
    "title": ["title", "name", "headline"],
    "url": ["url", "link", "href", "source_url"],
    "snippet": ["snippet", "description", "abstract"],
    "content": ["content", "summary", "text", "markdown", "body", "page_content"],
    "published": ["publish_time", "published", "published_at", "date", "datePublished", "publish_date", "time", "dateLastCrawled"],
    "site": ["site_name", "siteName", "site", "source", "host"],
}


def map_result(r: dict) -> dict:
    out = {}
    for field, keys in _FIELD_ALIASES.items():
        for k in keys:
            if r.get(k):
                out[field] = r[k]
                break
        else:
            out[field] = ""
    return out


def extract_json(text: str) -> Any:
    """从模型输出中提取 JSON（容忍 ```json 代码块与前后说明文字）。"""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        for open_, close in (("{", "}"), ("[", "]")):
            i, j = text.find(open_), text.rfind(close)
            if i != -1 and j > i:
                try:
                    return json.loads(text[i : j + 1])
                except json.JSONDecodeError:
                    continue
    raise LLMError(f"无法解析模型 JSON 输出：{text[:200]}")


class DeepSeek:
    def __init__(self, settings: Settings):
        self.s = settings
        self.base = settings.get("deepseek.base_url", "https://api.deepseek.com").rstrip("/")
        self.key = settings.get("deepseek.api_key", "")
        self.timeout = settings.get("deepseek.timeout", 60)
        self.retries = settings.get("deepseek.max_retries", 3)
        self.limiter = _RateLimiter(settings.get("deepseek.qps", 4))
        self.cache = DiskCache(settings.path("cache"))
        self.session = requests.Session()

    @property
    def available(self) -> bool:
        return bool(self.key)

    def _post(self, path: str, body: dict) -> dict:
        if not self.key:
            raise LLMError("未配置 DEEPSEEK_API_KEY")
        url = path if path.startswith("http") else self.base + path
        last = None
        for attempt in range(self.retries + 1):
            self.limiter.wait()
            try:
                r = self.session.post(url, json=body, timeout=self.timeout,
                                      headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
                if r.status_code in (429, 500, 502, 503, 504):
                    raise LLMError(f"HTTP {r.status_code}: {r.text[:200]}")
                if r.status_code >= 400:
                    raise LLMError(f"HTTP {r.status_code}: {r.text[:500]}")  # 不重试的错误
                return r.json()
            except (requests.RequestException, LLMError) as e:
                last = e
                if isinstance(e, LLMError) and "HTTP 4" in str(e) and "HTTP 429" not in str(e):
                    break
                time.sleep(min(2 ** attempt, 16))
        raise LLMError(f"请求失败 {url}: {last}")

    # ---------- Chat ----------
    def chat(self, messages: list[dict], json_mode: bool = False, temperature: float = 0.2,
             model: str | None = None, cache: bool = True) -> str:
        body = {"model": model or self.s.get("deepseek.chat_model", "deepseek-flash"),
                "messages": messages, "temperature": temperature}
        if self.s.get("deepseek.thinking"):
            body["thinking"] = {"type": self.s.get("deepseek.thinking")}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        if cache and (hit := self.cache.get("chat", body)) is not None:
            return hit
        data = self._post("/chat/completions", body)
        text = data["choices"][0]["message"]["content"]
        if cache:
            self.cache.set("chat", body, text)
        return text

    def chat_json(self, system: str, user: str, **kw) -> Any:
        text = self.chat([{"role": "system", "content": system}, {"role": "user", "content": user}], json_mode=True, **kw)
        return extract_json(text)

    # ---------- 开放搜索 ----------
    def search(self, query: str, count: int | None = None, extra: dict | None = None) -> list[dict]:
        cfg = self.s.get("deepseek.search", {}) or {}
        body = {cfg.get("query_field", "query"): query,
                cfg.get("count_field", "count"): count or cfg.get("count", 20)}
        body.update(cfg.get("extra_body") or {})
        body.update(extra or {})
        if (hit := self.cache.get("search", body)) is not None:
            return hit
        data = self._post(cfg.get("endpoint", "/v1/tools/search"), body)
        results = None
        for key in cfg.get("results_path") or ["results"]:
            cur = data.get(key) if isinstance(data, dict) else None
            if isinstance(cur, dict):  # 例如 {"data": {"results": [...]}}
                cur = next((v for v in cur.values() if isinstance(v, list)), None)
            if isinstance(cur, list):
                results = cur
                break
        if results is None and isinstance(data, list):
            results = data
        mapped = [map_result(r) for r in (results or []) if isinstance(r, dict)]
        self.cache.set("search", body, mapped)
        return mapped

    def fetch(self, url: str) -> dict:
        cfg = self.s.get("deepseek.fetch", {}) or {}
        body = {cfg.get("url_field", "url"): url}
        if (hit := self.cache.get("fetch", body)) is not None:
            return hit
        data = self._post(cfg.get("endpoint", "/v1/tools/fetch"), body)
        payload = data.get("data", data) if isinstance(data, dict) else {}
        mapped = map_result(payload if isinstance(payload, dict) else {})
        self.cache.set("fetch", body, mapped)
        return mapped
