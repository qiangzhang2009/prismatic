/**
 * GET /api/admin/sync/stats — Sync statistics for admin dashboard
 * Fixed: now uses authenticateAdminRequest (prismatic_token JWT) instead of
 * getServerSession (next-auth session), so it works for demo accounts and
 * users logged in via the custom JWT system.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdminRequest } from '@/lib/user-management';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/SyncStats] Auth error:', authErr);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      totalDevices,
      totalLocalConversations,
      totalSyncLogs,
      unresolvedConflicts,
      recentConflicts,
      recentDevices,
      recentLogs,
      dailySyncCounts,
      successLogs,
    ] = await Promise.all([
      withTimeout(prisma.device.count()),
      withTimeout(prisma.localConversation.count()),
      withTimeout(prisma.syncLog.count()),
      withTimeout(prisma.syncConflict.count({ where: { resolution: null } })),
      withTimeout(prisma.syncConflict.findMany({
        orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, userId: true, conversationKey: true, conflictType: true, resolution: true, createdAt: true, personaIds: true },
      })),
      withTimeout(prisma.device.findMany({
        orderBy: { lastActiveAt: 'desc' }, take: 20,
        include: { _count: { select: { localConversations: true } } },
      })),
      withTimeout(prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' }, take: 50,
        select: { id: true, userId: true, deviceId: true, direction: true, pushedCount: true, pulledCount: true, mergedCount: true, conflictCount: true, status: true, durationMs: true, createdAt: true },
      })),
      withTimeout(prisma.syncLog.groupBy({
        by: ['createdAt'],
        _count: true,
        _sum: { pushedCount: true, pulledCount: true },
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      })),
      withTimeout(prisma.syncLog.findMany({
        where: { status: 'SUCCESS' },
        select: { durationMs: true, conflictCount: true },
      })),
    ]);

    const totalSyncs = successLogs?.length ?? 0;
    const avgDurationMs = totalSyncs > 0
      ? (successLogs!.reduce((sum, l) => sum + (l.durationMs ?? 0), 0)) / totalSyncs : 0;
    const totalConflicts = successLogs?.reduce((sum, l) => sum + (l.conflictCount ?? 0), 0) ?? 0;
    const avgConflictRate = totalSyncs > 0 ? totalConflicts / totalSyncs : 0;
    const syncSuccessRate = (totalSyncLogs ?? 0) > 0 ? totalSyncs / (totalSyncLogs ?? 0) : 0;

    const dailyStatsMap: Record<string, { date: string; pushCount: number; pullCount: number }> = {};
    for (const row of (dailySyncCounts ?? [])) {
      const dateKey = new Date(row.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      if (!dailyStatsMap[dateKey]) {
        dailyStatsMap[dateKey] = { date: dateKey, pushCount: 0, pullCount: 0 };
      }
      dailyStatsMap[dateKey].pushCount += row._sum.pushedCount ?? 0;
      dailyStatsMap[dateKey].pullCount += row._sum.pulledCount ?? 0;
    }
    const dailyStats = Object.values(dailyStatsMap).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      stats: {
        totalDevices: totalDevices ?? 0,
        totalLocalConversations: totalLocalConversations ?? 0,
        totalSyncs,
        unresolvedConflicts: unresolvedConflicts ?? 0,
        avgDurationMs,
        avgConflictRate,
        syncSuccessRate,
      },
      conflicts: (recentConflicts ?? []).map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
      devices: (recentDevices ?? []).map(d => ({
        ...d,
        conversationCount: d._count.localConversations,
        lastActiveAt: d.lastActiveAt?.toISOString() ?? null,
        lastSyncedAt: d.lastSyncedAt?.toISOString() ?? null,
      })),
      recentLogs: (recentLogs ?? []).map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
      dailyStats,
    });
  } catch (error) {
    console.error('[Admin/SyncStats]', error);
    return NextResponse.json({
      stats: { totalDevices: 0, totalLocalConversations: 0, totalSyncs: 0, unresolvedConflicts: 0, avgDurationMs: 0, avgConflictRate: 0, syncSuccessRate: 0 },
      conflicts: [],
      devices: [],
      recentLogs: [],
      dailyStats: [],
    });
  }
}
