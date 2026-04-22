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

export default async function PersonaScrollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let persona = getPersona(slug);

  if (!persona) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://prismatic.zxqconsulting.com';
      const res = await fetch(`${baseUrl}/api/persona-library/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.source === 'distilled' && data.persona) {
          const db = data.persona as Record<string, unknown>;
          const domainStr = (db.domain as string) ?? 'philosophy';
          const domains = domainStr.includes(',') ? domainStr.split(',') : [domainStr];
          persona = {
            id: db.slug as string,
            slug: db.slug as string,
            name: unquote(db.name) as string,
            nameZh: (decodeUnicodeEscapes(unquote(db.namezh)) as string) || (unquote(db.name) as string),
            nameEn: (unquote(db.nameen) as string) || (unquote(db.name) as string),
            domain: domains as Persona['domain'],
            tagline: (unquote(db.tagline) as string) || '',
            taglineZh: (decodeUnicodeEscapes(unquote(db.taglineZh)) as string) || (unquote(db.tagline) as string) || '',
            brief: (unquote(db.brief) as string) || '',
            briefZh: (decodeUnicodeEscapes(unquote(db.briefZh)) as string) || (unquote(db.brief) as string) || '',
            accentColor: (unquote(db.accentColor) as string) || '#6366f1',
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
            strengths: (db.strengths as Persona['strengths']) ?? [],
            blindspots: (db.blindspots as Persona['blindspots']) ?? [],
            sources: (db.corpusSources as Persona['sources']) ?? [],
            researchDate: db.distillDate ? new Date(db.distillDate as string).toISOString().split('T')[0] : '2026-04-20',
            version: (db.distillVersion as string) ?? '1.0.0',
            researchDimensions: [],
            systemPromptTemplate: (unquote(db.systemPromptTemplate) as string) || '',
            identityPrompt: (unquote(db.identityPrompt) as string) || '',
          } as Persona;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!persona) notFound();

  return <PersonaScrollClient persona={persona} />;
}
