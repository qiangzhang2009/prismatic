/**
 * Personas API
 * List all available personas
 * Uses the lightweight list (PERSONA_LIST_LIGHT) instead of the heavy 1.4MB
 * PERSONA_LIST to keep the Edge bundle small and avoid runtime failures.
 */

import { NextResponse } from 'next/server';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';

export const runtime = 'edge';

import type { Domain } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  let personas = PERSONA_LIST_LIGHT;

  if (domain) {
    personas = personas.filter((p) => p.domain.includes(domain as Domain));
  }

  return NextResponse.json({
    personas,
    total: personas.length,
  });
}
