/**
 * POST /api/sync/migrate — Migrate visitor conversations to registered user account
 *
 * Called when:
 *  1. A guest user creates an account → their local conversations are migrated
 *  2. A guest user logs in → their local conversations are merged
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { migrateVisitorConversations, type LocalConversationSnapshot } from '@/lib/sync-engine';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { visitorId, snapshots } = body as {
      visitorId: string;
      snapshots: LocalConversationSnapshot[];
    };

    if (!visitorId || !Array.isArray(snapshots)) {
      return NextResponse.json(
        { error: 'visitorId and snapshots[] are required' },
        { status: 400 }
      );
    }

    const result = await migrateVisitorConversations(userId, visitorId, snapshots);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync Migrate] error:', message);
    return NextResponse.json(
      { error: '迁移失败', details: message },
      { status: 500 }
    );
  }
}
