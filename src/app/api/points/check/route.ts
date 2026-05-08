/**
 * GET /api/points/check — Server-authoritative points pre-check
 * 
 * 新纯积分系统的积分检查 API
 * 用于前端在发送消息前检查积分是否充足
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { checkUserPoints } from '@/lib/points-service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pointsCheck = await checkUserPoints(userId);
    return NextResponse.json(pointsCheck);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[points/check] Error:', msg);
    // Fail-open: allow the message if DB check fails
    return NextResponse.json({
      allowed: true,
      totalPoints: 999,
      dailyPoints: 20,
      paidPoints: 0,
      reason: 'db_error',
    });
  }
}
