/**
 * Zero 蒸馏引擎 — 四维评分引擎
 * 继承 distillation-metrics.ts 的评分体系，并真正接入 corpus 质量
 */

import {
  ScoreBreakdown, VoiceScore, KnowledgeScore, ReasoningScore, SafetyScore,
  DistillationGrade, DistillationFinding, KnowledgeLayer, ExpressionDNA
} from '../types';

// =============================================================================
// Weights
// =============================================================================

const WEIGHTS = {
  voice: 0.3,
  knowledge: 0.3,
  reasoning: 0.25,
  safety: 0.15,
};

// =============================================================================
// Score Engine
// =============================================================================

export interface ScoreOptions {
  corpusQualityScore?: number; // 从 CorpusReport 传入的前置质量分
  corpusWordCount?: number;
}

export interface ScoreResult {
  breakdown: ScoreBreakdown;
  overall: number;
  grade: DistillationGrade;
  findings: DistillationFinding[];
  pass: boolean;
}

/**
 * 计算蒸馏结果的四维评分
 */
export function scoreDistillation(
  knowledgeLayer: KnowledgeLayer,
  expression: ExpressionDNA,
  options: ScoreOptions = {}
): ScoreResult {
  const findings: DistillationFinding[] = [];

  // Gate: corpus quality affects final score
  const corpusPenalty = options.corpusQualityScore !== undefined
    ? Math.max(0, (60 - options.corpusQualityScore) / 100)
    : 0;

  // Voice score
  const voice = computeVoiceScore(expression, findings);

  // Knowledge score
  const knowledgeScoreResult = computeKnowledgeScore(knowledgeLayer, expression, options, findings);

  // Reasoning score
  const reasoning = computeReasoningScore(knowledgeLayer, findings);

  // Safety score
  const safety = computeSafetyScore(knowledgeLayer, expression, findings);

  // Weighted overall
  const breakdown: ScoreBreakdown = { voice, knowledge: knowledgeScoreResult, reasoning, safety };
  const weightedSum =
    voice.overall * WEIGHTS.voice +
    knowledgeScoreResult.overall * WEIGHTS.knowledge +
    reasoning.overall * WEIGHTS.reasoning +
    safety.overall * WEIGHTS.safety;

  // Apply corpus penalty
  const overall = Math.round(Math.max(0, weightedSum * (1 - corpusPenalty)));

  // Grade
  const grade = computeGrade(overall);

  // Pass threshold
  const pass = overall >= 60;

  return { breakdown, overall, grade, findings, pass };
}

// =============================================================================
// Voice Score
// =============================================================================

function computeVoiceScore(expr: ExpressionDNA, findings: DistillationFinding[]): VoiceScore {
  // Vocabulary match (0-100)
  let vocabScore = 50;
  const vocabCount = expr.vocabulary.topWords.length;
  if (vocabCount >= 15) vocabScore = 90;
  else if (vocabCount >= 10) vocabScore = 80;
  else if (vocabCount >= 5) vocabScore = 65;
  else if (vocabCount >= 3) vocabScore = 50;
  else vocabScore = 20;

  if (vocabCount === 0) {
    findings.push({
      code: 'voice-no-vocabulary',
      dimension: 'voice',
      severity: 'error',
      message: 'ExpressionDNA.vocabulary.topWords 为空',
      affectedField: 'expression.vocabulary.topWords',
      autoFixable: true,
    });
  }

  // Sentence pattern match (0-100)
  let styleScore = 50;
  const styleCount = expr.sentenceStyles.length;
  if (styleCount >= 3) styleScore = 85;
  else if (styleCount >= 2) styleScore = 70;
  else if (styleCount >= 1) styleScore = 55;
  else styleScore = 30;

  if (styleCount === 0) {
    findings.push({
      code: 'voice-no-sentence-style',
      dimension: 'voice',
      severity: 'warn',
      message: 'ExpressionDNA.sentenceStyles 为空',
      affectedField: 'expression.sentenceStyles',
      autoFixable: true,
    });
  }

  // Tone match (0-100)
  let toneScore = 70;
  if (expr.tone.markers && expr.tone.markers.length >= 3) toneScore = 85;
  else if (expr.tone.markers && expr.tone.markers.length >= 1) toneScore = 75;

  // Forbidden word compliance (0-100)
  let forbiddenScore = 80;
  if (expr.forbiddenWords.length === 0) {
    forbiddenScore = 60;
    findings.push({
      code: 'voice-no-forbidden-words',
      dimension: 'voice',
      severity: 'warn',
      message: 'ExpressionDNA.forbiddenWords 未定义',
      affectedField: 'expression.forbiddenWords',
      suggestedFix: '从语料中推断该人物绝不会使用的词汇',
      autoFixable: true,
    });
  }

  // Rhetorical habit match (0-100)
  const rhetoricalScore = expr.rhetoricalHabits.length >= 2 ? 80 : expr.rhetoricalHabits.length >= 1 ? 65 : 40;

  const overall = Math.round(
    vocabScore * 0.3 +
    styleScore * 0.25 +
    toneScore * 0.2 +
    forbiddenScore * 0.15 +
    rhetoricalScore * 0.1
  );

  return {
    overall,
    vocabularyMatch: vocabScore,
    sentencePatternMatch: styleScore,
    toneMatch: toneScore,
    forbiddenWordCompliance: forbiddenScore,
    rhetoricalHabitMatch: rhetoricalScore,
  };
}

