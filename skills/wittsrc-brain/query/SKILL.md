---
name: wittsrc-query
version: 1.0.0
description: |
  混合搜索：结合向量检索（pgvector）、关键词检索（tsvector）和 Reciprocal Rank Fusion（RRF），
  对 Wittgenstein Brain 进行多层检索。支持意图分类、多查询扩展、编译真理提升。
triggers:
  - "查询维特根斯坦"
  - "search wittgenstein"
  - "问.*什么"
  - "关于.*说了什么"
  - "query brain"
  - "检索"
tools:
  - wittsrc-query
mutating: false
---

# wittsrc-query — 混合搜索技能

对 Wittgenstein Brain 执行混合检索，返回最相关的 Brain Pages 和文本段落。

## 搜索管道

```
用户问题
  │
  ▼
Intent Classifier
  ├─ entity: "Who mentioned Russell?" → graph-first
  ├─ temporal: "When did Wittgenstein discuss language games?" → timeline-first
  ├─ conceptual: "What is the private language argument?" → hybrid-search
  └─ general: "What did Wittgenstein say about X?" → hybrid-search
  │
  ▼
Multi-Query Expansion (Haiku)
  生成 3 个改写版本：
  - "What does Wittgenstein think about X?"
  - "Wittgenstein's view on X"
  - "X in Wittgenstein's philosophy"
  │
  ▼
Parallel Search
  ┌─ Vector Search (HNSW cosine, k=20)
  └─ Keyword Search (tsvector, k=20)
  │
  ▼
RRF Fusion
  score = Σ(1 / (60 + rank_i))
  │
  ▼
Cosine Re-ranking
  对 RRF 结果用 query embedding 重新计算余弦相似度
  │
  ▼
Compiled Truth Boost
  如果 chunk 来自 "compiled truth" 区域（--- 前），boost ×1.5
  │
  ▼
Dedup (4-layer)
  1. 同 slug 只保留 top chunk
  2. 相似 slug 合并（Ms-114 ≈ Ms-114_Clarino-CC）
  3. 来源多样性（不同手稿优先）
  4. Compiled truth 唯一性保证
  │
  ▼
结果 + 引用
```

## 意图分类

```typescript
type Intent = 'entity' | 'temporal' | 'conceptual' | 'general';

const INTENT_RULES = [
  { pattern: /^who (?:talked|mentioned|discussed|cited|corresponded with)/i, intent: 'entity' },
  { pattern: /^when (?:did|was|were)/i, intent: 'temporal' },
  { pattern: /(?:what is|definition of|meaning of|explain) \w+/i, intent: 'conceptual' },
  { pattern: /(?:what did|say about|think about|view of|opinion on)/i, intent: 'general' },
  { pattern: /(?:contradict|opposite|conflict)/i, intent: 'conceptual' },
  { pattern: /(?:evolution|development|change over time|earlier|later) \w+/i, intent: 'temporal' },
];
```

## 执行命令

```bash
# 基础检索
bun run scripts/wittsrc-query.ts "What did Wittgenstein say about language games?"

# 指定类型过滤
bun run scripts/wittsrc-query.ts "private language" --type concept

# 带上下文窗口
bun run scripts/wittsrc-query.ts "rule following" --context-window 3

# 只返回编译真理区域
bun run scripts/wittsrc-query.ts "family resemblance" --compiled-truth-only
```

## 输出格式

```json
{
  "query": "What did Wittgenstein say about language games?",
  "intent": "general",
  "rewrites": [
    "Wittgenstein's view on language games",
    "language games in Wittgenstein's philosophy",
    "Wittgenstein language game definition"
  ],
  "results": [
    {
      "rank": 1,
      "slug": "concept-language-game",
      "title": "Language Game",
      "type": "concept",
      "score": 0.94,
      "chunk": "The term 'language game' is used by Wittgenstein...",
      "source": "PI §1",
      "compiledTruth": true,
      "period": [1930, 1951]
    }
  ],
  "timing": {
    "total": 127,
    "vectorSearch": 45,
    "keywordSearch": 12,
    "rerank": 70
  }
}
```

## 与蒸馏流水线集成

### Step 5: 盲测评估

```bash
# 自动问答比对
bun run scripts/wittsrc-query.ts "$QUESTION" --format comparison

# 输出：
# - 检索到的最相关段落
# - 期望的 Wittgenstein 回答特征
# - 比对结果（匹配度评分）
```

### Step 2: 心智模型

```bash
# 查询某个概念的所有相关段落
bun run scripts/wittsrc-query.ts "rule following" --all-chunks --format timeline

# 输出按时间排序的概念讨论演变
```

## 防呆检查

- [ ] 如果向量搜索返回空，自动 fallback 到纯关键词搜索
- [ ] 如果 graph-only 查询无结果，给出自然语言搜索建议
- [ ] 查询超时（>5s）时返回部分结果 + 警告
- [ ] 空结果时不说"我找到了"，而说"brain 中没有相关内容"

## 反模式

- 不要在用户问"Who is Russell?" 时返回 20 个不同手稿的碎片（应该聚合成 `people/person-russell.md`）
- 不要把 timeline 区域的内容当作 compiled truth（时间线是证据，compiled truth 才是结论）
- 不要对哲学概念只做字符串匹配（"language game" ≠ "Sprachspiel" 但意义相同）
