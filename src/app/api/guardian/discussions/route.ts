/**
 * GET /api/guardian/discussions — List recent guardian discussions (public)
 * POST /api/guardian/discussions — Trigger guardian discussion generation (admin/cron)
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 20);

  try {
    const { getRecentDiscussions } = await import('@/lib/guardian-discussion-engine');
    const discussions = await withTimeout(getRecentDiscussions(limit), 8000, 'getRecentDiscussions');
    return NextResponse.json({ discussions });
  } catch (error) {
    console.error('[Guardian Discussions API] GET error:', error);
    return NextResponse.json({ discussions: [], note: 'Discussions temporarily unavailable' });
  }
}

export async function POST(req: NextRequest) {
  // Cron authorization: verify x-vercel-signature or admin auth
  const cronSecret = req.headers.get('x-vercel-signature');
  const validCronSecret = process.env.VERCEL_CRON_SECRET;

  if (validCronSecret && cronSecret !== validCronSecret) {
    // Fall back to admin check
    try {
      const { authenticateAdminRequest } = await import('@/lib/user-management');
      const adminId = await authenticateAdminRequest(req);
      if (!adminId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, discussionId: result.discussionId, topic: result.topic });
  } catch (error) {
    console.error('[Guardian Discussions API] POST error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
