/**
 * Prismatic — Individual Persona Detail Page
 * Strategy: code personas.ts has complete Chinese text.
 * DB has scores + system prompts. Always prefer code for display data.
 */

import { notFound } from 'next/navigation';
import { getPersona } from '@/lib/personas';
import { unquote, decodeUnicodeEscapes, getDomainGradient } from '@/lib/utils';
import type { Persona } from '@/lib/types';
import { PersonaDetailClient } from './client';

export const dynamic = 'force-dynamic';

// Build Persona from DB record, then prefer code data for all display fields
function buildPersonaFromDB(db: Record<string, unknown>): Persona {
  const domainStr = (db.domain as string) ?? 'philosophy';
  const domains = domainStr.includes(',') ? domainStr.split(',') : [domainStr];

  const dbPersona: Persona = {
    id: db.slug as string,
    slug: db.slug as string,
    name: unquote(db.name) as string,
    nameZh: (decodeUnicodeEscapes(unquote(db.namezh as string)) as string) || (unquote(db.name) as string),
    nameEn: (unquote(db.nameen as string) as string) || (unquote(db.name) as string),
    domain: domains as Persona['domain'],
    tagline: (unquote(db.tagline as string) as string) || '',
    taglineZh: (decodeUnicodeEscapes(unquote(db.taglineZh as string)) as string) || (unquote(db.tagline as string) as string) || '',
    brief: (unquote(db.brief as string) as string) || '',
    briefZh: (decodeUnicodeEscapes(unquote(db.briefZh as string)) as string) || (unquote(db.brief as string) as string) || '',
    accentColor: (unquote(db.accentColor as string) as string) || '#6366f1',
    gradientFrom: (unquote(db.gradientFrom as string) as string) || '#6366f1',
    gradientTo: (unquote(db.gradientTo as string) as string) || '#8b5cf6',
    avatar: (unquote(db.avatar as string) as string) || '',
    mentalModels: (db.mentalModels as Persona['mentalModels']) ?? [],
    decisionHeuristics: (db.decisionHeuristics as Persona['decisionHeuristics']) ?? [],
    expressionDNA: (db.expressionDNA as Persona['expressionDNA']) ?? {} as Persona['expressionDNA'],
    values: (db.values as Persona['values']) ?? [],
    antiPatterns: (db.antiPatterns as Persona['antiPatterns']) ?? [],
    tensions: (db.tensions as Persona['tensions']) ?? [],
    honestBoundaries: (db.honestBoundaries as Persona['honestBoundaries']) ?? [],
    strengths: (db.strengths as Persona['strengths']) ?? [],
    blindspots: (db.blindspots as Persona['blindspots']) ?? [],
    sources: (db.corpusSources as Persona['sources']) ?? [],
    researchDate: db.distillDate ? new Date(db.distillDate as string).toISOString().split('T')[0] : '2026-04-20',
    version: (db.distillVersion as string) ?? '1.0.0',
    researchDimensions: [],
    systemPromptTemplate: (unquote(db.systemPromptTemplate as string) as string) || '',
    identityPrompt: (unquote(db.identityPrompt as string) as string) || '',
  };

  const codePersona = getPersona(db.slug as string);
  if (codePersona) {
    // Display fields with Chinese: prefer DB (v4 JSON has complete Chinese content),
    // supplement from code only if DB is empty
    const isV4 = String(db.distillVersion || '').startsWith('v4');

    if (isV4) {
      // v4: DB has complete Chinese text for character-specific content
      if (!dbPersona.mentalModels.length && codePersona.mentalModels.length) {
        dbPersona.mentalModels = codePersona.mentalModels;
      }
      if (!dbPersona.decisionHeuristics.length && codePersona.decisionHeuristics.length) {
        dbPersona.decisionHeuristics = codePersona.decisionHeuristics;
      }
      if (!dbPersona.tensions.length && codePersona.tensions.length) {
        dbPersona.tensions = codePersona.tensions;
      }
      if (!dbPersona.honestBoundaries.length && codePersona.honestBoundaries.length) {
        dbPersona.honestBoundaries = codePersona.honestBoundaries;
      }
    } else {
      // v5+: DB (V5 JSON) has complete Chinese fields (oneLinerZh, applicationZh,
      // limitationZh, identityPromptZh, etc.) — treat DB as source of truth.
      // Code (personas.ts) has English-only fields and missing _Zh variants.
      // Only supplement from code if DB field is empty.
      if (!dbPersona.mentalModels.length && codePersona.mentalModels.length) {
        dbPersona.mentalModels = codePersona.mentalModels;
      }
      if (!dbPersona.decisionHeuristics.length && codePersona.decisionHeuristics.length) {
        dbPersona.decisionHeuristics = codePersona.decisionHeuristics;
      }
      if (!dbPersona.tensions.length && codePersona.tensions.length) {
        dbPersona.tensions = codePersona.tensions;
      }
      if (!dbPersona.honestBoundaries.length && codePersona.honestBoundaries.length) {
        dbPersona.honestBoundaries = codePersona.honestBoundaries;
      }
    }

    // For v4 personas: DB has Chinese content — supplement from code only if DB empty
    // For v5+ personas: DB (V5 JSON) has the best data — never override with code
    if (isV4 && !dbPersona.strengths.length) {
      if (codePersona.strengths.length) dbPersona.strengths = codePersona.strengths;
    }
    if (isV4 && !dbPersona.blindspots.length) {
      if (codePersona.blindspots.length) dbPersona.blindspots = codePersona.blindspots;
    }
    if (isV4 && !dbPersona.values.length) {
      if (codePersona.values.length) dbPersona.values = codePersona.values;
    }
    if (isV4 && !dbPersona.antiPatterns.length) {
      if (codePersona.antiPatterns.length) dbPersona.antiPatterns = codePersona.antiPatterns;
    }

    // Sources: prefer code for non-v4, DB for v4 (DB has more complete corpusSources)
    if (!isV4 && codePersona.sources?.length) {
      dbPersona.sources = codePersona.sources;
    }

    // Other display data
    if (codePersona.domain.length > dbPersona.domain.length) dbPersona.domain = codePersona.domain;
    if (dbPersona.accentColor === '#6366f1' && codePersona.accentColor !== '#6366f1') {
      dbPersona.accentColor = codePersona.accentColor;
      dbPersona.gradientFrom = codePersona.gradientFrom;
      dbPersona.gradientTo = codePersona.gradientTo;
    }
  }

  return dbPersona;
}

async function fetchFromDB(slug: string): Promise<Persona | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://prismatic.zxqconsulting.com';
    const res = await fetch(`${baseUrl}/api/persona-library/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.source !== 'distilled' || !data.persona) return null;
    return buildPersonaFromDB(data.persona as Record<string, unknown>);
  } catch {
    return null;
  }
}

export default async function PersonaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try DB first for scores + system prompts, then fill with code data
  let persona = await fetchFromDB(slug);

  // Fall back to code persona if not in DB
  if (!persona) {
    const codePersona = getPersona(slug);
    if (codePersona) persona = codePersona;
  }

  if (!persona) notFound();

  const domains = persona.domain ?? ['default'];
  const color = getDomainGradient(domains);
  const colors = {
    accent: color.from,
    from: color.from,
    to: color.to,
  };

  return <PersonaDetailClient persona={persona} colors={colors} />;
}
