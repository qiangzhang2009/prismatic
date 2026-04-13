/**
 * GET /api/analytics/personas — Prismatic Persona Stats
 * Direct query from Prismatic's own Neon PostgreSQL tracking tables.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTrackingPersonas } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  try {
    const personas = await getTrackingPersonas(days, limit);
    return NextResponse.json({ personas });
  } catch (error) {
    console.error('[Analytics Personas] Error:', error);
    return NextResponse.json({ personas: [] }, { status: 500 });
  }
}
