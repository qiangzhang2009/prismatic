/**
 * Prismatic — Layer 6: Three-Tier Quality Gates + Iterative Refinement
 *
 * Gate 1: Corpus Health Gate — Does the corpus have enough signal?
 * Gate 2: Distillation Completeness Gate — Did we extract enough fields?
 * Gate 3: Scoring Gate — Does the persona score above the threshold?
 *
 * Each gate failure triggers automatic diagnosis and targeted fix actions.
 */

import {
  type CorpusHealthReport,
  type KnowledgeLayer,
  type ExpressionLayer,
  type DistillationScore,
  type Gate1CorpusResult,
  type Gate2DistillationResult,
  type Gate3ScoringResult,
  type IterationRecord,
  type DistillationConfig,
  type GateResult,
  PERSONA_TYPE_WEIGHTS_V4 as WEIGHTS,
  CORPUS_HEALTH_THRESHOLDS,
} from './distillation-v4-types';
import type {
  DistillationScore as LegacyScore,
} from './types';

// ─── Gate 1: Corpus Health ─────────────────────────────────────────────────────

export function evaluateGate1(
  report: CorpusHealthReport
): Gate1CorpusResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const primaryLang = report.languageDistribution[0]?.language ?? 'en';
  const minWords = primaryLang === 'zh'
    ? CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_ZH
    : CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_EN;

  // Word count
  if (report.totalWords < minWords) {
    issues.push(`语料字数不足: ${report.totalWords} < ${minWords} (${primaryLang})`);
    suggestions.push(`需要补采至少 ${minWords - report.totalWords} 字`);
  }

  // Unique word ratio
  if (report.uniqueWordRatio < CORPUS_HEALTH_THRESHOLDS.MIN_UNIQUE_WORD_RATIO) {
    issues.push(`词汇多样性不足: ${(report.uniqueWordRatio * 100).toFixed(1)}% < 15%`);
    suggestions.push('语料重复率高，建议补充更多不同来源的语料');
  }

  // Source diversity
  if (report.sourceTypeDistribution.length < CORPUS_HEALTH_THRESHOLDS.MIN_SOURCE_TYPES) {
    issues.push(`语料来源类型单一: ${report.sourceTypeDistribution.length} < 2`);
    suggestions.push('建议增加访谈、讲座、书籍等不同类型的语料');
  }

  // Signal strength
  const signalMap: Record<string, GateResult> = {
    strong: 'pass',
    medium: 'warning',
    weak: 'fail',
  };
  const signalResult = signalMap[report.signalStrength] ?? 'fail';

  // Overall result
  let result: GateResult = 'pass';
  if (issues.length >= 2) result = 'fail';
  else if (issues.length >= 1) result = 'warning';

  return {
    result,
    wordCount: report.totalWords,
    language: primaryLang,
    uniqueWordRatio: report.uniqueWordRatio,
    sourceDiversity: report.sourceTypeDistribution.length,
    signalStrength: report.signalStrength,
    issues,
    suggestions,
  };
}

// ─── Gate 2: Distillation Completeness ─────────────────────────────────────────

const MIN_REQUIREMENTS = {
  mentalModels: 5,
  values: 3,
  tensions: 1,
  vocabulary: 10,
  sentenceStyle: 3,
  forbiddenWords: 5,
  strengths: 3,
  blindspots: 2,
  honestBoundaries: 2,
};

