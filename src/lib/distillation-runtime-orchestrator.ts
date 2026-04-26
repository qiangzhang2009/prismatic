/**
 * Prismatic — Runtime Distillation Orchestrator
 *
 * Bridge between the distillation pipeline (L1 corpus intelligence, L2 routing,
 * L3 knowledge) and the runtime chat API.
 *
 * Problem solved: Living personas have a corpus cutoff date. When users ask
 * about events after the cutoff, the distilled model has no knowledge of those
 * events. This orchestrator detects this gap and routes to the appropriate
 * graceful degradation handler.
 *
 * Architecture:
 *   User Question
 *        ↓
 *   ┌─ L1: CorpusMetadata Enricher ──────────────────────────────┐
 *   │  Extract metadata from Persona.corpusMetadata + Persona.isAlive  │
 *   └─────────────────────────────────────────────────────────────┘
 *        ↓
 *   ┌─ L2: Knowledge Gap Detector ─────────────────────────────────┐
 *   │  detectKnowledgeGap() → KnowledgeGapDetectionResult            │
 *   └─────────────────────────────────────────────────────────────┘
 *        ↓
 *   ┌─ L3: Graceful Router ────────────────────────────────────────┐
 *   │  decideDegradationRoute() → DegradationMode                 │
 *   └─────────────────────────────────────────────────────────────┘
 *        ↓
 *   ┌─ L3: Knowledge Gap Handler ────────────────────────────────┐
 *   │  handleKnowledgeGap() → GracefulDegradationResult          │
 *   └───────────────────────────────────────────────────────────┘
 *        ↓
 *   ┌─ Response Merger ───────────────────────────────────────────┐
 *   │  Merge normal LLM response + gap metadata into final output │
 *   └──────────────────────────────────────────────────────────┘
 */

import type { Persona } from './types';
import type {
  CorpusMetadata,
  KnowledgeGapDetectionResult,
  DegradationMode,
  GracefulDegradationResult,
  KnowledgeLayer,
  ExpressionLayer,
} from './distillation-v4-types';
import { detectKnowledgeGap } from './distillation-v2-gap-detector';
import { decideDegradationRoute, quickDegradationRoute } from './distillation-graceful-router';
import { handleKnowledgeGap, handleKnowledgeGapFast } from './distillation-knowledge-gap-handler';

// ─── L1: CorpusMetadata Enricher ─────────────────────────────────────────────────

export interface EnrichedPersona {
  persona: Persona;
  /** The persona's runtime corpus metadata, derived from the Persona definition */
  corpusMetadata: CorpusMetadata;
}

/**
 * L1: Extract and enrich corpus metadata from a Persona definition.
 *
 * Falls back to sensible defaults when the Persona has no explicit corpusMetadata:
 * - Dead personas (isAlive=false): default to honest_boundary, no strategy needed
 * - Living personas without metadata: use hybrid strategy with 1-year approximation
 */
export function enrichCorpusMetadata(persona: Persona): EnrichedPersona {
  const { isAlive, corpusMetadata: raw } = persona;

  // If explicit metadata exists, use it directly
  if (raw && Object.keys(raw).length > 0) {
    return {
      persona,
      corpusMetadata: {
        isAlive,
        cutoffDate: raw.cutoffDate,
        corpusLastUpdated: raw.corpusLastUpdated,
        coverageSpan: raw.coverageSpan,
        knowledgeGapStrategy: raw.knowledgeGapStrategy ?? (isAlive ? 'hybrid' : 'honest_boundary'),
        sensitiveTopics: raw.sensitiveTopics,
        extrapolationBoundaries: raw.extrapolationBoundaries,
        confidenceScore: raw.confidenceScore,
        knowledgeGapSignals: raw.knowledgeGapSignals,
      },
    };
  }

  // Fallback: synthesize from persona characteristics
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentDay = String(now.getDate()).padStart(2, '0');
  const today = `${currentYear}-${currentMonth}-${currentDay}`;

  // For dead personas: their life ends at a known year
  // For living personas: approximate cutoff as today minus 3 months
  const approxCutoff = isAlive
    ? `${currentYear}-01-01` // Living personas default to Jan 1 of current year
    : undefined;

  return {
    persona,
    corpusMetadata: {
      isAlive,
      cutoffDate: raw?.cutoffDate ?? approxCutoff,
      corpusLastUpdated: raw?.corpusLastUpdated ?? today,
      coverageSpan: raw?.coverageSpan,
      knowledgeGapStrategy: isAlive
        ? (raw?.knowledgeGapStrategy ?? 'hybrid')
        : 'honest_boundary',
      sensitiveTopics: raw?.sensitiveTopics,
      extrapolationBoundaries: raw?.extrapolationBoundaries,
      confidenceScore: raw?.confidenceScore,
      knowledgeGapSignals: raw?.knowledgeGapSignals,
    },
  };
}

