/**
 * POST /api/sync/conflicts — Resolve a sync conflict
 *
 * Body: { conversationKey, strategy, resolvedMessages? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { resolveConflict } from '@/lib/sync-engine';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { conversationKey, strategy, resolvedMessages } = body;

    if (!conversationKey || !strategy) {
      return NextResponse.json({ error: 'conversationKey and strategy are required' }, { status: 400 });
    }

    const result = await resolveConflict(userId, conversationKey, strategy, resolvedMessages);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync Conflicts] POST error:', message);
    return NextResponse.json({ error: '解决冲突失败', details: message }, { status: 500 });
  }
}

/**
 * GET /api/sync/conflicts — List unresolved conflicts for the user
 */
export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('@/lib/prisma');

    const conflicts = await prisma.syncConflict.findMany({
      where: {
        resolution: null,
        syncLog: { userId },
      },
      include: {
        syncLog: {
          select: { createdAt: true, deviceId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ conflicts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: '获取冲突列表失败', details: message }, { status: 500 });
  }
}
