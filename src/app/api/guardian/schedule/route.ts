/**
 * GET /api/guardian/schedule — Guardian duty schedule
 * Uses the prismatic_guardian_schedule table (not Prisma)
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';

const DATABASE_URL = process.env.DATABASE_URL;

export async function GET(req: NextRequest) {
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT date, slot, persona_id, shift_theme
      FROM prismatic_guardian_schedule
      WHERE date >= ${today.toISOString().slice(0, 10)}
        AND date < ${endDate.toISOString().slice(0, 10)}
      ORDER BY date ASC, slot ASC
    `;

    // Create persona lookup map
    const personaMap = new Map(
      PERSONA_LIST_LIGHT.map(p => [p.id, p])
    );

    // Group by date and enrich with persona info
    const schedule: Record<string, any[]> = {};
    for (const row of rows as any[]) {
      const date = row.date instanceof Date 
        ? row.date.toISOString().slice(0, 10) 
        : String(row.date).slice(0, 10);
      
      if (!schedule[date]) schedule[date] = [];
      
      const persona = personaMap.get(row.persona_id);
      schedule[date].push({
        slot: row.slot,
        personaId: row.persona_id,
        personaNameZh: persona?.nameZh || row.persona_id,
        personaSlug: persona?.slug || row.persona_id,
        gradientFrom: persona?.gradientFrom || '#4d96ff',
        gradientTo: persona?.gradientTo || '#c77dff',
        shiftTheme: row.shift_theme,
        maxInteractions: 5,
      });
    }

    return NextResponse.json({
      schedule,
      days,
      count: rows.length,
    });
  } catch (error) {
    console.error('[Guardian Schedule] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch guardian schedule' }, { status: 500 });
  }
}
