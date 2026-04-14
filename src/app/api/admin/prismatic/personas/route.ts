/**
 * GET /api/admin/prismatic/personas — Proxy to backend-admin dashboard
 * Routes: /api/admin/prismatic/personas?tenant=prismatic&days=30&sort=views&order=desc
 * 
 * Returns persona-level analytics data.
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
    console.error('Admin Prismatic personas error:', error);
    return NextResponse.json({ personas: [] });
  }
}
