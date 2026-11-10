> 说明：这是上一版的 Python 命令行实现，现作为算法参考保留；当前版本见仓库根目录（微信小程序 + 云开发）。

# SMP 委员学术动态生产工具

为中国中文信息学会社会媒体处理专委会（SMP）微信公众号生产**委员学术动态周报 / 月报**。
流水线分三个阶段：**数据采集 → 数据分析 → 数据成稿**。工具同时维护委员名单（支持变更）和每位委员的画像档案。

> 收录范围：默认**只收录学术相关动态**，包括学术活动、学术荣誉/获奖、学术成果、科研项目、学术任职与服务、学术影响力。
> 商业合作、融资、娱乐、生活、行政通知等内容会被过滤，过滤原因写入每期的 `filtered.jsonl`，可以追溯。

```
┌──────────── 数据采集 ────────────┐   ┌──────────────────── 数据分析 ─────────────────────┐   ┌────── 数据成稿 ──────┐
 名单+画像 → 查询计划(分层/学术限定)    清洗(URL规范化/日期/窗口) → 人物消歧 → 学术过滤 → 分类分级
          → DeepSeek 开放搜索          → 去重聚类(转载/同事件/跨期) → 重要性打分 → 排序摘选(30~50条)    → LLM改写(事实校验)
          → (可选)Fetch 回查正文                                                                  → Markdown/公众号HTML
          → 或 JSONL 导入人工报送                                                                  → 复核表 review.csv
└──────────────────────────────────┘   └────────────────────────────────────────────────────┘   └──────────────────────┘
                     ↑                                        人工复核 review apply → overrides.yaml（长期生效）
                     └──────── publish 归档 → 跨期去重 + 画像动态时间线 ←─────────────────────────────┘
```

## 快速开始

```bash
pip install -e ".[pinyin,dev]"
```

```bash
export DEEPSEEK_API_KEY=sk-xxxx
```

离线演示（虚构名单与虚构报道，不调用任何接口）：

```bash
smp demo --out demo_workspace
```

正式使用（仓库已导入 2026-11-10 版名单，共 401 人）：

```bash
smp plan weekly                 # 预览查询计划与调用量
```

```bash
smp run weekly                  # 一键：采集 → 分析 → 成稿（默认统计上一个完整自然周）
```

```bash
smp run monthly                 # 月报（默认上一个自然月，复用当月周报数据再补充搜索）
```

每期产物在 `runs/<weekly-2026-W45 | monthly-2026-10>/` 下：

| 文件 | 内容 |
|---|---|
| `raw.jsonl` / `queries.jsonl` | 采集原始结果、查询日志 |
| `items.jsonl` | 清洗后的报道，含每位候选委员的消歧置信度与证据 |
| `filtered.jsonl` | 被过滤的条目及原因（未匹配委员 / 同名者 / 非学术 / 窗口外…） |
| `events.jsonl` | 去重后的全部候选事件，含打分明细与是否入选 |
| `analysis_report.json` | 各环节数量统计 |
| `draft.md` | 稿件（Markdown） |
| `draft_wechat.html` | 公众号排版稿（内联样式，可直接粘贴到公众号编辑器） |
| `review.csv` | 编辑复核表（Excel 可直接打开） |

## 一期的标准作业流程（SOP）

1. `smp run weekly`：生成初稿。
2. 打开 `review.csv` 复核。重点看 `needs_review=Y` 的行（人物不确定、名单内重名），在 `decision` 列填写：
   - `keep`：强制入选；`drop`：不入选；
   - `wrong_person`：人物识别错误，该事件的所有转载链接今后都不再匹配此人；
   - `confirm`：人物确认无误。
3. 运行 `smp review apply runs/weekly-2026-W45/review.csv`，复核结论写入 `data/overrides.yaml`，**对今后各期持续生效**。
4. 重新执行 `smp analyze weekly-2026-W45` 和 `smp compose weekly-2026-W45`，得到终稿。
5. 发布后执行 `smp publish weekly-2026-W45` 归档。归档用于下一期的跨期去重，也会出现在委员画像的动态时间线中。

也可以分步执行：`smp collect weekly`、`smp analyze <run>`、`smp compose <run> [--no-llm]`。

## 委员名单管理（支持变更）

```bash
smp roster import 新名单.txt --dry-run       # 先看变更：新增/离任/身份变化/单位变化
```

```bash
smp roster import 新名单.txt --effective 2027-01-01
```

```bash
smp roster stats                             # 各身份人数、名单内重名
```

```bash
smp roster history 王博                      # 某人的名单变更记录
```

