/**
 * Analytics — Session End API
 *
 * 结束用户会话，记录结束时间和持续时间。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, durationSeconds } = body as {
      sessionId: string;
      userId?: string;
      durationSeconds?: number;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await prisma.userSession.update({
      where: { sessionId },
      data: {
        endedAt: new Date(),
        ...(durationSeconds !== undefined && { durationSeconds }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Analytics/Session/End]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