export function evaluateGate2(
  knowledge: KnowledgeLayer,
  expression: ExpressionLayer
): Gate2DistillationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const autoFixableFindings: string[] = [];

  // Knowledge layer checks
  const checks = [
    { name: 'mentalModels', actual: knowledge.mentalModels.length, min: MIN_REQUIREMENTS.mentalModels },
    { name: 'values', actual: knowledge.values.length, min: MIN_REQUIREMENTS.values },
    { name: 'tensions', actual: knowledge.tensions.length, min: MIN_REQUIREMENTS.tensions },
    { name: 'vocabulary', actual: expression.vocabulary.length, min: MIN_REQUIREMENTS.vocabulary },
    { name: 'sentenceStyle', actual: expression.sentenceStyle.length, min: MIN_REQUIREMENTS.sentenceStyle },
    { name: 'forbiddenWords', actual: expression.forbiddenWords.length, min: MIN_REQUIREMENTS.forbiddenWords },
    { name: 'strengths', actual: knowledge.strengths.length, min: MIN_REQUIREMENTS.strengths },
    { name: 'blindspots', actual: knowledge.blindspots.length, min: MIN_REQUIREMENTS.blindspots },
    { name: 'honestBoundaries', actual: knowledge.honestBoundaries.length, min: MIN_REQUIREMENTS.honestBoundaries },
  ];

  for (const check of checks) {
    if (check.actual < check.min) {
      issues.push(`${check.name} 不足: ${check.actual} < ${check.min}`);
      suggestions.push(`需要补充 ${check.min - check.actual} 个 ${check.name}`);
      autoFixableFindings.push(`distill_${check.name}:increase`);
    }
  }

  // Identity prompt
  if (!knowledge.identityPrompt || knowledge.identityPrompt.length < 50) {
    issues.push('identityPrompt 过短或为空');
    autoFixableFindings.push('distill_identity:regenerate');
  }

  // Knowledge layer score
  const knowledgeScore = Math.min(100,
    (knowledge.mentalModels.length / MIN_REQUIREMENTS.mentalModels) * 25 +
    (knowledge.values.length / MIN_REQUIREMENTS.values) * 15 +
    (knowledge.tensions.length / MIN_REQUIREMENTS.tensions) * 10 +
    (knowledge.strengths.length / MIN_REQUIREMENTS.strengths) * 10 +
    (knowledge.blindspots.length / MIN_REQUIREMENTS.blindspots) * 10 +
    (knowledge.honestBoundaries.length / MIN_REQUIREMENTS.honestBoundaries) * 10 +
    (knowledge.identityPrompt.length >= 50 ? 20 : 0)
  );

  // Expression layer score
  const expressionScore = Math.min(100,
    (expression.vocabulary.length / MIN_REQUIREMENTS.vocabulary) * 30 +
    (expression.sentenceStyle.length / MIN_REQUIREMENTS.sentenceStyle) * 25 +
    (expression.forbiddenWords.length / MIN_REQUIREMENTS.forbiddenWords) * 15 +
    (expression.tone ? 15 : 0) +
    (expression.certaintyLevel ? 15 : 0)
  );

  let result: GateResult = 'pass';
  const criticalIssues = issues.filter(i =>
    i.includes('mentalModels') || i.includes('identityPrompt')
  );

  if (criticalIssues.length >= 1) result = 'fail';
  else if (issues.length >= 3) result = 'fail';
  else if (issues.length >= 1) result = 'warning';

  return {
    result,
    knowledgeLayerScore: Math.round(knowledgeScore),
    expressionLayerScore: Math.round(expressionScore),
    mentalModelCount: knowledge.mentalModels.length,
    valueCount: knowledge.values.length,
    tensionCount: knowledge.tensions.length,
    vocabularyCount: expression.vocabulary.length,
    sentenceStyleCount: expression.sentenceStyle.length,
    forbiddenWordCount: expression.forbiddenWords.length,
    issues,
    suggestions,
    autoFixableFindings,
  };
}

// ─── Gate 3: Scoring Gate ───────────────────────────────────────────────────────

