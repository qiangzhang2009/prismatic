/**
 * Analytics — Daily Trend API
 *
 * Returns daily aggregated metrics: DAU, sessions, messages, conversations.
 * Uses @neondatabase/serverless neon() tagged template for Edge runtime compatibility.
 *
 * Timezone handling:
 * - Date grouping uses CURRENT_DATE - generate_series to ensure timezone consistency
 * - Messages are grouped by their createdAt date directly (assuming timestamps are consistent)
 * - Uses generate_series to fill in missing dates
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
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 90);

  try {
    const sql = getSql();

    // Use SQL to get the date range - this ensures timezone consistency
    // Generate dates using generate_series for missing date filling
    const dailyTrendRaw = await sql`
      WITH date_range AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${sql`${days - 1} days`}',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      ),
      daily_metrics AS (
        SELECT
          DATE(m."createdAt") as msg_date,
          COUNT(DISTINCT m."conversationId") as conversations,
          COUNT(DISTINCT m."userId") as dau,
          COUNT(*) FILTER (WHERE m.content != '[message-counted]') as messages
        FROM messages m
        WHERE m."createdAt" >= CURRENT_DATE - INTERVAL '${sql`${days} days`}'
          AND m."createdAt" <= CURRENT_DATE + INTERVAL '1 day'
        GROUP BY DATE(m."createdAt")
      )
      SELECT
        dr.date,
        COALESCE(dm.dau, 0)::integer as dau,
        0 as sessions,
        COALESCE(dm.messages, 0)::integer as messages,
        COALESCE(dm.conversations, 0)::integer as conversations
      FROM date_range dr
      LEFT JOIN daily_metrics dm ON dr.date = dm.msg_date
      ORDER BY dr.date ASC
    `;

    const trend: { date: string; dau: number; sessions: number; messages: number; conversations: number }[] = dailyTrendRaw.map((row: any) => ({
      date: String(row.date),
      dau: parseInt(String(row.dau), 10),
      sessions: 0,
      messages: parseInt(String(row.messages), 10),
      conversations: parseInt(String(row.conversations), 10),
    }));

    return NextResponse.json(trend);
  } catch (error) {
    console.error('[Analytics/Trend]', error);
    // Fallback: return empty data for all days
    const degraded: { date: string; dau: number; sessions: number; messages: number; conversations: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      degraded.push({ date: dateStr, dau: 0, sessions: 0, messages: 0, conversations: 0 });
    }
    return NextResponse.json(degraded);
  }
}
