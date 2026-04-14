/**
 * GET /api/admin/prismatic/funnel — Proxy to backend-admin dashboard
 * Routes: /api/admin/prismatic/funnel?tenant=prismatic&days=30
 * 
 * Returns conversion funnel data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingFunnel } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    const funnel = await getTrackingFunnel(days);
    return NextResponse.json({ funnel });
  } catch (error) {
    console.error('Admin Prismatic funnel error:', error);
    return NextResponse.json({ funnel: [] });
  }
}
