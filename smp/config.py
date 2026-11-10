"""配置加载：config/settings.yaml + 环境变量。"""
from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import yaml

DEFAULT_CONFIG = "config/settings.yaml"


def _deep_merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class Settings:
    """对配置字典的轻量包装，路径均相对项目根目录解析。"""

    def __init__(self, data: dict, root: Path):
        self.data = data
        self.root = root

    @classmethod
    def load(cls, path: str | os.PathLike | None = None, overrides: dict | None = None) -> "Settings":
        path = Path(path or os.environ.get("SMP_CONFIG", DEFAULT_CONFIG))
        if not path.is_absolute():
            path = Path.cwd() / path
        data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
        data = _deep_merge(data or {}, overrides or {})
        root = path.parent.parent if path.parent.name == "config" else Path.cwd()
        key = os.environ.get("DEEPSEEK_API_KEY")
        if key:
            data.setdefault("deepseek", {})["api_key"] = key
        return cls(data, root)

    def get(self, dotted: str, default: Any = None) -> Any:
        cur: Any = self.data
        for part in dotted.split("."):
            if not isinstance(cur, dict) or part not in cur:
                return default
            cur = cur[part]
        return cur

    def path(self, key: str) -> Path:
        p = Path(self.get(f"paths.{key}"))
        return p if p.is_absolute() else self.root / p

    @property
    def has_llm(self) -> bool:
        return bool(self.get("deepseek.api_key"))
