/**
 * Prismatic — Layer 5: Cross-Validation & Fusion Engine
 * Validates and merges distillation results from multiple languages
 *
 * Handles:
 * - Concept consistency checking across languages
 * - Conflict resolution with priority rules
 * - Knowledge layer fusion (union of all languages)
 * - Expression layer fusion (intersection for universal, target language for specific)
 */

import { nanoid } from 'nanoid';
import type {
  KnowledgeLayer,
  ExpressionLayer,
  ValidationReport,
  ConceptFusion,
  ConceptConflict,
  BilingualExtraction,
  SupportedLanguage,
  TrilingualConcept,
  ConflictResolutionStrategy,
  ExtractedMentalModel,
  ExtractedValue,
  ExtractedTension,
} from './distillation-v4-types';

// ─── Language Priority Rules ─────────────────────────────────────────────────────

const LANGUAGE_PRIORITY: Record<SupportedLanguage, number> = {
  de: 10,    // German (Wittgenstein, Nietzsche)
  zh: 9,     // Chinese (classical texts)
  en: 8,     // English (most common translation)
  la: 7,     // Latin
  el: 7,     // Greek
  ja: 6,     // Japanese
  fr: 5,     // French
  mixed: 1,
};

const SOURCE_TYPE_PRIORITY: Record<string, number> = {
  classical_text: 10,
  archive: 10,        // Nachlass, manuscripts
  book: 9,
  interview: 8,
  lecture: 8,          // Oral dictated
  speech: 8,
  self_translation: 9, // Wittgenstein's own translation
  secondary: 5,
  tweet: 3,
  blog: 5,
};

// ─── Concept Consistency Checking ─────────────────────────────────────────────────

function checkConceptConsistency(
  conceptA: string,
  conceptB: string,
  languageA: SupportedLanguage,
  languageB: SupportedLanguage
): { consistent: boolean; score: number; type: 'terminology' | 'emphasis' | 'contradiction' | 'unrelated' } {
  // Simple string similarity check
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, '');
  const a = normalize(conceptA);
  const b = normalize(conceptB);

  if (a === b) return { consistent: true, score: 1.0, type: 'terminology' };

  // Check for contradiction patterns
  const contradictionPairs = [
    ['always', 'never'],
    ['good', 'evil'],
    ['right', 'wrong'],
    ['true', 'false'],
    ['自由', '束缚'],
    ['存在', '虚无'],
  ];

  for (const [pos, neg] of contradictionPairs) {
    if ((a.includes(pos) && b.includes(neg)) || (a.includes(neg) && b.includes(pos))) {
      return { consistent: false, score: 0, type: 'contradiction' };
    }
  }

  // Jaccard similarity
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;

  if (jaccard >= 0.7) return { consistent: true, score: jaccard, type: 'terminology' };
  if (jaccard >= 0.4) return { consistent: true, score: jaccard, type: 'emphasis' };
  return { consistent: true, score: jaccard, type: 'unrelated' };
}

// ─── Mental Model Fusion ─────────────────────────────────────────────────────────

function fuseMentalModels(
  primary: ExtractedMentalModel[],
  secondary: ExtractedMentalModel[],
  strategy: ConflictResolutionStrategy
): { fused: ExtractedMentalModel[]; conflicts: ConceptConflict[] } {
  const fused: ExtractedMentalModel[] = [];
  const conflicts: ConceptConflict[] = [];
  const usedSecondary = new Set<number>();

  for (const pm of primary) {
    // Find matching model in secondary by name similarity
    let bestMatch: { idx: number; score: number } | null = null;

    for (let i = 0; i < secondary.length; i++) {
      if (usedSecondary.has(i)) continue;
      const check = checkConceptConsistency(
        pm.name,
        secondary[i].name,
        'en',
        'en'
      );
      if (check.score >= 0.5) {
        if (!bestMatch || check.score > bestMatch.score) {
          bestMatch = { idx: i, score: check.score };
        }
      }
    }

    if (bestMatch && bestMatch.score >= 0.7) {
      // High consistency - merge with priority
      const sm = secondary[bestMatch.idx];
      usedSecondary.add(bestMatch.idx);

      const check = checkConceptConsistency(
        pm.oneLiner,
        sm.oneLiner,
        'en',
        'en'
      );

      if (!check.consistent) {
        conflicts.push({
          conceptId: pm.id,
          languageA: 'en',
          languageB: 'en',
          versionA: pm.oneLiner,
          versionB: sm.oneLiner,
          conflictType: 'contradiction',
          resolution: strategy === 'primary_language' ? pm.oneLiner : sm.oneLiner,
          resolvedBy: strategy === 'primary_language' ? 'primary_language' : 'llm_arbitration',
        });
      }

      // Fuse with primary priority
      fused.push({
        ...pm,
        evidence: [...pm.evidence, ...sm.evidence].slice(0, 4),
        crossDomain: [...new Set([...pm.crossDomain, ...sm.crossDomain])],
        limitation: pm.limitation || sm.limitation,
      });
    } else {
      // No match - use primary directly
      fused.push(pm);
    }
  }

  // Add unmatched secondary models
  for (let i = 0; i < secondary.length; i++) {
    if (!usedSecondary.has(i)) {
      fused.push(secondary[i]);
    }
  }

  return { fused, conflicts };
}