// ─── L2: Knowledge Gap Detection ──────────────────────────────────────────────

export interface GapDetectionOptions {
  question: string;
  enriched: EnrichedPersona;
}

/**
 * L2: Detect whether the user's question falls outside corpus coverage.
 *
 * For living personas, this checks:
 * - Temporal markers (recent/this year/last month/2026 etc.)
 * - Unknown entity references
 * - Specific date patterns
 * - Sensitive topics
 *
 * For dead personas, gap detection still runs but severity is reduced
 * (their life events are fully recorded).
 */
export function detectRuntimeGap(options: GapDetectionOptions): KnowledgeGapDetectionResult {
  const { question, enriched } = options;

  return detectKnowledgeGap({
    question,
    personaId: enriched.persona.id,
    corpusCutoffDate: enriched.corpusMetadata.cutoffDate,
    isAlive: enriched.corpusMetadata.isAlive ?? false,
    sensitiveTopics: enriched.corpusMetadata.sensitiveTopics,
  });
}

// ─── L3: Graceful Routing ────────────────────────────────────────────────────

export interface RoutingOptions {
  gapResult: KnowledgeGapDetectionResult;
  enriched: EnrichedPersona;
}

/**
 * L3: Decide HOW to respond based on gap detection result.
 *
 * Uses the full decision matrix for precision (in async contexts with LLM access)
 * or falls back to the quick routing table for the hot path.
 *
 * @param options - Detection and persona context
 * @param mode - 'precise' uses the full decision matrix, 'fast' uses lookup table
 */
export function routeGracefully(
  options: RoutingOptions,
  mode: 'precise' | 'fast' = 'fast'
): { mode: DegradationMode; reason: string; confidenceBoost: number } {
  const { gapResult, enriched } = options;

  if (mode === 'fast') {
    // Quick lookup table — zero LLM cost, minimal compute
    const quickMode = quickDegradationRoute(
      gapResult.severity,
      enriched.corpusMetadata.isAlive ?? false,
      gapResult.isSensitive
    );

    const reasonMap: Record<DegradationMode, string> = {
      normal: '问题落在语料库覆盖范围内',
      extrapolate: '在世人物 + 推演策略允许',
      honest_boundary: '超出知识边界，不做推演',
      refer_sources: '优先引用已有来源',
      hybrid: '混合模式：已知事实 + 诚实边界',
    };

    const boostMap: Record<DegradationMode, number> = {
      normal: 1.0,
      extrapolate: 0.8,
      honest_boundary: 0.6,
      refer_sources: 0.9,
      hybrid: 0.7,
    };

    return { mode: quickMode, reason: reasonMap[quickMode], confidenceBoost: boostMap[quickMode] };
  }

  // Precise mode: full decision matrix with strategy overrides
  const decision = decideDegradationRoute(
    gapResult,
    enriched.corpusMetadata,
    enriched.persona.id
  );

  return {
    mode: decision.mode,
    reason: decision.reason,
    confidenceBoost: decision.confidenceBoost,
  };
}

// ─── L3: Knowledge Gap Handling ───────────────────────────────────────────────

export interface HandleOptions {
  question: string;
  enriched: EnrichedPersona;
  knowledge: KnowledgeLayer;
  expression: ExpressionLayer;
  route: { mode: DegradationMode; reason: string; confidenceBoost: number };
  gapResult: KnowledgeGapDetectionResult;
  /** LLM instance for sophisticated extrapolation (optional but recommended) */
  llm?: any;
  /** Whether to use the LLM for handling (set false for hot-path/fast mode) */
  useLLM: boolean;
}

/**
 * L3: Execute the graceful degradation decision.
 *
 * For 'normal' mode: returns null (no gap handling needed, use standard LLM response)
 * For all other modes: returns GracefulDegradationResult with response content
 *
 * @param options - Full context including knowledge/expression layers and routing decision
 * @returns Gap handling result, or null if no handling needed (normal mode)
 */
