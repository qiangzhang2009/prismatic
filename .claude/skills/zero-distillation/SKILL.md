# Zero Persona Distillation

## 描述

Zero Persona Distillation 是一种从文本语料库中自动提取 AI 人格角色（Persona）的技术。通过对语料进行多维度分析——包括知识图谱、表达 DNA、紧张关系、 Rhetorical Habits 等——将一个人物的思维模式、表达风格和核心观点蒸馏为一个结构化的 JSON 定义，可直接用于 AI 对话系统。

该技能基于 44 个 persona 的批量蒸馏经验，积累了大量的实战调优经验，能够处理语料污染、OOM、JSON 解析失败等真实场景中的问题。

## 适用场景

在以下情况使用此技能：

- 从某个人物的文本语料（书籍、演讲、访谈、博客等）创建 AI Persona
- 需要批量处理多个人物的蒸馏任务
- 现有 Persona 质量不佳，需要改进语料处理流程
- 语料库规模较大（100+ 文件），需要优化采样策略

**前置条件：**

- 语料库已准备好，存放于 `corpus/{personaId}/` 目录
- 语料格式为纯文本（`.txt`），支持子目录嵌套
- Node.js 环境已就绪，`npm install` 已执行
- 已配置 LLM API（通过环境变量）

## 使用方法

### 单人物蒸馏

```bash
node scripts/zero/distill-zero.mjs <personaId> [--budget=<金额>]
```

示例：

```bash
# 使用默认 $3 预算
node scripts/zero/distill-zero.mjs jiqun

# 自定义预算
node scripts/zero/distill-zero.mjs ni-haixia --budget=5

# 仅预览（dry-run）
node scripts/zero/distill-zero.mjs alan-turing --dry-run
```

### 批量蒸馏

```bash
node scripts/zero/batch-zero.mjs [--budget=<金额>] [--parallel=<并发数>]
```

示例：

```bash
# 串行处理所有未蒸馏的 persona
node scripts/zero/batch-zero.mjs

# 并行处理，最多 3 个并发
node scripts/zero/batch-zero.mjs --parallel=3 --budget=3
```

### 关键参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--budget` | `3` | LLM 调用的最大费用（美元） |
| `--parallel` | `1` | 批量模式下的并发数 |
| `--dry-run` | `false` | 仅预览，不执行实际蒸馏 |
| `--force` | `false` | 强制重新蒸馏（跳过已有输出） |
| `--sample-size` | `50000` | 采样字符数（默认 50K） |

### 工作流程

1. **语料加载**：遍历 `corpus/{personaId}/` 下所有 `.txt` 文件
2. **预处理**：清理格式（HTML 残留、OCR 错误、分段标记）
3. **质量分析**：检测语料类型（临床/哲学/技术/混合）、语言分布
4. **知识提取**：调用 LLM 提取知识图谱（概念、原理、论点）
5. **表达 DNA 提取**：分析词汇指纹、句法模式、语调轨迹
6. **紧张关系分析**：识别价值张力、修辞习惯、Anti-patterns
7. **综合评分**：基于多维度指标计算质量评分（A/B/C/D）
8. **输出**：生成 `corpus/distilled/zero/{personaId}-zero.json`

## 质量提升指南

以下经验来自 44 个 persona 的真实蒸馏运行，请务必遵循：

### ✅ 有效的做法

#### 1. 语料污染检测与过滤

**问题**：ni-haixia（中医大师）的语料中混入了 504KB 的小说《C-98秘方》，与临床记录混杂在一起，导致提取的知识被小说内容污染。

**解决方案**：实施两层过滤机制

**文件名过滤**——跳过以下模式：

```
/秘方|C[\-－]?98|小说|fiction|novel|romance/i
```

**内容过滤**——检测前 5000 字符中是否出现小说特征词：

```javascript
const NOVEL_MARKERS = ['麦克唐纳教授', '克格勃', 'CIA', '联邦调查局', '间谍'];
const novelCount = NOVEL_MARKERS.filter(m => text.slice(0, 5000).includes(m)).length;
if (novelCount >= 2) skipFile();
```

#### 2. LLM 预算阈值调优

