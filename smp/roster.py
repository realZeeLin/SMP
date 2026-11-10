"""委员名单：解析、版本同步（增/删/改）、变更日志。

支持两种输入格式：
1. 官网“委员介绍”页面的纯文本（身份标题行 + “姓名 单位”行），即本仓库 data/roster/sources/ 下的文件；
2. CSV：表头 name,org,roles（roles 用 ; 或 、 分隔），便于批量增改。

同步规则（`sync`）：
- 姓名 + 单位完全一致 → 同一人，沿用 ID，比较身份变化；
- 姓名一致、单位不同，且新旧名单中该姓名都只剩一人 → 视为“单位变更”，沿用 ID，并标记需人工确认；
- 新出现 → 分配新 ID；
- 旧名单有、新名单无 → 置为 inactive（离任），保留画像与历史，不物理删除。
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml

from .models import ROLE_ORDER, Member
from .textutil import append_jsonl, norm_name, norm_org, read_jsonl

_ID_RE = re.compile(r"^M(\d+)$")


@dataclass
class ParsedEntry:
    display_name: str
    name: str
    org: str
    roles: list[str]


def parse_roster_text(text: str) -> list[ParsedEntry]:
    entries: dict[tuple[str, str], ParsedEntry] = {}
    order: list[tuple[str, str]] = []
    role = None
    for raw in text.splitlines():
        line = raw.strip().strip("﻿")
        if not line:
            continue
        if line in ROLE_ORDER:
            role = line
            continue
        if role is None:          # 标题、简介段落
            continue
        if " " in line:
            disp, org = line.split(" ", 1)
        else:
            parts = re.split(r"\s+", line)
            if len(parts) < 2:
                continue
            disp, org = " ".join(parts[:-1]), parts[-1]
        name, org = norm_name(disp), norm_org(org)
        if not name or len(name) > 12:   # 防御：误把段落当成姓名行
            continue
        key = (name, org)
        if key in entries:
            if role not in entries[key].roles:
                entries[key].roles.append(role)
        else:
            entries[key] = ParsedEntry(disp.strip(), name, org, [role])
            order.append(key)
    return [entries[k] for k in order]


def parse_roster_csv(text: str) -> list[ParsedEntry]:
    out: dict[tuple[str, str], ParsedEntry] = {}
    for row in csv.DictReader(io.StringIO(text)):
        name = norm_name(row.get("name", ""))
        org = norm_org(row.get("org", ""))
        roles = [r.strip() for r in re.split(r"[;；、,|]", row.get("roles", "") or "委员") if r.strip()]
        if not name:
            continue
        key = (name, org)
        if key in out:
            out[key].roles = list(dict.fromkeys(out[key].roles + roles))
        else:
            out[key] = ParsedEntry(row.get("display_name") or row.get("name", name), name, org, roles)
    return list(out.values())


def parse_roster_file(path: Path) -> list[ParsedEntry]:
    text = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        return parse_roster_csv(text)
    return parse_roster_text(text)


def _sort_roles(roles: list[str]) -> list[str]:
    return sorted(set(roles), key=lambda r: ROLE_ORDER.index(r) if r in ROLE_ORDER else 99)


@dataclass
class RosterDiff:
    added: list[Member] = field(default_factory=list)
    removed: list[Member] = field(default_factory=list)
    reactivated: list[Member] = field(default_factory=list)
    role_changed: list[tuple[Member, list[str], list[str]]] = field(default_factory=list)
    org_changed: list[tuple[Member, str, str]] = field(default_factory=list)
    unchanged: int = 0

    @property
    def has_changes(self) -> bool:
        return any([self.added, self.removed, self.reactivated, self.role_changed, self.org_changed])

    def render(self) -> str:
        lines = [f"新增 {len(self.added)} 人，离任 {len(self.removed)} 人，恢复 {len(self.reactivated)} 人，"
                 f"身份变化 {len(self.role_changed)} 人，单位变化 {len(self.org_changed)} 人，未变 {self.unchanged} 人"]
        for m in self.added:
            lines.append(f"  + {m.id} {m.name}（{m.org}）{'/'.join(m.roles)}")
        for m in self.removed:
            lines.append(f"  - {m.id} {m.name}（{m.org}）{'/'.join(m.roles)}")
        for m in self.reactivated:
            lines.append(f"  ↺ {m.id} {m.name}（{m.org}）")
        for m, old, new in self.role_changed:
            lines.append(f"  * {m.id} {m.name}：{'/'.join(old)} → {'/'.join(new)}")
        for m, old, new in self.org_changed:
            lines.append(f"  ~ {m.id} {m.name}：{old} → {new}  [请人工确认是否同一人]")
        return "\n".join(lines)


class Roster:
    def __init__(self, path: Path, history_path: Path | None = None):
        self.path = path
        self.history_path = history_path
        self.members: list[Member] = []
        if path.exists():
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            self.members = [Member(**m) for m in data.get("members", [])]

    # ---------- 查询 ----------
    @property
    def active(self) -> list[Member]:
        return [m for m in self.members if m.status == "active"]

    def by_id(self, mid: str) -> Member | None:
        return next((m for m in self.members if m.id == mid), None)

    def find(self, key: str) -> list[Member]:
        """按 ID / 姓名 / 姓名@单位 查找。"""
        key = key.strip()
        if _ID_RE.match(key):
            m = self.by_id(key)
            return [m] if m else []
        name, _, org = key.partition("@")
        name = norm_name(name)
        res = [m for m in self.members if m.name == name]
        if org:
            res = [m for m in res if org in m.org]
        return res

    def homonyms(self) -> dict[str, list[Member]]:
        groups = defaultdict(list)
        for m in self.active:
            groups[m.name].append(m)
        return {k: v for k, v in groups.items() if len(v) > 1}

    def stats(self) -> dict:
        c = Counter()
        for m in self.active:
            for r in m.roles:
                c[r] += 1
        return {"active": len(self.active), "inactive": len(self.members) - len(self.active),
                "by_role": {r: c[r] for r in ROLE_ORDER if c[r]}}

    # ---------- 同步 ----------
    def sync(self, entries: list[ParsedEntry], effective: date | None = None,
             source: str = "", dry_run: bool = False) -> RosterDiff:
        effective = effective or date.today()
        eff = effective.isoformat()
        diff = RosterDiff()
        members = [m.model_copy(deep=True) for m in self.members]
        by_key = {(m.name, norm_org(m.org)): m for m in members}
        matched: set[str] = set()
        pending: list[ParsedEntry] = []

        for e in entries:
            m = by_key.get((e.name, e.org))
            if m is None or m.id in matched:
                pending.append(e)
                continue
            matched.add(m.id)
            new_roles = _sort_roles(e.roles)
            if m.status != "active":
                m.status, m.left = "active", None
                diff.reactivated.append(m)
            if new_roles != _sort_roles(m.roles):
                diff.role_changed.append((m, list(m.roles), new_roles))
                m.roles = new_roles
            elif m not in diff.reactivated:
                diff.unchanged += 1
            m.display_name = e.display_name

        # 姓名相同、单位不同 → 疑似单位变更
        pending_names = Counter(e.name for e in pending)
        still_new: list[ParsedEntry] = []
        for e in pending:
            cands = [m for m in members if m.name == e.name and m.id not in matched and m.status == "active"]
            if len(cands) == 1 and pending_names[e.name] == 1:
                m = cands[0]
                matched.add(m.id)
                diff.org_changed.append((m, m.org, e.org))
                m.org = e.org
                new_roles = _sort_roles(e.roles)
                if new_roles != _sort_roles(m.roles):
                    diff.role_changed.append((m, list(m.roles), new_roles))
                    m.roles = new_roles
            else:
                still_new.append(e)

        for e in still_new:
            m = Member(id=self._next_id_from(members), name=e.name, display_name=e.display_name,
                       org=e.org, roles=_sort_roles(e.roles), joined=eff)
            members.append(m)
            matched.add(m.id)
            diff.added.append(m)

        for m in members:
            if m.id not in matched and m.status == "active":
                m.status, m.left = "inactive", eff
                diff.removed.append(m)

        if not dry_run:
            self.members = members
            self.save()
            self._log(diff, eff, source)
        return diff

    def _next_id_from(self, members: list[Member]) -> str:
        nums = [int(_ID_RE.match(m.id).group(1)) for m in members if _ID_RE.match(m.id)]
        return f"M{(max(nums) + 1 if nums else 1):04d}"

    def _log(self, diff: RosterDiff, eff: str, source: str) -> None:
        if not self.history_path:
            return
        rows = []
        for m in diff.added:
            rows.append({"date": eff, "type": "added", "member_id": m.id, "name": m.name, "after": {"org": m.org, "roles": m.roles}})
        for m in diff.removed:
            rows.append({"date": eff, "type": "removed", "member_id": m.id, "name": m.name, "before": {"org": m.org, "roles": m.roles}})
        for m in diff.reactivated:
            rows.append({"date": eff, "type": "reactivated", "member_id": m.id, "name": m.name})
        for m, old, new in diff.role_changed:
            rows.append({"date": eff, "type": "role_changed", "member_id": m.id, "name": m.name, "before": old, "after": new})
        for m, old, new in diff.org_changed:
            rows.append({"date": eff, "type": "org_changed", "member_id": m.id, "name": m.name, "before": old, "after": new})
        for r in rows:
            r["source"] = source
        append_jsonl(self.history_path, rows)

    def history(self, member_id: str | None = None) -> list[dict]:
        if not self.history_path:
            return []
        rows = list(read_jsonl(self.history_path))
        return [r for r in rows if member_id is None or r.get("member_id") == member_id]

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"updated": date.today().isoformat(), **self.stats(),
                "members": [m.model_dump(exclude_none=True) for m in self.members]}
        self.path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=200), encoding="utf-8")
