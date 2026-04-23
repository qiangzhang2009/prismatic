/**
 * GET /api/sync — Pull server conversations for this device
 *
 * Triggered on:
 *  - App initial load (after login)
 *  - Manual refresh
 *
 * Query params:
 *  - deviceId: string (required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { pullConversationsForDevice, runSync, type SyncRequest } from '@/lib/sync-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  try {
    const result = await pullConversationsForDevice(userId, deviceId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Sync API] GET /api/sync error:', message, error instanceof Error ? '\n' + error.stack : '');
    return NextResponse.json(
      { error: '获取对话失败', details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync — Bidirectional full sync
 *
 * Triggered on:
 *  - App initial load (after login) — full sync with device registration
 *  - Manual refresh
 *
 * This handles both push (local conversations → server) and pull (server → local).
 */
export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json() as SyncRequest;

    if (!body.deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const result = await runSync(userId, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    console.error('[Sync API] POST /api/sync error:', message, '\n', stack);
    return NextResponse.json(
      { error: '同步失败', details: message, stack },
      { status: 500 }
    );
  }
}
