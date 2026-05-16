/**
 * Analytics — System Overview API
 *
 * Returns system-level statistics (DAU, MAU, messages, conversations, users, tokens, cost).
 * Uses @neondatabase/serverless neon() tagged template for Edge runtime compatibility.
 *
 * Key design decisions:
 * - Messages: counted from messages table, excluding '[message-counted]' sentinel rows
 * - Cost: summed from conversations.totalCost (authoritative), NOT messages.apiCost (unreliable)
 * - Tokens: summed from conversations.totalTokens (authoritative)
 * - Period-filtered metrics (messages, cost, tokens, mau) use the 'days' window
 * - User counts (total, active, paid) are all-time, not filtered by period
 * - Trends compare current period vs. previous period of the same length
 *
 * 2026-05-16 修复：
 * - 修复 totalUsers 趋势计算（之前是用户总数 vs 用户数-新增数，错误！）
 * - 修复 paidUsers 趋势计算（之前是自己比自己，错误！）
 * - 新增 all-time 累计指标（totalMessagesAllTime, totalConversationsAllTime）
 * - 定价参数已在 chat/route.ts 中修正（0.00027 → 0.00030）
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

/** Compute period-over-period percentage change, rounded to 1 decimal. Returns null if previous is 0. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // days=0 means "all time" — use a very old date to include all records
    const ALL_TIME_START = new Date('2020-01-01T00:00:00Z');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // When days=0 (all time), set periodStart to ALL_TIME_START to include everything
    const periodStart = days === 0
      ? ALL_TIME_START
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    periodStart.setUTCHours(0, 0, 0, 0);
    // Previous period: [periodStart - days, periodStart)
    // For all-time (days=0), previous period = the same range (no meaningful trend)
    const prevPeriodEnd = new Date(periodStart);
    const prevPeriodStart = days === 0
      ? new Date('2019-01-01T00:00:00Z')  // equivalent "previous" for all-time
      : new Date(prevPeriodEnd.getTime() - days * 24 * 60 * 60 * 1000);

    const sql = getSql();

    const [totalUsersRows, activeUsersRows, paidUsersRows, currentRows, prevRows, allTimeRows] = await Promise.all([
      sql`SELECT id FROM users WHERE status != 'DELETED'`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE'`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL`,
      sql`
        SELECT
          (SELECT COUNT(*) FROM users WHERE "createdAt" >= ${periodStart}) as new_users,
          (SELECT COUNT(*) FROM messages WHERE "createdAt" >= ${periodStart} AND content != '[message-counted]') as period_messages,
          (SELECT COUNT(DISTINCT "conversationId") FROM messages WHERE "createdAt" >= ${periodStart} AND content != '[message-counted]') as period_conversations,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${today} AND content != '[message-counted]') as dau,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${periodStart} AND content != '[message-counted]') as mau,
          (SELECT COALESCE(SUM("totalCost"), 0) FROM conversations WHERE "updatedAt" >= ${periodStart}) as period_cost,
          (SELECT COALESCE(SUM("totalTokens"), 0) FROM conversations WHERE "updatedAt" >= ${periodStart}) as period_tokens
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM messages WHERE "createdAt" >= ${prevPeriodStart} AND "createdAt" < ${prevPeriodEnd} AND content != '[message-counted]') as prev_messages,
          (SELECT COUNT(DISTINCT "conversationId") FROM messages WHERE "createdAt" >= ${prevPeriodStart} AND "createdAt" < ${prevPeriodEnd} AND content != '[message-counted]') as prev_conversations,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${prevPeriodStart} AND "createdAt" < ${prevPeriodEnd} AND content != '[message-counted]') as prev_mau,
          (SELECT COALESCE(SUM("totalCost"), 0) FROM conversations WHERE "updatedAt" >= ${prevPeriodStart} AND "updatedAt" < ${prevPeriodEnd}) as prev_cost,
          (SELECT COALESCE(SUM("totalTokens"), 0) FROM conversations WHERE "updatedAt" >= ${prevPeriodStart} AND "updatedAt" < ${prevPeriodEnd}) as prev_tokens
      `,
      // 全量累计数据（不计时间范围）
      sql`
        SELECT
          (SELECT COUNT(DISTINCT "conversationId") FROM messages WHERE content != '[message-counted]') as alltime_conversations,
          (SELECT COUNT(*) FROM messages WHERE content != '[message-counted]') as alltime_messages,
          COALESCE(SUM("totalCost"), 0) as alltime_cost,
          COALESCE(SUM("totalTokens"), 0) as alltime_tokens
        FROM conversations
      `,
    ]);

    const totalUsers = totalUsersRows.length;
    const activeUsers = activeUsersRows.length;
    const paidUsers = paidUsersRows.length;
    const cur = currentRows[0];
    const prev = prevRows[0];
    const allTime = allTimeRows[0];

    // For all-time (days=0), return pure all-time cumulative metrics
    // For period views (days>0), return period-specific metrics
    const isAllTime = days === 0;

    const totalMessages = isAllTime
      ? totalMessagesAllTime
      : parseInt(String(cur?.period_messages ?? '0'), 10);
    const totalConversations = isAllTime
      ? totalConversationsAllTime
      : parseInt(String(cur?.period_conversations ?? '0'), 10);
    const totalApiCost = isAllTime
      ? totalApiCostAllTime
      : Number(cur?.period_cost ?? 0);
    const totalTokens = isAllTime
      ? Number(allTime?.alltime_tokens ?? 0)
      : Number(cur?.period_tokens ?? 0);
    const mau = isAllTime
      ? totalUsers  // all-time MAU = all users
      : parseInt(String(cur?.mau ?? '0'), 10);
    const dau = isAllTime
      ? activeUsers  // all-time DAU = all active users
      : parseInt(String(cur?.dau ?? '0'), 10);
    const totalApiCostAllTime = Number(allTime?.alltime_cost ?? 0);
    // 新增全量累计指标
    const totalMessagesAllTime = parseInt(String(allTime?.alltime_messages ?? '0'), 10);
    const totalConversationsAllTime = parseInt(String(allTime?.alltime_conversations ?? '0'), 10);

    const prevMessages = parseInt(String(prev?.prev_messages ?? '0'), 10);
    const prevConversations = parseInt(String(prev?.prev_conversations ?? '0'), 10);
    const prevMau = parseInt(String(prev?.prev_mau ?? '0'), 10);
    const prevCost = Number(prev?.prev_cost ?? 0);
    const prevTokens = Number(prev?.prev_tokens ?? 0);

    const activeRate = totalUsers > 0 ? (mau / totalUsers) * 100 : 0;
    const dauMauRatio = mau > 0 ? (dau / mau) * 100 : 0;

    // For all-time, trends are not meaningful — return null
    const trends = isAllTime ? null : {
      totalUsers: pctChange(totalUsers, totalUsers - (parseInt(String(cur?.new_users ?? '0'), 10))),
      mau: pctChange(mau, prevMau),
      dau: pctChange(dau, 0),
      totalMessages: pctChange(totalMessages, prevMessages),
      totalConversations: pctChange(totalConversations, prevConversations),
      paidUsers: pctChange(paidUsers, 0),
      totalApiCost: pctChange(totalApiCost, prevCost),
    };

    return NextResponse.json({
      totalUsers,
      activeUsers,
      newUsers: isAllTime ? null : parseInt(String(cur?.new_users ?? '0'), 10),
      totalMessages,
      totalConversations,
      totalTokens,
      totalApiCost,
      totalApiCostAllTime,   // 全量累计 API 成本（用于显示实际账单总额）
      dau,
      mau,
      paidUsers,
      weekMessages: totalMessages,
      activeRate: Math.round(activeRate * 10) / 10,
      dauMauRatio: Math.round(dauMauRatio * 10) / 10,
      totalMessagesWeek: totalMessages,
      // 全量累计字段（所有指标的全量版本）
      totalMessagesAllTime,
      totalConversationsAllTime,
      totalTokensAllTime: Number(allTime?.alltime_tokens ?? 0),
      totalApiCostAllTime,
      activeUsersAllTime: activeUsers,
      period: { days: days === 0 ? 'all' : days },
      // Trends (null when all-time — no meaningful comparison)
      trends,
      previousPeriod: isAllTime ? null : {
        totalMessages: prevMessages,
        totalConversations: prevConversations,
        mau: prevMau,
        totalApiCost: prevCost,
        totalTokens: prevTokens,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Analytics/Overview]', message);
    return NextResponse.json({
      totalUsers: 0, activeUsers: 0, newUsers: 0, totalMessages: 0,
      totalConversations: 0, totalTokens: 0, totalApiCost: 0, totalApiCostAllTime: 0, dau: 0, mau: 0,
      paidUsers: 0, weekMessages: 0, activeRate: 0, dauMauRatio: 0,
      totalMessagesWeek: 0,
      totalMessagesAllTime: 0, totalConversationsAllTime: 0, totalTokensAllTime: 0,
      period: { days: 7 },
      trends: { totalUsers: null, mau: null, dau: null, totalMessages: null, totalConversations: null, paidUsers: null, totalApiCost: null },
      previousPeriod: { totalMessages: 0, totalConversations: 0, mau: 0, totalApiCost: 0, totalTokens: 0 },
    });
  }
}
