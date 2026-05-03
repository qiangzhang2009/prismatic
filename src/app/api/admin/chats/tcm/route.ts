/**
 * Admin: TCM Chat conversation list
 * GET /api/admin/chats/tcm
 *
 * Returns all TCM conversations (type = 'TCM') with persona names resolved
 * from TCM_PERSONAS, and message history.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';
import { TCM_PERSONAS } from '@/lib/tcm-personas';

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

/** Resolve TCM persona IDs (slugs) to display names */
function resolveTCMPersonaNames(personaIds: string[] | null): Array<{ id: string; name: string; nameZh: string }> {
  if (!personaIds?.length) return [];
  return personaIds.map(id => {
    const persona = TCM_PERSONAS[id];
    return {
      id,
      name: persona?.nameZh || persona?.name || id,
      nameZh: persona?.nameZh || persona?.name || id,
    };
  });
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/Chats/TCM] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));
    const search = searchParams.get('search') || '';
    const personaId = searchParams.get('personaId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const userId = searchParams.get('userId') || '';

    const pool = getPool();
    const conditions: string[] = [`c.type = 'TCM'`];
    const params: unknown[] = [];
    let p = 1;

    if (userId) { conditions.push(`c."userId" = $${p++}`); params.push(userId); }
    if (dateFrom) { conditions.push(`c."updatedAt" >= $${p++}`); params.push(new Date(dateFrom)); }
    if (dateTo) { conditions.push(`c."updatedAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
    if (search) {
      conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND LOWER(m.content) LIKE LOWER($${p++}))`);
      params.push(`%${search}%`);
    }
    if (personaId) {
      conditions.push(`(c."personaIds" @> $${p++} OR EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m."personaId" = $${p++}))`);
      params.push(personaId, personaId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);

    const q = `
      SELECT c.id, c."userId", c.title, c.type, c.mode, c.participants, c.tags,
             c."totalTokens", c."totalCost", c."personaIds",
             c."createdAt", c."updatedAt",
             u.id as "user.id", u.name as "user.name", u.email as "user.email",
             u.plan as "user.plan",
             msgs.data as messages,
             msgs.real_message_count
      FROM conversations c
      LEFT JOIN users u ON u.id = c."userId"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) OVER () as real_message_count,
          json_agg(json_build_object(
            'id', m.id, 'role', m.role, 'content', m.content,
            'personaId', m."personaId", 'tokensInput', m."tokensInput",
            'tokensOutput', m."tokensOutput", 'apiCost', m."apiCost",
            'modelUsed', m."modelUsed", 'createdAt', m."createdAt",
            'metadata', m.metadata
          ) ORDER BY m."createdAt" ASC) as data
        FROM messages m WHERE m."conversationId" = c.id
      ) msgs ON true
      ${where}
      ORDER BY c."updatedAt" DESC
      LIMIT $${p++} OFFSET $${p++}
    `;

    const countQ = `SELECT COUNT(*) as cnt FROM conversations c ${where}`;

    const [rows, countRows] = await Promise.all([
      pool.query(q, params),
      pool.query(countQ, params.slice(0, -2)),
    ]);

    await pool.end();

    const total = parseInt(countRows.rows[0]?.cnt ?? '0', 10);

    const conversations = rows.rows.map((r: any) => {
      const personaNames = resolveTCMPersonaNames(r.personaIds || []);
      const msgs = (r.messages || []).map((m: any) => {
        const persona = personaNames.find((p) => p.id === m.personaId);
        let ragInfo = null;
        if (m.metadata != null) {
          try {
            const parsed = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            if (parsed?.rag) {
              ragInfo = {
                citations: parsed.rag.citations,
                chunkCount: parsed.rag.chunkCount,
              };
            }
          } catch { /* ignore */ }
        }
        return {
          ...m,
          personaName: persona?.nameZh || persona?.name || m.personaId || '用户',
          rag: ragInfo,
        };
      });

      return {
        id: r.id,
        userId: r.userId,
        title: r.title,
        type: r.type || 'TCM',
        mode: r.mode,
        participants: r.participants,
        messageCount: r.real_message_count ?? 0,
        totalTokens: r.totalTokens,
        totalCost: r.totalCost,
        personaIds: r.personaIds,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        billingMode: 'B',  // TCM is platform-only for now
        user: r['user.id'] ? {
          id: r['user.id'],
          name: r['user.name'],
          email: r['user.email'],
          plan: r['user.plan'],
        } : null,
        personas: personaNames,
        messages: msgs,
      };
    });

    // 计算统计数据
    const totalTokens = conversations.reduce((sum, c) => sum + (c.totalTokens || 0), 0);
    const totalCost = conversations.reduce((sum, c) => sum + parseFloat(String(c.totalCost || 0)), 0);
    const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);

    // 按人物统计
    const personaStats: Record<string, { nameZh: string; convCount: number; msgCount: number }> = {};
    for (const c of conversations) {
      for (const pid of (c.personaIds || [])) {
        if (!personaStats[pid]) {
          personaStats[pid] = { nameZh: TCM_PERSONAS[pid]?.nameZh || pid, convCount: 0, msgCount: 0 };
        }
        personaStats[pid].convCount++;
        personaStats[pid].msgCount += c.messageCount;
      }
    }

    return NextResponse.json({
      conversations,
      stats: {
        total,
        totalTokens,
        totalCost,
        totalMessages,
        conversationCount: conversations.length,
      },
      personaStats: Object.entries(personaStats).map(([pid, stat]) => ({
        personaId: pid,
        ...stat,
      })),
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[Admin/Chats/TCM]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      conversations: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      error: `数据库错误: ${message}`,
    });
  }
}
