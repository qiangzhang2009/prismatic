/**
 * Prismatic — Distilled Persona Library API
 * GET /api/persona-library
 *
 * Uses Pool from @neondatabase/serverless (WebSocket mode) to bypass both:
 * 1. Prisma engine binary incompatibility with Vercel Node.js runtime
 * 2. Neon HTTP API column-name normalization (lowercases identifiers)
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

    // Use SELECT * to avoid column-name issues (some columns may be lowercase in DB)
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

    return NextResponse.json({
      items: personasResult.rows,
      total,
      domains: ['philosophy', 'science', 'technology', 'investment', 'strategy', 'history', 'literature', 'product'],
    });
  } catch (err) {
    console.error('[PersonaLibrary GET]', err);
    await pool.end().catch(() => {});
    return NextResponse.json({ items: [], total: 0, domains: [] });
  }
}
