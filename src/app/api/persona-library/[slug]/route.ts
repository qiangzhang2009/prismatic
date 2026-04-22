/**
 * Prismatic — Single Distilled Persona API
 * GET /api/persona-library/[slug]
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query(
      `SELECT * FROM distilled_personas WHERE slug = $1 AND "isActive" = true LIMIT 1`,
      [slug]
    );
    await pool.end();

    if (result.rows.length > 0) {
      return NextResponse.json({
        source: 'distilled',
        persona: result.rows[0],
        corpusItems: [],
      });
    }

    const { getPersonaById } = await import('@/lib/personas');
    const codePersona = getPersonaById(slug);
    if (codePersona) {
      return NextResponse.json({
        source: 'code',
        persona: codePersona,
        corpusItems: [],
      });
    }

    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  } catch (err) {
    console.error('[PersonaLibrary GET slug]', err);
    await pool.end().catch(() => {});
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
      await pool.end();
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(slug);
    const result = await pool.query(
      `UPDATE distilled_personas SET ${setClauses.join(', ')} WHERE slug = $${paramIdx} RETURNING *`,
      values
    );
    await pool.end();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('[PersonaLibrary PUT]', err);
    await pool.end().catch(() => {});
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
    await pool.end();
    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error('[PersonaLibrary DELETE]', err);
    await pool.end().catch(() => {});
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
