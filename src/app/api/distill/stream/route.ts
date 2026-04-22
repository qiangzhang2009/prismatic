/**
 * Prismatic — Distillation SSE Progress Stream (v4)
 * Server-Sent Events endpoint using the v4 pipeline with DeepSeek LLM
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/personas';
import { distillPersonaV4, DEFAULT_CONFIG } from '@/lib/distillation-v4';
import { formatSSE } from '@/lib/distillation-events';
import type { PipelineEvent } from '@/lib/distillation-events';
import * as path from 'path';

const CORPUS_ROOT = path.join(process.cwd(), 'corpus');

function resolveCorpusDir(personaId: string): string {
  return path.join(CORPUS_ROOT, personaId);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');

  if (!personaId) {
    return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
  }

  const persona = getPersonaById(personaId);
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const sessionId = `v4-${Date.now()}`;

  const stream = new ReadableStream({
    start(controller) {
      function send(type: string, message: string, data: Record<string, unknown> = {}) {
        const event: PipelineEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: type as PipelineEvent['type'],
          severity: 'info',
          planId: sessionId,
          personaId: personaId as string,
          timestamp: new Date().toISOString(),
          message,
          detail: data,
        };
        try {
          controller.enqueue(encoder.encode(formatSSE(event) + '\n'));
        } catch {
          // Controller may already be closed
        }
      }

      send('plan_created', `v4 distillation started for ${persona.nameZh || persona.name}`, {
        personaId,
        version: 'v4',
      });

      const corpusDir = resolveCorpusDir(personaId);

      distillPersonaV4({
        personaId,
        corpusDir,
        config: {
          maxIterations: DEFAULT_CONFIG.maxIterations,
          adaptiveThreshold: DEFAULT_CONFIG.adaptiveThreshold,
          outputLanguage: 'zh-CN',
        },
        onProgress: (stage, pct) => {
          send('progress', `[v4] ${stage}: ${pct}%`, { stage, progress: pct, sessionId });
        },
      })
        .then((result) => {
          const score = result.pipelineResult.finalScore;
          send(
            'pipeline_completed',
            `v4 distillation completed — Score: ${score}`,
            {
              finalScore: score,
              grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F',
              route: 'unknown',
              iterations: result.pipelineResult.iterationList?.length ?? 1,
              sessionId,
            }
          );
          controller.close();
        })
        .catch((err) => {
          send('pipeline_failed', `v4 distillation failed: ${err instanceof Error ? err.message : String(err)}`, {
            error: err instanceof Error ? err.message : String(err),
            sessionId,
          });
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
