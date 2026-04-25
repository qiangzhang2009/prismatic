/**
 * Zero 蒸馏引擎 — 主入口引擎
 * 整合所有模块：load → analyze → extract → score → prompt
 */

import { join } from 'path';
import {
  DistillationOptions, DistilledPersonaZero, PipelineEvent,
  PersonaMeta, IterationRecord, GateResult, ScoreBreakdown, DistillationGrade,
  SupportedLanguage, RouteDecision, CorpusReport
} from './types';
import { createSession } from './utils/llm';
import { ZeroLogger, createZeroLogger } from './utils/logger';
import { loadCorpus } from './corpus/loader';
import { preprocessCorpus } from './corpus/preprocessor';
import { analyzeCorpus } from './corpus/analyzer';
import { extractKnowledgeLayer } from './extractors/knowledge';
import { extractExpressionDNA } from './extractors/expression';
import { scoreDistillation } from './evaluation/scorer';
import { buildSystemPrompt } from './prompt/builder';
import { PERSONAS } from '../personas';

// =============================================================================
// Gate Definitions
// =============================================================================

interface GateDefinition {
  name: string;
  threshold: number;
  evaluate: (context: GateContext) => { passed: boolean; score: number; findings: string[] };
}

interface GateContext {
  corpusReport: CorpusReport;
  knowledge: Parameters<typeof import('./evaluation/scorer').scoreDistillation>[0];
  expression: Parameters<typeof import('./evaluation/scorer').scoreDistillation>[1];
  score?: ScoreBreakdown;
  grade?: DistillationGrade;
  iteration: number;
}

const GATES: GateDefinition[] = [
  {
    name: 'corpus_health',
    threshold: 40,
    evaluate: (ctx) => {
      const findings: string[] = [];
      if (ctx.corpusReport.totalWordCount < 5000) findings.push(`词数不足: ${ctx.corpusReport.totalWordCount.toLocaleString()} < 5000`);
      if (ctx.corpusReport.qualityScore < 40) findings.push(`语料质量分低: ${ctx.corpusReport.qualityScore}`);
      if (ctx.corpusReport.warnings.some((w) => w.severity === 'error')) findings.push('语料有严重警告');
      return {
        passed: ctx.corpusReport.qualityScore >= 40 && ctx.corpusReport.totalWordCount >= 5000,
        score: ctx.corpusReport.qualityScore,
        findings,
      };
    },
  },
  {
    name: 'distillation_completeness',
    threshold: 50,
    evaluate: (ctx) => {
      const findings: string[] = [];
      const k = ctx.knowledge;

      let score = 100;
      if (k.mentalModels.length < 3) { score -= 20; findings.push(`mentalModels 不足: ${k.mentalModels.length} < 3`); }
      if (k.values.length < 2) { score -= 15; findings.push(`values 不足: ${k.values.length} < 2`); }
      if (k.decisionHeuristics.length < 1) { score -= 10; findings.push(`heuristics 不足`); }
      if (k.sources.length < 1) { score -= 10; findings.push(`sources 为空`); }
      if (k.tensions.length < 1) { score -= 5; findings.push(`tensions 为空`); }
      if (!k.identity.identityPrompt || k.identity.identityPrompt.length < 20) {
        score -= 15; findings.push('identityPrompt 缺失或过短');
      }

      return { passed: score >= 50, score, findings };
    },
  },
  {
    name: 'quality_score',
    threshold: 60,
    evaluate: (ctx) => {
      const findings: string[] = [];
      if (!ctx.score) return { passed: false, score: 0, findings: ['score not computed'] };

      findings.push(`Overall: ${ctx.score.voice.overall * 0.3 + ctx.score.knowledge.overall * 0.3 + ctx.score.reasoning.overall * 0.25 + ctx.score.safety.overall * 0.15}`);
      const computedOverall = ctx.score.voice.overall * 0.3 + ctx.score.knowledge.overall * 0.3 + ctx.score.reasoning.overall * 0.25 + ctx.score.safety.overall * 0.15;
      return { passed: ctx.score.voice.overall >= 40 && ctx.score.knowledge.overall >= 40, score: computedOverall, findings };
    },
  },
];

