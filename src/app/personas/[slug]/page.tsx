/**
 * Prismatic — Individual Persona Detail Page
 */

import { notFound } from 'next/navigation';
import { PERSONA_LIST, getPersona } from '@/lib/personas';
import type { Persona } from '@/lib/types';
import { PERSONA_COLORS } from '@/lib/constants';
import { PersonaDetailClient } from './client';

export async function generateStaticParams() {
  return PERSONA_LIST.map((p) => ({ slug: p.slug }));
}

export default function PersonaDetailPage({ params }: { params: { slug: string } }) {
  const persona = getPersona(params.slug);
  if (!persona) notFound();

  const colorKey = Object.keys(PERSONA_COLORS).find((k) => params.slug.includes(k)) ?? 'jobs';
  const colors = PERSONA_COLORS[colorKey as keyof typeof PERSONA_COLORS] ?? PERSONA_COLORS.jobs;

  return <PersonaDetailClient persona={persona} colors={colors} />;
}
