/**
 * Prismatic — Single Distilled Persona API
 * GET /api/persona-library/[slug]
 *
 * FIX v2: Normalize column names to provide BOTH camelCase and lowercase keys
 * (same approach as the list route — needed because Neon HTTP API lowercases identifiers).
 *
 * ISR: revalidates every hour; stale-while-revalidate up to 24h for fast TTFB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

const globalForPool = globalThis as unknown as { __pool: Pool | undefined };

function getPool(): Pool {
  if (!globalForPool.__pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set');
    globalForPool.__pool = new Pool({ connectionString });
  }
  return globalForPool.__pool;
}

if (process.env.NODE_ENV !== 'production') globalForPool.__pool = undefined;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM distilled_personas WHERE slug = $1 AND "isActive" = true LIMIT 1`,
      [slug]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const normalized: Record<string, unknown> = { ...row };
      if (row.nameZh !== undefined) normalized.nameZh = row.nameZh;
      if (row.nameen !== undefined) normalized.nameen = row.nameen;
      if (row.nameEn !== undefined) normalized.nameEn = row.nameEn;
      if (row.taglinezh !== undefined) normalized.taglinezh = row.taglinezh;
      if (row.taglineZh !== undefined) normalized.taglineZh = row.taglineZh;
      if (row.briefzh !== undefined) normalized.briefzh = row.briefzh;
      if (row.briefZh !== undefined) normalized.briefZh = row.briefZh;
      if (row.accentcolor !== undefined) normalized.accentcolor = row.accentcolor;
      if (row.accentColor !== undefined) normalized.accentColor = row.accentColor;
      if (row.gradientfrom !== undefined) normalized.gradientfrom = row.gradientfrom;
      if (row.gradientFrom !== undefined) normalized.gradientFrom = row.gradientFrom;
      if (row.gradientto !== undefined) normalized.gradientto = row.gradientto;
      if (row.gradientTo !== undefined) normalized.gradientTo = row.gradientTo;
      if (row.finalscore !== undefined) normalized.finalscore = row.finalscore;
      if (row.finalScore !== undefined) normalized.finalScore = row.finalScore;
      if (row.thresholdpassed !== undefined) normalized.thresholdpassed = row.thresholdpassed;
      if (row.thresholdPassed !== undefined) normalized.thresholdPassed = row.thresholdPassed;
      if (row.distillversion !== undefined) normalized.distillversion = row.distillversion;
      if (row.distillVersion !== undefined) normalized.distillVersion = row.distillVersion;
      if (row.distilldate !== undefined) normalized.distilldate = row.distilldate;
      if (row.distillDate !== undefined) normalized.distillDate = row.distillDate;
      if (row.isactive !== undefined) normalized.isactive = row.isactive;
      if (row.isActive !== undefined) normalized.isActive = row.isActive;
      if (row.ispublished !== undefined) normalized.ispublished = row.ispublished;
      if (row.isPublished !== undefined) normalized.isPublished = row.isPublished;
      return NextResponse.json(
        { source: 'distilled', persona: normalized, corpusItems: [] },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    }

    const { getPersonaById } = await import('@/lib/personas');
    const codePersona = getPersonaById(slug);
    if (codePersona) {
      return NextResponse.json(
        { source: 'code', persona: codePersona, corpusItems: [] },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    }

    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  } catch (err) {
    console.error('[PersonaLibrary GET slug]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const pool = new Pool({ connectionString });

  try {
    const body = await req.json();
    const allowedFields = [
      'isPublished', 'isActive', 'tagline', 'taglineZh', 'brief', 'briefZh',
      'avatar', 'accentColor', 'gradientFrom', 'gradientTo',
    ];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`"${field}" = $${paramIdx++}`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(slug);
    const result = await pool.query(
      `UPDATE distilled_personas SET ${setClauses.join(', ')} WHERE slug = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('[PersonaLibrary PUT]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const pool = new Pool({ connectionString });

  try {
    await pool.query(`UPDATE distilled_personas SET "isActive" = false WHERE slug = $1`, [slug]);
    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error('[PersonaLibrary DELETE]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
