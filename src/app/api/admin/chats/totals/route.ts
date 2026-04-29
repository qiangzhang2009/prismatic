/**
 * Admin: Aggregate totals for AssetOverview
 * GET /api/admin/chats/totals
 *
 * Returns full-data aggregates (not page-limited) for the AssetOverview KPIs:
 * total conversations, messages, tokens, cost, breakdown by billing mode and conversation mode.
 * Always respects the same filters as /api/admin/chats.
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
    console.error('[Admin/Chats/Totals] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || '';
  const billingMode = searchParams.get('billingMode') || '';
  const personaId = searchParams.get('personaId') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (mode) { conditions.push(`c.mode = $${p++}`); params.push(mode); }
    if (dateFrom) { conditions.push(`c."updatedAt" >= $${p++}`); params.push(new Date(dateFrom)); }
    if (dateTo) { conditions.push(`c."updatedAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
    if (personaId) {
      conditions.push(`(c."personaIds" @> $${p++} OR EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m."personaId" = $${p++}))`);
      params.push(personaId, personaId);
    }
    if (billingMode === 'A') {
      conditions.push(`u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid'`);
    } else if (billingMode === 'B') {
      conditions.push(`(u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid')`);
    }
    // Only count conversations that have actual messages (excluding [message-counted] sentinel)
    conditions.push(`(SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m.content != '[message-counted]') > 0`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Use LATERAL to get per-conversation real message count (excluding [message-counted])
    const q = `
      SELECT
        COUNT(*)::int as total_conversations,
        COALESCE(SUM(msgs.real_msg_count), 0)::bigint as total_messages,
        COALESCE(SUM(c."totalTokens"), 0)::bigint as total_tokens,
        COALESCE(SUM(c."totalCost"), 0)::numeric as total_cost,
        -- Billing mode breakdown
        COUNT(*) FILTER (WHERE u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid') as api_key_count,
        COUNT(*) FILTER (WHERE u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid') as platform_count,
        -- Conversation mode breakdown
        COUNT(*) FILTER (WHERE c.mode = 'solo') as solo_count,
        COUNT(*) FILTER (WHERE c.mode = 'roundtable') as roundtable_count,
        COUNT(*) FILTER (WHERE c.mode = 'mirror') as mirror_count
      FROM conversations c
      LEFT JOIN users u ON u.id = c."userId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as real_msg_count
        FROM messages m
        WHERE m."conversationId" = c.id AND m.content != '[message-counted]'
      ) msgs ON true
      ${where}
    `;

    const result = await pool.query(q, params);
    await pool.end();

    const r = result.rows[0];
    return NextResponse.json({
      totalConversations: r.total_conversations,
      totalMessages: Number(r.total_messages),
      totalTokens: Number(r.total_tokens),
      totalCost: Number(r.total_cost),
      billing: {
        apiKey: r.api_key_count,
        platform: r.platform_count,
      },
      mode: {
        solo: r.solo_count,
        roundtable: r.roundtable_count,
        mirror: r.mirror_count,
      },
    });
  } catch (err) {
    console.error('[Admin/Chats/Totals]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
