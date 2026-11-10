from datetime import date

from smp.analyze.disambiguate import Disambiguator, MemberIndex
from smp.models import NewsItem

ROSTER = """委员
王　博 哈尔滨工业大学
王　博 天津大学
张伟男 哈尔滨工业大学
李　斌 武汉大学
李斌阳 国际关系学院
苏墨言 武汉大学
"""


def _item(title, text="", qm=None):
    return NewsItem(item_id="x", title=title, url="https://a.edu.cn/1", canonical_url="https://a.edu.cn/1",
                    site="", domain="a.edu.cn", published=date(2026, 11, 3), text=text, query_member_ids=qm or [])


def _run(ws, title, text=""):
    d = Disambiguator(ws.s, MemberIndex(ws.roster.active, ws.profiles))
    return {(m.name, ws.roster.by_id(m.member_id).org): m for m in d.run(_item(title, text))}


def test_homonym_resolved_by_affiliation(make_ws):
    ws = make_ws(ROSTER)
    ms = _run(ws, "天津大学王博教授团队论文获最佳论文奖", "天津大学王博教授团队的研究论文获奖。")
    assert ms[("王博", "天津大学")].status == "confirmed"
    assert ms[("王博", "哈尔滨工业大学")].status == "rejected"


def test_homonym_without_evidence_needs_review(make_ws):
    ws = make_ws(ROSTER)
    ms = _run(ws, "王博教授作学术报告", "王博教授在论坛作报告。")
    assert {m.status for m in ms.values()} <= {"ambiguous", "rejected"}
    assert all(m.status != "confirmed" for m in ms.values())


def test_name_boundary_and_longest_match(make_ws):
    ws = make_ws(ROSTER)
    assert ("王博", "哈尔滨工业大学") not in _run(ws, "哈尔滨工业大学王博士生获奖", "王博士生代表发言")
    ms = _run(ws, "哈尔滨工业大学张伟男教授作报告")
    assert [k[0] for k in ms] == ["张伟男"]
    ms = _run(ws, "国际关系学院李斌阳教授出席学术会议")
    assert [k[0] for k in ms] == ["李斌阳"]


def test_namesake_rejected(make_ws):
    ws = make_ws(ROSTER)
    ms = _run(ws, "演员苏墨言主演新剧开机", "演员苏墨言近日主演的新剧开机。")
    assert ms[("苏墨言", "武汉大学")].status == "rejected"


def test_english_alias(make_ws):
    ws = make_ws(ROSTER)
    ms = _run(ws, "Keynote by Prof. Moyan Su, Wuhan University", "Moyan Su from Wuhan University gave a keynote.")
    assert ms[("苏墨言", "武汉大学")].status == "confirmed"


def test_manual_override(make_ws):
    ws = make_ws(ROSTER)
    mid = ws.roster.find("苏墨言")[0].id
    d = Disambiguator(ws.s, MemberIndex(ws.roster.active, ws.profiles),
                      {"mentions": [{"url": "https://a.edu.cn/1", "member_id": mid, "decision": "reject"}]})
    ms = d.run(_item("武汉大学苏墨言教授获奖", "武汉大学苏墨言教授获奖"))
    assert ms[0].status == "rejected" and ms[0].method == "manual"
