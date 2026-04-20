/**
 * Analytics — System Overview API
 *
 * 返回系统级统计数据（DAU、MAU、消息数、对话数、用户数等）。
 * 所有数据来自 Prisma 查询，真实、实时、准确。
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

    const [
      totalUsers,
      newUsersToday,
      totalMessages,
      totalConversations,
      dauResult,
      mauResult,
      weekMessages,
      paidUsers,
      periodApiCost,
    ] = await Promise.all([
      // 总用户数（活跃）
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      // 今日新增用户
      prisma.user.count({ where: { createdAt: { gte: today }, status: 'ACTIVE' } }),
      // 历史总消息数（排除心跳消息）
      prisma.message.count({ where: { content: { not: '[message-counted]' } } }),
      // 历史总对话数
      prisma.conversation.count(),
      // DAU：今日发送过消息的独立用户数
      prisma.message.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: today } },
        _count: { userId: true },
      }),
      // MAU：过去30天发送过消息的独立用户数
      prisma.message.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: monthStart } },
        _count: { userId: true },
      }),
      // 过去 N 天的消息数
      prisma.message.count({
        where: {
          createdAt: { gte: weekStart },
          content: { not: '[message-counted]' },
        },
      }),
      // 付费用户数（非 FREE 计划）
      prisma.user.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } }),
      // 近 N 天 API 总成本（从 messages.apiCost 聚合）
      prisma.message.aggregate({
        where: { createdAt: { gte: weekStart } },
        _sum: { apiCost: true },
      }),
    ]);

    const dau = dauResult.length;
    const mau = mauResult.length;
    const totalApiCost = Number(periodApiCost._sum.apiCost || 0);

    // 活跃率 = 今日 DAU / 总用户
    const activeRate = totalUsers > 0 ? (dau / totalUsers) * 100 : 0;
    // DAU/MAU 比 = 今日活跃 / 月活用户
    const dauMauRatio = mau > 0 ? (dau / mau) * 100 : 0;

    return NextResponse.json({
      totalUsers,
      activeUsers: dau,
      newUsers: newUsersToday,
      totalMessages,
      totalConversations,
      totalApiCost,
      dau,
      mau,
      paidUsers,
      weekMessages,
      activeRate: Math.round(activeRate * 10) / 10,
      dauMauRatio: Math.round(dauMauRatio * 10) / 10,
      totalMessagesWeek: weekMessages,
      period: { days },
    });
  } catch (error) {
    console.error('[Analytics/Overview]', error);
    // Graceful degradation — return empty stats instead of 500
    return NextResponse.json({
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      totalMessages: 0,
      totalConversations: 0,
      totalApiCost: 0,
      dau: 0,
      mau: 0,
      paidUsers: 0,
      weekMessages: 0,
      activeRate: 0,
      dauMauRatio: 0,
      totalMessagesWeek: 0,
      period: { days: 7 },
    });
  }
}
