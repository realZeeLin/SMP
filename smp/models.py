"""数据模型。各阶段之间以 JSONL 交换，模型即中间产物的 schema。"""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

# 名单中的身份（按页面顺序）
ROLE_ORDER = [
    "指导委员会主任", "指导委员会副主任", "指导委员会委员",
    "主任", "副主任", "秘书长", "副秘书长", "秘书",
    "荣誉委员", "常务委员", "委员", "海外委员",
]

# 栏目：只收录学术相关动态（学术活动、学术获奖、学术成果与学术影响力）
CATEGORIES = {
    "org": "专委会动态",
    "honor": "学术荣誉",
    "research": "学术成果",
    "project": "科研项目",
    "activity": "学术活动",
    "service": "学术任职与服务",
    "influence": "学术影响力",
    "other": "其他学术动态",
}


class Member(BaseModel):
    """名单中的一条记录（结构化名单 members.yaml 的元素）。"""
    id: str
    name: str                      # 规范姓名（去空格）
    display_name: str              # 名单原样（含全角空格，排版用）
    org: str
    roles: list[str]
    status: str = "active"         # active | inactive（离任保留档案与历史）
    joined: Optional[str] = None
    left: Optional[str] = None


class RawItem(BaseModel):
    """采集阶段的原始结果。"""
    raw_id: str
    title: str
    url: str = ""
    snippet: str = ""
    content: str = ""
    site: str = ""
    published: Optional[str] = None
    query: str = ""
    query_member_id: Optional[str] = None   # 由哪位委员的查询带回
    provider: str = ""
    fetched_at: Optional[str] = None


class Mention(BaseModel):
    member_id: str
    name: str
    confidence: float
    status: str                    # confirmed | ambiguous | rejected
    evidence: list[str] = Field(default_factory=list)
    method: str = "rules"          # rules | rules+llm | manual


class NewsItem(BaseModel):
    """清洗后的单篇报道。"""
    item_id: str
    title: str
    url: str
    canonical_url: str
    site: str
    domain: str
    published: Optional[date] = None
    text: str = ""
    query_member_ids: list[str] = Field(default_factory=list)
    mentions: list[Mention] = Field(default_factory=list)
    is_org_news: bool = False


class Event(BaseModel):
    """去重聚类后的“事件”：同一件事的多篇报道合并为一条。"""
    event_id: str
    title: str
    summary: str = ""
    url: str
    site: str
    published: Optional[date] = None
    category: str = "other"
    level: float = 0.0
    member_ids: list[str] = Field(default_factory=list)
    member_names: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    needs_review: bool = False
    review_notes: list[str] = Field(default_factory=list)
    is_org_news: bool = False
    sources: list[dict] = Field(default_factory=list)   # [{title,url,site,published}]
    item_ids: list[str] = Field(default_factory=list)
    text: str = ""
    previously_published: bool = False
    score: float = 0.0
    score_detail: dict = Field(default_factory=dict)
    selected: bool = False
    rank: Optional[int] = None
    headline: str = ""              # 成稿标题（LLM 改写或抽取）
    blurb: str = ""                 # 成稿摘要
