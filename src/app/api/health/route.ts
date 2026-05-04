/**
 * Prismatic — Health Check API
 *
 * Performs comprehensive dependency checks for autonomous operation:
 *   1. Database (Neon PostgreSQL) — critical
 *   2. LLM Provider (DeepSeek / OpenAI / Anthropic) — critical
 *   3. RAG Engine (TCM texts) — non-critical (graceful degradation)
 *
 * Returns 200 only when all critical dependencies are healthy.
 * Returns 503 when any critical dependency is down (for alerting systems).
 *
 * Usage: Configure your uptime monitor / PagerDuty / Cron to hit this endpoint.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getRAGStats } from '@/lib/tcm-rag';

interface DependencyStatus {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
  message?: string;
  details?: unknown;
}

interface HealthReport {
  ok: boolean;
  timestamp: string;
  version: string;
  environment: string;
  dependencies: {
    database: DependencyStatus;
    llm: DependencyStatus;
    rag: DependencyStatus;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return { status: 'error', message: 'DATABASE_URL not set', latencyMs: 0 };
    }

    const sql = neon(connectionString);
    const result = await sql`SELECT 1 as check`;
    const latencyMs = Date.now() - start;

    if (result.length === 0) {
      return { status: 'error', message: 'DB query returned no rows', latencyMs };
    }

    return {
      status: 'ok',
      latencyMs,
      details: { rowsReturned: result.length },
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message, latencyMs };
  }
}

async function checkLLM(): Promise<DependencyStatus> {
  const start = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { status: 'error', message: 'No LLM API key configured (DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY)', latencyMs: 0 };
  }

  // Try primary provider (DeepSeek)
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 3,
        }),
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { status: 'ok', latencyMs, details: { provider: 'deepseek' } };
      }

      const errBody = await response.text().catch(() => '');
      return {
        status: 'error',
        message: `DeepSeek API error ${response.status}: ${errBody.slice(0, 100)}`,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message.includes('aborted') || message.includes('timeout');

      // Fallback: try OpenAI if available
      if (process.env.OPENAI_API_KEY) {
        return await checkLLMFallback('openai', 'https://api.openai.com/v1/chat/completions', { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3 }, latencyMs);
      }

      return {
        status: isTimeout ? 'error' : 'error',
        message: isTimeout ? 'DeepSeek API timeout (8s)' : message,
        latencyMs,
        details: { provider: 'deepseek', fallbackTried: false },
      };
    }
  }

  // No DeepSeek key — try OpenAI
  if (process.env.OPENAI_API_KEY) {
    return await checkLLMFallback('openai', 'https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 3,
    }, 0);
  }

  return { status: 'error', message: 'No LLM provider available', latencyMs: Date.now() - start };
}

async function checkLLMFallback(
  provider: 'openai' | 'anthropic',
  url: string,
  body: Record<string, unknown>,
  elapsedMs: number
): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { status: 'error', message: `${provider} key not set`, latencyMs: Date.now() - start };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(provider === 'openai' ? { Authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;
    if (response.ok) {
      return { status: 'ok', latencyMs, details: { provider, note: 'fallback from primary' } };
    }

    return { status: 'error', message: `${provider} API error ${response.status}`, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { status: 'error', message: String(err), latencyMs };
  }
}

async function checkRAG(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const stats = await getRAGStats();
    const latencyMs = Date.now() - start;

    if (!stats.ready) {
      return {
        status: 'degraded',
        latencyMs,
        message: 'RAG manifest not loaded',
        details: stats,
      };
    }

    return {
      status: 'ok',
      latencyMs,
      details: {
        sourceCount: stats.totalSources ?? 0,
        chunkCount: stats.totalChunks ?? 0,
        totalChars: stats.totalChars ?? 0,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: 'degraded',
      latencyMs,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(): Promise<NextResponse<HealthReport>> {
  const start = Date.now();

  // Run all checks in parallel for speed
  const [db, llm, rag] = await Promise.all([
    checkDatabase(),
    checkLLM(),
    checkRAG(),
  ]);

  const overall = (() => {
    if (db.status === 'ok' && llm.status === 'ok') return 'healthy';
    if (db.status === 'ok' && llm.status === 'error') return 'unhealthy';
    return 'degraded';
  })();

  const report: HealthReport = {
    ok: overall === 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    dependencies: { database: db, llm, rag },
    overall,
  };

  const statusCode = overall === 'healthy' ? 200
    : overall === 'degraded' ? 200
    : 503;

  const totalMs = Date.now() - start;
  console.log(`[health] overall=${overall} db=${db.status} llm=${llm.status} rag=${rag.status} totalMs=${totalMs}`);

  return NextResponse.json(report, { status: statusCode });
}