// =============================================================================
// Main Engine
// =============================================================================

/**
 * 蒸馏一个人物角色（Zero 引擎主入口）
 */
export async function distillZero(
  options: DistillationOptions,
): Promise<DistilledPersonaZero> {
  const startTime = Date.now();
  const session = createSession(options.budget ?? 10);
  const logger = createZeroLogger(options.personaId);
  logger.setPhase('init');

  const personaId = options.personaId;
  const corpusDir = options.corpusDir || join(process.cwd(), 'corpus', personaId, 'texts');

  logger.info(`Starting Zero distillation for ${personaId}`);
  logger.info(`Corpus dir: ${corpusDir}, Budget: $${session.remainingBudget.toFixed(4)}`);

  // Emit progress
  emitEvent(options, 'init', 'Starting distillation', 0, logger);

  // =======================================================================
  // Step 1: Load & Preprocess Corpus
  // =======================================================================
  logger.setPhase('load');
  emitEvent(options, 'load', 'Loading corpus', 5, logger);

  const loadResult = await loadCorpus(corpusDir, {
    maxFiles: 200,     // cap at 200 to avoid OOM on large corpora
    maxTotalBytes: 200 * 1024 * 1024, // 200 MB per process
    recursive: true,
  });

  if (loadResult.warnings.length > 0) {
    for (const w of loadResult.warnings) {
      if (w.severity === 'error') {
        logger.warn(`Load warning [${w.code}]: ${w.message}`);
      }
    }
  }

  if (loadResult.files.length === 0) {
    throw new Error(`No corpus files loaded from ${corpusDir}`);
  }

  logger.info(`Loaded ${loadResult.files.length} files, ${(loadResult.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`);
  emitEvent(options, 'preprocess', 'Preprocessing corpus', 10, logger);

  // =======================================================================
  // Step 2: Preprocess — skip expensive preprocessor for large files
  // Preprocessing is optional and expensive on multi-MB corpora
  // =======================================================================
  logger.setPhase('preprocess');
  const preprocessed = loadResult.files.map(f => ({
    ...f,
    cleanedText: f.rawText.slice(0, 500000),
    chunks: [{
      id: `${f.id}-chunk-0`,
      text: f.rawText.slice(0, 50000),
      wordCount: Math.round(f.rawText.slice(0, 50000).replace(/\s+/g, '').length * 0.4),
      language: f.language,
      isComplete: false,
    }],
  }));
  logger.info(`Preprocessed ${preprocessed.length} files (fast mode, skipped expensive cleaning)`);
  emitEvent(options, 'analyze', 'Analyzing corpus', 15, logger);

  // =======================================================================
  // Step 3: Analyze
  // =======================================================================
  logger.setPhase('analyze');
  const corpusReport = analyzeCorpus(preprocessed as unknown as import('./types').CorpusFile[], personaId, {
    detectPeriods: true,
    sampleSize: 50000, // always use 50K chars for quality regardless of budget
  });

  logger.logCorpusAnalysis(
    corpusReport.totalWordCount,
    corpusReport.qualityScore,
    corpusReport.languageDistributionRatio
      ? Object.entries(corpusReport.languageDistributionRatio).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'
      : 'unknown',
    corpusReport.totalFiles
  );
  emitEvent(options, 'route', 'Routing decision', 20, logger);

  // =======================================================================
  // Step 4: Route Decision
  // =======================================================================
  logger.setPhase('route');
  const routeDecision = decideRoute(corpusReport, personaId);
  logger.info(`Route: ${routeDecision.route} (${routeDecision.primaryLanguage}), confidence: ${routeDecision.confidence}`);
  emitEvent(options, 'extract', 'Extracting knowledge', 25, logger);

  // =======================================================================
  // Step 5: Extract
  // =======================================================================
  logger.setPhase('extract');

  // Get persona context from personas.ts if available
  const existingPersona = PERSONAS[personaId as keyof typeof PERSONAS];
  const personaName = existingPersona?.name ?? personaId;
  const personaContext = existingPersona
    ? `${personaName}，领域: ${(existingPersona.domain || []).join(', ')}，简介: ${existingPersona.brief?.slice(0, 100) || '无'}`
    : `人物 ID: ${personaId}`;

  const primaryLang = routeDecision.primaryLanguage as SupportedLanguage;
  const corpusSample = corpusReport.sample;

  // Extract knowledge layer
  const { knowledge } = await extractKnowledgeLayer(
    corpusSample,
    personaName,
    personaContext,
    { targetLanguage: primaryLang },
    session,
    logger,
    'knowledge'
  );

  emitEvent(options, 'extract', 'Extracting expression', 55, logger);

  // Extract expression DNA
  const expression = await extractExpressionDNA(
    corpusSample,
    primaryLang,
    personaName,
    session,
    logger,
    session.remainingBudget > 0.5 // use LLM for expression if at least $0.50 remains
  );

  emitEvent(options, 'evaluate', 'Scoring distillation', 75, logger);

  // =======================================================================
  // Step 6: Score
  // =======================================================================
  logger.setPhase('evaluate');

  const scoreResult = scoreDistillation(knowledge, expression, {
    corpusQualityScore: corpusReport.qualityScore,
    corpusWordCount: corpusReport.totalWordCount,
  });

  logger.logGate('score', scoreResult.pass, scoreResult.overall, 60, 0);
  logger.info(`Score: ${scoreResult.overall}/100 (${scoreResult.grade}) | Pass: ${scoreResult.pass}`);
  logger.info(`Findings: ${scoreResult.findings.length} issues`);

  emitEvent(options, 'prompt', 'Building system prompt', 85, logger);

  // =======================================================================
  // Step 7: Build Prompt
  // =======================================================================
  logger.setPhase('prompt');

  const systemPrompt = buildSystemPrompt(
    knowledge,
    expression,
    options.promptVariant ?? 'default',
    primaryLang === 'en' ? 'en' : 'zh'
  );

  const systemPromptBlocks = [
    { role: 'identity' as const, content: knowledge.identity.identityPrompt, priority: 1 },
    { role: 'knowledge' as const, content: `MentalModels: ${knowledge.mentalModels.length}, Values: ${knowledge.values.length}`, priority: 2 },
    { role: 'expression' as const, content: `Tone: ${expression.tone.dominant}, Vocabulary: ${expression.vocabulary.topWords.length} words`, priority: 3 },
    { role: 'rules' as const, content: 'See full prompt in system prompt field', priority: 4 },
  ];

  emitEvent(options, 'finalize', 'Finalizing output', 95, logger);

  // =======================================================================
  // Step 8: Build Output
  // =======================================================================
  logger.setPhase('finalize');

  const meta: PersonaMeta = {
    id: personaId,
    name: existingPersona?.name ?? personaId,
    nameZh: existingPersona?.nameZh,
    nameEn: existingPersona?.nameEn,
    slug: personaId,
    tagline: existingPersona?.tagline,
    taglineZh: existingPersona?.taglineZh,
    domain: (existingPersona?.domain ?? []) as PersonaMeta['domain'],
    avatar: existingPersona?.avatar,
    accentColor: existingPersona?.accentColor,
    gradientFrom: existingPersona?.gradientFrom,
    gradientTo: existingPersona?.gradientTo,
    brief: existingPersona?.brief,
    briefZh: existingPersona?.briefZh,
    originalFromPersonas: !!existingPersona,
  };

  const iterationRecord: IterationRecord = {
    iteration: 1,
    route: routeDecision.route,
    knowledge,
    expression,
    gates: [],
    score: scoreResult.breakdown,
    grade: scoreResult.grade,
    cost: session.budget,
    tokensUsed: session.totalTokens,
    durationMs: Date.now() - startTime,
    status: scoreResult.pass ? 'success' : 'degraded',
  };

  const result: DistilledPersonaZero = {
    meta,
    knowledge,
    expression,
    systemPrompt: systemPromptBlocks,
    score: scoreResult.breakdown,
    grade: scoreResult.grade,
    findings: scoreResult.findings,
    gates: [],
    iterations: [iterationRecord],
    totalCost: session.budget,
    totalTokensUsed: session.totalTokens,
    totalDurationMs: Date.now() - startTime,
    distillationVersion: 'zero-v1',
    distillationDate: new Date().toISOString(),
    corpusReport,
    routeDecision,
  };

  logger.setPhase('done');
  logger.logIteration(1, 'running', scoreResult.grade, scoreResult.overall, session.budget, Date.now() - startTime);
  logger.info(`Distillation complete: ${personaId} | Score: ${scoreResult.overall} | Grade: ${scoreResult.grade} | Cost: $${session.budget.toFixed(4)} | Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  emitEvent(options, 'done', `Distillation complete: Grade ${scoreResult.grade}`, 100, logger);

  return result;
}

// =============================================================================
// Routing
// =============================================================================

function decideRoute(report: CorpusReport, personaId: string): RouteDecision {
  const langDist = report.languageDistributionRatio;
  const langs = Object.entries(langDist)
    .filter(([, r]) => r >= 0.05)
    .sort((a, b) => b[1] - a[1]);

  if (langs.length === 0) {
    return {
      route: 'uni',
      primaryLanguage: 'mixed',
      confidence: 0.5,
      reasoning: '无法确定主要语言，默认 uni 路由',
      recommendedBatchSize: 1,
      estimatedIterations: 1,
    };
  }

  const [primary, ...rest] = langs;
  const primaryLang = primary[0] as SupportedLanguage;
  const primaryRatio = primary[1];
  const secondaryRatio = rest[0]?.[1] ?? 0;

  // Period detection
  if (report.periodPartitions && report.periodPartitions.length >= 2) {
    return {
      route: 'period',
      primaryLanguage: primaryLang,
      confidence: 0.8,
      reasoning: `检测到 ${report.periodPartitions.length} 个时期分区`,
      periodPartitions: report.periodPartitions,
      recommendedBatchSize: report.periodPartitions.length,
      estimatedIterations: report.periodPartitions.length,
    };
  }

  // Language-based routing
  if (primaryRatio >= 0.95) {
    return {
      route: 'uni',
      primaryLanguage: primaryLang,
      confidence: 0.95,
      reasoning: `主要语言 ${primaryLang} 占比 ${(primaryRatio * 100).toFixed(1)}%，单语言路由`,
      recommendedBatchSize: 1,
      estimatedIterations: 1,
    };
  }

  if (secondaryRatio >= 0.15) {
    return {
      route: 'bi',
      primaryLanguage: primaryLang,
      secondaryLanguage: rest[0][0] as SupportedLanguage,
      confidence: 0.75,
      reasoning: `第二语言 ${rest[0][0]} 占比 ${(secondaryRatio * 100).toFixed(1)}%，双语路由`,
      recommendedBatchSize: 2,
      estimatedIterations: 2,
    };
  }

  if (langs.length >= 3) {
    return {
      route: 'multi',
      primaryLanguage: primaryLang,
      secondaryLanguage: rest[0][0] as SupportedLanguage,
      tertiaryLanguage: rest[1][0] as SupportedLanguage,
      confidence: 0.6,
      reasoning: `检测到 ${langs.length} 种主要语言，多语言路由`,
      recommendedBatchSize: langs.length,
      estimatedIterations: langs.length,
    };
  }

  return {
    route: 'uni',
    primaryLanguage: primaryLang,
    confidence: 0.8,
    reasoning: `默认单语言路由`,
    recommendedBatchSize: 1,
    estimatedIterations: 1,
  };
}

// =============================================================================
// Utilities
// =============================================================================

let _eventId = 0;

function emitEvent(
  options: DistillationOptions,
  phase: string,
  message: string,
  progress: number,
  logger: ZeroLogger
): void {
  const event: PipelineEvent = {
    id: `evt-${++_eventId}`,
    phase: phase as PipelineEvent['phase'],
    step: message,
    message: `${progress}% — ${message}`,
    progress,
    timestamp: new Date().toISOString(),
    personaId: options.personaId,
    cost: logger['entries']?.length ?? 0,
  };

  if (options.onProgress) {
    options.onProgress(event);
  }
}
