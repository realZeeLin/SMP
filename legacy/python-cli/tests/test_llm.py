from smp.llm import DeepSeek, extract_json, map_result

from .conftest import make_settings


class _Resp:
    def __init__(self, data, status=200):
        self._d, self.status_code, self.text = data, status, str(data)

    def json(self):
        return self._d


def test_map_result_and_extract_json():
    # 官方 Search 返回字段：title/url/snippet/summary/content/site_name/date
    r = map_result({"title": "T", "url": "https://x", "snippet": "s", "summary": "long", "content": "", "date": "2026-11-03T00:00:00+00:00", "site_name": "X"})
    assert r == {"title": "T", "url": "https://x", "snippet": "s", "content": "long", "published": "2026-11-03T00:00:00+00:00", "site": "X"}
    assert extract_json('说明```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('结果如下：[1, 2]') == [1, 2]


def test_search_request_mapping_and_cache(tmp_path, monkeypatch):
    s = make_settings(tmp_path)
    s.data["deepseek"]["api_key"] = "sk-test"
    ds = DeepSeek(s)
    calls = []

    def fake_post(url, json, timeout, headers):
        calls.append((url, json))
        return _Resp({"results": [{"title": "张三获奖", "url": "https://a.edu.cn/1", "content": "正文", "snippet": "", "summary": "", "date": None, "authority": 3, "rerank_score": 2.0}]})

    monkeypatch.setattr(ds.session, "post", fake_post)
    out = ds.search("张三 清华大学 学术")
    assert out[0]["title"] == "张三获奖" and out[0]["content"] == "正文"
    assert calls[0][0].endswith("/v1/tools/search") and calls[0][1]["query"] == "张三 清华大学 学术"
    ds.search("张三 清华大学 学术")      # 命中缓存，不再请求
    assert len(calls) == 1
