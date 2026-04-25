/**
 * Zero 蒸馏引擎 — LLM 调用封装（含真实 Cost Tracking）
 * 解决 v4 中 cost/tokens 永远是 0 的问题
 *
 * 复用 src/lib/llm.ts 的 Provider 模式，在其基础上添加：
 * 1. Session 级 cost tracking（真正的 cost 累加）
 * 2. JSON 解析 + schema 验证
 * 3. Embedding 调用封装
 * 4. LLM 调用计费（基于 DeepSeek 官方定价）
 */

import { getLLMProvider } from '../../llm';
import { LLMResponse, LLMCallOptions, LLMTokenUsage, LLMSessionStats, ModelStats } from '../types';
import { LLMMessage } from '../../llm';

// =============================================================================
// Pricing Constants (per 1M tokens)
// =============================================================================

const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.27, output: 2.19 },
  'deepseek-embedding': { input: 0.13, output: 0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku': { input: 0.8, output: 4.0 },
};

function getModelPricing(model: string): { input: number; output: number } {
  const lower = model.toLowerCase();
  for (const [key, price] of Object.entries(PRICING)) {
    if (lower.includes(key.replace('-', '_'))) return price;
  }
  return { input: 0.27, output: 1.1 }; // default: DeepSeek
}

function calculateCost(model: string, usage: LLMTokenUsage): number {
  const price = getModelPricing(model);
  const inputCost = (usage.promptTokens / 1_000_000) * price.input;
  const outputCost = (usage.completionTokens / 1_000_000) * price.output;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

// =============================================================================
// Session Tracker
// =============================================================================

export class LLMSession {
  private calls: Array<{
    model: string;
    usage: LLMTokenUsage;
    cost: number;
    durationMs: number;
    timestamp: Date;
    phase?: string;
  }> = [];

  private _budget: number;
  private _maxBudget: number;

  constructor(maxBudget: number = 10) {
    this._budget = 0;
    this._maxBudget = maxBudget;
  }

  get budget(): number {
    return this._budget;
  }

  get remainingBudget(): number {
    return Math.max(0, this._maxBudget - this._budget);
  }

  get stats(): LLMSessionStats {
    const byModel: Record<string, ModelStats> = {};
    const callsByPhase: Record<string, number> = {};

    for (const call of this.calls) {
      if (!byModel[call.model]) {
        byModel[call.model] = {
          calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0,
        };
      }
      const m = byModel[call.model];
      m.calls++;
      m.promptTokens += call.usage.promptTokens;
      m.completionTokens += call.usage.completionTokens;
      m.totalTokens += call.usage.totalTokens;
      m.cost += call.cost;

      const phase = call.phase ?? 'unknown';
      callsByPhase[phase] = (callsByPhase[phase] ?? 0) + 1;
    }

    return {
      totalCalls: this.calls.length,
      totalCost: this._budget,
      totalTokens: this.totalTokens,
      byModel,
      callsByPhase,
    };
  }

  get totalTokens(): LLMTokenUsage {
    const t = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (const c of this.calls) {
      t.promptTokens += c.usage.promptTokens;
      t.completionTokens += c.usage.completionTokens;
      t.totalTokens += c.usage.totalTokens;
    }
    return t;
  }

  canProceed(estimatedCost: number = 0.01): boolean {
    return this.remainingBudget >= estimatedCost;
  }

  recordCall(
    model: string,
    usage: LLMTokenUsage,
    cost: number,
    durationMs: number,
    phase?: string
  ): void {
    this._budget = Math.round((this._budget + cost) * 1e6) / 1e6;
    this.calls.push({ model, usage, cost, durationMs, timestamp: new Date(), phase });
  }

  reset(): void {
    this.calls = [];
    this._budget = 0;
  }
}

let _defaultSession: LLMSession | null = null;

export function getDefaultSession(): LLMSession {
  if (!_defaultSession) _defaultSession = new LLMSession();
  return _defaultSession;
}

export function createSession(maxBudget: number = 10): LLMSession {
  return new LLMSession(maxBudget);
}

export function resetDefaultSession(): void {
  _defaultSession = null;
}

// =============================================================================
// LLM Calls
// =============================================================================

/**
 * 调用 LLM（通过现有 provider），自动记录 cost tracking
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  session?: LLMSession,
  phase?: string
): Promise<LLMResponse> {
  const model = options.model ?? 'deepseek-chat';
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4000;
  const startTime = Date.now();

  const provider = getLLMProvider();
  const response = await provider.chat({ model, messages, temperature, maxTokens });

  const durationMs = Date.now() - startTime;
  const usage: LLMTokenUsage = {
    promptTokens: response.usage?.promptTokens ?? 0,
    completionTokens: response.usage?.completionTokens ?? 0,
    totalTokens: response.usage?.totalTokens ?? 0,
  };
  const costUSD = calculateCost(model, usage);

  const result: LLMResponse = {
    content: response.content,
    raw: response,
    usage,
    model,
    finishReason: response.finishReason ?? 'stop',
    durationMs,
    costUSD,
  };

  if (session) {
    if (!session.canProceed(costUSD)) {
      throw new Error(
        `Budget exceeded. Have $${session.budget.toFixed(4)}, need ~$${costUSD.toFixed(4)}`
      );
    }
    session.recordCall(model, usage, costUSD, durationMs, phase);
  }

  return result;
}

/**
 * 调用 LLM 并自动解析 JSON（4 种 fallback 策略）
 */
export async function callLLMWithJSON<T>(
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  session?: LLMSession,
  phase?: string,
  _jsonPath?: string
): Promise<{ data: T; response: LLMResponse }> {
  const response = await callLLM(messages, options, session, phase);
  const content = response.content.trim();

  // DEBUG: Log first 500 chars of response
  console.error(`[DEBUG] callLLMWithJSON(${phase}): ${content.slice(0, 500).replace(/\n/g, '\\n')}`);

  let parsed = tryParseJSON<T>(content);
  if (parsed === null) {
    parsed = extractAndParseJSON<T>(content);
  }

  if (parsed === null) {
    throw new Error(`JSON parse failed from LLM response:\n${content.slice(0, 500)}`);
  }

  // Normalize snake_case keys to camelCase (DeepSeek often returns snake_case)
  // IMPORTANT: preserve arrays as arrays, don't convert numeric indices to strings
  const normalized = normalizeKeys(parsed);

  return { data: normalized as T, response };
}

/**
 * Recursively convert snake_case keys to camelCase
 */
function normalizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = normalizeKeys(value);
    }
    return result;
  }
  return obj;
}

