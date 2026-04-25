/**
 * Zero 蒸馏引擎 — Zod Schema 定义（运行时类型校验）
 * 所有 LLM 输出必须通过 schema 校验
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

export const SupportedLanguageSchema = z.enum([
  'zh',
  'en',
  'de',
  'ja',
  'fr',
  'la',
  'el',
  'ko',
  'mixed',
]);

export const OutputLanguageSchema = z.enum(['zh-CN', 'en-US', 'bilingual']);

export const DistillationRouteSchema = z.enum(['uni', 'bi', 'multi', 'period']);

export const ToneTypeSchema = z.enum([
  'formal',
  'casual',
  'passionate',
  'detached',
  'humorous',
  'therapeutic',
]);

export const CertaintyLevelSchema = z.enum(['high', 'medium', 'low']);

export const DistillationGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);

export const SourceTypeSchema = z.enum([
  'classical_text',
  'primary',
  'secondary',
  'book',
  'essay',
  'interview',
  'lecture',
  'tweet',
  'blog',
  'forum',
  'podcast',
  'video_transcript',
  'academic_paper',
  'archive',
  'social_media',
]);

// =============================================================================
// Evidence & Citation Schemas
// =============================================================================

export const MentalModelEvidenceSchema = z.object({
  quote: z.string().min(10, 'Quote must be at least 10 characters'),
  source: z.string().min(1, 'Source is required'),
  year: z.number().int().min(-3000).max(new Date().getFullYear()).optional(),
  page: z.string().optional(),
  context: z.string().optional(),
});

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  titleZh: z.string().optional(),
  type: SourceTypeSchema,
  year: z.number().int().optional(),
  url: z.string().url().optional().or(z.string().max(0)),
  confidence: z.number().min(0).max(1).optional(),
});

// =============================================================================
// Knowledge Layer Schemas
// =============================================================================

export const IdentityLayerSchema = z.object({
  identityPrompt: z.string().min(20, 'Identity prompt too short'),
  oneLineSummary: z.string().min(10),
  threeLineBio: z.string().min(30),
  coreClaim: z.string().min(10),
  uniquePerspective: z.string().min(10),
  originStory: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const MentalModelSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nameZh: z.string().optional(),
  nameEn: z.string().optional(),
  oneLiner: z.string().optional(),
  description: z.string().optional(),
  application: z.string().optional(),
  crossDomain: z.array(z.string()).default([]),
  evidence: z.array(MentalModelEvidenceSchema).default([]),
  sourceReferences: z.array(z.string()).default([]),
  limitations: z.string().optional(),
  period: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const CoreValueSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nameZh: z.string().optional(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
  manifestedIn: z.array(z.string()).default([]),
  tension: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const DecisionHeuristicSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nameZh: z.string().optional(),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  applicationScenario: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
  example: z.string().optional(),
  sourceReferences: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

export const HonestBoundarySchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  reason: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const TensionSchema = z.object({
  id: z.string(),
  dimension: z.string().min(3),
  positivePole: z.string().min(3),
  negativePole: z.string().min(3),
  description: z.string().min(20),
  howTheyNavigate: z.string().min(10),
  confidence: z.number().min(0).max(1),
});

export const AntiPatternSchema = z.object({
  id: z.string(),
  description: z.string().min(10),
  examples: z.array(z.string()),
  whyTheyAvoid: z.string().min(10),
  confidence: z.number().min(0).max(1),
});

export const ExtractionMetadataSchema = z.object({
  corpusWordCount: z.number().int().min(0),
  sampleWordCount: z.number().int().min(0),
  extractionDate: z.string(),
  extractionDurationMs: z.number().int().min(0),
  llmCalls: z.number().int().min(0),
  costUSD: z.number().min(0),
  tokensUsed: z.object({
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
  }),
  version: z.string(),
});

export const KnowledgeLayerSchema = z.object({
  identity: IdentityLayerSchema,
  mentalModels: z.array(MentalModelSchema),
  values: z.array(CoreValueSchema),
  decisionHeuristics: z.array(DecisionHeuristicSchema),
  tensions: z.array(TensionSchema),
  antiPatterns: z.array(AntiPatternSchema),
  honestBoundaries: z.array(HonestBoundarySchema),
  strengths: z.array(z.string()),
  blindspots: z.array(z.string()),
  sources: z.array(SourceSchema),
  identityPrompt_Zh: z.string().optional(),
  mentalModels_Zh: z.array(MentalModelSchema).optional(),
  values_Zh: z.array(CoreValueSchema).optional(),
  decisionHeuristics_Zh: z.array(DecisionHeuristicSchema).optional(),
  tensions_Zh: z.array(TensionSchema).optional(),
  confidence: z.number().min(0).max(1),
  extractionMetadata: ExtractionMetadataSchema,
});

// =============================================================================
// Expression DNA Schemas
// =============================================================================

export const WordEntrySchema = z.object({
  word: z.string().min(1),
  frequency: z.number().int().min(1),
  normalizedFreq: z.number().min(0).max(1),
  isDomainSpecific: z.boolean(),
  isSignature: z.boolean(),
});

export const NgramEntrySchema = z.object({
  ngram: z.string().min(2),
  frequency: z.number().int().min(1),
  normalizedFreq: z.number().min(0).max(1),
  isSignature: z.boolean(),
});

export const SignaturePhraseSchema = z.object({
  phrase: z.string().min(3),
  frequency: z.number().int().min(2),
  context: z.string(),
});

export const ForbiddenWordSchema = z.object({
  word: z.string().min(1),
  reason: z.string().min(5),
  evidence: z.string().optional(),
});

export const VocabularyFingerprintSchema = z.object({
  topWords: z.array(WordEntrySchema),
  bigrams: z.array(NgramEntrySchema),
  trigrams: z.array(NgramEntrySchema),
  signaturePhrases: z.array(SignaturePhraseSchema),
  domainTerms: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const SentenceStyleSchema = z.object({
  pattern: z.string().min(3),
  description: z.string().min(10),
  frequency: z.number().int().min(1),
  examples: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const ToneProfileSchema = z.object({
  dominant: ToneTypeSchema,
  secondary: ToneTypeSchema.optional(),
  shifts: z.number().int().min(0),
  description: z.string().min(10),
  markers: z.array(z.string()),
});

export const CertaintyProfileSchema = z.object({
  level: CertaintyLevelSchema,
  highCertaintyMarkers: z.array(z.string()),
  lowCertaintyMarkers: z.array(z.string()),
  neutralMarkers: z.array(z.string()),
  description: z.string().min(10),
});

export const RhetoricalHabitSchema = z.object({
  habit: z.string().min(3),
  description: z.string().min(10),
  frequency: z.number().int().min(1),
  examples: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const QuotePatternSchema = z.object({
  pattern: z.string().min(3),
  description: z.string().min(10),
  frequency: z.number().int().min(1),
  examples: z.array(z.string()),
  quotedAuthors: z.array(z.string()).optional(),
});

export const PunctuationDensitySchema = z.object({
  questionMarks: z.number().int().min(0),
  exclamationMarks: z.number().int().min(0),
  semicolons: z.number().int().min(0),
  colons: z.number().int().min(0),
  quotes: z.number().int().min(0),
});

export const RhythmProfileSchema = z.object({
  avgSentenceLength: z.number().min(1),
  avgParagraphLength: z.number().min(1),
  shortSentenceRatio: z.number().min(0).max(1),
  longSentenceRatio: z.number().min(0).max(1),
  punctuationDensity: PunctuationDensitySchema,
  description: z.string().min(10),
});

export const VerbalMarkerSchema = z.object({
  marker: z.string().min(1),
  type: z.enum(['catchphrase', 'filler', 'transition', 'emphasis']),
  frequency: z.number().int().min(1),
  context: z.string(),
});

export const SpeakingStyleSchema = z.object({
  summary: z.string().min(20),
  verboseLevel: z.enum(['terse', 'moderate', 'verbose']),
  explanationDepth: z.enum(['shallow', 'medium', 'deep']),
  abstractionLevel: z.enum(['concrete', 'mixed', 'abstract']),
  emotionalRange: z.enum(['cold', 'moderate', 'warm']),
  humorFrequency: z.enum(['rare', 'occasional', 'frequent']),
  metaphorUsage: z.enum(['rare', 'occasional', 'frequent']),
  analogyUsage: z.enum(['rare', 'occasional', 'frequent']),
});

export const BilingualAdaptationSchema = z.object({
  zhAdaptations: z.array(z.string()),
  enAdaptations: z.array(z.string()),
  mixedLanguagePatterns: z.array(z.string()),
});

export const ExpressionDNASchema = z.object({
  vocabulary: VocabularyFingerprintSchema,
  sentenceStyles: z.array(SentenceStyleSchema),
  forbiddenWords: z.array(ForbiddenWordSchema),
  tone: ToneProfileSchema,
  certaintyProfile: CertaintyProfileSchema,
  rhetoricalHabits: z.array(RhetoricalHabitSchema),
  quotePatterns: z.array(QuotePatternSchema),
  rhythm: RhythmProfileSchema,
  verbalMarkers: z.array(VerbalMarkerSchema),
  speakingStyle: SpeakingStyleSchema,
  bilingualAdaptation: BilingualAdaptationSchema.optional(),
});

// =============================================================================
// Score Schemas
// =============================================================================

export const VoiceScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  vocabularyMatch: z.number().min(0).max(100),
  sentencePatternMatch: z.number().min(0).max(100),
  toneMatch: z.number().min(0).max(100),
  forbiddenWordCompliance: z.number().min(0).max(100),
  rhetoricalHabitMatch: z.number().min(0).max(100),
});

export const KnowledgeScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  mentalModelCount: z.number().min(0).max(100),
  mentalModelDepth: z.number().min(0).max(100),
  heuristicCoverage: z.number().min(0).max(100),
  sourceCoverage: z.number().min(0).max(100),
  crossDomainLinks: z.number().min(0).max(100),
});

export const ReasoningScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  valueConsistency: z.number().min(0).max(100),
  tensionRecognition: z.number().min(0).max(100),
  antiPatternAvoidance: z.number().min(0).max(100),
  decisionCoherence: z.number().min(0).max(100),
});

export const SafetyScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  bannedPersonaCheck: z.boolean(),
  sensitiveContentRatio: z.number().min(0).max(1),
  politicalNeutrality: z.number().min(0).max(100),
  factualBoundaryRespect: z.number().min(0).max(100),
});

export const ScoreBreakdownSchema = z.object({
  voice: VoiceScoreSchema,
  knowledge: KnowledgeScoreSchema,
  reasoning: ReasoningScoreSchema,
  safety: SafetyScoreSchema,
});

export const DistillationFindingSchema = z.object({
  code: z.string(),
  dimension: z.enum(['voice', 'knowledge', 'reasoning', 'safety']),
  severity: z.enum(['info', 'warn', 'error', 'critical']),
  message: z.string(),
  affectedField: z.string().optional(),
  suggestedFix: z.string().optional(),
  autoFixable: z.boolean(),
});

export const GateResultSchema = z.object({
  gate: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  findings: z.array(DistillationFindingSchema),
  details: z.record(z.unknown()),
  durationMs: z.number().int().min(0),
});

// =============================================================================
// LLM Session Schema
// =============================================================================

export const LLMTokenUsageSchema = z.object({
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});

export const LLMResponseSchema = z.object({
  content: z.string(),
  raw: z.unknown(),
  usage: LLMTokenUsageSchema,
  model: z.string(),
  finishReason: z.string(),
  durationMs: z.number().int().min(0),
  costUSD: z.number().min(0),
});

// =============================================================================
// Iteration & Final Output Schemas
// =============================================================================

export const IterationRecordSchema = z.object({
  iteration: z.number().int().min(1),
  route: DistillationRouteSchema,
  knowledge: KnowledgeLayerSchema.optional(),
  expression: ExpressionDNASchema.optional(),
  gates: z.array(GateResultSchema),
  score: ScoreBreakdownSchema.optional(),
  grade: DistillationGradeSchema.optional(),
  cost: z.number().min(0),
  tokensUsed: LLMTokenUsageSchema,
  durationMs: z.number().int().min(0),
  status: z.enum(['success', 'degraded', 'failed']),
  failureReason: z.string().optional(),
});

export const SystemPromptBlockSchema = z.object({
  role: z.enum(['identity', 'knowledge', 'expression', 'rules', 'context']),
  content: z.string().min(1),
  priority: z.number().int().min(0),
});

export const PersonaMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameZh: z.string().optional(),
  nameEn: z.string().optional(),
  slug: z.string(),
  tagline: z.string().optional(),
  taglineZh: z.string().optional(),
  domain: z.array(z.string()),
  avatar: z.string().optional(),
  accentColor: z.string().optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  brief: z.string().optional(),
  briefZh: z.string().optional(),
  originalFromPersonas: z.boolean().optional(),
});

export const CorpusReportSchema = z.object({
  personaId: z.string(),
  totalFiles: z.number().int().min(0),
  totalWordCount: z.number().int().min(0),
  totalCharCount: z.number().int().min(0),
  uniqueWordCount: z.number().int().min(0),
  uniqueWordRatio: z.number().min(0).max(1),
  avgSentenceLength: z.number().min(0),
  signalStrength: z.number().min(0).max(100),
  languageDistribution: z.record(z.string(), z.number()),
  languageDistributionRatio: z.record(z.string(), z.number()),
  sourceTypeDistribution: z.record(z.string(), z.number()),
  sourceTypeRatio: z.record(z.string(), z.number()),
  fileHealth: z.array(z.object({
    filename: z.string(),
    wordCount: z.number(),
    language: z.string(),
    quality: z.enum(['excellent', 'good', 'poor', 'corrupt']),
    issues: z.array(z.string()),
  })),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
    affectedFiles: z.array(z.string()).optional(),
    severity: z.enum(['info', 'warn', 'error']),
  })),
  periodPartitions: z.array(z.object({
    name: z.string(),
    startYear: z.number(),
    endYear: z.number(),
    language: z.string(),
    sourceTypes: z.array(z.string()),
    wordCount: z.number(),
    dominantTopics: z.array(z.string()),
    sample: z.string(),
  })).optional(),
  qualityScore: z.number().min(0).max(100),
  sample: z.string(),
});

export const RouteDecisionSchema = z.object({
  route: DistillationRouteSchema,
  primaryLanguage: z.string(),
  secondaryLanguage: z.string().optional(),
  tertiaryLanguage: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  periodPartitions: z.array(z.unknown()).optional(),
  recommendedBatchSize: z.number().int().min(1),
  estimatedIterations: z.number().int().min(1),
});

export const DistilledPersonaZeroSchema = z.object({
  meta: PersonaMetaSchema,
  knowledge: KnowledgeLayerSchema,
  expression: ExpressionDNASchema,
  systemPrompt: z.array(SystemPromptBlockSchema),
  score: ScoreBreakdownSchema,
  grade: DistillationGradeSchema,
  findings: z.array(DistillationFindingSchema),
  gates: z.array(GateResultSchema),
  iterations: z.array(IterationRecordSchema),
  totalCost: z.number().min(0),
  totalTokensUsed: LLMTokenUsageSchema,
  totalDurationMs: z.number().int().min(0),
  distillationVersion: z.string(),
  distillationDate: z.string(),
  corpusReport: CorpusReportSchema,
  routeDecision: RouteDecisionSchema,
});

// =============================================================================
// Helper Functions
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  issues?: string[];
}

/**
 * 验证 LLM JSON 输出，返回校验结果
 */
