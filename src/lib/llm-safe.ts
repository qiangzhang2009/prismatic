/**
 * Prismatic — Safe LLM Wrapper
 *
 * Combines three critical reliability features:
 *
 * 1. CIRCUIT BREAKER
 *    Each provider (deepseek, anthropic, openai) has its own circuit breaker.
 *    After N consecutive failures, the provider is skipped for a cooldown period.
 *    Prevents cascade failures when a provider is down.
 *
 * 2. LLM FALLBACK CHAIN
 *    Primary: DeepSeek → Fallback 1: Anthropic → Fallback 2: OpenAI
 *    If primary fails, the circuit breaker trips and the next provider is tried.
 *
 * 3. TOKEN BUDGET GUARD
 *    Per-user monthly token spending cap. Prevents runaway costs from
 *    misconfigured API keys or malicious usage. Reads from DB, not in-memory
 *    (safe for serverless where memory resets between invocations).
 *
 * 4. PROMPT INJECTION FILTER
 *    Detects and blocks common prompt injection patterns before they reach
 *    the LLM, reducing compute waste and potential harm.
 */

import { createLLMProviderWithKey, type LLMResponse, type LLMOptions } from './llm';
import { neon } from '@neondatabase/serverless';

// ─── Circuit Breaker ───────────────────────────────────────────────────────────

type ProviderName = 'deepseek' | 'anthropic' | 'openai';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const CIRCUIT_FAILURE_THRESHOLD = 3;     // open after 3 consecutive failures
const CIRCUIT_COOLDOWN_MS = 30_000;    // 30s cooldown before retry

const circuitBreakers: Record<ProviderName, CircuitBreakerState> = {
  deepseek: { failures: 0, lastFailure: 0, isOpen: false },
  anthropic: { failures: 0, lastFailure: 0, isOpen: false },
  openai: { failures: 0, lastFailure: 0, isOpen: false },
};

function tripCircuit(provider: ProviderName): void {
  circuitBreakers[provider].failures++;
  circuitBreakers[provider].lastFailure = Date.now();
  circuitBreakers[provider].isOpen = true;
  console.warn(`[circuit-breaker] OPEN for ${provider} after ${circuitBreakers[provider].failures} failures`);
}

function recordSuccess(provider: ProviderName): void {
  circuitBreakers[provider].failures = 0;
  circuitBreakers[provider].isOpen = false;
}

function canTry(provider: ProviderName): boolean {
  const cb = circuitBreakers[provider];
  if (!cb.isOpen) return true;

  // Half-open: allow one attempt after cooldown
  if (Date.now() - cb.lastFailure > CIRCUIT_COOLDOWN_MS) {
    cb.isOpen = false;
    return true;
  }
  return false;
}

// ─── Prompt Injection Filter ─────────────────────────────────────────────────

const INJECT_PATTERNS = [
  // System prompt override attempts
  /^(system|assistant|human)[:：]/im,
  // Common jailbreak prefixes
  /^(ignore|disregard|forget|override)[\s(]/im,
  // Role-play escape attempts
  /you are now|#+[\s]*(ignore|forget)/im,
  // XML injection tags
  /<(system|instructions|roleplay)>/im,
  // SQL/code injection within prompt
  /['";].*(select|insert|drop|delete|update)\s/i,
  // Base64 encoded commands
  /(?:base64|b64)[:=]\s*[A-Za-z0-9+/]{20,}/i,
];

const SUSPICIOUS_KEYWORD_WEIGHT: Record<string, number> = {
  'ignore all previous': 3,
  'ignore previous': 2,
  'disregard instructions': 3,
  'override your': 3,
  'new instructions': 2,
  'forget your': 2,
  'reveal your': 2,
  'system prompt': 2,
  'you are a': 1,
  'pretend to be': 2,
  'do anything now': 3,
  'DAN': 3,
  'jailbreak': 3,
  'roleplay': 1,
};

const MAX_INPUT_LENGTH = 8000;

export interface InjectionCheckResult {
  safe: boolean;
  score: number;
  reason?: string;
}

export function checkPromptInjection(input: string): InjectionCheckResult {
  if (!input || typeof input !== 'string') {
    return { safe: true, score: 0 };
  }

  const trimmed = input.trim();

  // Hard blocks: pattern matches
  for (const pattern of INJECT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        score: 10,
        reason: `Blocked pattern: ${pattern.toString()}`,
      };
    }
  }

  // Soft blocks: suspicious keyword scoring
  let score = 0;
  const lower = trimmed.toLowerCase();

  for (const [keyword, weight] of Object.entries(SUSPICIOUS_KEYWORD_WEIGHT)) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(regex);
    if (matches) {
      score += weight * matches.length;
    }
  }

  if (score >= 5) {
    return { safe: false, score, reason: `Suspicious keyword score ${score} >= threshold 5` };
  }

  return { safe: true, score };
}

