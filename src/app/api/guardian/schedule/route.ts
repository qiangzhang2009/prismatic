/**
 * GET /api/guardian/schedule — Guardian duty schedule
 * Reuses the same raw SQL approach as getScheduleRange() in @/lib/guardian
 */
import { NextRequest, NextResponse } from 'next/server';
import { getScheduleRange } from '@/lib/guardian';

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30_000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '14'), 30);

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const endStr = endDate.toISOString().slice(0, 10);

    const schedule = await withTimeout(
      getScheduleRange(todayStr, endStr),
      30_000
    );

    if (schedule === null) {
      return NextResponse.json({ schedule: [], note: 'Schedule temporarily unavailable' }, { status: 200 });
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('[Guardian Schedule] Error:', error);
    return NextResponse.json({ schedule: [], note: 'Schedule temporarily unavailable' }, { status: 200 });
  }
}
