---
name: wittsrc-conventions-periods
version: 1.0.0
description: |
  Wittgenstein 哲学分期定义。定义早期（Pre-Tractatus）、过渡期（Middle）、
  后期（Late）的时间边界和核心立场差异，用于分层 Brain Pages 和分期 Persona。
---

# Wittgenstein 哲学分期约定

## 分期定义

### 早期 (Pre-Tractatus / Early Period)

| 属性 | 值 |
|------|-----|
| 时间 | 1912–1918 |
| 核心手稿 | Ms-101–Ms-139b, Notebooks 1914-16 |
| 核心著作 | Tractatus Logico-Philosophicus (1921/1933) |
| 关键词 | 逻辑图像论、原子命题、世界/事实/事物、神秘主义、伦理学不可言说 |
| 主导立场 | 语言是世界的图像；命题是现实的逻辑图像；逻辑先于一切经验 |

**代表性段落**：

```
Tractatus 1: The world is everything that is the case.
Tractatus 1.1: The world is the totality of facts, not of things.
Tractatus 2: What is the case—a fact—is the existence of states of affairs.
Tractatus 4.001: The totality of propositions is the language.
Tractatus 5.6: The limits of my language mean the limits of my world.
Tractatus 7: Whereof one cannot speak, thereof one must be silent.
```

### 过渡期 (Middle / Transitional Period)

| 属性 | 值 |
|------|-----|
| 时间 | 1929–1936 |
| 核心手稿 | Ms-152, Ms-153a/b, Ts-207, Ts-310, PR |
| 核心著作 | Philosophical Remarks (1929), The Blue Book (1933-34), The Brown Book (1934-35) |
| 关键词 | 规则悖论、私人语言可能性、语法 convention、怀疑论 |
| 主导立场 | 对 Tractatus 的不满；开始关注语言的实际使用；规则遵循问题浮现 |

**代表性段落**：

```
"Philosophy is a battle against the bewitchment of our intelligence by means of language."
(Philosophical Remarks, 1929)

"The crucial move in the regress argument is that the rule cannot determine any
course of action because any course of action can be made to accord with the rule."
(MS 152, c.1933)
```

### 后期 (Late / Post-Tractatus Period)

| 属性 | 值 |
|------|-----|
| 时间 | 1937–1951 |
| 核心手稿 | Ms-148-156a, Ts-212, Ts-213, Ms-178a-h |
| 核心著作 | Philosophical Investigations (1953, posthumous), Zettel (1967), On Certainty (1969) |
| 关键词 | 语言游戏、家族相似性、生活形式、意义即使用、治疗性哲学 |
| 主导立场 | 语言游戏取代逻辑图像；家族相似性取代本质主义；哲学是活动而非理论 |

**代表性段落**：

```
PI §1: "When they (thealogians) do come they are not, I grant, the applications of our
words organized in a very simple way by a very simple rule."
PI §43: "For a large class of cases—though not for all—in which we employ the word
'meaning' it can be defined thus: the meaning of a word is its use in the language."
PI §66: "I can think of no better expression to characterize these similarities than
'family resemblance'; for the various resemblances that hold between the members of
a family: build, features, colour of eyes, temperament, etc. etc., overlap and criss-cross
in the same way."
PI §133: "Philosophy is a battle against the bewitchment of our intelligence by means of language."
```

## 分期判断规则

