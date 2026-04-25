/**
 * Zero 蒸馏引擎 — 核心类型定义
 * 独立于 v4-types，重新设计干净的类型体系
 */

import { z } from 'zod';

// =============================================================================
// Enums / Unions
// =============================================================================

export type DistillationRoute = 'uni' | 'bi' | 'multi' | 'period';

export type SupportedLanguage =
  | 'zh'
  | 'en'
  | 'de'
  | 'ja'
  | 'fr'
  | 'la'
  | 'el'
  | 'ko'
  | 'mixed';

export type OutputLanguage = 'zh-CN' | 'en-US' | 'bilingual';

export type PersonaDomain =
  | 'philosophy'
  | 'business'
  | 'science'
  | 'technology'
  | 'spirituality'
  | 'history'
  | 'creativity'
  | 'medicine'
  | 'economics'
  | 'psychology';

export type SourceType =
  | 'classical_text'
  | 'primary'
  | 'secondary'
  | 'book'
  | 'essay'
  | 'interview'
  | 'lecture'
  | 'tweet'
  | 'blog'
  | 'forum'
  | 'podcast'
  | 'video_transcript'
  | 'academic_paper'
  | 'archive'
  | 'social_media';

export type ToneType = 'formal' | 'casual' | 'passionate' | 'detached' | 'humorous' | 'therapeutic';

export type CertaintyLevel = 'high' | 'medium' | 'low';

export type DistillationGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type PipelinePhase =
  | 'init'
  | 'load'
  | 'preprocess'
  | 'analyze'
  | 'route'
  | 'extract'
  | 'fusion'
  | 'evaluate'
  | 'prompt'
  | 'finalize'
  | 'done'
  | 'error';

export type DistillationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// =============================================================================
// Corpus Types
// =============================================================================

export interface CorpusFile {
  id: string;
  filename: string;
  filepath: string;
  language: SupportedLanguage;
  sourceType: SourceType;
  sizeBytes: number;
  wordCount: number;
  rawText: string;
  cleanedText: string;
  chunks: TextChunk[];
  detectedAt: Date;
}

export interface TextChunk {
  id: string;
  text: string;
  wordCount: number;
  startOffset: number;
  endOffset: number;
  language: SupportedLanguage;
  isComplete: boolean; // 是否是完整段落
}

export interface CorpusReport {
  personaId: string;
  totalFiles: number;
  totalWordCount: number;
  totalCharCount: number;
  uniqueWordCount: number;
  uniqueWordRatio: number;
  avgSentenceLength: number;
  signalStrength: number; // 0-100
  languageDistribution: Record<SupportedLanguage, number>;
  languageDistributionRatio: Record<SupportedLanguage, number>;
  sourceTypeDistribution: Record<SourceType, number>;
  sourceTypeRatio: Record<SourceType, number>;
  fileHealth: FileHealthSummary[];
  warnings: CorpusWarning[];
  periodPartitions?: PeriodPartition[];
  qualityScore: number; // 0-100 综合质量分
  sample: string; // 用于 LLM 提取的样本文本
}

export interface FileHealthSummary {
  filename: string;
  wordCount: number;
  language: SupportedLanguage;
  quality: 'excellent' | 'good' | 'poor' | 'corrupt';
  issues: string[];
}

export interface CorpusWarning {
  code: CorpusWarningCode;
  message: string;
  affectedFiles?: string[];
  severity: 'info' | 'warn' | 'error';
}

export type CorpusWarningCode =
  | 'low_word_count'
  | 'low_diversity'
  | 'single_source_type'
  | 'mixed_language'
  | 'corrupt_file'
  | 'no_files'
  | 'large_file_skipped';

export interface PeriodPartition {
  name: string;
  startYear: number;
  endYear: number;
  language: SupportedLanguage;
  sourceTypes: SourceType[];
  wordCount: number;
  dominantTopics: string[];
  sample: string;
}

// =============================================================================
// Routing Types
// =============================================================================

export interface RouteDecision {
  route: DistillationRoute;
  primaryLanguage: SupportedLanguage;
  secondaryLanguage?: SupportedLanguage;
  tertiaryLanguage?: SupportedLanguage;
  confidence: number; // 0-1
  reasoning: string;
  periodPartitions?: PeriodPartition[];
  recommendedBatchSize: number;
  estimatedIterations: number;
}