// ─── Values Fusion ─────────────────────────────────────────────────────────────

function fuseValues(
  primary: ExtractedValue[],
  secondary: ExtractedValue[]
): ExtractedValue[] {
  const merged = new Map<string, ExtractedValue>();

  // Primary first
  for (const v of primary) {
    merged.set(v.name.toLowerCase(), v);
  }

  // Merge secondary (same name → keep primary, different → add)
  for (const v of secondary) {
    const key = v.name.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, v);
    }
  }

  return [...merged.values()].sort((a, b) => a.priority - b.priority);
}

// ─── Expression Fusion ───────────────────────────────────────────────────────────

function fuseExpression(
  primary: ExpressionLayer,
  secondary: ExpressionLayer,
  outputLang: 'zh-CN' | 'en-US'
): ExpressionLayer {
  // Target language → use primary (already in target language)
  // Cross-language → intersection of tone/certainty

  const outputLangKey: SupportedLanguage = outputLang === 'zh-CN' ? 'zh' : 'en';

  return {
    // Target language fields — use primary
    vocabulary: primary.vocabulary.length > 0 ? primary.vocabulary : (secondary.vocabulary ?? []),
    sentenceStyle: primary.sentenceStyle.length > 0 ? primary.sentenceStyle : (secondary.sentenceStyle ?? []),
    forbiddenWords: primary.forbiddenWords,

    // Cross-language fields — use intersection or more distinctive
    tone: primary.tone === secondary.tone ? primary.tone
      : (primary.confidence === 'high' ? primary.tone : secondary.tone),
    certaintyLevel: primary.certaintyLevel === secondary.certaintyLevel
      ? primary.certaintyLevel
      : 'medium',
    rhetoricalHabit: [primary.rhetoricalHabit, secondary.rhetoricalHabit]
      .filter(Boolean)
      .join('；'),
    quotePatterns: [...new Set([...primary.quotePatterns, ...secondary.quotePatterns])],
    rhythm: primary.rhythm || secondary.rhythm,
    rhythmDescription: primary.rhythmDescription || secondary.rhythmDescription,
    chineseAdaptation: primary.chineseAdaptation || secondary.chineseAdaptation,
    verbalMarkers: [...new Set([...primary.verbalMarkers, ...secondary.verbalMarkers])],
    speakingStyle: primary.speakingStyle || secondary.speakingStyle,

    // Source language references
    sourceVocabulary: secondary.sourceVocabulary,
    sourceSentenceStyle: secondary.sourceSentenceStyle,
    sourceTone: secondary.sourceTone,
    sourceRhythm: secondary.sourceRhythm,

    // Confidence: take lower of the two
    confidence: primary.confidence === 'low' || secondary.confidence === 'low' ? 'low'
      : primary.confidence === 'medium' || secondary.confidence === 'medium' ? 'medium'
      : 'high',
    confidenceNotes: [
      ...primary.confidenceNotes,
      ...(secondary.confidence !== primary.confidence ? secondary.confidenceNotes : []),
    ],
  };
}

// ─── Bilingual Completeness Validation ─────────────────────────────────────────────

export interface BilingualCompletenessResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

