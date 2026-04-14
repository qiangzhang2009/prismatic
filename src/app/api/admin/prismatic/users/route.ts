/**
 * GET /api/admin/prismatic/users — Proxy to backend-admin dashboard
 * Routes: /api/admin/prismatic/users?tenant=prismatic&days=30
 * 
 * Returns visitor profile data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingVisitors, getTrackingDeviceStats } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    const [visitors, devices] = await Promise.all([
      getTrackingVisitors(limit),
      getTrackingDeviceStats(days),
    ]);

    return NextResponse.json({ visitors, devices, geo: [] });
  } catch (error) {
    console.error('Admin Prismatic users error:', error);
    return NextResponse.json({ visitors: [], devices: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 }, geo: [] });
  }
}