// =============================================================================
// Knowledge Extraction Types
// =============================================================================

export interface IdentityLayer {
  identityPrompt: string;
  oneLineSummary: string;
  threeLineBio: string;
  coreClaim: string; // 这个人最核心的主张是什么
  uniquePerspective: string; // 这个人独特在哪
  originStory?: string; // 起源故事（历史人物）
  confidence: number; // 0-1
}

export interface MentalModel {
  id: string;
  name: string;
  nameZh?: string;
  nameEn?: string;
  oneLiner: string;
  description: string;
  application: string;
  crossDomain: string[];
  evidence: MentalModelEvidence[];
  sourceReferences: string[];
  limitations?: string;
  period?: string; // 适用于哪个时期
  confidence: number;
}

export interface MentalModelEvidence {
  quote: string;
  source: string;
  year?: number;
  page?: string;
  context?: string;
}

export interface CoreValue {
  id: string;
  name: string;
  nameZh?: string;
  nameEn?: string;
  description: string;
  priority: number; // 1 = highest
  manifestedIn: string[]; // 在哪些行为/作品中体现
  tension?: string; // 与哪个价值构成张力
  confidence: number;
}

export interface DecisionHeuristic {
  id: string;
  name: string;
  nameZh?: string;
  nameEn?: string;
  description: string;
  applicationScenario: string;
  example?: string;
  sourceReferences: string[];
  confidence: number;
}

export interface HonestBoundary {
  id: string;
  description: string;
  reason: string;
  confidence: number;
}

export interface Tension {
  id: string;
  dimension: string; // e.g. "自由 vs 安全"
  positivePole: string;
  negativePole: string;
  description: string;
  howTheyNavigate: string;
  confidence: number;
}

export interface AntiPattern {
  id: string;
  description: string;
  examples: string[];
  whyTheyAvoid: string;
  confidence: number;
}

export interface Source {
  id: string;
  title: string;
  titleZh?: string;
  type: SourceType;
  year?: number;
  url?: string;
  confidence: number;
}

export interface KnowledgeLayer {
  identity: IdentityLayer;
  mentalModels: MentalModel[];
  values: CoreValue[];
  decisionHeuristics: DecisionHeuristic[];
  tensions: Tension[];
  antiPatterns: AntiPattern[];
  honestBoundaries: HonestBoundary[];
  strengths: string[];
  blindspots: string[];
  sources: Source[];
  // 双语文本
  identityPrompt_Zh?: string;
  mentalModels_Zh?: MentalModel[];
  values_Zh?: CoreValue[];
  decisionHeuristics_Zh?: DecisionHeuristic[];
  tensions_Zh?: Tension[];
  confidence: number; // 整体知识层置信度
  extractionMetadata: ExtractionMetadata;
}

export interface ExtractionMetadata {
  corpusWordCount: number;
  sampleWordCount: number;
  extractionDate: string;
  extractionDurationMs: number;
  llmCalls: number;
  costUSD: number;
  tokensUsed: LLMTokenUsage;
  version: string; // 'zero-v1'
}

// =============================================================================
// Expression DNA Types
// =============================================================================

export interface ExpressionDNA {
  vocabulary: VocabularyFingerprint;
  sentenceStyles: SentenceStyle[];
  forbiddenWords: ForbiddenWord[];
  tone: ToneProfile;
  certaintyProfile: CertaintyProfile;
  rhetoricalHabits: RhetoricalHabit[];
  quotePatterns: QuotePattern[];
  rhythm: RhythmProfile;
  verbalMarkers: VerbalMarker[];
  speakingStyle: SpeakingStyle;
  bilingualAdaptation?: BilingualAdaptation;
}

export interface VocabularyFingerprint {
  topWords: WordEntry[];
  bigrams: NgramEntry[];
  trigrams: NgramEntry[];
  signaturePhrases: SignaturePhrase[];
  domainTerms: string[];
  confidence: number;
}

export interface WordEntry {
  word: string;
  frequency: number;
  normalizedFreq: number; // 0-1
  isDomainSpecific: boolean;
  isSignature: boolean;
}

