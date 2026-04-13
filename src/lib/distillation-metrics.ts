/**
 * Prismatic — Distillation Metrics
 * AgentShield 风格的蒸馏质量评分体系
 *
 * 四个核心评分维度：
 * 1. VoiceFidelity — 表达DNA还原度
 * 2. KnowledgeDepth — 知识覆盖深度
 * 3. ReasoningPattern — 思维模式一致性
 * 4. SafetyCompliance — 安全合规性
 */

import type {
  Persona,
  DistillationScore,
  ScoreFinding,
  ScoreGrade,
  ScoreBreakdown,
  ScoreFinding as Finding,
  VoiceFidelityMetrics,
  KnowledgeDepthMetrics,
  ReasoningPatternMetrics,
  SafetyComplianceMetrics,
  FindingSeverity,
  FindingCategory,
} from './types';
import { PERSONA_CONFIDENCE } from './confidence';
import type { ConfidenceScore } from './confidence';

// ─── Threshold Constants ────────────────────────────────────────────────────────

const PASS_THRESHOLD = 60;
const A_THRESHOLD = 90;
const B_THRESHOLD = 75;
const C_THRESHOLD = 60;
const D_THRESHOLD = 45;

const VOICE_WEIGHT = 0.3;
const KNOWLEDGE_WEIGHT = 0.3;
const REASONING_WEIGHT = 0.25;
const SAFETY_WEIGHT = 0.15;

// ─── Grade Helpers ────────────────────────────────────────────────────────────

export function scoreToGrade(score: number): ScoreGrade {
  if (score >= A_THRESHOLD) return 'A';
  if (score >= B_THRESHOLD) return 'B';
  if (score >= C_THRESHOLD) return 'C';
  if (score >= D_THRESHOLD) return 'D';
  return 'F';
}

export function starRating(overall: number): 1 | 2 | 3 | 4 | 5 {
  if (overall >= 90) return 5;
  if (overall >= 75) return 4;
  if (overall >= 60) return 3;
  if (overall >= 45) return 2;
  return 1;
}

// ─── 1. Voice Fidelity Score ────────────────────────────────────────────────────

export function calculateVoiceFidelity(
  persona: Persona,
  corpusSample?: string
): { score: number; metrics: VoiceFidelityMetrics; findings: ScoreFinding[] } {
  const findings: ScoreFinding[] = [];
  const dna = persona.expressionDNA;

  // 词汇匹配度：检查禁用词
  const forbiddenInCorpus = dna.forbiddenWords.filter(w => corpusSample?.includes(w));
  const forbiddenAvoidance = Math.max(0, 100 - forbiddenInCorpus.length * 10);

  // 句式风格匹配
  const sentenceStyleCount = dna.sentenceStyle.length;
  const vocabularyCount = dna.vocabulary.length;
  const voiceScore = Math.min(100,
    (sentenceStyleCount * 8) +
    (vocabularyCount * 3) +
    (dna.rhythm ? 10 : 0) +
    (dna.quotePatterns.length * 5) +
    forbiddenAvoidance
  );

  if (dna.vocabulary.length === 0) {
    findings.push({
      id: 'voice-no-vocabulary',
      severity: 'high',
      category: 'voice',
      title: '缺少词汇指纹',
      description: 'ExpressionDNA.vocabulary 为空，缺少特征词汇列表',
      location: 'expressionDNA.vocabulary',
      fixSuggestion: '从语料库中提取 top 50 特征词，并标注禁用词',
      autoFixable: false,
    });
  }

  if (dna.sentenceStyle.length === 0) {
    findings.push({
      id: 'voice-no-sentence-style',
      severity: 'medium',
      category: 'voice',
      title: '缺少句式风格描述',
      description: 'ExpressionDNA.sentenceStyle 为空，无法评估句式特征',
      location: 'expressionDNA.sentenceStyle',
      fixSuggestion: '添加 3-5 种标志性句式（如"我认为……"、"让我来回答……"）',
      autoFixable: false,
    });
  }

  if (dna.forbiddenWords.length === 0) {
    findings.push({
      id: 'voice-no-forbidden-words',
      severity: 'info',
      category: 'voice',
      title: '未定义禁用词',
      description: 'ExpressionDNA.forbiddenWords 为空，建议明确该人物不会使用的词汇',
      location: 'expressionDNA.forbiddenWords',
      fixSuggestion: '添加该人物不会使用的词汇（如 Elon Musk 不会说"我认为这是个坏主意"这种温和表达）',
      autoFixable: false,
    });
  }

  const metrics: VoiceFidelityMetrics = {
    vocabularyMatch: Math.min(100, vocabularyCount * 5),
    sentencePatternMatch: Math.min(100, sentenceStyleCount * 12),
    toneTrajectoryMatch: dna.certaintyLevel ? 80 : 50,
    forbiddenWordAvoidance: forbiddenAvoidance,
    rhetoricalHabitMatch: dna.rhetoricalHabit ? 75 : 40,
  };

  return {
    score: Math.round(Math.min(100, voiceScore)),
    metrics,
    findings,
  };
}

