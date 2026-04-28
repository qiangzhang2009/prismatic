/**
 * DEBUG: Device & conversation sync status for a given user
 * GET /api/debug/sync-status?userId=xxx&key=xxx
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }
  const sql = neon(DATABASE_URL);
  const { searchParams } = new URL(req.url);
  const adminKey = searchParams.get('key') || '';
  const email = searchParams.get('email') || '';
  const userId = searchParams.get('userId') || '';

  if (adminKey !== 'debug-admin-key-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid = userId;
  if (!uid && email) {
    const users = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    uid = users[0].id;
  }

  if (!uid) {
    return NextResponse.json({ error: 'userId or email required' }, { status: 400 });
  }

  // Get devices
  const devices = await sql`
    SELECT id, platform, "lastActiveAt", "userId"
    FROM devices WHERE "userId" = ${uid}
    ORDER BY "lastActiveAt" DESC
  `;

  // Get conversations
  const convs = await sql`
    SELECT id, mode, "messageCount", "createdAt", "updatedAt"
    FROM conversations WHERE "userId" = ${uid}
    ORDER BY "updatedAt" DESC
  `;

  // Get credit logs
  const credits = await sql`
    SELECT type, amount, balance, "createdAt"
    FROM user_credit_logs
    WHERE "userId" = ${uid} AND "createdAt" >= NOW() - INTERVAL '48 hours'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;

  // Get local_conversations for this user's devices
  const deviceIds = devices.map(d => d.id);
  let localConvs: any[] = [];
  if (deviceIds.length > 0) {
    const lcResult = await sql`
      SELECT lc."deviceId", lc."conversationKey", lc."localMessageCount", lc."lastLocalUpdateAt", lc."syncedConversationId"
      FROM local_conversations lc
      WHERE lc."deviceId" = ANY(${deviceIds})
      ORDER BY lc."lastLocalUpdateAt" DESC
    `;
    localConvs = lcResult;
  }

  return NextResponse.json({
    userId: uid,
    devices: devices.map(d => ({
      ...d,
      lastActiveAt: new Date(d.lastActiveAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    })),
    conversations: convs.map(c => ({
      id: c.id,
      mode: c.mode,
      messageCount: c.messageCount,
      createdAt: new Date(c.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      updatedAt: new Date(c.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    })),
    creditLogs: credits.map(c => ({
      type: c.type,
      amount: c.amount,
      balance: c.balance,
      createdAt: new Date(c.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    })),
    localConversations: localConvs.map(lc => ({
      deviceId: lc.deviceId,
      conversationKey: lc.conversationKey,
      localMessageCount: lc.localMessageCount,
      lastLocalUpdateAt: lc.lastLocalUpdateAt ? new Date(lc.lastLocalUpdateAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : null,
      syncedConversationId: lc.syncedConversationId,
    })),
    serverTime: new Date().toISOString(),
  });
}
