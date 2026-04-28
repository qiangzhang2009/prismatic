/**
 * Admin: User behavior clustering
 * GET /api/admin/chats/behavior?days=30
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
    console.error('[Admin/Chats/Behavior] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  try {
    const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10)));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const pool = getPool();

    const groupResult = await pool.query(`
      SELECT c."userId",
             COUNT(*) as "convCount",
             COALESCE((SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id), 0) as "msgCount",
             COALESCE(SUM(c."totalCost"::numeric), 0) as "costSum"
      FROM conversations c
      WHERE c."updatedAt" >= $1
      GROUP BY c."userId"
      ORDER BY "convCount" DESC
      LIMIT 200
    `, [startDate]);

    const userIds = groupResult.rows.map((r: any) => r.userId);
    const allRows = userIds.length > 0
      ? await pool.query(`SELECT id, name, email, plan, "apiKeyEncrypted" FROM users WHERE id = ANY($1::text[])`, [userIds])
      : { rows: [] };

    await pool.end();

    const userMap: Record<string, any> = {};
    for (const u of allRows.rows) userMap[u.id] = u;

    const clusters = { heavy: [] as any[], explorer: [] as any[], casual: [] as any[], dormant: [] as any[] };

    for (const r of groupResult.rows) {
      const convCount = parseInt(String(r.convCount), 10);
      const msgCount = parseInt(String(r.msgCount), 10);
      const user = userMap[r.userId];
      if (!user) continue;

      const record = {
        userId: r.userId,
        name: user.name || user.email || r.userId,
        plan: user.plan || 'FREE',
        hasApiKey: !!user.apiKeyEncrypted,
        conversationCount: convCount,
        messageCount: msgCount,
        totalCost: Number(r.costSum || 0),
      };

      if (convCount >= 20 || msgCount >= 100) clusters.heavy.push(record);
      else if (convCount >= 10) clusters.explorer.push(record);
      else if (convCount >= 3) clusters.casual.push(record);
      else clusters.dormant.push(record);
    }

    return NextResponse.json({
      clusters: {
        heavy: { label: '重度用户', count: clusters.heavy.length, users: clusters.heavy.slice(0, 10) },
        explorer: { label: '探索型', count: clusters.explorer.length, users: clusters.explorer.slice(0, 10) },
        casual: { label: '轻量用户', count: clusters.casual.length, users: clusters.casual.slice(0, 10) },
        dormant: { label: '沉默用户', count: clusters.dormant.length, users: clusters.dormant.slice(0, 10) },
      },
      totalActiveUsers: groupResult.rows.length,
      period: { days },
    });
  } catch (err) {
    console.error('[Admin/Chats/Behavior]', err);
    return NextResponse.json({
      clusters: {
        heavy: { label: '重度用户', count: 0, users: [] },
        explorer: { label: '探索型', count: 0, users: [] },
        casual: { label: '轻量用户', count: 0, users: [] },
        dormant: { label: '沉默用户', count: 0, users: [] },
      },
      totalActiveUsers: 0,
      period: { days: 30 },
    });
  }
}
