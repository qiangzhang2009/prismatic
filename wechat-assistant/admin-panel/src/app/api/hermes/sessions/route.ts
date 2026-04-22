// GET /api/hermes/sessions — 所有会话记录
import { NextRequest, NextResponse } from 'next/server';
import { readSessionsMeta, readSessionFull, readSessionMessages } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const meta = readSessionsMeta().find(
        (s) => s.session_id === sessionId,
      );
      const full = readSessionFull(sessionId);
      const messages = readSessionMessages(sessionId);

      if (!full) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({ meta, full, messages });
    }

    const sessions = readSessionsMeta();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[API/hermes/sessions]', error);
    return NextResponse.json({ sessions: [] });
  }
}