/**
 * 调用 Embedding 模型
 */
export async function callEmbedding(
  texts: string[],
  model = 'deepseek-embedding',
  session?: LLMSession,
  phase?: string
): Promise<{ embeddings: number[][]; usage: LLMTokenUsage; cost: number }> {
  const startTime = Date.now();

  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const response = await fetch('https://api.deepseek.com/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errorText}`);
  }

  const raw = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage: { prompt_tokens: number; total_tokens: number };
  };

  const durationMs = Date.now() - startTime;
  const usage: LLMTokenUsage = {
    promptTokens: raw.usage.prompt_tokens,
    completionTokens: 0,
    totalTokens: raw.usage.total_tokens,
  };
  const cost = calculateCost(model, usage);

  if (session) {
    session.recordCall(model, usage, cost, durationMs, phase ?? 'embedding');
  }

  return {
    embeddings: raw.data.map((d) => d.embedding),
    usage,
    cost,
  };
}

// =============================================================================
// JSON Parsing Utilities
// =============================================================================

function tryParseJSON<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return tryWrapAndParse(content) as T | null;
  }
}

function tryWrapAndParse(content: string): unknown {
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ }
  }
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch { /* continue */ }
  }
  return null;
}

function extractAndParseJSON<T>(content: string): T | null {
  // Strategy 1: markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) as T; } catch { /* continue */ }
  }

  // Strategy 2: direct parse
  const direct = tryParseJSON<T>(content);
  if (direct !== null) return direct;

  // Strategy 3: array suffix
  const arraySuffix = content.match(/\][\s\S]*$/);
  if (arraySuffix) {
    try { return JSON.parse(content.replace(arraySuffix[0], ']')) as T; } catch { /* continue */ }
  }

  return null;
}

/**
 * Cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
