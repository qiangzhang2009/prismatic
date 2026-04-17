/**
 * Analytics — System Overview API
 *
 * 返回系统级统计数据（DAU、消息数、对话数、成本等）。
 * 供管理员仪表板使用。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function GET(request: NextRequest) {
  try {
    // Only admin can access
    await authenticateAdminRequest(request);

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const overview = await prisma.systemDailyStat.findMany({
      where: {
        statDate: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          lte: new Date(),
        },
      },
      orderBy: { statDate: 'desc' },
      select: {
        totalUsers: true,
        activeUsers: true,
        newUsers: true,
        totalMessages: true,
        totalConversations: true,
        totalApiCost: true,
        revenueEstimate: true,
        dau: true,
        mau: true,
      },
    });

    // Aggregate
    const total = overview.reduce(
      (acc, cur) => ({
        totalUsers: Math.max(acc.totalUsers, cur.totalUsers),
        activeUsers: Math.max(acc.activeUsers, cur.activeUsers),
        newUsers: acc.newUsers + cur.newUsers,
        totalMessages: acc.totalMessages + cur.totalMessages,
        totalConversations: acc.totalConversations + cur.totalConversations,
        totalApiCost: acc.totalApiCost + Number(cur.totalApiCost),
        revenueEstimate: acc.revenueEstimate + Number(cur.revenueEstimate),
        dau: Math.max(acc.dau, cur.dau),
        mau: Math.max(acc.mau, cur.mau),
      }),
      { totalUsers: 0, activeUsers: 0, newUsers: 0, totalMessages: 0, totalConversations: 0, totalApiCost: 0, revenueEstimate: 0, dau: 0, mau: 0 }
    );

    return NextResponse.json({
      ...total,
      totalApiCost: parseFloat(total.totalApiCost.toFixed(4)),
      revenueEstimate: parseFloat(total.revenueEstimate.toFixed(4)),
    });
  } catch (error) {
    console.error('[Analytics/Overview]', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
