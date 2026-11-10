# 云数据库设计（微信云开发 · 文档型数据库）

设计原则：

1. **小程序端不直连数据库**。所有集合的安全规则都是 `read:false / write:false`，读写一律经过云函数 `smp`。云函数先按 `admins` 校验 OPENID 和角色，再操作数据库。
2. **按访问路径冗余**：委员名单和画像合在 `members` 一个文档里，列表页一次就能读到姓名、单位、身份、完整度和动态数，不需要联表。
3. **大数据分批落库**：采集结果按“查询任务”存储；清洗、消歧、学术过滤在采集时增量完成，只把命中委员的学术条目落到 `items`。分析阶段只读这部分数据，每次运行都能控制在云函数时限内。
4. 时间字段统一用 `Date`（服务端 `db.serverDate()`），业务日期（新闻发布日、周期起止）统一用 `YYYY-MM-DD` 字符串，便于比较和展示。

## 集合一览

| 集合 | 用途 | 规模（估算） |
|---|---|---|
| `admins` | 编辑/管理员白名单 | 个位数 |
| `members` | 委员名单 + 画像档案 + 统计 | 约 400，随换届增长 |
| `roster_versions` | 名单版本（每次导入一条） | 每年数条 |
| `roster_changes` | 名单变更明细（新增/离任/身份/单位变化） | 数百 |
| `issues` | 期刊（周报/月报）及稿件 | 每年约 64 |
| `tasks` | 采集任务队列（一个查询一条） | 每期约 470 |
| `raw_batches` | 搜索原始结果（每个任务一条，内含结果数组） | 每期约 470 |
| `items` | 命中委员的学术报道（已清洗、消歧、分类） | 每期数百 |
| `filtered` | 被过滤条目及原因（审计用） | 每期数百 |
| `events` | 去重聚类后的候选事件（打分、入选、复核状态） | 每期 100~300 |
| `overrides` | 人工复核结论（长期生效） | 持续累积 |
| `archive` | 已发布事件归档（跨期去重、画像时间线） | 每期 30~50 |
| `cache` | DeepSeek search/fetch/chat 响应缓存 | 定期清理 |
| `config` | 系统配置（打分权重、阈值、查询模板、单位别名、公众号同步记录） | 3 条 |
| `feed` | 组织日常学术动态信息流（含社媒派SMP 公众号文章，统一检索） | 持续累积 |
| `feed_jobs` | 管理端“拉取最新动态”任务（范围、窗口、进度） | 每天数条 |

---

## 1. `admins`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `openid` | string | 微信 OPENID |
| `name` | string | 显示名 |
| `role` | string | `admin`（可改配置、导入名单、发布）/ `editor`（复核、改稿） |
| `createdAt` | Date | |

索引：`openid`（唯一）。首次部署时，第一位调用 `auth.bootstrap` 的用户成为管理员，后续由管理员邀请。

## 2. `members`（名单 + 画像）

```jsonc
{
  "_id": "M0001",                 // 稳定 ID，换届/改单位不变
  "name": "李生",                 // 规范姓名（去空格）
  "displayName": "李　生",        // 名单原样
  "org": "哈尔滨工业大学",
  "roles": ["指导委员会主任"],
  "roleRank": 0,                  // 身份排序值（越小越靠前），列表排序用
  "status": "active",             // active | inactive（离任保留档案）
  "joined": "2026-11-10", "left": null,
  "orgHistory": [{ "org": "哈尔滨工业大学", "since": "2026-11-10" }],
  "initial": "L",                 // 拼音首字母，委员名录 A–Z 索引
  "profile": {                    // —— 人工维护，自动流程不覆盖 ——
    "aliases": [], "title": "", "department": "",
    "researchAreas": [], "keywords": [], "negativeKeywords": [],
    "orgAliases": [], "homepage": "",
    "scholar": { "dblp": "", "googleScholar": "", "orcid": "", "aminer": "" },
    "trustedDomains": [], "excludeUrlPatterns": [],
    "bio": "", "notes": "", "verified": false,
    "enriched": { "date": "", "sources": [], "fields": [] }   // AI 补全记录
  },
  "auto": {                       // —— 自动计算，可随时重算 ——
    "englishNames": ["Sheng Li", "Li Sheng"],
    "orgNames": ["哈尔滨工业大学", "哈工大", "HIT"],
    "commonName": true,           // 常见姓名
    "homonyms": []                // 名单内同名者 ID
  },
  "completeness": 0.2,            // 画像完整度 0~1
  "stats": { "eventCount": 0, "lastEventAt": null, "lastIssue": null },
  "updatedAt": "Date"
}
```

