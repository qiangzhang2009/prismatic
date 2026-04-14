/**
 * GET /api/admin/prismatic/content — Proxy to backend-admin dashboard
 * Routes: /api/admin/prismatic/content?tenant=prismatic&days=30
 * 
 * Returns content health analytics.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingContentHealth } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    const content = await getTrackingContentHealth(days);
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Admin Prismatic content error:', error);
    return NextResponse.json({ content: [] });
  }
}
