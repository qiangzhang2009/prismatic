/**
 * Zero 蒸馏引擎 — 结构化日志
 * 替代 console.log，所有日志都带 timestamp + phase + personaId + 结构化数据
 */

import { PipelinePhase, DistillationStatus } from '../types';

// =============================================================================
// Log Levels
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =============================================================================
// Log Entry
// =============================================================================

export interface LogEntry {
  timestamp: string; // ISO 8601
  level: LogLevel;
  phase: PipelinePhase | 'setup' | 'teardown' | 'unknown';
  personaId?: string;
  message: string;
  detail?: Record<string, unknown>;
  error?: string;
  stack?: string;
  durationMs?: number;
  costUSD?: number;
  tokensUsed?: number;
}

export interface ProgressEntry extends LogEntry {
  progress: number; // 0-100
  step: string;
}

// =============================================================================
// Logger
// =============================================================================

export class ZeroLogger {
  private level: LogLevel;
  private phase: PipelinePhase | 'setup' | 'teardown' | 'unknown' = 'setup';
  private personaId?: string;
  private sessionId: string;
  private entries: LogEntry[] = [];
  private onEntry?: (entry: LogEntry) => void;
  private startTime: number;

  constructor(options: { level?: LogLevel; personaId?: string; onEntry?: (entry: LogEntry) => void } = {}) {
    this.level = options.level ?? (process.env.ZERO_LOG_LEVEL as LogLevel) ?? 'info';
    this.personaId = options.personaId;
    this.onEntry = options.onEntry;
    this.startTime = Date.now();
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private makeEntry(
    level: LogLevel,
    message: string,
    detail?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      phase: this.phase,
      personaId: this.personaId,
      message,
      durationMs: Date.now() - this.startTime,
    };

    if (detail && Object.keys(detail).length > 0) {
      // Sanitize detail — remove large strings
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(detail)) {
        if (typeof v === 'string' && v.length > 500) {
          sanitized[k] = v.slice(0, 500) + `... [truncated, total ${v.length} chars]`;
        } else if (typeof v === 'object' && v !== null) {
          sanitized[k] = v;
        } else {
          sanitized[k] = v;
        }
      }
      entry.detail = sanitized;
    }

    if (error) {
      entry.error = error.message;
      entry.stack = error.stack;
    }

