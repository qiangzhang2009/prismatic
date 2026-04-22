/**
 * Analytics — Daily Trend API
 *
 * Returns daily aggregated metrics: DAU, sessions, messages, conversations.
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
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 90);

  try {
    const sql = getSql();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyTrendRaw = await sql`
      SELECT
        DATE("createdAt" at time zone 'utc') as date,
        COUNT(DISTINCT "conversationId") as conversations,
        COUNT(DISTINCT "userId") as dau,
        COUNT(*) as messages,
        0 as sessions
      FROM "messages"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" < NOW()
      GROUP BY DATE("createdAt" at time zone 'utc')
      ORDER BY date ASC
    `;

    const trend: { date: string; dau: number; sessions: number; messages: number; conversations: number }[] = dailyTrendRaw.map((row: any) => ({
      date: new Date(String(row.date)).toISOString().split('T')[0],
      dau: parseInt(String(row.dau), 10),
      sessions: 0,
      messages: parseInt(String(row.messages), 10),
      conversations: parseInt(String(row.conversations), 10),
    }));

    const padded: { date: string; dau: number; sessions: number; messages: number; conversations: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      padded.push({ date: dateStr, dau: 0, sessions: 0, messages: 0, conversations: 0 });
    }

    for (const row of trend) {
      const idx = padded.findIndex(p => p.date === row.date);
      if (idx !== -1) padded[idx] = row;
    }

    return NextResponse.json(padded);
  } catch (error) {
    console.error('[Analytics/Trend]', error);
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
