/**
 * Prismatic — Individual Persona Detail Page
 * Strategy:
 *   - DB holds: scores, system prompts, corpus sources, mentalModels
 *   - personas.ts holds: strengths, blindspots (always in Chinese)
 *   - Display: always prefer code data for strengths/blindspots
 */

import { notFound } from 'next/navigation';
import { getPersona } from '@/lib/personas';
import { unquote, decodeUnicodeEscapes, getDomainGradient } from '@/lib/utils';
import type { Persona } from '@/lib/types';
import { PersonaDetailClient } from './client';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';

export const revalidate = 3600;

export async function generateStaticParams() {
  return PERSONA_LIST_LIGHT.map((p) => ({ slug: p.slug }));
}

// Build Persona from DB record, merging code data where DB is incomplete
function buildPersonaFromDB(db: Record<string, unknown>): Persona {
  const domainStr = (db.domain as string) ?? 'philosophy';
  const domains = domainStr.includes(',') ? domainStr.split(',') : [domainStr];

  const dbPersona: Persona = {
    id: db.slug as string,
    slug: db.slug as string,
    name: unquote(db.name) as string,
    nameZh: (decodeUnicodeEscapes(unquote(db.nameZh as string || db.namezh as string || db.name as string)) as string) || (unquote(db.name as string) as string),
    nameEn: (unquote(db.nameEn as string || db.nameen as string || db.name as string) as string) || (unquote(db.name as string) as string),
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
    // DB's strengths/blindspots are ignored — always use code data (in Chinese)
    strengths: [],
    blindspots: [],
    sources: (db.corpusSources as Persona['sources']) ?? [],
    researchDate: db.distillDate ? new Date(db.distillDate as string).toISOString().split('T')[0] : '2026-04-20',
    version: (db.distillVersion as string) ?? '1.0.0',
    researchDimensions: [],
    systemPromptTemplate: (unquote(db.systemPromptTemplate as string) as string) || '',
    identityPrompt: (unquote(db.identityPrompt as string) as string) || '',
  };

  const codePersona = getPersona(db.slug as string);
  if (codePersona) {
    // DB may have partial Chinese for mentalModels/decisionHeuristics — supplement if empty
    const isV4 = String(db.distillVersion || '').startsWith('v4');
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
    if (isV4) {
      if (!dbPersona.values.length && codePersona.values.length) dbPersona.values = codePersona.values;
      if (!dbPersona.antiPatterns.length && codePersona.antiPatterns.length) dbPersona.antiPatterns = codePersona.antiPatterns;
    }
    if (isV4 && codePersona.sources?.length) {
      dbPersona.sources = codePersona.sources;
    }

    // Always use code data for strengths/blindspots — they are fully translated in personas.ts
    dbPersona.strengths = codePersona.strengths;
    dbPersona.blindspots = codePersona.blindspots;

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

interface DBConfidenceData {
  overall: number;
  breakdown: Record<string, number>;
  findings: unknown[];
  grade: string;
  starRating: number;
  dataSources: unknown[];
  source: string;
}

async function fetchFromDB(slug: string): Promise<{ persona: Persona | null; confidence: DBConfidenceData | null }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://prismatic.zxqconsulting.com';

  const [personaRes, confidenceRes] = await Promise.all([
    fetch(`${baseUrl}/api/persona-library/${slug}`, { next: { revalidate: 3600 } }),
    fetch(`${baseUrl}/api/personas/${slug}/confidence`, { next: { revalidate: 3600 } }),
  ]);

  let persona: Persona | null = null;

  if (personaRes.ok) {
    try {
      const data = await personaRes.json();
      if (data.source === 'distilled' && data.persona) {
        persona = buildPersonaFromDB(data.persona as Record<string, unknown>);
      }
    } catch { /* ignore */ }
  }

  let confidence: DBConfidenceData | null = null;
  if (confidenceRes.ok) {
    try {
      confidence = await confidenceRes.json();
    } catch { /* ignore */ }
  }

  return { persona, confidence };
}

export default async function PersonaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try DB first for scores + system prompts, then fill with code data
  let { persona, confidence: dbConfidence } = await fetchFromDB(slug);

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

  return <PersonaDetailClient persona={persona} colors={colors} dbConfidence={dbConfidence} />;
}
