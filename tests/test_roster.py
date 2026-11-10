from datetime import date

from smp.roster import Roster, parse_roster_file, parse_roster_text

from .conftest import REAL_ROSTER


def test_parse_real_roster():
    entries = parse_roster_file(REAL_ROSTER)
    assert len(entries) == 401
    names = [e.name for e in entries]
    assert names[0] == "李生" and entries[0].roles == ["指导委员会主任"]
    assert "吐尔地·托合提" in names
    # 名单内重名：同名不同单位视为不同的人
    assert sum(1 for n in names if n == "王博") == 2
    assert sum(1 for n in names if n == "刘洋") == 2


def test_sync_add_remove_change(tmp_path):
    v1 = "主任\n甲一 清华大学\n委员\n乙二 北京大学\n丙三 复旦大学\n丁四 浙江大学\n"
    v2 = "主任\n甲一 清华大学\n常务委员\n乙二 北京大学\n委员\n丙三 南京大学\n戊五 武汉大学\n"
    r = Roster(tmp_path / "m.yaml", tmp_path / "h.jsonl")
    d1 = r.sync(parse_roster_text(v1), date(2026, 1, 1))
    assert len(d1.added) == 4
    ids = {m.name: m.id for m in r.members}
    r = Roster(tmp_path / "m.yaml", tmp_path / "h.jsonl")
    d2 = r.sync(parse_roster_text(v2), date(2026, 6, 1))
    assert [m.name for m in d2.added] == ["戊五"]
    assert [m.name for m in d2.removed] == ["丁四"]
    assert [(m.name, new) for m, _, new in d2.role_changed] == [("乙二", ["常务委员"])]
    assert [(m.name, old, new) for m, old, new in d2.org_changed] == [("丙三", "复旦大学", "南京大学")]
    # ID 稳定：单位变更沿用原 ID，离任保留记录
    assert r.find("丙三")[0].id == ids["丙三"]
    assert r.find("丁四")[0].status == "inactive"
    assert {h["type"] for h in r.history()} >= {"added", "removed", "role_changed", "org_changed"}
    # 离任后重新加入 → 恢复原 ID
    d3 = r.sync(parse_roster_text(v2 + "丁四 浙江大学\n"), date(2026, 9, 1))
    assert [m.id for m in d3.reactivated] == [ids["丁四"]]


def test_dry_run_does_not_write(tmp_path):
    r = Roster(tmp_path / "m.yaml")
    r.sync(parse_roster_text("委员\n甲一 清华大学\n"), dry_run=True)
    assert not (tmp_path / "m.yaml").exists()
