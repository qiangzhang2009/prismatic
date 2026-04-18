/**
 * POST /api/cron/daily-debate — Vercel Cron entry point for Daily Debate
 * Triggered every day at 20:00 (Asia/Shanghai) via vercel.json cron config.
 *
 * Also supports GET for manual testing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runDailyDebate } from '@/lib/debate-arena-engine';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export async function POST(req: NextRequest) {
  // Verify cron authorization via Vercel signature or secret
  const cronSecret = req.headers.get('x-vercel-signature');
  const validCronSecret = process.env.VERCEL_CRON_SECRET;
  if (validCronSecret && cronSecret !== validCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { topic } = body as { topic?: string };

    const result = await withTimeout(
      runDailyDebate(topic),
      55_000,
      'runDailyDebate'
    );

    if (!result.success) {
      console.error('[Cron Daily Debate] Failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log('[Cron Daily Debate] Success:', result.topic);
    return NextResponse.json({
      success: true,
      debateId: result.debateId,
      topic: result.topic,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Cron Daily Debate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET for manual testing (browser / curl)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const validCronSecret = process.env.VERCEL_CRON_SECRET;

  if (validCronSecret && secret !== validCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await withTimeout(
      runDailyDebate(),
      55_000,
      'runDailyDebate'
    );

    return NextResponse.json({
      success: result.success,
      debateId: result.debateId,
      topic: result.topic,
      error: result.error,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
