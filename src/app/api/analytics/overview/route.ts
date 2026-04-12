/**
 * GET /api/analytics/overview — Prismatic Analytics Overview
 * Public endpoint for backend-admin dashboard (tenant=prismatic)
 * No auth required — only returns aggregate stats, not user data
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingOverview, getTrackingFunnel, getTrackingTrend } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '7', 10);

  try {
    const [overview, funnel, trend] = await Promise.all([
      getTrackingOverview(days),
      getTrackingFunnel(days),
      getTrackingTrend(days),
    ]);

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