// ─── 2. Knowledge Depth Score ───────────────────────────────────────────────────

export function calculateKnowledgeDepth(
  persona: Persona,
  confidence?: ConfidenceScore
): { score: number; metrics: KnowledgeDepthMetrics; findings: ScoreFinding[] } {
  const findings: ScoreFinding[] = [];

  // 思维模型覆盖率
  const mentalModelCount = persona.mentalModels.length;
  const mentalModelCoverage = Math.min(100, mentalModelCount * 8);

  // 决策启发式覆盖率
  const heuristicCount = persona.decisionHeuristics.length;
  const heuristicCoverage = Math.min(100, heuristicCount * 10);

  // 来源覆盖度（基于 confidence data）
  let sourceCoverage = 70;
  let timeSpanCoverage = 70;
  if (confidence) {
    sourceCoverage = confidence.sourceVerifiability;
    timeSpanCoverage = confidence.timeSpan;
  }

  // 跨域链接数
  let crossDomainLinks = 0;
  for (const model of persona.mentalModels) {
    crossDomainLinks += model.crossDomain.length;
  }
  const crossDomainScore = Math.min(100, crossDomainLinks * 5);

  // 综合评分
  const score = Math.round(
    mentalModelCoverage * 0.3 +
    heuristicCoverage * 0.25 +
    sourceCoverage * 0.2 +
    timeSpanCoverage * 0.15 +
    crossDomainScore * 0.1
  );

  if (mentalModelCount < 3) {
    findings.push({
      id: 'knowledge-few-mental-models',
      severity: 'medium',
      category: 'knowledge',
      title: '思维模型数量偏少',
      description: `仅定义了 ${mentalModelCount} 个思维模型，建议至少 5-10 个核心模型`,
      location: 'mentalModels',
      fixSuggestion: '补充该人物常用的思维框架（如"第一性原理"、"逆向思维"等）',
      autoFixable: false,
    });
  }

  if (heuristicCount < 2) {
    findings.push({
      id: 'knowledge-few-heuristics',
      severity: 'medium',
      category: 'knowledge',
      title: '决策启发式不足',
      description: `仅定义了 ${heuristicCount} 个决策启发式`,
      location: 'decisionHeuristics',
      fixSuggestion: '补充该人物的标志性决策模式（如 Charlie Munger 的"逆向思考"）',
      autoFixable: false,
    });
  }

  if (persona.sources.length === 0) {
    findings.push({
      id: 'knowledge-no-sources',
      severity: 'critical',
      category: 'knowledge',
      title: '缺少引用来源',
      description: 'Persona.sources 为空，无法验证知识来源的可信度',
      location: 'sources',
      fixSuggestion: '添加该人物的著作、访谈、演讲等来源信息',
      autoFixable: false,
    });
  }

  const metrics: KnowledgeDepthMetrics = {
    mentalModelCoverage,
    heuristicCoverage,
    sourceCoverage,
    timeSpanCoverage,
    crossDomainLinks,
  };

  return { score, metrics, findings };
}

// ─── 3. Reasoning Pattern Score ─────────────────────────────────────────────────