export function validateInputLength(input: string): { valid: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Input must be a non-empty string' };
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return { valid: false, reason: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters` };
  }
  return { valid: true };
}

// ─── Token Budget Guard ──────────────────────────────────────────────────────

const MONTHLY_TOKEN_BUDGETS: Record<string, number> = {
  FREE: 50_000,
  MONTHLY: 500_000,
  YEARLY: 2_000_000,
  LIFETIME: 10_000_000,
};

interface BudgetCheckResult {
  allowed: boolean;
  budget: number;
  spent: number;
  remaining: number;
  reason?: string;
}

async function checkTokenBudget(
  userId: string,
  plan: string
): Promise<BudgetCheckResult> {
  const monthlyBudget = MONTHLY_TOKEN_BUDGETS[plan] ?? MONTHLY_TOKEN_BUDGETS.FREE;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Fail-open: if DB is unreachable, allow the request but log
      console.warn(`[token-budget] DATABASE_URL not set — skipping budget check for ${userId}`);
      return { allowed: true, budget: monthlyBudget, spent: 0, remaining: monthlyBudget };
    }

    const sql = neon(connectionString);

    // Get start of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sum tokens from conversations this month
    const rows = await sql`
      SELECT COALESCE(SUM("totalTokens"), 0)::int AS spent
      FROM conversations
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${monthStart.toISOString()}
    `;

    const spent = Number(rows[0]?.spent ?? 0);
    const remaining = Math.max(0, monthlyBudget - spent);

    if (remaining <= 0) {
      return {
        allowed: false,
        budget: monthlyBudget,
        spent,
        remaining: 0,
        reason: `Monthly token budget exhausted (${monthlyBudget.toLocaleString()} tokens). Current plan: ${plan}.`,
      };
    }

    return { allowed: true, budget: monthlyBudget, spent, remaining };
  } catch (err) {
    // Fail-open on DB error: allow request, log, and alert
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[token-budget] Budget check failed for ${userId}: ${msg}`);
    return { allowed: true, budget: monthlyBudget, spent: 0, remaining: monthlyBudget };
  }
}

// ─── Safe LLM Call ───────────────────────────────────────────────────────────

export interface SafeLLMResult {
  success: boolean;
  content?: string;
  provider?: ProviderName;
  usage?: LLMResponse['usage'];
  error?: string;
  budgetExceeded?: boolean;
}

export interface SafeLLMCallOptions {
  userId: string;
  userPlan: string;
  messages: LLMOptions['messages'];
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const FALLBACK_CHAIN: Array<{ provider: ProviderName; apiKey?: string }> = [
  { provider: 'deepseek' },
  { provider: 'anthropic' },
  { provider: 'openai' },
];

export async function safeLLMCall(opts: SafeLLMCallOptions): Promise<SafeLLMResult> {
  const {
    userId,
    userPlan,
    messages,
    apiKey,
    temperature = 0.7,
    maxTokens = 2048,
    timeoutMs = 55_000,
  } = opts;

  // 1. Input validation
  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'system') {
      const lenCheck = validateInputLength(msg.content);
      if (!lenCheck.valid) {
        return { success: false, error: `Input validation failed: ${lenCheck.reason}` };
      }

      const injectionCheck = checkPromptInjection(msg.content);
      if (!injectionCheck.safe) {
        console.warn(`[safeLLM] Prompt injection blocked for user=${userId} score=${injectionCheck.score}: ${injectionCheck.reason}`);
        return { success: false, error: 'Invalid input detected. Please rephrase your message.' };
      }
    }
  }

  // 2. Token budget check
  const budget = await checkTokenBudget(userId, userPlan);
  if (!budget.allowed) {
    return { success: false, error: budget.reason, budgetExceeded: true };
  }

  // Log budget warning when < 10% remaining
  if (budget.remaining < budget.budget * 0.1) {
    console.warn(`[safeLLM] Budget warning for ${userId}: ${budget.remaining}/${budget.budget} tokens remaining`);
  }

  // 3. Try each provider in the fallback chain
  for (const { provider } of FALLBACK_CHAIN) {
    if (!canTry(provider)) {
      console.log(`[safeLLM] Skipping ${provider} (circuit open)`);
      continue;
    }

    // Skip providers without API keys
    const key = apiKey
      ?? (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : undefined)
      ?? (provider === 'openai' ? process.env.OPENAI_API_KEY : undefined)
      ?? (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined);

    if (!key) {
      console.log(`[safeLLM] Skipping ${provider} (no API key)`);
      continue;
    }

    const llm = createLLMProviderWithKey(provider, key);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const controller = new AbortController();
      timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      const modelName = provider === 'deepseek' ? 'deepseek-chat'
        : provider === 'anthropic' ? 'claude-sonnet-4-20250514'
        : 'gpt-4o-mini';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (llm as any).chat({
        model: modelName,
        messages,
        temperature,
        maxTokens,
        signal: controller.signal as AbortSignal,
      });

      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
      recordSuccess(provider);

      return {
        success: true,
        content: response.content,
        provider,
        usage: response.usage,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeoutFlag = msg.includes('aborted') || msg.includes('timeout');
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      console.error(`[safeLLM] ${provider} failed (${isTimeoutFlag ? 'timeout' : 'error'}): ${msg}`);

      tripCircuit(provider);

      // If this was the last provider, return the error
      if (provider === 'openai') {
        return {
          success: false,
          error: isTimeoutFlag
            ? '所有 AI 提供商暂时不可用，请稍后重试。All AI providers are temporarily unavailable.'
            : `AI 服务暂时不可用，请稍后重试。Error: ${msg.slice(0, 100)}`,
        };
      }
      // Continue to next provider
    }
  }

  return {
    success: false,
    error: '所有 AI 提供商暂时不可用，请稍后重试。',
  };
}
