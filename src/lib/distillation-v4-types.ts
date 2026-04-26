/**
 * Prismatic — Distillation Framework v4 Types
 * Universal multi-route Persona distillation with language-aware routing
 */

import type {
  Persona,
  DistillationScore,
  ExpressionDNAProfile,
  Source,
} from './types';

// Re-export so consumers can import from distillation-v4-types
export type { DistillationScore };

// ─── Route Types ────────────────────────────────────────────────────────────────

export type DistillationRoute = 'uni' | 'bi' | 'multi' | 'period';

export type SupportedLanguage =
  | 'en'   // English
  | 'de'   // German
  | 'zh'   // Chinese (Simplified/Traditional)
  | 'ja'   // Japanese
  | 'fr'   // French
  | 'la'   // Latin
  | 'el'   // Greek
  | 'mixed';

export type OutputLanguage = 'zh-CN' | 'en-US';

// ─── Period Partitioning ─────────────────────────────────────────────────────────

export interface Period {
  id: string;
  label: string;
  labelZh: string;
  startYear: number;
  endYear: number;
  description: string;
  descriptionZh: string;
  language: SupportedLanguage;
  dominantSourceTypes: Source['type'][];
}

// ─── Layer 1: Corpus Intelligence ──────────────────────────────────────────────

export interface LanguageDistribution {
  language: SupportedLanguage;
  charCount: number;
  wordCount: number;
  ratio: number;       // 0-1
  files: string[];
}

export interface SourceTypeDistribution {
  type: Source['type'];
  count: number;
  wordCount: number;
  ratio: number;
  files: string[];
}

export interface CorpusHealthReport {
  totalWords: number;
  totalChars: number;
  totalFiles: number;
  uniqueWordRatio: number;    // 词汇多样性
  avgSentenceLength: number;
  languageDistribution: LanguageDistribution[];
  sourceTypeDistribution: SourceTypeDistribution[];
  periods?: Period[];
  signalStrength: 'strong' | 'medium' | 'weak';
  wordCountThreshold: {
    en: number;
    zh: number;
    de: number;
  };
  warnings: string[];
  passes: boolean;
}

// ─── Layer 2: Route Decision ───────────────────────────────────────────────────

export interface RouteDecision {
  route: DistillationRoute;
  primaryLanguage: SupportedLanguage;
  secondaryLanguages: SupportedLanguage[];
  outputLanguage: OutputLanguage;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  priorityRules: string[];    // Why this route was chosen
  periodAware: boolean;
  periodPartitions?: Period[];
}

// ─── Layer 3: Knowledge Extraction ─────────────────────────────────────────────

export interface TrilingualConcept {
  original: string;          // 原文
  english: string;            // 英译
  chinese: string;           // 中译
  sourceText?: string;       // 出处
}

export interface ExtractedMentalModel {
  id: string;
  name: string;
  nameZh: string;
  oneLiner: string;
  oneLinerZh: string;
  evidence: Array<{
    quote: string;
    quoteZh?: string;
    source: string;
    year?: number;
  }>;
  crossDomain: string[];
  application: string;
  applicationZh: string;
  limitation: string;
  limitationZh: string;
  keyConcepts: TrilingualConcept[];
}

export interface ExtractedDecisionHeuristic {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  application: string;
  applicationZh: string;
  example?: string;
  exampleZh?: string;
}

export interface ExtractedValue {
  name: string;
  nameZh: string;
  priority: number;
  description: string;
  descriptionZh: string;
}

export interface ExtractedTension {
  dimension: string;
  dimensionZh: string;
  tension: string;
  tensionZh: string;
  description: string;
  descriptionZh: string;
  positivePole: string;
  negativePole: string;
}

export interface ExtractedHonestBoundary {
  text: string;
  textZh: string;
  reason: string;
  reasonZh: string;
}

