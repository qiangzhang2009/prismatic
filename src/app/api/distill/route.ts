/**
 * Prismatic — Distillation Pipeline API (v4)
 * REST endpoints for distillation pipeline management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/personas';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import { calculateDistillationScore } from '@/lib/distillation-metrics';
import type { Persona } from '@/lib/types';

// GET /api/distill — 列出所有可蒸馏人物
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'list';

  if (action === 'list') {
    const personas = Object.entries(PERSONA_CONFIDENCE)
      .map(([id, conf]) => ({
        id,
        overall: conf.overall,
        gaps: conf.mainGaps,
        sources: conf.dataSources.map(s => s.type),
        version: conf.version,
      }))
      .sort((a, b) => b.overall - a.overall);

    return NextResponse.json({ personas, count: personas.length });
  }

  if (action === 'score') {
    const personaId = searchParams.get('personaId');
    if (!personaId) {
      return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
    }

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const score = calculateDistillationScore(persona);
    return NextResponse.json({ personaId, score });
  }

  if (action === 'gaps') {
    const personaId = searchParams.get('personaId');
    if (!personaId) {
      return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
    }

    const conf = PERSONA_CONFIDENCE[personaId];
    if (!conf) {
      return NextResponse.json({ error: 'Persona confidence data not found' }, { status: 404 });
    }

    return NextResponse.json({
      personaId,
      overall: conf.overall,
      gaps: conf.mainGaps,
      dataSources: conf.dataSources,
    });
  }

  if (action === 'status') {
    const summary = {
      total: Object.keys(PERSONA_CONFIDENCE).length,
      avgOverall: Math.round(
        Object.values(PERSONA_CONFIDENCE).reduce((a, c) => a + c.overall, 0) /
        Object.keys(PERSONA_CONFIDENCE).length
      ),
      starDistribution: {
        five: Object.values(PERSONA_CONFIDENCE).filter(c => c.overall >= 90).length,
        four: Object.values(PERSONA_CONFIDENCE).filter(c => c.overall >= 75 && c.overall < 90).length,
        three: Object.values(PERSONA_CONFIDENCE).filter(c => c.overall >= 60 && c.overall < 75).length,
        two: Object.values(PERSONA_CONFIDENCE).filter(c => c.overall >= 45 && c.overall < 60).length,
        one: Object.values(PERSONA_CONFIDENCE).filter(c => c.overall < 45).length,
      },
    };

    return NextResponse.json(summary);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST /api/distill — 启动蒸馏管道 (v4)
// For full distillation, use /api/distill/full or /api/admin/distill
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personaId, mode = 'score' } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
    }

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    if (mode === 'score') {
      const score = calculateDistillationScore(persona);
      return NextResponse.json({
        personaId,
        mode: 'score',
        score,
        version: 'v4',
      });
    }

    // Redirect to full distillation endpoint
    return NextResponse.json({
      message: 'For full distillation, use POST /api/distill/full',
      personaId,
      mode,
      version: 'v4',
    });
  } catch (err) {
    console.error('[Distillation API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
