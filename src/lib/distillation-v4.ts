/**
 * Prismatic — Distillation v4 Orchestrator
 * Unified distillation engine with language-aware routing
 *
 * Entry point for the v4 distillation pipeline.
 * Coordinates: Layer 1 (Intelligence) → Layer 2 (Routing) →
 *   Layer 3 (Knowledge) → Layer 4 (Expression) →
 *   Layer 5 (Validation) → Layer 6 (Gates) →
 *   [Iteration Loop] → Final Output
 */

import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import type {
  DistillationConfig,
  DistillationRoute,
  SupportedLanguage,
  OutputLanguage,
  DistilledPersonaV4,
  BilingualExtraction,
  IterationRecord,
} from './distillation-v4-types';
import {
  analyzeCorpus,
  buildCorpusSample,
  getFileByLanguage,
  type CorpusFile,
} from './distillation-l1-intelligence';
import { decideRoute, summarizeRoute } from './distillation-l2-routing';
import { extractKnowledge } from './distillation-l3-knowledge';
import { extractExpression } from './distillation-l4-expression';
import { crossValidate, buildFusion, validateBilingualCompleteness } from './distillation-l5-validation';
import {
  evaluateGate1,
  evaluateGate2,
  evaluateGate3,
  evaluateGate4,
  diagnoseFailure,
  createIterationRecord,
  summarizePipelineResult,
  type PipelineResult,
} from './distillation-l6-gates';
import { calculateDistillationScore } from './distillation-metrics';
import { getLLMProvider } from './llm';
import type { LLMProvider } from './llm';
import type { Persona, DistillationScore } from './types';



// ─── Default Config ─────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: DistillationConfig = {
  maxIterations: 3,
  adaptiveThreshold: true,
  strictMode: false,
  outputLanguage: 'zh-CN',
  fallbackToUni: true,
  conflictResolutionStrategy: 'primary_language',
  enablePeriodPartitioning: true,
  periodThreshold: 10,
  costBudget: 1.0,    // $1 max per persona
  tokenBudget: 100000,
};

// ─── Uni-Lingual Route ─────────────────────────────────────────────────────────

async function runUniRoute(
  personaId: string,
  corpusDir: string,
  config: DistillationConfig,
  _llm: any
): Promise<{
  knowledge: import('./distillation-v4-types').KnowledgeLayer;
  expression: import('./distillation-v4-types').ExpressionLayer;
  report: import('./distillation-v4-types').CorpusHealthReport;
  routeDecision: ReturnType<typeof decideRoute>;
}> {
  const report = await analyzeCorpus(personaId, corpusDir);
  const routeDecision = decideRoute(personaId, report, config.outputLanguage);

  console.log(`[v4] Uni-route selected for ${personaId}`);
  console.log(`     Primary: ${routeDecision.primaryLanguage}, Output: ${config.outputLanguage}`);

  // Read corpus files recursively
  const corpusFiles: CorpusFile[] = [];

  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const filepath = path.join(dir, entry);
      const stat = fs.statSync(filepath);
      if (stat.isFile()) {
        corpusFiles.push({
          filename: entry,
          filepath,
          content: fs.readFileSync(filepath, 'utf-8'),
          size: stat.size,
        });
      } else if (stat.isDirectory()) {
        walkDir(filepath);
      }
    }
  }

  walkDir(corpusDir);

  const primaryFiles = getFileByLanguage(corpusFiles, routeDecision.primaryLanguage);
  const primarySample = buildCorpusSample(primaryFiles, 80000);

  // Knowledge extraction
  const knowledge = await extractKnowledge({
    corpusSample: primarySample,
    personaId,
    primaryLanguage: routeDecision.primaryLanguage,
    outputLanguage: config.outputLanguage,
    llm: _llm,
  });

  // Expression extraction — from TARGET language
  // If target is Chinese but corpus is English, we need to either:
  // 1. Use the corpus as-is (will extract English expression DNA)
  // 2. Have separate Chinese corpus
  const expressionCorpus = routeDecision.primaryLanguage === 'zh'
    ? primarySample
    : primarySample; // TODO: Integrate translation for expression layer

  const expression = await extractExpression({
    corpusSample: expressionCorpus,
    sourceCorpusSample: undefined,
    personaId,
    targetLanguage: config.outputLanguage,
    sourceLanguage: routeDecision.primaryLanguage,
    llm: _llm,
  });

  return { knowledge, expression, report, routeDecision };
}

