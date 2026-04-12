/**
 * GET /api/analytics/overview — Prismatic Analytics Overview
 * Public endpoint for backend-admin dashboard (tenant=prismatic)
 * No auth required — only returns aggregate stats, not user data
 *
 * NOTE: Uses sequential queries (not Promise.all) to avoid Neon cold-start
 * timeout when multiple DB connections are needed simultaneously.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingOverview, getTrackingFunnel, getTrackingTrend } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '7', 10);

  try {
    // Sequential queries to reduce Neon cold-start connection overhead
    const overview = await getTrackingOverview(days);
    const funnel = await getTrackingFunnel(days);
    const trend = await getTrackingTrend(days);

    return NextResponse.json({
      overview: {
        dau: overview.dau,
        wau: overview.wau,
        mau: overview.mau,
        sessions: overview.sessions,
        avgSessionDuration: 0,
        totalEvents: overview.totalEvents,
        totalPersonas: overview.totalPersonas,
        totalConversations: overview.totalConversations,
        avgConversationsPerVisitor: overview.totalConversations > 0 && overview.mau > 0
          ? parseFloat((overview.totalConversations / overview.mau).toFixed(2)) : 0,
      },
      funnel,
      trend,
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
