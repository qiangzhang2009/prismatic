/**
 * GET /api/analytics/users — Prismatic Visitor Profiles & Device Stats
 * Direct query from Prismatic's own Neon PostgreSQL tracking tables.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingVisitors, getTrackingDeviceStats } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  try {
    const [visitors, devices] = await Promise.all([
      getTrackingVisitors(limit),
      getTrackingDeviceStats(days),
    ]);
    return NextResponse.json({ visitors, devices, geo: [] });
  } catch (error) {
    console.error('[Analytics Users] Error:', error);
    return NextResponse.json({ visitors: [], devices: [], geo: [] }, { status: 500 });
  }
}
