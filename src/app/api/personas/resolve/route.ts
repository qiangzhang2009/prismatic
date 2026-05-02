/**
 * Prismatic — Persona Resolution API
 * GET /api/personas/resolve?ids=wittgenstein,elon-musk
 *
 * Resolves persona IDs from both DB and hardcoded list, returning
 * only the fields needed for the chat interface.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ personas: [] });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ personas: [], note: 'db unavailable' });
  }

  const pool = new Pool({ connectionString });

  try {
    // 1. Resolve from hardcoded PERSONA_LIST
    const { getPersonasByIds } = await import('@/lib/personas');
    const hardcoded = getPersonasByIds(ids);

    // 2. Resolve from DB (only those not found in hardcoded)
    const foundIds = new Set(hardcoded.map(p => p.id));
    const dbIds = ids.filter(id => !foundIds.has(id));

    const dbPersonas: any[] = [];
    if (dbIds.length > 0) {
      const placeholders = dbIds.map((_, i) => `$${i + 1}`).join(', ');
      const result = await pool.query(
        `SELECT slug, name, "nameZh", nameen, domain, "taglineZh", "briefZh",
                "accentColor", "gradientFrom", "gradientTo",
                "systemPromptTemplate", "identityPrompt",
                strengths, blindspots, "mentalModels", "decisionHeuristics",
                "expressionDNA", "values", "tensions", "honestBoundaries",
                "reasoningStyle", "decisionFramework", "keyQuotes", "lifePhilosophy"
         FROM distilled_personas
         WHERE slug IN (${placeholders}) AND "isActive" = true`,
        dbIds
      );

      for (const row of result.rows) {
        const parseJson = (raw: unknown): any => {
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return raw; }
          }
          return raw;
        };

        const p: any = {
          id: row.slug,
          slug: row.slug,
          name: row.name || row.nameen || '',
          nameZh: row.nameZh || row.name || '',
          domain: row.domain ?? [],
          accentColor: row.accentColor || '#4d96ff',
          gradientFrom: row.gradientFrom || '#4d96ff',
          gradientTo: row.gradientTo || '#c77dff',
          tagline: row.tagline || '',
          taglineZh: row.taglineZh || '',
          brief: row.brief || '',
          briefZh: row.briefZh || '',
          systemPromptTemplate: parseJson(row.systemPromptTemplate) ?? '',
          identityPrompt: parseJson(row.identityPrompt) ?? '',
          strengths: parseJson(row.strengths) ?? [],
          blindspots: parseJson(row.blindspots) ?? [],
          mentalModels: parseJson(row.mentalModels) ?? [],
          decisionHeuristics: parseJson(row.decisionHeuristics) ?? [],
          expressionDNA: parseJson(row.expressionDNA) ?? {},
          values: parseJson(row.values) ?? [],
          tensions: parseJson(row.tensions) ?? [],
          honestBoundaries: parseJson(row.honestBoundaries) ?? [],
          reasoningStyle: typeof row.reasoningStyle === 'string' ? row.reasoningStyle : '',
          decisionFramework: parseJson(row.decisionFramework) ?? '',
          keyQuotes: parseJson(row.keyQuotes) ?? [],
          lifePhilosophy: typeof row.lifePhilosophy === 'string' ? row.lifePhilosophy : '',
        };

        dbPersonas.push(p);
      }
    }

    await pool.end();

    const all = [...hardcoded, ...dbPersonas];
    return NextResponse.json({ personas: all });
  } catch (err) {
    console.error('[Personas Resolve GET]', err);
    await pool.end().catch(() => {});
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
