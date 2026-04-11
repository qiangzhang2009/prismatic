/**
 * Personas API
 * List all available personas
 */

import { NextResponse } from 'next/server';
import { PERSONA_LIST } from '@/lib/personas';

export const runtime = 'edge';

import type { Domain } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  let personas = PERSONA_LIST;

  if (domain) {
    personas = personas.filter((p) => p.domain.includes(domain as Domain));
  }

  // Return lightweight version for listing
  const lightweight = personas.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameZh: p.nameZh,
    tagline: p.tagline,
    taglineZh: p.taglineZh,
    domain: p.domain,
    accentColor: p.accentColor,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    brief: p.brief,
    briefZh: p.briefZh,
    mentalModelCount: p.mentalModels.length,
    heuristicCount: p.decisionHeuristics.length,
    strengths: p.strengths,
    blindspots: p.blindspots,
    version: p.version,
    researchDate: p.researchDate,
  }));

  return NextResponse.json({
    personas: lightweight,
    total: lightweight.length,
  });
}
