/**
 * Zero 蒸馏引擎 — 语义对齐（embedding-based）
 * 替代 v4 L5 的 Jaccard 相似度，用 embedding 做跨语言对齐
 */

import {
  MentalModel, CoreValue, ConceptAlignment, ConceptConflict,
  ConflictResolutionStrategy, FusionResult, FusionMetadata,
  SupportedLanguage
} from '../types';
import { callEmbedding, cosineSimilarity, LLMSession } from '../utils/llm';
import { ZeroLogger } from '../utils/logger';

// =============================================================================
// Semantic Aligner
// =============================================================================

export interface AlignerOptions {
  embeddingThreshold?: number; // cosine similarity threshold for matching (default 0.75)
  primaryLang?: SupportedLanguage;
  secondaryLang?: SupportedLanguage;
}

/**
 * 用 embedding 对齐双语文本中的 mental models / values
 * 解决 v4 L5 的 Jaccard 问题：英文 "first principles" 和中文 "第一性原理" 零共享
 */
export async function alignWithEmbedding(
  primaryItems: Array<{ id: string; name: string; description: string }>,
  secondaryItems: Array<{ id: string; name: string; description: string }>,
  session?: LLMSession,
  options: AlignerOptions = {},
  logger?: ZeroLogger,
  phase = 'fusion-align'
): Promise<ConceptAlignment[]> {
  const threshold = options.embeddingThreshold ?? 0.75;

  if (primaryItems.length === 0 || secondaryItems.length === 0) {
    return [];
  }

  // Build texts for embedding
  const primaryTexts = primaryItems.map((p) => `${p.name}: ${p.description}`.slice(0, 500));
  const secondaryTexts = secondaryItems.map((s) => `${s.name}: ${s.description}`.slice(0, 500));

  // Batch embed all texts (reduces API calls)
  logger?.debug(`Embedding ${primaryTexts.length + secondaryTexts.length} items`);

  const allTexts = [...primaryTexts, ...secondaryTexts];
  const batchSize = 50;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < allTexts.length; i += batchSize) {
    const batch = allTexts.slice(i, i + batchSize);
    const { embeddings } = await callEmbedding(batch, 'deepseek-embedding', session as Parameters<typeof callEmbedding>[2], `${phase}-embed`);
    allEmbeddings.push(...embeddings);
  }

  const primaryEmbeddings = allEmbeddings.slice(0, primaryTexts.length);
  const secondaryEmbeddings = allEmbeddings.slice(primaryTexts.length);

  // Compute pairwise similarities
  const alignments: ConceptAlignment[] = [];
  const usedSecondary = new Set<number>();

  for (let pi = 0; pi < primaryItems.length; pi++) {
    let bestSimilarity = 0;
    let bestIndex = -1;

    for (let si = 0; si < secondaryItems.length; si++) {
      if (usedSecondary.has(si)) continue;

      const similarity = cosineSimilarity(primaryEmbeddings[pi], secondaryEmbeddings[si]);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = si;
      }
    }

    if (bestIndex >= 0 && bestSimilarity >= threshold) {
      usedSecondary.add(bestIndex);
      alignments.push({
        sourceConcept: primaryItems[pi].name,
        targetConcept: secondaryItems[bestIndex].name,
        alignment: {
          sourceItem: primaryItems[pi].name,
          targetItem: secondaryItems[bestIndex].name,
          similarity: bestSimilarity,
          sourceEmbedding: primaryEmbeddings[pi],
          targetEmbedding: secondaryEmbeddings[bestIndex],
          matched: true,
        },
        confidence: bestSimilarity,
      });
    } else if (bestIndex >= 0) {
      // Below threshold but still record for manual review
      alignments.push({
        sourceConcept: primaryItems[pi].name,
        targetConcept: secondaryItems[bestIndex].name,
        alignment: {
          sourceItem: primaryItems[pi].name,
          targetItem: secondaryItems[bestIndex].name,
          similarity: bestSimilarity,
          matched: false,
        },
        confidence: bestSimilarity,
      });
    }
  }

  logger?.info(`Embedding alignment: ${alignments.filter((a) => a.alignment.matched).length}/${primaryItems.length} matched above threshold ${threshold}`);

  return alignments;
}

// =============================================================================
// Conflict Resolver
// =============================================================================

/**
 * 消解跨语言/跨版本的冲突
 */