**问题**：原始代码使用 `session.remainingBudget > 1` 判断是否触发表达层 LLM 精炼。由于知识提取消耗约 $0.017 后剩余预算已不足，导致表达层精炼永远无法触发。

**修复**：

```javascript
// ❌ 错误：阈值过高，$0.017 的消耗使剩余预算不足
if (session.remainingBudget > 1) { /* 永远不会执行 */ }

// ✅ 正确：留出足够的预算触发表达层
if (session.remainingBudget > 0.5) {
  await refineExpressionWithLLM();
}
```

#### 3. 采样大小固定为 50K

**问题**：原代码根据预算动态选择采样大小：

```javascript
// ❌ 错误：预算低时只用 20K chars，质量严重下降
const sampleSize = budget < 3 ? 20000 : 50000;
```

**修复**：始终使用 50K 字符采样，预算仅用于控制 LLM 调用次数：

```javascript
// ✅ 正确：固定高质量采样，预算控制 LLM 深度
const SAMPLE_SIZE = 50000; // 固定值
const budgetForLLM = budget - estimatedLoadCost;
```

#### 4. 紧张关系提取支持多种 JSON 格式

**问题**：LLM 返回的紧张关系格式不一致，有时是裸数组，有时嵌套在对象中：

```javascript
// 可能的返回格式
{ "tensions": [...] }           // ✅ 标准
{ "items": [...] }             // ❌ 变体
[ ... ]                          // ❌ 裸数组
{ "internalTensions": [...] }  // ❌ 别名字段
```

**解决方案**：归一化处理所有可能的格式：

```javascript
function normalizeTensions(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw.tensions) return raw.tensions;
  if (raw.items) return raw.items;
  if (raw.internalTensions) return raw.internalTensions;
  return [];
}
```

同时在合并显式提取与推断结果时做去重：

