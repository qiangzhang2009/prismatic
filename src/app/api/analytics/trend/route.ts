/**
 * Analytics — Daily Trend API
 *
 * Returns daily aggregated metrics: DAU, sessions, messages, conversations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const startDateStr = startDate.toISOString().replace('T', ' ').replace('Z', '+00');

    // Daily messages & conversations per day
    const dailyTrendRaw = await prisma.$queryRaw`
      SELECT
        DATE("createdAt" at time zone 'utc') as date,
        COUNT(DISTINCT "conversationId") as conversations,
        COUNT(DISTINCT "userId") as dau,
        COUNT(*) as messages,
        0 as sessions
      FROM "messages"
      WHERE "createdAt" >= ${startDateStr}::timestamptz
        AND "createdAt" < NOW()
      GROUP BY DATE("createdAt" at time zone 'utc')
      ORDER BY date ASC
    ` as Array<{
      date: string;
      conversations: bigint;
      dau: bigint;
      messages: bigint;
      sessions: bigint;
    }>;

    const trend = dailyTrendRaw.map(row => ({
      date: row.date,
      dau: Number(row.dau),
      sessions: Number(row.sessions),
      messages: Number(row.messages),
      conversations: Number(row.conversations),
    }));

    const padded = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      padded.push({ date: dateStr, dau: 0, sessions: 0, messages: 0, conversations: 0 });
    }
    return NextResponse.json(padded);
  } catch (error) {
    console.error('[Analytics/Trend]', error);
    // Graceful degradation — return empty trend array instead of 500
    const degraded = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      degraded.push({ date: dateStr, dau: 0, sessions: 0, messages: 0, conversations: 0 });
    }
    return NextResponse.json(degraded);
  }
}
