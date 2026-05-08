/**
 * GET /api/quota/check — Server-authoritative daily quota pre-check
 * Used by the frontend before sending a message to avoid false-positive
 * pre-checks based on stale localStorage counts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { getPool } from '@/lib/db-pool';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getPool();

    // 1. Get user plan + credits in one query
    const userRows = await pool.query(
      `SELECT plan::text AS plan, credits, "dailyCredits" FROM users WHERE id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [userId]
    );

    if (userRows.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { plan, credits, dailyCredits } = userRows.rows[0] as { plan: string; credits: number; dailyCredits: number };

    // Paid users: unlimited
    if (plan !== 'FREE') {
      return NextResponse.json({ allowed: true, current: 0, limit: 999999, reason: 'paid' });
    }

    // Has daily credits: unlimited daily (优先检查每日积分)
    if (dailyCredits > 0) {
      return NextResponse.json({ allowed: true, current: 0, limit: dailyCredits, reason: 'daily_credits' });
    }

    // Has paid credits: unlimited daily
    if (credits > 0) {
      return NextResponse.json({ allowed: true, current: 0, limit: credits, reason: 'credits' });
    }

    // FREE + no credits: check daily count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count messages today (excluding [message-counted] placeholder rows and skipDailyCount rows)
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM messages
       WHERE "userId" = $1
         AND "createdAt" >= $2
         AND "createdAt" < $3
         AND content != $4
         AND (
           metadata IS NULL
           OR metadata::text = 'null'
           OR metadata->>'skipDailyCount' IS NULL
           OR metadata->>'skipDailyCount' = 'false'
         )`,
      [userId, today, tomorrow, '[message-counted]']
    );

    const current = countResult.rows[0]?.cnt ?? 0;
    const DAILY_LIMIT = 20;

    return NextResponse.json({
      allowed: current < DAILY_LIMIT,
      current,
      limit: DAILY_LIMIT,
      reason: 'daily_free',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quota/check] Error:', msg);
    // Fail-open: allow the message if DB check fails
    return NextResponse.json({ allowed: true, current: 0, limit: 20, reason: 'db_error' });
  }
}
