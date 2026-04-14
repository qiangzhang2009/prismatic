/**
 * GET /api/forum/debate          — Today's debate or preview
 * POST /api/forum/debate         — Run daily debate (admin/trigger)
 * GET /api/forum/debate/today    — Alias for today's debate
 * GET /api/forum/debate/history  — Recent debates
 * GET /api/forum/debate/:id      — Single debate
 * POST /api/forum/debate/join    — Join/watch a debate (increment view)
 * POST /api/forum/debate/vote    — Vote for a speaker
 * POST /api/forum/debate/suggest — Submit a topic suggestion
 * POST /api/forum/debate (action=start) — Admin: manually start a scheduled debate
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { getDebateByDate, getRecentDebates, getDebateById, incrementDebateView, castVote, submitTopicSuggestion, runDailyDebate, previewTodaysDebate, startScheduledDebate } from '@/lib/debate-arena-engine';

export const runtime = 'nodejs';

/** Runs an async function with an explicit timeout. */
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const id = searchParams.get('id');

  try {
    // GET /api/forum/debate/today
    if (path === 'today') {
      const debate = await getDebateByDate();
      if (debate) {
        return NextResponse.json({ debate });
      }
      const preview = await previewTodaysDebate();
      return NextResponse.json({ debate: null, preview });
    }

    // GET /api/forum/debate/history
    if (path === 'history') {
      const limit = parseInt(searchParams.get('limit') ?? '7', 10);
      const debates = await getRecentDebates(limit);
      return NextResponse.json({ debates });
    }

    // GET /api/forum/debate/:id
    if (id) {
      const debate = await getDebateById(parseInt(id, 10));
      if (!debate) {
        return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
      }
      return NextResponse.json({ debate });
    }

    // GET /api/forum/debate — default: today's debate
    const debate = await getDebateByDate();
    if (debate) {
      return NextResponse.json({ debate });
    }
    const preview = await previewTodaysDebate();
    return NextResponse.json({ debate: null, preview });
  } catch (error) {
    console.error('[Forum Debate API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch debate' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, debateId, personaId, topic, userId, ipHash } = body as {
      action?: string;
      debateId?: number;
      personaId?: string;
      topic?: string;
      userId?: string;
      ipHash?: string;
    };

    // ── Admin actions ────────────────────────────────────────────────────────

    // POST /api/forum/debate (action=start) — Admin: manually start a scheduled debate
    if (action === 'start') {
      const adminId = await authenticateAdminRequest(request);
      if (!adminId) {
        return NextResponse.json(
          { error: 'Admin access required. Please ensure you are logged in as an ADMIN user.' },
          { status: 403 }
        );
      }
      if (!debateId) {
        return NextResponse.json({ error: 'debateId required' }, { status: 400 });
      }
      // Timeout: give debate generation up to 55s before Vercel kills the function
      const result = await withTimeout(
        startScheduledDebate(debateId),
        55_000,
        'Debate generation timed out (55s limit). Try again.'
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, debateId });
    }

    // POST /api/forum/debate (action=create) — Admin: create a new debate immediately (runs it too)
    if (action === 'create') {
      const adminId = await authenticateAdminRequest(request);
      if (!adminId) {
        return NextResponse.json(
          { error: 'Admin access required. Please ensure you are logged in as an ADMIN user.' },
          { status: 403 }
        );
      }
      // Runs the full debate immediately (scheduled → running → completed)
      const result = await withTimeout(
        runDailyDebate(topic),
        55_000,
        'Debate generation timed out (55s limit). Try again.'
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, debateId: result.debateId, topic: result.topic });
    }

    // POST /api/forum/debate (no action) — Run daily debate (admin only in future, cron for now)
    if (!action) {
      const adminId = await authenticateAdminRequest(request);
      if (!adminId) {
        // Allow without auth for cron-triggered runs (Vercel Cron sets special headers)
        const cronSecret = request.headers.get('x-vercel-signature');
        const validCronSecret = process.env.VERCEL_CRON_SECRET;
        if (validCronSecret && cronSecret !== validCronSecret) {
          return NextResponse.json({ error: 'Admin or valid cron secret required' }, { status: 403 });
        }
      }
      // Timeout: Vercel Serverless max is ~10s for Hobby / 60s for Pro
      const result = await withTimeout(
        runDailyDebate(topic),
        55_000,
        'Debate generation timed out (55s limit). Try again.'
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, debateId: result.debateId, topic: result.topic });
    }

    // ── Public actions ──────────────────────────────────────────────────────

    // POST /api/forum/debate join
    if (action === 'join') {
      if (!debateId) return NextResponse.json({ error: 'debateId required' }, { status: 400 });
      await incrementDebateView(debateId, userId, ipHash);
      return NextResponse.json({ success: true });
    }

    // POST /api/forum/debate vote
    if (action === 'vote') {
      if (!debateId || !userId || !personaId) {
        return NextResponse.json({ error: 'debateId, userId, personaId required' }, { status: 400 });
      }
      const result = await castVote(debateId, userId, personaId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // POST /api/forum/debate suggest
    if (action === 'suggest') {
      if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });
      const result = await submitTopicSuggestion(topic, userId);
      if (!result.success) {
        return NextResponse.json({ error: '话题未通过安全审核' }, { status: 400 });
      }
      return NextResponse.json({ success: true, id: result.id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Forum Debate API] POST Error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
