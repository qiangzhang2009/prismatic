---
name: wittsrc-link
version: 1.0.0
description: |
  零 LLM 抽取 Wittgenstein 文本中的实体引用，生成 typed links 构建知识图谱。
  通过正则匹配手稿编号、人名、哲学概念，生成 cites/evolves_to/contradicts/influenced_by 关系。
triggers:
  - "抽取链接"
  - "auto-link"
  - "extract links"
  - "手稿引用关系"
  - "生成知识图谱"
  - "build graph"
tools:
  - wittsrc-auto-link
mutating: true
---

# wittsrc-link — 零 LLM 实体链接抽取

从 Brain Pages 中抽取实体引用，生成 typed links，不调用任何 LLM。

## 抽取范围

### 手稿编号正则

```typescript
// 完整编号
const MS_PATTERN = /Ms-(\d+[a-z]?)/g;        // Ms-114, Ms-139a
const TS_PATTERN = /Ts-(\d+[a-z]?)/g;        // Ts-207, Ts-212
const PI_PATTERN = /PI §(\d+)/g;              // PI §1, PI §243
const PR_PATTERN = /PR ([IVX]+)/g;            // PR IV.1, PR II
const ZETTEL_PATTERN = /Zettel §(\d+)/g;      // Zettel §1
const OC_PATTERN = /OC §(\d+)/g;              // On Certainty §1
const BB_PATTERN = /BB §(\d+)/g;              // Blue Book §1

// 复合引用
const COMPOUND_PATTERN = /Ms-(\d+)[a-z]?[-–]Ts-(\d+)/g;  // cross-work refs
```

### 人名正则

```typescript
const PHILOSOPHER_PATTERN = /\b(Wittgenstein|Russell|Moore|Ramsey|Frege|
  Anscombe|von Wright|Pitcher|Moore|G.E. Moore|Bertrand Russell|
  Frank Ramsey|Paul Engelmann|Maurice Drury|Theodore Redpath|
  Yorick|Ramblings|F.p|Rawidowicz)\b/gi;
```

### 哲学概念正则

```typescript
const CONCEPT_PATTERN = /\b(language-game|language games|private language|
  family resemblance|family-similarity|rule-following|form of life|
  picture theory|logical atomism|ethicism|ceremony|ceremonial|
  aspect perception|philosophical grammar|perspective|definite description|
  proposition|atomic proposition|tautology|contradiction|
  nonsense|show|say|world|thought|facts|pictures)\b/gi;
```

## 链接类型推断

根据上下文模式推断关系类型：

```typescript
type LinkType = 'cites' | 'evolves_to' | 'contradicts' | 'influenced_by' | 'defines' | 'revisits';

const PATTERN_MAP: Array<{
  pattern: RegExp;
  type: LinkType;
  direction: 'forward' | 'backward';
}> = [
  // evolves_to: 演变到更新的手稿
  { pattern: /worked out (?:in|below|here)/i, type: 'evolves_to', direction: 'forward' },
  { pattern: /this (?:will|can) be (?:found|seen|worked out)/i, type: 'evolves_to', direction: 'forward' },
  { pattern: /cf\.?\s+(Ms|Ts|PI|PR)/i, type: 'cites', direction: 'forward' },
  { pattern: /see (?:also\s+)?(Ms|Ts|PI|PR)/i, type: 'cites', direction: 'forward' },
  { pattern: /contrary (?:to|in) (PI|Ms|Ts|§)/i, type: 'contradicts', direction: 'forward' },
  { pattern: /(Ms|Ts)-(\d+).*?(contradicts?|opposed|against)/i, type: 'contradicts', direction: 'forward' },
  { pattern: /(Ms|Ts)-(\d+) is (?:superior|inferior) (?:to|in)/i, type: 'evolves_to', direction: 'forward' },
  { pattern: /(?:revised|rewritten|developed) in (Ms|Ts|PI)/i, type: 'evolves_to', direction: 'forward' },
  { pattern: /(?:influenced|shaped) by (Russell|Ramsey|Frege|Moore)/i, type: 'influenced_by', direction: 'forward' },
  { pattern: /Ramsey'?['']s (?:critique|criticism|notes)/i, type: 'cites', direction: 'forward' },
  { pattern: /the definition of (\w+)/i, type: 'defines', direction: 'forward' },
  { pattern: /revisits? (?:the (?:question|point|issue) of)/i, type: 'revisits', direction: 'forward' },
  { pattern: /in (PI §\d+|PR [IVX]+|Ms-\d+), we find/i, type: 'defines', direction: 'forward' },
];
```

## 输出格式

```typescript
interface ExtractedLink {
  sourceSlug: string;   // 来源页面 slug
  targetSlug: string;    // 目标页面 slug（可能是外部引用如 "PI §243"）
  type: LinkType;
  anchorText: string;    // 原文锚文本
  context: string;       // 上下文（前 50 字符）
  confidence: number;    // 0-1，启发式置信度
  deterministic: boolean; // 是否纯正则（false = 需人工确认）
}
```

写入 `brain/.links/` 目录：

```
corpus/wittgenstein/brain/.links/
  links-2026-04-20.json   (每次抽取的结果)
  graph.json              (合并后的图结构)
```

## 执行命令

```bash
# 批量抽取
bun run scripts/wittsrc-auto-link.ts \
  --source corpus/wittgenstein/brain/works/ \
  --output corpus/wittgenstein/brain/.links/

# 增量抽取（只处理上次之后的文件）
bun run scripts/wittsrc-auto-link.ts \
  --source corpus/wittgenstein/brain/ \
  --since 2026-04-19

# Dry run（不写文件，只打印）
bun run scripts/wittsrc-auto-link.ts \
  --source corpus/wittgenstein/brain/ \
  --dry-run
```

## 图结构

抽取结果合并为 JSON 图格式：

```json
{
  "nodes": [
    { "slug": "work-ms-114", "type": "work", "label": "Ms-114", "period": [1912, 1916] },
    { "slug": "work-ts-207", "type": "work", "label": "Ts-207", "period": [1929, 1931] },
    { "slug": "concept-language-game", "type": "concept", "label": "Language Game" }
  ],
  "edges": [
    { "from": "work-ms-114", "to": "work-ts-207", "type": "evolves_to", "confidence": 0.85 },
    { "from": "work-ts-207", "to": "concept-language-game", "type": "defines", "confidence": 0.92 }
  ],
  "meta": {
    "extractedAt": "2026-04-20",
    "totalNodes": 162,
    "totalEdges": 847,
    "avgConfidence": 0.78
  }
}
```

## 防呆检查

- [ ] 每个 Brain Page 至少有 1 个出链（除非是孤立的短篇手稿）
- [ ] 链接类型分布合理（cites 最常见，contradicts 最少）
- [ ] 没有悬空引用（目标 slug 在 nodes 中存在）
- [ ] `evolves_to` 方向正确（早期手稿 → 后期手稿）

## 反模式

- 不要在没有确认目标存在的情况下添加 `evolves_to` 链接
- 不要把 `contradicts` 误判为 `cites`（"cf." 不等于"矛盾"）
- 不要对代码块内容执行正则（手稿中有伪代码示例）
