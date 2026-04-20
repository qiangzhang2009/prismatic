// ============================================
// Hermes Data Reader — lib/hermes.ts
// Reads Hermes runtime data from ~/.hermes/
// ============================================
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Default Hermes data directory
const HERMES_DIR = join(homedir(), '.hermes');

// ============================================
// Types
// ============================================
export interface HermesSession {
  session_id: string;
  model: string;
  base_url: string;
  platform: string;
  session_start: string;
  last_updated: string;
  system_prompt: string;
  tools: unknown;
  message_count: number;
}

export interface HermesMessage {
  role: string;
  content: string | null;
  timestamp: string;
  reasoning?: string | null;
  finish_reason?: string | null;
  tool_calls?: unknown[] | null;
  tool_name?: string | null;
}

export interface SessionMeta {
  session_key: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  platform: string;
  chat_type: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  last_prompt_tokens: number;
  estimated_cost_usd: number;
  cost_status: string;
  memory_flushed: boolean;
  suspended: boolean;
  message_count?: number;
  origin: {
    platform: string;
    chat_id: string;
    chat_name: string | null;
    chat_type: string;
    user_id: string;
    user_name: string;
    thread_id: string | null;
    chat_topic: string | null;
  };
}

export interface GatewayPlatform {
  state: string;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
}

export interface GatewayState {
  pid: number;
  kind: string;
  gateway_state: string;
  restart_requested: boolean;
  active_agents: number;
  platforms: Record<string, GatewayPlatform>;
  updated_at: string;
}

export interface ChannelEntry {
  id: string;
  name: string;
  type: string;
  thread_id: string | null;
}

export interface ChannelDirectory {
  updated_at: string;
  platforms: Record<string, ChannelEntry[]>;
}

export interface HermesStats {
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  estimatedCostUsd: number;
  activePlatforms: string[];
  connectedPlatforms: string[];
  disconnectedPlatforms: string[];
  sessions: SessionMeta[];
  lastActivity: string | null;
}

// ============================================
// Safe JSON reader
// ============================================
function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

// ============================================
// Raw Data Readers
// ============================================

/** Read all session metadata from sessions.json, enriched with full session data */
export function readSessionsMeta(): SessionMeta[] {
  const sessionsJson = safeReadJson<Record<string, SessionMeta>>(
    join(HERMES_DIR, 'sessions', 'sessions.json'),
    {},
  );

  return Object.values(sessionsJson)
    .map((meta) => {
      // Enrich with full session data for token counts and message count
      const full = safeReadJson<{
        message_count?: number;
        input_tokens?: number;
        output_tokens?: number;
        cache_read_tokens?: number;
      } | null>(join(HERMES_DIR, 'sessions', `session_${meta.session_id}.json`), null);

      if (full) {
        return {
          ...meta,
          message_count: full.message_count ?? meta.message_count,
          input_tokens: full.input_tokens ?? meta.input_tokens,
          output_tokens: full.output_tokens ?? meta.output_tokens,
          cache_read_tokens: full.cache_read_tokens ?? meta.cache_read_tokens,
        };
      }
      return meta;
    })
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
}

/** Read full session data (system prompt, message count, etc.) */
export function readSessionFull(
  sessionId: string,
): HermesSession | null {
  return safeReadJson<HermesSession | null>(
    join(HERMES_DIR, 'sessions', `session_${sessionId}.json`),
    null,
  );
}