export async function handleRuntimeGap(
  options: HandleOptions
): Promise<GracefulDegradationResult | null> {
  const { question, enriched, knowledge, expression, route, gapResult, llm, useLLM } = options;

  // Normal mode: no special handling needed
  if (route.mode === 'normal') {
    return null;
  }

  const handleOptions = {
    question,
    personaId: enriched.persona.id,
    personaNameZh: enriched.persona.nameZh,
    personaNameEn: enriched.persona.nameEn,
    knowledge,
    expression,
    metadata: enriched.corpusMetadata,
    topicHint: gapResult.topicHint,
    llm: useLLM ? llm : undefined,
  };

  // Use fast path (no LLM) for hot-path or when LLM is unavailable
  if (!useLLM || !llm) {
    return handleKnowledgeGapFast(handleOptions, route.mode);
  }

  // Use async path with LLM for sophisticated extrapolation
  return handleKnowledgeGap(handleOptions, route.mode);
}

// ─── L4: Response Merger ───────────────────────────────────────────────────────

export interface NormalResponse {
  content: string;
  confidence: number;
}

export interface GapAwareResponse {
  /** The main response content */
  content: string;
  /** Metadata about whether this response involves extrapolation */
  meta: {
    isGapAware: boolean;
    isExtrapolation: boolean;
    isAlive: boolean;
    corpusCutoffDate?: string;
    degradationMode: DegradationMode;
    confidence: number;
    /** Adjusted confidence after considering gap severity */
    adjustedConfidence: number;
    /** Human-readable reason for the routing decision */
    routingReason: string;
    /** Warning message to display in UI (e.g., "以下为推演内容") */
    warningLabel?: string;
    /** Signals detected from the question */
    gapSignals?: string[];
  };
}

/**
 * Merge a normal LLM response with gap handling result into a final response.
 *
 * For 'normal' mode: wraps the LLM response with gap metadata
 * For 'extrapolate' mode: uses the extrapolation response directly
 * For 'honest_boundary' mode: uses the boundary statement
 * For 'hybrid' mode: combines normal response with boundary note
 * For 'refer_sources' mode: combines normal response with source citations
 */
export function mergeResponses(
  normalResponse: NormalResponse | null,
  gapResult: GracefulDegradationResult | null,
  routing: { mode: DegradationMode; reason: string; confidenceBoost: number },
  enriched: EnrichedPersona,
  gapDetection: KnowledgeGapDetectionResult
): GapAwareResponse {
  const { mode, reason, confidenceBoost } = routing;
  const isGapAware = mode !== 'normal';

  // Signal descriptions for UI display
  const gapSignals = gapDetection.signals.slice(0, 3).map(s => s.description);

  // Compute adjusted confidence
  const adjustedConfidence = Math.round(normalResponse
    ? (normalResponse.confidence * confidenceBoost * 100)
    : (gapResult?.meta.confidence ?? 0.95) * confidenceBoost * 100
  );

  // Warning label based on mode
  const warningLabelMap: Partial<Record<DegradationMode, string>> = {
    extrapolate: '以下为基于价值观的推演内容，非具体事实',
    hybrid: '部分内容基于已知信息，部分为推演',
    honest_boundary: '以下内容超出蒸馏知识边界',
  };

  if (mode === 'normal' || !gapResult) {
    // Standard response: just add metadata
    return {
      content: normalResponse?.content ?? '',
      meta: {
        isGapAware,
        isExtrapolation: false,
        isAlive: enriched.corpusMetadata.isAlive ?? false,
        corpusCutoffDate: enriched.corpusMetadata.cutoffDate,
        degradationMode: mode,
        confidence: normalResponse?.confidence ?? 1.0,
        adjustedConfidence: Math.round((normalResponse?.confidence ?? 1.0) * 100),
        routingReason: reason,
        gapSignals: isGapAware ? gapSignals : undefined,
      },
    };
  }

  // Gap-aware response: merge content from gap handler
  let content: string;
  let warningLabel: string | undefined;

  switch (mode) {
    case 'extrapolate':
      content = gapResult.extrapolationResult?.content ?? '';
      warningLabel = '以下为推演内容';
      break;

    case 'honest_boundary':
      content = gapResult.boundaryStatement ?? '';
      warningLabel = '以下内容超出知识边界';
      break;

    case 'hybrid':
      // Hybrid: prepend known facts, append boundary note
      if (gapResult.normalResponse && normalResponse?.content) {
        content = `${gapResult.normalResponse}\n\n---\n${normalResponse.content}`;
      } else {
        content = gapResult.normalResponse ?? normalResponse?.content ?? '';
      }
      warningLabel = '以下为混合内容';
      break;

    case 'refer_sources':
      content = gapResult.normalResponse ?? normalResponse?.content ?? '';
      warningLabel = '以下内容引用已蒸馏来源';
      break;

    default:
      content = normalResponse?.content ?? '';
  }

  return {
    content,
    meta: {
      isGapAware,
      isExtrapolation: gapResult.meta.isExtrapolation,
      isAlive: enriched.corpusMetadata.isAlive ?? false,
      corpusCutoffDate: enriched.corpusMetadata.cutoffDate,
      degradationMode: mode,
      confidence: gapResult.meta.confidence,
      adjustedConfidence,
      routingReason: reason,
      warningLabel: warningLabel ?? warningLabelMap[mode],
      gapSignals,
    },
  };
}