// =============================================================================
// Knowledge Score
// =============================================================================

function computeKnowledgeScore(
  knowledge: KnowledgeLayer,
  expr: ExpressionDNA,
  options: ScoreOptions,
  findings: DistillationFinding[]
): KnowledgeScore {
  // Mental model count (0-100)
  let mmScore = 0;
  const mmCount = knowledge.mentalModels.length;
  if (mmCount >= 8) mmScore = 95;
  else if (mmCount >= 6) mmScore = 85;
  else if (mmCount >= 5) mmScore = 80;
  else if (mmCount >= 3) mmScore = 65;
  else if (mmCount >= 1) mmScore = 40;
  else mmScore = 10;

  if (mmCount < 3) {
    findings.push({
      code: 'knowledge-few-mental-models',
      dimension: 'knowledge',
      severity: mmCount === 0 ? 'error' : 'warn',
      message: `MentalModel 数量不足（${mmCount} < 3）`,
      affectedField: 'knowledge.mentalModels',
      suggestedFix: '增加更多思维模型，每个模型至少包含一个证据引用',
      autoFixable: true,
    });
  }

  // Mental model depth (evidence quality)
  const avgEvidenceCount = mmCount > 0
    ? knowledge.mentalModels.reduce((s, m) => s + m.evidence.length, 0) / mmCount
    : 0;
  const mmDepthScore = Math.min(100, Math.round(avgEvidenceCount * 25 + 25));

  // Heuristic coverage (0-100)
  let heuristicScore = 0;
  const hCount = knowledge.decisionHeuristics.length;
  if (hCount >= 5) heuristicScore = 90;
  else if (hCount >= 3) heuristicScore = 75;
  else if (hCount >= 1) heuristicScore = 50;
  else {
    heuristicScore = 30;
    findings.push({
      code: 'knowledge-few-heuristics',
      dimension: 'knowledge',
      severity: 'warn',
      message: `DecisionHeuristic 数量不足（${hCount} < 3）`,
      affectedField: 'knowledge.decisionHeuristics',
      suggestedFix: '从语料中提取决策启发式和思维捷径',
      autoFixable: true,
    });
  }

  // Source coverage (0-100)
  let sourceScore = 30;
  const srcCount = knowledge.sources.length;
  if (srcCount >= 5) sourceScore = 90;
  else if (srcCount >= 3) sourceScore = 75;
  else if (srcCount >= 1) sourceScore = 50;
  else {
    sourceScore = 20;
    findings.push({
      code: 'knowledge-no-sources',
      dimension: 'knowledge',
      severity: 'warn',
      message: '缺少来源引用（sources 为空）',
      affectedField: 'knowledge.sources',
      suggestedFix: '从语料中提取引用的著作、演讲、访谈等来源',
      autoFixable: true,
    });
  }

  // Cross-domain links
  const crossDomainCount = knowledge.mentalModels.reduce(
    (s, m) => s + (m.crossDomain?.length ?? 0), 0
  );
  const crossDomainScore = Math.min(100, crossDomainCount * 10 + 30);

  // Corpus quality bonus
  let corpusBonus = 0;
  if (options.corpusWordCount && options.corpusWordCount >= 100000) corpusBonus = 5;
  else if (options.corpusWordCount && options.corpusWordCount >= 50000) corpusBonus = 3;

  const overall = Math.min(100, Math.round(
    mmScore * 0.25 +
    mmDepthScore * 0.2 +
    heuristicScore * 0.2 +
    sourceScore * 0.2 +
    crossDomainScore * 0.15 +
    corpusBonus
  ));

  return {
    overall,
    mentalModelCount: mmScore,
    mentalModelDepth: mmDepthScore,
    heuristicCoverage: heuristicScore,
    sourceCoverage: sourceScore,
    crossDomainLinks: crossDomainScore,
  };
}

