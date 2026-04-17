/**
 * Analytics — Session Heartbeat API
 *
 * 会话心跳，用于更新会话的最后活跃时间。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId } = body as { sessionId: string; userId?: string };

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await prisma.userSession.update({
      where: { sessionId },
      data: { endedAt: null }, // 重置结束时间，标记为活跃
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Analytics/Session/Heartbeat]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
