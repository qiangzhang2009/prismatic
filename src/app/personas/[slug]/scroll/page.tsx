/**
 * Prismatic — Persona Scroll Experience
 * Server component with static params generation
 */
import { notFound } from 'next/navigation';
import { PERSONA_LIST } from '@/lib/personas';
import { PersonaScrollClient } from './client';

export function generateStaticParams() {
  return PERSONA_LIST.map((p) => ({ slug: p.slug }));
}

export default function PersonaScrollPage({
  params,
}: {
  params: { slug: string };
}) {
  return <PersonaScrollClient slug={params.slug} />;
}