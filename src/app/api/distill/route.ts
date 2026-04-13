/**
 * Prismatic — Distillation Pipeline API
 * REST endpoints for distillation pipeline management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/personas';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import {
  DistillationOrchestrator,
  runDistillation,
  quickScore,
} from '@/lib/distillation-orchestrator';
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
        starRating: conf.starRating,
        priority: conf.priority,
        gaps: conf.mainGaps,
        sources: conf.dataSources.map(s => s.type),
        corpusPath: conf.corpusPath,
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
      priority: conf.priority,
    });
  }

  if (action === 'status') {
    // 返回所有人物的状态摘要
    const summary = {
      total: Object.keys(PERSONA_CONFIDENCE).length,
      highPriority: Object.values(PERSONA_CONFIDENCE).filter(c => c.priority === 'high').length,
      avgOverall: Math.round(
        Object.values(PERSONA_CONFIDENCE).reduce((a, c) => a + c.overall, 0) /
        Object.keys(PERSONA_CONFIDENCE).length
      ),
      starDistribution: {
        five: Object.values(PERSONA_CONFIDENCE).filter(c => c.starRating === 5).length,
        four: Object.values(PERSONA_CONFIDENCE).filter(c => c.starRating === 4).length,
        three: Object.values(PERSONA_CONFIDENCE).filter(c => c.starRating === 3).length,
        two: Object.values(PERSONA_CONFIDENCE).filter(c => c.starRating === 2).length,
        one: Object.values(PERSONA_CONFIDENCE).filter(c => c.starRating === 1).length,
      },
    };

    return NextResponse.json(summary);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST /api/distill — 启动蒸馏管道
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personaId, mode = 'full', stream = false } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
    }

    const persona = getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    if (mode === 'score') {
      // 快速评分模式
      const score = calculateDistillationScore(persona);
      return NextResponse.json({
        personaId,
        mode: 'score',
        score,
      });
    }

    if (mode === 'plan') {
      // 生成任务计划
      const orchestrator = new DistillationOrchestrator(persona);
      const plan = orchestrator.getPlan();
      return NextResponse.json({
        personaId,
        mode: 'plan',
        plan,
      });
    }

    // Full pipeline mode
    const orchestrator = new DistillationOrchestrator(persona);
    const plan = orchestrator.getPlan();

    // 在后台运行（实际项目中应该用队列）
    // 这里简化为同步执行
    const result = await orchestrator.run();

    return NextResponse.json({
      personaId,
      mode: 'full',
      plan: result.plan,
      score: result.score,
      fixedCount: result.fixedCount ?? 0,
    });
  } catch (err) {
    console.error('[Distillation API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
