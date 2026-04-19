/**
 * Admin: User behavior clustering
 * GET /api/admin/chats/behavior?days=30
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10));
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const userStats = await prisma.conversation.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: startDate } },
    _count: { id: true },
    _sum: { messageCount: true, totalCost: true },
    orderBy: { _count: { id: 'desc' } },
    take: 200,
  });

  const userIds = userStats.map(s => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, plan: true, apiKeyEncrypted: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const clusters = { heavy: [] as any[], explorer: [] as any[], casual: [] as any[], dormant: [] as any[] };
  for (const stat of userStats) {
    const convCount = Number(stat._count.id);
    const msgCount = Number(stat._sum.messageCount || 0);
    const user = userMap[stat.userId];
    if (!user) continue;

    const record = {
      userId: stat.userId,
      name: user.name || user.email,
      plan: user.plan,
      hasApiKey: !!user.apiKeyEncrypted,
      conversationCount: convCount,
      messageCount: msgCount,
      totalCost: Number(stat._sum.totalCost || 0),
    };

    if (convCount >= 20 || msgCount >= 100) clusters.heavy.push(record);
    else if (convCount >= 10) clusters.explorer.push(record);
    else if (convCount >= 3) clusters.casual.push(record);
    else clusters.dormant.push(record);
  }

  return NextResponse.json({
    clusters: {
      heavy: { label: '重度用户', count: clusters.heavy.length, users: clusters.heavy.slice(0, 10) },
      explorer: { label: '探索型', count: clusters.explorer.length, users: clusters.explorer.slice(0, 10) },
      casual: { label: '轻量用户', count: clusters.casual.length, users: clusters.casual.slice(0, 10) },
      dormant: { label: '沉默用户', count: clusters.dormant.length, users: clusters.dormant.slice(0, 10) },
    },
    totalActiveUsers: userStats.length,
    period: { days },
  });
}
