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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    monthStart.setHours(0, 0, 0, 0);

    const sql = getSql();

    // Work around Neon/Vercel edge caching: SELECT rows + .length is more reliable
    // than COUNT(*) on the users table when deployed to Vercel Edge Runtime.
    const [activeUsers, paidUsersRows, rows] = await Promise.all([
      sql`SELECT id FROM users WHERE status = 'ACTIVE'`,
      sql`SELECT id FROM users WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL`,
      sql`
        SELECT
          (SELECT COUNT(*) FROM users WHERE "createdAt" >= ${today}) as new_users,
          (SELECT COUNT(*) FROM messages WHERE content != '[message-counted]') as total_messages,
          (SELECT COUNT(*) FROM conversations) as total_conversations,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${today}) as dau,
          (SELECT COUNT(DISTINCT "userId") FROM messages WHERE "createdAt" >= ${monthStart}) as mau,
          (SELECT COUNT(*) FROM messages WHERE "createdAt" >= ${weekStart} AND content != '[message-counted]') as week_messages,
          (SELECT COALESCE(SUM("apiCost"), 0) FROM messages WHERE "createdAt" >= ${weekStart}) as week_cost
      `,
    ]);

    const totalUsers = activeUsers.length;
    const paidUsers = paidUsersRows.length;
    const row = rows[0];
    const newUsersToday = parseInt(String(row.new_users ?? '0'), 10);
    const totalMessages = parseInt(String(row.total_messages ?? '0'), 10);
    const totalConversations = parseInt(String(row.total_conversations ?? '0'), 10);
    const dau = parseInt(String(row.dau ?? '0'), 10);
    const mau = parseInt(String(row.mau ?? '0'), 10);
    const weekMessages = parseInt(String(row.week_messages ?? '0'), 10);
    const totalApiCost = Number(row.week_cost ?? 0);

    const activeRate = totalUsers > 0 ? (dau / totalUsers) * 100 : 0;
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