```javascript
function mergeTensions(explicit, inferred) {
  const all = [...explicit, ...inferred];
  const seen = new Set();
  return all.filter(t => {
    const key = t.type + '|' + t.claim + '|' + t.counterClaim;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

#### 5. Anti-pattern 生成来源多元化

**问题**：Anti-pattern 仅从 mental model 的 `limitations` 字段生成，但很多 persona 的该字段为空。

**修复**：三个来源 + fallback：

1. 从 `limitations` 显式提取
2. 从价值紧张关系推断（"强调 X 但容易忽略 Y"）
3. 从通用 Heuristics 推断
4. 通用 anti-pattern 作为 fallback（适用于所有 persona）

```javascript
const antiPatterns = [
  ...explicitAntiPatterns,
  ...inferFromValueTensions(tensions),
  ...inferFromHeuristics(heuristics),
  ...FALLBACK_ANTIPATTERNS  // 始终有输出
];
```

#### 6. Rhetorical Habit 检测阈值调优

**问题**：类比检测阈值过高（`frequency >= 5`），导致大多数 persona 的 Rhetorical Habits 为空。

**修复**：多层次检测 + 降低阈值：

```javascript
// 修辞习惯检测配置
const RHETORICAL_PATTERNS = {
  // 类比：阈值从 5 降至 2
  analogy: { minFrequency: 2, examples: [...] },
  // 对比：识别"然而""但是""而非"等标记
  contrast: { minFrequency: 2, markers: ['然而', '但是', '而非', '不过'] },
  // 辩证：识别"正题-反题-合题"结构
  dialectical: { minFrequency: 1, markers: ['正题', '反题', '合题'] },
  // 归纳/演绎：识别特征模式
  inductive: { minFrequency: 2, patterns: [...] },
  deductive: { minFrequency: 2, patterns: [...] },
};
```

同时提取每个习惯的具体例子（不只是计数）：

```javascript
const habits = patterns.map(p => ({
  type: p.type,
  frequency: p.count,
  examples: p.examples.slice(0, 3),  // 保存最多 3 个例子
  context: p.contexts[0] || ''
}));
```

#### 7. 语言检测

使用字符频率比率判断语料语言：

```javascript
function detectLanguage(text) {
  const chars = text.slice(0, 10000);
  const chinese = (chars.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (chars.match(/[a-zA-Z]/g) || []).length;
  const japanese = (chars.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const french = (chars.match(/[àâäéèêëïîôùûüç]/gi) || []).length;
  const german = (chars.match(/[äöüß]/gi) || []).length;

  const total = chinese + english + japanese + french + german;
  if (total === 0) return 'unknown';

  const ratios = {
    chinese: chinese / total,
    english: english / total,
    japanese: japanese / total,
    french: french / total,
    german: german / total,
  };

  return Object.entries(ratios)
    .filter(([, r]) => r > 0.3)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
}
```

---

## 运行时知识边界系统（Runtime Knowledge Gap System）

### 问题背景

人物库中有些 persona 代表仍在世的人（`isAlive: true`）。当用户询问这些人物最近的动态，而蒸馏知识库中没有收录时，就会产生**知识空白（Knowledge Gap）**。

### 架构

```
User Question → L1 Enricher → L2 Detector → L3 Router → L3 Handler → Enriched Response
```

| 层级 | 职责 | 关键文件 |
|------|------|---------|
| L1 | 提取 persona 的 corpusMetadata | `distillation-runtime-orchestrator.ts` |
| L2 | 检测问题是否涉及知识空白 | `distillation-v2-gap-detector.ts` |
| L3 | 决定降级策略 + 生成响应 | `distillation-graceful-router.ts` + `distillation-knowledge-gap-handler.ts` |

### 降级策略（DegradationMode）

| 策略 | 触发条件 |
|------|---------|
| `normal` | 无知识空白，正常回复 |
| `extrapolate` | 有价值观/思维模式支撑，基于原则推演 |
| `honest_boundary` | 近期事件超出知识范围，诚实说明 |
| `refer_sources` | 有引用来源可用，标注来源 |
| `hybrid` | 混合场景，部分事实 + 部分推演 |

### 在 persona 中配置元数据

活人 persona 必须提供 `corpusMetadata`：

```typescript
{
  id: 'zhang-yiming',
  nameZh: '张一鸣',
  isAlive: true,
  corpusMetadata: {
    cutoffDate: '2025-06-01',          // 知识截止日期
    confidenceScore: 0.85,              // 置信度 0-1
    knowledgeGapSignals: [              // 知识空白信号
      '字节跳动最新动态',
      '2024-2025 年公开演讲',
    ],
    knowledgeGapStrategy: 'honest_boundary',  // 默认策略
    sensitiveTopics: ['个人隐私'],
    extrapolationBoundaries: {
      avoidTopics: ['未经披露的商业决策'],
      confidenceThreshold: 0.6,
    },
  }
}
```

### 运行时注入逻辑

在 `src/app/api/chat/route.ts` 的各模式中，活人 persona 的 system prompt 会自动注入截止期提示：

```typescript
// handleRoundtable 中的注入
const livingPersonas = speakers.filter(p => p.isAlive !== false && p.corpusMetadata?.cutoffDate);
if (livingPersonas.length > 0) {
  // 在 systemPrompt 末尾追加：
  // 【知识截止期提示】xxx 的知识截止到 yyy。
}
```

### 前端消费 `_gap` 字段

每个 AI 回复携带 `_gap` 字段，前端可据此渲染警告标签：

```typescript
{
  _gap: {
    isGapAware: true,
    degradationMode: 'honest_boundary',
    warningLabel: '【知识边界】以下内容超出蒸馏知识范围',
    corpusCutoffDate: '2025-06-01',
    gapSignals: ['字节跳动最新动态'],
    confidence: 0.85,
  }
}
```

---

---

### ❌ 无效的做法（失败教训）

#### 1. 大语料库 OOM

**问题**：`chinese-classics` 语料库（459 个文件，311MB）导致 FATAL ERROR: invalid array length。加载器试图一次性加载所有文件，正则表达式匹配时数组长度溢出。

**原因**：没有对文件数量和总大小做上限控制。

**解决方案**：实施硬性限制 + 智能采样：

```javascript
const MAX_FILES = 500;        // 最多加载 500 个文件
const MAX_TOTAL_CHARS = 10_000_000;  // 总字符数上限 10M

function loadCorpus(path) {
  const allFiles = glob(path, '**/*.txt');
  
  // 1. 按修改时间排序，优先加载最新文件
  allFiles.sort((a, b) => b.mtime - a.mtime);
  
  // 2. 硬性上限
  const capped = allFiles.slice(0, MAX_FILES);
  
  // 3. 按质量权重采样
  return qualityWeightedSample(capped, MAX_TOTAL_CHARS);
}
```

对于超大型语料（如 quantangshi 19,450 文件、ni-haixia 1,092 文件），必须使用分层采样：

```javascript
function stratifiedSample(files, targetChars) {
  // 按子目录分层
  const buckets = groupByDirectory(files);
  // 每层按质量分数加权
  const perBucket = Math.floor(targetChars / buckets.length);
  return buckets.flatMap(b => sampleByQuality(b, perBucket));
}
```

#### 2. 紧张关系 JSON 解析失败

**问题**：LLM 有时返回 `{"internalTensions": [...]}` 而非预期的 `{"tensions": [...]}`，导致解析失败。简单的重试逻辑无法从根本上解决问题。

**根本原因**：提示词中的格式说明不够明确，LLM 产生了变体输出。

**解决方案**：在提示词中明确指定格式，并提供多个 example：

```
返回格式（必须严格遵循）：
{
  "tensions": [
    {
      "type": "value" | "belief" | "practice",
      "claim": "核心主张",
      "counterClaim": "对立的另一面",
      "manifestation": "在文本中的具体表现"
    }
  ]
}

❌ 错误的格式：
- {"internalTensions": [...]}     ← 不要用 internalTensions
- {"items": [...]}                 ← 不要用 items
- [...]                             ← 不要返回裸数组
```

同时保留归一化解析作为 fallback（见上方「有效的做法」第 4 条）。

#### 3. 样本污染

**问题**：大型语料中混入 1 个损坏的 OCR 文件或格式错误文件，可能在 50K 采样中被过度代表，导致提取结果被污染。

**案例**：某个 persona 的语料混入了一段《圣经典故》，导致其"知识图谱"中出现了大量圣经引用。

**解决方案**：质量加权采样：

```javascript
function qualityWeightedSample(files, targetChars) {
  return files
    .map(f => ({ file: f, score: assessQuality(f) }))
    .filter(({ score }) => score > 0.3)  // 丢弃质量 < 0.3 的文件
    .sort((a, b) => b.score - a.score)
    .reduce((acc, { file, score }) => {
      const chars = readFile(file);
      const weight = Math.pow(score, 2); // 平方权重放大质量差异
      const allocated = Math.min(chars.length * weight, remaining);
      acc += chars.slice(0, allocated);
      remaining -= allocated;
      return acc;
    }, '');
}
```

#### 4. 语料类型自动检测不准确

**问题**：jiqun（佛教法师）语料被误判为"临床"类型而非"混合"类型，因为教学示例中包含了临床相关的标记词，导致使用了不恰当的提取提示词。

**根本原因**：基于关键词频率的类型判断过于简单。

**解决方案**：使用 LLM 做类型推断（在预处理阶段）：

```javascript
async function detectCorpusType(text, personaId) {
  const sample = text.slice(0, 5000);
  const response = await llm.call(`
    判断以下语料的主要类型：
    - clinical: 临床医学/健康咨询
    - philosophical: 哲学/思辨/抽象理论
    - technical: 技术/科学/工程
    - literary: 文学/创意写作
    - mixed: 混合类型（教学、访谈、演讲等）

    语料示例：${sample}

    返回 JSON: {"type": "类型", "confidence": 0.0-1.0, "reasoning": "判断理由"}
  `);

  const result = JSON.parse(response);
  // confidence < 0.6 时使用默认类型
  return result.confidence >= 0.6 ? result.type : 'default';
}
```

#### 5. 英文语料格式问题

**问题**：alan-turing 的 ExpressionDNA 提取结果为乱码（`["nek", "ksv", "paw"]`），因为原始文本包含大量 OCR 错误和 HTML 标签残留。

**根本原因**：没有针对不同格式的清洗策略。

**解决方案**：格式感知清洗：

```javascript
function cleanText(text, detectedFormat) {
  switch (detectedFormat) {
    case 'html':
      // 移除 HTML 标签，保留文本内容
      text = text.replace(/<[^>]+>/g, ' ');
      text = text.replace(/&nbsp;|&amp;|&lt;|&gt;/g, ' ');
      break;
    case 'ocr':
      // 移除乱码模式
      text = text.replace(/[�□▪▫]/g, '');  // 常见 OCR 错误字符
      text = text.replace(/\s{3,}/g, '\n'); // 多个空格转行
      break;
    case 'pdf':
      // 处理 PDF 换行问题
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');  // 连字符合并
      break;
    case 'plain':
    default:
      // 最小清洗
      text = text.replace(/\r\n/g, '\n');
      break;
  }
  return text;
}
```

对于英文特殊处理：

```javascript
// 检测并清洗 HTML 残留
if (hasHTMLArtifacts(text)) {
  text = stripHTML(text);
}

// 检测 OCR 乱码（连续无意义字符）
if (hasGarbledOCR(text)) {
  text = fixOCRGarble(text);
}
```

#### 6. 超大型语料库内存溢出

**问题**：quantangshi（19,450 文件）和 ni-haixia（1,092 文件）如果用基础 glob + readAll 方式加载，必然 OOM。

**解决方案**：流式加载 + 增量处理：

```javascript
async function* loadCorpusStream(path) {
  for await (const file of globStream(path, '**/*.txt')) {
    yield await readFile(file, 'utf-8');
    // 每个文件处理后释放内存
    await new Promise(r => setImmediate(r));
  }
}

async function processLargeCorpus(path, onChunk) {
  let buffer = '';
  for await (const chunk of loadCorpusStream(path)) {
    buffer += chunk;
    while (buffer.length > SAMPLE_SIZE) {
      // 提取后丢弃已处理的内容
      const processed = buffer.slice(0, SAMPLE_SIZE);
      onChunk(processed);
      buffer = buffer.slice(SAMPLE_SIZE);
    }
  }
  if (buffer.length > 0) onChunk(buffer);
}
```

## 常见问题与修复

### FATAL ERROR: invalid array length

**原因**：文件数量过多（> 500）或总大小过大（> 100MB），正则表达式匹配时数组长度溢出。

**修复**：

```javascript
const MAX_FILES = 500;
const files = allFiles.slice(0, MAX_FILES);
```

### JSON Parse 失败

**原因**：LLM 返回的 JSON 格式不符合预期（裸数组、错误字段名等）。

**修复**：使用归一化解析 + 重试逻辑：

```javascript
function safeParse(raw) {
  const normalized = normalizeLLMResponse(raw);
  try {
    return JSON.parse(normalized);
  } catch {
    // 尝试提取 JSON 代码块
    const extracted = extractJSONBlock(raw);
    return JSON.parse(extracted);
  }
}

async function extractWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const raw = await llm.call(prompt);
    const parsed = safeParse(raw);
    if (isValidTensions(parsed)) return parsed;
  }
  throw new Error('All retries failed');
}
```

### 语料被小说/无关内容污染

**原因**：语料中混入了小说、故事等非目标内容。

**修复**：双重过滤（见上方「语料污染检测与过滤」）。

### ExpressionDNA 词汇为乱码

**原因**：原始文本包含 HTML 标签、OCR 错误等格式问题。

**修复**：格式感知清洗（见上方「英文语料格式问题」）。

### 语料类型判断错误

**原因**：关键词频率判断过于简单，混淆了教学示例与实际专业内容。

**修复**：使用 LLM 做类型推断（见上方「语料类型自动检测不准确」）。

### 表达层 LLM 精炼未触发

**原因**：预算阈值设置过高（`> 1`），知识提取后剩余预算不足。

**修复**：将阈值降至 `> 0.5`，确保表达层有充足预算。

### 采样质量差

**原因**：未加权采样，小文件与损坏文件过度代表。

**修复**：质量加权采样 + 丢弃低质量文件（score < 0.3）。

## 语料要求

### 文件格式

- **推荐格式**：纯文本 `.txt`，UTF-8 编码
- **可接受格式**：Markdown（`.md`）会自动转换为纯文本
- **不支持格式**：PDF、Word、HTML（需要预先转换）

### 文件组织

```
corpus/
  {personaId}/
    texts/           # 主文本目录
      book-1.txt     # 书籍
      lecture-1.txt  # 演讲
    interviews/      # 可选子目录
      interview-1.txt
    metadata.json    # 可选元数据