- 输入格式有两种：官网“委员介绍”页面的纯文本（原样复制即可），或 CSV（表头 `name,org,roles`，roles 用 `;` 分隔）。
- 每人有稳定 ID（`M0001`…）。姓名与单位都相同视为同一人。姓名相同、单位不同且无歧义时视为**单位变更**，沿用原 ID，并提示人工确认。
- 离任者置为 `inactive`，档案和历史保留，不物理删除；再次入选时恢复原 ID。
- 变更日志写入 `data/roster/history.jsonl`。
- 同一人可同时有多个身份（roles 为列表）。名单内同名不同人目前有三组：王博（哈工大 / 天大）、李倩（山大 / 北邮）、刘洋（武大 / 劳瑞尔大学），按不同的人分别建档。

## 委员画像档案

每人一个 YAML 文件：`data/profiles/M0001.yaml`。

```bash
smp profile show 王博@天津大学     # 档案 + 名单变更 + 已发布动态时间线
```

```bash
smp profile check                 # 列出重名/常见名且信息不全、最该优先补全的委员
```

```bash
smp profile enrich 王博@天津大学   # DeepSeek 搜索补全（只填空字段，verified=false 待核验）
```

```bash
smp profile sync                  # 名单变更后重算自动字段
```

| 字段 | 说明 |
|---|---|
| `name / org / roles / status` | 由名单自动同步 |
| `org_history` | 单位变更历史（自动记录） |
| `aliases` | 其他写法，如英文名、曾用名 |
| `title / department / research_areas / homepage / scholar / bio` | 基本学术画像 |
| `keywords` | **消歧正向词**：研究方向、实验室/团队名、代表成果 |
| `negative_keywords` | **同名者特征词**，如“演员”“足球” |
| `org_aliases / trusted_domains / exclude_url_patterns` | 单位补充别名、可信域名（命中加分）、已知同名者网页（直接排除） |
| `auto.*` | 自动生成：拼音英文名、单位别名、常见名标记、名单内重名对象 |
| `verified` | 人工核验标记 |

人工填写的字段永远不会被自动流程覆盖。画像越完整（尤其是 `keywords` 和 `negative_keywords`），消歧越准。

## 关键算法

### 1. 数据采集

- 查询带学术限定词（`学术`、`获奖 报告 论文`、`学术会议 特邀报告`），模板可在 `collect.member_queries` 中配置。
- **分层采集**：主任、副主任、常务委员等核心层每期跑 2 条模板，其余委员跑 1 条，401 人每周约 471 次查询；专委会自身另有组织级查询。
- 所有搜索和 LLM 调用都有磁盘缓存（`data/cache/`），重跑不会重复计费；带全局限速和指数退避重试。
- 可选 `collect.verify_urls: true`：用 DeepSeek Fetch API 回查正文，补全内容并剔除失效链接。
- `--provider jsonl --input 报送.jsonl` 可导入人工报送或其他爬虫的结果，和搜索结果走同一套分析流程。
- 月报默认合并当月各期周报的原始数据，再补充采集。

### 2. 人物消歧（`smp/analyze/disambiguate.py`）

1. **姓名识别**：名单姓名加画像别名，按长度降序匹配，长名优先占位（“张伟男”不会被识别成“张伟”，“李斌阳”不会被识别成“李斌”）。两字姓名做右边界校验：“王博士”≠“王博”，“李生物”≠“李生”。
2. **证据打分（0~1）**

   | 证据 | 分值 |
   |---|---|
   | 姓名附近出现本人单位（含别名） | +0.35（全文出现 +0.20） |
   | 学术语境词 | +0.10 |
   | 研究方向/关键词命中 | 每个 +0.05，最多 +0.20 |
   | 可信域名 | +0.30 |
   | 查询来源 | +0.10 |
   | 专委会语境 | +0.10 |
   | 标题提及 | +0.05 |
   | 同名者特征词 | −0.35 |
   | 姓名紧邻其他单位 | −0.15 |
   | 常见姓名 | −0.10 |

3. **名单内重名**：分别打分，差距 ≥ 0.15 时判给高者，否则标记待复核。
4. **阈值**：≥0.6 确认，<0.4 否定，中间段交给 DeepSeek 裁决（输入画像和原文片段，输出 yes/no/unsure）。仍不确定的进入复核表。
5. **人工结论**（`overrides.yaml`）优先级最高，且长期有效。

### 3. 学术过滤与分类（`classify.py`）

- 学术信号词计数（标题按 2 倍计）必须 ≥ 1，且不少于非学术信号；标题命中“招生简章、讣告、通知”等直接剔除。
- 栏目：专委会动态、学术荣誉、学术成果、科研项目、学术活动、学术任职与服务、学术影响力、其他学术动态。标题强信号优先，例如“论文获最佳论文奖”归入荣誉。
- 级别：院士/Fellow/国家级奖/最佳论文/杰青等为 1.0，顶会/重点项目/主旨报告/优青等为 0.7，以此类推。

### 4. 去重（`dedup.py`）

