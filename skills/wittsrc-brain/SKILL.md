---
name: wittsrc-brain
version: 1.0.0
description: |
  Wittgenstein Brain — 给维特根斯坦 Persona 专用的记忆系统。
  将 Wittgenstein 学术语料（WittSrc/Clarino/Gutenberg）转化为可查询、可链接、可追踪的 Brain Pages，
  并通过混合搜索 + 知识图谱为蒸馏流水线提供知识检索能力。
  使用当用户想要：
  - 将 Wittgenstein 手稿语料导入 Brain
  - 查询某个哲学概念在手稿中的演变
  - 生成手稿间引用关系图
  - 为 Wittgenstein Persona 提供知识检索
  - 从语料中提取实体（人名/概念/手稿编号）
triggers:
  - "导入维特根斯坦语料"
  - "查询维特根斯坦手稿"
  - "手稿引用关系图"
  - "维特根斯坦概念演变"
  - "wittsrc brain"
  - "wittgenstein brain"
  - "手稿链接提取"
  - "brain pages"
tools:
  - wittsrc-import
  - wittsrc-auto-link
  - wittsrc-query
  - wittsrc-graph
  - wittsrc-maintain
mutating: true
---

# WittSrc Brain — Wittgenstein Persona 记忆系统

Wittgenstein Brain 将 Wittgenstein 学术语料转化为 gbrain 风格的知识记忆系统，
为蒸馏流水线提供持续、可查询的知识支撑。

## 架构

```
语料输入
  ├─ WittSrc BNE (140 手稿, ~860K 词)
  ├─ CLARINO/WAB CC (19 手稿, ~5.1M 词)
  ├─ Gutenberg 公版著作 (PI, Tractatus, Notebooks 等)
  └─ SEP/IEP 学术百科
       │
       ▼
  wittsrc-brain-import
       │ (零 LLM: chunking + embedding + id-hash dedup)
       ▼
  corpus/wittgenstein/brain/
  ├─ works/          (手稿/著作页面)
  ├─ concepts/       (哲学概念页面)
  ├─ people/         (哲学人物页面)
  └─ timelines/      (时间线页面)
       │
       ▼
  wittsrc-auto-link
       │ (零 LLM: 正则抽取手稿编号/人名/概念引用)
       ▼
  知识图谱
  (typed links: cites / evolves_to / contradicts / influenced_by)
       │
       ▼
  wittsrc-query
  (混合搜索: vector + keyword + RRF + graph fallback)
```

## 核心数据模型

### Brain Page 结构

```markdown
---
type: concept
title: Language Game
slug: concept-language-game
tags: [后期哲学, PI, 核心概念]
period: [1930, 1951]
sources: [PI §1-7, Ms-152, Ts-212]
---

# Language Game

Wittgenstein's concept describing the way language functions as a form of action
or game governed by rules that are not explicitly defined but learned through practice.

## Compiled Understanding

The term first appears in 1930 and becomes the central organizing metaphor
of the Philosophical Investigations. Unlike Turing's formal game concept,
Wittgenstein's language games are rooted in human practice and form of life.

## Cross-References
- [[PI §1]] — the opening definition
- [[concept-family-resemblance]] — related but distinct
- [[Ms-152]] — earliest systematic development

---

## Timeline

- 1930-01: First occurrence in Ms-112, used tentatively
- 1933-01: Fully developed in Ms-152
- 1937-01: Appears in Ts-212 (Big Typescript)
- 1953-01: Published posthumously in PI §1-7
```

### 链接类型

| 类型 | 含义 | 示例 |
|------|------|------|
| `cites` | 引用或提及 | Ms-114 cites Russell |
| `evolves_to` | 演变/发展 | Ms-114 evolves_to Ts-207 |
| `contradicts` | 矛盾/否定 | Ms-152 contradicts Ms-114 |
| `influenced_by` | 受影响 | PI influenced_by Ramsey |
| `defines` | 定义概念 | PI §1 defines language-game |
| `revisits` | 重访/修正 | Ms-152 revisits Ms-109 |

### 哲学分期

| 时期 | 时间 | 核心手稿 | 立场特点 |
|------|------|---------|---------|
| 早期 (Pre-Tractatus) | 1912-1918 | Ms-114/115, Ms-139a | 逻辑图像论, 语言作为命题的镜子 |
| 过渡期 | 1929-1936 | Ts-207, PR, Ms-152 | 从逻辑主义转向日常语言 |
| 后期 (Post-Tractatus) | 1937-1951 | Ts-212/213, PI, Zettel | 语言游戏, 家族相似性, 规则悖论 |

## 工作流

### 1. 导入语料 (wittsrc-import)

```bash
bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstein/texts/
```

将文本语料转换为 Brain Pages:
- 按文件类型路由（wab_xml → works/, wittsrg → works/, SEP/IEP → concepts/）
- 递归 chunking（512 tokens/chunk，overlap 64）
- 内容 hash 去重（idempotent）
- 生成 embedding 并写入 PGLite

### 2. 抽取链接 (wittsrc-auto-link)

```bash
bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstein/brain/
```

零 LLM 实体链接抽取:
- 手稿编号正则: `Ms-\d+[a-z]?`, `Ts-\d+[a-z]?`, `PI §\d+`, `PR [IVX]+`
- 人名正则: Wittgenstein, Russell, Moore, Ramsey, Frege, Anscombe, etc.
- 概念正则: `language-game`, `private-language`, `family-resemblance`, etc.
- 链接类型推断: 上下文模式匹配

### 3. 检索 (wittsrc-query)

```bash
bun run scripts/wittsrc-query.ts "What did Wittgenstein say about language games?"
```

混合搜索:
1. Intent classifier (entity? temporal? concept? general?)
2. Multi-query expansion (Haiku rephrases × 3)
3. Vector search (HNSW cosine) + Keyword search (tsvector)
4. RRF fusion: `score = sum(1/(60 + rank))`
5. Graph traversal fallback (for typed-relation queries)

### 4. 图查询 (wittsrc-graph)

```bash
bun run scripts/wittsrc-graph-query.ts concept-language-game --type evolves_to --depth 3
```

图遍历:
- Recursive CTE with cycle detection
- Type filter (`--type cites`)
- Direction control (`--direction in|out|both`)
- Depth cap (≤10)

### 5. 维护 (wittsrc-maintain)

```bash
bun run scripts/wittsrc-maintain.ts --check
```

检查项:
- Orphan pages (no inbound links)
- Dead links (target doesn't exist)
- Stale pages (no update in 90 days)
- Citation audit (check source URLs)
- Tag consistency

## 蒸馏流水线集成点

| 流水线步骤 | gbrain 集成方式 |
|-----------|---------------|
| Step 1 深度研究 | Minions 每日同步 WittSrc/Clarino 自动摄入 |
| Step 2 心智模型 | 图查询支持概念演变分析 |
| Step 3 表达DNA | Brain Pages 作为 ExpressionDNA 语料来源 |
| Step 5 盲测评估 | 混合搜索提供半自动问答比对 |
| Step 6 迭代优化 | Brain 自我更新，跟踪新语料 |

## 约定文件

- `skills/wittsrc-brain/conventions/wittgenstein-links.md` — 链接类型 + 正则
- `skills/wittsrc-brain/conventions/philosophical-periods.md` — 哲学分期定义