```

### 大小限制

| 指标 | 软限制 | 硬限制 | 说明 |
|------|--------|--------|------|
| 单文件大小 | < 5MB | 20MB | 超过 5MB 建议分割 |
| 文件数量 | < 500 | 1000 | 超过 500 建议分层采样 |
| 总字符数 | 1M-10M | 50M | 推荐 1M-10M 字符 |
| 采样大小 | 50K | - | 固定使用 50K 字符进行蒸馏 |

### 质量指南

**高质量语料的特征：**

- 来源可靠（书籍、正式演讲、访谈记录）
- 格式规范（无乱码、无大量 HTML 残留）
- 内容纯净（无小说、无无关内容混入）
- 语言一致（主要语言占比 > 80%）
- 覆盖全面（包含核心观点、论证过程、实际案例）

**需要清洗的情况：**

- 包含 HTML 标签或 Markdown 残留
- 包含 OCR 识别错误
- 包含大量引用或转述内容（非原创）
- 包含混合语言（除非目标是多语言 persona）

## 输出格式

蒸馏完成后，输出文件位于：

```
corpus/distilled/zero/{personaId}-zero.json
```

### JSON 结构

```json
{
  "personaId": "jiqun",
  "version": "1.0.0",
  "distilledAt": "2026-04-25T11:00:00.000Z",
  "metadata": {
    "corpusSize": 1234567,
    "sampleSize": 50000,
    "language": "chinese",
    "corpusType": "philosophical",
    "quality": {
      "score": 91,
      "grade": "A",
      "dimensions": {
        "expressionDNA": 0.95,
        "knowledgeDepth": 0.88,
        "tensionCoverage": 0.90,
        "rhetoricalAccuracy": 0.92
      }
    },
    "cost": 0.027,
    "durationSeconds": 51
  },
  "expressionDNA": {
    "vocabulary": {
      "signature": ["缘起", "性空", "法界", "无明", "轮回"],
      "specialized": ["四谛", "八正道", "十二因缘", "三十七道品"],
      "casual": ["其实", "比如说", "比如说", "大概"]
    },
    "syntax": {
      "sentenceLength": "medium",
      "complexityLevel": "high",
      "questionFrequency": "low",
      "fragmentFrequency": "medium"
    },
    "tone": {
      "formality": "teaching",
      "emotionalRange": "warm",
      "confidenceLevel": "authoritative",
      "humorFrequency": "rare"
    },
    "rhythm": {
      "paragraphLength": "medium-to-long",
      "digressionTendency": "moderate",
      "repetitionPatterns": ["层层递进", "从...到..."]
    }
  },
  "knowledgeGraph": {
    "coreConcepts": [
      {
        "term": "缘起",
        "definition": "一切有为法皆依因缘而生起",
        "importance": 10,
        "examples": ["种子发芽需要阳光水分", "人的命运由因果链决定"]
      }
    ],
    "principles": [
      {
        "statement": "诸行无常",
        "explanation": "一切现象都在变化之中，没有永恒不变的事物",
        "confidence": 0.95
      }
    ],
    "controversies": [
      {
        "topic": "顿悟与渐悟",
        "positions": ["禅宗主张顿悟", "其他流派主张渐修"],
        "personaPosition": "顿悟"
      }
    ]
  },
  "tensions": {
    "explicit": [
      {
        "type": "belief",
        "claim": "一切众生皆有佛性",
        "counterClaim": "但众生被无明遮蔽",
        "manifestation": "反复强调'放下屠刀立地成佛'"
      }
    ],
    "inferred": [
      {
        "type": "practice",
        "claim": "强调修行实践",
        "counterClaim": "但也重视理论研读",
        "manifestation": "同时推荐读经与打坐"
      }
    ]
  },
  "antiPatterns": [
    {
      "description": "过度简化复杂的因果关系",
      "examples": ["把所有问题归因于'无明'", "将复杂的人生问题归结为单一原因"],
      "mitigation": "在解释时引入条件和限定"
    }
  ],
  "rhetoricalHabits": [
    {
      "type": "analogy",
      "frequency": 12,
      "examples": [
        { "text": "心如明镜", "context": "解释心的本性" },
        { "text": "种子与果实", "context": "解释因果律" }
      ],
      "characteristic": "善用比喻化抽象为具体"
    },
    {
      "type": "contrast",
      "frequency": 8,
      "markers": ["而非", "不是...而是", "但是"],
      "characteristic": "通过对比突出核心观点"
    },
    {
      "type": "dialectical",
      "frequency": 3,
      "pattern": "正题-反题-合题",
      "characteristic": "采用黑格尔式辩证结构"
    }
  ],
  "mentalModel": {
    "worldview": "缘起性空——世界由因缘和合而生，没有独立自性",
    "values": ["慈悲", "智慧", "中道", "无常"],
    "reasoningStyle": "归纳与演绎并用，偏好具体案例说明抽象道理",
    "cognitiveBiases": ["确认偏误——倾向于引用支持佛教观点的现代科学发现"],
    "limitations": ["对量化分析不够重视"]
  }
}
```

## 故障排查

### 蒸馏运行卡住

```bash
# 检查是否在加载阶段卡住
node --inspect scripts/zero/distill-zero.mjs jiqun

