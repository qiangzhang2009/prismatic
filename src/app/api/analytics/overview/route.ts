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
 * - Timezone handling: uses CURRENT_DATE in SQL to avoid JavaScript timezone issues
 *   when Vercel server runs in UTC but database stores local time
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const sql = getSql();

    // All metrics use the same period window for consistency.
    // Work around Neon/Vercel edge caching: SELECT rows + .length is more reliable
    // than COUNT(*) on the users table when deployed to Vercel Edge Runtime.
    // Use SQL CURRENT_DATE for timezone-safe date boundaries.
    const [totalUsersRows, activeUsersRows, paidUsersRows, metricsRows] = await Promise.all([
      sql`SELECT id FROM users`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE'`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL`,
      sql`
        SELECT
          (SELECT COUNT(*) FROM users WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}') as new_users,
          -- Messages: exclude '[message-counted]' sentinel rows
          -- Use CURRENT_DATE for timezone-safe period calculation
          (SELECT COUNT(*) FROM messages WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}' AND content != '[message-counted]') as period_messages,
          -- Conversations: count distinct conversationIds from messages in the period (consistent with trend API)
          -- This gives the number of conversations that had messages in the period
          (SELECT COUNT(DISTINCT "conversationId") FROM messages WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}' AND content != '[message-counted]') as period_conversations,
          -- DAU: distinct users who sent a message today (use CURRENT_DATE for timezone-safe "today")
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= CURRENT_DATE AND content != '[message-counted]') as dau,
          -- MAU: distinct users active in the period
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}' AND content != '[message-counted]') as mau,
          -- Cost: sum from conversations.totalCost (authoritative — computed by persistConversation)
          (SELECT COALESCE(SUM("totalCost"), 0) FROM conversations WHERE "updatedAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}') as period_cost,
          -- Tokens: sum from conversations.totalTokens (authoritative)
          (SELECT COALESCE(SUM("totalTokens"), 0) FROM conversations WHERE "updatedAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}') as period_tokens,
          -- All-time cost from conversations (for totalApiCost legacy field)
          (SELECT COALESCE(SUM("totalCost"), 0) FROM conversations) as alltime_cost
      `,
    ]);

    const totalUsers = totalUsersRows.length;
    const activeUsers = activeUsersRows.length;
    const paidUsers = paidUsersRows.length;
    const metrics = metricsRows[0];

    const newUsers = parseInt(String(metrics?.new_users ?? '0'), 10);
    const totalMessages = parseInt(String(metrics?.period_messages ?? '0'), 10);
    const totalConversations = parseInt(String(metrics?.period_conversations ?? '0'), 10);
    const dau = parseInt(String(metrics?.dau ?? '0'), 10);
    const mau = parseInt(String(metrics?.mau ?? '0'), 10);
    const totalApiCost = Number(metrics?.period_cost ?? 0);
    const totalTokens = Number(metrics?.period_tokens ?? 0);

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
      dau,
      mau,
      paidUsers,
      weekMessages: totalMessages,
      activeRate: Math.round(activeRate * 10) / 10,
      dauMauRatio: Math.round(dauMauRatio * 10) / 10,
      totalMessagesWeek: totalMessages,
      period: { days },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Analytics/Overview]', message);
    return NextResponse.json({
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      totalMessages: 0,
      totalConversations: 0,
      totalTokens: 0,
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
