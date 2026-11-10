"""画像补全：用 DeepSeek 搜索委员公开学术信息，抽取职称、研究方向、主页、英文名、关键词。

只填充空字段，绝不覆盖人工已填写内容；结果标记 verified: false 并记录来源，等待人工核验。
"""
from __future__ import annotations

import logging
from datetime import date

from .config import Settings
from .llm import DeepSeek, LLMError
from .models import Member
from .profiles import ProfileStore

log = logging.getLogger(__name__)

SYSTEM = ("你是学术人物画像助手。根据搜索结果为指定学者整理画像。只使用与该学者（姓名+单位一致）相符的信息，"
          "不确定的字段留空，不要编造。输出 JSON：{\"title\": 职称/职务, \"department\": 院系, "
          "\"research_areas\": [研究方向, 最多6个], \"keywords\": [可用于识别此人的特征词, 如实验室/团队/代表成果, 最多8个], "
          "\"homepage\": 个人主页URL, \"aliases\": [英文名写法], \"bio\": 80字以内简介, \"sources\": [使用到的URL]}")


def enrich_member(settings: Settings, store: ProfileStore, m: Member, force: bool = False) -> dict | None:
    ds = DeepSeek(settings)
    if not ds.available:
        raise LLMError("画像补全需要 DEEPSEEK_API_KEY")
    p = store.get(m.id)
    if p.get("verified") and not force:
        return None
    results = ds.search(f"{m.name} {m.org} 教授 研究方向 个人主页", count=10)
    if not results:
        return None
    ctx = [{"title": r["title"], "url": r["url"], "snippet": (r.get("snippet") or r.get("content", ""))[:400]} for r in results[:10]]
    data = ds.chat_json(SYSTEM, f"学者：{m.name}，单位：{m.org}\n搜索结果：{ctx}")
    if not isinstance(data, dict):
        return None
    changed = {}
    for k in ("title", "department", "homepage", "bio"):
        if data.get(k) and not p.get(k):
            p[k] = str(data[k]).strip()
            changed[k] = p[k]
    for k in ("research_areas", "keywords", "aliases"):
        vals = [str(v).strip() for v in data.get(k) or [] if str(v).strip()]
        if vals and not p.get(k):
            p[k] = vals
            changed[k] = vals
    if changed:
        p["enriched"] = {"date": date.today().isoformat(), "sources": list(data.get("sources") or [])[:5],
                         "fields": list(changed)}
        p["verified"] = False
        store.save(p)
    return changed
