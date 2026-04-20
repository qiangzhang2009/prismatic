/**
 * Admin: Persona interaction analysis
 * GET /api/admin/chats/personas?days=30
 *
 * Data sources:
 * 1. messages table — personaId + tokens + cost (actual usage)
 * 2. conversations.participants — all personas that appeared in conversations
 * 3. conversations.personaIds — full persona list per conversation
 *
 * Personas are defined in code (src/lib/personas.ts), not in DB.
 * We join on slug to get persona metadata (name, domain).
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { prisma } from '@/lib/prisma';

// Persona name map — key is slug (matches personaId in messages/conversations)
const PERSONA_NAMES: Record<string, { name: string; nameZh: string; domain: string }> = {
  'steve-jobs':         { name: 'Steve Jobs',         nameZh: '史蒂夫·乔布斯',       domain: 'product' },
  'elon-musk':          { name: 'Elon Musk',          nameZh: '埃隆·马斯克',         domain: 'strategy' },
  'charlie-munger':     { name: 'Charlie Munger',     nameZh: '查理·芒格',           domain: 'thinking' },
  'zhang-yiming':       { name: 'Zhang Yiming',        nameZh: '张一鸣',               domain: 'strategy' },
  'warren-buffett':     { name: 'Warren Buffett',      nameZh: '沃伦·巴菲特',         domain: 'investing' },
  'peter-thiel':        { name: 'Peter Thiel',          nameZh: '彼得·蒂尔',           domain: 'strategy' },
  'nassim-taleb':       { name: 'Nassim Taleb',        nameZh: '纳西姆·塔勒布',       domain: 'thinking' },
  'ray-dalio':          { name: 'Ray Dalio',            nameZh: '瑞·达利欧',           domain: 'investing' },
  'paul-graham':        { name: 'Paul Graham',          nameZh: '保罗·格雷厄姆',       domain: 'startup' },
  'marcus-aurelius':    { name: 'Marcus Aurelius',      nameZh: '马可·奥勒留',         domain: 'philosophy' },
  'sun-tzu':             { name: 'Sun Tzu',              nameZh: '孙子',                 domain: 'strategy' },
  'confucius':           { name: 'Confucius',            nameZh: '孔子',                 domain: 'philosophy' },
  'socrates':            { name: 'Socrates',             nameZh: '苏格拉底',             domain: 'philosophy' },
  'andrej-karpathy':     { name: 'Andrej Karpathy',      nameZh: '安德烈·卡帕蒂',       domain: 'ai' },
  'sam-altman':          { name: 'Sam Altman',            nameZh: '萨姆·阿尔特曼',       domain: 'strategy' },
  'baba-shiv':           { name: 'Baba Shiv',            nameZh: '巴巴·希夫',           domain: 'marketing' },
  'jeff-bezos':          { name: 'Jeff Bezos',           nameZh: '杰夫·贝索斯',         domain: 'strategy' },
  'howard-stevenson':    { name: 'Howard Stevenson',     nameZh: '霍华德·史蒂文森',     domain: 'leadership' },
  'michael-porter':      { name: 'Michael Porter',       nameZh: '迈克尔·波特',         domain: 'strategy' },
  'jocko-willink':       { name: 'Jocko Willink',        nameZh: '乔科·威林克',         domain: 'leadership' },
};

function getPersonaMeta(personaId: string | null): { name: string; nameZh: string; domain: string } {
  if (!personaId) return { name: 'Unknown', nameZh: '未知', domain: 'unknown' };
  return PERSONA_NAMES[personaId] ?? { name: personaId, nameZh: personaId, domain: 'unknown' };
}

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10)));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [personaUsage, conversations] = await Promise.all([
      prisma.message.groupBy({
        by: ['personaId'],
        where: {
          createdAt: { gte: startDate },
          personaId: { not: null },
        },
        _count: { id: true },
        _sum: { tokensInput: true, tokensOutput: true, apiCost: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      prisma.conversation.findMany({
        where: { createdAt: { gte: startDate } },
        select: {
          id: true,
          participants: true,
          personaIds: true,
          messageCount: true,
          totalCost: true,
          totalTokens: true,
        },
        take: 500,
      }),
    ]);

    const convPersonaStats: Record<string, {
      name: string; nameZh: string; domain: string;
      convCount: number; messageCount: number; totalCost: number; totalTokens: number;
    }> = {};

    for (const conv of conversations) {
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

    for (const p of personaUsage) {
      if (!p.personaId) continue;
      const meta = getPersonaMeta(p.personaId);
      const tokens = Number(p._sum.tokensInput || 0) + Number(p._sum.tokensOutput || 0);
      msgPersonaStats[p.personaId] = {
        name: meta.name,
        nameZh: meta.nameZh,
        domain: meta.domain,
        messageCount: Number(p._count.id),
        totalTokens: tokens,
        totalCost: Number(p._sum.apiCost || 0),
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

    const coOccurrence: Record<string, Record<string, number>> = {};
    for (const conv of conversations) {
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
  } catch (error) {
    console.error('[Admin/Chats/Personas]', error);
    return NextResponse.json({
      personaUsage: [],
      coOccurrence: {},
      period: { days: 30 },
    });
  }
}