索引：`status + roleRank`、`name`、`org`、`initial`、`stats.lastEventAt`（降序）。

## 3. `roster_versions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `effective` | string | 生效日期 |
| `source` | string | 来源说明（如“官网 2026-11-10”） |
| `total` | number | 解析人数 |
| `summary` | object | `{added, removed, reactivated, roleChanged, orgChanged, unchanged}` |
| `operator` | string | 操作人 OPENID |
| `createdAt` | Date | |

## 4. `roster_changes`

| 字段 | 类型 | 说明 |
|---|---|---|
| `versionId` | string | 关联 `roster_versions._id` |
| `memberId` / `name` | string | |
| `type` | string | `added / removed / reactivated / role_changed / org_changed` |
| `before` / `after` | any | 变更前后 |
| `date` | string | 生效日期 |

索引：`memberId + date`、`versionId`。

## 5. `issues`（期刊 / 稿件）

```jsonc
{
  "_id": "weekly-2026-W45",       // kind-label，天然防重
  "kind": "weekly",               // weekly | monthly
  "label": "2026-W45", "start": "2026-11-02", "end": "2026-11-08",
  "status": "collecting",         // collecting → analyzing → reviewing → published（failed）
  "progress": { "tasks": 471, "done": 120, "failed": 0 },
  "stats": {
    "raw": 0, "items": 0, "events": 0, "selected": 0, "needsReview": 0,
    "filtered": { "未匹配委员": 0, "非学术内容": 0, "窗口外": 0 },
    "categories": { "honor": 6 }
  },
  "title": "SMP 委员动态周报 | 2026年第45期（11.02—11.08）",
  "editorNote": "…",
  "count": 42,
  "markdown": "…", "html": "…",   // 成稿（公众号内联样式 HTML）
  "exportFileID": "cloud://…",     // 导出到云存储的 HTML 文件
  "createdBy": "openid", "createdAt": "Date", "updatedAt": "Date",
  "analyzedAt": "Date", "composedAt": "Date", "publishedAt": "Date"
}
```

索引：`kind + start`（降序）、`status`。

## 6. `tasks`（采集任务队列）

| 字段 | 类型 | 说明 |
|---|---|---|
| `issueId` | string | |
| `type` | string | `search`（预留 `fetch`） |
| `query` | string | 查询词 |
| `memberId` | string? | 委员查询对应的 ID；组织查询为空 |
| `status` | string | `pending / running / done / failed` |
| `attempts` | number | 已尝试次数（≥3 次标记 failed） |
| `lockedAt` | Date | 领取时间，超时 5 分钟视为僵死并重新领取 |
| `nResults` / `nKept` | number | 结果数 / 命中保留数 |
| `error` | string | |

索引：`status + createdAt`、`issueId + status`。

## 7. `raw_batches`

每个任务一条，`results` 数组保存该查询的原始结果（正文截断到 1500 字），方便复跑和审计：
`{ issueId, taskId, query, memberId, provider: "deepseek", results: [{title, url, snippet, content, site, published}], createdAt }`

索引：`issueId`。

## 8. `items`（命中委员的学术报道）

```jsonc
{
  "issueId": "weekly-2026-W45",
  "itemId": "a1b2c3d4e5f6",            // canonicalUrl 的哈希
  "canonicalUrl": "https://news.hit.edu.cn/…", "url": "…",
  "title": "…", "site": "哈工大新闻网", "domain": "news.hit.edu.cn",
  "published": "2026-11-03", "text": "…(≤1500字)",
  "queryMemberIds": ["M0005"],
  "mentions": [{ "memberId": "M0005", "name": "…", "confidence": 0.85,
                 "status": "confirmed", "evidence": ["单位邻近:哈工大", "学术语境"], "method": "rules" }],
  "isOrgNews": false,
  "category": "honor", "level": 1.0, "levelHit": "Fellow"
}
```

索引：`issueId + canonicalUrl`、`issueId + published`。

## 9. `filtered`

`{ issueId, title, url, reason, memberNames: [], createdAt }`，仅记录**提到了委员姓名但被过滤**的条目（同名者、非学术、窗口外），供编辑抽查。索引：`issueId + reason`。

