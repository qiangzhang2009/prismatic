/**
 * Prismatic — Full-Auto Distillation API
 * One-command distillation with auto-fix loop, streaming progress, and full result reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getPersonaById } from '@/lib/personas';
import { calculateDistillationScore } from '@/lib/distillation-metrics';
import {
  DistillationOrchestrator,
  runDistillation,
} from '@/lib/distillation-orchestrator';
import {
  createEvent,
  formatSSE,
  type PipelineEvent,
  type PipelineEventType,
} from '@/lib/distillation-events';
import {
  getAutoFixableFindings,
} from '@/lib/distillation-metrics';
import {
  type Persona,
  type DistillationScore,
  type ExpressionDNAProfile,
  type PlaytestReport,
  type PipelinePlan,
  type CollectorConfig,
} from '@/lib/types';
import { getLLMProvider } from '@/lib/llm';

// ─── Store active sessions for status queries ──────────────────────────────────

interface ActiveSession {
  planId: string;
  personaId: string;
  personaName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: DistillationResult;
  error?: string;
  score?: DistillationScore;
  progress: {
    currentWave: number;
    completedTasks: number;
    totalTasks: number;
    totalCost: number;
    totalTokens: number;
  };
  events: PipelineEvent[];
}

const activeSessions = new Map<string, ActiveSession>();
const completedResults = new Map<string, DistillationResult>();

// ─── Request Types ─────────────────────────────────────────────────────────────

interface DistillFullOptions {
  language?: 'zh' | 'en' | 'auto';
  maxCost?: number;
  autoApprove?: boolean;
  qualityThreshold?: number;
  iterations?: number;
  stream?: boolean;
}

interface DistillFullRequest {
  personaName?: string;
  personaId?: string;
  options?: DistillFullOptions;
}

interface AutoFixRecord {
  findingId: string;
  findingTitle: string;
  action: string;
  applied: boolean;
  timestamp: Date;
}

// ─── Response Types ────────────────────────────────────────────────────────────

interface CorpusStats {
  totalWords: number;
  sources: string[];
  quality: number;
}

export interface DistillationResult {
  personaId: string;
  persona: Persona | null;
  score: DistillationScore;
  corpusStats: CorpusStats;
  dnaProfile?: ExpressionDNAProfile;
  playtestReport?: PlaytestReport;
  autoFixLog: AutoFixRecord[];
  deploymentStatus: 'ready' | 'needs-review' | 'needs-work';
  iterations: number;
  finalScore: number;
  totalCost: number;
  totalTokens: number;
  completedAt: Date;
  error?: string;
}

interface StatusResponse {
  planId: string;
  personaId: string;
  personaName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: ActiveSession['progress'];
  startedAt: string;
  completedAt?: string;
  error?: string;
  score?: DistillationScore;
}

interface StatsResponse {
  activeSessions: number;
  completedSessions: number;
  sessions: StatusResponse[];
}

// ─── Helper: Resolve persona by name or ID ────────────────────────────────────

function resolvePersona(nameOrId?: string, personaId?: string): Persona | null {
  if (personaId) {
    return getPersonaById(personaId) ?? null;
  }
  if (nameOrId) {
    // Try exact name match first
    const byId = getPersonaById(nameOrId);
    if (byId) return byId;

    // Try slugified name
    const slug = nameOrId
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const bySlug = getPersonaById(slug);
    if (bySlug) return bySlug;

    // Try fuzzy match on nameZh/nameEn/name
    const allPersonas = Object.values(
      (globalThis as any).__PERSONAS__ ?? {}
    ) as Persona[];
    const normalized = nameOrId.toLowerCase().trim();
    const matched = allPersonas.find(
      (p) =>
        p.nameZh.toLowerCase() === normalized ||
        p.name.toLowerCase() === normalized ||
        p.nameEn.toLowerCase() === normalized ||
        p.id.toLowerCase() === normalized
    );
    if (matched) return matched;
  }
  return null;
}

// ─── Helper: Create stub persona for new distillation ─────────────────────────

function createPersonaStub(name: string): Persona {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return {
    id: `stub-${slug}-${nanoid(6)}`,
    slug,
    name,
    nameZh: name,
    nameEn: name,
    domain: ['technology'],
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
    systemPromptTemplate: `You are ${name}.`,
    identityPrompt: `I am ${name}.`,
  };
}

// ─── Helper: Determine deployment status ──────────────────────────────────────

function determineDeploymentStatus(score: DistillationScore): 'ready' | 'needs-review' | 'needs-work' {
  if (score.overall >= 80) return 'ready';
  if (score.overall >= 60) return 'needs-review';
  return 'needs-work';
}

// ─── Helper: Run distillation with auto-fix loop ───────────────────────────────

async function runDistillationWithAutoFix(
  persona: Persona,
  options: Required<DistillFullOptions>,
  session: ActiveSession,
  request: NextRequest
): Promise<DistillationResult> {
  const autoFixLog: AutoFixRecord[] = [];
  let currentPersona = persona;
  let currentScore: DistillationScore | undefined;
  let iterations = 0;
  const maxIterations = options.iterations;

  while (iterations < maxIterations) {
    iterations++;

    session.progress = { currentWave: 0, completedTasks: 0, totalTasks: 0, totalCost: 0, totalTokens: 0 };
    session.events = [];

    // Create orchestrator with SSE support
    const orchestrator = new DistillationOrchestrator(currentPersona, {
      parallelLimit: 4,
      retryCount: 3,
      retryDelay: 1000,
      timeout: 60000,
      userAgent: 'Mozilla/5.0 (compatible; PrismaticBot/1.0)',
      respectRobotsTxt: true,
    });

    // Override orchestrator's plan with session tracking
    const plan = orchestrator.getPlan() as PipelinePlan;
    session.planId = plan.id;

    // Build SSE controller
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial event
        controller.enqueue(
          encoder.encode(
            formatSSE(
              createEvent(
                'plan_created' as PipelineEventType,
                plan.id,
                currentPersona.id,
                `蒸馏开始 [迭代 ${iterations}/${maxIterations}]`,
                { iteration: iterations }
              )
            ) + '\n'
          )
        );
      },
    });

    // Run the orchestrator
    const runPromise = orchestrator.run();

    // Wait for completion
    const runResult = await runPromise;

    // Track events
    const events = orchestrator.getEvents();
    session.events.push(...events);
    session.progress = {
      ...orchestrator.getProgress(),
      totalCost: orchestrator.getPlan().totalCost,
      totalTokens: orchestrator.getPlan().totalTokens,
    };

    currentScore = runResult.score;
    session.score = currentScore;

    // Update session progress from plan
    session.progress = {
      currentWave: plan.currentWave,
      completedTasks: plan.tasks.filter(t => t.status === 'completed').length,
      totalTasks: plan.tasks.length,
      totalCost: plan.totalCost,
      totalTokens: plan.totalTokens,
    };

    if (!currentScore) {
      currentScore = calculateDistillationScore(currentPersona);
    }

    // Check quality threshold
    if (currentScore.overall >= options.qualityThreshold) {
      break;
    }

    // Auto-fix loop
    if (iterations < maxIterations) {
      const autoFixable = getAutoFixableFindings(currentScore);

      for (const finding of autoFixable) {
        const record: AutoFixRecord = {
          findingId: finding.id,
          findingTitle: finding.title,
          action: finding.fixSuggestion,
          applied: options.autoApprove,
          timestamp: new Date(),
        };

        if (options.autoApprove) {
          // Apply fix logic
          await applyAutoFix(orchestrator, finding, currentPersona);
        }

        autoFixLog.push(record);
      }

      if (autoFixLog.length === 0) {
        // No auto-fixable issues, stop iterating
        break;
      }
    }
  }

  // Generate playtest report if needed
  let playtestReport: PlaytestReport | undefined;
  try {
    const { PersonaPlaytestEngine, generateTestCases, generatePlaytestReport: genReport } = await import('@/lib/persona-playtest');
    const testCases = generateTestCases(currentPersona, 8);
    const engine = new PersonaPlaytestEngine({
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 400,
      concurrency: 2,
    });
    const results = await engine.runTests(currentPersona, testCases);
    playtestReport = genReport(currentPersona, results, currentScore!);
  } catch {
    // Playtest optional, don't fail the whole pipeline
  }

  const finalScore = currentScore?.overall ?? 0;
  const corpusStats: CorpusStats = {
    totalWords: 0,
    sources: [],
    quality: currentScore?.breakdown.voiceFidelity ?? 0,
  };

  return {
    personaId: currentPersona.id,
    persona: currentPersona,
    score: currentScore ?? {
      overall: 0,
      grade: 'F',
      breakdown: {
        voiceFidelity: 0,
        knowledgeDepth: 0,
        reasoningPattern: 0,
        safetyCompliance: 0,
      },
      findings: [],
      starRating: 1,
      thresholdPassed: false,
      timestamp: new Date(),
      modelUsed: 'internal',
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    },
    corpusStats,
    playtestReport,
    autoFixLog,
    deploymentStatus: determineDeploymentStatus(currentScore ?? {
      overall: 0,
      grade: 'F',
      breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
      findings: [],
      starRating: 1,
      thresholdPassed: false,
      timestamp: new Date(),
      modelUsed: 'internal',
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }),
    iterations,
    finalScore,
    totalCost: session.progress.totalCost,
    totalTokens: session.progress.totalTokens,
    completedAt: new Date(),
  };
}

// ─── Helper: Apply auto-fix to persona ─────────────────────────────────────────

async function applyAutoFix(
  _orchestrator: DistillationOrchestrator,
  finding: { id: string; title: string; fixSuggestion: string },
  persona: Persona
): Promise<void> {
  switch (finding.id) {
    case 'voice-no-forbidden-words': {
      // Add forbidden word suggestions based on pattern
      if (persona.expressionDNA.forbiddenWords.length === 0) {
        persona.expressionDNA.forbiddenWords.push(
          'sounds good',
          'might be',
          'could be',
          'probably'
        );
      }
      break;
    }

    case 'safety-no-honest-boundaries': {
      if (persona.honestBoundaries.length === 0) {
        persona.honestBoundaries.push({
          text: 'I may not have expertise in all areas discussed',
          textZh: '我可能在所讨论的某些领域缺乏专业知识',
        });
      }
      break;
    }

    case 'reasoning-no-tensions': {
      if (persona.tensions.length === 0 && persona.values.length >= 2) {
        persona.tensions.push({
          dimension: `${persona.values[0]?.name} vs other considerations`,
          tensionZh: `${persona.values[0]?.nameZh} 与其他考量`,
          description: 'These values may conflict in edge cases',
          descriptionZh: '这些价值观在边缘情况下可能产生冲突',
        });
      }
      break;
    }

    case 'knowledge-few-mental-models': {
      // Add placeholder for missing mental models
      if (persona.mentalModels.length < 3) {
        persona.mentalModels.push({
          id: `placeholder-${nanoid(4)}`,
          name: 'Core Principle',
          nameZh: '核心原则',
          oneLiner: 'TBD - needs further research',
          evidence: [],
          crossDomain: [],
          application: 'Needs more data to define',
          limitation: 'Insufficient data',
        });
      }
      break;
    }

    case 'reasoning-no-anti-patterns': {
      if (persona.antiPatterns.length === 0) {
        persona.antiPatterns.push(
          'Avoiding hard decisions',
          'Over-generalizing from limited data'
        );
      }
      break;
    }

    default:
      // Non-auto-fixable finding
      break;
  }
}

// ─── Helper: Send SSE stream ──────────────────────────────────────────────────

async function sendSSEStream(
  orchestrator: DistillationOrchestrator,
  planId: string,
  personaId: string
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const events = orchestrator.getEvents();
      for (const event of events) {
        controller.enqueue(encoder.encode(formatSSE(event) + '\n'));
      }
    },
  });
}

// ─── GET /api/distill/full ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get('planId');
  const stats = searchParams.get('stats') === 'true';

  // Return all sessions summary
  if (stats) {
    const sessions: StatusResponse[] = [];
    for (const [id, session] of activeSessions.entries()) {
      sessions.push({
        planId: id,
        personaId: session.personaId,
        personaName: session.personaName,
        status: session.status,
        progress: session.progress,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        error: session.error,
        score: session.score,
      });
    }

    const response: StatsResponse = {
      activeSessions: [...activeSessions.values()].filter(s => s.status === 'running').length,
      completedSessions: completedResults.size,
      sessions,
    };

    return NextResponse.json(response);
  }

  // Return specific plan status
  if (planId) {
    const session = activeSessions.get(planId);
    if (!session) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const response: StatusResponse = {
      planId: session.planId,
      personaId: session.personaId,
      personaName: session.personaName,
      status: session.status,
      progress: session.progress,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      error: session.error,
      score: session.score,
    };

    return NextResponse.json(response);
  }

  // List all active plans
  const plans = [...activeSessions.values()].map(s => ({
    planId: s.planId,
    personaId: s.personaId,
    personaName: s.personaName,
    status: s.status,
    progress: s.progress,
    startedAt: s.startedAt.toISOString(),
  }));

  return NextResponse.json({ plans, count: plans.length });
}

// ─── POST /api/distill/full ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DistillFullRequest;
    const { personaName, personaId, options = {} } = body;

    // Resolve persona
    let persona = resolvePersona(personaName, personaId ?? undefined);
    let isNewPersona = false;

    if (!persona) {
      if (!personaName) {
        return NextResponse.json(
          { error: 'Either personaName or personaId is required' },
          { status: 400 }
        );
      }
      // Create stub persona for new distillation
      persona = createPersonaStub(personaName);
      isNewPersona = true;
    }

    // Normalize options with defaults
    const normalizedOptions: Required<DistillFullOptions> = {
      language: options.language ?? 'auto',
      maxCost: options.maxCost ?? 10,
      autoApprove: options.autoApprove ?? false,
      qualityThreshold: options.qualityThreshold ?? 60,
      iterations: options.iterations ?? 3,
      stream: options.stream ?? false,
    };

    // Check cost limit
    if (normalizedOptions.maxCost <= 0) {
      return NextResponse.json(
        { error: 'maxCost must be positive' },
        { status: 400 }
      );
    }

    // Create session
    const planId = nanoid(8);
    const session: ActiveSession = {
      planId,
      personaId: persona.id,
      personaName: persona.nameZh || persona.name,
      status: 'running',
      startedAt: new Date(),
      progress: {
        currentWave: 0,
        completedTasks: 0,
        totalTasks: 0,
        totalCost: 0,
        totalTokens: 0,
      },
      events: [],
    };

    activeSessions.set(planId, session);

    // Handle streaming mode
    if (normalizedOptions.stream) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          // Send initial plan_created event
          controller.enqueue(
            encoder.encode(
              formatSSE(
                createEvent(
                  'plan_created' as PipelineEventType,
                  planId,
                  persona.id,
                  `全自动化蒸馏开始 [${persona.nameZh || persona.name}]`,
                  {
                    isNewPersona,
                    qualityThreshold: normalizedOptions.qualityThreshold,
                    maxIterations: normalizedOptions.iterations,
                  }
                )
              ) + '\n'
            )
          );

          try {
            // Run distillation with streaming
            const result = await runDistillationWithAutoFix(
              persona,
              normalizedOptions,
              session,
              req
            );

            // Send final result event
            controller.enqueue(
              encoder.encode(
                formatSSE(
                  createEvent(
                    'pipeline_completed' as PipelineEventType,
                    planId,
                    persona.id,
                    `蒸馏完成，最终评分: ${result.finalScore}/100`,
                    {
                      finalScore: result.finalScore,
                      deploymentStatus: result.deploymentStatus,
                      iterations: result.iterations,
                      totalCost: result.totalCost,
                    }
                  )
                ) + '\n'
              )
            );

            // Store result
            session.status = 'completed';
            session.completedAt = new Date();
            session.result = result;
            completedResults.set(planId, result);

            // Send result as final SSE message
            controller.enqueue(
              encoder.encode(
                `event: result\ndata: ${JSON.stringify(result)}\n\n`
              )
            );
          } catch (err) {
            session.status = 'failed';
            session.error = err instanceof Error ? err.message : String(err);
            session.completedAt = new Date();

            controller.enqueue(
              encoder.encode(
                formatSSE(
                  createEvent(
                    'pipeline_failed' as PipelineEventType,
                    planId,
                    persona.id,
                    `蒸馏失败: ${session.error}`,
                    { error: session.error }
                  )
                ) + '\n'
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Non-streaming mode: run distillation and return final result
    try {
      const result = await runDistillationWithAutoFix(
        persona,
        normalizedOptions,
        session,
        req
      );

      session.status = 'completed';
      session.completedAt = new Date();
      session.result = result;

      completedResults.set(planId, result);

      return NextResponse.json({
        isNewPersona,
        ...result,
      } satisfies DistillationResult & { isNewPersona: boolean });
    } catch (err) {
      session.status = 'failed';
      session.error = err instanceof Error ? err.message : String(err);
      session.completedAt = new Date();

      return NextResponse.json(
        {
          planId,
          personaId: persona.id,
          error: session.error,
          status: 'failed',
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[DistillFull API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/distill/full ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get('planId');

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 });
  }

  const session = activeSessions.get(planId);
  if (!session) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  if (session.status === 'running') {
    session.status = 'failed';
    session.error = 'Cancelled by user';
    session.completedAt = new Date();
  }

  activeSessions.delete(planId);

  return NextResponse.json({ planId, status: 'deleted' });
}