export interface KnowledgeLayer {
  identityPrompt: string;
  identityPromptZh: string;
  mentalModels: ExtractedMentalModel[];
  decisionHeuristics: ExtractedDecisionHeuristic[];
  values: ExtractedValue[];
  tensions: ExtractedTension[];
  antiPatterns: string[];
  antiPatternsZh: string[];
  honestBoundaries: ExtractedHonestBoundary[];
  strengths: string[];
  strengthsZh: string[];
  blindspots: string[];
  blindspotsZh: string[];
  sources: Source[];
  keyConcepts: TrilingualConcept[];
  confidence: 'high' | 'medium' | 'low';
  confidenceNotes: string[];
}

// ─── Layer 4: Expression Extraction ─────────────────────────────────────────────

export interface ExpressionLayer {
  // From target output language
  vocabulary: string[];       // 特征词汇 Top-20
  sentenceStyle: string[];    // 标志性句式
  forbiddenWords: string[];   // 禁用词

  // From source language (cross-language transfer)
  tone: 'formal' | 'casual' | 'passionate' | 'detached' | 'humorous' | 'therapeutic';
  certaintyLevel: 'high' | 'medium' | 'low';
  rhetoricalHabit: string;
  quotePatterns: string[];
  rhythm: string;
  rhythmDescription: string;

  // Adaptation guidance
  chineseAdaptation: string;   // How to preserve flavor in Chinese output
  verbalMarkers: string[];     // 口头禅/标志性用词
  speakingStyle: string;       // 说话风格描述

  // Source language expression (for cross-validation)
  sourceVocabulary?: string[];
  sourceSentenceStyle?: string[];
  sourceTone?: string;
  sourceRhythm?: string;

  confidence: 'high' | 'medium' | 'low';
  confidenceNotes: string[];
}

// ─── Layer 5: Cross-Validation & Fusion ───────────────────────────────────────

export interface ConceptFusion {
  concept: TrilingualConcept;
  sourceLanguages: SupportedLanguage[];
  consistencyScore: number;    // 0-1 across languages
  fusionMethod: 'intersection' | 'primary_language' | 'llm_arbitration';
  resolvedText: string;
  resolvedTextZh: string;
}

export interface ConceptConflict {
  conceptId: string;
  languageA: SupportedLanguage;
  languageB: SupportedLanguage;
  versionA: string;
  versionB: string;
  conflictType: 'terminology' | 'emphasis' | 'contradiction' | 'unrelated';
  resolution: string;
  resolvedBy: 'primary_language' | 'self_translation' | 'authoritative_translation' | 'llm_arbitration';
}

export interface ValidationReport {
  crossLanguageConsistency: number;   // 0-100
  conceptFusions: ConceptFusion[];
  conflicts: ConceptConflict[];
  expressionConsistency: number;
  knowledgeCoverage: number;
  overallConfidence: 'high' | 'medium' | 'low';
  validationNotes: string[];
}

// ─── Layer 6: Quality Gates ─────────────────────────────────────────────────────

export type GateResult = 'pass' | 'fail' | 'warning' | 'skip';

export interface Gate1CorpusResult {
  result: GateResult;
  wordCount: number;
  language: SupportedLanguage;
  uniqueWordRatio: number;
  sourceDiversity: number;
  signalStrength: 'strong' | 'medium' | 'weak';
  issues: string[];
  suggestions: string[];
}

export interface Gate2DistillationResult {
  result: GateResult;
  knowledgeLayerScore: number;
  expressionLayerScore: number;
  mentalModelCount: number;
  valueCount: number;
  tensionCount: number;
  vocabularyCount: number;
  sentenceStyleCount: number;
  forbiddenWordCount: number;
  issues: string[];
  suggestions: string[];
  autoFixableFindings: string[];
}

export interface Gate3ScoringResult {
  result: GateResult;
  score: DistillationScore;
  adaptiveThreshold: number;
  dimensionBreakdown: {
    voiceFidelity: { score: number; weight: number; adjusted: number };
    knowledgeDepth: { score: number; weight: number; adjusted: number };
    reasoningPattern: { score: number; weight: number; adjusted: number };
    safetyCompliance: { score: number; weight: number; adjusted: number };
  };
  issues: string[];
  suggestions: string[];
}

