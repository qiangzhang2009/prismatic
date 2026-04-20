import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parallel queries for all stats
    const [
      totalDevices,
      totalLocalConversations,
      totalSyncLogs,
      unresolvedConflicts,
      recentConflicts,
      recentDevices,
      recentLogs,
      dailySyncCounts,
    ] = await Promise.all([
      // Total devices
      prisma.device.count(),

      // Total local conversation snapshots
      prisma.localConversation.count(),

      // Total sync logs
      prisma.syncLog.count(),

      // Unresolved conflicts
      prisma.syncConflict.count({
        where: { resolution: null },
      }),

      // Recent conflicts (last 20)
      prisma.syncConflict.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          userId: true,
          conversationKey: true,
          conflictType: true,
          resolution: true,
          createdAt: true,
          personaIds: true,
        },
      }),

      // Recent devices (last 20)
      prisma.device.findMany({
        orderBy: { lastActiveAt: 'desc' },
        take: 20,
        include: {
          _count: {
            select: { localConversations: true },
          },
        },
      }),

      // Recent sync logs (last 50)
      prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          userId: true,
          deviceId: true,
          direction: true,
          pushedCount: true,
          pulledCount: true,
          mergedCount: true,
          conflictCount: true,
          status: true,
          durationMs: true,
          createdAt: true,
        },
      }),

      // Daily sync counts (last 30 days)
      prisma.syncLog.groupBy({
        by: ['createdAt'],
        _count: true,
        _sum: {
          pushedCount: true,
          pulledCount: true,
        },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 86400000),
          },
        },
      }),
    ]);

    // Compute aggregate stats
    const successLogs = await prisma.syncLog.findMany({
      where: { status: 'SUCCESS' },
      select: { durationMs: true, conflictCount: true },
    });

    const totalSyncs = successLogs.length;
    const avgDurationMs = totalSyncs > 0
      ? successLogs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / totalSyncs
      : 0;
    const totalConflicts = successLogs.reduce((sum, l) => sum + (l.conflictCount ?? 0), 0);
    const avgConflictRate = totalSyncs > 0 ? totalConflicts / totalSyncs : 0;
    const syncSuccessRate = totalSyncLogs > 0 ? totalSyncs / totalSyncLogs : 0;

    // Daily stats aggregation
    const dailyStatsMap: Record<string, { date: string; pushCount: number; pullCount: number }> = {};
    for (const row of dailySyncCounts) {
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
        totalDevices,
        totalLocalConversations,
        totalSyncs,
        unresolvedConflicts,
        avgDurationMs,
        avgConflictRate,
        syncSuccessRate,
      },
      conflicts: recentConflicts.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      devices: recentDevices.map(d => ({
        ...d,
        conversationCount: d._count.localConversations,
        lastActiveAt: d.lastActiveAt?.toISOString() ?? null,
        lastSyncedAt: d.lastSyncedAt?.toISOString() ?? null,
      })),
      recentLogs: recentLogs.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      dailyStats,
    });
  } catch (error) {
    console.error('Admin sync stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
