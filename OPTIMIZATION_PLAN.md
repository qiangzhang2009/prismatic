# Prismatic 蒸馏方法论优化计划 v1.0

> **版本**: v1.0
> **日期**: 2026-04-19
> **目标**: 将 6 步科学蒸馏法从概念方案转化为可量化的技术优化计划

---

## 一、总览：6步法的自动化光谱

```
100% 自动化 ←───────────────────────────────→ 100% 人工
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Step 1  │ Step 2  │ Step 3  │ Step 4  │ Step 5  │ Step 6  │
│ 深度研究 │ 心智模型 │ 表达DNA │ Prompt  │ 盲测评估 │ 迭代优化 │
│         │  提取   │  建模   │  工程   │         │         │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│  ★★★    │   ★★    │   ★★    │  ★★★    │   ★     │   ★★    │
│ 高自动化 │ 半自动  │ 半自动  │ 高自动化 │ 人工为主 │ 半自动  │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
★ = 自动化潜力
```

**核心原则**: 自动化一切可自动化的，保留人工在真正需要判断力的环节。

---

## 二、分步优化计划

### Step 1: 深度研究 → 优化目标：建立自动化采集管道

#### 当前状态
- 耗时：3-5天/人
- 方式：人工梳理公开著作、演讲、访谈等
- 交付物：资料清单 + 核心观点提取

#### 优化方向

**自动化采集层**（技术驱动）

| 工具/系统 | 采集来源 | 能力 |
|-----------|---------|------|
| Multi-Source Collector | 网页/RSS | 多站点并行采集，带重试和去重 |
| YouTube Transcript API | YouTube | 自动获取演讲字幕 |
| RSS Aggregator | 播客/Blog | 定期抓取新内容 |
| Tavily/Exa API | 全网搜索 | 补充公开资料缺口 |

**数据处理层**（LLM 辅助）

| 功能 | 自动化程度 | 说明 |
|------|-----------|------|
| 文本去重与格式化 | 全自动 | 基于 SimHash 或 MinHash |
| 高频观点词提取 | 全自动 | TF-IDF + 观点聚类 |
| 引用来源元数据提取 | 半自动 | LLM 提取，人工校验 |
| 信息可靠性评分 | 半自动 | 基于来源权威性规则 + LLM 判断 |
| 公开立场 vs 真实想法区分 | 人工为主 | 需要语境理解和价值判断 |

**交付物检查清单**

```
□ 原始资料 ≥ 10 个来源（书籍/演讲/访谈各 ≥ 1）
□ 每个资料含：标题、来源、日期、字数/时长
□ 提取的核心观点 ≥ 20 条（需引用来源）
□ 标注不可靠来源 ≥ 1 条（如有）
□ 区分公开立场与真实想法的笔记 ≥ 3 条
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 采集覆盖率 | 来源覆盖率 ≥ 80% | 人工评审可用资料/理论应有资料 |
| 去重效率 | 重复内容过滤率 ≥ 90% | 自动去重前后文本量对比 |
| 观点提取准确率 | 核心观点准确率 ≥ 85% | 人工抽检 10 条观点 |
| 研究周期 | 从 3-5 天降至 1-2 天 | 实际计时 |

#### 实施优先级：P0（最高）
> 原因：这是整个流程的输入，决定了后续所有步骤的质量上限。

---

### Step 2: 心智模型提取 → 优化目标：结构化提取框架

#### 当前状态
- 耗时：2-3天/人
- 方式：人工从海量资料中提取
- 交付物：3-8个结构化心智模型

#### 优化方向

**自动提取辅助**

| 功能 | 自动化程度 | 说明 |
|------|-----------|------|
| 「观点+来源」对自动识别 | 半自动 | LLM 提取候选，人工筛选核心模型 |
| 模型间关系图构建 | 半自动 | 基于共现分析 + 人工确认层级 |
| 模型局限性自动检测 | 半自动 | 检测过度绝对的表述作为边界候选 |
| 核心 vs 偶发观点区分 | 人工为主 | 需要判断该观点是否是人物的核心关切 |

**心智模型标准化结构**（强制使用）

```typescript
interface MentalModel {
  name: string;           // 模型名称
  nameEn: string;         // 英文名称
  oneLiner: string;        // 一句话定义（≤50字）

  // 证据层
  evidence: Array<{
    quote: string;        // 原始引用
    source: string;       // 来源
    year?: number;         // 年份
    page?: string;         // 页码（书籍）
  }>;

