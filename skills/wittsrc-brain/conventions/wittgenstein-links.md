---
name: wittsrc-conventions-links
version: 1.0.0
description: |
  Wittgenstein 链接类型约定 + 正则定义。
  定义手稿编号、人名、哲学概念的正则表达式，以及链接类型的推断规则。
---

# Wittgenstein 链接约定

## 正则表达式

### 手稿编号

```typescript
// 格式: Ms-NNN[a-z], Ts-NNN[a-z], Ms-NNNa (legacy)
export const MANUSCRIPT_PATTERN = /\b(Ms|Ts)-(\d+[a-z]?(?:[a-z])?)\b/gi;

// PI 段落引用
export const PI_PATTERN = /\bPI\s*§\s*(\d+(?:[a-z])?)\b/gi;

// PR (Philosophical Remarks) 引用
export const PR_PATTERN = /\bPR\s+([IVX]+(?:\.\d+)?)\b/gi;

// Zettel 段落引用
export const ZETTEL_PATTERN = /\bZettel\s*§\s*(\d+)\b/gi;

// On Certainty 引用
export const OC_PATTERN = /\bOC\s*§\s*(\d+)\b/gi;

// Blue Book / Brown Book
export const BB_PATTERN = /\b(BB|Blue\s*Book|Brown\s*Book)\s*§?\s*(\d+)?\b/gi;

// 复合引用: Ms-114 背面 Ts-207
export const CROSS_REF_PATTERN = /\b(Ms|Ts)-(\d+[a-z]?)\s+[-–—]\s+(Ms|Ts)-(\d+[a-z]?)\b/gi;

// 简写: "the 1937 manuscript", "the later work"
export const PERIOD_REF_PATTERN = /\b(?:early|later|midDLE|middle|final)\s+(?:manuscript|work|pages?|notes?)\b/gi;
```

### 人名

```typescript
export const PHILOSOPHER_PATTERN = /\b(
  Wittgenstein|
  Russell|
  G\.?\s*E\.?\s*Moore|
  G\.?\s*Moore|
  Moore|
  Frege|
  Ramsey|
  Frank\s*Ramsey|
  Cantor|
  Cantor|
  Hilbert|
  Frege|
  Anscombe|
  Elizabeth\s*Anscombe|
  von\s*Wright|
  Georg\s*Henrik\s*von\s*Wright|
  Moore|
  G\.?\s*E\.?\s*M\.?|
  M\.?\s*O\.?\s*O\.?\s*R\.?E\.?|
  Pitcher|
  Drury|
  Maurice\s*Drury|
  Engelmann|
  Paul\s*Engelmann|
  Ogden|
  C\.?\s*K\.?\s*Ogden|
  The\s*Editor|
  F\.?\s*?P\.?\s*Ramsey|
  Rawidowicz|
  Ambrose|
  Alice Ambrose|
  Rhees|
  Rush Rhees|
  Kreisel|
  Georg\s*Kreisel|
  Mandelbrote|
  von Aster|
  Haverty|
  Stebbing|
  L\.?\s*S\.?\s*Stebbing|
  Waismann|
  Friedrich\s*Waismann|
  R\.?\s*Edmund|
  Collingwood|
  R\.?\s*G\.?\s*Collingwood|
  Wittgensteinian|
  Wittgensteinean
)\b/gi;
```

### 哲学概念

```typescript
export const CONCEPT_PATTERN = /\b(
  language[\s-]?game|
  language[\s-]?games|
  private[\s-]?language|
  family[\s-]?resemblance|
  family[\s-]?similarity|
  rule[\s-]?following|
  form[\s-]?of[\s-]?life|
  form[s]?\s+of\s+life|
  picture[\s-]?theory|
  logical[\s-]?atomism|
  nonsense|
  grammatische\s+S?tze|
  proposition[s]?|
  elementary\s+proposition[s]?|
  atomic\s+proposition[s]?|
  tautology|
  contradiction|
  logical\s+space|
  world|
  facts?|
  things?|
  object[s]?|
  state\s+of\s+affairs|
  Sachverhalt|
  Sachlage|
  complex|
  constituent|
  thought|
  meaning|
  use|
  understanding|
  explanation|
  definition|
  criterion|
  criterion|
 gia|
  solipsism|
  realism|
  idealism|
  nominalism|
  conventionalism|
  verificationism|
  essentialism|
  platonism\s+of\s+(?:the\s+)?(?:mind|mathematics|propositions)|
  aspect\s+perception|
  seeing[\s-]?as|
  aspect[\s-]?dawning|
  depth\s+psychology|
  philosophy\s+of\s+mathematics|
  foundations\s+of\s+mathematics|
  ethics|
  aesthetics|
  philosophy\s+of\s+religion|
  mysticism|
  the\s+mystical|
  certainty|
  doubt|
  criteria|
  behaviourism|
  instrument|
  instrumentality|
  ceremony|
  ritual|
  practice|
  custom|
  institution|
  form\s+of\s+life|
  life[- ]form[s]?|
  normative|
  normativity|
  rule|
  rule\s+governed|
  agreement|
  form\s+of\s+life|
  language\s+as\s+a\s+game|
  Sprachspiel|
  Sprachspiele|
  Sprachspiel|
  Sprachspiele|
  PrivatSprache|
  PrivatSprache|
  Familienähnlichkeit|
  Welt|
  Tatsache|
  Satz|
  Gedanke|
  Bild|
  Traktat|
  Philosophische\s+Untersuchungen
)\b/gi;
```