// ─── L5: Full Pipeline (async with LLM) ────────────────────────────────────

export interface RuntimePipelineOptions {
  question: string;
  persona: Persona;
  knowledge: KnowledgeLayer;
  expression: ExpressionLayer;
  /** Standard LLM response from the persona's normal distillation */
  normalResponse: NormalResponse | null;
  /** LLM instance for sophisticated gap handling */
  llm?: any;
  /** Use LLM in gap handler (default: true if llm is provided) */
  useLLM?: boolean;
}

/**
 * Full runtime pipeline: L1 → L2 → L3 → Merge
 *
 * Orchestrates all four layers to produce a gap-aware response.
 * Returns both the final content and metadata for UI display.
 *
 * This is the main entry point for the chat API.
 */
export async function runRuntimePipeline(
  options: RuntimePipelineOptions
): Promise<GapAwareResponse> {
  const { question, persona, knowledge, expression, normalResponse, llm, useLLM = !!llm } = options;

  // ── L1: Enrich corpus metadata from persona definition
  const enriched = enrichCorpusMetadata(persona);

  // ── L2: Detect knowledge gaps in the question
  const gapDetection = detectRuntimeGap({ question, enriched });

  // ── L3a: Route to appropriate degradation mode
  const routing = routeGracefully({ gapResult: gapDetection, enriched }, useLLM ? 'precise' : 'fast');

  // ── L3b: Handle the gap based on routing decision
  const gapResult = await handleRuntimeGap({
    question,
    enriched,
    knowledge,
    expression,
    route: routing,
    gapResult: gapDetection,
    llm,
    useLLM,
  });

  // ── Merge: combine normal response with gap handling
  return mergeResponses(normalResponse, gapResult, routing, enriched, gapDetection);
}

// ─── L5: Fast Pipeline (sync, no LLM) ──────────────────────────────────────

export interface FastPipelineOptions {
  question: string;
  persona: Persona;
  /** Standard LLM response from the persona's normal distillation */
  normalResponse: NormalResponse | null;
}

/**
 * Fast runtime pipeline: L1 + L2 + L3 routing only, no LLM calls.
 *
 * Returns gap-aware metadata that the chat API can use to annotate the response.
 * Use this for the hot path where LLM overhead must be minimal.
 *
 * The actual content comes from the normal LLM response; this pipeline
 * only adds metadata and potentially modifies the content for boundary modes.
 */
export async function runFastPipeline(
  options: FastPipelineOptions
): Promise<GapAwareResponse> {
  const { question, persona, normalResponse } = options;

  // ── L1: Enrich corpus metadata
  const enriched = enrichCorpusMetadata(persona);

  // ── L2: Detect knowledge gaps
  const gapDetection = detectRuntimeGap({ question, enriched });

  // ── L3: Fast route decision
  const routing = routeGracefully({ gapResult: gapDetection, enriched }, 'fast');

  // ── Fast gap handling (no LLM, template-based)
  const gapResult = await handleRuntimeGap({
    question,
    enriched,
    knowledge: personaToKnowledgeLayer(persona),
    expression: personaToExpressionLayer(persona),
    route: routing,
    gapResult: gapDetection,
    llm: undefined,
    useLLM: false,
  });

  // ── Merge
  return mergeResponses(normalResponse, gapResult, routing, enriched, gapDetection);
}

// ─── Helpers: Persona → Knowledge/Expression Layers ─────────────────────────

/**
 * Convert a legacy Persona object to a minimal KnowledgeLayer for gap handling.
 * This avoids the need to store separate knowledge/expression layers at runtime.
 */
