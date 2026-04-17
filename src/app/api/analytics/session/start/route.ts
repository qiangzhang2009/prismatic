/**
 * Analytics — Session Start API
 *
 * 开始一个新的用户会话，记录设备信息、来源等。
 * 这是无状态的幂等端点，重复调用等同于"心跳"。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      userId,
      ipAddress,
      userAgent,
      referrer,
      deviceType,
      browser,
      os,
    } = body as {
      sessionId: string;
      userId: string;
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      deviceType?: 'mobile' | 'desktop' | 'tablet';
      browser?: string;
      os?: string;
    };

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.userSession.findUnique({
      where: { sessionId },
    });

    if (existing) {
      // 更新现有会话（视为活跃）
      await prisma.userSession.update({
        where: { sessionId },
        data: {
          pageViews: { increment: 1 },
          endedAt: null,
          ...(ipAddress && { ipAddress }),
          ...(userAgent && { userAgent }),
          ...(referrer && { referrer }),
          ...(deviceType && { deviceType }),
          ...(browser && { browser }),
          ...(os && { os }),
        },
      });
    } else {
      // 创建新会话
      await prisma.userSession.create({
        data: {
          sessionId,
          userId,
          ipAddress,
          userAgent,
          referrer,
          deviceType,
          browser,
          os,
          startedAt: new Date(),
          pageViews: 1,
          messagesSent: 0,
        },
      });
    }

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error('[Analytics/Session/Start]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
