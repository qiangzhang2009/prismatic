/**
 * GET /api/analytics/users — Prismatic Visitor Profiles
 * Public endpoint for backend-admin dashboard (tenant=prismatic)
 *
 * Uses sequential queries to avoid Neon cold-start timeout.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingVisitors, getTrackingDeviceStats } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    // Sequential queries to reduce Neon cold-start connection overhead
    const visitors = await getTrackingVisitors(limit);
    const devices = await getTrackingDeviceStats(days);

    return NextResponse.json({ visitors, devices, geo: [] });
  } catch (error) {
    console.error('Analytics users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