# 查看详细日志
DEBUG=* node scripts/zero/distill-zero.mjs jiqun
```

### 输出文件缺失或为空

```bash
# 检查语料目录是否存在
ls -la corpus/jiqun/

# 检查是否有 .txt 文件
find corpus/jiqun/ -name "*.txt" | wc -l

# 手动运行并捕获错误
node scripts/zero/distill-zero.mjs jiqun 2>&1 | tee distill-debug.log
```

### 质量评分异常低

```bash
# 检查语料是否被污染
grep -l "小说\|fiction\|novel" corpus/jiqun/**/*.txt

# 检查语言检测结果
node -e "
const { detectLanguage } = require('./src/lib/zero/corpus/analyzer');
const fs = require('fs');
const text = fs.readFileSync('corpus/jiqun/texts/main.txt', 'utf8');
console.log(detectLanguage(text));
"

# 检查采样质量
node -e "
const { loadCorpus } = require('./src/lib/zero/corpus/loader');
const files = await loadCorpus('corpus/jiqun');
console.log('Files:', files.length);
console.log('Total chars:', files.reduce((a, f) => a + f.content.length, 0));
"
```

### LLM API 错误

```bash
# 检查 API 密钥
echo $OPENAI_API_KEY

# 测试 API 连通性
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 检查 API 配额
node -e "
const { checkQuota } = require('./src/lib/zero/utils/llm');
checkQuota().then(console.log).catch(console.error);
"
```

### 批量运行时某个 persona 失败导致整体中断

```bash
# 使用 --continue 跳过失败的 persona
node scripts/zero/batch-zero.mjs --continue --parallel=3

