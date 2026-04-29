/**
 * GET /api/personas/confidence
 * Returns distillation confidence scores for ALL (or specified) personas in one call.
 * Data source: DB distilled_personas table (finalScore + scoreBreakdown).
 * Falls back to static confidence.ts for personas without DB records.
 *
 * This is a batch endpoint to avoid N+1 fetches on the persona library page.
 *
 * Query params:
 *   slugs=slug1,slug2,...  — filter to specific personas (optional)
 */
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

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
function normalizeBreakdown(raw: unknown): {
  voiceFidelity: number;
  knowledgeDepth: number;
  reasoningPattern: number;
  safetyCompliance: number;
} {
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
      knowledgeDepth: (obj.knowledge as number) ?? 0,
      reasoningPattern: (obj.reasoning as number) ?? 0,
      safetyCompliance: (obj.safety as number) ?? 0,
    };
  }
  // NESTED: voice: { overall }, ...
  return {
    voiceFidelity: (obj.voice as { overall?: number })?.overall ?? 0,
    knowledgeDepth: (obj.knowledge as { overall?: number })?.overall ?? 0,
    reasoningPattern: (obj.reasoning as { overall?: number })?.overall ?? 0,
    safetyCompliance: (obj.safety as { overall?: number })?.overall ?? 0,
  };
}

function computeOverall(b: { voiceFidelity: number; knowledgeDepth: number; reasoningPattern: number; safetyCompliance: number }): number {
  return Math.round(
    b.voiceFidelity * 0.30 +
    b.knowledgeDepth * 0.30 +
    b.reasoningPattern * 0.25 +
    b.safetyCompliance * 0.15
  );
}

export async function GET(req: NextRequest) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const pool = new Pool({ connectionString });

  try {
    const { searchParams } = new URL(req.url);
    const slugsParam = searchParams.get('slugs');
    const slugs = slugsParam ? slugsParam.split(',').filter(Boolean) : null;

    let query = `SELECT slug, "finalScore", "scoreBreakdown", "scoreFindings", "corpusSources", "qualityGrade" FROM distilled_personas WHERE "isActive" = true`;
    const params: unknown[] = [];

    if (slugs && slugs.length > 0) {
      query += ` AND slug = ANY($1)`;
      params.push(slugs);
    }

    const result = await pool.query(query, params);
    await pool.end();

    // Build lookup: normalize column names (Neon HTTP API lowercases identifiers)
    const dbScores: Record<string, {
      overall: number;
      breakdown: Record<string, number>;
      findings: unknown[];
      grade: string;
      starRating: 1 | 2 | 3 | 4 | 5;
      dataSources: unknown[];
      source: 'db';
    }> = {};

    for (const row of result.rows as Record<string, unknown>[]) {
      const slug = row.slug as string;
      const finalScore = parseFloat(String(row.finalscore ?? row.finalScore ?? 0));
      const rawBreakdown = (row.scorebreakdown ?? row.scoreBreakdown ?? {});
      const qualityGrade = (row.qualitygrade ?? row.qualityGrade ?? 'F') as string;

      const breakdown = normalizeBreakdown(rawBreakdown);
      const computedOverall = computeOverall(breakdown);
      const overall = finalScore > 0 ? finalScore : computedOverall;
      const starRating = overall >= 90 ? 5 : overall >= 75 ? 4 : overall >= 60 ? 3 : overall >= 45 ? 2 : 1;

      dbScores[slug] = {
        overall,
        breakdown,
        findings: (row.scorefindings ?? row.scoreFindings ?? []) as unknown[],
        grade: qualityGrade,
        starRating,
        dataSources: (row.corpsources ?? row.corpusSources ?? []) as unknown[],
        source: 'db',
      };
    }

    return NextResponse.json({ scores: dbScores, source: 'batch-api' });
  } catch (err) {
    console.error('[Confidence Batch API]', err);
    await pool.end().catch(() => {});
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
