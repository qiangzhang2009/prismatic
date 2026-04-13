/**
 * GET /api/admin/usage — Global usage stats (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import {
  getGlobalUsageStats,
  getTopUsersToday,
  getAllUsersUsage,
} from '@/lib/message-stats';

// Add timeout wrapper for database operations
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '7'), 30);

  try {
    // Fetch with timeout to prevent hanging
    const [globalStats, topUsers, allUsersUsage] = await Promise.all([
      withTimeout(getGlobalUsageStats(days), 8000),
      withTimeout(getTopUsersToday(10), 5000),
      withTimeout(getAllUsersUsage(days), 8000),
    ]);

    // Return data or empty defaults if timeout
    return NextResponse.json({
      globalStats: globalStats ?? { todayTotal: 0, weekTotal: 0, avgDaily: 0, dailyBreakdown: [], byHour: [] },
      topUsers: topUsers ?? [],
      allUsersUsage: allUsersUsage ?? {},
      days,
      note: globalStats === null ? 'Data temporarily unavailable' : undefined,
    });
  } catch (error) {
    console.error('[Admin Usage API] Error:', error);
    // Return empty data instead of error to prevent 500
    return NextResponse.json({
      globalStats: { todayTotal: 0, weekTotal: 0, avgDaily: 0, dailyBreakdown: [], byHour: [] },
      topUsers: [],
      allUsersUsage: {},
      days,
      note: 'Data temporarily unavailable',
    });
  }
}
