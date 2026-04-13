/**
 * GET /api/guardian/stats — Today's Guardian duty statistics
 * Uses existing prismatic_guardian_schedule + prismatic_guardian_stats tables
 */
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getPersonasByIds } from '@/lib/personas';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const today = new Date().toISOString().slice(0, 10);

    // Get today's guardian schedule
    const schedule = await sql`
      SELECT
        gs.slot,
        gs.persona_id,
        gs.max_interactions,
        gs.shift_theme
      FROM public.prismatic_guardian_schedule gs
      WHERE gs.date = ${today}
      ORDER BY gs.slot ASC
    `;

    if (schedule.length === 0) {
      return NextResponse.json({
        date: today,
        guardians: [],
        message: '今日值班安排中...',
      });
    }

    // Get today's stats for these personas
    const personaIds = schedule.map(s => s.persona_id as string);
    const stats = await sql`
      SELECT persona_id, interactions
      FROM public.prismatic_guardian_stats
      WHERE date = ${today}
        AND persona_id = ANY(${personaIds})
    `;

    const statsMap: Record<string, number> = {};
    for (const s of stats as any[]) {
      statsMap[s.persona_id] = s.interactions || 0;
    }

    const personas = getPersonasByIds(personaIds);
    const personaMap = new Map(personas.map(p => [p.id, p]));

    const guardians = schedule.map((s: any) => {
      const persona = personaMap.get(s.persona_id);
      const interactionCount = statsMap[s.persona_id] || 0;
      const targetCount = s.max_interactions || 5;

      return {
        slot: s.slot,
        personaId: s.persona_id,
        personaNameZh: persona?.nameZh || s.persona_id,
        personaNameEn: persona?.name || '',
        accentColor: persona?.accentColor || '#8b5cf6',
        gradientFrom: persona?.gradientFrom || '#8b5cf6',
        gradientTo: persona?.gradientTo || '#c084fc',
        shiftTheme: s.shift_theme || '',
        interactionCount,
        targetCount,
        status: interactionCount >= targetCount ? 'completed' : 'pending',
        progress: Math.min(100, Math.round((interactionCount / targetCount) * 100)),
      };
    });

    return NextResponse.json({
      date: today,
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