/** Read messages from a session JSONL file */
export function readSessionMessages(
  sessionId: string,
): HermesMessage[] {
  try {
    const content = readFileSync(
      join(HERMES_DIR, 'sessions', `${sessionId}.jsonl`),
      'utf-8',
    );
    return content
      .trim()
      .split('\n')
      .map((line) => {
        try {
          return JSON.parse(line) as HermesMessage;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as HermesMessage[];
  } catch {
    return [];
  }
}

/** Read all sessions with their messages */
export function readAllSessionsWithMessages(): Array<{
  meta: SessionMeta;
  full: HermesSession;
  messages: HermesMessage[];
}> {
  const metas = readSessionsMeta();
  return metas
    .map((meta) => {
      const full = readSessionFull(meta.session_id);
      const messages = readSessionMessages(meta.session_id);
      return full ? { meta, full, messages } : null;
    })
    .filter(Boolean) as Array<{
    meta: SessionMeta;
    full: HermesSession;
    messages: HermesMessage[];
  }>;
}

export function readGatewayState(): GatewayState | null {
  return safeReadJson<GatewayState | null>(
    join(HERMES_DIR, 'gateway_state.json'),
    null,
  );
}

export function readChannelDirectory(): ChannelDirectory | null {
  return safeReadJson<ChannelDirectory>(
    join(HERMES_DIR, 'channel_directory.json'),
    { updated_at: '', platforms: {} },
  );
}

export function readConfig(): Record<string, unknown> | null {
  // config.yaml is not JSON, return null for now
  // Could parse with yaml package if needed
  return null;
}

export function readPersonality(): { name: string; content: string } | null {
  const soulPath = join(HERMES_DIR, 'SOUL.md');
  if (!existsSync(soulPath)) return null;
  try {
    const content = readFileSync(soulPath, 'utf-8');
    const nameMatch = content.match(/^#\s*(.+)/m);
    return {
      name: nameMatch ? nameMatch[1].trim() : 'Hermes',
      content,
    };
  } catch {
    return null;
  }
}

export function readSkills(): string[] {
  const skillsDir = join(HERMES_DIR, 'skills');
  if (!existsSync(skillsDir)) return [];
  try {
    return readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

export function readCronJobs(): Array<{
  name: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  enabled: boolean;
}> {
  const cronDir = join(HERMES_DIR, 'cron');
  if (!existsSync(cronDir)) return [];
  try {
    const files = readdirSync(cronDir).filter((f) => f.endsWith('.json'));
    return files.map((file) => {
      const fileName = file.replace('.json', '');
      const data = safeReadJson<{
        schedule: string;
        lastRun: string | null;
        nextRun: string | null;
        enabled: boolean;
      }>(join(cronDir, file), {
        schedule: '',
        lastRun: null,
        nextRun: null,
        enabled: false,
      });
      return { name: fileName, ...data };
    });
  } catch {
    return [];
  }
}

export function readSessionLogs(): Array<{
  id: string;
  sessionId: string;
  size: number;
  mtime: number;
}> {
  const sessionsDir = join(HERMES_DIR, 'sessions');
  if (!existsSync(sessionsDir)) return [];

  try {
    const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
    return files
      .map((file) => {
        const stat = statSync(join(sessionsDir, file));
        return {
          id: file,
          sessionId: file.replace(/\.json$/, ''),
          size: stat.size,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

// ============================================
// Computed Stats
// ============================================
export function computeStats(): HermesStats {
  const sessions = readSessionsMeta();
  const gateway = readGatewayState();

  const activePlatforms = gateway
    ? Object.keys(gateway.platforms)
    : [];
  const connectedPlatforms = gateway
    ? Object.entries(gateway.platforms)
        .filter(([, p]) => p.state === 'connected')
        .map(([name]) => name)
    : [];
  const disconnectedPlatforms = gateway
    ? Object.entries(gateway.platforms)
        .filter(([, p]) => p.state !== 'connected')
        .map(([name]) => name)
    : [];

  const totalInputTokens = sessions.reduce(
    (sum, s) => sum + (s.input_tokens || 0),
    0,
  );
  const totalOutputTokens = sessions.reduce(
    (sum, s) => sum + (s.output_tokens || 0),
    0,
  );
  const totalCacheReadTokens = sessions.reduce(
    (sum, s) => sum + (s.cache_read_tokens || 0),
    0,
  );
  const totalMessages = sessions.reduce(
    (sum, s) => sum + (s.message_count || 0),
    0,
  );
  const estimatedCostUsd = sessions.reduce(
    (sum, s) => sum + (s.estimated_cost_usd || 0),
    0,
  );

  const lastActivity =
    sessions.length > 0
      ? sessions[0].updated_at
      : null;

  return {
    totalSessions: sessions.length,
    totalMessages,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    estimatedCostUsd,
    activePlatforms,
    connectedPlatforms,
    disconnectedPlatforms,
    sessions,
    lastActivity,
  };
}

// ============================================
// Utilities
// ============================================
export function isHermesAvailable(): boolean {
  return existsSync(HERMES_DIR);
}

export function getHermesPath(): string {
  return HERMES_DIR;
}

export function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