export function evaluateGate3(
  score: DistillationScore,
  personaType: string,
  adaptiveThreshold: boolean
): Gate3ScoringResult {
  const weights = WEIGHTS[personaType] ?? WEIGHTS.default;
  const threshold = adaptiveThreshold ? weights.threshold : 60;

  const dimensionBreakdown = {
    voiceFidelity: {
      score: score.breakdown.voiceFidelity,
      weight: weights.voice,
      adjusted: Math.round(score.breakdown.voiceFidelity * weights.voice),
    },
    knowledgeDepth: {
      score: score.breakdown.knowledgeDepth,
      weight: weights.knowledge,
      adjusted: Math.round(score.breakdown.knowledgeDepth * weights.knowledge),
    },
    reasoningPattern: {
      score: score.breakdown.reasoningPattern,
      weight: weights.reasoning,
      adjusted: Math.round(score.breakdown.reasoningPattern * weights.reasoning),
    },
    safetyCompliance: {
      score: score.breakdown.safetyCompliance,
      weight: weights.safety,
      adjusted: Math.round(score.breakdown.safetyCompliance * weights.safety),
    },
  };

  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check each dimension
  if (score.breakdown.voiceFidelity < 50) {
    issues.push(`VoiceFidelity 过低: ${score.breakdown.voiceFidelity}`);
    suggestions.push('ExpressionDNA 提取不完整，建议重新提取表达层');
  }
  if (score.breakdown.knowledgeDepth < 50) {
    issues.push(`KnowledgeDepth 过低: ${score.breakdown.knowledgeDepth}`);
    suggestions.push('知识层提取不足，建议补充语料或重提 mentalModels');
  }
  if (score.breakdown.reasoningPattern < 50) {
    issues.push(`ReasoningPattern 过低: ${score.breakdown.reasoningPattern}`);
    suggestions.push('思维模式一致性不足，建议重新提取 values/tensions');
  }

  // Threshold check
  let result: GateResult = 'pass';
  if (score.overall < threshold - 10) result = 'fail';
  else if (score.overall < threshold) result = 'warning';

  return {
    result,
    score,
    adaptiveThreshold: threshold,
    dimensionBreakdown,
    issues,
    suggestions,
  };
}

// ─── Diagnosis & Fix Recommendation ───────────────────────────────────────────────

export type FailureRootCause =
  | 'corpus_insufficient'
  | 'corpus_quality_low'
  | 'corpus_diversity_low'
  | 'knowledge_incomplete'
  | 'expression_incomplete'
  | 'translation_loss'
  | 'llm_model_weak';

export function diagnoseFailure(
  gate1: Gate1CorpusResult,
  gate2: Gate2DistillationResult,
  gate3: Gate3ScoringResult
): {
  rootCause: FailureRootCause | null;
  diagnosis: string;
  fixActions: string[];
} {
  const fixActions: string[] = [];

  // Gate 1 failure
  if (gate1.result === 'fail') {
    if (gate1.wordCount < 3000) {
      return {
        rootCause: 'corpus_insufficient',
        diagnosis: `语料严重不足: ${gate1.wordCount} 字。需要更多语料才能蒸馏。`,
        fixActions: [
          'trigger_corpus_collection',
          ...gate1.suggestions,
        ],
      };
    }
    if (gate1.uniqueWordRatio < 0.1) {
      return {
        rootCause: 'corpus_quality_low',
        diagnosis: '语料重复率高，词汇多样性不足。',
        fixActions: [
          'replace_low_quality_corpus',
          'add_diverse_sources',
        ],
      };
    }
    return {
      rootCause: 'corpus_diversity_low',
      diagnosis: '语料来源类型单一。',
      fixActions: [
        'add_multi_source_corpus',
        ...gate1.suggestions,
      ],
    };
  }

  // Gate 2 failure
  if (gate2.result === 'fail') {
    const missing = gate2.autoFixableFindings.join(', ');

    if (gate2.knowledgeLayerScore < 40) {
      return {
        rootCause: 'knowledge_incomplete',
        diagnosis: `知识层提取不完整 (${gate2.knowledgeLayerScore}/100)。${gate2.issues.join('; ')}`,
        fixActions: [
          're_distill_knowledge_layer',
          'increase_llm_temperature',
          ...gate2.suggestions,
        ],
      };
    }
    return {
      rootCause: 'expression_incomplete',
      diagnosis: `表达层提取不完整 (${gate2.expressionLayerScore}/100)。${gate2.issues.join('; ')}`,
      fixActions: [
        're_distill_expression_layer',
        'extract_from_target_language',
        ...gate2.suggestions,
      ],
    };
  }

  // Gate 3 failure
  if (gate3.result === 'fail') {
    const weakest = Object.entries(gate3.dimensionBreakdown)
      .sort((a, b) => a[1].score - b[1].score)[0];

    if (weakest) {
      const [dimension, data] = weakest;
      return {
        rootCause: 'llm_model_weak',
        diagnosis: `${dimension} 维度最弱 (${data.score}), 总分 ${gate3.score.overall} < ${gate3.adaptiveThreshold} 阈值。`,
        fixActions: [
          `re_distill_${dimension}_layer`,
          'use_stronger_llm_model',
          'increase_corpus_sample_size',
          ...gate3.suggestions,
        ],
      };
    }
  }

  return {
    rootCause: null,
    diagnosis: 'All gates passed.',
    fixActions: [],
  };
}