## 10. `events`（候选事件）

```jsonc
{
  "issueId": "weekly-2026-W45",
  "eventId": "9f8e7d6c5b4a",            // 来源 URL 集合哈希
  "title": "…", "url": "…", "site": "…", "published": "2026-11-05",
  "category": "honor", "level": 1.0,
  "memberIds": ["M0005"], "memberNames": ["…"], "memberOrgs": ["…"],
  "confidence": 0.9, "needsReview": false, "reviewNotes": [],
  "isOrgNews": false, "previouslyPublished": false,
  "sources": [{ "title": "…", "url": "…", "site": "…", "published": "…" }],
  "text": "…(≤1500字)",
  "score": 82.4,
  "scoreDetail": { "type": 1, "level": 1, "role": 0.7, "authority": 0.9, "coverage": 0.61,
                   "relevance": 0.67, "recency": 0.58, "confFactor": 0.96, "factor": 0.96, "bonus": 0 },
  "selected": true, "rank": 3,
  "headline": "…", "blurb": "…",        // 成稿标题与摘要（可人工编辑）
  "decision": "",                       // keep | drop | wrong_person | confirm（复核结论）
  "editedBy": "openid", "updatedAt": "Date"
}
```

索引：`issueId + selected + rank`、`issueId + score`（降序）、`issueId + needsReview`、`memberIds`。

## 11. `overrides`（人工结论，跨期长期生效）

| 字段 | 说明 |
|---|---|
| `type` | `mention`（人物判定）/ `event`（条目取舍） |
| `url` | 报道链接（mention 类型以 url + memberId 为键） |
| `memberId` | |
| `eventId` | event 类型 |
| `decision` | mention：`confirm / reject`；event：`keep / drop` |
| `operator` / `createdAt` | |

索引：`type + url`、`eventId`。

## 12. `archive`

`{ eventId, issueId, kind, issueDate, published, category, title, headline, memberIds[], urls[], score, createdAt }`

索引：`kind + issueDate`、`memberIds + published`（委员画像时间线）。

## 13. `cache`

`{ _id: "search:<sha1>", ns: "search|fetch|chat", value, createdAt, expireAt }`。由定时触发器清理过期条目（search/fetch 保留 30 天，chat 保留 90 天）。索引：`expireAt`。

## 14. `config`

- `_id: "settings"`：打分权重、阈值、查询模板、条数范围、学术过滤词表等，结构见 `cloudfunctions/smp/data/default_settings.json`。设置页可修改。
- `_id: "org_aliases"`：`{ map: { "哈尔滨工业大学": ["哈工大", "HIT"], … } }`。

## 15. `feed`（组织日常学术动态）

```jsonc
{
  "_id": "f9a3c…",                       // 规范化 URL 的哈希：多来源同一篇文章自动合并
  "title": "第十三届全国社会媒体处理大会成功举办！", "url": "https://mp.weixin.qq.com/s?…",
  "site": "社媒派SMP", "domain": "mp.weixin.qq.com", "published": "2026-11-08",
  "summary": "…（≤160字）", "text": "…（≤800字）",
  "memberIds": ["M0004"], "memberNames": ["刘挺"], "needsReview": false,
  "category": "org", "level": 0.7,
  "isOrgNews": true,                     // 专委会自身动态（含自有公众号）
  "fromSmpAccount": true,                // 来自社媒派SMP 公众号（不单独分栏，仅用于标识与检索）
  "source": "search",                    // 最近一次来源：search | wechat_mp | manual | issue
  "sources": ["search", "issue"],        // 历次来源
  "keywords": "标题 来源 委员姓名",       // 检索用
  "fetchedAt": "Date"
}
```

索引：`published`（降序）、`isOrgNews + published`、`fromSmpAccount + published`、`memberIds + published`。

## 16. `feed_jobs`（拉取任务）

`{ _id: "feedjob-<时间戳>", scope: "org|core|all", days, start, end, status: "running|done", progress: {tasks, done, failed}, stats: {kept}, estimate: {queries, usd}, createdBy, createdAt, finishedAt }`

检索任务复用 `tasks` 集合（`issueId` 填 `feedjob-…`），由定时触发器与管理页共同推进。索引：`status + createdAt`。

## 安全规则

`database/security-rules.json` 对全部集合生效：客户端不可读写。云函数使用服务端 SDK，不受安全规则约束，并在入口统一做身份和角色校验。
