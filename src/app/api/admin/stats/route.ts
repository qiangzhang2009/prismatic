/**
 * GET /api/admin/stats — Get user statistics (admin only)
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdminRequest, getUserStats } from '@/lib/user-management';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/Stats] Auth error:', authErr);
    return NextResponse.json({ error: 'Authentication failed', detail: String(authErr) }, { status: 401 });
  }

  if (!adminId) {
    console.error('[Admin/Stats] adminId null — JWT valid but DB check failed for user');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get('debug') === 'true') {
    try {
      const allRows = await withTimeout(
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            plan: true,
            emailVerified: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        8000
      );
      if (!allRows) {
        return NextResponse.json({ error: 'Database timeout' }, { status: 503 });
      }
      return NextResponse.json({
        mode: 'debug',
        totalRows: allRows.length,
        activeRows: allRows.filter(r => r.status === 'ACTIVE').length,
        inactiveRows: allRows.filter(r => r.status !== 'ACTIVE').length,
        users: allRows,
      });
    } catch (e: any) {
      console.error('[Admin/Stats/Debug]', e);
      return NextResponse.json({ error: e.message || 'Debug mode error' });
    }
  }

  try {
    const stats = await withTimeout(getUserStats(), 8000);
    if (!stats) {
      return NextResponse.json({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
        byRole: {},
        byPlan: {},
        note: 'Data temporarily unavailable',
      });
    }
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[Admin/Stats]', err);
    return NextResponse.json({
      totalUsers: 0,
      activeUsers: 0,
      newUsersToday: 0,
      byRole: {},
      byPlan: {},
      note: 'Data temporarily unavailable',
    });
  }
}
