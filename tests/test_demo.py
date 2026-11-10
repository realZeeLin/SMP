from smp.demo import run_demo


def test_demo_end_to_end(tmp_path, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    out = run_demo(tmp_path / "demo")
    assert "入选" in out
    run = tmp_path / "demo" / "runs" / "weekly-2026-W45"
    md = (run / "draft.md").read_text(encoding="utf-8")
    assert "SMP 委员动态周报" in md and "演员" not in md and "签约" not in md
    assert "陈锐敏" not in md
    html = (run / "draft_wechat.html").read_text(encoding="utf-8")
    assert "<section" in html and "class=" not in html
    assert (run / "review.csv").exists()
