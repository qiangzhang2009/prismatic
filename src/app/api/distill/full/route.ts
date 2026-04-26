/**
 * Prismatic — Full Distillation API (v4)
 * One-command distillation using the v4 pipeline with DeepSeek LLM
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getPersonaById } from '@/lib/personas';
import type { Persona, Domain, DistillationScore } from '@/lib/types';
import * as path from 'path';

const CORPUS_ROOT = path.join(process.cwd(), 'corpus');

function resolveCorpusDir(personaId: string): string {
  return path.join(CORPUS_ROOT, personaId);
}

interface DistillFullOptions {
  language?: 'zh' | 'en' | 'auto';
  maxCost?: number;
  autoApprove?: boolean;
  qualityThreshold?: number;
  iterations?: number;
  stream?: boolean;
  fallbackToV3?: boolean;
}

interface DistillFullRequest {
  personaName?: string;
  personaId?: string;
  options?: DistillFullOptions;
}

interface CorpusStats {
  totalWords: number;
  sources: string[];
  quality: number;
}

interface DistillationResult {
  personaId: string;
  personaName: string;
  score: DistillationScore | null;
  corpusStats: CorpusStats;
  deploymentStatus: 'ready' | 'needs-review' | 'needs-work';
  iterations: number;
  finalScore: number;
  grade: string;
  route: string;
  totalCost: number;
  totalTokens: number;
  completedAt: string;
  version: 'v3' | 'v4';
}

function resolvePersona(nameOrId?: string, id?: string): Persona | null {
  if (id) return getPersonaById(id) ?? null;
  if (!nameOrId) return null;

  const byId = getPersonaById(nameOrId);
  if (byId) return byId;

  const slug = nameOrId.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const bySlug = getPersonaById(slug);
  if (bySlug) return bySlug;

  const normalized = nameOrId.toLowerCase().trim();
  const allPersonas = Object.values((globalThis as any).__PERSONAS__ ?? {}) as Persona[];
  return allPersonas.find(
    (p) =>
      p.nameZh.toLowerCase() === normalized ||
      p.name.toLowerCase() === normalized ||
      p.nameEn.toLowerCase() === normalized ||
      p.id.toLowerCase() === normalized,
  ) ?? null;
}

function createPersonaStub(name: string): Persona {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
      sentenceStyle: [],
      vocabulary: [],
      forbiddenWords: [],
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
    isAlive: true,
    systemPromptTemplate: `You are ${name}.`,
    identityPrompt: `I am ${name}.`,
  };
}

function determineDeploymentStatus(score: number): 'ready' | 'needs-review' | 'needs-work' {
  if (score >= 80) return 'ready';
  if (score >= 60) return 'needs-review';
  return 'needs-work';
}

// ─── GET /api/distill/full ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const stats = searchParams.get('stats') === 'true';

  // Placeholder — v4 uses admin session DB; this endpoint returns a summary
  if (stats) {
    return NextResponse.json({
      version: 'v4',
      message: 'Use /api/admin/distill for session management',
    });
  }

  return NextResponse.json({
    version: 'v4',
    message: 'Use POST to start distillation',
  });
}

// ─── POST /api/distill/full ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DistillFullRequest;
    const { personaName, personaId, options = {} } = body;

    let persona = resolvePersona(personaName, personaId ?? undefined);
    let isNewPersona = false;

    if (!persona) {
      if (!personaName) {
        return NextResponse.json(
          { error: 'Either personaName or personaId is required' },
          { status: 400 },
        );
      }
      persona = createPersonaStub(personaName);
      isNewPersona = true;
    }

    const corpusDir = resolveCorpusDir(persona.id);

    console.log(`[distill/full] Starting v4 distillation for ${persona.nameZh || persona.name} (${persona.id})`);
    console.log(`[distill/full] Corpus dir: ${corpusDir}`);

    // Dynamic import prevents bundler from scanning corpus paths at build time
    const { distillPersonaV4, DEFAULT_CONFIG } = await import('@/lib/distillation-v4');

    const outputLang = options.language === 'en' ? 'en-US' : 'zh-CN';
    const v4Config = {
      maxIterations: options.iterations ?? DEFAULT_CONFIG.maxIterations,
      adaptiveThreshold: options.qualityThreshold ? options.qualityThreshold >= 70 : DEFAULT_CONFIG.adaptiveThreshold,
      outputLanguage: outputLang as 'zh-CN' | 'en-US',
    };

    console.log(`[distill/full] Config:`, JSON.stringify(v4Config));

    let result: DistillationResult;
    let success = false;

    try {
      const v4Result = await distillPersonaV4({
        personaId: persona.id,
        corpusDir,
        config: v4Config,
        onProgress: (stage, pct) => {
          console.log(`[distill/full] ${stage} = ${pct}%`);
        },
      });

      const finalScore = v4Result.pipelineResult.finalScore;
      const grade = v4Result.pipelineResult.grade ?? (finalScore >= 90 ? 'A' : finalScore >= 75 ? 'B' : finalScore >= 60 ? 'C' : finalScore >= 45 ? 'D' : 'F');

      result = {
        personaId: persona.id,
        personaName: persona.nameZh || persona.name,
        score: null,
        corpusStats: {
          totalWords: 0,
          sources: [],
          quality: 0,
        },
        deploymentStatus: determineDeploymentStatus(finalScore),
        iterations: v4Result.pipelineResult.iterationList?.length ?? 1,
        finalScore,
        grade,
        route: 'uni',
        totalCost: 0,
        totalTokens: 0,
        completedAt: new Date().toISOString(),
        version: 'v4',
      };
      success = true;
    } catch (v4Err) {
      console.error(`[distill/full] v4 failed:`, v4Err);
      result = {
        personaId: persona.id,
        personaName: persona.nameZh || persona.name,
        score: null,
        corpusStats: { totalWords: 0, sources: [], quality: 0 },
        deploymentStatus: 'needs-review',
        iterations: 0,
        finalScore: 0,
        grade: 'F',
        route: 'failed',
        totalCost: 0,
        totalTokens: 0,
        completedAt: new Date().toISOString(),
        version: 'v4',
      };
    }

    return NextResponse.json({
      isNewPersona,
      ...result,
    });
  } catch (err) {
    console.error('[DistillFull API]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
