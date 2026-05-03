/**
 * GET /api/tcm/conversations
 * List all TCM conversations for the authenticated user.
 */

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const pool = getPool();
    try {
      const result = await pool.query(`
        SELECT
          id,
          title,
          mode,
          participants,
          "messageCount",
          "totalTokens",
          "totalCost",
          "createdAt",
          "updatedAt"
        FROM conversations
        WHERE "userId" = $1 AND type = 'TCM'
        ORDER BY "updatedAt" DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      const countResult = await pool.query(`
        SELECT COUNT(*) as total FROM conversations
        WHERE "userId" = $1 AND type = 'TCM'
      `, [userId]);

      const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

      return NextResponse.json({
        conversations: result.rows.map(row => ({
          id: row.id,
          title: row.title,
          mode: row.mode,
          participants: row.participants,
          messageCount: row.messageCount,
          totalTokens: row.totalTokens,
          totalCost: row.totalCost ? parseFloat(String(row.totalCost)) : 0,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        total,
        limit,
        offset,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[TCM Conversations] Error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