```typescript
type Period = 'early' | 'middle' | 'late';

function classifyPeriod(slug: string): Period {
  const periodRanges: Record<string, [number, number]> = {
    // Early
    'ms-101': [1908, 1911], 'ms-102': [1908, 1911], 'ms-103': [1908, 1911],
    'ms-104': [1908, 1911], 'ms-105': [1912, 1913], 'ms-106': [1912, 1913],
    'ms-107': [1912, 1913], 'ms-108': [1912, 1913], 'ms-109': [1912, 1913],
    'ms-110': [1912, 1913], 'ms-111': [1912, 1913], 'ms-112': [1913, 1914],
    'ms-113': [1913, 1914], 'ms-114': [1914, 1916], 'ms-115': [1912, 1914],
    'ms-139a': [1913, 1914], 'ms-139b': [1929, 1930],
    'notebooks-1914': [1914, 1916], 'notebooks-1916': [1916, 1917],
    'tractatus': [1914, 1918],

    // Middle
    'ms-142': [1929, 1930], 'ms-143': [1929, 1930], 'ms-144': [1929, 1930],
    'ms-145': [1929, 1930], 'ms-146': [1929, 1930], 'ms-147': [1929, 1930],
    'ms-148': [1930, 1931], 'ms-149': [1930, 1931], 'ms-150': [1930, 1931],
    'ms-151': [1930, 1931], 'ms-152': [1930, 1934], 'ms-153a': [1930, 1932],
    'ms-153b': [1932, 1934], 'ms-154': [1931, 1933], 'ms-155': [1931, 1933],
    'ms-156a': [1931, 1933],
    'ts-207': [1929, 1931], 'ts-208': [1931, 1932], 'ts-209': [1931, 1932],
    'ts-210': [1931, 1932], 'ts-211': [1931, 1932],
    'pr': [1929, 1930], 'bluebook': [1933, 1934], 'brownbook': [1934, 1935],

    // Late
    'ms-157a': [1937, 1938], 'ms-157b': [1938, 1939], 'ms-158': [1938, 1939],
    'ms-159': [1938, 1939], 'ms-160': [1938, 1939], 'ms-161': [1938, 1939],
    'ms-162a': [1938, 1939], 'ms-162b': [1938, 1939],
    'ms-163': [1939, 1940], 'ms-164': [1939, 1940], 'ms-165': [1939, 1940],
    'ms-166': [1939, 1940], 'ms-167': [1940, 1941], 'ms-168': [1940, 1941],
    'ms-169': [1941, 1942], 'ms-170': [1942, 1943], 'ms-171': [1943, 1944],
    'ms-172': [1944, 1945], 'ms-173': [1944, 1945], 'ms-174': [1945, 1946],
    'ms-175': [1945, 1946], 'ms-176': [1946, 1947], 'ms-177': [1946, 1947],
    'ms-178a': [1947, 1948], 'ms-178b': [1947, 1948], 'ms-178c': [1948, 1949],
    'ms-178d': [1948, 1949], 'ms-178e': [1948, 1949], 'ms-178f': [1948, 1949],
    'ms-178g': [1948, 1949], 'ms-178h': [1948, 1949],
    'ms-179': [1949, 1950], 'ms-180a': [1949, 1950], 'ms-180b': [1949, 1950],
    'ms-181': [1950, 1951], 'ms-182': [1950, 1951], 'ms-183': [1950, 1951],
    'ts-212': [1937, 1938], 'ts-213': [1937, 1938],
    'ts-214': [1937, 1938], 'ts-215a': [1938, 1939], 'ts-215b': [1938, 1939],
    'ts-215c': [1938, 1939],
    'pi': [1938, 1951], 'zettel': [1933, 1945], 'culture-value': [1930, 1947],
    'oc': [1950, 1951],
  };

  const range = periodRanges[slug.toLowerCase()];
  if (!range) return 'late'; // 默认后期（最多手稿）
  const midYear = (range[0] + range[1]) / 2;
  if (midYear <= 1918) return 'early';
  if (midYear <= 1936) return 'middle';
  return 'late';
}
```

## 分期转换规则

### 逻辑图像论 → 语言游戏

```
Ms-114 (Notebooks 1914): "The logical picture of the facts is the thought."
    ↓ (10年后)
Ms-152 (1930-34): "What is the essential feature of a language? The diversity
  of its uses. Their multiplicity is not something fixed, given once and for all."
    ↓
PI §23: "I shall in future again and again draw your attention to what I shall
  call language-games. These are the processes of language as it were one moves
  along by fits and starts."
```

### 私人语言的否定（隐含 → 显式）

```
Tractatus (1921): 对私人语言的可能性沉默（逻辑原子论框架下）
    ↓
Ms-152 (1933): 规则遵循问题 → 私人语言的不可能性
    ↓
PI §243-315: "How could there be a private language?" (经典论证)
```

### 哲学方法的转变

```
Tractatus 4.003: "Most of the propositions and questions of philosophers arise
  from the fact that we do not understand the logic of our language."
    ↓
PI §109: "Philosophy is a battle against the bewitchment of our intelligence
  by means of language."
PI §133: Philosophy as therapy — "A philosophical problem has the form: I don't
  know my way about."
```

## 分期 Brain Page 路由

```typescript
function routeByPeriod(text: string, filename: string): string {
  const period = classifyPeriod(filename);
  return `brain/works/period-${period}/${slugify(filename)}.md`;
}

// 输出目录
brain/works/period-early/tractatus.md
brain/works/period-middle/ms-152.md
brain/works/period-late/pi.md
```

## 分期切换指令

蒸馏出的 AI Persona 支持分期切换：

```
用户: "用早期维特根斯坦的立场回答：语言和世界的关系是什么？"
AI: [切换到 early-period SOUL]
    回答基于 Tractatus 的逻辑图像论

用户: "那么后期呢？"
AI: [切换到 late-period SOUL]
    回答基于 PI 的语言游戏论，指出与早期观点的关键差异
```