  crossDomain: string[];   // 跨领域应用 ["产品", "战略", "人生"]
  application: string;    // 实际应用场景描述
  limitation: string;      // 边界条件（必须填写）
  blindspot?: string;     // 人物的盲点（反多元化）
  version: string;        // 提取版本
  extractedAt: string;    // 提取时间
}
```

**交付物检查清单**

```
□ 心智模型数量在 3-8 个范围内
□ 每个模型有 ≥ 2 个原始引用
□ 每个模型的 crossDomain 标注 ≥ 1
□ 每个模型的 limitation 非空且非默认文案
□ 至少 1 个模型包含 blindspot
□ 模型间关系图已绘制（文字描述可）
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 模型数量合规率 | 3-8 个，符合率 ≥ 90% | 检查输出 |
| 引用完整性 | 每个模型 ≥ 2 个引用，覆盖率 100% | 检查 evidence 数组 |
| 边界条件填充率 | 100%（不允许为空） | 检查 limitation 字段 |
| blindspot 覆盖率 | ≥ 30% 的模型含 blindspot | 防止过度神化 |
| 提取周期 | 从 2-3 天降至 0.5-1 天 | 实际计时 |

#### 实施优先级：P0

---

### Step 3: 表达 DNA 建模 → 优化目标：五维量化指标体系

#### 当前状态
- 耗时：1-2天/人
- 方式：人工分析句式、用词、修辞
- 交付物：五维表达特征档案

#### 优化方向

**五维量化指标**

| 维度 | 指标 | 量化方法 | 目标值示例 |
|------|------|---------|-----------|
| 句式特征 | 短句/长句比例 | 句长分布统计 | 乔布斯：短句主导（短句 ≥ 70%） |
| 标志性词汇 | 高频词 top-20 | 词频统计（去停用词） | 乔布斯："垃圾桶" "简直是垃圾" |
| 修辞手法 | 修辞类型分布 | 正则 + LLM 识别 | 乔布斯：反问 + 二元对立 |
| 情绪温度 | 激情/冷静/幽默指数 | 情感分析 + 词性分析 | 乔布斯：激情型（高情感词密度） |
| 确定性水平 | 绝对词 vs 模糊词比例 | 词汇匹配统计 | 乔布斯：高确定性（模糊词 < 5%） |

**表达 DNA 标准化结构**

```typescript
interface VoiceDNA {
  sentencePattern: {
    type: 'short' | 'long' | 'mixed';
    shortSentenceRatio: number;  // 短句占比（<15词）
    avgSentenceLength: number;
    pauseFrequency: 'high' | 'medium' | 'low';  // 省略号/破折号使用频率
  };

  signatureWords: Array<{
    word: string;
    frequency: number;    // 出现频率
    context: string[];    // 使用语境示例
  }>;

  signaturePhrases: Array<{
    phrase: string;
    meaning: string;      // 含义解释
    example: string;      // 使用示例
  }>;

  rhetoricalDevices: Array<{
    type: 'rhetorical-question' | 'tricolon' | 'analogy' | 'dichotomy' | 'repetition';
    count: number;
    examples: string[];
  }>;

  emotionalTemperature: 'passionate' | 'calm' | 'humorous' | 'authoritative' | 'mixed';
  emotionalIndex: number;  // 0-100，情感强度

  certaintyLevel: 'high' | 'medium' | 'low';
  absoluteWordRatio: number;   // 绝对词（绝对/必须/永远）比例
  uncertainWordRatio: number;  // 模糊词（也许/可能/大概）比例

  tabooWords: string[];        // 从不使用的词（如乔布斯从不说"也许"）
  favoritePatterns: string[];  // 最喜欢的句式（如"这就是..."）

  version: string;
}
```

**交付物检查清单**

```
□ 句式特征：avgSentenceLength 已计算，短句比例已标注
□ 标志性词汇：top-20 词汇列表，含使用语境
□ 标志性短语：≥ 5 个，含含义和使用示例
□ 修辞手法：≥ 2 种修辞类型，各有 ≥ 1 个示例
□ 情绪温度：定性判断（激情/冷静/幽默/权威/混合）+ 量化指数
□ 确定性水平：绝对词和模糊词比例已统计
□ tabooWords：≥ 3 个"从不说"的词
□ 至少 3 个 favoritePatterns
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 维度覆盖率 | 五维全部填充，100% | 检查所有字段非空 |
| 量化比例 | 统计类指标（词汇频率/句式比例）必须量化 | 检查数值字段 |
| 盲测识别率 | 蒸馏后的 AI 在盲测中识别率 ≥ 60% | 盲测评估结果 |
| 提取周期 | 从 1-2 天降至 0.5 天 | 实际计时 |

#### 实施优先级：P1

---

### Step 4: 系统提示词工程 → 优化目标：模板化 + 版本管理

#### 当前状态
- 耗时：1-2天/人
- 方式：手工编写 prompt
- 交付物：完整的 Prompt 体系

#### 优化方向

**Prompt 模板体系**

```typescript
interface PromptKit {
  identity: {
    text: string;           // 10-20字的核心理念
    tone: string;           // 语气描述
    constraint: string;     // 约束条件
  };

