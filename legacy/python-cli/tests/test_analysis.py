from datetime import date, timedelta

from smp.analyze.classify import AcademicFilter, classify, detect_level
from smp.analyze.dedup import build_events, cluster
from smp.analyze.normalize import normalize, strip_site_suffix
from smp.analyze.scoring import Authority
from smp.analyze.select import select
from smp.collect import Period
from smp.compose.writer import fact_guard
from smp.models import Event, Mention, NewsItem
from smp.textutil import canonical_url, parse_date

from .conftest import make_settings


def test_textutil():
    assert canonical_url("http://www.a.edu.cn/x/?utm_source=wx&id=3") == "https://a.edu.cn/x?id=3"
    assert parse_date("2026年11月3日 10:00") == date(2026, 11, 3)
    assert strip_site_suffix("张三教授当选会士-某某大学新闻网") == "张三教授当选会士"


def test_period():
    p = Period.resolve("weekly", date(2026, 11, 10))
    assert (p.start, p.end, p.label) == (date(2026, 11, 2), date(2026, 11, 8), "2026-W45")
    m = Period.resolve("monthly", date(2026, 11, 10))
    assert (m.start, m.end) == (date(2026, 10, 1), date(2026, 10, 31))


def test_normalize_window_and_merge():
    p = Period.resolve("weekly", date(2026, 11, 10))
    rows = [
        {"title": "A 获奖", "url": "https://a.cn/1?utm_source=x", "published": "2026-11-03", "content": "短", "query_member_id": "M1"},
        {"title": "A 获奖", "url": "https://a.cn/1", "published": "2026-11-03", "content": "更长的正文内容", "query_member_id": "M2"},
        {"title": "旧闻", "url": "https://a.cn/2", "published": "2026-09-01"},
    ]
    items, st = normalize(rows, p, [])
    assert len(items) == 1 and set(items[0].query_member_ids) == {"M1", "M2"}
    assert st["out_of_window"] == 1


def test_academic_filter_and_classify(tmp_path):
    af = AcademicFilter(make_settings(tmp_path))
    assert af.check("张三教授作主旨报告", "张三教授在学术会议作主旨报告")[0]
    assert not af.check("某校与公司签约仪式", "张三出席签约仪式，双方开展战略合作，关注融资与估值")[0]
    assert not af.check("2027年招生简章", "张三教授 研究")[0]
    assert classify("张三团队论文获ACL最佳论文奖", "")[0] == "honor"
    assert classify("张三担任ACL 2027程序委员会主席", "")[0] == "service"
    assert classify("张三入选全球前2%顶尖科学家榜单", "")[0] == "influence"
    assert classify("张三教授作特邀报告", "学术论坛")[0] == "activity"
    assert detect_level("张三当选IEEE Fellow", "")[0] == 1.0


def _news(i, title, mid, d, text=""):
    return NewsItem(item_id=f"i{i}", title=title, url=f"https://s{i}.com/{i}", canonical_url=f"https://s{i}.com/{i}",
                    site=f"s{i}", domain=f"s{i}.com", published=d, text=text or title,
                    mentions=[Mention(member_id=mid, name="张三", confidence=0.9, status="confirmed")])


def test_dedup_reprints_and_distinct_events():
    d = date(2026, 11, 3)
    items = [
        _news(1, "张三教授当选IEEE Fellow", "M1", d, "清华大学张三教授当选IEEE Fellow，表彰其贡献。"),
        _news(2, "清华张三当选IEEE Fellow", "M1", d + timedelta(days=1), "据报道，清华大学张三教授当选 IEEE Fellow。"),
        _news(3, "张三教授作主旨报告", "M1", d, "张三教授在CCL作主旨报告。"),
    ]
    meta = {it.item_id: {"category": classify(it.title, it.text)[0], "level": 1.0,
                         "level_hit": detect_level(it.title, it.text)[1]} for it in items}
    groups = cluster(items, meta, {})
    assert sorted(len(g) for g in groups) == [1, 2]
    evs = build_events(items, groups, meta, Authority({"default": 0.5}), 0.6)
    fellow = next(e for e in evs if len(e.sources) == 2)
    assert fellow.category == "honor" and fellow.member_ids == ["M1"]


def _ev(i, score, mids, cat="research"):
    return Event(event_id=f"e{i}", title=f"t{i}", url=f"https://x/{i}", site="x", category=cat, member_ids=mids,
                 score=score, sources=[{"url": f"https://x/{i}"}])


def test_select_bounds_and_caps():
    evs = [_ev(i, 90 - i * 0.5, [f"M{i % 40}"]) for i in range(120)]
    chosen, rep = select(evs, {"min_items": 30, "max_items": 50, "min_score": 25, "per_member_cap": 2},
                         {"floor_score": 12, "category_caps": {}})
    assert 30 <= len(chosen) <= 50
    from collections import Counter
    assert max(Counter(m for e in chosen for m in e.member_ids).values()) <= 2
    # 候选不足时放宽阈值
    few = [_ev(i, 20, [f"M{i}"]) for i in range(35)]
    chosen, rep = select(few, {"min_items": 30, "max_items": 50, "min_score": 25, "per_member_cap": 2}, {"floor_score": 12})
    assert len(chosen) == 35 - 0 and rep["threshold_used"] <= 20


def test_select_manual_and_history():
    evs = [_ev(1, 10, ["M1"]), _ev(2, 90, ["M2"]), _ev(3, 95, ["M3"])]
    evs[2].previously_published = True
    chosen, _ = select(evs, {"min_items": 1, "max_items": 5, "min_score": 50}, {"floor_score": 40}, {"e1": "keep"})
    assert {e.event_id for e in chosen} == {"e1", "e2"}


def test_fact_guard():
    src = "清华大学张三教授当选2026年IEEE Fellow"
    assert fact_guard("张三教授当选IEEE Fellow", src, ["张三"], 120)[0]
    assert not fact_guard("张三教授当选2027年IEEE Fellow", src, ["张三"], 120)[0]
    assert not fact_guard("某教授当选IEEE Fellow", src, ["张三"], 120)[0]