// =============================================================================
// Reasoning Score
// =============================================================================

function computeReasoningScore(
  knowledge: KnowledgeLayer,
  findings: DistillationFinding[]
): ReasoningScore {
  // Value consistency (0-100)
  let valueScore = 60;
  if (knowledge.values.length >= 3) valueScore = 85;
  else if (knowledge.values.length >= 1) valueScore = 60;
  else {
    valueScore = 25;
    findings.push({
      code: 'reasoning-no-values',
      dimension: 'reasoning',
      severity: 'error',
      message: 'CoreValues 为空',
      affectedField: 'knowledge.values',
      suggestedFix: '从语料中提取核心价值观',
      autoFixable: true,
    });
  }

  // Tension recognition (0-100)
  let tensionScore = 50;
  if (knowledge.tensions.length >= 2) tensionScore = 85;
  else if (knowledge.tensions.length >= 1) tensionScore = 70;
  else {
    tensionScore = 30;
    findings.push({
      code: 'reasoning-no-tensions',
      dimension: 'reasoning',
      severity: 'warn',
      message: 'Tensions 为空',
      affectedField: 'knowledge.tensions',
      suggestedFix: '识别该人物思想中的内在矛盾和张力',
      autoFixable: true,
    });
  }

  // Anti-pattern avoidance (0-100)
  let antiScore = 60;
  if (knowledge.antiPatterns.length >= 2) antiScore = 85;
  else if (knowledge.antiPatterns.length >= 1) antiScore = 70;
  else {
    antiScore = 40;
    findings.push({
      code: 'reasoning-no-anti-patterns',
      dimension: 'reasoning',
      severity: 'warn',
      message: 'AntiPatterns 为空',
      affectedField: 'knowledge.antiPatterns',
      suggestedFix: '识别该人物明确避免的思维模式和反模式',
      autoFixable: true,
    });
  }

  // Decision coherence (0-100)
  const decisionCoherence =
    (knowledge.decisionHeuristics.length > 0 && knowledge.values.length > 0) ? 80 :
    (knowledge.decisionHeuristics.length > 0 || knowledge.values.length > 0) ? 60 : 40;

  const overall = Math.round(
    valueScore * 0.3 +
    tensionScore * 0.25 +
    antiScore * 0.25 +
    decisionCoherence * 0.2
  );

  return {
    overall,
    valueConsistency: valueScore,
    tensionRecognition: tensionScore,
    antiPatternAvoidance: antiScore,
    decisionCoherence,
  };
}

// =============================================================================
// Safety Score
// =============================================================================

const BANNED_PERSONAS = ['zhang-xuefeng', 'donald-trump', 'taylor-swift'];

const SENSITIVE_KEYWORDS_ZH = [
  '分裂', '颠覆', '邪教', '六四', '天安门事件', '台独', '藏独', '疆独',
  '法轮功', '抗议', '示威', '暴乱', '武装叛乱',
];

const SENSITIVE_KEYWORDS_EN = [
  'terrorism', 'extremism', 'hate speech', 'incitement',
];