export interface NgramEntry {
  ngram: string;
  frequency: number;
  normalizedFreq: number;
  isSignature: boolean;
}

export interface SignaturePhrase {
  phrase: string;
  frequency: number;
  context: string; // 在什么上下文中出现
}

export interface ForbiddenWord {
  word: string;
  reason: string;
  evidence?: string; // 语料中出现但被此人避免的例子
}

export interface SentenceStyle {
  pattern: string;
  description: string;
  frequency: number;
  examples: string[];
  confidence: number;
}

export interface ToneProfile {
  dominant: ToneType;
  secondary?: ToneType;
  shifts: number; // 语调变化次数
  description: string;
  markers: string[]; // 语调标记词
}

export interface CertaintyProfile {
  level: CertaintyLevel;
  highCertaintyMarkers: string[];
  lowCertaintyMarkers: string[];
  neutralMarkers: string[];
  description: string;
}

export interface RhetoricalHabit {
  habit: string;
  description: string;
  frequency: number;
  examples: string[];
  confidence: number;
}

export interface QuotePattern {
  pattern: string; // e.g. "引用经典", "引用数据", "引用个人经历"
  description: string;
  frequency: number;
  examples: string[];
  quotedAuthors?: string[];
}

export interface RhythmProfile {
  avgSentenceLength: number;
  avgParagraphLength: number;
  shortSentenceRatio: number;
  longSentenceRatio: number;
  punctuationDensity: PunctuationDensity;
  description: string;
}

export interface PunctuationDensity {
  questionMarks: number;
  exclamationMarks: number;
  semicolons: number;
  colons: number;
  quotes: number;
}

export interface VerbalMarker {
  marker: string;
  type: 'catchphrase' | 'filler' | 'transition' | 'emphasis';
  frequency: number;
  context: string;
}

export interface SpeakingStyle {
  summary: string;
  verboseLevel: 'terse' | 'moderate' | 'verbose';
  explanationDepth: 'shallow' | 'medium' | 'deep';
  abstractionLevel: 'concrete' | 'mixed' | 'abstract';
  emotionalRange: 'cold' | 'moderate' | 'warm';
  humorFrequency: 'rare' | 'occasional' | 'frequent';
  metaphorUsage: 'rare' | 'occasional' | 'frequent';
  analogyUsage: 'rare' | 'occasional' | 'frequent';
}

export interface BilingualAdaptation {
  zhAdaptations: string[];
  enAdaptations: string[];
  mixedLanguagePatterns: string[];
}

// =============================================================================
// Fusion Types
// =============================================================================

export interface SemanticAlignment {
  sourceItem: string;
  targetItem: string;
  similarity: number; // 0-1 cosine similarity
  sourceEmbedding?: number[];
  targetEmbedding?: number[];
  matched: boolean;
}

export interface ConceptAlignment {
  sourceConcept: string;
  targetConcept: string;
  alignment: SemanticAlignment;
  translation?: string;
  confidence: number;
}

export interface ConceptConflict {
  id: string;
  primary: string;
  secondary: string;
  dimension: string;
  description: string;
  resolution?: string;
  resolutionStrategy?: ConflictResolutionStrategy;
}

export type ConflictResolutionStrategy =
  | 'prefer_primary'
  | 'prefer_secondary'
  | 'prefer_recent'
  | 'prefer_authoritative_source'
  | 'synthesize'
  | 'mark_unresolved';

export interface FusionResult {
  fusedKnowledge: KnowledgeLayer;
  fusedExpression: ExpressionDNA;
  alignments: ConceptAlignment[];
  conflicts: ConceptConflict[];
  fusionMetadata: FusionMetadata;
}

export interface FusionMetadata {
  primaryLanguage: SupportedLanguage;
  secondaryLanguage?: SupportedLanguage;
  alignmentCount: number;
  conflictCount: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  fusionDurationMs: number;
}

// =============================================================================
// Evaluation Types
// =============================================================================

export interface ScoreBreakdown {
  voice: VoiceScore;
  knowledge: KnowledgeScore;
  reasoning: ReasoningScore;
  safety: SafetyScore;
}

