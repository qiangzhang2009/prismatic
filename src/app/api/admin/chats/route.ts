/**
 * Admin: Conversation list with billing mode, persona, and content search
 * GET /api/admin/chats
 *
 * Uses @neontdatabase/serverless Pool to avoid Prisma Edge runtime incompatibility.
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
    console.error('[Admin/Chats] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));
    const search = searchParams.get('search') || '';
    const mode = searchParams.get('mode') || '';
    const billingMode = searchParams.get('billingMode') || '';
    const personaId = searchParams.get('personaId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const userId = searchParams.get('userId') || '';

    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (userId) { conditions.push(`c."userId" = $${p++}`); params.push(userId); }
    if (mode) { conditions.push(`c.mode = $${p++}`); params.push(mode); }
    if (dateFrom) { conditions.push(`c."createdAt" >= $${p++}`); params.push(new Date(dateFrom)); }
    if (dateTo) { conditions.push(`c."createdAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
    if (search) {
      conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND LOWER(m.content) LIKE LOWER($${p++}))`);
      params.push(`%${search}%`);
    }
    if (personaId) {
      conditions.push(`(c."personaIds" @> $${p++} OR EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m."personaId" = $${p++}))`);
      params.push(personaId, personaId);
    }
    if (billingMode === 'A') {
      conditions.push(`u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid'`);
    } else if (billingMode === 'B') {
      conditions.push(`(u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);

    // Use LATERAL join + slice in JS (Neon doesn't support LIMIT inside subqueries)
    const q = `
      SELECT c.id, c."userId", c.title, c.mode, c.participants, c.tags,
             c."messageCount", c."totalTokens", c."totalCost", c."personaIds",
             c."createdAt", c."updatedAt",
             u.id as "user.id", u.name as "user.name", u.email as "user.email",
             u.plan as "user.plan", u."apiKeyEncrypted" as "user.apiKeyEncrypted",
             u."apiKeyStatus" as "user.apiKeyStatus",
             msgs.data as messages
      FROM conversations c
      LEFT JOIN users u ON u.id = c."userId"
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', m.id, 'role', m.role, 'content', m.content,
          'personaId', m."personaId", 'tokensInput', m."tokensInput",
          'tokensOutput', m."tokensOutput", 'apiCost', m."apiCost",
          'modelUsed', m."modelUsed", 'createdAt', m."createdAt"
        ) ORDER BY m."createdAt" ASC) as data
        FROM messages m WHERE m."conversationId" = c.id
      ) msgs ON true
      ${where}
      ORDER BY c."createdAt" DESC
      LIMIT $${p++} OFFSET $${p++}
    `;

    const countQ = `SELECT COUNT(*) as cnt FROM conversations c LEFT JOIN users u ON u.id = c."userId" ${where}`;

    const [rows, countRows] = await Promise.all([
      pool.query(q, params),
      pool.query(countQ, params.slice(0, -2)),
    ]);

    await pool.end();

    const total = parseInt(countRows.rows[0]?.cnt ?? '0', 10);

    const conversations = rows.rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      mode: r.mode,
      participants: r.participants,
      tags: r.tags,
      messageCount: r.messageCount,
      totalTokens: r.totalTokens,
      totalCost: r.totalCost,
      personaIds: r.personaIds,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      billingMode: r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid' ? 'A' : 'B',
      user: r['user.id'] ? {
        id: r['user.id'],
        name: r['user.name'],
        email: r['user.email'],
        plan: r['user.plan'],
      } : null,
      messages: (r.messages || []).slice(0, 50),
    }));

    return NextResponse.json({
      conversations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[Admin/Chats]', err);
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
