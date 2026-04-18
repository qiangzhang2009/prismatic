/**
 * Admin — User Activity API
 * 获取指定用户的详细活动历史
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await authenticateAdminRequest(request);

    const userId = params.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get recent events
    const events = await prisma.userEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventType: true,
        eventName: true,
        properties: true,
        context: true,
        personaName: true,
        conversationId: true,
        createdAt: true,
      },
    });

    // Get sessions
    const sessions = await prisma.userSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        sessionId: true,
        startedAt: true,
        endedAt: true,
        pageViews: true,
        messagesSent: true,
        deviceType: true,
        country: true,
      },
    });

    // Get daily metrics
    const metrics = await prisma.dailyMetric.findMany({
      where: { userId },
      orderBy: { statDate: 'desc' },
      take: 30,
      select: {
        statDate: true,
        messagesSent: true,
        personasUsedCount: true,
        timeSpentSeconds: true,
        lastConversationAt: true,
      },
    });

    return NextResponse.json({ events, sessions, metrics });
  } catch (error) {
    console.error('[Admin/UserActivity]', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
