/**
 * GET /api/admin/prismatic/overview — Proxy to backend-admin dashboard
 * Routes: /api/admin/prismatic/overview?tenant=prismatic&days=7
 * 
 * This endpoint is called by the websites-admin backend to fetch
 * Prismatic's analytics data for the centralized dashboard.
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
    console.error('Admin Prismatic overview error:', error);
    return NextResponse.json({
      overview: { dau: 0, wau: 0, mau: 0, sessions: 0, avgSessionDuration: 0, totalEvents: 0, totalPersonas: 0, totalConversations: 0, avgConversationsPerVisitor: 0 },
      funnel: [],
      trend: [],
    });
  }
}
