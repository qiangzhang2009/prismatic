/**
 * Analytics — AI Conversation Analysis API
 *
 * Provides AI conversation depth analysis:
 * - Conversation trend statistics
 * - Persona usage rankings
 * - Token consumption statistics
 * - Cost analysis
 *
 * Uses @neondatabase/serverless neon() tagged template for Edge runtime compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

export const dynamic = 'force-dynamic';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

export async function GET(request: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const sql = getSql();

    const [
      totalMessagesResult,
      totalConversationsResult,
      tokenCostResult,
      personaStatsResult,
      conversationsResult,
      modeStatsResult,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as cnt FROM messages WHERE "createdAt" >= ${startDate} AND content != '[message-counted]'`,
      sql`SELECT COUNT(*) as cnt FROM conversations WHERE "updatedAt" >= ${startDate}`,
      sql`SELECT COALESCE(SUM("tokensInput"), 0) as ti, COALESCE(SUM("tokensOutput"), 0) as to, COALESCE(SUM("apiCost"), 0) as cost FROM messages WHERE "createdAt" >= ${startDate} AND content != '[message-counted]'`,
      sql`
        SELECT "personaId",
               COUNT(*) as msg_count,
               COALESCE(SUM("tokensInput" + "tokensOutput"), 0) as tokens,
               COALESCE(SUM("apiCost"), 0) as cost
        FROM messages
        WHERE "createdAt" >= ${startDate} AND "personaId" IS NOT NULL AND content != '[message-counted]'
        GROUP BY "personaId"
        ORDER BY msg_count DESC
        LIMIT 20
      `,
      sql`
        SELECT id, participants, "personaIds", "messageCount", "totalCost", "totalTokens"
        FROM conversations
        WHERE "updatedAt" >= ${startDate}
        LIMIT 500
      `,
      sql`
        SELECT c.mode,
               COUNT(*) as cnt,
               COALESCE(SUM(c."totalCost"::numeric), 0) as cost_sum
        FROM conversations c
        WHERE c."updatedAt" >= ${startDate}
        GROUP BY c.mode
      `,
    ]);

    const totalMessages = parseInt(totalMessagesResult[0]?.cnt ?? '0', 10);
    const totalConversations = parseInt(totalConversationsResult[0]?.cnt ?? '0', 10);
    const totalInputTokens = Number(tokenCostResult[0]?.ti ?? 0);
    const totalOutputTokens = Number(tokenCostResult[0]?.to ?? 0);
    const totalApiCost = Number(tokenCostResult[0]?.cost ?? 0);

    // Get persona names from hardcoded list
    const { getPersonasByIds } = await import('@/lib/personas');
    const personaWithNames = (personaStatsResult as any[]).map((row: any) => {
      const personas = getPersonasByIds([row.personaId]);
      const dbPersona = personas[0];
      return {
        personaId: row.personaId,
        personaName: dbPersona?.nameZh || dbPersona?.name || row.personaId,
        conversationCount: parseInt(String(row.msg_count), 10),
        totalTokens: Number(row.tokens),
        totalCost: Number(row.cost),
      };
    });

    // Daily trend
    const dailyTrendRaw = await sql`
      SELECT
        DATE("createdAt") as date,
        COUNT(DISTINCT id) as messages,
        COUNT(DISTINCT "conversationId") as conversations,
        COALESCE(SUM("tokensInput" + "tokensOutput"), 0) as tokens,
        COALESCE(SUM("apiCost"), 0) as cost
      FROM messages
      WHERE "createdAt" >= ${startDate} AND content != '[message-counted]'
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
      LIMIT ${days}
    `;
    const dailyTrend = (dailyTrendRaw as any[]).map((row: any) => ({
      date: new Date(String(row.date)).toISOString().split('T')[0],
      messages: parseInt(String(row.messages), 10),
      conversations: parseInt(String(row.conversations), 10),
      tokens: Number(row.tokens),
      cost: Number(row.cost),
    }));

    const modeStats = (modeStatsResult as any[]).map((row: any) => ({
      mode: row.mode,
      count: parseInt(String(row.cnt), 10),
      totalCost: Number(row.cost_sum),
    }));

    // Top users
    const topUsersResult = await sql`
      SELECT m."userId",
             COUNT(*) as msg_count,
             COALESCE(SUM(m."apiCost"), 0) as cost
      FROM messages m
      WHERE m."createdAt" >= ${startDate} AND m.content != '[message-counted]'
      GROUP BY m."userId"
      ORDER BY msg_count DESC
      LIMIT 10
    `;

    let topUsersWithNames: Array<{ userId: string; name: string; messageCount: number; totalCost: number }> = [];
    if ((topUsersResult as any[]).length > 0) {
      const userIds = (topUsersResult as any[]).map((r: any) => r.userId);
      const userInfoResult = await sql`SELECT id, name, email FROM users WHERE id = ANY(${userIds})`;
      const userMap: Record<string, any> = {};
      for (const u of userInfoResult as any[]) userMap[u.id] = u;
      topUsersWithNames = (topUsersResult as any[]).map((r: any) => ({
        userId: r.userId,
        name: userMap[r.userId]?.name || userMap[r.userId]?.email || 'Unknown',
        messageCount: parseInt(String(r.msg_count), 10),
        totalCost: Number(r.cost),
      }));
    }

    return NextResponse.json({
      overview: {
        totalMessages,
        totalConversations,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalApiCost,
        avgCostPerConversation: totalConversations > 0 ? totalApiCost / totalConversations : 0,
        avgTokensPerMessage: totalMessages > 0 ? (totalInputTokens + totalOutputTokens) / totalMessages : 0,
      },
      personas: personaWithNames,
      dailyTrend,
      modeStats,
      costByPersona: [],
      topUsers: topUsersWithNames,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('[Analytics/Conversation]', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', detail: message },
      { status: 500 }
    );
  }
}
