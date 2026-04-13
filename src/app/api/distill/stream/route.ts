/**
 * Prismatic — Distillation SSE Progress Stream
 * Server-Sent Events endpoint for real-time pipeline progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/personas';
import { DistillationOrchestrator } from '@/lib/distillation-orchestrator';
import { formatSSE } from '@/lib/distillation-events';
import type { PipelineEvent } from '@/lib/distillation-events';
import type { Persona } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');

  if (!personaId) {
    return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
  }

  const persona = getPersonaById(personaId) ?? undefined;
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function send(type: string, data: Record<string, unknown>) {
        const event: PipelineEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: type as PipelineEvent['type'],
          severity: 'info',
          planId: 'pending',
          personaId: personaId as string,
          timestamp: new Date().toISOString(),
          message: type,
          detail: data,
        };
        controller.enqueue(encoder.encode(formatSSE(event)));
      }

      // 发送初始连接事件
      send('plan_created', { personaId, status: 'connecting' });

      // 运行蒸馏管道（带实时进度）
      runWithProgress(persona, send, controller)
        .then(({ plan, score, error }) => {
          if (error) {
            send('pipeline_failed', { error: String(error) });
          } else {
            send('pipeline_completed', {
              planId: plan.id,
              score: score?.overall,
              grade: score?.grade,
              thresholdPassed: score?.thresholdPassed,
            });
          }
          controller.close();
        })
        .catch((err) => {
          send('pipeline_failed', { error: String(err) });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function runWithProgress(
  persona: Persona,
  send: (type: string, data: Record<string, unknown>) => void,
  controller: ReadableStreamDefaultController
): Promise<{
  plan: { id: string };
  score?: { overall: number; grade: string; thresholdPassed: boolean };
  error?: Error;
}> {
  const orchestrator = new DistillationOrchestrator(persona);
  const plan = orchestrator.getPlan();

  send('plan_created', {
    planId: plan.id,
    totalTasks: plan.tasks.length,
    waves: plan.waves.map(w => w.length),
  });

  try {
    const result = await orchestrator.run();
    return {
      plan: { id: result.plan.id },
      score: result.score ? {
        overall: result.score.overall,
        grade: result.score.grade,
        thresholdPassed: result.score.thresholdPassed,
      } : undefined,
    };
  } catch (err) {
    return {
      plan: { id: plan.id },
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
