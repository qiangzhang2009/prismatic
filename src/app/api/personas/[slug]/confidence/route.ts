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

interface NestedBreakdown {
  voice?: { overall?: number };
  knowledge?: { overall?: number };
  reasoning?: { overall?: number };
  safety?: { overall?: number };
  voiceFidelity?: number;
  knowledgeDepth?: number;
  reasoningPattern?: number;
  safetyCompliance?: number;
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
      const nested = (dbPersona.scoreBreakdown ?? {}) as NestedBreakdown;

      // Flatten nested breakdown to match frontend type
      const breakdown = {
        voiceFidelity: nested.voiceFidelity ?? nested.voice?.overall ?? 0,
        knowledgeDepth: nested.knowledgeDepth ?? nested.knowledge?.overall ?? 0,
        reasoningPattern: nested.reasoningPattern ?? nested.reasoning?.overall ?? 0,
        safetyCompliance: nested.safetyCompliance ?? nested.safety?.overall ?? 0,
      };

      const overall = dbPersona.finalScore ?? (
        Math.round(
          breakdown.voiceFidelity * 0.30 +
          breakdown.knowledgeDepth * 0.30 +
          breakdown.reasoningPattern * 0.25 +
          breakdown.safetyCompliance * 0.15
        )
      );

      return NextResponse.json({
        overall,
        breakdown,
        findings: (dbPersona.scoreFindings ?? []) as any[],
        grade: overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F',
        starRating: overall >= 90 ? 5 : overall >= 75 ? 4 : overall >= 60 ? 3 : overall >= 45 ? 2 : 1,
        dataSources: (dbPersona.corpusSources ?? []) as any[],
        mainGaps: [],
        source: 'db',
      });
    }
  } catch (err) {
    console.error('[Confidence API] DB query failed:', err);
  }

  // Fall back to static data
  const static_ = getPersonaConfidence(slug);
  if (!static_) {
    return NextResponse.json({ error: 'No confidence data available' }, { status: 404 });
  }

  return NextResponse.json({
    overall: static_.overall,
    breakdown: static_.breakdown,
    findings: [],
    grade: static_.grade,
    starRating: static_.starRating,
    dataSources: static_.dataSources,
    mainGaps: static_.mainGaps,
    source: 'static',
  });
}
