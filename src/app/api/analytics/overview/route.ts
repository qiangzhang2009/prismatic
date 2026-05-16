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
 * - All period-filtered metrics (messages, cost, tokens) use the 'days' window
 * - User counts (total, paid) are all-time, not filtered by period
 * - Includes previous-period metrics for trend calculation (2026-05: fixed hardcoded trends)
 * - Also returns all-time cost/messages/conversations for accurate total display
 *
 * 2026-05-16 修复：
 * - 新增 totalApiCostAllTime（全量累计成本），用于管理后台显示全量 API 账单
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    periodStart.setUTCHours(0, 0, 0, 0);
    // Previous period: [periodStart - days, periodStart)
    const prevPeriodEnd = new Date(periodStart);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - days * 24 * 60 * 60 * 1000);

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
      sql`SELECT COALESCE(SUM("totalCost"), 0) as alltime_cost, COALESCE(SUM("totalTokens"), 0) as alltime_tokens FROM conversations`,
    ]);

    const totalUsers = totalUsersRows.length;
    const activeUsers = activeUsersRows.length;
    const paidUsers = paidUsersRows.length;
    const cur = currentRows[0];
    const prev = prevRows[0];
    const allTime = allTimeRows[0];

    const newUsers = parseInt(String(cur?.new_users ?? '0'), 10);
    const totalMessages = parseInt(String(cur?.period_messages ?? '0'), 10);
    const totalConversations = parseInt(String(cur?.period_conversations ?? '0'), 10);
    const dau = parseInt(String(cur?.dau ?? '0'), 10);
    const mau = parseInt(String(cur?.mau ?? '0'), 10);
    const totalApiCost = Number(cur?.period_cost ?? 0);
    const totalTokens = Number(cur?.period_tokens ?? 0);
    const totalApiCostAllTime = Number(allTime?.alltime_cost ?? 0);  // 全量累计成本

    const prevMessages = parseInt(String(prev?.prev_messages ?? '0'), 10);
    const prevConversations = parseInt(String(prev?.prev_conversations ?? '0'), 10);
    const prevMau = parseInt(String(prev?.prev_mau ?? '0'), 10);
    const prevCost = Number(prev?.prev_cost ?? 0);
    const prevTokens = Number(prev?.prev_tokens ?? 0);

    const activeRate = totalUsers > 0 ? (mau / totalUsers) * 100 : 0;
    const dauMauRatio = mau > 0 ? (dau / mau) * 100 : 0;

    return NextResponse.json({
      totalUsers,
      activeUsers,
      newUsers,
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
      period: { days },
      // Trend deltas vs previous period (computed server-side)
      trends: {
        totalUsers: pctChange(totalUsers, totalUsers - newUsers),
        mau: pctChange(mau, prevMau),
        dau: pctChange(dau, 0),
        totalMessages: pctChange(totalMessages, prevMessages),
        totalConversations: pctChange(totalConversations, prevConversations),
        paidUsers: pctChange(paidUsers, paidUsers),
        totalApiCost: pctChange(totalApiCost, prevCost),
      },
      previousPeriod: {
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
      totalMessagesWeek: 0, period: { days: 7 },
      trends: { totalUsers: null, mau: null, dau: null, totalMessages: null, totalConversations: null, paidUsers: null, totalApiCost: null },
      previousPeriod: { totalMessages: 0, totalConversations: 0, mau: 0, totalApiCost: 0, totalTokens: 0 },
    });
  }
}
