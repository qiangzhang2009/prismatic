/**
 * Prismatic — Message Usage Tracking
 * Uses Prisma messages table (replaces deprecated prismatic_message_stats).
 */

import { PrismaClient } from '@prisma/client';
import type { SubscriptionPlan } from '@/lib/user-management';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prismaStats = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaStats;

// ─── Daily limit constants ───────────────────────────────────────────────────

export const USER_DAILY_LIMIT = 10;

// 检查用户是否达到今日对话配额上限
// FREE 用户：每日限制 10 条，由 localStorage 计数
// 付费用户（MONTHLY/YEARLY/LIFETIME）：无限制
export async function checkUserDailyLimit(
  userId: string,
  plan: SubscriptionPlan = 'FREE'
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  if (plan !== 'FREE') {
    return { allowed: true, current: 0, limit: 999999 };
  }
  const current = await getDailyMessageCount(userId);
  return {
    allowed: current < USER_DAILY_LIMIT,
    current,
    limit: USER_DAILY_LIMIT,
  };
}

// ─── Record a message ─────────────────────────────────────────────────────────

export async function recordMessage(userId: string): Promise<void> {
  try {
    await prismaStats.message.create({
      data: {
        conversationId: 'system',
        userId,
        role: 'user',
        content: '[message-counted]',
      },
    });
  } catch (error) {
    console.error('[recordMessage] Error:', error);
  }
}

// ─── Get daily message count ─────────────────────────────────────────────────

export async function getDailyMessageCount(userId: string, date?: string): Promise<number> {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const count = await prismaStats.message.count({
    where: {
      userId,
      createdAt: { gte: targetDate, lt: nextDate },
      content: { not: '[message-counted]' },
    },
  });
  return count;
}

// ─── Get message history ────────────────────────────────────────────────────

export interface MessageRecord {
  id: string;
  userId: string;
  date: string;
  count: number;
}

export async function getUserMessageHistory(userId: string, days: number = 7): Promise<MessageRecord[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  const messages = await prismaStats.message.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
      content: { not: '[message-counted]' },
    },
    select: { createdAt: true },
  });

  // Group by date
  const dateMap: Record<string, number> = {};
  for (const m of messages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    dateMap[key] = (dateMap[key] || 0) + 1;
  }

  return Object.entries(dateMap)
    .map(([date, count]) => ({ id: userId, userId, date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Get top users today ──────────────────────────────────────────────────

export async function getTopUsersToday(limit: number = 10): Promise<Array<{ userId: string; date: string; count: number; email?: string; name?: string }>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + 1);

  const result = await prismaStats.$queryRaw<Array<{ userId: string; date: string; count: bigint; email: string | null; name: string | null }>>`
    SELECT
      m."userId" as "userId",
      DATE(m."createdAt") as date,
      COUNT(*)::int as count,
      u.email,
      u.name
    FROM messages m
    INNER JOIN users u ON u.id = m."userId" AND u.status = 'ACTIVE'
    WHERE m."createdAt" >= ${today} AND m."createdAt" < ${nextDate}
      AND m.content != '[message-counted]'
    GROUP BY m."userId", DATE(m."createdAt"), u.email, u.name
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return result.map(r => ({
    userId: r.userId,
    date: String(r.date),
    count: Number(r.count),
    email: r.email || undefined,
    name: r.name || undefined,
  }));
}

// ─── Get global usage stats ────────────────────────────────────────────────

export async function getGlobalUsageStats(days: number = 7): Promise<{
  todayTotal: number;
  weekTotal: number;
  avgDaily: number;
  dailyBreakdown: Array<{ date: string; total: number }>;
  byHour: Array<{ hour: number; count: number }>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + 1);
  const weekStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  weekStart.setHours(0, 0, 0, 0);

  const [todayTotal, weekTotal, dailyRows] = await Promise.all([
    prismaStats.message.count({
      where: {
        createdAt: { gte: today, lt: nextDate },
        content: { not: '[message-counted]' },
        user: { status: 'ACTIVE' },
      },
    }),
    prismaStats.message.count({
      where: {
        createdAt: { gte: weekStart },
        content: { not: '[message-counted]' },
        user: { status: 'ACTIVE' },
      },
    }),
    prismaStats.$queryRaw<Array<{ date: Date; total: BigInt }>>`
      SELECT DATE("createdAt") as date, COUNT(*)::int as total
      FROM messages
      WHERE "createdAt" >= ${weekStart}
        AND content != '[message-counted]'
        AND "userId" IN (SELECT id FROM users WHERE status = 'ACTIVE')
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const dailyBreakdown = dailyRows.map(r => ({
    date: String(r.date),
    total: Number(r.total),
  }));

  const avgDaily = dailyBreakdown.length > 0 ? Math.round(Number(weekTotal) / dailyBreakdown.length) : 0;

  return { todayTotal, weekTotal, avgDaily, dailyBreakdown, byHour: [] };
}

// ─── Get all users usage ──────────────────────────────────────────────────

export async function getAllUsersUsage(days: number = 7): Promise<Record<string, {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  lastActivity: string | null;
}>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + 1);
  const weekStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  weekStart.setHours(0, 0, 0, 0);

  const messages = await prismaStats.message.findMany({
    where: {
      createdAt: { gte: weekStart },
      content: { not: '[message-counted]' },
      user: { status: 'ACTIVE' },
    },
    select: { userId: true, createdAt: true },
  });

  const result: Record<string, { todayCount: number; weekCount: number; totalCount: number; lastActivity: string | null }> = {};

  for (const m of messages) {
    const uid = m.userId;
    if (!result[uid]) {
      result[uid] = { todayCount: 0, weekCount: 0, totalCount: 0, lastActivity: null };
    }
    const isToday = m.createdAt >= today && m.createdAt < nextDate;
    if (isToday) result[uid].todayCount++;
    result[uid].weekCount++;
    if (!result[uid].lastActivity || m.createdAt > new Date(result[uid].lastActivity!)) {
      result[uid].lastActivity = m.createdAt.toISOString().slice(0, 10);
    }
  }

  return result;
}

// ─── Get user usage detail ─────────────────────────────────────────────────

export async function getUserUsageDetail(userId: string, days: number = 7): Promise<{
  today: number;
  week: number;
  total: number;
  history: Array<{ date: string; count: number }>;
  rank?: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + 1);
  const weekStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  weekStart.setHours(0, 0, 0, 0);

  const [todayCount, weekMessages, allMessages] = await Promise.all([
    prismaStats.message.count({
      where: {
        userId,
        createdAt: { gte: today, lt: nextDate },
        content: { not: '[message-counted]' },
      },
    }),
    prismaStats.message.findMany({
      where: {
        userId,
        createdAt: { gte: weekStart },
        content: { not: '[message-counted]' },
      },
      select: { createdAt: true },
    }),
    prismaStats.message.count({
      where: {
        userId,
        content: { not: '[message-counted]' },
      },
    }),
  ]);

  const dateMap: Record<string, number> = {};
  for (const m of weekMessages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    dateMap[key] = (dateMap[key] || 0) + 1;
  }

  const history = Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    today: todayCount,
    week: weekMessages.length,
    total: allMessages,
    history,
  };
}