export interface VoiceScore {
  overall: number; // 0-100
  vocabularyMatch: number;
  sentencePatternMatch: number;
  toneMatch: number;
  forbiddenWordCompliance: number;
  rhetoricalHabitMatch: number;
}

export interface KnowledgeScore {
  overall: number;
  mentalModelCount: number;
  mentalModelDepth: number;
  heuristicCoverage: number;
  sourceCoverage: number;
  crossDomainLinks: number;
}

export interface ReasoningScore {
  overall: number;
  valueConsistency: number;
  tensionRecognition: number;
  antiPatternAvoidance: number;
  decisionCoherence: number;
}

export interface SafetyScore {
  overall: number;
  bannedPersonaCheck: boolean;
  sensitiveContentRatio: number;
  politicalNeutrality: number;
  factualBoundaryRespect: number;
}

export interface DistillationFinding {
  code: string;
  dimension: 'voice' | 'knowledge' | 'reasoning' | 'safety';
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  affectedField?: string;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface GateResult {
  gate: string;
  passed: boolean;
  score: number;
  threshold: number;
  findings: DistillationFinding[];
  details: Record<string, unknown>;
  durationMs: number;
}

// =============================================================================
// Prompt Types
// =============================================================================

export type PromptVariant = 'default' | 'debate' | 'deep-thought' | 'casual';

export interface PromptConfig {
  variant: PromptVariant;
  includeIdentity: boolean;
  includeKnowledge: boolean;
  includeExpression: boolean;
  includeRules: boolean;
  maxLength?: number;
  language: OutputLanguage;
}

// =============================================================================
// Pipeline Types
// =============================================================================

export interface DistillationOptions {
  personaId: string;
  corpusDir: string;
  route?: 'auto' | DistillationRoute;
  outputLang?: OutputLanguage;
  budget?: number; // 最大 USD 成本
  maxIterations?: number;
  promptVariant?: PromptVariant;
  parallel?: number; // 并行提取数量
  onProgress?: (event: PipelineEvent) => void;
  signal?: AbortSignal; // 用于取消
}

export interface PipelineEvent {
  id: string;
  phase: PipelinePhase;
  step: string;
  message: string;
  progress: number; // 0-100
  timestamp: string;
  personaId?: string;
  cost?: number;
  tokensUsed?: number;
  durationMs?: number;
  error?: string;
  detail?: Record<string, unknown>;
}

export interface IterationRecord {
  iteration: number;
  route: DistillationRoute;
  knowledge?: KnowledgeLayer;
  expression?: ExpressionDNA;
  fused?: FusionResult;
  gates: GateResult[];
  score?: ScoreBreakdown;
  grade?: DistillationGrade;
  cost: number;
  tokensUsed: LLMTokenUsage;
  durationMs: number;
  status: 'success' | 'degraded' | 'failed';
  failureReason?: string;
}

// =============================================================================
// Output Types
// =============================================================================

export interface DistilledPersonaZero {
  // Meta
  meta: PersonaMeta;
  // Knowledge
  knowledge: KnowledgeLayer;
  // Expression
  expression: ExpressionDNA;
  // System Prompt
  systemPrompt: SystemPromptBlock[];
  // Evaluation
  score: ScoreBreakdown;
  grade: DistillationGrade;
  findings: DistillationFinding[];
  gates: GateResult[];
  // Pipeline info
  iterations: IterationRecord[];
  totalCost: number;
  totalTokensUsed: LLMTokenUsage;
  totalDurationMs: number;
  distillationVersion: string;
  distillationDate: string;
  // Corpus info
  corpusReport: CorpusReport;
  routeDecision: RouteDecision;
}

export interface PersonaMeta {
  id: string;
  name: string;
  nameZh?: string;
  nameEn?: string;
  slug: string;
  tagline?: string;
  taglineZh?: string;
  domain: PersonaDomain[];
  avatar?: string;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  brief?: string;
  briefZh?: string;
  // 从 personas.ts 继承的字段（蒸馏后的）
  originalFromPersonas?: boolean;
}

export interface SystemPromptBlock {
  role: 'identity' | 'knowledge' | 'expression' | 'rules' | 'context';
  content: string;
  priority: number; // 组装顺序
}

// =============================================================================
// LLM Types
// =============================================================================

export interface LLMCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  system?: string;
}

