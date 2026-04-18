/**
 * Analytics — System Overview API
 *
 * 返回系统级统计数据（DAU、消息数、对话数等）。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    monthStart.setHours(0, 0, 0, 0);

    const [totalUsers, newUsersToday, totalMessages, totalConversations,
            activeToday, weekMessages] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: today }, status: 'ACTIVE' } }),
      prisma.message.count({ where: { content: { not: '[message-counted]' } } }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count({ where: {
        createdAt: { gte: weekStart },
        content: { not: '[message-counted]' },
      }}),
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers: activeToday,
      newUsers: newUsersToday,
      totalMessages,
      totalConversations,
      totalApiCost: 0,
      dau: activeToday,
      mau: totalUsers,
    });
  } catch (error) {
    console.error('[Analytics/Overview]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
