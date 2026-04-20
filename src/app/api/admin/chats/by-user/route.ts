/**
 * Admin: Conversation list grouped by user
 * GET /api/admin/chats/by-user
 *
 * Returns conversations grouped by userId, with per-user stats.
 * Supports filtering by date range, mode, billing mode.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const mode = searchParams.get('mode') || '';
  const billingMode = searchParams.get('billingMode') || '';
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));

  const where: any = {};
  if (mode) where.mode = mode;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59Z');
  }
  if (search) {
    where.messages = {
      some: { content: { contains: search, mode: 'insensitive' } },
    };
  }
  if (billingMode) {
    where.user = billingMode === 'A'
      ? { apiKeyEncrypted: { not: null }, apiKeyStatus: 'valid' }
      : { OR: [{ apiKeyEncrypted: null }, { apiKeyStatus: { not: 'valid' } }] };
  }

  const [conversations, totalUsers] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            plan: true,
            apiKeyEncrypted: true,
            apiKeyStatus: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            personaId: true,
            tokensInput: true,
            tokensOutput: true,
            apiCost: true,
            modelUsed: true,
            createdAt: true,
          },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // Count distinct users with conversations
    prisma.conversation.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
    }),
  ]);

  // Group conversations by userId
  const userMap: Record<string, {
    user: typeof conversations[0]['user'];
    conversations: (typeof conversations[0] & { billingMode: string })[];
    totalMessages: number;
    totalCost: number;
    totalTokens: number;
    convCount: number;
    lastActivity: string;
  }> = {};

  for (const conv of conversations) {
    const uid = conv.userId;
    if (!userMap[uid]) {
      const billing =
        conv.user?.apiKeyEncrypted && conv.user?.apiKeyStatus === 'valid' ? 'A' : 'B';
      userMap[uid] = {
        user: conv.user,
        conversations: [],
        totalMessages: 0,
        totalCost: 0,
        totalTokens: 0,
        convCount: 0,
        lastActivity: '',
      };
    }
    userMap[uid].conversations.push({
      ...conv,
      billingMode:
        conv.user?.apiKeyEncrypted && conv.user?.apiKeyStatus === 'valid' ? 'A' : 'B',
    });
    userMap[uid].totalMessages += conv.messageCount;
    userMap[uid].totalCost += Number(conv.totalCost || 0);
    userMap[uid].totalTokens += conv.totalTokens;
    userMap[uid].convCount += 1;
    const convDate = conv.updatedAt?.toISOString() || conv.createdAt.toISOString();
    if (!userMap[uid].lastActivity || convDate > userMap[uid].lastActivity) {
      userMap[uid].lastActivity = convDate;
    }
  }

  const users = Object.values(userMap)
    .sort((a, b) => {
      // Sort by totalMessages descending (most active first)
      if (b.totalMessages !== a.totalMessages) return b.totalMessages - a.totalMessages;
      // Then by convCount
      if (b.convCount !== a.convCount) return b.convCount - a.convCount;
      return 0;
    });

  // Pagination
  const paginatedUsers = users.slice((page - 1) * pageSize, page * pageSize);
  const totalUserCount = totalUsers.length;

  return NextResponse.json({
    users: paginatedUsers,
    totalUsers: totalUserCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalUserCount / pageSize),
  });
}
