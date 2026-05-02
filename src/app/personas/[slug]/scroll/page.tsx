/**
 * Prismatic — Persona Scroll Experience
 * Server component: fetches persona from DB (like detail page), passes to client.
 *
 * NOTE: No generateStaticParams — the page uses dynamic rendering (no-store fetch)
 * because not all personas are in PERSONA_LIST (e.g., DB personas like Wittgenstein).
 */
import { notFound } from 'next/navigation';
import { PERSONA_LIST, getPersona } from '@/lib/personas';
import { unquote, decodeUnicodeEscapes } from '@/lib/utils';
import type { Persona } from '@/lib/types';
import { PersonaScrollClient } from './client';

// Build persona from DB record, merging with code data where DB is incomplete
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScrollPersonaFromDB(db: Record<string, unknown>): Persona {
  const domainStr = (db.domain as string) ?? 'philosophy';
  const domains = domainStr.includes(',') ? domainStr.split(',') : [domainStr];
  const isV4 = String(db.distillVersion || '').startsWith('v4');

  const dbPersona = {
    id: db.slug as string,
    slug: db.slug as string,
    name: unquote(db.name) as string,
    nameZh: (decodeUnicodeEscapes(unquote(db.nameZh)) as string) || (unquote(db.name) as string),
    nameEn: (unquote(db.nameEn)) || (unquote(db.name) as string),
    domain: domains as Persona['domain'],
    tagline: (unquote(db.tagline) as string) || '',
    taglineZh: (decodeUnicodeEscapes(unquote(db.taglineZh)) as string) || (decodeUnicodeEscapes(unquote(db.taglinezh)) as string) || (unquote(db.tagline) as string) || '',
    brief: (unquote(db.brief) as string) || '',
    briefZh: (decodeUnicodeEscapes(unquote(db.briefZh)) as string) || (decodeUnicodeEscapes(unquote(db.briefzh)) as string) || (unquote(db.brief) as string) || '',
    accentColor: (unquote(db.accentColor) as string) as string || '#6366f1',
    gradientFrom: (unquote(db.gradientFrom) as string) || '#6366f1',
    gradientTo: (unquote(db.gradientTo) as string) || '#8b5cf6',
    avatar: (unquote(db.avatar) as string) || '',
    mentalModels: (db.mentalModels as Persona['mentalModels']) ?? [],
    decisionHeuristics: (db.decisionHeuristics as Persona['decisionHeuristics']) ?? [],
    expressionDNA: (db.expressionDNA as Persona['expressionDNA']) ?? {} as Persona['expressionDNA'],
    values: (db.values as Persona['values']) ?? [],
    antiPatterns: (db.antiPatterns as Persona['antiPatterns']) ?? [],
    tensions: (db.tensions as Persona['tensions']) ?? [],
    honestBoundaries: (db.honestBoundaries as Persona['honestBoundaries']) ?? [],
    // DB's strengths/blindspots are ignored — always use code data (in Chinese)
    strengths: [] as Persona['strengths'],
    blindspots: [] as Persona['blindspots'],
    sources: (db.corpusSources as Persona['sources']) ?? [],
    researchDate: db.distillDate ? new Date(db.distillDate as string).toISOString().split('T')[0] : '2026-04-20',
    version: (db.distillVersion as string) ?? '1.0.0',
    researchDimensions: [],
    systemPromptTemplate: (unquote(db.systemPromptTemplate) as string) || '',
    identityPrompt: (unquote(db.identityPrompt) as string) || '',
  } as Persona;

  const codePersona = getPersona(db.slug as string);
  if (codePersona) {
    if (!dbPersona.mentalModels.length && codePersona.mentalModels.length) {
      dbPersona.mentalModels = codePersona.mentalModels;
    }
    if (isV4 && !dbPersona.values.length && codePersona.values.length) {
      dbPersona.values = codePersona.values;
    }
    // Always use code data for strengths/blindspots — they are fully translated in personas.ts
    dbPersona.strengths = codePersona.strengths;
    dbPersona.blindspots = codePersona.blindspots;
  }

  return dbPersona;
}

export default async function PersonaScrollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Try DB first, then fill with code data (same strategy as detail page)
  let persona: Persona | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://prismatic.zxqconsulting.com';
    const res = await fetch(`${baseUrl}/api/persona-library/${slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.source === 'distilled' && data.persona) {
        persona = buildScrollPersonaFromDB(data.persona as Record<string, unknown>);
      }
    }
  } catch { /* ignore */ }

  // Fall back to code persona if DB not found
  if (!persona) {
    persona = getPersona(slug) ?? null;
  }

  if (!persona) notFound();

  return <PersonaScrollClient persona={persona} />;
}