// ─── Gate 4: Semantic Validation ─────────────────────────────────────────────

export interface SemanticCheckResult {
  check: string;
  passed: boolean;
  score: number;
  issuesFound: number;
}

export interface Gate4SemanticResult {
  result: GateResult;
  evidenceRelevanceScore: number;
  expressionKnowledgeScore: number;
  crossLayerScore: number;
  bilingualScore: number;
  overallSemanticScore: number;
  issues: string[];
  suggestions: string[];
  autoFixableFindings: string[];
}

export interface IterationRecord {
  iteration: number;
  gates: {
    gate1?: Gate1CorpusResult;
    gate2?: Gate2DistillationResult;
    gate3?: Gate3ScoringResult;
    gate4?: Gate4SemanticResult;
  };
  diagnosis: string;
  fixActions: string[];
  timestamp: string;
  cost: number;
  tokensUsed: number;
}

// ─── Complete v4 Distilled Persona ──────────────────────────────────────────────

export interface DistilledPersonaMeta {
  personaId: string;
  distillationVersion: 'v4';
  languages: SupportedLanguage[];
  primaryLanguage: SupportedLanguage;
  secondaryLanguages: SupportedLanguage[];
  outputLanguage: OutputLanguage;
  route: DistillationRoute;
  corpusStats: {
    files: number;
    words: number;
    density: number;
    sources: number;
  };
  createdAt: string;
  lastUpdated: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceNotes: string[];
  iterationCount: number;
  totalCost: number;
  totalTokensUsed: number;
}

export interface DistilledPersonaV4 {
  // Meta
  meta: DistilledPersonaMeta;

  // Knowledge layer (from source language distillation)
  knowledge: KnowledgeLayer;

  // Expression layer (from target language extraction)
  expression: ExpressionLayer;

  // Cross-validation
  validation: ValidationReport;

  // Scoring
  score: DistillationScore;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Iteration history
  iterationHistory: IterationRecord[];

  // Periods (for period-aware route)
  periods?: Period[];

  // Legacy Persona (for backward compatibility)
  persona: Persona;
}

// ─── Pipeline Events ────────────────────────────────────────────────────────────

export type V4PipelineStage =
  | 'intelligence'
  | 'routing'
  | 'knowledge'
  | 'expression'
  | 'validation'
  | 'gate1'
  | 'gate2'
  | 'gate3'
  | 'iteration'
  | 'finalize';

export interface V4PipelineProgress {
  stage: V4PipelineStage;
  stageProgress: number;    // 0-100
  currentAction: string;
  elapsedMs: number;
  estimatedRemainingMs?: number;
  cost: number;
  tokensUsed: number;
}

// ─── LLM Extraction Prompts ────────────────────────────────────────────────────

export interface ExtractionPromptContext {
  personaId: string;
  route: DistillationRoute;
  primaryLanguage: SupportedLanguage;
  outputLanguage: OutputLanguage;
  corpusSample: string;
  corpusSampleZh?: string;     // Translation for reference
  keyConcepts?: TrilingualConcept[];
  sourceContext?: string;      // WittSrc Brain-style context
  periodContext?: Period;
  confidenceLevel: 'strict' | 'balanced' | 'lenient';
}

