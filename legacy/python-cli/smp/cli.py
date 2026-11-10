"""命令行入口：smp <命令>。运行 `smp --help` 查看全部命令。"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

import click
import yaml

from .collect import Period, plan_queries, run_collect
from .config import Settings
from .llm import LLMError
from .models import CATEGORIES
from .pipeline import Workspace, analyze, apply_review, compose, load_period, member_activity, publish
from .roster import parse_roster_file


def _ws(ctx) -> Workspace:
    return Workspace(ctx.obj["settings"])


def _period(kind: str, ref: str | None, current: bool) -> Period:
    return Period.resolve(kind, date.fromisoformat(ref) if ref else None, previous=not current)


@click.group()
@click.option("--config", "config_path", default=None, help="配置文件，默认 config/settings.yaml")
@click.option("-v", "--verbose", is_flag=True)
@click.pass_context
def main(ctx, config_path, verbose):
    """SMP 委员学术动态生产工具：采集 → 分析 → 成稿。"""
    logging.basicConfig(level=logging.INFO if verbose else logging.WARNING, format="%(levelname)s %(message)s")
    ctx.ensure_object(dict)
    ctx.obj["settings"] = Settings.load(config_path)


# ====================== 名单 ======================
@main.group()
def roster():
    """委员名单管理（导入/变更/查询）。"""


@roster.command("import")
@click.argument("file", type=click.Path(exists=True, path_type=Path))
@click.option("--effective", default=None, help="生效日期 YYYY-MM-DD，默认今天")
@click.option("--dry-run", is_flag=True, help="只显示变更，不写入")
@click.pass_context
def roster_import(ctx, file, effective, dry_run):
    """导入/更新名单（官网文本或 CSV），自动比对增删改并同步画像档案。"""
    ws = _ws(ctx)
    entries = parse_roster_file(file)
    diff = ws.roster.sync(entries, date.fromisoformat(effective) if effective else None, source=file.name, dry_run=dry_run)
    click.echo(f"解析到 {len(entries)} 人。")
    click.echo(diff.render())
    if dry_run:
        click.echo("（dry-run，未写入）")
        return
    r = ws.profiles.sync_from_roster(ws.roster.members, ws.roster.homonyms())
    click.echo(f"画像档案：新建 {r['created']}，更新 {r['updated']}。")
    if diff.org_changed:
        click.echo("⚠ 存在单位变更，请核对是否为同一人；若不是，请在 members.yaml 中拆分。")


@roster.command("list")
@click.option("--role", default=None)
@click.option("--all", "show_all", is_flag=True, help="包含已离任")
@click.pass_context
def roster_list(ctx, role, show_all):
    ws = _ws(ctx)
    ms = ws.roster.members if show_all else ws.roster.active
    for m in ms:
        if role and role not in m.roles:
            continue
        click.echo(f"{m.id}\t{m.name}\t{m.org}\t{'/'.join(m.roles)}\t{m.status}")


@roster.command("stats")
@click.pass_context
def roster_stats(ctx):
    ws = _ws(ctx)
    click.echo(json.dumps(ws.roster.stats(), ensure_ascii=False, indent=2))
    hom = ws.roster.homonyms()
    if hom:
        click.echo("名单内重名：" + "；".join(f"{k}（{'、'.join(m.org for m in v)}）" for k, v in hom.items()))


@roster.command("history")
@click.argument("key", required=False)
@click.pass_context
def roster_history(ctx, key):
    """查看名单变更日志（可指定 ID/姓名）。"""
    ws = _ws(ctx)
    mids = {m.id for m in ws.roster.find(key)} if key else None
    for r in ws.roster.history():
        if mids is None or r.get("member_id") in mids:
            click.echo(json.dumps(r, ensure_ascii=False))


# ====================== 画像 ======================
@main.group()
def profile():
    """委员画像档案。"""


@profile.command("show")
@click.argument("key")
@click.pass_context
def profile_show(ctx, key):
    """查看画像：KEY 可为 ID、姓名或 姓名@单位（重名时）。"""
    ws = _ws(ctx)
    ms = ws.roster.find(key)
    if not ms:
        raise click.ClickException(f"未找到：{key}")
    for m in ms:
        p = ws.profiles.get(m.id)
        click.echo(f"# {m.id} {m.name} · {m.org}　[{m.status}]  画像完整度 {ws.profiles.completeness(m.id):.0%}")
        click.echo(yaml.safe_dump(p, allow_unicode=True, sort_keys=False))
        hist = ws.roster.history(m.id)
        if hist:
            click.echo("## 名单变更")
            for h in hist:
                click.echo(f"  {h['date']} {h['type']} {h.get('before', '')} → {h.get('after', '')}")
        acts = member_activity(ws, m.id)
        click.echo(f"## 已发布动态（{len(acts)}）")
        for a in acts:
            click.echo(f"  {a.get('published') or a.get('issue_date')} [{CATEGORIES.get(a['category'], a['category'])}] "
                       f"{a.get('headline') or a['title']}  ({a['issue']})")


@profile.command("sync")
@click.pass_context
def profile_sync(ctx):
    """根据当前名单重算画像自动字段（英文名、单位别名、常见名/重名标记）。"""
    ws = _ws(ctx)
    r = ws.profiles.sync_from_roster(ws.roster.members, ws.roster.homonyms())
    click.echo(f"新建 {r['created']}，更新 {r['updated']}")


@profile.command("check")
@click.option("--limit", default=30)
@click.pass_context
def profile_check(ctx, limit):
    """检查画像质量：列出重名/常见名且缺少消歧信息的委员（优先补全）。"""
    ws = _ws(ctx)
    rows = []
    for m in ws.roster.active:
        p = ws.profiles.get(m.id)
        auto = p.get("auto") or {}
        risk = 2 * bool(auto.get("homonyms_in_roster")) + bool(auto.get("common_name"))
        comp = ws.profiles.completeness(m.id)
        if risk or comp < 0.4:
            rows.append((risk, comp, m))
    rows.sort(key=lambda r: (-r[0], r[1]))
    click.echo(f"需优先完善的画像 {len(rows)} 人（显示前 {limit}）：")
    for risk, comp, m in rows[:limit]:
        flag = "名单内重名" if risk >= 2 else ("常见姓名" if risk else "")
        click.echo(f"  {m.id} {m.name}（{m.org}） 完整度 {comp:.0%} {flag}")


@profile.command("enrich")
@click.argument("keys", nargs=-1)
@click.option("--all", "do_all", is_flag=True, help="补全全部未核验画像")
@click.option("--force", is_flag=True)
@click.pass_context
def profile_enrich(ctx, keys, do_all, force):
    """用 DeepSeek 搜索补全画像（只填空字段，需人工核验后将 verified 置为 true）。"""
    from .enrich import enrich_member
    ws = _ws(ctx)
    ms = ws.roster.active if do_all else [m for k in keys for m in ws.roster.find(k)]
    for m in ms:
        try:
            changed = enrich_member(ws.s, ws.profiles, m, force)
        except LLMError as e:
            raise click.ClickException(str(e))
        click.echo(f"{m.id} {m.name}: {', '.join(changed) if changed else '无变化'}")


# ====================== 生产流程 ======================
@main.command("plan")
@click.argument("kind", type=click.Choice(["weekly", "monthly"]))
@click.option("--date", "ref", default=None)
@click.pass_context
def plan_cmd(ctx, kind, ref):
    """预览查询计划（不调用接口），估算调用量。"""
    ws = _ws(ctx)
    period = _period(kind, ref, False)
    qs = plan_queries(ws.s, ws.roster.active, ws.orgs, period)
    click.echo(f"{period.run_name}：{period.start} ~ {period.end}，共 {len(qs)} 条查询")
    for q in qs[:15]:
        click.echo(f"  [{q.kind}] {q.text}")
    if len(qs) > 15:
        click.echo("  ...")


@main.command("collect")
@click.argument("kind", type=click.Choice(["weekly", "monthly"]))
@click.option("--date", "ref", default=None, help="参考日期，默认今天（取上一个完整周期）")
@click.option("--current", is_flag=True, help="统计当前（未结束的）周期")
@click.option("--provider", type=click.Choice(["deepseek", "jsonl", "none"]), default=None)
@click.option("--input", "input_path", type=click.Path(exists=True, path_type=Path), default=None)
@click.option("--member", "members", multiple=True, help="只采集指定委员（ID/姓名）")
@click.pass_context
def collect_cmd(ctx, kind, ref, current, provider, input_path, members):
    """阶段一：数据采集。"""
    ws = _ws(ctx)
    period = _period(kind, ref, current)
    only = {m.id for k in members for m in ws.roster.find(k)} or None
    try:
        r = run_collect(ws.s, ws.roster.active, ws.profiles, period, ws.run_dir(period), provider, input_path, only)
    except (LLMError, ValueError) as e:
        raise click.ClickException(str(e))
    click.echo(f"{period.run_name}: {r}  → {ws.run_dir(period)}")


def _resolve_run(ws: Workspace, run: str) -> Path:
    p = Path(run)
    if not p.exists():
        p = ws.s.path("runs") / run
    if not (p / "period.jsonl").exists():
        raise click.ClickException(f"不是有效的运行目录：{run}")
    return p


@main.command("analyze")
@click.argument("run")
@click.pass_context
def analyze_cmd(ctx, run):
    """阶段二：数据分析（消歧、学术过滤、去重、打分、摘选）。RUN 为运行目录或名称，如 weekly-2026-W45。"""
    ws = _ws(ctx)
    rep = analyze(ws, _resolve_run(ws, run))
    click.echo(json.dumps(rep, ensure_ascii=False, indent=2))


@main.command("compose")
@click.argument("run")
@click.option("--no-llm", is_flag=True, help="不调用 LLM，使用抽取式摘要")
@click.pass_context
def compose_cmd(ctx, run, no_llm):
    """阶段三：数据成稿（Markdown + 公众号 HTML + 复核表）。"""
    ws = _ws(ctx)
    r = compose(ws, _resolve_run(ws, run), use_llm=False if no_llm else None)
    click.echo(f"成稿 {r['count']} 条：")
    for f in r["files"]:
        click.echo(f"  {f}")


@main.command("run")
@click.argument("kind", type=click.Choice(["weekly", "monthly"]))
@click.option("--date", "ref", default=None)
@click.option("--current", is_flag=True)
@click.option("--provider", type=click.Choice(["deepseek", "jsonl", "none"]), default=None)
@click.option("--input", "input_path", type=click.Path(exists=True, path_type=Path), default=None)
@click.option("--no-llm", is_flag=True)
@click.pass_context
def run_cmd(ctx, kind, ref, current, provider, input_path, no_llm):
    """一键执行：采集 → 分析 → 成稿。"""
    ws = _ws(ctx)
    period = _period(kind, ref, current)
    rd = ws.run_dir(period)
    try:
        r = run_collect(ws.s, ws.roster.active, ws.profiles, period, rd, provider, input_path)
    except (LLMError, ValueError) as e:
        raise click.ClickException(str(e))
    click.echo(f"[采集] {r}")
    rep = analyze(ws, rd)
    click.echo(f"[分析] 候选事件 {rep['dedup']['events']}，入选 {rep['selection'].get('selected')}，"
               f"待复核 {rep['needs_review']}")
    c = compose(ws, rd, use_llm=False if no_llm else None)
    click.echo(f"[成稿] {c['count']} 条 → {rd}")


@main.group()
def review():
    """人工复核。"""


@review.command("apply")
@click.argument("csv_path", type=click.Path(exists=True, path_type=Path))
@click.pass_context
def review_apply(ctx, csv_path):
    """回写 review.csv 的 decision 列（keep/drop/wrong_person/confirm）到 data/overrides.yaml。
    之后重新执行 analyze + compose 即可生效，且对今后各期持续生效。"""
    ws = _ws(ctx)
    click.echo(apply_review(ws, csv_path))


@main.command("publish")
@click.argument("run")
@click.pass_context
def publish_cmd(ctx, run):
    """定稿后归档：用于跨期去重和委员画像中的动态时间线。"""
    ws = _ws(ctx)
    rd = _resolve_run(ws, run)
    n = publish(ws, rd)
    click.echo(f"{load_period(rd).run_name} 已归档 {n} 条")


@main.command("demo")
@click.option("--out", default="demo_workspace", type=click.Path(path_type=Path))
def demo_cmd(out):
    """用虚构名单和虚构报道离线演示完整流程（不调用任何接口）。"""
    from .demo import run_demo
    click.echo(run_demo(out))


if __name__ == "__main__":
    main()
