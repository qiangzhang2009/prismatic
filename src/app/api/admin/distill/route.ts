/**
 * Prismatic — Admin Distillation API (v4)
 * Uses the Prismatic v4 distillation pipeline with DeepSeek LLM
 * Falls back to v3 orchestrator only when v4 fails
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getPersonaById } from '@/lib/personas';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { distillPersonaV4, DEFAULT_CONFIG, type DistillV4Options } from '@/lib/distillation-v4';
// import { FullAutoDistillationOrchestrator } from '@/lib/distillation-backup/distillation-orchestrator-full-auto.v3';
import type { Persona, Domain } from '@/lib/types';
import * as path from 'path';

type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface StartDistillRequest {
  personaName?: string;
  personaId?: string;
  options?: {
    maxIterations?: number;
    adaptiveThreshold?: boolean;
    strictMode?: boolean;
    outputLanguage?: 'zh-CN' | 'en-US';
    fallbackToV3?: boolean;
  };
}

// ─── Corpus root resolution ────────────────────────────────────────────────────

const CORPUS_ROOT = path.join(process.cwd(), 'corpus');

function resolveCorpusDir(personaId: string): string {
  return path.join(CORPUS_ROOT, personaId);
}

// ─── Helper: Resolve persona ──────────────────────────────────────────────────

function resolvePersona(name?: string, personaId?: string): Persona | null {
  if (personaId) {
    return getPersonaById(personaId) ?? null;
  }
  if (name) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fff-]/gi, '');
    const bySlug = slug.length > 0 ? getPersonaById(slug) : null;
    if (bySlug) return bySlug;

    const normalized = name.toLowerCase().trim();
    const allPersonas = Object.values(
      (globalThis as any).__PERSONAS__ ?? {}
    ) as Persona[];
    return (
      allPersonas.find(
        (p) =>
          p.nameZh.toLowerCase() === normalized ||
          p.name.toLowerCase() === normalized ||
          p.nameEn.toLowerCase() === normalized ||
          p.id.toLowerCase() === normalized,
      ) ?? null
    );
  }
  return null;
}

// ─── Helper: Create stub persona ─────────────────────────────────────────────

function createPersonaStub(name: string): Persona {
  const latinized = name
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/gi, '');
  const slug = latinized.length > 0
    ? latinized.toLowerCase().replace(/^-+|-+$/g, '')
    : `persona-${nanoid(6)}`;

  return {
    id: `stub-${slug}-${nanoid(6)}`,
    slug,
    name,
    nameZh: name,
    nameEn: name,
    domain: ['philosophy'] as Domain[],
    tagline: '',
    taglineZh: '',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true&format=svg`,
    accentColor: '#6366f1',
    gradientFrom: '#6366f1',
    gradientTo: '#8b5cf6',
    brief: `Distilling persona for: ${name}`,
    briefZh: `正在蒸馏人物: ${name}`,
    mentalModels: [],
    decisionHeuristics: [],
    expressionDNA: {
      vocabulary: [],
      forbiddenWords: [],
      sentenceStyle: [],
      rhythm: '',
      humorStyle: '',
      certaintyLevel: 'medium',
      rhetoricalHabit: '',
      quotePatterns: [],
      chineseAdaptation: '',
    },
    values: [],
    antiPatterns: [],
    tensions: [],
    honestBoundaries: [],
    strengths: [],
    blindspots: [],
    sources: [],
    researchDate: new Date().toISOString().split('T')[0],
    version: '0.1.0',
    researchDimensions: [],
    systemPromptTemplate: `You are ${name}.`,
    identityPrompt: `I am ${name}.`,
  };
}

// ─── Helper: Run v4 distillation ────────────────────────────────────────────────

async function runV4Distillation(
  sessionId: string,
  personaId: string,
  options: StartDistillRequest['options'] = {},
): Promise<void> {
  try {
    await prisma.distillSession.update({
      where: { id: sessionId },
      data: { status: 'running' },
    });

    const corpusDir = resolveCorpusDir(personaId);
    const v4Config = {
      maxIterations: options?.maxIterations ?? DEFAULT_CONFIG.maxIterations,
      adaptiveThreshold: options?.adaptiveThreshold ?? DEFAULT_CONFIG.adaptiveThreshold,
      strictMode: options?.strictMode ?? DEFAULT_CONFIG.strictMode,
      outputLanguage: options?.outputLanguage ?? DEFAULT_CONFIG.outputLanguage,
      fallbackToUni: true,
    };

    let finalScore = 0;
    let grade = 'F';

    const v4Result = await distillPersonaV4({
      personaId,
      corpusDir,
      config: v4Config,
      onProgress: (stage, progress) => {
        console.log(`[v4:${sessionId}] ${stage} = ${progress}%`);
      },
    });

    const legacyPersona = v4Result.persona.persona;
    finalScore = v4Result.pipelineResult.finalScore ?? 0;
    grade = v4Result.pipelineResult.grade ?? 'F';

    await prisma.distillSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: {
          personaId: legacyPersona.id,
          personaName: legacyPersona.name,
          finalScore,
          grade,
          route: 'unknown',
          pipelineResult: {
            iterations: v4Result.pipelineResult.iterations,
            iterationList: v4Result.pipelineResult.iterationList,
            finalScore: v4Result.pipelineResult.finalScore,
            status: v4Result.pipelineResult.status,
          },
          qualityGate: {
            passed: finalScore >= 75,
            score: finalScore,
            grade,
          },
          version: 'v4',
        } as unknown as Prisma.InputJsonValue,
        totalCost: 0,
        totalTokens: 0,
      },
    });

    console.log(`[v4:${sessionId}] Completed — Score: ${finalScore}, Grade: ${grade}`);
  } catch (err) {
    console.error(`[v4:${sessionId}] Error:`, err);

    // Fall back to v3 if requested
    if (options?.fallbackToV3) {
      console.warn(`[v4:${sessionId}] V3 fallback requested but v3 orchestrator is no longer available`);
    }

    await prisma.distillSession
      .update({
        where: { id: sessionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .catch((e) => console.error('[Distill] Failed to update session error state:', e));
  }
}

// ─── GET /api/admin/distill ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') as SessionStatus | null;
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const session = await prisma.distillSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: session.id,
        personaName: session.personaName,
        personaId: session.personaId,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
        options: session.options ?? {},
        error: session.error,
        result: session.result ?? null,
        totalCost: session.totalCost,
        totalTokens: session.totalTokens,
      });
    }

    const where = statusFilter ? { status: statusFilter } : {};
    const sessions = await prisma.distillSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const items = sessions.map((s) => ({
      id: s.id,
      personaName: s.personaName,
      personaId: s.personaId,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      options: s.options ?? {},
      error: s.error,
      finalScore: s.result ? (s.result as Record<string, unknown>).finalScore : null,
      grade: s.result ? (s.result as Record<string, unknown>).grade : null,
      version: s.result ? (s.result as Record<string, unknown>).version : 'v3',
    }));

    const byStatus = {
      pending: sessions.filter((s) => s.status === 'pending').length,
      running: sessions.filter((s) => s.status === 'running').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      failed: sessions.filter((s) => s.status === 'failed').length,
      cancelled: sessions.filter((s) => s.status === 'cancelled').length,
    };

    return NextResponse.json({ items, total: items.length, byStatus });
  } catch (err) {
    console.error('[Admin Distill GET]', err);
    return NextResponse.json({ items: [], total: 0, byStatus: { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 } });
  }
}

// ─── POST /api/admin/distill ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartDistillRequest;
    const { personaName, personaId, options = {} } = body;

    if (!personaName && !personaId) {
      return NextResponse.json(
        { error: 'Either personaName or personaId is required' },
        { status: 400 },
      );
    }

    let resolvedPersonaId = personaId;
    let resolvedPersona = resolvePersona(personaName, personaId);
    const isNewPersona = !resolvedPersona;

    if (!resolvedPersona) {
      if (!personaName) {
        return NextResponse.json(
          { error: 'Persona not found and personaName required to create' },
          { status: 400 },
        );
      }
      const stub = createPersonaStub(personaName);
      resolvedPersona = stub;
      resolvedPersonaId = stub.id;
    } else {
      resolvedPersonaId = resolvedPersona.id;
    }

    const sessionId = nanoid(8);
    await prisma.distillSession.create({
      data: {
        id: sessionId,
        personaName: resolvedPersona.nameZh || resolvedPersona.name,
        personaId: resolvedPersonaId,
        personaDomain: resolvedPersona.domain[0] || 'philosophy',
        status: 'pending',
        options: options as unknown as Prisma.InputJsonValue,
      },
    });

    runV4Distillation(sessionId, resolvedPersonaId, options).catch(() => {});

    return NextResponse.json(
      {
        sessionId,
        personaId: resolvedPersonaId,
        personaName: resolvedPersona.nameZh || resolvedPersona.name,
        isNewPersona,
        status: 'pending',
        message: `v4 distillation started. Pipeline version: v4`,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('[Admin Distill POST]', err);
    return NextResponse.json(
      { error: '蒸馏服务暂时不可用，请稍后重试', sessionId: null },
      { status: 503 },
    );
  }
}

// ─── DELETE /api/admin/distill ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await prisma.distillSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'running') {
      await prisma.distillSession.update({
        where: { id: sessionId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Cancelled by admin',
        },
      });
    }

    return NextResponse.json({
      sessionId,
      status: session.status === 'running' ? 'cancelled' : session.status,
      message:
        session.status === 'running'
          ? 'Running distillation has been cancelled'
          : 'Session status updated',
    });
  } catch (err) {
    console.error('[Admin Distill DELETE]', err);
    return NextResponse.json({
      sessionId: null,
      status: 'unavailable',
      message: '蒸馏服务暂时不可用，请稍后重试',
    });
  }
}
