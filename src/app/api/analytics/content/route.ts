/**
 * GET /api/analytics/content — Prismatic Content Health
 * Direct query from Prismatic's own Neon PostgreSQL tracking tables.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingContentHealth } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  try {
    const content = await getTrackingContentHealth(days, limit);
    return NextResponse.json({ content });
  } catch (error) {
    console.error('[Analytics Content] Error:', error);
    return NextResponse.json({ content: [] }, { status: 500 });
  }
}
