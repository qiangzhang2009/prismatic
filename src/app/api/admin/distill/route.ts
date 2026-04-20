/**
 * Prismatic — Admin Distillation API
 * PostgreSQL-backed session persistence for Vercel serverless compatibility
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getPersonaById } from '@/lib/personas';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  FullAutoDistillationOrchestrator,
  type FullDistillationResult,
  type DistillationOptions,
} from '@/lib/distillation-orchestrator-full-auto';
import type { Persona, Domain } from '@/lib/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface StartDistillRequest {
  personaName?: string;
  personaId?: string;
  options?: DistillationOptions;
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

// ─── Helper: Run distillation ──────────────────────────────────────────────────

async function runDistillationAsync(
  sessionId: string,
  persona: Persona,
  options: DistillationOptions,
): Promise<void> {
  try {
    await prisma.distillSession.update({
      where: { id: sessionId },
      data: { status: 'running' },
    });

    const orchestrator = new FullAutoDistillationOrchestrator(persona, options);
    const result = await orchestrator.run(sessionId);

    const serialized = serializeResult(result);
    await prisma.distillSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: serialized,
        totalCost: result.totalCost,
        totalTokens: result.totalTokens,
      },
    });
  } catch (err) {
    console.error('[Distill] runDistillationAsync error:', err);
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

// ─── Helper: Serialize result for DB storage ─────────────────────────────────

function serializeResult(result: FullDistillationResult) {
  return {
    personaId: result.persona.id,
    personaName: result.persona.nameZh || result.persona.name,
    finalScore: result.finalScore,
    thresholdPassed: result.thresholdPassed,
    deploymentStatus: result.deploymentStatus,
    totalCost: result.totalCost,
    totalTokens: result.totalTokens,
    iterations: result.iterations.length,
    corpusStats: result.corpusStats,
    personaType: result.personaType,
    qualityThreshold: result.qualityThreshold,
    score: result.score
      ? {
          overall: result.score.overall,
          grade: result.score.grade,
          breakdown: result.score.breakdown,
          findings: result.score.findings,
          timestamp:
            result.score.timestamp instanceof Date
              ? result.score.timestamp.toISOString()
              : result.score.timestamp,
        }
      : null,
    qualityGateSkipped: result.qualityGateSkipped ?? false,
  } as unknown as Prisma.InputJsonValue;
}

// ─── GET /api/admin/distill ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') as SessionStatus | null;
    const sessionId = searchParams.get('sessionId');

    // Get specific session
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

    // List sessions
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
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

    // Resolve or create persona
    let persona = resolvePersona(personaName, personaId);
    const isNewPersona = !persona;

    if (!persona) {
      if (!personaName) {
        return NextResponse.json(
          { error: 'Persona not found and personaName required to create' },
          { status: 400 },
        );
      }
      persona = createPersonaStub(personaName);
    }

    // Create DB session
    const sessionId = nanoid(8);
    await prisma.distillSession.create({
      data: {
        id: sessionId,
        personaName: persona.nameZh || persona.name,
        personaId: persona.id,
        personaDomain: persona.domain[0] || 'philosophy',
        status: 'pending',
        options: options as unknown as Prisma.InputJsonValue,
      },
    });

    // Run distillation in background
    runDistillationAsync(sessionId, persona, options).catch(() => {});

    return NextResponse.json(
      {
        sessionId,
        personaId: persona.id,
        personaName: persona.nameZh || persona.name,
        isNewPersona,
        status: 'pending',
        message: 'Distillation started.',
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('[Admin Distill POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