// ─── Iterative Refinement Loop ──────────────────────────────────────────────────

export interface RefinementConfig {
  maxIterations: number;
  personaId: string;
  onIteration?: (record: IterationRecord) => void;
}

export function createIterationRecord(
  iteration: number,
  gate1?: Gate1CorpusResult,
  gate2?: Gate2DistillationResult,
  gate3?: Gate3ScoringResult,
  diagnosis?: string,
  fixActions?: string[],
  cost: number = 0,
  tokensUsed: number = 0
): IterationRecord {
  return {
    iteration,
    gates: {
      gate1,
      gate2,
      gate3,
    },
    diagnosis: diagnosis ?? '',
    fixActions: fixActions ?? [],
    timestamp: new Date().toISOString(),
    cost,
    tokensUsed,
  };
}

export function shouldContinueIteration(
  iteration: number,
  maxIterations: number,
  allResults: Gate1CorpusResult[],
  allResults2: Gate2DistillationResult[],
  allResults3: Gate3ScoringResult[]
): boolean {
  if (iteration >= maxIterations) return false;

  // Check if last iteration passed all gates
  const last1 = allResults[allResults.length - 1];
  const last2 = allResults2[allResults2.length - 1];
  const last3 = allResults3[allResults3.length - 1];

  if (last1?.result === 'pass' && last2?.result === 'pass' && last3?.result === 'pass') {
    return false;
  }

  return true;
}

// ─── Overall Pipeline Result ─────────────────────────────────────────────────────

export type PipelineResult =
  | {
      status: 'success' | 'degraded' | 'failed';
      grade: string;
      iterations: number;
      totalCost: number;
      totalTokens: number;
      reason?: string;
      finalScore: number;
      iterationList: IterationRecord[];
    };

export function summarizePipelineResult(
  iterations: IterationRecord[],
  finalScore: DistillationScore
): PipelineResult {
  const totalCost = iterations.reduce((sum, i) => sum + i.cost, 0);
  const totalTokens = iterations.reduce((sum, i) => sum + i.tokensUsed, 0);
  const lastIter = iterations[iterations.length - 1];

  if (finalScore.grade === 'A' || finalScore.grade === 'B') {
    return {
      status: 'success',
      grade: finalScore.grade,
      iterations: iterations.length,
      totalCost,
      totalTokens,
      finalScore: finalScore.overall,
      iterationList: iterations,
    };
  }

  if (finalScore.grade === 'C' || finalScore.grade === 'D') {
    return {
      status: 'degraded',
      grade: finalScore.grade,
      iterations: iterations.length,
      totalCost,
      totalTokens,
      reason: `评分 ${finalScore.overall} 低于 A/B 阈值，但通过基础阈值。已知短板: ${lastIter?.diagnosis}`,
      finalScore: finalScore.overall,
      iterationList: iterations,
    };
  }

  return {
    status: 'failed',
    grade: finalScore.grade,
    reason: `最终评分 ${finalScore.overall} (${finalScore.grade}) 未通过基础阈值 (60)。${lastIter?.diagnosis}`,
    iterations: iterations.length,
    totalCost,
    totalTokens,
    finalScore: finalScore.overall,
    iterationList: iterations,
  };
}
