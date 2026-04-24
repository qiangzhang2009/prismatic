/**
 * Prismatic — Semantic Validation (Gate 4)
 *
 * Validates semantic consistency across the distillation output:
 * 1. Evidence-Relevance Check     — evidence quotes match the mental model claim
 * 2. Expression-Knowledge Check   — expression vocabulary aligns with knowledge topics
 * 3. Cross-Layer Consistency     — values, tensions, strengths form a coherent whole
 * 4. Chinese Completeness Check    — all bilingual fields are non-empty
 *
 * This is a heuristic validator (no LLM required). For deep semantic checking
 * with actual LLM reasoning, see the wiki-lint.ts corpus-level validation.
 */

import type {
  KnowledgeLayer,
  ExpressionLayer,
  ExtractedMentalModel,
  ExtractedValue,
  ExtractedTension,
} from './distillation-v4-types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SemanticValidationFinding {
  type: 'error' | 'warning' | 'info';
  check: SemanticCheckName;
  location: string;
  description: string;
  evidence?: string;
  autoFixable: boolean;
}

export type SemanticCheckName =
  | 'evidence_relevance'
  | 'evidence_source_missing'
  | 'vocabulary_knowledge_mismatch'
  | 'vocabulary_empty'
  | 'value_tension_incoherence'
  | 'chinese_field_missing'
  | 'chinese_field_empty'
  | 'strength_blindspot_redundancy'
  | 'mental_model_overlap'
  | 'cross_layer_topical_gap';

export interface SemanticValidationReport {
  personaId: string;
  timestamp: string;
  checks: {
    evidenceRelevance: EvidenceRelevanceResult;
    expressionKnowledgeAlignment: ExpressionKnowledgeResult;
    crossLayerConsistency: CrossLayerResult;
    bilingualCompleteness: BilingualResult;
  };
  findings: SemanticValidationFinding[];
  overallScore: number;     // 0-100
  result: 'pass' | 'warning' | 'fail';
  suggestions: string[];
}

interface EvidenceRelevanceResult {
  passed: boolean;
  score: number;       // 0-100
  mentalModelsChecked: number;
  issuesFound: number;
}

interface ExpressionKnowledgeResult {
  passed: boolean;
  score: number;
  vocabularySize: number;
  alignedCount: number;
  issuesFound: number;
}

interface CrossLayerResult {
  passed: boolean;
  score: number;
  valueCount: number;
  tensionCount: number;
  coherenceRatio: number;
  issuesFound: number;
}

interface BilingualResult {
  passed: boolean;
  score: number;
  totalBilingualFields: number;
  missingCount: number;
  emptyCount: number;
}

// ─── Helper: Extract keywords from a text ───────────────────────────────────

const ZH_CHARS = /[\u4e00-\u9fff]/;
const ZH_BIGRAMS = /(?:[\u4e00-\u9fff]{2})+/g;
const EN_WORDS = /[a-zA-Z]{3,}/g;

function extractTextKeywords(text: string): string[] {
  const keywords = new Set<string>();
  // Chinese bigrams
  const zhMatches = text.match(ZH_BIGRAMS) ?? [];
  for (const match of zhMatches) {
    keywords.add(match);
  }
  // English words
  const enMatches = text.match(EN_WORDS) ?? [];
  for (const word of enMatches) {
    keywords.add(word.toLowerCase());
  }
  return [...keywords];
}

function computeKeywordOverlap(textA: string, textB: string, minMatch = 1): number {
  const kwA = new Set(extractTextKeywords(textA));
  const kwB = new Set(extractTextKeywords(textB));
  let matches = 0;
  for (const kw of kwA) {
    if (kwB.has(kw)) matches++;
  }
  return matches;
}

// ─── Check 1: Evidence Relevance ────────────────────────────────────────────

