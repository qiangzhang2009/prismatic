/**
 * GET /api/debug/quota
 * Returns the server's authoritative daily message count for the current user.
 * Use this to diagnose quota display mismatches.
 * Access: https://prismatic.world/api/debug/quota
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { getDailyMessageCount } from '@/lib/message-stats';
import { getFeatureLimit } from '@/lib/auth-store';

export async function GET(req: NextRequest) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetDate = searchParams.get('date') ?? undefined;

  let count: number;
  let error: string | null = null;
  try {
    count = await getDailyMessageCount(userId, targetDate);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    count = -1;
  }

  const limits = getFeatureLimit('FREE');
  const allowed = count < limits.dailyMessages;

  return NextResponse.json({
    userId,
    date: targetDate ?? new Date().toISOString().split('T')[0],
    serverCount: count,
    limit: limits.dailyMessages,
    allowed,
    error,
  });
}
