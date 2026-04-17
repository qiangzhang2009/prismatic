/**
 * Analytics — Event Tracking API
 *
 * 统一的用户行为事件记录端点。
 * 支持单条和批量事件。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type EventInput = {
  userId: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  personaId?: string;
  personaName?: string;
  conversationId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 支持单条事件或批量事件
    const events: EventInput[] = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }

    // 批量插入
    const created = await prisma.userEvent.createMany({
      data: events.map(e => ({
        userId: e.userId,
        sessionId: e.sessionId || null,
        eventType: e.eventType,
        eventName: e.eventName,
        properties: e.properties ? JSON.stringify(e.properties) : null,
        context: e.context ? JSON.stringify(e.context) : null,
        personaId: e.personaId || null,
        personaName: e.personaName || null,
        conversationId: e.conversationId || null,
        createdAt: new Date(),
      })),
      skipDuplicates: false, // 新表不设唯一约束
    });

    return NextResponse.json({
      success: true,
      count: created.count,
    });
  } catch (error) {
    console.error('[Analytics/Event]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET 请求返回支持的 eventType 列表（用于调试）
export async function GET() {
  return NextResponse.json({
    eventTypes: [
      'page_view',        // 页面浏览
      'button_click',     // 按钮点击
      'chat_start',       // 开始对话
      'chat_end',         // 结束对话
      'chat_message',     // 发送消息
      'feature_used',     // 使用功能
      'persona_view',     // 查看人物
      'admin_action',     // 管理员操作
    ],
  });
}