## 链接类型定义

### cites

**定义**：A 引用、提及、参考 B
**方向**：A → B（A 提到了 B）
**置信度**：高（文本明确出现引用词）

```typescript
// 触发词
const CITES_TRIGGERS = [
  'cf.', 'see also', 'see', 'compare',
  'as in', 'for example', 'e.g.',
  "mentions", "refers to", "quotes",
  "mentioned in", "discussed in",
  "in (PI|Ms|Ts|PR)", // PI §1 defines...
];
```

### evolves_to

**定义**：A 是 B 的早期版本/前身/草稿
**方向**：早期手稿 → 后期手稿
**置信度**：中（需要上下文判断）

```typescript
const EVOLVES_TRIGGERS = [
  "worked out in", "developed in", "developed from",
  "revised in", "rewritten as", "expanded in",
  "the later version of", "this is the earlier form of",
  "below we find", "this will be found in",
  "supplanted by", "replaced by",
];
```

### contradicts

**定义**：A 与 B 的立场相矛盾
**方向**：无固定方向
**置信度**：低（启发式，易误判）

```typescript
const CONTRADICTS_TRIGGERS = [
  "contrary to", "opposed to", "in opposition to",
  "unlike", "differs from", "contradicts",
  "cannot be reconciled with", "incompatible with",
  "this is wrong because", "the earlier view fails",
  "the mistake is", // but this could be self-critique
];
```

### influenced_by

**定义**：A 的思想受 B 影响
**方向**：A → B
**置信度**：高（文本明确说明）

```typescript
const INFLUENCED_TRIGGERS = [
  "influenced by", "shaped by", "derived from",
  "inspired by", "goes back to",
  "under the influence of", "receives from",
];
```

### defines

**定义**：A 定义/引入/阐述 B（通常是 PI/手稿 引入概念）
**方向**：工作 → 概念
**置信度**：高

```typescript
const DEFINES_TRIGGERS = [
  "defines", "defining", "introduction of",
  "the concept of", "the term", "calls",
  "introduces the idea", "calls this",
  "by 'X' I mean", "X is here called",
  "we call", "I call this",
];
```

### revisits

**定义**：A 在后期重访/重新审视 B 的问题
**方向**：后期手稿 → 早期手稿/概念
**置信度**：中

```typescript
const REVISITS_TRIGGERS = [
  "revisits", "returns to", "goes back to",
  "reconsider", "re-examine", "reopen",
  "on the question of", "the question of",
  "I used to think", "earlier I said",
  "my earlier", "my former",
];
```

## 链接方向规则

```typescript
function inferDirection(sourceSlug: string, targetSlug: string): 'forward' | 'backward' {
  const sourcePeriod = getPeriod(sourceSlug); // [start, end]
  const targetPeriod = getPeriod(targetSlug);

  if (!sourcePeriod || !targetPeriod) return 'forward';

  // 演变关系：早期 → 后期
  if (sourcePeriod[1] < targetPeriod[0]) return 'forward';  // Ms-114 → Ts-207
  if (sourcePeriod[0] > targetPeriod[1]) return 'backward'; // Ts-207 → Ms-114
  return 'forward';
}

function getPeriod(slug: string): [number, number] | null {
  const periods: Record<string, [number, number]> = {
    'ms-101': [1908, 1911], 'ms-114': [1914, 1916], 'ms-115': [1912, 1914],
    'ms-139a': [1913, 1914], 'ms-152': [1930, 1934], 'ms-153a': [1930, 1932],
    'ts-207': [1929, 1931], 'ts-212': [1937, 1938], 'ts-213': [1937, 1938],
    'pi': [1938, 1951], 'tractatus': [1914, 1918],
    'pr': [1929, 1930], 'zettel': [1933, 1945], 'oc': [1950, 1951],
  };
  return periods[slug.toLowerCase()] || null;
}
```

## 代码块保护

抽取时必须跳过代码块区域：

```typescript
function stripCodeBlocks(text: string): string {
  // 移除行内代码
  text = text.replace(/`[^`]+`/g, '');
  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  // 移除伪代码（缩进的哲学示例）
  text = text.replace(/^\s{4,}\S.*$/gm, '');
  return text;
}
```

## 测试用例

```bash
# 测试正则
bun run scripts/wittsrc-auto-link.ts --test-regex

# 期望输出
# Ms-114: 3 matches
# PI §243: 2 matches
# Russell: 8 matches
# language-game: 5 matches
```