    return entry;
  }

  private emit(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.onEntry) {
      this.onEntry(entry);
    }

    // Console output
    if (!this.shouldLog(entry.level)) return;

    const prefix = `[${entry.phase}]`.padEnd(12);
    const levelStr = `[${entry.level.toUpperCase()}]`.padEnd(7);
    const personaStr = entry.personaId ? `[${entry.personaId}]`.padEnd(20) : '';
    const duration = entry.durationMs !== undefined ? `[${entry.durationMs}ms]` : '';

    const parts = [`${prefix}${levelStr}${personaStr}${duration} ${entry.message}`];

    if (entry.detail && Object.keys(entry.detail).length > 0) {
      const detailStr = Object.entries(entry.detail)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      parts.push(`  ${detailStr}`);
    }

    if (entry.error) {
      parts.push(`  ERROR: ${entry.error}`);
      if (entry.stack) {
        parts.push(`  Stack: ${entry.stack.split('\n').slice(0, 3).join(' | ')}`);
      }
    }

    const output = parts.join('\n');

    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  // -------------------------------------------------------------------------
  // Phase Management
  // -------------------------------------------------------------------------

  setPhase(phase: PipelinePhase | 'setup' | 'teardown' | 'unknown'): void {
    this.phase = phase;
  }

  setPersonaId(personaId: string): void {
    this.personaId = personaId;
  }

  // -------------------------------------------------------------------------
  // Logging Methods
  // -------------------------------------------------------------------------

  debug(message: string, detail?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    this.emit(this.makeEntry('debug', message, detail));
  }

  info(message: string, detail?: Record<string, unknown>): void {
    this.emit(this.makeEntry('info', message, detail));
  }

  warn(message: string, detail?: Record<string, unknown>): void {
    this.emit(this.makeEntry('warn', message, detail));
  }

  error(message: string, error?: Error, detail?: Record<string, unknown>): void {
    this.emit(this.makeEntry('error', message, detail, error));
  }

  // -------------------------------------------------------------------------
  // Domain-specific logging
  // -------------------------------------------------------------------------

  /**
   * Log LLM call with cost info
   */
  logLLMCall(model: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }, costUSD: number, durationMs: number): void {
    this.info(`LLM call`, {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUSD,
      costPer1M: ((costUSD / usage.totalTokens) * 1_000_000).toFixed(4),
      durationMs,
    });
  }

  /**
   * Log gate result
   */
  logGate(gateName: string, passed: boolean, score: number, threshold: number, durationMs: number): void {
    const status = passed ? 'PASS' : 'FAIL';
    const level = passed ? 'info' : 'warn';
    this.emit(
      this.makeEntry(level, `Gate[${gateName}] ${status}`, {
        score: score.toFixed(1),
        threshold,
        durationMs,
      })
    );
  }

  /**
   * Log progress update
   */
  logProgress(phase: PipelinePhase, step: string, progress: number, detail?: Record<string, unknown>): void {
    const progressStr = `${progress.toFixed(0)}%`.padEnd(5);
    this.emit(
      this.makeEntry('info', `[${progressStr}] ${step}`, {
        phase,
        progress,
        ...detail,
      })
    );
  }

  /**
   * Log iteration result
   */
  logIteration(
    iteration: number,
    status: DistillationStatus,
    grade: string | undefined,
    score: number | undefined,
    cost: number,
    durationMs: number
  ): void {
    const scoreStr = score !== undefined ? score.toFixed(1) : 'N/A';
    this.info(`Iteration ${iteration} ${status}`, {
      grade,
      score: scoreStr,
      costUSD: cost.toFixed(4),
      durationMs,
    });
  }

  /**
   * Log corpus analysis result
   */
  logCorpusAnalysis(
    wordCount: number,
    qualityScore: number,
    primaryLanguage: string,
    files: number
  ): void {
    this.info(`Corpus analyzed`, {
      wordCount: wordCount.toLocaleString(),
      qualityScore: qualityScore.toFixed(1),
      primaryLanguage,
      totalFiles: files,
    });
  }

  /**
   * Log extraction summary
   */
  logExtraction(
    layerType: string,
    count: number,
    confidence: number,
    llmCalls: number,
    costUSD: number,
    durationMs: number
  ): void {
    this.info(`Extracted ${layerType}`, {
      count,
      avgConfidence: confidence.toFixed(2),
      llmCalls,
      costUSD: costUSD.toFixed(4),
      durationMs,
    });
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  getEntriesByPhase(phase: PipelinePhase | 'setup' | 'teardown'): LogEntry[] {
    return this.entries.filter((e) => e.phase === phase);
  }

  getErrors(): LogEntry[] {
    return this.entries.filter((e) => e.level === 'error');
  }

  getSummary(): {
    sessionId: string;
    totalEntries: number;
    byLevel: Record<LogLevel, number>;
    byPhase: Record<string, number>;
    durationMs: number;
    errors: number;
  } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const byPhase: Record<string, number> = {};

    for (const entry of this.entries) {
      byLevel[entry.level]++;
      byPhase[entry.phase] = (byPhase[entry.phase] ?? 0) + 1;
    }

    return {
      sessionId: this.sessionId,
      totalEntries: this.entries.length,
      byLevel,
      byPhase,
      durationMs: Date.now() - this.startTime,
      errors: byLevel.error,
    };
  }

  reset(): void {
    this.entries = [];
    this.startTime = Date.now();
    this.sessionId = this.generateSessionId();
  }
}

// =============================================================================
// Factory
// =============================================================================

const loggers = new Map<string, ZeroLogger>();

export function getZeroLogger(personaId?: string, level?: LogLevel): ZeroLogger {
  const key = personaId ?? 'default';
  if (!loggers.has(key)) {
    loggers.set(key, new ZeroLogger({ personaId, level }));
  }
  return loggers.get(key)!;
}

export function createZeroLogger(personaId?: string): ZeroLogger {
  return new ZeroLogger({ personaId, level: 'info' });
}

export function resetAllLoggers(): void {
  loggers.clear();
}
