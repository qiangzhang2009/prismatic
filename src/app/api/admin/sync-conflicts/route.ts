/**
 * Admin: Unresolved Sync Conflicts
 * GET /api/admin/sync-conflicts — List all unresolved conflicts
 * POST /api/admin/sync-conflicts — Resolve a conflict (admin can resolve on behalf of user)
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
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getPool();

    const q = `
      SELECT sc.id, sc."conversationKey", sc."personaIds", sc."conflictType",
             sc.resolution, sc."resolvedAt", sc."createdAt",
             sl."userId", sl.direction, sl.status as "syncStatus",
             u.email as "user.email", u.name as "user.name"
      FROM sync_conflicts sc
      JOIN sync_logs sl ON sl.id = sc."syncLogId"
      LEFT JOIN users u ON u.id = sl."userId"
      WHERE sc.resolution IS NULL
      ORDER BY sc."createdAt" DESC
      LIMIT 100
    `;

    const { rows } = await pool.query(q);
    await pool.end();

    const conflicts = rows.map((r: any) => ({
      id: r.id,
      conversationKey: r.conversationKey,
      personaIds: r.personaIds,
      conflictType: r.conflictType,
      resolution: r.resolution,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      userId: r.userId,
      user: r['user.email'] ? {
        email: r['user.email'],
        name: r['user.name'],
      } : null,
    }));

    return NextResponse.json({ conflicts, total: conflicts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin/SyncConflicts] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