# 或者仅处理指定 persona
node scripts/zero/batch-zero.mjs --only=jiqun,ni-haixia,alan-turing
```

### 调试脚本（临时使用）

项目包含临时调试脚本，位置在 `scripts/archive/` 目录：

```bash
# 调试采样
node scripts/archive/debug-values.mjs corpus/jiqun

# 调试紧张关系提取
node scripts/archive/debug-extract.mjs corpus/jiqun/texts/main.txt

# 调试行级分析
node scripts/archive/debug-lines.js corpus/jiqun
```

> 注意：这些调试脚本为临时用途，完成调试后请删除或归档。

### 性能基准

参考运行数据：

| Persona | 类型 | 语料规模 | 评分 | 成本 | 时长 |
|---------|------|----------|------|------|------|
| jiqun | 哲学/佛教 | ~1MB | 91/A | $0.027 | 51s |
| ni-haixia | 临床/中医 | ~2MB | 88/B | $0.028 | 76s |
| alan-turing | 技术/传记 | ~500KB | 82/C | ~$0.03 | ~60s |
| charlie-munger | 商业/思维模型 | ~1MB | 85/B | ~$0.03 | ~65s |
| carl-jung | 心理学/哲学 | ~2MB | 85/B | ~$0.03 | ~70s |

**$3 预算足以完成**：50K 字符采样 + 知识提取 + 表达 DNA 提取 + 紧张关系分析 + 表达层精炼。