export function calculateReasoningPattern(
  persona: Persona
): { score: number; metrics: ReasoningPatternMetrics; findings: ScoreFinding[] } {
  const findings: ScoreFinding[] = [];

  // 价值观一致性：核心价值观是否有明确的优先级
  const valueCount = persona.values.length;
  const valueConsistency = Math.min(100, valueCount * 15);

  // 张力识别：对立价值观的处理
  const tensionCount = persona.tensions.length;
  const tensionScore = Math.min(100, tensionCount * 20);

  // 反模式：是否定义了不应做的事
  const antiPatternCount = persona.antiPatterns.length;
  const antiPatternScore = Math.min(100, antiPatternCount * 12);

  // 决策框架连贯性：是否有清晰的决策流程
  const hasDecisionFlow = persona.decisionHeuristics.length > 0;
  const decisionCoherence = hasDecisionFlow ? 75 : 50;

  const score = Math.round(
    valueConsistency * 0.3 +
    tensionScore * 0.25 +
    antiPatternScore * 0.25 +
    decisionCoherence * 0.2
  );

  if (valueCount === 0) {
    findings.push({
      id: 'reasoning-no-values',
      severity: 'high',
      category: 'reasoning',
      title: '缺少核心价值观',
      description: 'Persona.values 为空，无法评估价值观一致性',
      location: 'values',
      fixSuggestion: '添加 3-5 个核心价值观，并标注优先级',
      autoFixable: false,
    });
  }

  if (tensionCount === 0) {
    findings.push({
      id: 'reasoning-no-tensions',
      severity: 'low',
      category: 'reasoning',
      title: '缺少认知张力描述',
      description: 'Persona.tensions 为空，建议补充该人物的内在矛盾或思想张力',
      location: 'tensions',
      fixSuggestion: '补充该人物的内在矛盾（如"追求卓越 vs 重视家庭"）',
      autoFixable: false,
    });
  }

  if (antiPatternCount === 0) {
    findings.push({
      id: 'reasoning-no-anti-patterns',
      severity: 'medium',
      category: 'reasoning',
      title: '缺少反模式定义',
      description: 'Persona.antiPatterns 为空，建议明确该人物的思维禁区',
      location: 'antiPatterns',
      fixSuggestion: '添加 2-3 个该人物会避免的思维或行为模式',
      autoFixable: false,
    });
  }

  const metrics: ReasoningPatternMetrics = {
    valueConsistency,
    tensionRecognition: tensionScore,
    antiPatternAvoidance: antiPatternScore,
    decisionFrameworkCoherence: decisionCoherence,
  };

  return { score, metrics, findings };
}

// ─── 4. Safety Compliance Score ────────────────────────────────────────────────

const BANNED_PERSONAS = ['zhang-xuefeng', 'donald-trump', 'taylor-swift'];
const SENSITIVE_KEYWORDS = [
  '暴力', '杀人', '恐怖', '色情', '毒品',
  '政治', '台独', '港独', '藏独', '疆独',
  '邪教', '颠覆',
];

export function calculateSafetyCompliance(
  persona: Persona
): { score: number; metrics: SafetyComplianceMetrics; findings: ScoreFinding[] } {
  const findings: ScoreFinding[] = [];

  // 检查是否为禁用人物
  const isBannedPersona = BANNED_PERSONAS.includes(persona.id);

  // 有害内容检测
  let harmfulContentCount = 0;
  const contentStr = JSON.stringify(persona);
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (contentStr.includes(keyword)) harmfulContentCount++;
  }
  const harmfulContentScore = isBannedPersona
    ? 20
    : Math.max(0, 100 - harmfulContentCount * 15);

  // 敏感人物排除
  const sensitiveExclusionScore = isBannedPersona ? 0 : 100;

  // 政治中立性
  const hasPoliticalNeutrality = persona.tensions.every(t =>
    !t.description.includes('政治') && !t.description.includes('党派')
  );
  const politicalNeutralityScore = hasPoliticalNeutrality ? 100 : 60;

  // 诚实边界
  const honestBoundaryCount = persona.honestBoundaries.length;
  const factualAccuracy = Math.min(100, 60 + honestBoundaryCount * 10);

  const score = Math.round(
    harmfulContentScore * 0.35 +
    sensitiveExclusionScore * 0.25 +
    politicalNeutralityScore * 0.25 +
    factualAccuracy * 0.15
  );

  if (isBannedPersona) {
    findings.push({
      id: 'safety-banned-persona',
      severity: 'critical',
      category: 'safety',
      title: '人物已被禁用',
      description: `${persona.nameZh} 已被标记为敏感人物，不应用于辩论和对话`,
      location: 'persona.id',
      fixSuggestion: '将此类人物排除在所有活动之外，或仅作为背景参考',
      autoFixable: false,
    });
  }

  if (harmfulContentCount > 3) {
    findings.push({
      id: 'safety-excessive-sensitive-content',
      severity: 'high',
      category: 'safety',
      title: '内容包含敏感关键词',
      description: `检测到 ${harmfulContentCount} 个敏感关键词`,
      location: 'content (全文)',
      fixSuggestion: '审查并移除所有敏感内容，替换为中性表达',
      autoFixable: false,
    });
  }

  if (honestBoundaryCount === 0) {
    findings.push({
      id: 'safety-no-honest-boundaries',
      severity: 'low',
      category: 'safety',
      title: '缺少诚实边界定义',
      description: 'Persona.honestBoundaries 为空，建议明确该人物的知识盲区',
      location: 'honestBoundaries',
      fixSuggestion: '添加该人物坦诚承认自己不知道或不确定的领域',
      autoFixable: false,
    });
  }

  const metrics: SafetyComplianceMetrics = {
    harmfulContentDetection: harmfulContentScore,
    sensitivePersonExclusion: sensitiveExclusionScore,
    politicalNeutrality: politicalNeutralityScore,
    factualAccuracy,
  };

  return { score, metrics, findings };
}

// ─── Main Scoring Engine ────────────────────────────────────────────────────────

