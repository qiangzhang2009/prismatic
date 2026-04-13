/**
 * GET /api/guardian/schedule — Guardian duty schedule (past + future)
 * Uses existing prismatic_guardian_schedule table
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getPersonasByIds } from '@/lib/personas';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date();
  future.setDate(future.getDate() + days);
  const endDate = future.toISOString().slice(0, 10);

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT
        gs.date,
        gs.slot,
        gs.persona_id,
        gs.shift_theme,
        gs.max_interactions
      FROM public.prismatic_guardian_schedule gs
      WHERE gs.date >= ${today}
        AND gs.date <= ${endDate}
      ORDER BY gs.date ASC, gs.slot ASC
    `;

    const personaIds = Array.from(new Set((rows as any[]).map((r: any) => r.persona_id)));
    const personas = getPersonasByIds(personaIds);
    const personaMap = new Map(personas.map(p => [p.id, p]));

    // Group by date
    const schedule: Record<string, any[]> = {};
    for (const r of rows as any[]) {
      const dateKey = r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10);
      if (!schedule[dateKey]) schedule[dateKey] = [];
      const persona = personaMap.get(r.persona_id);
      schedule[dateKey].push({
        slot: r.slot,
        personaId: r.persona_id,
        personaNameZh: persona?.nameZh || r.persona_id,
        accentColor: persona?.accentColor || '#8b5cf6',
        gradientFrom: persona?.gradientFrom || '#8b5cf6',
        gradientTo: persona?.gradientTo || '#c084fc',
        shiftTheme: r.shift_theme || '',
        maxInteractions: r.max_interactions || 5,
      });
    }

    return NextResponse.json({
      schedule,
      days,
    });
  } catch (error) {
    console.error('[Guardian Schedule] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch guardian schedule' }, { status: 500 });
  }
}
