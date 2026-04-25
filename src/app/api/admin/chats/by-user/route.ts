/**
 * Admin: Conversation list grouped by user
 * GET /api/admin/chats/by-user
 *
 * Returns conversations grouped by userId, with per-user stats and full message history.
 * Uses @neondatabase/serverless Pool to avoid Prisma Edge runtime incompatibility.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';
import { getPersonasByIds } from '@/lib/personas';

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

function resolvePersonaNames(personaIds: string[] | null): Array<{ id: string; name: string; nameZh: string }> {
  if (!personaIds?.length) return [];
  const personas = getPersonasByIds(personaIds);
  return personaIds.map(id => {
    const persona = personas.find(p => p.id === id);
    return { id, name: persona?.nameZh || persona?.name || id, nameZh: persona?.nameZh || persona?.name || id };
  });
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/Chats/ByUser] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const mode = searchParams.get('mode') || '';
  const billingMode = searchParams.get('billingMode') || '';
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));

  try {
    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (mode) { conditions.push(`c.mode = $${p++}`); params.push(mode); }
    if (dateFrom) { conditions.push(`c."updatedAt" >= $${p++}`); params.push(new Date(dateFrom)); }
    if (dateTo) { conditions.push(`c."updatedAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
    if (search) {
      conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND LOWER(m.content) LIKE LOWER($${p++}))`);
      params.push(`%${search}%`);
    }
    if (billingMode === 'A') {
      conditions.push(`u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid'`);
    } else if (billingMode === 'B') {
      conditions.push(`(u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // LATERAL join to include full message history for each conversation
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
          'modelUsed', m."modelUsed", 'createdAt', m."createdAt",
          'metadata', m.metadata
        ) ORDER BY m."createdAt" DESC) as data
        FROM messages m WHERE m."conversationId" = c.id
      ) msgs ON true
      ${where}
      ORDER BY c."updatedAt" DESC
      LIMIT 1000
    `;

    const [rows] = await Promise.all([pool.query(q, params)]);

    await pool.end();

    // Group by userId
    const userMap: Record<string, {
      user: Record<string, unknown> | null;
      conversations: Record<string, unknown>[];
      totalMessages: number; totalCost: number; totalTokens: number;
      convCount: number; lastActivity: string;
    }> = {};

    for (const r of rows.rows) {
      const uid = r.userId;
      if (!userMap[uid]) {
        const hasApiKey = r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid';
        userMap[uid] = {
          user: r['user.id'] ? {
            id: r['user.id'], name: r['user.name'], email: r['user.email'],
            plan: r['user.plan'], apiKeyEncrypted: r['user.apiKeyEncrypted'], apiKeyStatus: r['user.apiKeyStatus'],
          } : null,
          conversations: [],
          totalMessages: 0, totalCost: 0, totalTokens: 0,
          convCount: 0, lastActivity: '',
        };
      }

      // Attach persona names and full messages to each conversation
      const convPersonas = resolvePersonaNames(r.personaIds || []);
      const hasApiKey = r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid';
      const messages = (r.messages || []).map((m: any) => {
        const persona = convPersonas.find(p => p.id === m.personaId);
        let msgMode = r.mode;
        if (m.metadata != null) {
          try {
            const parsed = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            if (parsed && typeof parsed === 'object' && parsed.mode) msgMode = parsed.mode;
          } catch { /* ignore malformed metadata */ }
        }
        return { ...m, personaName: persona?.nameZh || persona?.name || m.personaId, msgMode };
      });

      userMap[uid].conversations.push({
        id: r.id,
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
        billingMode: hasApiKey ? 'A' : 'B',
        personas: convPersonas,
        messages,
      });

      userMap[uid].totalMessages += r.messageCount || 0;
      userMap[uid].totalCost += Number(r.totalCost || 0);
      userMap[uid].totalTokens += r.totalTokens || 0;
      userMap[uid].convCount += 1;
      const act = r.updatedAt?.toISOString() || r.createdAt?.toISOString() || '';
      if (!userMap[uid].lastActivity || act > userMap[uid].lastActivity) {
        userMap[uid].lastActivity = act;
      }
    }

    const users = Object.values(userMap)
      .sort((a, b) => b.totalMessages - a.totalMessages || b.convCount - a.convCount);

    const paginated = users.slice((page - 1) * pageSize, page * pageSize);
    return NextResponse.json({
      users: paginated,
      totalUsers: users.length,
      page, pageSize, totalPages: Math.ceil(users.length / pageSize),
    });
  } catch (err) {
    console.error('[Admin/Chats/ByUser]', err);
    return NextResponse.json({
      users: [],
      totalUsers: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  }
}