export function calculateDistillationScore(
  persona: Persona,
  corpusSample?: string,
  modelUsed: string = 'deepseek-chat'
): DistillationScore {
  const confidence = PERSONA_CONFIDENCE[persona.id];

  const { score: voiceScore, metrics: voiceMetrics, findings: voiceFindings } =
    calculateVoiceFidelity(persona, corpusSample);

  const { score: knowledgeScore, metrics: knowledgeMetrics, findings: knowledgeFindings } =
    calculateKnowledgeDepth(persona, confidence);

  const { score: reasoningScore, metrics: reasoningMetrics, findings: reasoningFindings } =
    calculateReasoningPattern(persona);

  const { score: safetyScore, metrics: safetyMetrics, findings: safetyFindings } =
    calculateSafetyCompliance(persona);

  const allFindings = [...voiceFindings, ...knowledgeFindings, ...reasoningFindings, ...safetyFindings];

  const breakdown: ScoreBreakdown = {
    voiceFidelity: voiceScore,
    knowledgeDepth: knowledgeScore,
    reasoningPattern: reasoningScore,
    safetyCompliance: safetyScore,
  };

  const overall = Math.round(
    voiceScore * VOICE_WEIGHT +
    knowledgeScore * KNOWLEDGE_WEIGHT +
    reasoningScore * REASONING_WEIGHT +
    safetyScore * SAFETY_WEIGHT
  );

  const grade = scoreToGrade(overall);
  const thresholdPassed = overall >= PASS_THRESHOLD;

  // Token 估算（基于 persona 结构大小）
  const promptTokens = Math.round(JSON.stringify(persona).length / 4);
  const completionTokens = Math.round(allFindings.length * 50 + 200);
  const totalTokens = promptTokens + completionTokens;

  return {
    overall,
    grade,
    breakdown,
    findings: allFindings,
    starRating: starRating(overall),
    thresholdPassed,
    timestamp: new Date(),
    modelUsed,
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
  };
}

// ─── Report Helpers ─────────────────────────────────────────────────────────────

export function formatScoreReport(score: DistillationScore, persona: Persona): string {
  const lines = [
    `═══════════════════════════════════════`,
    `  蒸馏评分报告 — ${persona.nameZh}`,
    `═══════════════════════════════════════`,
    ``,
    `  总体评分: ${score.overall}/100  [${score.grade}]  ⭐${score.starRating}`,
    `  通过阈值: ${score.thresholdPassed ? '✓ 是' : '✗ 否'}`,
    ``,
    `  维度评分:`,
    `    声音还原度     ${renderBar(score.breakdown.voiceFidelity)}  ${score.breakdown.voiceFidelity}`,
    `    知识覆盖深度   ${renderBar(score.breakdown.knowledgeDepth)}  ${score.breakdown.knowledgeDepth}`,
    `    思维模式一致性 ${renderBar(score.breakdown.reasoningPattern)}  ${score.breakdown.reasoningPattern}`,
    `    安全合规性     ${renderBar(score.breakdown.safetyCompliance)}  ${score.breakdown.safetyCompliance}`,
    ``,
    `  问题发现 (${score.findings.length} 项):`,
  ];

  const bySeverity = groupFindingsBySeverity(score.findings);
  for (const [severity, findings] of Object.entries(bySeverity)) {
    const icon = severityIcon(severity as FindingSeverity);
    for (const f of findings) {
      lines.push(`    ${icon} [${severity.toUpperCase()}] ${f.title}`);
      lines.push(`      → ${f.fixSuggestion}`);
    }
  }

  lines.push(``);
  lines.push(`  Token 使用: ${score.tokenUsage.totalTokens.toLocaleString()}`);
  lines.push(`  评估时间: ${score.timestamp.toISOString()}`);
  lines.push(`═══════════════════════════════════════`);
  return lines.join('\n');
}

function renderBar(score: number, width: number = 10): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function groupFindingsBySeverity(findings: ScoreFinding[]): Record<string, ScoreFinding[]> {
  const groups: Record<string, ScoreFinding[]> = {};
  for (const f of findings) {
    if (!groups[f.severity]) groups[f.severity] = [];
    groups[f.severity].push(f);
  }
  return groups;
}

function severityIcon(severity: FindingSeverity): string {
  const icons: Record<string, string> = {
    critical: '💀',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    info: '🔵',
  };
  return icons[severity] ?? '•';
}

export function getTopFindings(
  score: DistillationScore,
  limit: number = 5
): ScoreFinding[] {
  const severityOrder: Record<FindingSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  return [...score.findings]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, limit);
}

export function getAutoFixableFindings(score: DistillationScore): ScoreFinding[] {
  return score.findings.filter(f => f.autoFixable);
}
