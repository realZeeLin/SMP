from datetime import date
from pathlib import Path

import pytest

from smp.config import Settings
from smp.pipeline import Workspace
from smp.roster import parse_roster_text

ROOT = Path(__file__).resolve().parent.parent
REAL_ROSTER = ROOT / "data" / "roster" / "sources" / "2026-11-10_委员名单.txt"


def make_settings(tmp_path: Path, **extra) -> Settings:
    paths = {k: str(tmp_path / v) for k, v in {
        "roster": "roster/members.yaml", "roster_history": "roster/history.jsonl", "profiles": "profiles",
        "archive": "archive", "cache": "cache", "runs": "runs", "overrides": "overrides.yaml"}.items()}
    paths["org_aliases"] = str(ROOT / "config" / "org_aliases.yaml")
    ov = {"paths": paths, "deepseek": {"api_key": ""},
          "disambiguation": {"use_llm_for_ambiguous": False}, "compose": {"use_llm": False}}
    for k, v in extra.items():
        ov.setdefault(k, {}).update(v)
    s = Settings.load(ROOT / "config" / "settings.yaml", ov)
    s.data["deepseek"]["api_key"] = ""
    return s


@pytest.fixture
def make_ws(tmp_path, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    def _make(roster_text: str, **extra) -> Workspace:
        s = make_settings(tmp_path, **extra)
        ws = Workspace(s)
        ws.roster.sync(parse_roster_text(roster_text), date(2026, 1, 1))
        ws.profiles.sync_from_roster(ws.roster.members, ws.roster.homonyms())
        return Workspace(s)
    return _make
