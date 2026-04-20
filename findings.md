# Findings: Prismatic 蒸馏方法论优化
<!-- 存放研究发现的外部记忆 -->

## 方法论结构分析

### 6 步法概览

| 步骤 | 名称 | 时长 | 核心交付物 | 自动化潜力 |
|------|------|------|-----------|-----------|
| 1 | 深度研究 | 3-5天/人 | 原始资料清单 + 核心观点提取 | **高** - 网页采集/文本提取可自动化 |
| 2 | 心智模型提取 | 2-3天/人 | 3-8个核心模型（含引用/应用/边界） | **中** - 结构化提取可辅助，人工判断核心性 |
| 3 | 表达DNA建模 | 1-2天/人 | 句式特征/词汇/修辞/情绪温度/确定性水平 | **中** - 统计特征可提取，但主观判断难自动化 |
| 4 | 系统提示词工程 | 1-2天/人 | Identity Prompt + System Prompt + Heuristics + Forbidden Patterns | **高** - 模板化 + LLM 辅助生成 |
| 5 | 盲测评估 | 1-2天 | 10+盲测题 + 识别率 + 质量评分 | **高** - 评估框架可标准化，但人工评审难替代 |
| 6 | 迭代优化 | 持续 | 版本演进 + 反馈收集 | **中** - 反馈收集可自动化，分析需人工 |

### 各步骤详细分析

#### Step 1: 深度研究
- **输入**: 目标人物名称
- **输出**: 资料清单 + 核心观点
- **自动化机会**:
  - 多源内容采集（网页/RSS/YouTube字幕/播客）
  - 文本去重和格式化
  - 高频观点词提取（TF-IDF类分析）
  - 引用来源元数据提取
- **人工介入点**:
  - 资料可靠性判断
  - 区分公开立场与真实想法
  - 标注信息的背景和语境

#### Step 2: 心智模型提取
- **输入**: Step 1 的研究成果
- **输出**: 3-8个结构化心智模型
- **自动化机会**:
  - 从文本中自动识别「观点+来源」对
  - 建立模型间关系图（基于共现分析）
  - 标注模型局限性（边界条件检测）
- **人工介入点**:
  - 判断哪些是核心模型（主观性）
  - 设定模型的跨领域应用场景
  - 平衡正面观点与 blindspots

#### Step 3: 表达DNA建模
- **输入**: 原始演讲/访谈文本
- **输出**: 五维表达特征档案
- **自动化机会**:
  - 句式长度统计（短句vs从句比例）
  - 标志性词汇频率分析
  - 修辞手法识别（反问句/三段式/类比）
  - 确定性词汇使用频率（绝对词 vs 模糊词）
- **人工介入点**:
  - 情绪温度的定性判断
  - 修辞手法的语境解读
  - 表达风格的整体定性

#### Step 4: 系统提示词工程
- **输入**: Steps 2+3 的结构化输出
- **输出**: 完整的 Prompt 体系
- **自动化机会**:
  - Identity Prompt 模板填充
  - System Prompt 结构化生成
  - Decision Heuristics 列表生成
  - Forbidden Patterns 自动检测
  - Honest Boundaries 声明模板
- **人工介入点**:
  - 核心认同的精炼表述（10-20字）
  - 边界条件的具体设定
  - 避免过度神化的价值判断

#### Step 5: 盲测评估
- **输入**: 蒸馏后的 AI
- **输出**: 识别率 + 质量评分 + 边界测试结果
- **自动化机会**:
  - 评估题目生成
  - 对话框架自动化
  - 识别率统计
  - 边界条件覆盖度检查
- **人工介入点**:
  - 评估者的主观质量判断
  - 「感觉不对」的细微差异识别
  - 多轮对话身份一致性判断

#### Step 6: 迭代优化
- **输入**: 用户真实使用反馈
- **输出**: 版本演进记录
- **自动化机会**:
  - 用户反馈收集渠道（内嵌评分/反馈按钮）
  - 高频场景自动统计
  - 「过度夸张」问题检测
  - 版本号自动递增
- **人工介入点**:
  - 「感觉不对」反馈的根因分析
  - 新资料的人工审核与整合
  - 版本变更内容的决策

## 质量标准量化分析

| 标准 | 量化指标 | 测量方法 |
|------|---------|---------|
| 可验证的引用 | 每个观点有来源标注率 | 来源标注覆盖率 = 标注数/总观点数 |
| 诚实的边界 | 边界声明完整率 | 边界声明覆盖的话题类型/总话题类型 |
| 避免过度神化 | blindspot 呈现率 | 含 blindspot 的模型数/总模型数 |
| 透明的研究过程 | 资料可追溯率 | 有来源标注的参考资料数/总参考资料数 |

## 数据结构设计建议

基于 `MENTAL_MODEL_EXAMPLE` 的结构，建议统一的 Persona 数据格式：

```typescript
interface Persona {
  id: string;
  name: string;
  nameZh: string;
  version: string; // e.g. "2.2"
  researchDate: string;
  references: Reference[];

  // Step 2 输出
  mentalModels: MentalModel[];

  // Step 3 输出
  voiceDNA: VoiceDNA;

  // Step 4 输出
  prompt: PromptKit;

  // Step 6 输出
  versionHistory: VersionRecord[];
}

interface MentalModel {
  name: string;
  nameEn: string;
  oneLiner: string;
  evidence: { quote: string; source: string; year?: number }[];
  crossDomain: string[];
  application: string;
  limitation: string;
}

interface VoiceDNA {
  sentencePattern: { type: 'short' | 'long' | 'mixed'; ratio?: number };
  signatureWords: string[];
  signaturePhrases: string[];
  rhetoricalDevices: ('rhetorical-question' | 'tricolon' | 'analogy' | 'dichotomy')[];
  emotionalTemperature: 'passionate' | 'calm' | 'humorous' | 'mixed';
  certaintyLevel: 'high' | 'medium' | 'low';
  tabooWords: string[]; // 从不使用的词
}

interface PromptKit {
  identity: string; // 10-20字
  systemPrompt: string;
  decisionHeuristics: string[];
  forbiddenPatterns: string[];
  honestBoundaries: string[];
}
```

## 关键决策
<!-- 随工作推进更新 -->
