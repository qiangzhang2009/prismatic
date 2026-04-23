/**
 * User Conversations API
 * GET /api/conversations — Returns all conversations for the authenticated user
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

export async function GET(req: NextRequest) {
  try {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') || '20', 10));
    const offset = (page - 1) * pageSize;

    const pool = getPool();

    const [rows, countResult] = await Promise.all([
      pool.query(`
        SELECT
          c.id,
          c.mode,
          c."personaIds",
          c."messageCount",
          c."totalTokens",
          c."totalCost",
          c."createdAt",
          c."updatedAt",
          msgs.first_content,
          msgs.last_content
        FROM conversations c
        LEFT JOIN LATERAL (
          SELECT
            MIN(m.content) as first_content,
            MAX(m.content) as last_content
          FROM messages m
          WHERE m."conversationId" = c.id
        ) msgs ON true
        WHERE c."userId" = $1
        ORDER BY c."updatedAt" DESC
        LIMIT $2 OFFSET $3
      `, [userId, pageSize, offset]),
      pool.query(`SELECT COUNT(*) as cnt FROM conversations WHERE "userId" = $1`, [userId]),
    ]);

    await pool.end();

    const total = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    const conversations = rows.rows.map((r: any) => ({
      id: r.id,
      mode: r.mode,
      personaIds: r.personaIds || [],
      messageCount: r.messageCount,
      totalTokens: r.totalTokens,
      totalCost: r.totalCost,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      firstContent: r.first_content,
      lastContent: r.last_content,
    }));

    return NextResponse.json({
      conversations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[API/conversations]', err);
    return NextResponse.json({ conversations: [], total: 0, error: String(err) }, { status: 500 });
  }
}
