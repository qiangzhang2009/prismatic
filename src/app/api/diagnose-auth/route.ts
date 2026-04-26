/**
 * Diagnostic endpoint: GET /api/diagnose-auth
 * Returns the authenticated userId, conversation IDs, and recent errors.
 * Used to debug conversation saving issues.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

function getPool() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: DATABASE_URL });
}

export async function GET(req: NextRequest) {
  // 1. Auth check
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated', userId: null }, { status: 401 });
  }

  // 2. Get user info
  const pool = getPool();
  try {
    const userRows = await pool.query(
      `SELECT id, email, name, role, plan, credits FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const user = userRows.rows[0] || null;

    // 3. Get conversations for this user
    const convRows = await pool.query(
      `SELECT id, mode, "personaIds", "messageCount", "createdAt", "updatedAt"
       FROM conversations WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 20`,
      [userId]
    );

    // 4. Count messages for this user
    const msgRows = await pool.query(
      `SELECT COUNT(*) as cnt FROM messages WHERE "userId" = $1`,
      [userId]
    );
    const msgCount = parseInt(msgRows.rows[0]?.cnt ?? '0', 10);

    // 5. Simulate conversation ID for various personas
    function buildConvId(uid: string, personaIds: string[]): string {
      const sorted = [...personaIds].sort().join(':');
      const payload = `u:${uid}:${sorted}`;
      const hash = crypto.createHash('sha256').update(payload).digest('base64url').slice(0, 16);
      return `conv_${hash}`;
    }
    const testConvIds = {
      'wang-dongyue': buildConvId(userId, ['wang-dongyue']),
      'ni-haixia': buildConvId(userId, ['ni-haixia']),
      'both': buildConvId(userId, ['ni-haixia', 'wang-dongyue'].sort()),
    };

    // 6. Check if those conversation IDs already exist
    const existingConvs: Record<string, { exists: boolean; owner: string | null }> = {};
    for (const [key, convId] of Object.entries(testConvIds)) {
      const r = await pool.query(
        `SELECT "userId" FROM conversations WHERE id = $1 LIMIT 1`,
        [convId]
      );
      existingConvs[key] = { exists: r.rows.length > 0, owner: r.rows[0]?.userId || null };
    }

    return NextResponse.json({
      userId,
      user,
      conversations: convRows.rows,
      conversationCount: convRows.rows.length,
      messageCount: msgCount,
      testConversationIds: testConvIds,
      existingConversations: existingConvs,
      dbUrlSet: !!DATABASE_URL,
    });
  } finally {
    await pool.end();
  }
}
