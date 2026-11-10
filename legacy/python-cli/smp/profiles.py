"""委员画像档案：每人一个 YAML（data/profiles/Mxxxx.yaml）。

- 名单字段（姓名/单位/身份/状态）由 `sync_from_roster` 自动同步；
- 人工字段（研究方向、主页、别名、消歧关键词等）永不被自动覆盖；
- 自动字段放在 `auto:` 下（英文名拼写、常见名标记、名单内重名），可随时重算；
- 活动时间线来自已发布事件归档（data/archive/events.jsonl），用 `smp profile show` 查看。
"""
from __future__ import annotations

import copy
from datetime import date
from pathlib import Path

import yaml

from .models import Member
from .textutil import norm_org

try:  # 可选依赖
    from pypinyin import Style, lazy_pinyin
except ImportError:  # pragma: no cover
    lazy_pinyin = None

COMPOUND_SURNAMES = {"欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "令狐", "长孙", "宇文", "司徒", "夏侯"}

MANUAL_FIELDS = {
    "aliases": [],            # 其它写法：英文名、曾用名，例如 "Jie Tang"
    "title": "",              # 职称/职务
    "department": "",
    "research_areas": [],
    "keywords": [],           # 消歧正向词：研究方向、团队/实验室名、代表成果
    "negative_keywords": [],  # 同名者特征词（如“演员”“足球”）
    "org_aliases": [],        # 本人单位的补充别名
    "homepage": "",
    "scholar": {"dblp": "", "google_scholar": "", "orcid": "", "aminer": ""},
    "trusted_domains": [],    # 命中这些域名的报道直接加分（如个人主页、实验室网站）
    "exclude_url_patterns": [],  # 已知同名者的网页，直接排除
    "bio": "",
    "notes": "",
    "verified": False,        # 画像是否已人工核验
}


def english_names(name: str) -> list[str]:
    if lazy_pinyin is None or not name or "·" in name or len(name) < 2:
        return []
    if name[:2] in COMPOUND_SURNAMES and len(name) > 2:
        sur, given = name[:2], name[2:]
    else:
        sur, given = name[0], name[1:]
    s = "".join(lazy_pinyin(sur, style=Style.NORMAL)).capitalize()
    g = "".join(lazy_pinyin(given, style=Style.NORMAL)).capitalize()
    if not s or not g or not s.isascii():
        return []
    return [f"{g} {s}", f"{s} {g}"]


class OrgDirectory:
    """单位规范名与别名。"""

    def __init__(self, path: Path | None):
        self.aliases: dict[str, list[str]] = {}
        if path and path.exists():
            raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            self.aliases = {norm_org(k): [a for a in (v or []) if a] for k, v in raw.items()}

    def names_for(self, org: str, extra: list[str] | None = None) -> list[str]:
        org = norm_org(org)
        names = [org] + self.aliases.get(org, [])
        # 规则派生：中国科学院 ↔ 中科院；带校区括号的取主校名的别名
        if org.startswith("中国科学院"):
            names.append(org.replace("中国科学院", "中科院"))
        base = org.split("（")[0]
        if base != org:
            names.append(base + org[len(base):].strip("（）"))  # 哈尔滨工业大学深圳
        names += extra or []
        seen, out = set(), []
        for n in names:
            if n and n not in seen:
                seen.add(n)
                out.append(n)
        return out

    def short(self, org: str) -> str:
        al = self.aliases.get(norm_org(org)) or []
        cjk = [a for a in al if not a.isascii()]
        return cjk[0] if cjk else org

    def all_names(self) -> set[str]:
        out = set(self.aliases)
        for v in self.aliases.values():
            out.update(a for a in v if not a.isascii() and len(a) >= 2)
        return out


class ProfileStore:
    def __init__(self, root: Path, orgs: OrgDirectory | None = None, common_surnames: list[str] | None = None):
        self.root = root
        self.orgs = orgs or OrgDirectory(None)
        self.common_surnames = set(common_surnames or [])
        self._cache: dict[str, dict] = {}

    def path(self, member_id: str) -> Path:
        return self.root / f"{member_id}.yaml"

    def get(self, member_id: str) -> dict:
        if member_id not in self._cache:
            p = self.path(member_id)
            data = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}
            self._cache[member_id] = data or {}
        return self._cache[member_id]

    def save(self, profile: dict) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self._cache[profile["id"]] = profile
        self.path(profile["id"]).write_text(
            yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=200), encoding="utf-8")

    def sync_from_roster(self, members: list[Member], homonyms: dict[str, list[Member]]) -> dict:
        created = updated = 0
        today = date.today().isoformat()
        for m in members:
            orig = copy.deepcopy(self.get(m.id))
            p = copy.deepcopy(orig)
            is_new = not p
            prev_org = p.get("org")
            base = {"id": m.id, "name": m.name, "org": m.org, "roles": m.roles, "status": m.status}
            for k, v in MANUAL_FIELDS.items():
                p.setdefault(k, v if not isinstance(v, (list, dict)) else type(v)(v))
            hist = p.setdefault("org_history", [])
            if is_new or not hist:
                hist[:] = [{"org": m.org, "since": m.joined or today}]
            elif prev_org and prev_org != m.org:
                hist[-1]["until"] = today
                hist.append({"org": m.org, "since": today})
            p["auto"] = {
                "english_names": english_names(m.name),
                "org_names": self.orgs.names_for(m.org),
                "common_name": self.is_common(m.name),
                "homonyms_in_roster": [o.id for o in homonyms.get(m.name, []) if o.id != m.id],
            }
            ordered = {**base, **{k: v for k, v in p.items() if k not in base}}
            ordered.setdefault("updated", today)
            strip = lambda d: {k: v for k, v in d.items() if k != "updated"}
            if is_new or strip(ordered) != strip(orig):
                ordered["updated"] = today
                self.save(ordered)
                created += is_new
                updated += not is_new
        return {"created": created, "updated": updated}

    def is_common(self, name: str) -> bool:
        return len(name) == 2 and name[0] in self.common_surnames

    # ---------- 供消歧使用的派生视图 ----------
    def name_variants(self, member_id: str) -> list[str]:
        p = self.get(member_id)
        out = [p.get("name", "")] + list(p.get("aliases") or []) + list((p.get("auto") or {}).get("english_names") or [])
        return [x for x in dict.fromkeys(out) if x]

    def org_names(self, member_id: str) -> list[str]:
        p = self.get(member_id)
        auto = (p.get("auto") or {}).get("org_names") or self.orgs.names_for(p.get("org", ""))
        hist = [h.get("org") for h in p.get("org_history") or [] if h.get("org")]
        return list(dict.fromkeys(auto + list(p.get("org_aliases") or []) + hist))

    def completeness(self, member_id: str) -> float:
        p = self.get(member_id)
        keys = ["title", "research_areas", "keywords", "homepage", "bio"]
        return sum(1 for k in keys if p.get(k)) / len(keys)