function checkEvidenceRelevance(
  mentalModels: ExtractedMentalModel[]
): { result: EvidenceRelevanceResult; findings: SemanticValidationFinding[] } {
  const findings: SemanticValidationFinding[] = [];
  let modelsWithIssues = 0;

  for (const mm of mentalModels) {
    // Check 1a: Missing evidence
    if (!mm.evidence || mm.evidence.length === 0) {
      findings.push({
        type: 'error',
        check: 'evidence_source_missing',
        location: `mentalModel:${mm.name}`,
        description: `${mm.name} 缺少引用证据 (evidence)`,
        autoFixable: false,
      });
      modelsWithIssues++;
      continue;
    }

    // Check 1b: Evidence-topic overlap — does the quote relate to the MM claim?
    const claimText = `${mm.oneLiner} ${mm.application} ${mm.name}`.toLowerCase();
    let relevantEvidence = 0;

    for (const ev of mm.evidence) {
      if (!ev.quote || ev.quote.length < 20) {
        findings.push({
          type: 'warning',
          check: 'evidence_relevance',
          location: `mentalModel:${mm.name}`,
          description: `证据过短 (<20字符)，可能无法判断相关性`,
          evidence: ev.quote?.slice(0, 100),
          autoFixable: true,
        });
        continue;
      }

      // Heuristic: check if evidence contains at least one keyword from the claim
      const claimKeywords = new Set(extractTextKeywords(claimText));
      const evidenceKeywords = new Set(extractTextKeywords(ev.quote));
      const overlap = [...claimKeywords].filter(k => evidenceKeywords.has(k)).length;

      if (overlap < 1 && [...claimKeywords].length > 3) {
        findings.push({
          type: 'warning',
          check: 'evidence_relevance',
          location: `mentalModel:${mm.name}`,
          description: `证据与思维模型标题 "${mm.name}" 缺乏关键词重叠，可能不相关`,
          evidence: ev.quote.slice(0, 150),
          autoFixable: false,
        });
      } else {
        relevantEvidence++;
      }
    }

    // All evidence irrelevant = error
    if (relevantEvidence === 0 && mm.evidence.length > 0) {
      modelsWithIssues++;
    }
  }

  const score = mentalModels.length > 0
    ? Math.round(((mentalModels.length - modelsWithIssues) / mentalModels.length) * 100)
    : 100;

  const result: EvidenceRelevanceResult = {
    passed: score >= 70,
    score,
    mentalModelsChecked: mentalModels.length,
    issuesFound: findings.filter(f => f.check === 'evidence_relevance' || f.check === 'evidence_source_missing').length,
  };

  return { result, findings };
}

// ─── Check 2: Expression-Knowledge Alignment ────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  philosophy: ['philosophy', 'philosophical', 'truth', 'knowledge', 'meaning', 'language', 'ethics', 'morality', 'virtue', 'logic', 'reason', 'mind', 'concept', 'proposition', '思想', '哲学', '真理', '伦理', '逻辑', '理性', '概念'],
  science: ['experiment', 'theory', 'hypothesis', 'physics', 'mathematics', 'biology', 'quantum', 'relativity', 'energy', 'matter', 'law', 'principle', 'experiment', '观察', '理论', '假设', '物理', '数学', '实验'],
  business: ['business', 'investment', 'market', 'company', 'capital', 'profit', 'risk', 'strategy', 'management', 'entrepreneur', '竞争', '投资', '市场', '资本', '利润', '风险', '战略', '管理'],
  spirituality: ['spirit', 'soul', 'enlightenment', 'meditation', 'wisdom', 'compassion', 'dharma', 'tao', 'zen', '灵魂', '觉悟', '冥想', '智慧', '慈悲', '道', '禅'],
  military: ['war', 'strategy', 'tactics', 'enemy', 'victory', 'defeat', 'army', 'battle', 'command', '战争', '战略', '战术', '敌人', '胜利', '失败', '军队', '战役'],
  history: ['dynasty', 'emperor', 'empire', 'reign', 'dynastic', 'chronicle', '王朝', '帝国', '皇帝', '统治', '编年'],
  literature: ['story', 'character', 'narrative', 'plot', 'theme', 'poetry', 'hero', '故事', '人物', '情节', '主题', '诗歌', '英雄'],
};