export function resolveConflicts(
  alignments: ConceptAlignment[],
  conflicts: ConceptConflict[],
  strategy: ConflictResolutionStrategy = 'synthesize'
): ConceptConflict[] {
  const resolved: ConceptConflict[] = [];

  for (const conflict of conflicts) {
    const resolution = applyResolutionStrategy(conflict, strategy);
    resolved.push({
      ...conflict,
      resolution: resolution.text,
      resolutionStrategy: strategy,
    });
  }

  return resolved;
}

function applyResolutionStrategy(conflict: ConceptConflict, strategy: ConflictResolutionStrategy): { text: string; source: string } {
  switch (strategy) {
    case 'prefer_primary':
      return { text: conflict.primary, source: 'primary' };
    case 'prefer_secondary':
      return { text: conflict.secondary, source: 'secondary' };
    case 'synthesize':
      return { text: `${conflict.primary} / ${conflict.secondary}`, source: 'synthesized' };
    case 'mark_unresolved':
      return { text: `[UNRESOLVED] ${conflict.primary} vs ${conflict.secondary}`, source: 'unresolved' };
    default:
      return { text: conflict.primary, source: 'default' };
  }
}

// =============================================================================
// Bilingual Fusion
// =============================================================================

export interface BilingualFusionOptions {
  alignWithEmbedding?: boolean;
  embeddingThreshold?: number;
  conflictStrategy?: ConflictResolutionStrategy;
}

/**
 * 融合双语文本的知识层
 */
export async function fuseBilingualKnowledge(
  primaryKnowledge: {
    mentalModels: MentalModel[];
    values: CoreValue[];
    decisionHeuristics: import('../types').DecisionHeuristic[];
  },
  secondaryKnowledge: {
    mentalModels: MentalModel[];
    values: CoreValue[];
    decisionHeuristics: import('../types').DecisionHeuristic[];
  },
  session?: LLMSession,
  options: BilingualFusionOptions = {},
  logger?: ZeroLogger
): Promise<FusionResult> {
  const startTime = Date.now();
  const phase = 'fusion';

  logger?.info('Starting bilingual fusion', {
    primaryMM: primaryKnowledge.mentalModels.length,
    secondaryMM: secondaryKnowledge.mentalModels.length,
  });

  // Align mental models
  const mmAlignments = options.alignWithEmbedding !== false
    ? await alignWithEmbedding(
        primaryKnowledge.mentalModels.map((m) => ({ id: m.id, name: m.name, description: m.description })),
        secondaryKnowledge.mentalModels.map((m) => ({ id: m.id, name: m.name, description: m.description })),
        session,
        { embeddingThreshold: options.embeddingThreshold ?? 0.75 },
        logger,
        `${phase}-mm`
      )
    : [];

  // Align values
  const valAlignments = options.alignWithEmbedding !== false
    ? await alignWithEmbedding(
        primaryKnowledge.values.map((v) => ({ id: v.id, name: v.name, description: v.description })),
        secondaryKnowledge.values.map((v) => ({ id: v.id, name: v.name, description: v.description })),
        session,
        { embeddingThreshold: options.embeddingThreshold ?? 0.75 },
        logger,
        `${phase}-val`
      )
    : [];

  // Detect conflicts
  const conflicts: ConceptConflict[] = [];

  // Conflict 1: Same concept, different descriptions
  for (const alignment of mmAlignments) {
    if (alignment.alignment.similarity < 0.6) {
      conflicts.push({
        id: `conflict-${conflicts.length + 1}`,
        primary: alignment.sourceConcept,
        secondary: alignment.targetConcept,
        dimension: 'semantic',
        description: `语义相似度 ${alignment.alignment.similarity}，可能存在理解差异`,
      });
    }
  }

  // Resolve conflicts
  const resolvedConflicts = resolveConflicts(mmAlignments, conflicts, options.conflictStrategy ?? 'synthesize');

  const fusionMetadata: FusionMetadata = {
    primaryLanguage: 'en',
    secondaryLanguage: 'zh',
    alignmentCount: mmAlignments.length,
    conflictCount: conflicts.length,
    resolvedConflicts: resolvedConflicts.filter((c) => c.resolution).length,
    unresolvedConflicts: resolvedConflicts.filter((c) => !c.resolution).length,
    fusionDurationMs: Date.now() - startTime,
  };

  logger?.info('Fusion complete', {
    alignments: mmAlignments.length,
    conflicts: conflicts.length,
    resolved: fusionMetadata.resolvedConflicts,
    durationMs: fusionMetadata.fusionDurationMs,
  });

  return {
    fusedKnowledge: primaryKnowledge as import('../types').KnowledgeLayer,
    fusedExpression: {} as import('../types').ExpressionDNA,
    alignments: mmAlignments,
    conflicts: resolvedConflicts,
    fusionMetadata,
  };
}