export function validateBilingualCompleteness(
  knowledge: KnowledgeLayer,
  expression: ExpressionLayer
): BilingualCompletenessResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // P0: expressionDNA must be non-empty — this is critical for conversation style
  if (!expression.vocabulary || expression.vocabulary.length === 0) {
    issues.push('expressionDNA.vocabulary 为空 — 无法生成有风格的对话');
  }
  if (!expression.sentenceStyle || expression.sentenceStyle.length === 0) {
    issues.push('expressionDNA.sentenceStyle 为空 — 无法复现句式习惯');
  }
  if (!expression.forbiddenWords || expression.forbiddenWords.length === 0) {
    warnings.push('expressionDNA.forbiddenWords 为空 — 可能影响风格安全性');
  }

  // P1: all mentalModels must have Chinese oneLiner
  for (const mm of knowledge.mentalModels) {
    if (!mm.oneLinerZh) {
      issues.push(`mentalModel "${mm.nameZh || mm.name}" 缺少 oneLinerZh`);
    }
    if (!mm.applicationZh) {
      warnings.push(`mentalModel "${mm.nameZh || mm.name}" 缺少 applicationZh`);
    }
  }

  // P2: strengths/blindspots must have Chinese versions
  if (!knowledge.strengthsZh || knowledge.strengthsZh.length === 0) {
    issues.push('strengthsZh 为空 — 中文优势描述缺失');
  }
  if (!knowledge.blindspotsZh || knowledge.blindspotsZh.length === 0) {
    issues.push('blindspotsZh 为空 — 中文盲点描述缺失');
  }

  // P2: identity must have Chinese version
  if (!knowledge.identityPromptZh || knowledge.identityPromptZh.length < 30) {
    warnings.push('identityPromptZh 过短或为空 — 中文身份描述缺失');
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

// ─── Main Cross-Validation ─────────────────────────────────────────────────────

export interface CrossValidationConfig {
  bilingual: BilingualExtraction;
  strategy: ConflictResolutionStrategy;
  outputLanguage: 'zh-CN' | 'en-US';
}

export function crossValidate(config: CrossValidationConfig): ValidationReport {
  const { bilingual, strategy, outputLanguage } = config;
  const { primary, secondary } = bilingual;

  const conceptFusions: ConceptFusion[] = [];
  const conflicts: ConceptConflict[] = [];
  const validationNotes: string[] = [];

  // 1. Mental model consistency
  const { fused: fusedMentalModels, conflicts: mmConflicts } = fuseMentalModels(
    primary.knowledge.mentalModels,
    secondary.knowledge.mentalModels,
    strategy
  );
  conflicts.push(...mmConflicts);

  // 2. Values fusion
  const fusedValues = fuseValues(
    primary.knowledge.values,
    secondary.knowledge.values
  );

  // 3. Key concepts cross-validation
  const allConcepts = [
    ...primary.knowledge.keyConcepts,
    ...secondary.knowledge.keyConcepts,
  ];

  // Deduplicate by English name
  const conceptMap = new Map<string, TrilingualConcept>();
  for (const concept of allConcepts) {
    const key = concept.english.toLowerCase();
    if (!conceptMap.has(key)) {
      conceptMap.set(key, concept);
    } else {
      // Check consistency
      const existing = conceptMap.get(key)!;
      const check = checkConceptConsistency(
        existing.english,
        concept.english,
        'en',
        'en'
      );
      if (!check.consistent) {
        conflicts.push({
          conceptId: key,
          languageA: existing.original ? 'de' : 'en',
          languageB: concept.original ? 'de' : 'en',
          versionA: existing.english,
          versionB: concept.english,
          conflictType: check.type,
          resolution: strategy === 'primary_language'
            ? (primary.knowledge.confidence === 'high' ? existing.english : concept.english)
            : existing.english,
          resolvedBy: strategy === 'primary_language' ? 'primary_language' : 'llm_arbitration',
        });
      }
      conceptFusions.push({
        concept: existing,
        sourceLanguages: [primary.language, secondary.language],
        consistencyScore: check.score,
        fusionMethod: 'intersection',
        resolvedText: existing.english,
        resolvedTextZh: existing.chinese,
      });
    }
  }

  // 4. Cross-language consistency score
  let totalConsistency = 0;
  let conceptCount = 0;

  for (const [key, concept] of conceptMap.entries()) {
    totalConsistency += 1.0; // Same concept across languages
    conceptCount++;
  }

  const conceptConsistency = conceptCount > 0 ? totalConsistency / conceptCount : 1.0;

  // Expression consistency
  const exprConsistency =
    primary.expression.tone === secondary.expression.tone ? 1.0
    : primary.expression.certaintyLevel === secondary.expression.certaintyLevel ? 0.7
    : 0.5;

  // Knowledge coverage (how many of secondary's models merged into primary)
  const coverage = fusedMentalModels.length / Math.max(1, Math.max(
    primary.knowledge.mentalModels.length,
    secondary.knowledge.mentalModels.length
  ));

  const crossLanguageConsistency = Math.round(
    (conceptConsistency * 0.5 + exprConsistency * 0.3 + coverage * 0.2) * 100
  );

  // Validation notes
  if (conflicts.length > 0) {
    validationNotes.push(`发现 ${conflicts.length} 个概念冲突，已解决 ${conflicts.filter(c => c.resolvedBy !== 'llm_arbitration').length} 个`);
  }
  if (conceptConsistency < 0.8) {
    validationNotes.push(`概念一致性偏低: ${(conceptConsistency * 100).toFixed(0)}%`);
  }
  if (exprConsistency < 0.6) {
    validationNotes.push(`表达一致性偏低: ${(exprConsistency * 100).toFixed(0)}%`);
  }

  const overallConfidence: 'high' | 'medium' | 'low' =
    crossLanguageConsistency >= 80 ? 'high'
    : crossLanguageConsistency >= 60 ? 'medium'
    : 'low';

  return {
    crossLanguageConsistency,
    conceptFusions,
    conflicts,
    expressionConsistency: Math.round(exprConsistency * 100),
    knowledgeCoverage: Math.round(coverage * 100),
    overallConfidence,
    validationNotes,
  };
}

// ─── Fusion Output Builder ───────────────────────────────────────────────────────

export interface FusionResult {
  knowledge: KnowledgeLayer;
  expression: ExpressionLayer;
  validation: ValidationReport;
}

export function buildFusion(
  bilingual: BilingualExtraction,
  validation: ValidationReport,
  outputLanguage: 'zh-CN' | 'en-US',
  strategy: ConflictResolutionStrategy
): FusionResult {
  const { primary, secondary } = bilingual;

  // Merge knowledge layers
  const fusedMentalModels = fuseMentalModels(
    primary.knowledge.mentalModels,
    secondary.knowledge.mentalModels,
    strategy
  );

  const knowledge: KnowledgeLayer = {
    identityPrompt: primary.knowledge.identityPrompt,
    identityPromptZh: primary.knowledge.identityPromptZh || secondary.knowledge.identityPromptZh,
    mentalModels: fusedMentalModels.fused,
    decisionHeuristics: [
      ...primary.knowledge.decisionHeuristics,
      ...secondary.knowledge.decisionHeuristics,
    ],
    values: fuseValues(primary.knowledge.values, secondary.knowledge.values),
    tensions: [...primary.knowledge.tensions, ...secondary.knowledge.tensions],
    antiPatterns: [...new Set([...primary.knowledge.antiPatterns, ...secondary.knowledge.antiPatterns])],
    antiPatternsZh: [...new Set([...primary.knowledge.antiPatternsZh, ...secondary.knowledge.antiPatternsZh])],
    honestBoundaries: [
      ...primary.knowledge.honestBoundaries,
      ...secondary.knowledge.honestBoundaries,
    ],
    strengths: [...new Set([...primary.knowledge.strengths, ...secondary.knowledge.strengths])],
    strengthsZh: [...new Set([...primary.knowledge.strengthsZh, ...secondary.knowledge.strengthsZh])],
    blindspots: [...new Set([...primary.knowledge.blindspots, ...secondary.knowledge.blindspots])],
    blindspotsZh: [...new Set([...primary.knowledge.blindspotsZh, ...secondary.knowledge.blindspotsZh])],
    sources: [...primary.knowledge.sources, ...secondary.knowledge.sources],
    keyConcepts: [...primary.knowledge.keyConcepts, ...secondary.knowledge.keyConcepts],
    confidence: primary.knowledge.confidence === 'high' && secondary.knowledge.confidence === 'high'
      ? 'high'
      : primary.knowledge.confidence === 'low' || secondary.knowledge.confidence === 'low'
      ? 'low'
      : 'medium',
    confidenceNotes: [
      ...primary.knowledge.confidenceNotes,
      ...secondary.knowledge.confidenceNotes,
    ],
  };

  // Merge expression layers
  const expression = fuseExpression(primary.expression, secondary.expression, outputLanguage);

  return { knowledge, expression, validation };
}
