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
      const scoreBreakdown = (row.scorebreakdown ?? row.scoreBreakdown ?? {}) as Record<string, number>;
      const qualityGrade = (row.qualitygrade ?? row.qualityGrade ?? 'F') as string;

      const voiceFidelity = scoreBreakdown.voiceFidelity ?? 0;
      const knowledgeDepth = scoreBreakdown.knowledgeDepth ?? 0;
      const reasoningPattern = scoreBreakdown.reasoningPattern ?? 0;
      const safetyCompliance = scoreBreakdown.safetyCompliance ?? 0;

      // Recalculate overall from breakdown (source of truth)
      const overall = Math.round(
        voiceFidelity * 0.30 +
        knowledgeDepth * 0.30 +
        reasoningPattern * 0.25 +
        safetyCompliance * 0.15
      );

      const starRating = overall >= 90 ? 5 : overall >= 75 ? 4 : overall >= 60 ? 3 : overall >= 45 ? 2 : 1;

      dbScores[slug] = {
        overall: finalScore > 0 ? finalScore : overall,
        breakdown: scoreBreakdown,
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
