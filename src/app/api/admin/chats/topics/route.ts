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
      pool.query(`SELECT COUNT(*) as cnt FROM conversations WHERE "updatedAt" >= $1 AND (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = conversations.id AND m.content != '[message-counted]') >= 2`, [startDate]),
      pool.query(`
        SELECT c.id, c.mode, c."createdAt",
               msgs.data as messages,
               msgs.real_msg_count
        FROM conversations c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) OVER () as real_msg_count,
            -- 去重：同 (content, role, createdAt) 的消息只保留一条，最多取20条用于预览
            (SELECT json_agg(json_build_object('content', sub.content) ORDER BY sub."createdAt" ASC)
             FROM (
               SELECT DISTINCT ON (msg.content, msg.role, msg."createdAt")
                 msg.content, msg."createdAt"
               FROM messages msg
               WHERE msg."conversationId" = c.id AND msg.content != '[message-counted]'
               ORDER BY msg.content, msg.role, msg."createdAt", msg.id
               LIMIT 20
             ) sub
            ) as data
        ) msgs ON true
        WHERE c."updatedAt" >= $1 AND (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m.content != '[message-counted]') >= 2
        ORDER BY (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m.content != '[message-counted]') DESC
        LIMIT 500
      `, [startDate]),
    ]);

    await pool.end();

    const totalConversations = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    // 取第一条消息作为对话主题预览（去重后按时间排序的第一条，通常是用户提问）
    const topicSamples = convResult.rows.slice(0, 50).map((c: any) => ({
      id: c.id,
      preview: ((c.messages || [])[0]?.content || '').slice(0, 200),
    }));

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    console.log(`[Topics] deepseekKey present: ${!!deepseekKey}, conversations: ${totalConversations}, samples: ${topicSamples.length}`);

    if (!deepseekKey) {
      return NextResponse.json({ topics: [], totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days }, error: '未配置 DeepSeek API Key，无法进行话题聚类分析' });
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
              content: `你是一个对话话题分析助手。分析以下对话摘要列表，将它们归类为 5-8 个话题类别。只输出一个 JSON 数组，不要任何其他文字：\n[{"topic":"话题名","count":数字,"description":"一句话描述","examples":["示例1","示例2"]}]`,
            },
            {
              role: 'user',
              content: topicSamples.map((s: any) => `${s.id}: ${s.preview}`).join('\n'),
            },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || '';
      console.log(`[Topics] LLM raw: length=${rawContent.length}, preview=${rawContent.slice(0, 200).replace(/\n/g,' ')}`);

      let topics: any[] = [];
      // 可靠的 JSON 提取：从第一个 [ 匹配到最后一个 ]
      function extractJsonArray(text: string): string | null {
        const first = text.indexOf('[');
        const last = text.lastIndexOf(']');
        if (first === -1 || last === -1 || first > last) return null;
        return text.slice(first, last + 1);
      }
      const jsonStr = extractJsonArray(rawContent);
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            topics = parsed;
            console.log(`[Topics] JSON parse OK, count=${topics.length}`);
          }
        } catch (e) {
          console.error(`[Topics] JSON parse failed: ${e}`);
        }
      } else {
        console.warn(`[Topics] No JSON found, raw: ${rawContent.slice(0, 300)}`);
      }

      return NextResponse.json({ topics, totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days } });
    } catch (err) {
      console.error('[Admin/Chats/Topics] LLM error:', err);
      return NextResponse.json({ topics: [], totalConversations, sampledFrom: Math.min(500, totalConversations), period: { days }, error: `LLM 调用失败: ${err instanceof Error ? err.message : String(err)}` });
    }
  } catch (err) {
    console.error('[Admin/Chats/Topics]', err);
    return NextResponse.json({ topics: [], totalConversations: 0, sampledFrom: 0, period: { days: 7 }, error: `数据库错误: ${err instanceof Error ? err.message : String(err)}` });
  }
}