  systemPrompt: {
    template: string;       // 完整模板
    variables: string[];    // 模板变量列表
    version: string;
  };

  decisionHeuristics: Array<{
    situation: string;      // 场景描述
    response: string;       // 响应方式
    priority: 'high' | 'medium' | 'low';
  }>;

  forbiddenPatterns: Array<{
    pattern: string;        // 禁止的思维/表达模式
    reason: string;         // 禁止原因
    alternative: string;    // 替代方式
  }>;

  honestBoundaries: Array<{
    topic: string;          // 不能回答的话题
    reason: string;         // 原因
    suggestedResponse: string; // 建议的回应话术
  }>;

  version: string;
  lastUpdated: string;
  updateReason: string;
}
```

**版本管理规则**

```
版本格式：major.minor
- major: 重大更新（新增/删除心智模型、改变核心身份定义）
- minor: 微调（措辞优化、边界条件更新、新的禁止模式）

版本演进记录格式：
v1.0 → v1.1: [原因] - [具体变更]
v1.1 → v2.0: [原因] - [具体变更]
```

**交付物检查清单**

```
□ Identity Prompt：10-20字，核心认同清晰
□ System Prompt：完整指令，变量已填充
□ Decision Heuristics：≥ 5 条，涵盖常见场景
□ Forbidden Patterns：≥ 3 条，含替代方案
□ Honest Boundaries：每条含话题+原因+建议回应
□ 版本号：已分配，格式正确
□ 版本历史：包含本次变更的记录
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 模板完整性 | 所有字段非空，100% | 检查 PromptKit |
| Heuristics 覆盖率 | 常见场景 ≥ 5 个 | 评审决策场景 |
| 边界条件清晰度 | 边界声明可被测试验证 | 盲测评估验证 |
| 模板复用率 | 同类型人物模板可复用 ≥ 50% | 模板相似度分析 |
| 生成周期 | 从 1-2 天降至 0.5 天 | 实际计时 |

#### 实施优先级：P0

---

### Step 5: 盲测评估 → 优化目标：标准化评估框架

#### 当前状态
- 耗时：1-2天
- 方式：人工设计题目 + 邀请评估者
- 交付物：识别率 + 质量评分 + 边界测试结果

#### 优化方向

**标准化评估题目生成器**

```typescript
interface EvaluationKit {
  personaId: string;
  version: string;

  // 题目设计
  questions: Array<{
    id: string;
    type: 'core-belief' | 'opinion' | 'style' | 'boundary' | 'multi-turn';
    question: string;        // 盲测题目
    expectedTopics: string[]; // 期望涉及的议题
    evaluationCriteria: string; // 评估标准
    difficulty: 'easy' | 'medium' | 'hard';
  }>;

  // 评估维度
  dimensions: {
    recognitionRate: {       // 能否识别出来？
      questions: string[];  // 题目ID
      threshold: number;    // 通过阈值
    };
    thoughtAccuracy: {       // 思维是否准确？
      questions: string[];
      threshold: number;
    };
    voiceConsistency: {      // 表达是否一致？
      questions: string[];
      threshold: number;
    };
    boundaryClarity: {      // 边界是否清晰？
      questions: string[];
      threshold: number;
    };
    identityConsistency: {  // 多轮对话身份一致性
      turns: number;        // 对话轮数
      threshold: number;
    };
  };

  // 评估者要求
  evaluatorCriteria: {
    familiarityLevel: 'expert' | 'familiar' | 'casual';
    requiredCount: number;   // 最少评估者数量
    agreementThreshold: number; // 评估一致性阈值
  };
}
```

**量化评估标准**

