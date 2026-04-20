/**
 * POST /api/sync/push — Lightweight push of local conversations
 *
 * Triggered on:
 *  - When user closes the app / switches conversations
 *  - After each chat message is sent (real-time lightweight push)
 *  - Automatic background push every 5 minutes
 *
 * This is a lightweight endpoint — just updates the server-side snapshots
 * without pulling. For full sync, use POST /api/sync.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { pushConversations, type LocalConversationSnapshot } from '@/lib/sync-engine';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { deviceId, snapshots } = body as {
      deviceId: string;
      snapshots: LocalConversationSnapshot[];
    };

    if (!deviceId || !Array.isArray(snapshots)) {
      return NextResponse.json({ error: 'deviceId and snapshots[] are required' }, { status: 400 });
    }

    const result = await pushConversations(userId, deviceId, snapshots);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync Push] error:', message);
    return NextResponse.json(
      { error: '推送失败', details: message },
      { status: 500 }
    );
  }
}
