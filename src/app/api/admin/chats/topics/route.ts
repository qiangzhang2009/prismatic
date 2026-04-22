/**
 * Admin: Topic clustering of conversations
 * GET /api/admin/chats/topics?days=7
 *
 * Uses @neondatabase/serverless Pool to avoid Prisma Edge runtime incompatibility.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/Chats/Topics] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  try {
    const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '7', 10)));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const pool = getPool();

    const [countResult, convResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as cnt FROM conversations WHERE "createdAt" >= $1 AND "messageCount" >= 2`, [startDate]),
      pool.query(`
        SELECT c.id, c.mode, c."createdAt",
               msgs.data as messages
        FROM conversations c
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object('content', m.content) ORDER BY m."createdAt" ASC) as data
          FROM messages m WHERE m."conversationId" = c.id
        ) msgs ON true
        WHERE c."createdAt" >= $1 AND c."messageCount" >= 2
        ORDER BY c."messageCount" DESC
        LIMIT 500
      `, [startDate]),
    ]);

    await pool.end();

    const totalConversations = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    const topicSamples = convResult.rows.slice(0, 50).map((c: any) => ({
      id: c.id,
      preview: ((c.messages || []).slice(0, 3)).map((m: any) => m.content).join('\n').slice(0, 200),
    }));

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
              content: topicSamples.map((s: any) => `[${s.id}]: ${s.preview}`).join('\n\n'),
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
  } catch (err) {
    console.error('[Admin/Chats/Topics]', err);
    return NextResponse.json({ topics: [], totalConversations: 0, sampledFrom: 0, period: { days: 7 } });
  }
}