| 评估维度 | 量化指标 | 测量方法 | 通过阈值 |
|---------|---------|---------|---------|
| 识别率 | 在 N 轮对话内被识别出的比例 | 评估者投票 | ≥ 60% 在 3 轮内识别 |
| 思维准确性 | 观点与原始资料的语义相似度 | LLM 评审 + 人工抽检 | ≥ 80% |
| 表达一致性 | 与已知表达 DNA 的匹配度 | 语义向量余弦相似度 | ≥ 75% |
| 边界清晰度 | 不该回答的问题被正确拒绝的比例 | 边界测试题 | ≥ 70% |
| 身份一致性 | 多轮对话中身份描述一致率 | 关键信息点比对 | ≥ 85% |

**交付物检查清单**

```
□ 评估题目 ≥ 10 道，涵盖核心观点/表达风格/边界条件
□ 每道题含评估标准和期望topics
□ 评估者 ≥ 3 人，含熟悉程度标注
□ 每维度有量化评分和阈值判定
□ 识别率报告：3轮内识别比例
□ 最终通过/不通过判定及理由
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 题目覆盖率 | 覆盖 80% 的核心心智模型 | 检查每模型 ≥ 1 题 |
| 评估一致性 | 评估者评分方差 ≤ 0.3（5分制） | 统计分析 |
| 识别率 | 3轮内识别率 ≥ 60% | 盲测结果 |
| 边界测试通过率 | ≥ 70% | 边界题正确率 |
| 评估周期 | 从 1-2 天降至 0.5 天 | 实际计时 |

#### 实施优先级：P1

---

### Step 6: 迭代优化 → 优化目标：可持续的反馈循环

#### 当前状态
- 耗时：持续
- 方式：被动收集反馈
- 交付物：版本演进记录

#### 优化方向

**用户反馈收集体系**

```typescript
interface FeedbackCollection {
  // 主动反馈
  postConversationSurvey: {
    enabled: boolean;
    questions: Array<{
      id: string;
      type: 'rating' | 'multiple-choice' | 'free-text';
      question: string;
      required: boolean;
    }>;
  };

  // 被动信号
  passiveSignals: {
    conversationLength: boolean;     // 对话轮数
    returnRate: boolean;            // 用户是否返回
    topicDistribution: boolean;      // 对话话题分布
    abruptEndRate: boolean;          // 突然结束率（可能表示不满）
  };

  // 质量信号
  qualitySignals: {
    explicitThumbsUp: boolean;       // 👍
    explicitThumbsDown: boolean;     // 👎
    conversationRestartRate: boolean; // 重开对话率
    personaSwitchRate: boolean;      // 切换 persona 率
  };
}

