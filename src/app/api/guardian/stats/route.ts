/**
 * GET /api/guardian/stats — Today's Guardian duty statistics
 * Uses Prisma guardian_duties table
 */
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const duties = await prisma.guardianDuty.findMany({
      where: {
        dutyDate: today,
      },
      orderBy: { dutyDate: 'asc' },
    });

    if (duties.length === 0) {
      return NextResponse.json({
        date: today.toISOString().slice(0, 10),
        guardians: [],
        message: '今日值班安排中...',
      });
    }

    const guardians = duties.map(d => ({
      slot: 1,
      personaId: d.personaId,
      interactionCount: d.interactionCount,
      status: d.status === 'completed' ? 'completed' : 'pending',
    }));

    return NextResponse.json({
      date: today.toISOString().slice(0, 10),
      guardians,
      summary: {
        total: guardians.length,
        completed: guardians.filter(g => g.status === 'completed').length,
        pending: guardians.filter(g => g.status === 'pending').length,
        inProgress: guardians.filter(g => g.status === 'pending' && g.interactionCount > 0).length,
      },
    });
  } catch (error) {
    console.error('[Guardian Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch guardian stats' }, { status: 500 });
  }
}
