/**
 * GET /api/guardian/schedule — Guardian duty schedule
 * Uses the prismatic_guardian_schedule table (not Prisma)
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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
      SELECT date, slot, persona_id as "personaId", shift_theme as "shiftTheme"
      FROM prismatic_guardian_schedule
      WHERE date >= ${today.toISOString().slice(0, 10)}
        AND date < ${endDate.toISOString().slice(0, 10)}
      ORDER BY date ASC, slot ASC
    `;

    // Group by date
    const schedule: Record<string, any[]> = {};
    for (const row of rows as any[]) {
      const date = row.date instanceof Date 
        ? row.date.toISOString().slice(0, 10) 
        : String(row.date).slice(0, 10);
      if (!schedule[date]) schedule[date] = [];
      schedule[date].push(row);
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
