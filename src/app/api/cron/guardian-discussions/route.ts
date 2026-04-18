/**
 * POST /api/cron/guardian-discussions — Vercel Cron entry point for Guardian Autonomous Discussions
 * Triggered every day at 09:00 (Asia/Shanghai) via vercel.json cron config.
 *
 * Also supports GET for manual testing (e.g., from browser or curl).
 */
import { NextRequest, NextResponse } from 'next/server';
import { runGuardianAutonomousDiscussion } from '@/lib/guardian-discussion-engine';

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
      runGuardianAutonomousDiscussion(topic),
      55_000,
      'runGuardianAutonomousDiscussion'
    );

    if (!result.success) {
      console.error('[Cron Guardian Discussions] Failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log('[Cron Guardian Discussions] Success:', result.topic);
    return NextResponse.json({
      success: true,
      discussionId: result.discussionId,
      topic: result.topic,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Cron Guardian Discussions] Error:', msg);
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
      runGuardianAutonomousDiscussion(),
      55_000,
      'runGuardianAutonomousDiscussion'
    );

    return NextResponse.json({
      success: result.success,
      discussionId: result.discussionId,
      topic: result.topic,
      error: result.error,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
