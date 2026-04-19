/**
 * Admin: Topic clustering of conversations
 * GET /api/admin/chats/topics?days=7
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '7', 10)));
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Count total qualifying conversations (before take limit)
  const totalConversations = await prisma.conversation.count({
    where: {
      createdAt: { gte: startDate },
      messageCount: { gte: 2 },
    },
  });

  const conversations = await prisma.conversation.findMany({
    where: {
      createdAt: { gte: startDate },
      messageCount: { gte: 2 },
    },
    orderBy: { messageCount: 'desc' },
    take: 500,
    select: {
      id: true,
      mode: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 3,
        select: { content: true },
      },
    },
  });

  const topicSamples = conversations.slice(0, 50).map(c => ({
    id: c.id,
    preview: c.messages.map(m => m.content).join('\n').slice(0, 200),
  }));

  // Use DeepSeek for topic clustering
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return NextResponse.json({ topics: [], totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days }, error: 'No LLM configured' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `分析以下对话摘要列表，将它们归类为 5-10 个话题类别。输出 JSON 数组：[{ "topic": "话题名", "count": 数量, "description": "描述", "examples": ["示例1", "示例2"] }]，只输出 JSON，不要其他文字。`,
          },
          {
            role: 'user',
            content: topicSamples.map(s => `[${s.id}]: ${s.preview}`).join('\n\n'),
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    let topics: any[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) topics = JSON.parse(match[0]);
    } catch {}

    return NextResponse.json({ topics, totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days } });
  } catch (err) {
    console.error('[Admin/Chats/Topics] LLM error:', err);
    return NextResponse.json({ topics: [], totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days }, error: 'Topic clustering failed' });
  }
}
