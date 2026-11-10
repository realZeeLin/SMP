'use strict';
/**
 * 云端流水线：创建期刊 → 任务队列采集（DeepSeek search，增量清洗/消歧/过滤）→ 汇总分析 → 成稿 → 发布归档。
 * 采集由定时触发器（每分钟）与前端“推进”调用共同驱动，每次在时间预算内处理一批任务，
 * 以适应云函数单次执行时长限制。任务领取使用条件更新，避免并发重复处理。
 */
const { DeepSeek } = require('../lib/deepseek');
const { resolvePeriod, planQueries, buildSearchQuery } = require('../lib/collect');
const { MemberIndex, Disambiguator } = require('../lib/disambiguate');
const { processBatch, finalize } = require('../lib/analyze');
const { buildIssue } = require('../lib/compose');
const { addDays } = require('../lib/text');

const STALE_MS = 5 * 60e3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createPipeline(store, cloud) {
  const { db, _, col, getAll, addMany, removeWhere, getDoc } = store;

  async function activeMembers() {
    return getAll(col('members').where({ status: 'active' }));
  }

  async function overrides() { return getAll(col('overrides')); }

  // ---------------- 创建期刊 ----------------
  async function start({ kind, ref, current = false, force = false, memberIds = null }, operator) {
    const settings = await store.settings();
    const period = resolvePeriod(kind, ref || undefined, current);
    const existing = await getDoc('issues', period.id);
    if (existing && !force && existing.status !== 'failed') return { issueId: period.id, existed: true, status: existing.status };
    if (existing) await resetIssue(period.id);
    const members = await activeMembers();
    const aliases = await store.aliasMap();
    let only = memberIds ? new Set(memberIds) : null;
    if (kind === 'monthly' && !only) {
      // 月报：当月周报已覆盖的部分直接复用，只为核心层与组织查询补充采集
      const weeklies = await weeklyIssuesIn(period);
      if (weeklies.length) {
        const core = new Set((settings.collect.tiers || {}).core_roles || []);
        only = new Set(members.filter((m) => m.roles.some((r) => core.has(r))).map((m) => m._id));
        only.__withOrg = true;
      }
    }
    let queries = planQueries(settings, members, aliases, period, only);
    if (only && only.__withOrg) queries = queries.concat(planQueries(settings, [], aliases, period));
    const now = db.serverDate();
    await col('issues').doc(period.id).set({ data: {
      kind, label: period.label, start: period.start, end: period.end, status: queries.length ? 'collecting' : 'analyzing',
      progress: { tasks: queries.length, done: 0, failed: 0 },
      stats: { raw: 0, kept: 0, filtered: {} }, title: '', editorNote: '', count: 0, dirty: false,
      createdBy: operator || 'system', createdAt: now, updatedAt: now,
    } });
    await addMany('tasks', queries.map((q) => ({ issueId: period.id, type: 'search', query: buildSearchQuery(q.query, period, settings), oriQuestion: q.oriQuestion || '', memberId: q.memberId, kind: q.kind,
      status: 'pending', attempts: 0, createdAt: now })));
    return { issueId: period.id, tasks: queries.length };
  }

  async function weeklyIssuesIn(period) {
    const { data } = await col('issues').where({ kind: 'weekly', start: _.lte(period.end), end: _.gte(period.start) }).limit(10).get();
    return data;
  }

  async function resetIssue(issueId) {
    for (const c of ['tasks', 'raw_batches', 'items', 'filtered', 'events']) await removeWhere(c, { issueId });
  }

  // ---------------- 采集推进 ----------------
  async function claim(issueId, n) {
    await col('tasks').where({ status: 'running', lockedAt: _.lt(new Date(Date.now() - STALE_MS)) }).update({ data: { status: 'pending' } });
    const where = issueId ? { issueId, status: 'pending' } : { status: 'pending' };
    const { data } = await col('tasks').where(where).orderBy('createdAt', 'asc').limit(n).get();
    const claimed = [];
    for (const t of data) {
      const r = await col('tasks').where({ _id: t._id, status: 'pending' }).update({ data: { status: 'running', lockedAt: db.serverDate() } });
      if (r.stats.updated === 1) claimed.push(t);
    }
    return claimed;
  }

  async function runTask(t, ctxByIssue, ds) {
    const ctx = ctxByIssue[t.issueId];
    try {
      const results = await ds.search(t.query, t.oriQuestion ? { ori_question: t.oriQuestion } : {});
      const max = ctx.settings.collect.content_max_chars || 1500;
      const trimmed = results.map((r) => ({ ...r, content: String(r.content || '').slice(0, max) }));
      await col('raw_batches').add({ data: { issueId: t.issueId, taskId: t._id, query: t.query, memberId: t.memberId, provider: 'deepseek', results: trimmed, createdAt: db.serverDate() } });
      const out = await processBatch(trimmed, { settings: ctx.settings, period: ctx.period, disambiguator: ctx.dis, queryMemberId: t.memberId });
      await addMany('items', out.kept.map((it) => ({ ...it, issueId: t.issueId })));
      await addMany('filtered', out.filtered.map((f) => ({ ...f, issueId: t.issueId, createdAt: db.serverDate() })));
      await col('tasks').doc(t._id).update({ data: { status: 'done', nResults: results.length, nKept: out.kept.length, doneAt: db.serverDate() } });
      const inc = { 'progress.done': _.inc(1), 'stats.raw': _.inc(out.stats.raw), 'stats.kept': _.inc(out.stats.kept), updatedAt: db.serverDate() };
      out.filtered.forEach((f) => { inc[`stats.filtered.${f.reason}`] = _.inc(1); });
      if (out.stats.outOfWindow) inc['stats.filtered.窗口外'] = _.inc(out.stats.outOfWindow);
      await col('issues').doc(t.issueId).update({ data: inc });
    } catch (e) {
      // HTTP 402 账户余额不足 / 401 Key 无效：任务退回队列，不计失败，本轮停止
      if (e.status === 402 || e.status === 401) {
        await col('tasks').doc(t._id).update({ data: { status: 'pending', error: String(e.message || e).slice(0, 300) } });
        return { stop: e.status === 402 ? 'DeepSeek 账户余额不足（HTTP 402），请充值后继续' : 'DeepSeek API Key 无效（HTTP 401）' };
      }
      const attempts = (t.attempts || 0) + 1;
      const failed = attempts >= 3;
      await col('tasks').doc(t._id).update({ data: { status: failed ? 'failed' : 'pending', attempts, error: String(e.message || e).slice(0, 300) } });
      if (failed) await col('issues').doc(t.issueId).update({ data: { 'progress.failed': _.inc(1), 'progress.done': _.inc(1) } });
    }
  }

  async function buildCtx(issueId, settings, members, aliases, ovs, ds) {
    const issue = await getDoc('issues', issueId);
    const period = { kind: issue.kind, start: issue.start, end: issue.end, label: issue.label, id: issueId };
    return { settings, period, dis: new Disambiguator(settings, new MemberIndex(members, aliases), ovs, ds) };
  }

  /** 在时间预算内处理一批任务；某期任务全部完成后自动进入分析与成稿。 */
  async function pump({ issueId = null, budgetMs = 40000 } = {}) {
    const t0 = Date.now();
    const settings = await store.settings();
    const ds = new DeepSeek(settings.deepseek, store.cacheStore);
    if (!ds.available) return { processed: 0, error: '未配置 DEEPSEEK_API_KEY' };
    const [members, aliases, ovs] = await Promise.all([activeMembers(), store.aliasMap(), overrides()]);
    const ctxByIssue = {};
    const conc = settings.collect.concurrency || 4;
    let processed = 0;
    const touched = new Set(issueId ? [issueId] : []);
    while (Date.now() - t0 < budgetMs) {
      const tasks = await claim(issueId, conc);
      if (!tasks.length) break;
      for (const t of tasks) {
        touched.add(t.issueId);
        if (!ctxByIssue[t.issueId]) ctxByIssue[t.issueId] = await buildCtx(t.issueId, settings, members, aliases, ovs, ds);
      }
      const outs = await Promise.all(tasks.map((t) => runTask(t, ctxByIssue, ds)));
      processed += tasks.length;
      const stop = outs.find((o) => o && o.stop);
      if (stop) return { processed, finished: [], error: stop.stop, elapsedMs: Date.now() - t0 };
      await sleep(Math.ceil(1000 / (settings.deepseek.qps || 4)));
    }
    const finished = [];
    for (const id of touched) {
      const { total } = await col('tasks').where({ issueId: id, status: _.in(['pending', 'running']) }).count();
      const issue = await getDoc('issues', id);
      if (!total && issue && issue.status === 'collecting' && Date.now() - t0 < budgetMs + 10000) {
        await analyze(id);
        if ((settings.schedule || {}).auto_compose !== false) await compose(id);
        finished.push(id);
      }
    }
    return { processed, finished, elapsedMs: Date.now() - t0 };
  }

  // ---------------- 分析 ----------------
  async function analyze(issueId) {
    const settings = await store.settings();
    const issue = await getDoc('issues', issueId);
    await col('issues').doc(issueId).update({ data: { status: 'analyzing', updatedAt: db.serverDate() } });
    const period = { kind: issue.kind, start: issue.start, end: issue.end, label: issue.label, id: issueId };
    let items = await getAll(col('items').where({ issueId }));
    if (issue.kind === 'monthly') {
      const weeklies = await weeklyIssuesIn(period);
      for (const w of weeklies) {
        const wi = await getAll(col('items').where({ issueId: w._id, published: _.gte(period.start).and(_.lte(period.end)) }));
        items = items.concat(wi);
      }
    }
    const members = await getAll(col('members'));
    const archive = await getAll(col('archive').where({ kind: issue.kind, issueDate: _.gte(addDays(period.start, -((settings.dedup || {}).history_days || 90))) }));
    const out = finalize(items, { settings, period, members, overrides: await overrides(), archive });
    // 保留编辑对标题/摘要的手工修改
    const old = await getAll(col('events').where({ issueId }), { eventId: true, headline: true, blurb: true, manualEdited: true });
    const kept = new Map(old.filter((e) => e.manualEdited).map((e) => [e.eventId, e]));
    out.events.forEach((e) => { const o = kept.get(e.eventId); if (o) Object.assign(e, { headline: o.headline, blurb: o.blurb, manualEdited: true }); });
    await removeWhere('events', { issueId });
    await addMany('events', out.events.map((e) => ({ ...e, updatedAt: db.serverDate() })));
    await col('issues').doc(issueId).update({ data: { status: 'reviewing', dirty: false, analyzedAt: db.serverDate(), updatedAt: db.serverDate(),
      'stats.items': out.report.items, 'stats.events': out.report.events, 'stats.selected': out.report.selected,
      'stats.needsReview': out.report.needsReview, 'stats.categories': out.report.categories, 'stats.selection': out.report } });
    return out.report;
  }

  // ---------------- 成稿 ----------------
  async function compose(issueId) {
    const settings = await store.settings();
    const issue = await getDoc('issues', issueId);
    const period = { kind: issue.kind, start: issue.start, end: issue.end, label: issue.label, id: issueId };
    const events = await getAll(col('events').where({ issueId, selected: true }));
    const members = await getAll(col('members'), { name: true, org: true });
    const byId = Object.fromEntries(members.map((m) => [m._id, m]));
    const ds = new DeepSeek(settings.deepseek, store.cacheStore);
    const result = await buildIssue(settings, period, events, byId, ds);
    await Promise.all(events.map((e) => col('events').doc(e._id).update({ data: { headline: e.headline, blurb: e.blurb, rank: e.rank, reviewNotes: e.reviewNotes || [] } })));
    await col('issues').doc(issueId).update({ data: { title: result.title, editorNote: result.editorNote, count: result.count,
      markdown: result.markdown, html: result.html, sections: result.sections.map((s) => ({ key: s.key, name: s.name, n: s.events.length })),
      composedAt: db.serverDate(), updatedAt: db.serverDate(), dirty: false } });
    return { count: result.count, title: result.title };
  }

  // ---------------- 发布 / 导出 ----------------
  async function publish(issueId) {
    const issue = await getDoc('issues', issueId);
    const events = await getAll(col('events').where({ issueId, selected: true }));
    await removeWhere('archive', { issueId });
    await addMany('archive', events.map((e) => ({ eventId: e.eventId, issueId, kind: issue.kind, issueDate: issue.end, published: e.published,
      category: e.category, title: e.title, headline: e.headline, memberIds: e.memberIds, urls: e.sources.map((s) => s.url), score: e.score, createdAt: db.serverDate() })));
    const perMember = {};
    events.forEach((e) => e.memberIds.forEach((m) => {
      const d = e.published || issue.end;
      if (!perMember[m] || d > perMember[m]) perMember[m] = d;
    }));
    await Promise.all(Object.entries(perMember).map(([m, last]) => col('members').doc(m).update({ data: {
      'stats.eventCount': _.inc(events.filter((e) => e.memberIds.includes(m)).length), 'stats.lastEventAt': last, 'stats.lastIssue': issueId } })));
    await col('issues').doc(issueId).update({ data: { status: 'published', publishedAt: db.serverDate(), updatedAt: db.serverDate() } });
    return { archived: events.length };
  }

  async function exportHtml(issueId) {
    const issue = await getDoc('issues', issueId);
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
      + `<title>${issue.title}</title></head><body style="margin:0 auto;max-width:640px;padding:16px;">${issue.html}</body></html>`;
    const { fileID } = await cloud.uploadFile({ cloudPath: `exports/${issueId}.html`, fileContent: Buffer.from(html, 'utf8') });
    const { fileList } = await cloud.getTempFileURL({ fileList: [fileID] });
    await col('issues').doc(issueId).update({ data: { exportFileID: fileID } });
    return { fileID, url: fileList[0].tempFileURL, markdown: issue.markdown };
  }

  // ---------------- 定时任务 ----------------
  async function scheduled(now = new Date()) {
    const settings = await store.settings();
    const s = settings.schedule || {};
    const cn = new Date(now.getTime() + 8 * 3600e3);
    const hour = cn.getUTCHours(); const min = cn.getUTCMinutes();
    const created = [];
    if (min === 0 && s.weekly && s.weekly.enabled && cn.getUTCDay() === (s.weekly.weekday ?? 1) && hour === (s.weekly.hour ?? 8)) {
      created.push(await start({ kind: 'weekly' }, 'scheduler'));
    }
    if (min === 0 && s.monthly && s.monthly.enabled && cn.getUTCDate() === (s.monthly.day ?? 1) && hour === (s.monthly.hour ?? 9)) {
      created.push(await start({ kind: 'monthly' }, 'scheduler'));
    }
    if (min === 30 && hour === 3) await col('cache').where({ expireAt: _.lt(new Date()) }).remove();
    const pumped = await pump({ budgetMs: 45000 });
    return { created, pumped };
  }

  return { start, pump, analyze, compose, publish, exportHtml, scheduled, resetIssue };
}

module.exports = { createPipeline };
