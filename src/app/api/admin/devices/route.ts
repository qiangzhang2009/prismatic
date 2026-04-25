/**
 * Admin: Device and Sync Management
 * GET /api/admin/devices — List all devices per user
 * DELETE /api/admin/devices?id=xxx — Unregister a device
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
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';

    let where = '';
    const params: unknown[] = [];

    if (userId) {
      where = 'WHERE d."userId" = $1';
      params.push(userId);
    }

    const q = `
      SELECT d.id, d."userId", d."deviceName", d."deviceType", d.platform,
             d.browser, d."osVersion", d."lastActiveAt", d."lastSyncedAt", d."isActive",
             d."createdAt",
             u.email as "user.email", u.name as "user.name",
             (SELECT COUNT(*) FROM local_conversations lc WHERE lc."deviceId" = d.id) as "convCount"
      FROM devices d
      LEFT JOIN users u ON u.id = d."userId"
      ${where}
      ORDER BY d."lastActiveAt" DESC
      LIMIT 200
    `;

    const { rows } = await pool.query(q, params);
    await pool.end();

    const devices = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      deviceName: r.deviceName,
      deviceType: r.deviceType,
      platform: r.platform,
      browser: r.browser,
      osVersion: r.osVersion,
      lastActiveAt: r.lastActiveAt,
      lastSyncedAt: r.lastSyncedAt,
      isActive: r.isActive,
      convCount: parseInt(r.convCount, 10),
      createdAt: r.createdAt,
      user: r['user.email'] ? {
        email: r['user.email'],
        name: r['user.name'],
      } : null,
    }));

    return NextResponse.json({ devices, total: devices.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin/Devices] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      await pool.end();
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    // Delete local_conversations for this device
    await pool.query('DELETE FROM local_conversations WHERE "deviceId" = $1', [deviceId]);
    // Delete the device
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [deviceId]);
    await pool.end();

    return NextResponse.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin/Devices] DELETE error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