// ─── Bi-Lingual Route ─────────────────────────────────────────────────────────

async function runBiRoute(
  personaId: string,
  corpusDir: string,
  config: DistillationConfig,
  _llm: any
): Promise<{
  bilingual: BilingualExtraction;
  report: import('./distillation-v4-types').CorpusHealthReport;
  routeDecision: ReturnType<typeof decideRoute>;
}> {
  const report = await analyzeCorpus(personaId, corpusDir);
  const routeDecision = decideRoute(personaId, report, config.outputLanguage);

  console.log(`[v4] Bi-lingual route for ${personaId}`);
  console.log(`     Primary: ${routeDecision.primaryLanguage}, Secondary: ${routeDecision.secondaryLanguages.join(', ')}`);

  const corpusFiles: CorpusFile[] = [];

  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const filepath = path.join(dir, entry);
      const stat = fs.statSync(filepath);
      if (stat.isFile()) {
        corpusFiles.push({
          filename: entry,
          filepath,
          content: fs.readFileSync(filepath, 'utf-8'),
          size: stat.size,
        });
      } else if (stat.isDirectory()) {
        walkDir(filepath);
      }
    }
  }

  walkDir(corpusDir);

  const primaryLang = routeDecision.primaryLanguage;
  const secondaryLang = routeDecision.secondaryLanguages[0];

  const primaryFiles = getFileByLanguage(corpusFiles, primaryLang);
  const secondaryFiles = getFileByLanguage(corpusFiles, secondaryLang);

  const primarySample = buildCorpusSample(primaryFiles, 40000);
  const secondarySample = buildCorpusSample(secondaryFiles, 20000);

  // Extract both in parallel
  const [primaryKnowledge, secondaryKnowledge] = await Promise.all([
    extractKnowledge({
      corpusSample: primarySample,
      personaId,
      primaryLanguage: primaryLang,
      outputLanguage: config.outputLanguage,
      llm: _llm,
    }),
    extractKnowledge({
      corpusSample: secondarySample,
      personaId,
      primaryLanguage: secondaryLang,
      outputLanguage: config.outputLanguage,
      llm: _llm,
    }),
  ]);

  // Expression — extract from each language
  const [primaryExpression, secondaryExpression] = await Promise.all([
    extractExpression({
      corpusSample: primarySample,
      personaId,
      targetLanguage: primaryLang === 'zh' ? 'zh-CN' : 'en-US',
      sourceLanguage: primaryLang,
      llm: _llm,
    }),
    extractExpression({
      corpusSample: secondarySample,
      personaId,
      targetLanguage: secondaryLang === 'zh' ? 'zh-CN' : 'en-US',
      sourceLanguage: secondaryLang,
      llm: _llm,
    }),
  ]);

  return {
    bilingual: {
      primary: { language: primaryLang, knowledge: primaryKnowledge, expression: primaryExpression },
      secondary: { language: secondaryLang, knowledge: secondaryKnowledge, expression: secondaryExpression },
    },
    report,
    routeDecision,
  };
}

// ─── Period Route ─────────────────────────────────────────────────────────────