interface IterationRecord {
  version: string;
  trigger: 'user-feedback' | 'new-material' | 'internal-review' | 'bug-fix';
  changes: Array<{
    type: 'add' | 'remove' | 'modify';
    target: 'mental-model' | 'voice-dna' | 'prompt' | 'boundary';
    before: string;
    after: string;
    reason: string;
  }>;
  feedbackSource?: string;          // 触发本次迭代的反馈
  decidedBy: string;                // 决策人
  approvedAt: string;
}
```

**版本演进规则**

| 触发条件 | 版本变更 | 决策流程 |
|---------|---------|---------|
| 新增核心心智模型 | major++ | 需要重新盲测 |
| 表达风格重大调整 | major++ | 需要重新盲测 |
| 措辞/表述优化 | minor++ | 内部审核即可 |
| 边界条件更新 | minor++ | 内部审核即可 |
| 新公开资料整合 | minor++（内容多时 major） | 评估是否影响核心模型 |
| 用户负面反馈汇聚 | major 或 minor，视影响而定 | 需分析根因后决策 |

**交付物检查清单**

```
□ 反馈收集渠道已嵌入对话界面
□ 被动信号数据已配置追踪
□ 每次迭代有完整的版本变更记录
□ 版本历史对用户可见（可查看该人物的"更新日志"）
□ 迭代周期 ≤ 2 周/次（持续优化节奏）
```

#### 关键指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| 反馈收集率 | ≥ 20% 的对话产生反馈 | 反馈数/对话总数 |
| 负面反馈处理周期 | 从反馈到版本更新 ≤ 2 周 | 版本记录时间戳 |
| 版本更新频率 | 每个 Persona 每月至少 1 次 minor 更新 | 版本记录统计 |
| 持续优化覆盖 | ≥ 50% 的 Persona 在 3 个月内被优化 | 版本记录统计 |

#### 实施优先级：P2

---

## 三、质量标准量化体系

### 过程质量指标

| 标准 | 指标 | 目标值 | 测量方法 |
|------|------|-------|---------|
| 研究完整性 | 资料来源覆盖率 | ≥ 80% | 人工评审 |
| 模型提取率 | 3-8 个模型符合率 | ≥ 90% | 自动检查 |
| 引用完整率 | 每个观点有来源率 | 100% | 自动检查 |
| 边界条件填充率 | limitation 非空率 | 100% | 自动检查 |
| blindspot 覆盖率 | 含 blindspot 的模型率 | ≥ 30% | 自动检查 |
| 表达 DNA 完整率 | 五维全部填充率 | 100% | 自动检查 |

### 结果质量指标

| 标准 | 指标 | 目标值 | 测量方法 |
|------|------|-------|---------|
| 盲测识别率 | 3轮内识别率 | ≥ 60% | 盲测评估 |
| 思维准确性 | 观点相似度 | ≥ 80% | LLM评审 |
| 表达一致性 | DNA匹配度 | ≥ 75% | 语义向量 |
| 边界清晰度 | 边界测试通过率 | ≥ 70% | 边界测试 |
| 身份一致性 | 多轮一致性 | ≥ 85% | 对话测试 |
| 用户满意度 | NPS 或 CSAT | ≥ 40 NPS | 用户调研 |

---

## 四、实施路线图

### 第一阶段（1-2周）：基础设施

| 任务 | 负责 | 优先级 | 交付物 |
|------|------|-------|-------|
| 设计 Persona 数据标准化结构 | 工程 | P0 | TypeScript interfaces |
| 建立采集管道（多源采集框架） | 工程 | P0 | 可用的采集工具 |
| 设计评估题目生成器 | 产品 | P1 | 题目模板 |
| 建立版本管理系统 | 工程 | P1 | 版本追踪工具 |

### 第二阶段（3-4周）：核心工具

| 任务 | 负责 | 优先级 | 交付物 |
|------|------|-------|-------|
| 实现五维表达 DNA 量化分析 | 工程 | P1 | 量化分析脚本 |
| 实现心智模型提取辅助工具 | 工程 | P0 | 提取框架 |
| 实现 Prompt 模板引擎 | 工程 | P0 | Prompt 生成器 |
| 建立反馈收集渠道 | 工程 | P2 | 反馈 UI |

### 第三阶段（5-6周）：质量保障

| 任务 | 负责 | 优先级 | 交付物 |
|------|------|-------|-------|
| 建立盲测评估框架 | 产品 | P1 | 评估流程 |
| 建立质量指标 Dashboard | 工程 | P1 | 质量看板 |
| 执行第一个完整 Persona 蒸馏 | 运营 | P0 | 乔布斯 v1.0 |
| 基于反馈优化第一版 | 运营 | P0 | 乔布斯 v1.1 |

### 第四阶段（持续）：迭代优化

| 任务 | 负责 | 优先级 | 交付物 |
|------|------|-------|-------|
| 扩展更多 Persona | 运营 | P0 | 每月 1-2 个新 Persona |
| 建立反馈分析机制 | 产品 | P2 | 反馈分析报告 |
| 持续优化现有 Persona | 运营 | P2 | 版本演进记录 |
| 优化工具链效率 | 工程 | P1 | 工具迭代 |

---

## 六、gbrain 集成：Persona Brain 记忆系统

### 架构定位

gbrain（Y Combinator President 的开源 AI Agent 记忆系统）为蒸馏流水线提供**持久记忆层**。
每个蒸馏出的 Persona 拥有自己的专业 Brain，自动富化、自我维护。

```
蒸馏流水线 (现有)
  Step 1 语料采集 ─────────────────┐
  Step 2 心智模型提取 ────────────→ Brain Pages + 知识图谱
  Step 3 表达DNA ─────────────────→ ExpressionDNA 语料来源
  Step 5 盲测评估 ────────────────→ 混合搜索半自动问答比对
  Step 6 迭代优化 ────────────────→ Brain 自动更新

gbrain 增强层 (新增)
  - 7 个 WittSrc Brain 技能 (skills/wittsrc-brain/)
  - 6 个自动化脚本 (scripts/wittsrc-*.ts)
  - Minions 定时任务队列 (每日同步/维护)
  - PGLite 本地存储 (零配置启动)
```

### 集成点详解

#### Step 1: 自动化采集 (Minions)

```bash
# 每日自动任务（零 token 成本）
bun run scripts/wittsrc-minions.ts sync       # 同步 WittSrc/Clarino
bun run scripts/wittsrc-minions.ts link        # 抽取手稿引用关系
bun run scripts/wittsrc-minions.ts health      # 健康检查
```

#### Step 2: 心智模型 (图查询)

```bash
# 查询概念演变
bun run scripts/wittsrc-graph-query.ts concept-language-game --type evolves_to --depth 3

