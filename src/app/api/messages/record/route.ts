/**
 * POST /api/messages/record — Record a message sent by the authenticated user
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { recordMessage } from '@/lib/message-stats';

export async function POST(req: NextRequest) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await recordMessage(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    // Silently fail — usage tracking should never block chat
    console.error('[Record Message] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record' }, { status: 500 });
  }
}