async function runPeriodRoute(
  personaId: string,
  corpusDir: string,
  config: DistillationConfig,
  _llm: any
): Promise<{
  periods: import('./distillation-v4-types').Period[];
  knowledge: import('./distillation-v4-types').KnowledgeLayer;
  expression: import('./distillation-v4-types').ExpressionLayer;
  report: import('./distillation-v4-types').CorpusHealthReport;
  routeDecision: ReturnType<typeof decideRoute>;
}> {
  const report = await analyzeCorpus(personaId, corpusDir);
  const routeDecision = decideRoute(personaId, report, config.outputLanguage);

  console.log(`[v4] Period route for ${personaId}`);
  console.log(`     ${routeDecision.periodPartitions?.map(p => p.label).join(' → ') ?? 'No periods'}`);

  const corpusFiles: CorpusFile[] = [];

  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const filepath = path.join(dir, entry);
      const stat = fs.statSync(filepath);
      if (stat.isFile()) {
        corpusFiles.push({
          filename: entry,
          filepath,
          content: fs.readFileSync(filepath, 'utf-8'),
          size: stat.size,
        });
      } else if (stat.isDirectory()) {
        walkDir(filepath);
      }
    }
  }

  walkDir(corpusDir);

  const periods = routeDecision.periodPartitions ?? [];
  const periodSamples = periods.map(period => {
    // Filter files that match this period
    const periodFiles = corpusFiles.filter(f => {
      const msMatch = f.filename.match(/^Ms[-_](\d+)/i);
      const tsMatch = f.filename.match(/^Ts[-_](\d+)/i);
      if (!msMatch && !tsMatch) return false;
      const num = parseInt(msMatch?.[1] ?? tsMatch?.[1] ?? '0');
      const year = msMatch
        ? 1912 + (num - 100) * 1.5
        : 1929 + (num - 200) * 1.2;
      return year >= period.startYear && year <= period.endYear;
    });
    return {
      period,
      sample: buildCorpusSample(periodFiles, 60000),
    };
  });

  // Extract knowledge for each period
  const periodKnowledges = await Promise.all(
    periodSamples.map(({ period, sample }) =>
      extractKnowledge({
        corpusSample: sample,
        personaId,
        primaryLanguage: period.language,
        outputLanguage: config.outputLanguage,
        period,
        llm: _llm,
      })
    )
  );

  // Fuse period knowledges (union)
  const fusedKnowledge = periodKnowledges.reduce(
    (acc, k) => ({
      ...acc,
      mentalModels: [...acc.mentalModels, ...k.mentalModels],
      values: [...acc.values, ...k.values],
      tensions: [...acc.tensions, ...k.tensions],
      decisionHeuristics: [...acc.decisionHeuristics, ...k.decisionHeuristics],
      strengths: [...new Set([...acc.strengths, ...k.strengths])],
      blindspots: [...new Set([...acc.blindspots, ...k.blindspots])],
      keyConcepts: [...acc.keyConcepts, ...k.keyConcepts],
    }),
    periodKnowledges[0]
  );

  // Expression from full corpus
  const fullSample = buildCorpusSample(corpusFiles, 80000);
  const expression = await extractExpression({
    corpusSample: fullSample,
    personaId,
    targetLanguage: config.outputLanguage,
    sourceLanguage: routeDecision.primaryLanguage,
    llm: _llm,
  });

  return {
    periods,
    knowledge: fusedKnowledge,
    expression,
    report,
    routeDecision,
  };
}

// ─── Score Calculation ─────────────────────────────────────────────────────────

function calculateScore(
  knowledge: import('./distillation-v4-types').KnowledgeLayer,
  expression: import('./distillation-v4-types').ExpressionLayer,
  personaId: string,
  route: DistillationRoute
): DistillationScore {
  // Convert to legacy Persona for scoring — must include ALL fields that metrics.ts accesses
  const mockPersona: Partial<Persona> = {
    id: personaId,
    slug: personaId,
    name: personaId,
    nameZh: personaId,
    nameEn: personaId,
    domain: [],
    tagline: knowledge.values[0]?.name ?? '',
    taglineZh: knowledge.values[0]?.nameZh ?? '',
    brief: (knowledge.identityPrompt || '').slice(0, 200),
    briefZh: (knowledge.identityPromptZh || '').slice(0, 200),
    mentalModels: knowledge.mentalModels.map((m, i) => ({
      id: m.id || `mm-${i}`,
      name: m.name,
      nameZh: m.nameZh,
      oneLiner: m.oneLiner,
      evidence: m.evidence.map(e => ({ quote: e.quote, source: e.source, year: e.year })),
      crossDomain: m.crossDomain,
      application: m.application,
      limitation: m.limitation,
    })),
    decisionHeuristics: knowledge.decisionHeuristics.map((h, i) => ({
      id: h.id || `dh-${i}`,
      name: h.name,
      nameZh: h.nameZh,
      description: h.description,
      application: h.application,
      example: h.example,
    })),
    expressionDNA: {
      sentenceStyle: expression.sentenceStyle,
      vocabulary: expression.vocabulary,
      forbiddenWords: expression.forbiddenWords,
      rhythm: expression.rhythm,
      humorStyle: '',
      certaintyLevel: expression.certaintyLevel,
      rhetoricalHabit: expression.rhetoricalHabit,
      quotePatterns: expression.quotePatterns,
      chineseAdaptation: expression.chineseAdaptation,
    },
    values: knowledge.values.map(v => ({
      name: v.name,
      nameZh: v.nameZh,
      priority: v.priority,
      description: v.description,
    })),
    tensions: knowledge.tensions.map(t => ({
      dimension: t.dimension,
      tensionZh: t.tensionZh,
      description: t.description,
      descriptionZh: t.descriptionZh,
    })),
    antiPatterns: knowledge.antiPatterns,
    honestBoundaries: knowledge.honestBoundaries.map(hb => ({
      text: hb.text,
      textZh: hb.textZh,
    })),
    strengths: knowledge.strengths,
    blindspots: knowledge.blindspots,
    sources: knowledge.sources,
    researchDate: new Date().toISOString().split('T')[0],
    version: 'v4',
    researchDimensions: [],
    systemPromptTemplate: buildSystemPrompt(knowledge, expression),
    identityPrompt: knowledge.identityPrompt,
  } as unknown as Persona;

  const score = calculateDistillationScore(mockPersona as unknown as Persona);
  return score;
}