# 查询手稿关系
bun run scripts/wittsrc-graph-query.ts work-ms-114 --type cites --depth 2
```

#### Step 3: 表达DNA (Brain Pages 语料)

Brain Pages 中的 Compiled Truth 区域可直接用于 ExpressionDNA 提取：

```bash
# 检索某概念的讨论段落（语料样本）
bun run scripts/wittsrc-query.ts "Wittgenstein family resemblance" --compiled-truth-only
```

#### Step 5: 盲测评估 (混合搜索)

```bash
# 自动问答比对
bun run scripts/wittsrc-query.ts "$EVAL_QUESTION" --format comparison
# → 检索 Wittgenstein 最相关回答 + 比对 AI 生成内容
```

#### Step 6: 迭代优化 (Brain 自我更新)

- 语料库更新触发自动摄入
- 图抽取发现新的手稿关系
- 健康报告揭示缺口（孤立页、死链接）
- Soul Audit 定期重新评估身份配置

### WittSrc Brain vs 通用 gbrain

| 维度 | gbrain 原设计 | WittSrc Brain 适配 |
|------|-------------|------------------|
| 数据源 | 邮件/会议/推文 | WittSrc/Clarino/Gutenberg 学术语料 |
| 链接类型 | works_at/invested_in | cites/evolves_to/contradicts/influenced_by |
| 实体分级 | 提及频率 | 提及频率 + 是否核心哲学概念 |
| 哲学分期 | 无 | Early/Middle/Late 三个子身份 |
| 更新触发 | 实时信号 | 每日 cron + 语料库更新 |
| Soul Audit | 真人访谈 | 语料自动推断 + SEP/IEP 综述 |

### 文件清单

```
skills/wittsrc-brain/              # WittSrc Brain 技能包（8 个 SKILL.md）
  SKILL.md, RESOLVER.md
  ingest/, link/, query/, graph/, timeline/, enrich/, maintain/, soul-audit/

scripts/
  wittsrc-auto-link.ts             # 零 LLM 实体链接抽取
  wittsrc-brain-import.ts          # 语料 → Brain Pages 转换
  wittsrc-graph-query.ts           # 图遍历查询
  wittsrc-query.ts                 # 混合搜索
  wittsrc-maintain.ts              # 脑健康检查
  wittsrc-timeline.ts              # 时间线提取
  wittsrc-soul-audit.ts            # 身份配置生成
  wittsrc-minions.ts               # Minions 定时任务
  types/wittsrc-types.ts           # 共享 TypeScript 类型

corpus/wittgenstain/brain/         # Brain Pages 输出目录
  works/, concepts/, people/, timelines/, .links/, identity/
```

### 快速开始

```bash
# 1. 导入语料
bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstain/texts/

# 2. 抽取链接
bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstain/brain/

# 3. 生成身份配置
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein

# 4. 查询
bun run scripts/wittsrc-query.ts "private language argument"

# 5. 图查询
bun run scripts/wittsrc-graph-query.ts work-tractatus --type evolves_to --depth 2

# 6. 健康检查
bun run scripts/wittsrc-maintain.ts --check
```

---

## 七、总结：优化预期

| 维度 | 优化前 | 优化后 | 提升幅度 |
|------|-------|-------|---------|
| 人工耗时/人 | 7-14天 | 3-5天 | **-50%** |
| 研究周期 | 3-5天 | 1-2天 | **-60%** |
| 质量一致性 | 依赖个人水平 | 标准化流程 | **可复制** |
| 迭代速度 | 被动、低频 | 主动、持续（Minions） | **10x** |
| 可验证性 | 主观评价 | 量化指标 | **可测量** |
| 知识持久化 | 无 | Persona Brain + 知识图谱 | **新增** |
| 盲测自动化 | 人工出题 | 混合搜索半自动比对 | **部分自动化** |

**核心价值**: 从「依赖专家经验和个人水平」到「标准化流程 + 量化指标 + 持续迭代 + Persona Brain 记忆」的完整蒸馏体系。

**gbrain 集成核心价值**: 每个蒸馏出的 Persona 拥有自己的专业 Brain，零 LLM 成本维护知识图谱，每日自动同步语料，自我修复孤立页和死链接，让蒸馏 Persona 真正具备"持续学习"能力。
