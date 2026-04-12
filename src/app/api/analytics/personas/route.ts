/**
 * GET /api/analytics/personas — Prismatic Persona Stats
 * Public endpoint for backend-admin dashboard (tenant=prismatic)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingPersonas } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '30', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const personas = await getTrackingPersonas(days, limit);
    return NextResponse.json({ personas });
  } catch (error) {
    console.error('Analytics personas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