// ─── Main v4 Pipeline ────────────────────────────────────────────────────────

export interface DistillV4Options {
  personaId: string;
  corpusDir: string;
  config?: Partial<DistillationConfig>;
  onProgress?: (stage: string, progress: number) => void;
}

export async function distillPersonaV4(
  options: DistillV4Options
): Promise<{
  persona: import('./distillation-v4-types').DistilledPersonaV4;
  pipelineResult: PipelineResult;
}> {
  const { personaId, corpusDir, config: configOverrides, onProgress } = options;
  const config: DistillationConfig = { ...DEFAULT_CONFIG, ...configOverrides };
  const llm: LLMProvider = getLLMProvider();

  onProgress?.('intelligence', 0);

  // ── Layer 1: Intelligence ────────────────────────────────────────────────
  const report = await analyzeCorpus(personaId, corpusDir);
  onProgress?.('intelligence', 100);

  // ── Layer 2: Routing ───────────────────────────────────────────────────
  const routeDecision = decideRoute(personaId, report, config.outputLanguage);
  onProgress?.('routing', 0);

  console.log(`[v4] Route decision for ${personaId}:`);
  console.log(summarizeRoute(routeDecision));
  onProgress?.('routing', 100);

  // ── Layer 3+4: Extraction ───────────────────────────────────────────────
  let knowledge: import('./distillation-v4-types').KnowledgeLayer;
  let expression: import('./distillation-v4-types').ExpressionLayer;
  let bilingual: BilingualExtraction | undefined;
  let periods: import('./distillation-v4-types').Period[] = [];

  onProgress?.('knowledge', 0);

  if (routeDecision.route === 'period') {
    periods = routeDecision.periodPartitions ?? [];
    const periodResult = await runPeriodRoute(personaId, corpusDir, config, llm);
    knowledge = periodResult.knowledge;
    expression = periodResult.expression;
  } else if (routeDecision.route === 'bi') {
    // Bi-lingual route: extract both languages, then cross-validate and fuse.
    // Do NOT re-run uni — the bi extraction already has primary+secondary knowledge/expression.
    const biResult = await runBiRoute(personaId, corpusDir, config, llm);
    bilingual = biResult.bilingual;
    // Use the primary language's extraction as base; L5 fusion block below will merge in secondary.
    knowledge = biResult.bilingual.primary.knowledge;
    expression = biResult.bilingual.primary.expression;
  } else {
    // uni or multi (fallback to uni)
    const uniResult = await runUniRoute(personaId, corpusDir, config, llm);
    knowledge = uniResult.knowledge;
    expression = uniResult.expression;
  }

  onProgress?.('knowledge', 100);
  onProgress?.('expression', 0);

  // ── Layer 5: Cross-Validation ────────────────────────────────────────
  let validation: import('./distillation-v4-types').ValidationReport;
  if (routeDecision.route === 'bi' && bilingual) {
    validation = crossValidate({
      bilingual,
      strategy: config.conflictResolutionStrategy,
      outputLanguage: config.outputLanguage,
    });
  } else {
    validation = {
      crossLanguageConsistency: 100,
      conceptFusions: [],
      conflicts: [],
      expressionConsistency: 100,
      knowledgeCoverage: 100,
      overallConfidence: knowledge.confidence,
      validationNotes: [],
    };
  }

  // ── Layer 5: Fusion (for bi-route) ─────────────────────────────────────
  if (routeDecision.route === 'bi' && bilingual) {
    const fusion = buildFusion(bilingual, validation, config.outputLanguage, config.conflictResolutionStrategy);
    knowledge = fusion.knowledge;
    expression = fusion.expression;
    validation = fusion.validation;
  }

  onProgress?.('expression', 100);
  onProgress?.('validation', 0);
  onProgress?.('validation', 100);

  // ── Layer 6: Scoring ───────────────────────────────────────────────────
  const score = calculateScore(knowledge, expression, personaId, routeDecision.route);
  onProgress?.('gate1', 0);
  const gate1 = evaluateGate1(report);
  onProgress?.('gate1', 50);
  onProgress?.('gate2', 0);
  const gate2 = evaluateGate2(knowledge, expression);
  // V5 fix: add bilingual completeness validation to gate2
  const bilingualCheck = validateBilingualCompleteness(knowledge, expression);
  if (!bilingualCheck.passed) {
    for (const issue of bilingualCheck.issues) {
      gate2.issues.push(issue);
      gate2.autoFixableFindings.push('distill_chinese_completeness:regenerate');
    }
    if (gate2.result === 'pass') gate2.result = 'fail';
  }
  for (const warning of bilingualCheck.warnings) {
    gate2.suggestions.push(warning);
  }
  onProgress?.('gate2', 50);
  onProgress?.('gate3', 0);

  const personaType = inferPersonaType(knowledge);
  const gate3 = evaluateGate3(score, personaType, config.adaptiveThreshold);
  onProgress?.('gate3', 100);

  // ── Gate 4: Semantic Validation ──────────────────────────────────────────
  onProgress?.('gate4', 0);
  const skipBilingual = routeDecision.route === 'uni' && routeDecision.primaryLanguage === 'en';
  const gate4 = evaluateGate4(personaId, knowledge, expression, skipBilingual);
  onProgress?.('gate4', 100);

  // ── Record First Iteration ────────────────────────────────────────────
  const iterations: IterationRecord[] = [];
  let currentKnowledge = knowledge;
  let currentExpression = expression;
  let currentScore = score;
  let currentGate1 = gate1;
  let currentGate2 = gate2;
  let currentGate3 = gate3;
  let currentGate4 = gate4;
  let iteration = 1;

  // Record the initial extraction as iteration 1
  const initialRecord = createIterationRecord(
    iteration,
    currentGate1,
    currentGate2,
    currentGate3,
    currentGate4,
    gate3.result === 'pass' && gate4.result === 'pass'
      ? 'Initial extraction passed all quality gates'
      : 'Initial extraction failed quality gate(s)',
    [],
    0,
    0
  );
  iterations.push(initialRecord);

  // ── Iteration Loop (retry on gate failure) ──────────────────────────
  while (iteration < config.maxIterations) {
    if (currentGate2.result !== 'fail' && currentGate3.result !== 'fail' && currentGate4.result !== 'fail') break;

    iteration++;
    console.log(`[v4] Iteration ${iteration} for ${personaId} — retry after gate failure`);

    // Re-extract
    onProgress?.(`iteration:${iteration}`, 0);
    const retryResult = await runUniRoute(personaId, corpusDir, config, llm);
    currentKnowledge = retryResult.knowledge;
    currentExpression = retryResult.expression;
    currentScore = calculateScore(currentKnowledge, currentExpression, personaId, 'uni');
    currentGate1 = evaluateGate1(retryResult.report);
    currentGate2 = evaluateGate2(currentKnowledge, currentExpression);
    // V5 fix: add bilingual completeness validation to retry gate2
    const retryBilingualCheck = validateBilingualCompleteness(currentKnowledge, currentExpression);
    if (!retryBilingualCheck.passed) {
      for (const issue of retryBilingualCheck.issues) {
        currentGate2.issues.push(issue);
        currentGate2.autoFixableFindings.push('distill_chinese_completeness:regenerate');
      }
      if (currentGate2.result === 'pass') currentGate2.result = 'fail';
    }
    for (const warning of retryBilingualCheck.warnings) {
      currentGate2.suggestions.push(warning);
    }
    currentGate3 = evaluateGate3(currentScore, personaType, config.adaptiveThreshold);
    currentGate4 = evaluateGate4(personaId, currentKnowledge, currentExpression, skipBilingual);

    const retryRecord = createIterationRecord(
      iteration,
      currentGate1,
      currentGate2,
      currentGate3,
      currentGate4,
      `Retry after gate failure (G2:${currentGate2.result} G3:${currentGate3.result} G4:${currentGate4.result})`,
      currentGate4.autoFixableFindings,
      0,
      0
    );
    iterations.push(retryRecord);
    onProgress?.(`iteration:${iteration}`, 100);
  }

  // ── Finalize ───────────────────────────────────────────────────────────
  onProgress?.('finalize', 0);

  const grade = currentScore.overall >= 90 ? 'A'
    : currentScore.overall >= 75 ? 'B'
    : currentScore.overall >= 60 ? 'C'
    : currentScore.overall >= 45 ? 'D'
    : 'F';

  const pipelineResult = summarizePipelineResult(
    iterations,
    currentScore
  );

  const totalCost = iterations.reduce((s, i) => s + i.cost, 0);
  const totalTokens = iterations.reduce((s, i) => s + i.tokensUsed, 0);

  // ── Build DistilledPersonaV4 ──────────────────────────────────────────

  // Infer persona name from directory or config
  const inferredName = personaId
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  const persona: DistilledPersonaV4 = {
    meta: {
      personaId,
      distillationVersion: 'v4',
      languages: [routeDecision.primaryLanguage, ...routeDecision.secondaryLanguages],
      primaryLanguage: routeDecision.primaryLanguage,
      secondaryLanguages: routeDecision.secondaryLanguages,
      outputLanguage: config.outputLanguage,
      route: routeDecision.route,
      corpusStats: {
        files: report.totalFiles,
        words: report.totalWords,
        density: report.uniqueWordRatio,
        sources: report.sourceTypeDistribution.length,
      },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      confidence: validation.overallConfidence,
      confidenceNotes: [
        ...knowledge.confidenceNotes,
        ...expression.confidenceNotes,
        ...validation.validationNotes,
      ],
      iterationCount: iterations.length,
      totalCost,
      totalTokensUsed: totalTokens,
    },
    knowledge: currentKnowledge,
    expression: currentExpression,
    validation,
    score: currentScore,
    grade: grade as any,
    iterationHistory: iterations,
    periods: periods.length > 0 ? periods : undefined,
    persona: {
      id: personaId,
      slug: personaId,
      name: inferredName,
      nameZh: inferredName,
      nameEn: inferredName,
      domain: [],
      tagline: currentKnowledge.values[0]?.name ?? '',
      taglineZh: currentKnowledge.values[0]?.nameZh ?? '',
      brief: (currentKnowledge.identityPrompt || '').slice(0, 200),
      briefZh: (currentKnowledge.identityPromptZh || '').slice(0, 200),
      avatar: '',
      accentColor: '#6366f1',
      gradientFrom: '#6366f1',
      gradientTo: '#8b5cf6',
      mentalModels: currentKnowledge.mentalModels.map((m, i) => ({
        id: m.id || `mm-${i}`,
        name: m.name,
        nameZh: m.nameZh,
        oneLiner: m.oneLiner,
        evidence: m.evidence.map(e => ({ quote: e.quote, source: e.source, year: e.year })),
        crossDomain: m.crossDomain,
        application: m.application,
        limitation: m.limitation,
      })),
      decisionHeuristics: currentKnowledge.decisionHeuristics.map((h, i) => ({
        id: h.id || `dh-${i}`,
        name: h.name,
        nameZh: h.nameZh,
        description: h.description,
        application: h.application,
        example: h.example,
      })),
      expressionDNA: {
        sentenceStyle: currentExpression.sentenceStyle,
        vocabulary: currentExpression.vocabulary,
        forbiddenWords: currentExpression.forbiddenWords,
        rhythm: currentExpression.rhythm,
        humorStyle: '',
        certaintyLevel: currentExpression.certaintyLevel,
        rhetoricalHabit: currentExpression.rhetoricalHabit,
        quotePatterns: currentExpression.quotePatterns,
        chineseAdaptation: currentExpression.chineseAdaptation,
        verbalMarkers: currentExpression.verbalMarkers,
        speakingStyle: currentExpression.speakingStyle,
      },
      values: currentKnowledge.values.map(v => ({
        name: v.name,
        nameZh: v.nameZh,
        priority: v.priority,
        description: v.description,
      })),
      tensions: currentKnowledge.tensions.map(t => ({
        dimension: t.dimension,
        tensionZh: t.tensionZh,
        description: t.description,
        descriptionZh: t.descriptionZh,
      })),
      antiPatterns: currentKnowledge.antiPatterns,
      honestBoundaries: currentKnowledge.honestBoundaries.map(hb => ({
        text: hb.text,
        textZh: hb.textZh,
      })),
      strengths: currentKnowledge.strengths,
      blindspots: currentKnowledge.blindspots,
      sources: currentKnowledge.sources,
      researchDate: new Date().toISOString().split('T')[0],
      version: 'v4',
      researchDimensions: [],
      systemPromptTemplate: buildSystemPrompt(currentKnowledge, currentExpression),
      identityPrompt: currentKnowledge.identityPrompt,
    } as unknown as Persona,
  };

  onProgress?.('finalize', 100);

  console.log(`[v4] Completed ${personaId}: Score=${currentScore.overall} (${grade}), Route=${routeDecision.route}`);

  return { persona, pipelineResult };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferPersonaType(
  knowledge: import('./distillation-v4-types').KnowledgeLayer
): string {
  const domains = new Set<string>();

  for (const mm of knowledge.mentalModels) {
    for (const d of mm.crossDomain) {
      domains.add(d.toLowerCase());
    }
  }

  if (domains.has('philosophy')) return 'philosopher';
  if (domains.has('spirituality')) return 'spiritual';
  if (domains.has('science')) return 'scientist';
  if (domains.has('investment') || domains.has('business')) return 'business';
  if (domains.has('history')) return 'historical';
  return 'default';
}

function buildSystemPrompt(
  knowledge: import('./distillation-v4-types').KnowledgeLayer,
  expression: import('./distillation-v4-types').ExpressionLayer
): string {
  // Strip redundant patterns from identityCore to prevent "你是XXX是一位..." duplication
  let identityCore = knowledge.identityPromptZh || knowledge.identityPrompt.split('。')[0] || '一位智者';
  // Remove "XXX是一位" prefix so we get "你是XXX，description" not "你是XXX是一位..."
  const shiIdx = identityCore.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 20) {
    identityCore = identityCore.slice(shiIdx + 2).trim();
  }
  // Remove "XXX的核心身份是一位" prefix
  const coreIdx = identityCore.indexOf('的核心身份是一位');
  if (coreIdx > 1 && coreIdx < 25) {
    identityCore = identityCore.slice(coreIdx + 6).trim();
  }
  if (!identityCore || identityCore.length < 5) identityCore = '一位智者';
  const toneLabel = expression.tone || '中性';
  const certaintyLabel =
    expression.certaintyLevel === 'high' ? '表达确定'
    : expression.certaintyLevel === 'low' ? '保持适度不确定'
    : '平衡客观';
  const coreValues = knowledge.values.slice(0, 3).map(v => v.nameZh || v.name).join('、');
  const coreModels = knowledge.mentalModels.slice(0, 3).map(m => m.nameZh || m.name).join('、');
  const chineseAdaptation = expression.chineseAdaptation || '保持专业、清晰的中文表达。';
  const rhetoricalHabit = expression.rhetoricalHabit || '理性分析。';

  return `你是${identityCore}。

表达风格：${expression.speakingStyle || '语言简洁凝练，富有洞察力。'}
语气：${toneLabel}
确信程度：${certaintyLabel}
修辞习惯：${rhetoricalHabit}

中文适应提示：
${chineseAdaptation}

核心价值观：${coreValues}
思维特点：${coreModels}
`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function personaToLegacy(
  v4: DistilledPersonaV4
): Persona {
  return v4.persona;
}

export function extractCorpusStats(corpusDir: string): {
  files: number;
  words: number;
  languages: string[];
} {
  let files = 0;
  let totalWords = 0;
  const languages = new Set<string>();

  if (fs.existsSync(corpusDir)) {
    for (const entry of fs.readdirSync(corpusDir)) {
      const filepath = path.join(corpusDir, entry);
      if (fs.statSync(filepath).isFile()) {
        files++;
        const content = fs.readFileSync(filepath, 'utf-8');
        totalWords += content.split(/\s+/).filter(Boolean).length;
        // Simple language detection
        if (/[\u4e00-\u9fff]/.test(content)) languages.add('zh');
        else if (/[äöüßÄÖÜ]/.test(content)) languages.add('de');
        else languages.add('en');
      }
    }
  }

  return { files, words: totalWords, languages: [...languages] };
}