function personaToKnowledgeLayer(persona: Persona): KnowledgeLayer {
  return {
    identityPrompt: persona.identityPrompt || '',
    identityPromptZh: (persona as any).briefZh || persona.brief || persona.identityPrompt || '',
    mentalModels: (persona.mentalModels || []).map(m => ({
      id: m.id,
      name: m.name,
      nameZh: m.nameZh || m.name,
      oneLiner: m.oneLiner || '',
      oneLinerZh: m.oneLinerZh || m.oneLiner || '',
      evidence: m.evidence || [],
      crossDomain: m.crossDomain || [],
      application: m.application || '',
      applicationZh: m.applicationZh || m.application || '',
      limitation: m.limitation || '',
      limitationZh: (m as any).limitationZh || m.limitation || '',
      keyConcepts: [],
    })),
    decisionHeuristics: (persona.decisionHeuristics || []).map(h => ({
      id: h.id,
      name: h.name,
      nameZh: h.nameZh || h.name,
      description: h.description || '',
      descriptionZh: h.descriptionZh || h.description || '',
      application: h.application || '',
      applicationZh: h.applicationZh || h.application || '',
      example: h.example,
    })),
    values: (persona.values || []).map(v => ({
      name: v.name,
      nameZh: v.nameZh || v.name,
      priority: v.priority,
      description: v.description || '',
      descriptionZh: (v as any).descriptionZh || v.description || '',
    })),
    tensions: (persona.tensions || []).map(t => ({
      dimension: t.dimension,
      dimensionZh: (t as any).dimensionZh || t.dimension || '',
      tension: t.tension || '',
      tensionZh: t.tensionZh || t.tension || '',
      description: t.description || '',
      descriptionZh: t.descriptionZh || t.description || '',
      positivePole: t.positivePole || '',
      negativePole: t.negativePole || '',
    })),
    antiPatterns: persona.antiPatterns || [],
    antiPatternsZh: (persona as any).antiPatternsZh || persona.antiPatterns || [],
    honestBoundaries: (persona.honestBoundaries || []).map(hb => ({
      text: hb.text || '',
      textZh: hb.textZh || hb.text || '',
      reason: hb.reason || '',
      reasonZh: hb.reasonZh || hb.reason || '',
    })),
    strengths: persona.strengths || [],
    strengthsZh: (persona as any).strengthsZh || persona.strengths || [],
    blindspots: persona.blindspots || [],
    blindspotsZh: (persona as any).blindspotsZh || persona.blindspots || [],
    sources: persona.sources || [],
    keyConcepts: [],
    confidence: 'medium',
    confidenceNotes: [],
  };
}

function personaToExpressionLayer(persona: Persona): ExpressionLayer {
  const dna = persona.expressionDNA;
  return {
    vocabulary: dna.vocabulary || [],
    sentenceStyle: dna.sentenceStyle || [],
    forbiddenWords: dna.forbiddenWords || [],
    tone: dna.humorStyle ? 'humorous' : 'formal',
    certaintyLevel: dna.certaintyLevel || 'medium',
    rhetoricalHabit: dna.rhetoricalHabit || '',
    quotePatterns: dna.quotePatterns || [],
    rhythm: dna.rhythm || '',
    rhythmDescription: dna.rhythm || '',
    chineseAdaptation: dna.chineseAdaptation || '',
    verbalMarkers: dna.verbalMarkers || [],
    speakingStyle: dna.speakingStyle || '',
    confidence: 'medium',
    confidenceNotes: [],
  };
}

// ─── Batch Processing ────────────────────────────────────────────────────────

export interface BatchPipelineOptions {
  questions: string[];
  personas: Persona[];
  /** LLM instance for sophisticated gap handling */
  llm?: any;
}

export async function runBatchPipeline(
  options: BatchPipelineOptions
): Promise<GapAwareResponse[]> {
  const { questions, personas, llm } = options;

  return Promise.all(
    questions.map((question, i) =>
      runFastPipeline({
        question,
        persona: personas[i],
        normalResponse: null,
      })
    )
  );
}

// ─── Quick Check (boolean, zero compute) ─────────────────────────────────────

/**
 * Zero-cost heuristic: does this question likely fall outside corpus coverage?
 * Use this for the absolute hot path before deciding whether to run the full pipeline.
 */
export function quickGapCheck(question: string): boolean {
  // Delegate to the lightweight detector from distillation-v2-gap-detector
  const { quickKnowledgeGapCheck } = require('./distillation-v2-gap-detector');
  return quickKnowledgeGapCheck(question);
}
