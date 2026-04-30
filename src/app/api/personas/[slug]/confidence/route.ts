/**
 * GET /api/personas/[slug]/confidence
 * Returns distillation confidence score for a persona.
 * Data source: DB distilled_personas table (scoreBreakdown + finalScore)
 * Falls back to static confidence.ts if no DB record.
 *
 * DB stores scoreBreakdown in NESTED format: { voice, knowledge, reasoning, safety }
 * (from zero pipeline's ScoreBreakdown type in zero/types.ts)
 * This API returns it FLATTENED to match frontend expectations:
 *   { voiceFidelity, knowledgeDepth, reasoningPattern, safetyCompliance }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPersonaConfidence } from '@/lib/confidence';

interface RawBreakdown {
  voiceFidelity?: number;
  knowledgeDepth?: number;
  reasoningPattern?: number;
  safetyCompliance?: number;
  voice?: number | { overall?: number };
  knowledge?: number | { overall?: number };
  reasoning?: number | { overall?: number };
  safety?: number | { overall?: number };
}

/**
 * 统一解析 scoreBreakdown，支持三种格式：
 * 1. FLAT_NEW: { voiceFidelity, knowledgeDepth, reasoningPattern, safetyCompliance }
 * 2. FLAT_OLD: { voice, knowledge, reasoning, safety } (直接数字)
 * 3. NESTED:   { voice: { overall }, knowledge: { overall }, reasoning: { overall }, safety: { overall } }
 */
function normalizeBreakdown(raw: unknown): ScoreBreakdown {
  const obj = (raw ?? {}) as RawBreakdown;
  // FLAT_NEW: voiceFidelity, knowledgeDepth, ...
  if (obj.voiceFidelity !== undefined || obj.knowledgeDepth !== undefined) {
    return {
      voiceFidelity: obj.voiceFidelity ?? 0,
      knowledgeDepth: obj.knowledgeDepth ?? 0,
      reasoningPattern: obj.reasoningPattern ?? 0,
      safetyCompliance: obj.safetyCompliance ?? 0,
    };
  }
  // FLAT_OLD: voice, knowledge, reasoning, safety as bare numbers
  if (typeof obj.voice === 'number') {
    return {
      voiceFidelity: obj.voice ?? 0,
      knowledgeDepth: typeof obj.knowledge === 'number' ? obj.knowledge : (obj.knowledge as { overall?: number })?.overall ?? 0,
      reasoningPattern: typeof obj.reasoning === 'number' ? obj.reasoning : (obj.reasoning as { overall?: number })?.overall ?? 0,
      safetyCompliance: typeof obj.safety === 'number' ? obj.safety : (obj.safety as { overall?: number })?.overall ?? 0,
    };
  }
  // NESTED: voice: { overall }, ...
  const nested = obj as RawBreakdown;
  const voiceVal = nested.voice;
  const knowledgeVal = nested.knowledge;
  const reasoningVal = nested.reasoning;
  const safetyVal = nested.safety;
  return {
    voiceFidelity: nested.voiceFidelity ?? (typeof voiceVal === 'object' ? (voiceVal as { overall?: number }).overall ?? 0 : 0),
    knowledgeDepth: nested.knowledgeDepth ?? (typeof knowledgeVal === 'object' ? (knowledgeVal as { overall?: number }).overall ?? 0 : 0),
    reasoningPattern: nested.reasoningPattern ?? (typeof reasoningVal === 'object' ? (reasoningVal as { overall?: number }).overall ?? 0 : 0),
    safetyCompliance: nested.safetyCompliance ?? (typeof safetyVal === 'object' ? (safetyVal as { overall?: number }).overall ?? 0 : 0),
  };
}

function computeOverall(b: ScoreBreakdown): number {
  return Math.round(
    b.voiceFidelity * 0.30 +
    b.knowledgeDepth * 0.30 +
    b.reasoningPattern * 0.25 +
    b.safetyCompliance * 0.15
  );
}

interface ScoreBreakdown {
  voiceFidelity: number;
  knowledgeDepth: number;
  reasoningPattern: number;
  safetyCompliance: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;

  // Try DB first
  try {
    const dbPersona = await prisma.distilledPersona.findUnique({
      where: { slug },
      select: {
        finalScore: true,
        scoreBreakdown: true,
        scoreFindings: true,
        corpusSources: true,
      },
    });

    if (dbPersona && dbPersona.finalScore > 0) {
      const breakdown = normalizeBreakdown(dbPersona.scoreBreakdown ?? {});
      const overall = dbPersona.finalScore > 0
        ? dbPersona.finalScore
        : computeOverall(breakdown);

      return NextResponse.json(
        {
          overall,
          breakdown,
          findings: (dbPersona.scoreFindings ?? []) as any[],
          grade: overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F',
          starRating: overall >= 90 ? 5 : overall >= 75 ? 4 : overall >= 60 ? 3 : overall >= 45 ? 2 : 1,
          dataSources: (dbPersona.corpusSources ?? []) as any[],
          mainGaps: [],
          source: 'db',
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    }
  } catch (err) {
    console.error('[Confidence API] DB query failed:', err);
  }

  // Fall back to static data
  const static_ = getPersonaConfidence(slug);
  if (!static_) {
    return NextResponse.json({ error: 'No confidence data available' }, { status: 404 });
  }

  return NextResponse.json(
    {
      overall: static_.overall,
      breakdown: static_.breakdown,
      findings: [],
      grade: static_.grade,
      starRating: static_.starRating,
      dataSources: static_.dataSources,
      mainGaps: static_.mainGaps,
      source: 'static',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