export interface ExtractionResult<T> {
  data: T;
  confidence: number;
  autoFixable: boolean;
  warnings: string[];
  llmModel: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// ─── Period Detection Patterns ─────────────────────────────────────────────────

export interface PeriodPattern {
  name: string;
  startYear: number;
  endYear: number;
  languageShift?: SupportedLanguage;
  keyIndicators: string[];
  personaIds: string[];    // Which personas this pattern applies to
}

// ─── Conflict Resolution Strategies ─────────────────────────────────────────────

export type ConflictResolutionStrategy =
  | 'primary_language'          // Prefer primary/original language version
  | 'self_translation'         // Prefer self-translated content (e.g., Wittgensteins Tractatus)
  | 'authoritative_translation' // Prefer established scholarly translations
  | 'oral_over_written'        // Prefer oral/dictated over written
  | 'direct_quote_over_secondary' // Prefer direct quotes over secondary analysis
  | 'llm_arbitration';         // Use LLM to pick best version

// ─── L1: Corpus Metadata (Knowledge Gap Awareness) ─────────────────────────────────

export type KnowledgeGapStrategy =
  | 'extrapolate_identity'     // 用 Identity + Heuristics 推演回答（还在世的人物）
  | 'honest_boundary'          // 直接告知知识边界，不做推演（敏感人物）
  | 'refer_sources'           // 引用已蒸馏的 sources 中相关信息
  | 'hybrid';                 // 先引用已知事实，再做有保留的推演

export interface CorpusMetadata {
  /** 语料截止日期 — YYYY-MM-DD 格式，在此日期之后的事，蒸馏模型无法回答 */
  cutoffDate?: string;
  /** 人物是否还在世 — 决定是否需要知识缺口检测 */
  isAlive?: boolean;
  /** 语料库最新更新时间 */
  corpusLastUpdated?: string;
  /** 语料库覆盖的时间跨度 */
  coverageSpan?: {
    startYear?: number;
    endYear?: number;
  };
  /** 知识缺口处理策略 */
  knowledgeGapStrategy?: KnowledgeGapStrategy;
  /** 敏感话题列表 — 这些话题人物不会讨论 */
  sensitiveTopics?: string[];
  /** 置信度评分 0-1 */
  confidenceScore?: number;
  /** 知识空白信号 — 描述该 persona 哪些领域超出了蒸馏范围 */
  knowledgeGapSignals?: string[];
  /** 推演禁区 — 即使是推演也绝对不能越过的边界 */
  extrapolationBoundaries?: string[];
}

// ─── L2: Knowledge Gap Detection ─────────────────────────────────────────────────

export type GapSeverity = 'none' | 'minor' | 'significant' | 'severe';

export interface KnowledgeGapDetectionResult {
  /** 问题是否可能落在语料库覆盖范围之外 */
  isOutsideCorpus: boolean;
  /** 严重程度 */
  severity: GapSeverity;
  /** 检测到的线索 */
  signals: GapSignal[];
  /** 问题涉及的时间范围（如果可推断） */
  questionTimeRange?: {
    earliestYear?: number;
    latestYear?: number;
    containsFuture: boolean;
    containsPresent: boolean;
  };
  /** 问题是否涉及特定人物、事件或话题 */
  topicHint?: string;
  /** 是否可能涉及敏感话题 */
  isSensitive: boolean;
  /** 检测置信度 */
  confidence: number; // 0-1
}

export interface GapSignal {
  type: 'temporal_marker' | 'recent_event' | 'unknown_entity' | 'ongoing_process' | 'future_prediction' | 'specific_date';
  description: string;
  raw: string;
  confidence: number; // 0-1
}

// ─── L3: Graceful Degradation ────────────────────────────────────────────────────

export type DegradationMode =
  | 'normal'          // 正常蒸馏回答
  | 'extrapolate'    // 用 Identity + Heuristics 推演
  | 'honest_boundary' // 明确告知知识边界
  | 'refer_sources'   // 引用已知 sources
  | 'hybrid';        // 混合模式

export interface GracefulDegradationConfig {
  personaId: string;
  degradationMode: DegradationMode;
  knowledgeLayer: KnowledgeLayer;
  expressionLayer: ExpressionLayer;
  corpusMetadata: CorpusMetadata;
  gapDetection: KnowledgeGapDetectionResult;
}

export interface ExtrapolationResult {
  /** 推演回答 */
  content: string;
  /** 是否为推演（非直接事实） */
  isExtrapolation: boolean;
  /** 推演所基于的核心原则 */
  extrapolatedFrom: string[]; // e.g. ['identity', 'heuristic:决策启发式1', 'value:核心价值观']
  /** 诚实边界声明 */
  honestBoundaryStatement: string;
  /** 置信度 */
  confidence: number; // 0-1
  /** 安全等级 */
  safetyLevel: 'safe' | 'caution' | 'unsafe';
  /** 不适合回答的原因（如果判定 unsafe） */
  unsafeReason?: string;
}

export interface GracefulDegradationResult {
  /** 最终使用的降级模式 */
  mode: DegradationMode;
  /** 是否需要 LLM 调用 */
  needsLLM: boolean;
  /** 正常蒸馏结果（如果有） */
  normalResponse?: string;
  /** 降级推演结果（如果有） */
  extrapolationResult?: ExtrapolationResult;
  /** 诚实边界声明 */
  boundaryStatement?: string;
  /** 元数据注释（用于前端展示） */
  meta: {
    isAlive: boolean;
    corpusCutoffDate?: string;
    isExtrapolation: boolean;
    confidence: number;
  };
}

// ─── Utility Types ─────────────────────────────────────────────────────────────

export interface BilingualExtraction {
  primary: {
    language: SupportedLanguage;
    knowledge: KnowledgeLayer;
    expression: ExpressionLayer;
  };
  secondary: {
    language: SupportedLanguage;
    knowledge: KnowledgeLayer;
    expression: ExpressionLayer;
  };
}

export interface DistillationConfig {
  maxIterations: number;
  adaptiveThreshold: boolean;
  strictMode: boolean;
  outputLanguage: OutputLanguage;
  fallbackToUni: boolean;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  enablePeriodPartitioning: boolean;
  periodThreshold: number;      // Min years between periods to split
  costBudget?: number;
  tokenBudget?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const LANGUAGE_WEIGHT_PRIORITY: Record<SupportedLanguage, number> = {
  en: 1,    // English
  de: 0.9,  // German (Wittgenstein, Nietzsche, Kant)
  zh: 0.95, // Chinese (classical texts)
  la: 0.8,  // Latin (Roman philosophers)
  el: 0.8,  // Greek (Greek philosophers)
  ja: 0.7,
  fr: 0.7,
  mixed: 0.3,
};

export const ROUTE_THRESHOLDS = {
  UNI_LINGUAL: 0.95,    // Single language ratio >= 95%
  BI_LINGUAL: 0.15,     // Second language ratio >= 15%
  MULTI_LINGUAL: 0.10,  // Third+ language ratio >= 10%
} as const;

export const CORPUS_HEALTH_THRESHOLDS = {
  MIN_WORDS_EN: 5000,
  MIN_WORDS_ZH: 3000,
  MIN_WORDS_DE: 5000,
  MIN_UNIQUE_WORD_RATIO: 0.15,
  MIN_SOURCE_TYPES: 2,
} as const;

export const PERSONA_TYPE_WEIGHTS_V4: Record<string, {
  voice: number;
  knowledge: number;
  reasoning: number;
  safety: number;
  threshold: number;
}> = {
  philosopher: {
    voice: 0.25,
    knowledge: 0.20,
    reasoning: 0.40,
    safety: 0.15,
    threshold: 65,
  },
  spiritual: {
    voice: 0.40,
    knowledge: 0.20,
    reasoning: 0.25,
    safety: 0.15,
    threshold: 60,
  },
  business: {
    voice: 0.20,
    knowledge: 0.40,
    reasoning: 0.25,
    safety: 0.15,
    threshold: 55,
  },
  scientist: {
    voice: 0.15,
    knowledge: 0.35,
    reasoning: 0.35,
    safety: 0.15,
    threshold: 65,
  },
  political: {
    voice: 0.20,
    knowledge: 0.20,
    reasoning: 0.20,
    safety: 0.40,
    threshold: 70,
  },
  historical: {
    voice: 0.20,
    knowledge: 0.30,
    reasoning: 0.30,
    safety: 0.20,
    threshold: 55,
  },
  default: {
    voice: 0.30,
    knowledge: 0.30,
    reasoning: 0.25,
    safety: 0.15,
    threshold: 60,
  },
};
