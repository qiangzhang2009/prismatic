/**
 * GET /api/analytics/content — Prismatic Content Health
 * Public endpoint for backend-admin dashboard (tenant=prismatic)
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
    console.error('Analytics content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
