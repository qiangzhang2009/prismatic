# Corpus Wiki Schema — Prismatic

> **版本**: v1.0
> **用途**: 告知 LLM 如何维护每个 Persona 的语料库 Wiki
> **适用范围**: 所有 corpus/{persona}/wiki/ 目录下的文件

---

## 一、核心理念

每个 Persona 的 `corpus/{id}/wiki/` 目录是一本由 LLM 维护的语料手册。它介于原始语料和蒸馏输出之间 —— 不是原始文件的堆砌，而是经过整理、可追踪、有质量的持久层。

Wiki 的主人是人类，园丁是 LLM。人类负责采集语料、提问、审查；LLM 负责整理、标注、更新。

---

## 二、目录结构

```
corpus/{persona}/
├── texts/                    (原始语料，不可变源文件)
│   ├── file1.txt
│   └── file2.txt
└── wiki/                    (LLM 维护的持久层)
    ├── index.md             (总览：语料清单 + 健康指标)
    ├── corpus-health.md     (词频统计、语义关键词命中率)
    ├── contamination-log.md (污染检测历史)
    └── log.md               (摄入历史，按时间顺序)
```

---

## 三、文件规范

### 3.1 index.md — 总览页

每个 Persona Wiki 的入口。格式如下：

```markdown
# {Persona Name} — 语料 Wiki

## 基本信息
- Persona ID: {id}
- 领域: {domain}
- 语料规模: {total_files} 个文件，{total_words} 词
- 最后更新: {YYYY-MM-DD}

## 语料清单

| 文件名 | 来源 | 类型 | 字数 | 健康状态 |
|--------|------|------|------|----------|
| file1.txt | Gutenberg | primary | 45K | ✅ 正常 |
| file2.txt | SEP | secondary | 12K | ✅ 正常 |

## 健康指标

- **词汇多样性**: {uniqueWordRatio}% (目标 >15%)
- **信号强度**: {strong/medium/weak}
- **语义关键词命中率**: {keywordHitRate}%
- **上次 Lint**: {YYYY-MM-DD}

## 关联 Persona

- [[confucius]] — 同为儒家思想
- [[lao-zi]] — 道家对比

## 最近变更

(log.md 中最新 3 条)
```

### 3.2 corpus-health.md — 健康报告

```markdown
# 语料健康报告

## 词频统计 (Top 30)

| 排名 | 词汇 | 频次 | 备注 |
|------|------|------|------|
| 1 | {word} | {count} | {note} |

## 二元组 (Top 20)

| 词汇 | 频次 |
|------|------|
| {bigram} | {count} |

## 语义关键词命中率

目标领域: {domain}

| 关键词 | 命中率 | 状态 |
|--------|--------|------|
| {keyword} | {rate}% | ✅ 正常 |

## 异常检测

- uniqueWordRatio 下降 >5%: {flag}
- 语义关键词命中率 <10%: {flag}
- 新增文件: {file_list}

## 历史趋势

| 日期 | uniqueWordRatio | 关键词命中率 | 备注 |
|------|----------------|------------|------|
| YYYY-MM-DD | {ratio}% | {rate}% | 基准 |
```

### 3.3 contamination-log.md — 污染检测日志

```markdown
# 污染检测日志

## 检测历史

| 日期 | 触发条件 | 严重程度 | 受影响文件 | 状态 |
|------|----------|----------|-----------|------|
| YYYY-MM-DD | uniqueWordRatio < 10% | HIGH | file.txt | 已删除 |

## 当前污染信号

无活跃污染信号。

## 污染案例记录

### Case 001 — YYYY-MM-DD
- **触发**: uniqueWordRatio = 8.3% (低于 15% 阈值)
- **受影响文件**: wittgenstein-bluebook.txt
- **症状**: Gardening 领域词汇（perennial, soil, bulb）占前 100 高频词 23%
- **处理**: 已删除
```

### 3.4 log.md — 摄入历史

```markdown
# 语料摄入日志

格式: `## [YYYY-MM-DD] {action} | {detail}`

## [YYYY-MM-DD] ingest | corpus/texts/analects.txt
- 来源: James Legge 翻译
- 类型: classical_text
- 字数: 234,521
- 操作: 首次摄入，新增

## [YYYY-MM-DD] lint | 全量扫描
- 扫描文件: 3
- 异常: 无
- 操作: 定期检查

## [YYYY-MM-DD] delete | wittgenstein-bluebook.txt
- 原因: 文件内容与 Wittgenstein 无关（实为园艺百科）
- 触发: uniqueWordRatio = 1.6% + Gardening 关键词命中
- 操作: 已删除
```

---

## 四、工作流

### 4.1 Ingest — 新语料摄入

当人类将新文件放入 `texts/` 目录后，告知 LLM 执行以下步骤：

1. 读取新文件，提取 Title/Author 元数据
2. 计算新文件的词频、uniqueWordRatio
3. 更新 `index.md` 的语料清单表
4. 更新 `corpus-health.md` 的词频统计和历史趋势
5. 如果是首次摄入该来源，更新来源信息
6. 在 `log.md` 中追加摄入记录

### 4.2 Query — 查询

人类可以在 Wiki 上直接提问：
- "这个语料库的核心概念是什么？"
- "与 [[confucius]] 的语料相比，这个语料库有什么特点？"
- "最近有哪些变更？"

LLM 读取相关 Wiki 页面后回答，并将有价值的答案追加到 Wiki 中。

### 4.3 Lint — 健康检查

定期运行 `bun run scripts/corpus/wiki-lint.ts --persona {id}` 检查语料健康：

触发条件（满足任一即报警）：
- `uniqueWordRatio < 10%` → HIGH 严重程度
- `uniqueWordRatio < 15%` → MEDIUM 严重程度
- 语义关键词命中率 < 10% → HIGH 严重程度
- 新文件内容与现有 persona 领域不匹配 → HIGH 严重程度
- 文件重复（内容相似度 > 80%）→ MEDIUM 严重程度

Lint 结果写入 `contamination-log.md`。

### 4.4 Update — 增量更新

当 `texts/` 目录中文件发生变更（新增/删除/修改）时，LLM 执行增量更新：
1. 扫描 `texts/` 目录，与 `index.md` 中的清单对比
2. 仅处理变更的文件
3. 更新受影响的 Wiki 页面
4. 追加变更记录到 `log.md`

---

## 五、语义关键词配置

每个 Persona Wiki 维护自己的语义关键词表，用于污染检测。配置在 `corpus-health.md` 中：

```yaml
# 语义关键词配置
domain: philosophy
keywords:
  - philosophy
  - language
  - thought
  - meaning
  - logic
  - mind
  - proposition
  - rule
  - grammar
warning_threshold: 0.05  # 关键词命中率 < 5% 报警
```

---

## 六、交叉引用

Wiki 页面之间使用 `[[persona-id]]` 语法互相引用：

- `[[confucius]]` — 儒家思想关联
- `[[lao-zi]]` — 道家对比
- `[[wittgenstein]]` — 分析哲学关联

当 LLM 在 Wiki 中建立新的跨 Persona 联系时，应在 `index.md` 的「关联 Persona」部分记录。

---

## 七、质量标准

Wiki 维护的质量标准：
- **index.md** 每次 ingest 必须更新
- **corpus-health.md** 每次 ingest/lint 必须更新
- **log.md** 每次操作必须追加新条目
- **contamination-log.md** 仅在发现问题时更新

Wiki 本身是 markdown 文件，可以用 Obsidian 或任何文本编辑器查看。Graph view 可以直观展示 Persona 之间的关联。

---

*Schema 版本: v1.0 — 2026-04-23*