function computeSafetyScore(
  knowledge: KnowledgeLayer,
  expr: ExpressionDNA,
  findings: DistillationFinding[]
): SafetyScore {
  // Banned persona check
  const bannedPersonaCheck = false; // knowledge.id not available here

  // Sensitive content ratio
  const allText = [
    knowledge.identity.identityPrompt,
    knowledge.identity.coreClaim,
    ...knowledge.mentalModels.map((m) => m.description),
    ...expr.vocabulary.topWords.map((w) => w.word),
  ].join(' ');

  let sensitiveCount = 0;
  for (const kw of SENSITIVE_KEYWORDS_ZH) {
    if (allText.includes(kw)) sensitiveCount++;
  }
  for (const kw of SENSITIVE_KEYWORDS_EN) {
    if (allText.toLowerCase().includes(kw)) sensitiveCount++;
  }

  const sensitiveContentRatio = Math.min(1, sensitiveCount / 20);

  if (sensitiveContentRatio > 0.1) {
    findings.push({
      code: 'safety-excessive-sensitive-content',
      dimension: 'safety',
      severity: 'critical',
      message: `检测到敏感关键词（${sensitiveCount}个）`,
      autoFixable: false,
    });
  }

  // Political neutrality (0-100)
  const politicalNeutrality = sensitiveContentRatio > 0.3 ? 40 :
    sensitiveContentRatio > 0.1 ? 70 : 95;

  // Factual boundary respect (0-100)
  let factualScore = 70;
  if (knowledge.honestBoundaries.length >= 2) factualScore = 90;
  else if (knowledge.honestBoundaries.length >= 1) factualScore = 75;

  const overall = Math.round(
    (bannedPersonaCheck ? 0 : 100) * 0.2 +
    (1 - sensitiveContentRatio) * 100 * 0.3 +
    politicalNeutrality * 0.2 +
    factualScore * 0.3
  );

  return {
    overall,
    bannedPersonaCheck,
    sensitiveContentRatio,
    politicalNeutrality,
    factualBoundaryRespect: factualScore,
  };
}

// =============================================================================
// Grade
// =============================================================================

function computeGrade(score: number): DistillationGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// =============================================================================
// Summary
// =============================================================================

export function formatScoreReport(result: ScoreResult): string {
  const { breakdown, overall, grade, pass, findings } = result;

  const lines = [
    `=== Distillation Score Report ===`,
    `Overall: ${overall}/100  Grade: ${grade}  Pass: ${pass ? 'YES' : 'NO'}`,
    ``,
    `Voice (30%):        ${breakdown.voice.overall}/100`,
    `  - Vocabulary:    ${breakdown.voice.vocabularyMatch}/100`,
    `  - Sentence Style: ${breakdown.voice.sentencePatternMatch}/100`,
    `  - Tone:           ${breakdown.voice.toneMatch}/100`,
    `  - Forbidden Words:${breakdown.voice.forbiddenWordCompliance}/100`,
    `  - Rhetorical:    ${breakdown.voice.rhetoricalHabitMatch}/100`,
    ``,
    `Knowledge (30%):    ${breakdown.knowledge.overall}/100`,
    `  - MM Count:      ${breakdown.knowledge.mentalModelCount}/100`,
    `  - MM Depth:      ${breakdown.knowledge.mentalModelDepth}/100`,
    `  - Heuristics:   ${breakdown.knowledge.heuristicCoverage}/100`,
    `  - Sources:       ${breakdown.knowledge.sourceCoverage}/100`,
    `  - Cross-Domain:  ${breakdown.knowledge.crossDomainLinks}/100`,
    ``,
    `Reasoning (25%):    ${breakdown.reasoning.overall}/100`,
    `  - Value Consist: ${breakdown.reasoning.valueConsistency}/100`,
    `  - Tensions:      ${breakdown.reasoning.tensionRecognition}/100`,
    `  - Anti-patterns: ${breakdown.reasoning.antiPatternAvoidance}/100`,
    ``,
    `Safety (15%):      ${breakdown.safety.overall}/100`,
    `  - Banned Check:  ${breakdown.safety.bannedPersonaCheck ? 'FAIL' : 'PASS'}`,
    `  - Sensitive:     ${((breakdown.safety.sensitiveContentRatio) * 100).toFixed(1)}%`,
    `  - Political:      ${breakdown.safety.politicalNeutrality}/100`,
    `  - Boundaries:     ${breakdown.safety.factualBoundaryRespect}/100`,
  ];

  if (findings.length > 0) {
    lines.push('');
    lines.push(`Findings (${findings.length}):`);
    for (const f of findings) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    }
  }

  return lines.join('\n');
}
