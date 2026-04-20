/**
 * Prismatic — Distillation Pipeline SSE Events
 * 借鉴 JARVIS 的实时进度流架构
 */

export type PipelineEventType = string;

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface PipelineEvent {
  id: string;
  type: PipelineEventType;
  severity: EventSeverity;
  planId: string;
  personaId: string;
  timestamp: string;
  wave?: number;
  stage?: string;
  taskId?: string;
  message: string;
  detail?: Record<string, unknown>;
  cost?: number;
  tokens?: number;
  durationMs?: number;
}

export interface ScraperProgressEvent {
  targetId: string;
  collectorType: string;
  status: string;
  itemsCollected: number;
  estimatedTotal: number;
  rate: number;
  errors: number;
  elapsedMs: number;
  currentUrl?: string;
  bytesDownloaded?: number;
}

export interface LLMCallEvent {
  taskId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  cost: number;
  cached: boolean;
}

export interface QualityGateEvent {
  taskId: string;
  scores: {
    voiceFidelity: number;
    knowledgeDepth: number;
    reasoningPattern: number;
    safetyCompliance: number;
    overall: number;
  };
  grade: string;
  thresholdPassed: boolean;
  findingsCount: number;
}

export interface PlaytestEvent {
  taskId: string;
  caseId: string;
  topic: string;
  score: number;
  passed: boolean;
  totalCases: number;
  completedCases: number;
}

// ─── SSE Helpers ───────────────────────────────────────────────────────────────

export function createEvent(
  type: PipelineEventType,
  planId: string,
  personaId: string,
  message: string,
  detail?: Record<string, unknown>,
  severity: EventSeverity = 'info'
): PipelineEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    planId,
    personaId,
    timestamp: new Date().toISOString(),
    message,
    detail,
  };
}

export function formatSSE(
  event: PipelineEvent,
  data?: Record<string, unknown>
): string {
  const payload = { ...event, ...data };
  return [
    `event: ${event.type}`,
    `data: ${JSON.stringify(payload)}`,
    '',
    '',
  ].join('\n');
}

export function getSeverityForStatus(status: string): EventSeverity {
  switch (status) {
    case 'completed':
    case 'passed':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
    case 'in_progress':
      return 'info';
    case 'pending':
    case 'queued':
      return 'debug';
    default:
      return 'info';
  }
}

export function getEventIcon(type: PipelineEventType): string {
  const icons: Record<string, string> = {
    plan_created: '📋',
    stage_started: '🚀',
    stage_completed: '✅',
    wave_started: '🌊',
    wave_completed: '🌊',
    task_queued: '⏳',
    task_started: '▶️',
    task_progress: '⚙️',
    task_completed: '✓',
    task_failed: '✗',
    task_retried: '🔄',
    scraper_started: '🕷️',
    scraper_progress: '📡',
    scraper_completed: '📦',
    scraper_failed: '💥',
    llm_call_started: '🤖',
    llm_call_completed: '💬',
    quality_gate_started: '🔍',
    quality_gate_completed: '🏆',
    playtest_started: '🎮',
    playtest_completed: '🎯',
    artifact_created: '💎',
    cost_updated: '💰',
    token_updated: '📊',
    pipeline_completed: '🎉',
    pipeline_failed: '💀',
    pipeline_cancelled: '🛑',
  };
  return icons[type] ?? '•';
}
