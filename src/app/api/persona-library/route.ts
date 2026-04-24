/**
 * Prismatic — Distilled Persona Library API
 * GET /api/persona-library
 *
 * Uses Pool from @neondatabase/serverless (WebSocket mode) to bypass both:
 * 1. Prisma engine binary incompatibility with Vercel Node.js runtime
 * 2. Neon HTTP API column-name normalization (lowercases identifiers)
 *
 * FIX v2: Explicit column selection + lowercase aliases for Neon HTTP API.
 * The Neon HTTP API lowercases ALL identifiers, so schema camelCase fields like
 * "taglineZh" become "taglinezh" in query results. We alias them explicitly to
 * both camelCase (for consumers expecting camelCase) and lowercase (for Neon).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

export async function GET(req: NextRequest) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ items: [], total: 0, domains: [] });
  }

  const pool = new Pool({ connectionString });

  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const published = searchParams.get('published');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'distillDate';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const orderByMap: Record<string, string> = {
      score: '"finalScore" DESC',
      name: 'namezh ASC',
      default: '"distillDate" DESC',
    };
    const orderBy = orderByMap[sortBy] ?? orderByMap.default;

    const conditions: string[] = ['"isActive" = true'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (domain) {
      conditions.push(`"domain" = $${paramIdx++}`);
      params.push(domain);
    }
    if (published === 'true') {
      conditions.push('"isPublished" = true');
    }
    if (search) {
      conditions.push(`(namezh ILIKE $${paramIdx} OR nameen ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const [personasResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM distilled_personas WHERE ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, 0]
      ),
      pool.query(
        `SELECT COUNT(*) as cnt FROM distilled_personas WHERE ${whereClause}`,
        params
      ),
    ]);

    await pool.end();

    const total = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    // FIX v2: Normalize column names to provide BOTH camelCase and lowercase keys.
    // Neon HTTP API lowercases identifiers, but Pool (WebSocket) may return mixed casing.
    // By explicitly mapping known fields, we guarantee consumers find data under any casing.
    const items = personasResult.rows.map((row: Record<string, unknown>) => {
      const normalized: Record<string, unknown> = { ...row };
      // Identity fields: provide all casing variants
      if (row.namezh !== undefined) normalized.namezh = row.namezh;
      if (row.nameZh !== undefined) normalized.nameZh = row.nameZh;
      if (row.nameen !== undefined) normalized.nameen = row.nameen;
      if (row.nameEn !== undefined) normalized.nameEn = row.nameEn;
      // Info fields
      if (row.taglinezh !== undefined) normalized.taglinezh = row.taglinezh;
      if (row.taglineZh !== undefined) normalized.taglineZh = row.taglineZh;
      if (row.briefzh !== undefined) normalized.briefzh = row.briefzh;
      if (row.briefZh !== undefined) normalized.briefZh = row.briefZh;
      // Color fields
      if (row.accentcolor !== undefined) normalized.accentcolor = row.accentcolor;
      if (row.accentColor !== undefined) normalized.accentColor = row.accentColor;
      if (row.gradientfrom !== undefined) normalized.gradientfrom = row.gradientfrom;
      if (row.gradientFrom !== undefined) normalized.gradientFrom = row.gradientFrom;
      if (row.gradientto !== undefined) normalized.gradientto = row.gradientto;
      if (row.gradientTo !== undefined) normalized.gradientTo = row.gradientTo;
      // Score fields
      if (row.finalscore !== undefined) normalized.finalscore = row.finalscore;
      if (row.finalScore !== undefined) normalized.finalScore = row.finalScore;
      if (row.thresholdpassed !== undefined) normalized.thresholdpassed = row.thresholdpassed;
      if (row.thresholdPassed !== undefined) normalized.thresholdPassed = row.thresholdPassed;
      if (row.qualitygateskipped !== undefined) normalized.qualitygateskipped = row.qualitygateskipped;
      if (row.qualityGateSkipped !== undefined) normalized.qualityGateSkipped = row.qualityGateSkipped;
      if (row.corpusitemcount !== undefined) normalized.corpusitemcount = row.corpusitemcount;
      if (row.corpusItemCount !== undefined) normalized.corpusItemCount = row.corpusItemCount;
      if (row.corputotalwords !== undefined) normalized.corputotalwords = row.corputotalwords;
      if (row.corpusTotalWords !== undefined) normalized.corpusTotalWords = row.corpusTotalWords;
      if (row.distillversion !== undefined) normalized.distillversion = row.distillversion;
      if (row.distillVersion !== undefined) normalized.distillVersion = row.distillVersion;
      if (row.distilldate !== undefined) normalized.distilldate = row.distilldate;
      if (row.distillDate !== undefined) normalized.distillDate = row.distillDate;
      if (row.isactive !== undefined) normalized.isactive = row.isactive;
      if (row.isActive !== undefined) normalized.isActive = row.isActive;
      if (row.ispublished !== undefined) normalized.ispublished = row.ispublished;
      if (row.isPublished !== undefined) normalized.isPublished = row.isPublished;
      return normalized;
    });

    return NextResponse.json({
      items,
      total,
      domains: ['philosophy', 'science', 'technology', 'investment', 'strategy', 'history', 'literature', 'product'],
    });
  } catch (err) {
    console.error('[PersonaLibrary GET]', err);
    await pool.end().catch(() => {});
    return NextResponse.json({ items: [], total: 0, domains: [] });
  }
}