1. **文档级**：URL 规范化（去追踪参数、移动域名，微信文章按 `__biz/mid/idx/sn`）。正文 3-gram Jaccard ≥ 0.6 或标题相似度 ≥ 0.72 视为转载或洗稿。
2. **事件级**：同一委员、同一栏目、7 天内，标题相似或命中同一关键荣誉词（如同为“IEEE Fellow”），视为同一事件。多家报道合并为一条，保留权威度最高的信源，其余计入覆盖度。
3. **跨期**：与过去 90 天**同类刊期**（周报对周报、月报对月报）已发布的事件比对，避免重复上稿。月报是当月汇总，可以收录周报发过的内容。

只在“共享同一委员”的分块内两两比较，计算量随单人报道数增长，而不是随总条数平方增长。

### 5. 重要性打分（`scoring.py`，0~100，明细写入 `score_detail`）

```
score = 100 × (0.25·栏目 + 0.20·级别 + 0.10·身份 + 0.15·信源权威度 + 0.10·报道覆盖度 + 0.10·领域相关性 + 0.10·时效)
        × (0.6 + 0.4·消歧置信度) × [跨期已发布 0.3] × [无日期 0.8] + [专委会动态 +15]
```

权重、身份系数、信源权威度表（gov.cn、cipsc.org.cn、edu.cn、新华网… → 自媒体）都可在 `config/settings.yaml` 中调整。

### 6. 排序摘选（`select.py`）

- 默认每期选 **30~50 条**（`selection.weekly/monthly`）。
- 专委会动态和人工 `keep` 必选；其余贪心选取。同一委员第 n 条乘以 0.75^(n−1) 衰减，并设每人上限（周报 2 条、月报 3 条）。各栏目设占比上限（学术活动 ≤40%、影响力 ≤20%），避免单一栏目刷屏。
- 分数达到门槛（周报 25、月报 35）的选满为止。不足 30 条时逐步放宽到 12 分，仍不足则在报告中给出缺口数。

### 7. 成稿（`compose/writer.py`）

- 默认使用抽取式标题和摘要；有 API Key 时由 DeepSeek 改写（标题以委员姓名开头、摘要不超过 120 字、客观平实）。
- **事实校验**：改写稿缺少委员姓名、出现原文没有的数字、或长度异常时，自动回退为抽取式摘要，并在复核表中注明原因。
- 编者按由 LLM 根据本期要点生成，同样经过事实校验，失败则使用模板。
- 公众号 HTML 全部用内联样式（公众号编辑器会过滤 `<style>` 和 class）。公众号正文中的外链不可点击，所以来源以“来源：xx · 日期 [n]”加文末参考链接的形式呈现。

## DeepSeek 接口配置

`config/settings.yaml → deepseek`：

- Chat：OpenAI 兼容接口 `POST {base_url}/chat/completions`，模型 `deepseek-chat`。
- 开放搜索：`POST {base_url}/v1/tools/search`；正文抓取：`POST {base_url}/v1/tools/fetch`。
- **请求字段名、额外参数和结果字段位置都可以在配置中调整**（`query_field`、`count_field`、`extra_body`、`time_range_body`、`results_path`）。结果映射兼容 `title/url|link/snippet|summary/content/publish_time|date/site_name` 等常见写法。

> ⚠️ 开发时无法访问 DeepSeek 官方文档，以上字段按公开信息设置了默认值。首次上线前，请按 [Search API 官方文档](https://api-docs.deepseek.com/guides/search)
> 核对请求和返回字段（尤其是条数、时间范围、是否返回正文这几个参数名）。只需修改配置，不用改代码。
> 建议先用 `smp collect weekly --member 唐杰` 小范围试跑，再查看 `runs/*/raw.jsonl`。

## 定时运行

可以用 crontab 示例，也可以用任意调度系统：

```bash
# 每周一 08:30 生成上周周报初稿；每月 1 日 09:00 生成上月月报初稿
30 8 * * 1  cd /path/to/SMP && DEEPSEEK_API_KEY=sk-xxx smp run weekly
0 9 1 * *   cd /path/to/SMP && DEEPSEEK_API_KEY=sk-xxx smp run monthly
```

## 目录结构

```
config/settings.yaml        全局配置（权重、阈值、查询模板、条数范围…）
config/org_aliases.yaml     单位规范名 → 别名（消歧与查询使用，新增单位只改这里）
data/roster/sources/        历次名单原文（留档）
data/roster/members.yaml    当前结构化名单（由 roster import 维护）
data/roster/history.jsonl   名单变更日志
data/profiles/Mxxxx.yaml    委员画像档案
data/overrides.yaml         人工复核结论（自动生成）
data/archive/events.jsonl   已发布事件归档（自动生成）
smp/                        源码：collect / analyze / compose / pipeline / cli
tests/                      单元测试与端到端演示测试（pytest）
```

## 开发与测试

```bash
python -m pytest -q
```

测试覆盖：名单解析（401 人、重名）、名单增删改同步、消歧（重名按单位判定、边界、长名优先、同名演员、英文名、人工覆盖）、清洗、学术过滤、分类、去重聚类、30~50 条选取与上限、事实校验、DeepSeek 接口映射与缓存，以及端到端演示。
