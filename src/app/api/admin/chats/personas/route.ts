/**
 * Admin: Persona interaction analysis
 * GET /api/admin/chats/personas?days=30
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10));
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
      take: 30,
    }),
    prisma.conversation.findMany({
      where: { createdAt: { gte: startDate }, messageCount: { gte: 3 } },
      select: { id: true, personaIds: true, messageCount: true },
      take: 500,
    }),
  ]);

  // Build co-occurrence matrix
  const coOccurrence: Record<string, Record<string, number>> = {};
  for (const conv of conversations) {
    const ids = [...new Set(conv.personaIds)].filter(Boolean);
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
    personaUsage: personaUsage.map(p => ({
      personaId: p.personaId,
      messageCount: Number(p._count.id),
      totalTokens: Number(p._sum.tokensInput || 0) + Number(p._sum.tokensOutput || 0),
      totalCost: Number(p._sum.apiCost || 0),
    })),
    coOccurrence,
    period: { days },
  });
}
