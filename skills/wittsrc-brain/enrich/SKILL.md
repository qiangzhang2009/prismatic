---
name: wittsrc-enrich
version: 1.0.0
description: |
  对 Brain Pages 执行分级实体富化。
  Tier 3（单次提及）→ Tier 2（3次提及或跨来源）→ Tier 1（8次提及或核心人物/概念）。
  从 SEP/IEP 百科、Gutenberg 简介中提取补充信息。
triggers:
  - "富化"
  - "enrich"
  - "补充信息"
  - "实体信息"
  - "人物介绍"
tools:
  - wittsrc-enrich
mutating: true
---

# wittsrc-enrich — 实体富化技能

对 Brain Pages 执行分级实体富化，为人物/概念/著作页面添加补充信息。

## 分级策略

| Tier | 触发条件 | 富化内容 | 信息来源 |
|------|---------|---------|---------|
| Tier 3 | 单次提及 | stub page（标题 + 首次出现来源） | 仅当前来源 |
| Tier 2 | 3+ 提及 OR 跨 2 个来源 | 标准 page（简介 + 首次出现时间 + 所有来源） | SEP/IEP/Gutenberg |
| Tier 1 | 8+ 提及 OR 核心人物/概念 | full page（全介绍 + 引用列表 + 时间线 + 图关系） | 全部来源 |

## 分级标准（Wittgenstein 特殊）

```typescript
const CORE_CONCEPTS = [
  'language-game', 'private-language', 'family-resemblance',
  'rule-following', 'form-of-life', 'picture-theory',
  'nonsense', 'aspect-perception', 'philosophical-grammar'
];

const CORE_PEOPLE = [
  'Wittgenstein', 'Russell', 'Frege', 'Moore', 'Ramsey',
  'Anscombe', 'von Wright', 'Engelmann', 'Drury'
];

const CORE_WORKS = [
  'Tractatus', 'PI', 'Philosophical Investigations',
  'Ms-114', 'Ms-152', 'Ts-212', 'Ts-213'
];

function getTier(slug: string, mentionCount: number, sources: string[]): Tier {
  const isCore = CORE_CONCEPTS.includes(slug) ||
                  CORE_PEOPLE.includes(slug) ||
                  CORE_WORKS.includes(slug);
  if (isCore || mentionCount >= 8) return 1;
  if (mentionCount >= 3 || sources.length >= 2) return 2;
  return 3;
}
```

## 富化内容模板

### 人物富化（Tier 2+）

```markdown
## Enrichment

**Full Name**: [SEP/IEP 提取]
**Born–Died**: [SEP/IEP 提取]
**Role**: [philosophers / mathematicians / students / colleagues]
**Relationship to Wittgenstein**: [teacher / student / correspondent / critic]
**Key interactions**: [从语料中提取]
**Wittgenstein's view**: [从语料中提取的评论]

## References
[所有提到该人物的 Brain Pages]
```

### 概念富化（Tier 1+）

```markdown
## Enrichment

**Definition**: [SEP/IEP 提取的标准化定义]
**First use**: [在 Wittgenstein 语料中的首次出现]
**Etymology**: [如有]
**Related to**: [相关概念列表，来自图查询]
**SEP article**: [URL]
**IEP article**: [URL]

## Cross-period development
- Early (1912-1918): [Tractatus 时期立场]
- Middle (1929-1936): [过渡期立场]
- Late (1937-1951): [PI 时期立场]
```

## 执行命令

```bash
# 富化所有 Tier 1 实体（核心人物/概念）
bun run scripts/wittsrc-enrich.ts --tier 1

# 富化特定页面
bun run scripts/wittsrc-enrich.ts --slug person-russell --slug concept-language-game

# 批量富化（所有 Tier 2+）
bun run scripts/wittsrc-enrich.ts --tier 2 --source corpus/wittgenstein/brain/

# Dry run
bun run scripts/wittsrc-enrich.ts --dry-run
```

## 信息来源优先级

1. **WittSrc/Clarino/Gutenberg 正文**：最权威，直接引用
2. **SEP (Stanford Encyclopedia of Philosophy)**：学术标准，最可靠
3. **IEP (Internet Encyclopedia of Philosophy)**：次级参考
4. **Gutenberg 前言/简介**：如有
5. **Wikipedia**：最后兜底，不用于引用

## 与蒸馏流水线集成

### Step 2: 心智模型

富化的概念页提供：
- 跨时期的立场演变
- 相关的其他概念（用于 cross-domain 标注）
- SEP/IEP 权威定义（用于 sanity check）

### Step 3: 表达 DNA

从人物富化页提取：
- Wittgenstein 对某人的评论语气（用于判断语气）
- 讨论某人的频率（用于判断关注度）

## 防呆检查

- [ ] Tier 1 实体不超过 30 个（否则分级标准太松）
- [ ] SEP/IEP URL 都是有效链接（404 检查）
- [ ] 富化内容不与原文矛盾（enrichment 应该补充而非修正原文）
- [ ] 人物生卒年与 timeline 一致

## 反模式

- 不要对 Tier 3 实体执行富化（浪费资源）
- 不要把 Wikipedia 内容当作权威来源（只能作为最后兜底）
- 不要修改 compiled truth 区域（enrichment 只追加到末尾）
