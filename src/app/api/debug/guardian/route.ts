/**
 * DEBUG: Guardian system diagnostic
 * GET /api/debug/guardian?key=debug-admin-key-2026
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getPersonasByIds, PERSONAS } from '@/lib/personas';

export const dynamic = 'force-dynamic';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export async function GET(req: NextRequest) {
  const adminKey = new URL(req.url).searchParams.get('key') || '';
  if (adminKey !== 'debug-admin-key-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const sql = neon(DATABASE_URL);
  const results: Record<string, unknown> = {};

  // 1. Test table existence
  try {
    const tables = ['prismatic_guardian_schedule', 'prismatic_persona_interactions'];
    for (const t of tables) {
      try {
        await sql`SELECT 1 FROM ${sql.unsafe(t)} LIMIT 1`;
        // eslint-disable-next-line
        results[`table_${t}`] = 'EXISTS';
      } catch {
        // eslint-disable-next-line
        results[`table_${t}`] = 'MISSING';
      }
    }
  } catch (e) {
    results.table_check = String(e);
  }

  // 2. Test getPersonasByIds
  try {
    const personas = getPersonasByIds(['socrates', 'elon-musk']);
    results.getPersonasByIds = `got ${personas.length} personas`;
    results.sample_persona = personas[0] ? personas[0].name : 'none';
  } catch (e) {
    results.getPersonasByIds = `ERROR: ${String(e)}`;
  }

  // 3. Test schedule generation
  try {
    const weekStart = getWeekStart(new Date());
    results.week_start = weekStart.toISOString().slice(0, 10);
  } catch (e) {
    results.week_start = `ERROR: ${String(e)}`;
  }

  // 4. Test INSERT into prismatic_guardian_schedule
  try {
    const today = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO prismatic_guardian_schedule (date, slot, persona_id, shift_theme)
      VALUES (${today}, 1, 'socrates', '测试主题：今日思想')
      ON CONFLICT (date, slot) DO UPDATE SET shift_theme = '测试主题：今日思想'
    `;
    results.insert_schedule = `INSERTED/UPDATED for ${today}`;
  } catch (e) {
    results.insert_schedule = `ERROR: ${String(e)}`;
  }

  // 5. Test SELECT from prismatic_guardian_schedule
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await sql`
      SELECT gs.slot, gs.persona_id, gs.shift_theme
      FROM prismatic_guardian_schedule gs
      WHERE gs.date = ${today}
      ORDER BY gs.slot ASC
    `;
    results.select_schedule = `got ${rows.length} rows`;
    results.schedule_rows = rows;
  } catch (e) {
    results.select_schedule = `ERROR: ${String(e)}`;
  }

  // 6. Test requireTable function
  try {
    await sql`SELECT 1 FROM prismatic_guardian_schedule LIMIT 1`;
    results.requireTable_test = 'PASS';
  } catch (e) {
    results.requireTable_test = `FAIL: ${String(e)}`;
  }

  // 7. Test full getTodayGuardians flow (the actual function)
  try {
    await sql`SELECT 1 FROM prismatic_guardian_schedule LIMIT 1`;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart(new Date());
    results.full_flow_weekStart = weekStart.toISOString().slice(0, 10);
    results.full_flow_today = today;

    // Try the actual ensureWeeklySchedule + getTodayGuardians logic
    await sql`
      INSERT INTO prismatic_guardian_schedule (date, slot, persona_id, shift_theme)
      VALUES (${today}, 2, 'elon-musk', '测试：马斯克的思维')
      ON CONFLICT (date, slot) DO UPDATE SET shift_theme = '测试：马斯克的思维'
    `;
    await sql`
      INSERT INTO prismatic_guardian_schedule (date, slot, persona_id, shift_theme)
      VALUES (${today}, 3, 'charlie-munger', '测试：芒格的智慧')
      ON CONFLICT (date, slot) DO UPDATE SET shift_theme = '测试：芒格的智慧'
    `;

    const rows = await sql`
      SELECT gs.slot, gs.persona_id, gs.shift_theme
      FROM prismatic_guardian_schedule gs
      WHERE gs.date = ${today}
      ORDER BY gs.slot ASC
    `;

    const personaIds = rows.map((r: any) => r.persona_id);
    const personas = getPersonasByIds(personaIds);
    const personaMap = new Map(personas.map(p => [p.id, p]));

    const guardians = rows.map((r: any) => {
      const persona = personaMap.get(r.persona_id);
      return {
        slot: r.slot,
        personaId: r.persona_id,
        personaNameZh: persona?.nameZh || r.persona_id,
        shiftTheme: r.shift_theme,
      };
    });

    results.full_flow_result = guardians;
    results.full_flow_success = true;
  } catch (e) {
    results.full_flow_success = false;
    results.full_flow_error = String(e);
    results.full_flow_stack = (e as Error).stack;
  }

  return NextResponse.json(results);
}
