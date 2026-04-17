/**
 * Analytics — AI Conversation Analysis API
 *
 * 提供 AI 对话深度分析：
 * - 对话趋势统计
 * - 人物使用排行
 * - Token 消耗统计
 * - 成本分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function GET(request: NextRequest) {
  try {
    await authenticateAdminRequest(request);

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // ─── Total Messages ─────────────────────────────────────────────────────────
    const totalMessages = await prisma.message.count({
      where: { createdAt: { gte: startDate } },
    });

    // ─── Total Conversations ────────────────────────────────────────────────────
    const totalConversations = await prisma.conversation.count({
      where: { createdAt: { gte: startDate } },
    });

    // ─── Total Tokens & Cost ─────────────────────────────────────────────────────
    const tokenCostAgg = await prisma.message.aggregate({
      where: { createdAt: { gte: startDate } },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        apiCost: true,
      },
    });

    const totalInputTokens = tokenCostAgg._sum.tokensInput || 0;
    const totalOutputTokens = tokenCostAgg._sum.tokensOutput || 0;
    const totalApiCost = Number(tokenCostAgg._sum.apiCost || 0);

    // ─── Persona Usage Stats ────────────────────────────────────────────────────
    const personaStats = await prisma.message.groupBy({
      by: ['personaId'],
      where: {
        createdAt: { gte: startDate },
        personaId: { not: null },
      },
      _count: { id: true },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        apiCost: true,
      },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    // Enrich with persona names
    const personaWithNames = await Promise.all(
      personaStats
        .filter(stat => stat.personaId !== null)
        .map(async (stat) => {
          const persona = await prisma.persona.findUnique({
            where: { slug: stat.personaId as string },
            select: { name: true, nameZh: true },
          });
          return {
            personaId: stat.personaId as string,
            personaName: persona?.nameZh || persona?.name || stat.personaId,
            conversationCount: stat._count.id,
            totalTokens: (stat._sum.tokensInput || 0) + (stat._sum.tokensOutput || 0),
            totalCost: Number(stat._sum.apiCost || 0),
          };
        })
    );

    // ─── Daily Trend ─────────────────────────────────────────────────────────────
    const dailyTrend = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT id) as messages,
        COUNT(DISTINCT conversation_id) as conversations,
        COALESCE(SUM(tokens_input + tokens_output), 0) as tokens,
        COALESCE(SUM(api_cost), 0) as cost
      FROM "messages"
      WHERE created_at >= ${startDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT ${days}
    ` as Array<{
      date: string;
      messages: number;
      conversations: number;
      tokens: number;
      cost: number;
    }>;

    // ─── Mode Distribution ───────────────────────────────────────────────────────
    const modeStats = await prisma.conversation.groupBy({
      by: ['mode'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { totalCost: true },
    });

    // ─── Cost Breakdown by Persona ──────────────────────────────────────────────
    const costByPersona = await prisma.message.groupBy({
      by: ['personaId'],
      where: {
        createdAt: { gte: startDate },
        personaId: { not: null },
      },
      _sum: { apiCost: true },
      orderBy: { _sum: { apiCost: 'desc' } },
      take: 10,
    });

    // ─── Top Active Users ────────────────────────────────────────────────────────
    const topUsers = await prisma.message.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      _sum: { apiCost: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topUsersWithNames = await Promise.all(
      topUsers.map(async (u) => {
        const user = await prisma.user.findUnique({
          where: { id: u.userId },
          select: { name: true, email: true },
        });
        return {
          userId: u.userId,
          name: user?.name || user?.email || 'Unknown',
          messageCount: u._count.id,
          totalCost: Number(u._sum.apiCost || 0),
        };
      })
    );

    return NextResponse.json({
      overview: {
        totalMessages,
        totalConversations,
        totalInputTokens: totalInputTokens,
        totalOutputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalApiCost,
        avgCostPerConversation: totalConversations > 0 ? totalApiCost / totalConversations : 0,
        avgTokensPerMessage: totalMessages > 0 ? (totalInputTokens + totalOutputTokens) / totalMessages : 0,
      },
      personas: personaWithNames,
      dailyTrend,
      modeStats,
      costByPersona,
      topUsers: topUsersWithNames,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('[Analytics/Conversation]', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
