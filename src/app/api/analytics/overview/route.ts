/**
 * GET /api/analytics/overview — Prismatic Analytics Overview
 * Direct query from Prismatic's own Neon PostgreSQL tracking tables.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingOverview, getTrackingFunnel, getTrackingTrend } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 30);

  try {
    const [overview, funnel, trend] = await Promise.all([
      getTrackingOverview(days),
      getTrackingFunnel(days),
      getTrackingTrend(days),
    ]);

    // Build DAU/WAU/MAU from the same data source
    const dau = overview.dau ?? 0;
    const wau = overview.wau ?? 0;
    const mau = overview.mau ?? 0;
    const sessions = overview.sessions ?? 0;
    const totalEvents = overview.totalEvents ?? 0;
    const totalPersonas = overview.totalPersonas ?? 0;
    const totalConversations = overview.totalConversations ?? 0;

    return NextResponse.json({
      overview: {
        dau,
        wau,
        mau,
        sessions,
        avgSessionDuration: 0,
        totalEvents,
        totalPersonas,
        totalConversations,
        avgConversationsPerVisitor: totalConversations > 0 && dau > 0
          ? parseFloat((totalConversations / dau).toFixed(2))
          : 0,
      },
      funnel,
      trend,
    });
  } catch (error) {
    console.error('[Analytics Overview] Error:', error);
    return NextResponse.json({ overview: null, funnel: [], trend: [] }, { status: 500 });
  }
}
