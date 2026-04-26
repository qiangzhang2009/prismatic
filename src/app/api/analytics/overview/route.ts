/**
 * Analytics — System Overview API
 *
 * Returns system-level statistics (DAU, MAU, messages, conversations, users).
 * Uses @neondatabase/serverless neon() tagged template for Edge runtime compatibility.
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
    // Use UTC ISO strings — Edge Runtime's Date handling differs from Node.js
    const nowUtc = new Date();
    nowUtc.setUTCHours(0, 0, 0, 0);
    const periodStart = new Date(nowUtc.getTime() - days * 24 * 60 * 60 * 1000);
    const nowUtcStr = nowUtc.toISOString();
    const periodStartStr = periodStart.toISOString();

    const sql = getSql();

    // All metrics consistently filtered by `days` parameter.
    // Work around Neon/Vercel edge caching: SELECT rows + .length is more reliable
    // than COUNT(*) on the users table when deployed to Vercel Edge Runtime.
    const [totalUsersRows, activeUsers, paidUsersRows, rows] = await Promise.all([
      sql`SELECT id FROM users`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE'`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL`,
      sql`
        SELECT
          (SELECT COUNT(*) FROM users WHERE "createdAt" >= ${periodStartStr}) as new_users,
          (SELECT COUNT(*) FROM messages WHERE "createdAt" >= ${periodStartStr} AND content != '[message-counted]') as period_messages,
          (SELECT COUNT(*) FROM conversations WHERE "updatedAt" >= ${periodStartStr}) as period_conversations,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${nowUtcStr}) as dau,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${periodStartStr}) as mau,
          (SELECT COALESCE(SUM("apiCost"), 0) FROM messages WHERE "createdAt" >= ${periodStartStr}) as period_cost
      `,
    ]);

    const totalUsers = totalUsersRows.length;
    const paidUsers = paidUsersRows.length;
    const row = rows[0];
    const newUsers = parseInt(String(row.new_users ?? '0'), 10);
    const totalMessages = parseInt(String(row.period_messages ?? '0'), 10);
    const totalConversations = parseInt(String(row.period_conversations ?? '0'), 10);
    const dau = parseInt(String(row.dau ?? '0'), 10);
    const mau = parseInt(String(row.mau ?? '0'), 10);
    const totalApiCost = Number(row.period_cost ?? 0);

    const activeRate = totalUsers > 0 ? (mau / totalUsers) * 100 : 0;
    const dauMauRatio = mau > 0 ? (dau / mau) * 100 : 0;

    return NextResponse.json({
      totalUsers,
      activeUsers: dau,
      newUsers,
      totalMessages,
      totalConversations,
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
