/**
 * Admin: Persona interaction analysis
 * GET /api/admin/chats/personas?days=30
 *
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

// Persona name map from hardcoded personas + DB personas
function getPersonaMeta(personaId: string | null): { name: string; nameZh: string; domain: string } {
  if (!personaId) return { name: 'Unknown', nameZh: '未知', domain: 'unknown' };
  const personas = getPersonasByIds([personaId]);
  if (personas[0]) {
    return { name: personas[0].name, nameZh: personas[0].nameZh, domain: personas[0].domain?.[0] || 'unknown' };
  }
  // Fallback: try to look up in DB
  return { name: personaId, nameZh: personaId, domain: 'unknown' };
}

// ─── DB persona lookup (for analytics with DB personas) ────────────────────
async function getDbPersonaMeta(pool: any, personaId: string): Promise<{ name: string; nameZh: string; domain: string }> {
  const result = await pool.query(
    `SELECT name, namezh, domain FROM distilled_personas WHERE slug = $1 AND "isActive" = true`,
    [personaId]
  );
  if (result.rows[0]) {
    return {
      name: result.rows[0].name || personaId,
      nameZh: (result.rows[0].nameZh || result.rows[0].namezh || result.rows[0].name || personaId) as string,
      domain: Array.isArray(result.rows[0].domain) ? result.rows[0].domain[0] : (result.rows[0].domain || 'unknown'),
    };
  }
  return { name: personaId, nameZh: personaId, domain: 'unknown' };
}

export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch (authErr) {
    console.error('[Admin/Chats/Personas] Auth error:', authErr);
  }
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const pool = getPool();
  const daysParam = new URL(req.url).searchParams.get('days');
  const days = daysParam ? Math.max(1, parseInt(daysParam, 10)) : null;
  const startDate = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    : new Date(0);

  const [personaUsageResult, conversationsResult] = await Promise.all([
    pool.query(`
      SELECT "personaId",
             COUNT(*) as msg_count,
             COALESCE(SUM("tokensInput" + "tokensOutput"), 0) as tokens,
             COALESCE(SUM("apiCost"), 0) as cost
      FROM messages
      WHERE "createdAt" >= $1 AND "personaId" IS NOT NULL
      GROUP BY "personaId"
      ORDER BY msg_count DESC
    `, [startDate]),
    pool.query(`
      SELECT id, participants, "personaIds", "messageCount", "totalCost", "totalTokens"
      FROM conversations
      WHERE "updatedAt" >= $1
      LIMIT 500
    `, [startDate]),
  ]);

  await pool.end();

  const convPersonaStats: Record<string, {
    name: string; nameZh: string; domain: string;
    convCount: number; messageCount: number; totalCost: number; totalTokens: number;
  }> = {};

  for (const conv of conversationsResult.rows as any[]) {
    const allPersonaIds = new Set<string>();
    if (conv.participants) {
      for (const p of conv.participants) { if (p) allPersonaIds.add(p); }
    }
    if (conv.personaIds) {
      for (const p of conv.personaIds) { if (p) allPersonaIds.add(p); }
    }

    for (const pid of allPersonaIds) {
      if (!pid) continue;
      const meta = getPersonaMeta(pid);
      if (!convPersonaStats[pid]) {
        convPersonaStats[pid] = { name: meta.name, nameZh: meta.nameZh, domain: meta.domain, convCount: 0, messageCount: 0, totalCost: 0, totalTokens: 0 };
      }
      convPersonaStats[pid].convCount += 1;
      convPersonaStats[pid].messageCount += conv.messageCount || 0;
      convPersonaStats[pid].totalCost += Number(conv.totalCost || 0);
      convPersonaStats[pid].totalTokens += conv.totalTokens || 0;
    }
  }

  const msgPersonaStats: Record<string, {
    name: string; nameZh: string; domain: string;
    messageCount: number; totalTokens: number; totalCost: number;
  }> = {};

  for (const row of personaUsageResult.rows as any[]) {
    if (!row.personaId) continue;
    const meta = getPersonaMeta(row.personaId);
    const tokens = Number(row.tokens || 0);
    msgPersonaStats[row.personaId] = {
      name: meta.name,
      nameZh: meta.nameZh,
      domain: meta.domain,
      messageCount: parseInt(String(row.msg_count), 10),
      totalTokens: tokens,
      totalCost: Number(row.cost || 0),
    };
  }

  const allPersonaIds = new Set([...Object.keys(convPersonaStats), ...Object.keys(msgPersonaStats)]);

  const mergedPersonaUsage = Array.from(allPersonaIds).map(pid => {
    const conv = convPersonaStats[pid];
    const msg = msgPersonaStats[pid];
    const meta = getPersonaMeta(pid);

    return {
      personaId: pid,
      name: conv?.name ?? msg?.name ?? meta.name,
      nameZh: conv?.nameZh ?? msg?.nameZh ?? meta.nameZh,
      domain: conv?.domain ?? msg?.domain ?? meta.domain,
      conversationCount: conv?.convCount ?? 0,
      messageCount: (conv?.messageCount ?? 0) || (msg?.messageCount ?? 0),
      totalTokens: (conv?.totalTokens ?? 0) || (msg?.totalTokens ?? 0),
      totalCost: Number((conv?.totalCost ?? 0) || (msg?.totalCost ?? 0)),
    };
  });

  mergedPersonaUsage.sort((a, b) => b.conversationCount - a.conversationCount || b.messageCount - a.messageCount);

  // Co-occurrence
  const coOccurrence: Record<string, Record<string, number>> = {};
  for (const conv of conversationsResult.rows as any[]) {
    const ids = [...new Set([
      ...(conv.participants || []),
      ...(conv.personaIds || []),
    ])].filter(Boolean);

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort() as [string, string];
        if (!coOccurrence[a]) coOccurrence[a] = {};
        if (!coOccurrence[b]) coOccurrence[b] = {};
        coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1;
        coOccurrence[b][a] = (coOccurrence[b][a] || 0) + 1;
      }
    }
  }

  return NextResponse.json({
    personaUsage: mergedPersonaUsage,
    coOccurrence,
    period: { days },
  });
}