export function validateLLMOutput<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context?: string
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `[${path}] ${issue.message}` : issue.message;
  });

  const errorMsg = context
    ? `Validation failed for ${context}: ${issues.join('; ')}`
    : `Validation failed: ${issues.join('; ')}`;

  return { success: false, error: errorMsg, issues };
}

/**
 * 验证知识层
 */
export function validateKnowledgeLayer(data: unknown): ValidationResult<z.infer<typeof KnowledgeLayerSchema>> {
  return validateLLMOutput(data, KnowledgeLayerSchema, 'KnowledgeLayer') as ValidationResult<z.infer<typeof KnowledgeLayerSchema>>;
}

/**
 * 验证表达层
 */
export function validateExpressionDNA(data: unknown): ValidationResult<z.infer<typeof ExpressionDNASchema>> {
  return validateLLMOutput(data, ExpressionDNASchema, 'ExpressionDNA');
}

/**
 * 验证完整蒸馏结果
 */
export function validateDistilledPersona(data: unknown): ValidationResult<z.infer<typeof DistilledPersonaZeroSchema>> {
  return validateLLMOutput(data, DistilledPersonaZeroSchema, 'DistilledPersonaZero') as ValidationResult<z.infer<typeof DistilledPersonaZeroSchema>>;
}

/**
 * 提取并验证数组中的每个元素
 */
export function validateArray<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context?: string
): { valid: T[]; invalid: { index: number; error: string }[] } {
  if (!Array.isArray(data)) {
    return { valid: [], invalid: [{ index: -1, error: 'Not an array' }] };
  }

  const valid: T[] = [];
  const invalid: { index: number; error: string }[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = validateLLMOutput(data[i], schema, context ? `${context}[${i}]` : undefined);
    if (result.success && result.data !== undefined) {
      valid.push(result.data);
    } else {
      invalid.push({ index: i, error: result.error ?? 'Unknown error' });
    }
  }

  return { valid, invalid };
}