function inferDomainFromMM(mentalModels: ExtractedMentalModel[]): string {
  const allText = mentalModels.flatMap(mm => [
    mm.name, mm.nameZh, mm.oneLiner, mm.oneLinerZh, mm.application, mm.applicationZh,
    ...mm.crossDomain,
  ]).join(' ').toLowerCase();

  let bestDomain = 'philosophy';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = keywords.filter(kw => allText.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

function checkExpressionKnowledgeAlignment(
  knowledge: KnowledgeLayer,
  expression: ExpressionLayer
): { result: ExpressionKnowledgeResult; findings: SemanticValidationFinding[] } {
  const findings: SemanticValidationFinding[] = [];

  // Empty vocabulary
  if (!expression.vocabulary || expression.vocabulary.length === 0) {
    findings.push({
      type: 'error',
      check: 'vocabulary_empty',
      location: 'expression.vocabulary',
      description: 'ExpressionDNA vocabulary 为空 — L4 提取层可能失败',
      autoFixable: true,
    });
    return {
      result: { passed: false, score: 0, vocabularySize: 0, alignedCount: 0, issuesFound: 1 },
      findings,
    };
  }

  // Infer domain from knowledge layer
  const domain = inferDomainFromMM(knowledge.mentalModels);
  const domainKeywords = new Set(TOPIC_KEYWORDS[domain] ?? []);

  // Check vocabulary alignment with domain
  let alignedCount = 0;
  for (const vocab of expression.vocabulary) {
    const vocabKws = extractTextKeywords(vocab);
    const hasDomainMatch = [...vocabKws].some(kw => domainKeywords.has(kw.toLowerCase()));
    if (hasDomainMatch) alignedCount++;
  }

  const alignmentRatio = expression.vocabulary.length > 0
    ? alignedCount / expression.vocabulary.length
    : 0;

  const score = Math.round(alignmentRatio * 100);

  if (alignmentRatio < 0.3) {
    findings.push({
      type: 'warning',
      check: 'vocabulary_knowledge_mismatch',
      location: 'expression.vocabulary',
      description: `ExpressionDNA vocabulary 与知识层领域 "${domain}" 匹配率仅 ${(alignmentRatio * 100).toFixed(0)}% (<30%)。vocabulary 可能不反映该 persona 的真实表达风格。`,
      autoFixable: true,
    });
  }

  return {
    result: {
      passed: score >= 30 && expression.vocabulary.length >= 5,
      score,
      vocabularySize: expression.vocabulary.length,
      alignedCount,
      issuesFound: findings.length,
    },
    findings,
  };
}

// ─── Check 3: Cross-Layer Consistency ──────────────────────────────────────

function checkCrossLayerConsistency(
  knowledge: KnowledgeLayer
): { result: CrossLayerResult; findings: SemanticValidationFinding[] } {
  const findings: SemanticValidationFinding[] = [];

  const values = knowledge.values;
  const tensions = knowledge.tensions;
  const strengths = knowledge.strengths;
  const blindspots = knowledge.blindspots;

  // Check 3a: Strength-Blindspot redundancy
  if (strengths.length > 0 && blindspots.length > 0) {
    for (const strength of strengths.slice(0, 3)) {
      const strengthKws = new Set(extractTextKeywords(strength));
      for (const blindspot of blindspots.slice(0, 3)) {
        const blindspotKws = new Set(extractTextKeywords(blindspot));
        const overlap = [...strengthKws].filter(k => blindspotKws.has(k)).length;
        if (overlap >= 2) {
          findings.push({
            type: 'warning',
            check: 'strength_blindspot_redundancy',
            location: `strengths[${strength}] ↔ blindspots[${blindspot}]`,
            description: `Strength "${strength}" 和 Blindspot "${blindspot}" 关键词高度重叠，可能缺乏区分度`,
            autoFixable: true,
          });
        }
      }
    }
  }

  // Check 3b: Value-Tension coherence — tensions should relate to values
  let tensionValueOverlap = 0;
  for (const tension of tensions) {
    const tensionKws = new Set(extractTextKeywords(`${tension.tension} ${tension.positivePole} ${tension.negativePole}`));
    let foundConnection = false;
    for (const value of values) {
      const valueKws = new Set(extractTextKeywords(value.name + ' ' + value.description));
      const overlap = [...tensionKws].filter(k => valueKws.has(k)).length;
      if (overlap >= 1) {
        foundConnection = true;
        break;
      }
    }
    if (foundConnection) tensionValueOverlap++;
  }

  const coherenceRatio = tensions.length > 0 ? tensionValueOverlap / tensions.length : 1;
  if (coherenceRatio < 0.5 && tensions.length >= 3) {
    findings.push({
      type: 'warning',
      check: 'value_tension_incoherence',
      location: 'knowledge.values / knowledge.tensions',
      description: `仅 ${tensionValueOverlap}/${tensions.length} 个张力与价值观有关联，价值观-张力一致性 ${(coherenceRatio * 100).toFixed(0)}%`,
      autoFixable: false,
    });
  }

  // Check 3c: Topical gap — do mental models cover distinct topics?
  const mmText = knowledge.mentalModels.map(m => `${m.name} ${m.crossDomain.join(' ')}`).join(' ');
  const domainOverlap = computeKeywordOverlap(mmText, mmText);
  if (knowledge.mentalModels.length >= 5) {
    // Heuristic: if all MMs share the same top domain keyword, might be redundant
    const topKws = [...new Set(extractTextKeywords(mmText))].slice(0, 20);
    let maxKwCount = 0;
    for (const kw of topKws) {
      const count = knowledge.mentalModels.filter(m =>
        `${m.name} ${m.crossDomain.join(' ')}`.includes(kw)
      ).length;
      if (count > maxKwCount) maxKwCount = count;
    }
    const concentration = maxKwCount / knowledge.mentalModels.length;
    if (concentration > 0.8) {
      findings.push({
        type: 'info',
        check: 'mental_model_overlap',
        location: 'knowledge.mentalModels',
        description: `${maxKwCount}/${knowledge.mentalModels.length} 个思维模型共享同一关键词领域，可能存在主题重叠`,
        autoFixable: false,
      });
    }
  }

  const score = Math.round(coherenceRatio * 100);
  return {
    result: {
      passed: coherenceRatio >= 0.5 || tensions.length === 0,
      score,
      valueCount: values.length,
      tensionCount: tensions.length,
      coherenceRatio,
      issuesFound: findings.length,
    },
    findings,
  };
}

// ─── Check 4: Bilingual Completeness ─────────────────────────────────────────

type BilingualField = {
  path: string;
  zhField?: string;
  zhValue?: string;
  enField?: string;
  enValue?: string;
};

function checkBilingualCompleteness(
  knowledge: KnowledgeLayer,
  expression: ExpressionLayer
): { result: BilingualResult; findings: SemanticValidationFinding[] } {
  const findings: SemanticValidationFinding[] = [];
  let totalFields = 0;
  let missingZh = 0;
  let emptyZh = 0;

  // Check knowledge layer bilingual fields
  const checkField = (
    location: string,
    enValue: string | undefined,
    zhValue: string | undefined,
    label: string
  ) => {
    totalFields++;
    if (zhValue === undefined || zhValue === null) {
      missingZh++;
      findings.push({
        type: 'error',
        check: 'chinese_field_missing',
        location,
        description: `${label} 中文版本缺失 (${location})`,
        autoFixable: true,
      });
    } else if (typeof zhValue === 'string' && zhValue.trim().length === 0) {
      emptyZh++;
      findings.push({
        type: 'error',
        check: 'chinese_field_empty',
        location,
        description: `${label} 中文版本为空字符串 (${location})`,
        autoFixable: true,
      });
    }
  };

  // Knowledge layer: values
  for (let i = 0; i < knowledge.values.length; i++) {
    const v = knowledge.values[i];
    checkField(`knowledge.values[${i}].nameZh`, v.name, v.nameZh, `价值观[${i}]`);
    checkField(`knowledge.values[${i}].descriptionZh`, v.description, v.descriptionZh, `价值观[${i}].description`);
  }

  // Knowledge layer: tensions
  for (let i = 0; i < knowledge.tensions.length; i++) {
    const t = knowledge.tensions[i];
    checkField(`knowledge.tensions[${i}].tensionZh`, t.tension, t.tensionZh, `张力[${i}].tension`);
    checkField(`knowledge.tensions[${i}].descriptionZh`, t.description, t.descriptionZh, `张力[${i}].description`);
  }

  // Knowledge layer: mental models
  for (let i = 0; i < knowledge.mentalModels.length; i++) {
    const mm = knowledge.mentalModels[i];
    checkField(`knowledge.mentalModels[${i}].nameZh`, mm.name, mm.nameZh, `思维模型[${i}].name`);
    checkField(`knowledge.mentalModels[${i}].oneLinerZh`, mm.oneLiner, mm.oneLinerZh, `思维模型[${i}].oneLiner`);
    checkField(`knowledge.mentalModels[${i}].applicationZh`, mm.application, mm.applicationZh, `思维模型[${i}].application`);
  }

  // Expression layer: chineseAdaptation
  if (expression.chineseAdaptation !== undefined) {
    totalFields++;
    if (!expression.chineseAdaptation || expression.chineseAdaptation.trim().length === 0) {
      emptyZh++;
      findings.push({
        type: 'error',
        check: 'chinese_field_empty',
        location: 'expression.chineseAdaptation',
        description: 'expression.chineseAdaptation 为空',
        autoFixable: true,
      });
    }
  }

  // Check strengthsZh / blindspotsZh
  for (let i = 0; i < knowledge.strengthsZh.length; i++) {
    totalFields++;
    if (!knowledge.strengthsZh[i] || knowledge.strengthsZh[i].trim().length === 0) {
      emptyZh++;
      findings.push({
        type: 'error',
        check: 'chinese_field_empty',
        location: `knowledge.strengthsZh[${i}]`,
        description: `strengthsZh[${i}] 为空`,
        autoFixable: true,
      });
    }
  }

  for (let i = 0; i < knowledge.blindspotsZh.length; i++) {
    totalFields++;
    if (!knowledge.blindspotsZh[i] || knowledge.blindspotsZh[i].trim().length === 0) {
      emptyZh++;
      findings.push({
        type: 'error',
        check: 'chinese_field_empty',
        location: `knowledge.blindspotsZh[${i}]`,
        description: `blindspotsZh[${i}] 为空`,
        autoFixable: true,
      });
    }
  }

  const completenessRatio = totalFields > 0 ? (totalFields - missingZh - emptyZh) / totalFields : 1;
  const score = Math.round(completenessRatio * 100);

  return {
    result: {
      passed: completenessRatio >= 0.95,
      score,
      totalBilingualFields: totalFields,
      missingCount: missingZh,
      emptyCount: emptyZh,
    },
    findings,
  };
}

// ─── Main Validator ──────────────────────────────────────────────────────────

export interface ValidateSemanticOptions {
  personaId: string;
  knowledge: KnowledgeLayer;
  expression: ExpressionLayer;
  skipBilingual?: boolean;   // For uni-lingual distillation (en-US output only)
}

export function validateSemantic(options: ValidateSemanticOptions): SemanticValidationReport {
  const { personaId, knowledge, expression, skipBilingual = false } = options;
  const allFindings: SemanticValidationFinding[] = [];

  // Check 1: Evidence relevance
  const { result: evResult, findings: evFindings } = checkEvidenceRelevance(knowledge.mentalModels);
  allFindings.push(...evFindings);

  // Check 2: Expression-Knowledge alignment
  const { result: ekResult, findings: ekFindings } = checkExpressionKnowledgeAlignment(knowledge, expression);
  allFindings.push(...ekFindings);

  // Check 3: Cross-layer consistency
  const { result: clResult, findings: clFindings } = checkCrossLayerConsistency(knowledge);
  allFindings.push(...clFindings);

  // Check 4: Bilingual completeness
  const bilingualResult: BilingualResult = { passed: true, score: 100, totalBilingualFields: 0, missingCount: 0, emptyCount: 0 };
  const bilingualFindings: SemanticValidationFinding[] = [];
  if (!skipBilingual) {
    const { result: blResult, findings: blFindings } = checkBilingualCompleteness(knowledge, expression);
    bilingualResult.totalBilingualFields = blResult.totalBilingualFields;
    bilingualResult.missingCount = blResult.missingCount;
    bilingualResult.emptyCount = blResult.emptyCount;
    bilingualResult.score = blResult.score;
    bilingualResult.passed = blResult.passed;
    bilingualFindings.push(...blFindings);
    allFindings.push(...bilingualFindings);
  }

  // Compute overall score
  const errors = allFindings.filter(f => f.type === 'error').length;
  const warnings = allFindings.filter(f => f.type === 'warning').length;

  // Score = 100 - 10*errors - 2*warnings, capped at 0
  const overallScore = Math.max(0, 100 - errors * 10 - warnings * 2);

  // Determine result
  let result: SemanticValidationReport['result'] = 'pass';
  if (errors >= 2) result = 'fail';
  else if (errors >= 1 || warnings >= 3) result = 'warning';

  // Suggestions
  const suggestions: string[] = [];
  if (!evResult.passed) {
    suggestions.push(`补充 ${Math.ceil((1 - evResult.score / 100) * evResult.mentalModelsChecked)} 个思维模型的引用证据`);
  }
  if (!ekResult.passed) {
    suggestions.push(`ExpressionDNA vocabulary 与知识层领域匹配度低，建议从目标语言语料重新提取`);
  }
  if (!clResult.passed) {
    suggestions.push(`价值观-张力一致性不足，建议审查 ${knowledge.tensions.length - Math.round(clResult.coherenceRatio * knowledge.tensions.length)} 个张力是否与核心价值观相关`);
  }
  if (!bilingualResult.passed) {
    const missing = bilingualResult.missingCount + bilingualResult.emptyCount;
    suggestions.push(`补充 ${missing} 个中文字段缺失/空值`);
    suggestions.push(`运行翻译补全流程: backfill_chinese_fields_via_translation`);
  }
  if (allFindings.length === 0) {
    suggestions.push('语义验证通过，无需修改');
  }

  return {
    personaId,
    timestamp: new Date().toISOString(),
    checks: {
      evidenceRelevance: evResult,
      expressionKnowledgeAlignment: ekResult,
      crossLayerConsistency: clResult,
      bilingualCompleteness: bilingualResult,
    },
    findings: allFindings,
    overallScore,
    result,
    suggestions,
  };
}

// ─── Quick Health Check ──────────────────────────────────────────────────────
// Lightweight check for use in batch processing

export function quickSemanticHealthCheck(
  knowledge: KnowledgeLayer,
  expression: ExpressionLayer
): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!expression.vocabulary || expression.vocabulary.length < 3) {
    issues.push('vocabulary_empty');
  }
  if (!knowledge.mentalModels || knowledge.mentalModels.length < 2) {
    issues.push('mental_models_insufficient');
  }
  if (knowledge.values.length === 0) {
    issues.push('values_missing');
  }
  const missingZh = knowledge.values.some(v => !v.nameZh?.trim());
  if (missingZh) {
    issues.push('chinese_fields_missing');
  }
  const evLessMMs = knowledge.mentalModels.filter(m => !m.evidence || m.evidence.length === 0).length;
  if (evLessMMs > knowledge.mentalModels.length * 0.5) {
    issues.push('evidence_deficient');
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}
