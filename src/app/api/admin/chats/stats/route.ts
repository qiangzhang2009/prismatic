/**
 * Admin: Conversation & Message Statistics
 * GET /api/admin/chats/stats
 *
 * Returns authoritative statistics directly from the messages and conversations tables.
 * This is the single source of truth for both the Dashboard and Assets page —
 * replacing the broken approach of summing paginated conversation.messageCount fields.
 *
 * Uses @neondatabase/serverless Pool (Node.js runtime).
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
    console.error('[Admin/Chats/Stats] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: '未授权：请先登录管理账号' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const parsedDateFrom = dateFrom ? new Date(dateFrom) : null;
    const parsedDateTo = dateTo ? new Date(dateTo + 'T23:59:59Z') : null;

    // When days is specified (e.g., 7, 14, 30), compute rolling window — same as Dashboard
    // When dateFrom/dateTo are specified, use those (custom filter)
    const periodEnd = (parsedDateTo && !isNaN(parsedDateTo.getTime())) ? parsedDateTo : new Date();
    const periodStart = (parsedDateFrom && !isNaN(parsedDateFrom.getTime())) ? parsedDateFrom : (() => {
      const t = new Date();
      t.setUTCHours(0, 0, 0, 0);
      t.setUTCDate(t.getUTCDate() - days);
      return t;
    })();

    // Defensive: ensure neither date is Invalid before using them in SQL
    const startValid = periodStart && !isNaN(periodStart.getTime());
    const endValid = periodEnd && !isNaN(periodEnd.getTime());
    const periodStartStr = startValid ? periodStart.toISOString() : '';
    const periodEndStr = endValid ? periodEnd.toISOString() : '';

    const pool = getPool();

    // ── Build date-filtered conditions ───────────────────────────────────────
    const msgConditions: string[] = [`content != '[message-counted]'`];
    const convConditions: string[] = [];
    const dateParams: unknown[] = [];
    let idx = 1;

    // messages filtered by createdAt — only add if dates are valid
    if (startValid) {
      msgConditions.push(`"createdAt" >= $${idx}`);
      convConditions.push(`"updatedAt" >= $${idx}`);
      dateParams.push(periodStartStr);
      idx++;
    }
    if (endValid) {
      msgConditions.push(`"createdAt" <= $${idx}`);
      convConditions.push(`"updatedAt" <= $${idx}`);
      dateParams.push(periodEndStr);
      idx++;
    }

    const msgWhere = `WHERE ${msgConditions.join(' AND ')}`;
    const convWhere = convConditions.length > 0 ? `WHERE ${convConditions.join(' AND ')}` : '';

    const billingParams: unknown[] = [];
    if (startValid) billingParams.push(periodStartStr);
    if (endValid) billingParams.push(periodEndStr);
    const billingConditions: string[] = [];
    if (startValid) billingConditions.push(`c."updatedAt" >= $1`);
    if (endValid) billingConditions.push(`c."updatedAt" <= $${startValid ? 2 : 1}`);
    const billingWhere = billingConditions.length > 0 ? `WHERE ${billingConditions.join(' AND ')}` : '';

    // ── Run all queries in parallel ─────────────────────────────────────────
    const [
      convCountRows,
      msgStatsRows,
      modeDistRows,
      billingRows,
      personaRows,
      allTimeMsgRows,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) as cnt FROM conversations ${convWhere}`, dateParams),
      pool.query(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE role = 'user') as user_messages,
          COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
          COALESCE(SUM("tokensInput"), 0) as total_input_tokens,
          COALESCE(SUM("tokensOutput"), 0) as total_output_tokens,
          COALESCE(SUM("apiCost"), 0) as total_cost
        FROM messages
        ${msgWhere}
      `, dateParams),
      pool.query(`
        SELECT mode, COUNT(*) as cnt,
               COALESCE(SUM("totalCost"::numeric), 0) as cost_sum,
               COALESCE(SUM("totalTokens"), 0) as tokens_sum
        FROM conversations
        ${convWhere}
        GROUP BY mode
        ORDER BY cnt DESC
      `, dateParams),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid') as api_key_mode,
          COUNT(*) FILTER (WHERE u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid') as platform_mode
        FROM conversations c
        LEFT JOIN users u ON u.id = c."userId"
        ${billingWhere}
      `, billingParams),
      pool.query(`
        SELECT "personaId",
               COUNT(*) as msg_count,
               COALESCE(SUM("tokensInput" + "tokensOutput"), 0) as tokens,
               COALESCE(SUM("apiCost"), 0) as cost
        FROM messages
        ${msgWhere}
          AND "personaId" IS NOT NULL
          AND "personaId" != 'user'
        GROUP BY "personaId"
        ORDER BY msg_count DESC
        LIMIT 20
      `, dateParams),
      pool.query(`
        SELECT
          COUNT(*) as total_messages,
          COALESCE(SUM("tokensInput"), 0) as total_input_tokens,
          COALESCE(SUM("tokensOutput"), 0) as total_output_tokens,
          COALESCE(SUM("apiCost"), 0) as total_cost
        FROM messages
        WHERE content != '[message-counted]'
      `, []),
    ]);

    await pool.end();

    // ── Parse results ───────────────────────────────────────────────────────
    const msgStats = msgStatsRows.rows[0] || {};
    const totalMessages = parseInt(String(msgStats.total_messages ?? '0'), 10);
    const userMessages = parseInt(String(msgStats.user_messages ?? '0'), 10);
    const assistantMessages = parseInt(String(msgStats.assistant_messages ?? '0'), 10);

    const totalConversations = parseInt(String(convCountRows.rows[0]?.cnt ?? '0'), 10);

    const allTimeStats = allTimeMsgRows.rows[0] || {};
    const allTimeMessages = parseInt(String(allTimeStats.total_messages ?? '0'), 10);
    const allTimeTokens = Number(allTimeStats.total_input_tokens ?? 0) + Number(allTimeStats.total_output_tokens ?? 0);
    const allTimeCost = Number(allTimeStats.total_cost ?? 0);

    const modeStats = (modeDistRows.rows as any[]).map(r => ({
      mode: r.mode || 'unknown',
      count: parseInt(String(r.cnt), 10),
      totalCost: Number(r.cost_sum),
      totalTokens: Number(r.tokens_sum),
    }));

    // totalCost and totalTokens from conversations table (authoritative, populated by persistConversation)
    const totalCost = modeStats.reduce((s, m) => s + m.totalCost, 0);
    const totalTokens = modeStats.reduce((s, m) => s + m.totalTokens, 0);

    const billing = billingRows.rows[0] || {};
    const apiKeyMode = parseInt(String(billing.api_key_mode ?? '0'), 10);
    const platformMode = parseInt(String(billing.platform_mode ?? '0'), 10);

    const personaStats = (personaRows.rows as any[]).map(r => ({
      personaId: r.personaId,
      messageCount: parseInt(String(r.msg_count), 10),
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    }));

    return NextResponse.json({
      totalConversations,
      totalMessages,
      userMessages,
      assistantMessages,
      totalTokens,
      totalCost,
      modeStats,
      billing: { apiKeyMode, platformMode },
      personaStats,
      dateFilter: { days, dateFrom, dateTo },
      allTime: {
        totalMessages: allTimeMessages,
        totalTokens: allTimeTokens,
        totalCost: allTimeCost,
      },
    });
  } catch (err) {
    console.error('[Admin/Chats/Stats]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: `数据库错误: ${message}`,
      totalConversations: 0,
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      totalTokens: 0,
      totalCost: 0,
    }, { status: 500 });
  }
}