export interface LLMResponse {
  content: string;
  raw: unknown; // 原始 API 响应
  usage: LLMTokenUsage;
  model: string;
  finishReason: string;
  durationMs: number;
  costUSD: number;
}

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMSessionStats {
  totalCalls: number;
  totalCost: number;
  totalTokens: LLMTokenUsage;
  byModel: Record<string, ModelStats>;
  callsByPhase: Record<string, number>;
}

export interface ModelStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface PromptTokens {
  input: number;
  output: number;
  total: number;
}

// =============================================================================
// Re-exports of Zod schemas (for runtime validation)
// =============================================================================

export {
  KnowledgeLayerSchema,
  ExpressionDNASchema,
  MentalModelSchema,
  CoreValueSchema,
  DistilledPersonaZeroSchema,
} from './schema';

// =============================================================================
// Config Types
// =============================================================================

export interface ZeroConfig {
  // LLM 配置
  llm: {
    primaryModel: string;
    embeddingModel: string;
    maxTokensPerCall: number;
    defaultTemperature: number;
    maxBudget?: number;
  };
  // 路径配置
  paths: {
    corpusRoot: string;
    outputRoot: string;
    tempDir: string;
  };
  // 路由配置
  routing: {
    periodAwarePersonas: string[]; // 需要时期分割的人物 ID 列表
    languageThreshold: number; // 单语言阈值（默认 0.95）
    bilingualThreshold: number; // 双语言阈值（默认 0.15）
    periodThreshold: number; // 触发 period 路由的最小 word count
  };
  // 提取配置
  extraction: {
    sampleSize: number; // LLM 提取用多少字符
    maxMentalModels: number;
    maxValues: number;
    maxTensions: number;
    maxHeuristics: number;
    minEvidencePerModel: number;
    embeddingThreshold: number; // embedding 相似度阈值（默认 0.75）
  };
  // 质量门控阈值
  gates: {
    corpusMinWordCount: number;
    corpusMinQualityScore: number;
    knowledgeMinMentalModels: number;
    knowledgeMinValues: number;
    knowledgeMinTensions: number;
    expressionMinVocabulary: number;
    expressionMinSentenceStyles: number;
    scoreMinForPass: number;
  };
  // 评分权重
  scoring: {
    voiceWeight: number;
    knowledgeWeight: number;
    reasoningWeight: number;
    safetyWeight: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_ZERO_CONFIG: ZeroConfig = {
  llm: {
    primaryModel: 'deepseek-chat',
    embeddingModel: 'deepseek-embedding',
    maxTokensPerCall: 8000,
    defaultTemperature: 0.3,
    maxBudget: 10, // $10 per persona
  },
  paths: {
    corpusRoot: './corpus',
    outputRoot: './corpus/distilled/zero',
    tempDir: './tmp/zero',
  },
  routing: {
    periodAwarePersonas: [
      'wittgenstein',
      'nietzsche',
      'confucius',
      'zhuang-zi',
      'seneca',
      'plato',
      'aristotle',
      'hui-neng',
      'lao-zi',
      'sun-tzu',
      'epictetus',
      'marcus-aurelius',
      'mengcius',
      'mo-zi',
      'han-fei-zi',
      'cai-cao',
      'liu-bei',
      'zhuge-liang',
      'sun-wukong',
      'tripitaka',
    ],
    languageThreshold: 0.95,
    bilingualThreshold: 0.15,
    periodThreshold: 50000,
  },
  extraction: {
    sampleSize: 50000,
    maxMentalModels: 10,
    maxValues: 8,
    maxTensions: 5,
    maxHeuristics: 6,
    minEvidencePerModel: 1,
    embeddingThreshold: 0.75,
  },
  gates: {
    corpusMinWordCount: 5000,
    corpusMinQualityScore: 40,
    knowledgeMinMentalModels: 3,
    knowledgeMinValues: 2,
    knowledgeMinTensions: 1,
    expressionMinVocabulary: 5,
    expressionMinSentenceStyles: 2,
    scoreMinForPass: 60,
  },
  scoring: {
    voiceWeight: 0.3,
    knowledgeWeight: 0.3,
    reasoningWeight: 0.25,
    safetyWeight: 0.15,
  },
};
