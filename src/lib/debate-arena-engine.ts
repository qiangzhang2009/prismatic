/**
 * Prismatic — Debate Arena Engine
 * 智辩场辩论引擎
 *
 * 设计原则：
 * - 每天自动选取安全话题
 * - 三位值班人物进行多轮辩论
 * - 辩论内容持久化存储
 * - 实时围观计数
 * - 完全合规：无政治/暴力/色情话题
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getTodayGuardians } from '@/lib/guardian';
import { getPersonasByIds } from '@/lib/personas';
import { createLLMProvider } from '@/lib/llm';
import {
  DEBATE_SAFE_TOPICS,
  DEBATE_BANNED_KEYWORDS,
  DAILY_LIMITS,
} from '@/lib/constants';

// Module-level singleton
let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set');
    _sql = neon(connectionString) as NeonQueryFunction<false, false>;
  }
  return _sql;
}

/** Executes a sql query, returning [] if the table doesn't exist yet. */
async function safeQuery<T>(fn: (s: NeonQueryFunction<false, false>) => Promise<T>): Promise<T> {
  try {
    return await fn(getSql());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || (msg.includes('relation') && msg.includes('does not exist'))) {
      return [] as unknown as T;
    }
    throw err;
  }
}

/** Checks if a table exists. Returns false on any database error. */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1 FROM ${sql.unsafe(tableName)} LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Ensures a required table exists, throwing a clear error if not. */
async function requireTable(tableName: string): Promise<void> {
  const exists = await tableExists(tableName);
  if (!exists) {
    throw new Error(`Required table "${tableName}" does not exist`);
  }
}

/** Executes a sql mutation (INSERT/UPDATE), swallowing all errors silently. */
async function safeQueryVoid(fn: (s: NeonQueryFunction<false, false>) => Promise<unknown>): Promise<void> {
  try {
    await fn(getSql());
  } catch {
    // silently swallow all errors
  }
}

function getLLMType(): 'deepseek' | 'openai' | 'anthropic' {
  const p = process.env.LLM_PROVIDER;
  if (p === 'openai') return 'openai';
  if (p === 'anthropic') return 'anthropic';
  return 'deepseek';
}

function getModelName(): string {
  const p = process.env.LLM_PROVIDER;
  if (p === 'openai') return 'gpt-4o';
  if (p === 'anthropic') return 'claude-sonnet-4-20250514';
  return 'deepseek-chat';
}

// ─── Content Safety ─────────────────────────────────────────────────────────────

function isTopicSafe(topic: string): boolean {
  const lower = topic.toLowerCase();
  for (const keyword of DEBATE_BANNED_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function pickDailyTopic(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const safeTopics = DEBATE_SAFE_TOPICS.filter(isTopicSafe);
  const index = dayOfYear % safeTopics.length;
  return safeTopics[index] ?? 'AI 会取代大部分人类工作吗？';
}

// ─── Debate Turn Types ─────────────────────────────────────────────────────────

export interface DebateTurn {
  debateId: number;
  round: number;
  speakerId: string;
  speakerName: string;
  content: string;
  tone: 'opening' | 'provocative' | 'supportive' | 'questioning' | 'synthesizing';
  reactionToId?: number;
  createdAt: string;
}

export interface DebateRecord {
  id: number;
  date: string;
  topic: string;
  topicSource: string;
  status: 'scheduled' | 'running' | 'completed';
  participantIds: string[];
  roundCount: number;
  viewCount: number;
  liveViewers: number;
  startedAt: string | null;
  completedAt: string | null;
  turns: DebateTurn[];
}

// ─── Database Operations ────────────────────────────────────────────────────────

export async function createDebate(
  topic: string,
  participantIds: string[],
  topicSource: 'auto' | 'manual' | 'user_suggested' = 'auto'
): Promise<number> {
  // Pre-check: require the table to exist so we get a clear error instead of silent 0
  await requireTable('prismatic_forum_debates');

  const today = new Date().toISOString().slice(0, 10);
  const sql = getSql();

  // Check if debate already exists for today — return existing ID instead of throwing
  const existing = await sql`
    SELECT id FROM prismatic_forum_debates WHERE date = ${today} LIMIT 1
  `;
  if (existing.length > 0) {
    return (existing[0] as any).id;
  }

  const rows = await sql`
    INSERT INTO prismatic_forum_debates (date, topic, topic_source, status, participant_ids, round_count)
    VALUES (${today}, ${topic}, ${topicSource}, ${'scheduled'}, ${participantIds}, ${3})
    RETURNING id
  `;
  return (rows as any[])?.[0]?.id ?? 0;
}

export async function updateDebateStatus(
  debateId: number,
  status: 'scheduled' | 'running' | 'completed'
): Promise<void> {
  await requireTable('prismatic_forum_debates');
  const now = new Date().toISOString();
  const sql = getSql();

  if (status === 'running') {
    await sql`UPDATE prismatic_forum_debates SET status = ${status}, started_at = ${now} WHERE id = ${debateId}`;
  } else if (status === 'completed') {
    await sql`UPDATE prismatic_forum_debates SET status = ${status}, completed_at = ${now} WHERE id = ${debateId}`;
  } else {
    await sql`UPDATE prismatic_forum_debates SET status = ${status} WHERE id = ${debateId}`;
  }
}

export async function recordDebateTurn(
  debateId: number,
  round: number,
  speakerId: string,
  content: string,
  tone: string,
  reactionToId?: number
): Promise<number> {
  await requireTable('prismatic_forum_debate_turns');
  const sql = getSql();
  const rows = await sql`
    INSERT INTO prismatic_forum_debate_turns (debate_id, round, speaker_id, content, tone, reaction_to_id)
    VALUES (${debateId}, ${round}, ${speakerId}, ${content}, ${tone}, ${reactionToId ?? null})
    RETURNING id
  `;
  return (rows as any[])?.[0]?.id ?? 0;
}

export async function getDebateByDate(date?: string): Promise<DebateRecord | null> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const rows = await safeQuery((sql) => sql`
    SELECT * FROM prismatic_forum_debates
    WHERE date = ${targetDate}
    LIMIT 1
  `);

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0] as any;
  const turnRows = await safeQuery((sql) => sql`
    SELECT * FROM prismatic_forum_debate_turns
    WHERE debate_id = ${row.id}
    ORDER BY round ASC, id ASC
  `);

  const turns: DebateTurn[] = (turnRows as any[]).map((t) => ({
    debateId: row.id,
    round: t.round,
    speakerId: t.speaker_id,
    speakerName: '',
    content: t.content,
    tone: t.tone,
    reactionToId: t.reaction_to_id ?? undefined,
    createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
  }));

  return {
    id: row.id,
    date: row.date,
    topic: row.topic,
    topicSource: row.topic_source,
    status: row.status,
    participantIds: row.participant_ids ?? [],
    roundCount: row.round_count,
    viewCount: row.view_count,
    liveViewers: row.live_viewers ?? 0,
    startedAt: row.started_at ? (row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at)) : null,
    completedAt: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at)) : null,
    turns,
  };
}

export async function getDebateById(debateId: number): Promise<DebateRecord | null> {
  const rows = await safeQuery((sql) => sql`SELECT * FROM prismatic_forum_debates WHERE id = ${debateId}`);
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0] as any;
  const turnRows = await safeQuery((sql) => sql`
    SELECT * FROM prismatic_forum_debate_turns
    WHERE debate_id = ${row.id}
    ORDER BY round ASC, id ASC
  `);

  const personas = getPersonasByIds([...new Set((turnRows as any[]).map((t) => t.speaker_id))]);
  const personaMap = new Map(personas.map((p) => [p.id, p.nameZh]));

  const turns: DebateTurn[] = (turnRows as any[]).map((t) => ({
    debateId: row.id,
    round: t.round,
    speakerId: t.speaker_id,
    speakerName: personaMap.get(t.speaker_id) ?? t.speaker_id,
    content: t.content,
    tone: t.tone,
    reactionToId: t.reaction_to_id ?? undefined,
    createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
  }));

  return {
    id: row.id,
    date: row.date,
    topic: row.topic,
    topicSource: row.topic_source,
    status: row.status,
    participantIds: row.participant_ids ?? [],
    roundCount: row.round_count,
    viewCount: row.view_count,
    liveViewers: row.live_viewers ?? 0,
    startedAt: row.started_at ? (row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at)) : null,
    completedAt: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at)) : null,
    turns,
  };
}

export async function getRecentDebates(limit: number = 7): Promise<DebateRecord[]> {
  const rows = await safeQuery((sql) => sql`
    SELECT * FROM prismatic_forum_debates
    ORDER BY date DESC
    LIMIT ${limit}
  `);
  if (!Array.isArray(rows)) return [];

  const debates: DebateRecord[] = [];
  for (const row of rows as any[]) {
    const debate = await getDebateById(row.id);
    if (debate) debates.push(debate);
  }
  return debates;
}

export async function incrementDebateView(
  debateId: number,
  userId?: string,
  ipHash?: string
): Promise<void> {
  const sql = getSql();
  // Pre-check: ensure required tables exist
  await requireTable('prismatic_forum_debate_views');
  await requireTable('prismatic_forum_debates');

  // Record the view
  await sql`
    INSERT INTO prismatic_forum_debate_views (debate_id, user_id, ip_hash)
    VALUES (${debateId}, ${userId ?? null}, ${ipHash ?? null})
  `;

  // Increment total view count
  await sql`UPDATE prismatic_forum_debates SET view_count = view_count + 1 WHERE id = ${debateId}`;
}

export async function updateLiveViewers(debateId: number, count: number): Promise<void> {
  await requireTable('prismatic_forum_debates');
  const sql = getSql();
  await sql`UPDATE prismatic_forum_debates SET live_viewers = ${count} WHERE id = ${debateId}`;
}

export async function castVote(
  debateId: number,
  userId: string,
  personaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireTable('prismatic_forum_debate_votes');
    const sql = getSql();
    await sql`
      INSERT INTO prismatic_forum_debate_votes (debate_id, user_id, persona_id)
      VALUES (${debateId}, ${userId}, ${personaId})
      ON CONFLICT (debate_id, user_id)
      DO UPDATE SET persona_id = ${personaId}, created_at = NOW()
    `;
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getDebateVotes(debateId: number): Promise<Record<string, number>> {
  const rows = await safeQuery((sql) => sql`
    SELECT persona_id, COUNT(*) as count
    FROM prismatic_forum_debate_votes
    WHERE debate_id = ${debateId}
    GROUP BY persona_id
  `);
  if (!Array.isArray(rows)) return {};
  const result: Record<string, number> = {};
  for (const row of rows as any[]) {
    result[row.persona_id] = Number(row.count);
  }
  return result;
}

export async function submitTopicSuggestion(
  topic: string,
  suggestedBy?: string
): Promise<{ success: boolean; id?: number }> {
  if (!isTopicSafe(topic)) {
    return { success: false };
  }
  await requireTable('prismatic_forum_topic_suggestions');
  const sql = getSql();
  const rows = await sql`
    INSERT INTO prismatic_forum_topic_suggestions (topic, suggested_by)
    VALUES (${topic}, ${suggestedBy ?? null})
    RETURNING id
  `;
  const insertedId = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).id : undefined;
  return { success: true, id: insertedId };
}

// ─── LLM Debate Generation ─────────────────────────────────────────────────────

async function generateRound(
  llm: ReturnType<typeof createLLMProvider>,
  model: string,
  round: number,
  speakers: any[],
  topic: string,
  priorTurns: Array<{ speakerId: string; speakerName: string; content: string; tone: string }>,
  isOpening: boolean
): Promise<Array<{ speakerId: string; speakerName: string; content: string; tone: string }>> {
  if (isOpening) {
    const speakerList = speakers
      .map((p) => `【${p.nameZh}】${p.identityPrompt}（擅长：${(p.strengths ?? []).slice(0, 2).join('、')}）`)
      .join('\n');

    const result = await llm.chat({
      model,
      messages: [
        {
          role: 'system',
          content: `你是辩论主持大师。今天三位思想家就以下话题展开辩论：

【话题】${topic}

请以各自风格发表开场陈述，每人一句话（100字以内），格式：
**【人物名】**: 发言内容

三人都发言后，另起一行写【立场分配】：给每人一个立场标签（支持/质疑/中立），便于观众理解。`,
        },
        { role: 'user', content: '请生成开场陈述。' },
      ],
      temperature: 0.8,
      maxTokens: 600,
    });

    const content = result.content.trim();
    const speakerRegex = /^\*\*(.+?)\*\*[:：]\s*(.+)$/gm;
    const turns: Array<{ speakerId: string; speakerName: string; content: string; tone: string }> = [];
    let match;

    while ((match = speakerRegex.exec(content)) !== null) {
      const name = match[1].trim();
      const text = match[2].trim();
      const speaker = speakers.find(
        (p) => p.nameZh.includes(name) || name.includes(p.nameZh)
      ) ?? speakers[turns.length % speakers.length];

      turns.push({
        speakerId: speaker.id,
        speakerName: speaker.nameZh,
        content: text,
        tone: 'opening',
      });
    }

    // Fallback if parsing fails
    if (turns.length === 0) {
      for (const speaker of speakers) {
        turns.push({
          speakerId: speaker.id,
          speakerName: speaker.nameZh,
          content: content.slice(0, 100),
          tone: 'opening',
        });
      }
    }

    return turns;
  }

  // Round 2+: Response rounds
  const priorText = priorTurns
    .map((t) => `[${t.speakerName}]: ${t.content}`)
    .join('\n\n');

  const lastSpeakerId = priorTurns[priorTurns.length - 1]?.speakerId;
  const nextSpeaker = speakers.find((p) => p.id !== lastSpeakerId) ?? speakers[0];

  const toneOptions = ['provocative', 'questioning', 'supportive', 'synthesizing'];
  const tone = toneOptions[round % toneOptions.length];

  const prompt = `【话题】${topic}

前几轮发言：
${priorText}

现在轮到【${nextSpeaker.nameZh}】发言。

要求：
- 用【${nextSpeaker.nameZh}】的视角和思维方式回应
- ${tone === 'provocative' ? '提出质疑或不同意见' : tone === 'questioning' ? '提出追问或挑战假设' : tone === 'supportive' ? '补充或支持某个观点' : '综合各方观点并提炼'}
- 80-120字以内，第一人称，像【${nextSpeaker.nameZh}】真正在说话
- 不要说"我认为xxx"，直接说你的观点`;

  const result = await llm.chat({
    model,
    messages: [
      {
        role: 'system',
        content: `${nextSpeaker.systemPromptTemplate}\n\n你是【${nextSpeaker.nameZh}】。${nextSpeaker.identityPrompt}`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.75,
    maxTokens: 300,
  });

  return [
    {
      speakerId: nextSpeaker.id,
      speakerName: nextSpeaker.nameZh,
      content: result.content.trim().slice(0, 300),
      tone,
    },
  ];
}

async function generateClosingStatement(
  llm: ReturnType<typeof createLLMProvider>,
  model: string,
  speakers: any[],
  topic: string,
  allTurns: Array<{ speakerId: string; speakerName: string; content: string; tone: string }>
): Promise<{ speakerId: string; speakerName: string; content: string; tone: string }> {
  const debateHistory = allTurns
    .map((t) => `[${t.speakerName}]: ${t.content}`)
    .join('\n\n');

  const moderatorResult = await llm.chat({
    model,
    messages: [
      {
        role: 'system',
        content: '你是辩论主持大师。请对今天的辩论进行收尾总结。',
      },
      {
        role: 'user',
        content: `【话题】${topic}

辩论全程：
${debateHistory}

请写一段50字以内的总结，格式：**【总结】**: 总结内容

然后请给每个思想家一个简短的"辩论亮点"标签（10字以内），格式：
• 【人物名】: 亮点标签`,
      },
    ],
    temperature: 0.5,
    maxTokens: 300,
  });

  const closingContent = moderatorResult.content.trim();

  return {
    speakerId: 'moderator',
    speakerName: '辩论主持人',
    content: closingContent,
    tone: 'synthesizing',
  };
}

// ─── Main Engine Entry ─────────────────────────────────────────────────────────

/**
 * 运行每日辩论（主入口）
 * 每天调用一次，由外部定时器触发（如 Vercel Cron 或 API route）
 */
export async function runDailyDebate(
  manualTopic?: string
): Promise<{ success: boolean; debateId?: number; topic?: string; error?: string }> {
  try {
    const guardians = await getTodayGuardians();
    if (guardians.length === 0) {
      return { success: false, error: '今日没有值班人物' };
    }

    const topic = manualTopic ?? pickDailyTopic();
    if (!isTopicSafe(topic)) {
      return { success: false, error: '话题未通过安全审核' };
    }

    const personaIds = guardians.map((g) => g.personaId);
    const personas = getPersonasByIds(personaIds);

    const debateId = await createDebate(topic, personaIds);
    await updateDebateStatus(debateId, 'running');

    const llm = createLLMProvider(getLLMType());
    const model = getModelName();

    // Round 1: Opening statements
    const openingTurns = await generateRound(llm, model, 1, personas, topic, [], true);
    for (const turn of openingTurns) {
      await recordDebateTurn(debateId, 1, turn.speakerId, turn.content, turn.tone);
    }

    // Rounds 2-3: Exchanges
    const allTurns = [...openingTurns];
    for (let round = 2; round <= 3; round++) {
      const roundTurns = await generateRound(
        llm,
        model,
        round,
        personas,
        topic,
        allTurns,
        false
      );
      for (const turn of roundTurns) {
        await recordDebateTurn(debateId, round, turn.speakerId, turn.content, turn.tone);
      }
      allTurns.push(...roundTurns);
    }

    // Closing: Moderator summary
    const closing = await generateClosingStatement(llm, model, personas, topic, allTurns);
    await recordDebateTurn(debateId, 4, closing.speakerId, closing.content, closing.tone);

    await updateDebateStatus(debateId, 'completed');

    console.log(`[Debate Arena] Daily debate completed: #${debateId} — ${topic}`);
    return { success: true, debateId, topic };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Debate Arena] Error running daily debate:', message);
    return { success: false, error: message };
  }
}

/**
 * 启动已创建的辩论（scheduled → running）
 * 由管理员手动触发，用于控制辩论节奏
 */
export async function startScheduledDebate(
  debateId: number
): Promise<{ success: boolean; error?: string }> {
  const rows = await safeQuery((sql) => sql`SELECT * FROM prismatic_forum_debates WHERE id = ${debateId}`) as any[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: '辩论不存在' };
  }

  const debate = rows[0] as any;
  if (debate.status !== 'scheduled') {
    return { success: false, error: `辩论状态为 "${debate.status}"，无法启动` };
  }

  const personaIds: string[] = debate.participant_ids ?? [];
  if (personaIds.length === 0) {
    return { success: false, error: '辩论没有参与者' };
  }

  try {
    await updateDebateStatus(debateId, 'running');

    const personas = getPersonasByIds(personaIds);
    const llm = createLLMProvider(getLLMType());
    const model = getModelName();
    const topic = debate.topic;

    // Round 1: Opening statements
    const openingTurns = await generateRound(llm, model, 1, personas, topic, [], true);
    for (const turn of openingTurns) {
      await recordDebateTurn(debateId, 1, turn.speakerId, turn.content, turn.tone);
    }

    // Rounds 2-3: Exchanges
    const allTurns = [...openingTurns];
    for (let round = 2; round <= 3; round++) {
      const roundTurns = await generateRound(
        llm,
        model,
        round,
        personas,
        topic,
        allTurns,
        false
      );
      for (const turn of roundTurns) {
        await recordDebateTurn(debateId, round, turn.speakerId, turn.content, turn.tone);
      }
      allTurns.push(...roundTurns);
    }

    // Closing: Moderator summary
    const closing = await generateClosingStatement(llm, model, personas, topic, allTurns);
    await recordDebateTurn(debateId, 4, closing.speakerId, closing.content, closing.tone);

    await updateDebateStatus(debateId, 'completed');

    console.log(`[Debate Arena] Admin started scheduled debate #${debateId}: ${topic}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Debate Arena] Error starting scheduled debate:', message);
    // Revert to scheduled status on failure
    await updateDebateStatus(debateId, 'scheduled');
    return { success: false, error: message };
  }
}

/**
 * 快速预览：为今天的辩论生成摘要（不保存，用于预览）
 */
export async function previewTodaysDebate(): Promise<{
  topic: string;
  guardians: Array<{ personaId: string; personaNameZh: string }>;
  estimatedTurns: number;
  estimatedStartTime: string;
  highlights: string[];
  conflicts: string[];
}> {
  const guardians = await getTodayGuardians();
  const topic = pickDailyTopic();

  // 基于话题生成亮点和矛盾点
  const highlights = generateDebateHighlights(topic, guardians.map(g => g.personaNameZh));
  const conflicts = generateDebateConflicts(topic, guardians.map(g => g.personaNameZh));

  // 估算开始时间（每天固定时间或随机）
  const now = new Date();
  const hour = now.getHours();
  let estimatedStartTime: string;
  if (hour < 12) {
    estimatedStartTime = '今日 14:00';
  } else if (hour < 18) {
    estimatedStartTime = '今日 20:00';
  } else if (hour < 21) {
    estimatedStartTime = '今日 21:00';
  } else {
    estimatedStartTime = '即将开始';
  }

  return {
    topic,
    guardians: guardians.map((g) => ({
      personaId: g.personaId,
      personaNameZh: g.personaNameZh,
    })),
    estimatedTurns: guardians.length * 3 + 1,
    estimatedStartTime,
    highlights,
    conflicts,
  };
}

/** 基于话题和人物生成辩论亮点标签 */
function generateDebateHighlights(
  topic: string,
  guardianNames: string[]
): string[] {
  const lower = topic.toLowerCase();
  const highlights: string[] = [];

  if (lower.includes('ai') || lower.includes('人工智能') || lower.includes('chatgpt') || lower.includes('llm')) {
    highlights.push('🤖 AI 技术前沿');
  }
  if (lower.includes('工作') || lower.includes('就业') || lower.includes('职业')) {
    highlights.push('💼 未来就业格局');
  }
  if (lower.includes('教育') || lower.includes('学习') || lower.includes('学校')) {
    highlights.push('📚 教育变革方向');
  }
  if (lower.includes('投资') || lower.includes('理财') || lower.includes('股票') || lower.includes('比特币') || lower.includes('crypto')) {
    highlights.push('📈 投资智慧碰撞');
  }
  if (lower.includes('创业') || lower.includes('创新') || lower.includes('商业')) {
    highlights.push('🚀 创业思维交锋');
  }
  if (lower.includes('哲学') || lower.includes('人生') || lower.includes('意义') || lower.includes('幸福')) {
    highlights.push('🧠 人生智慧对话');
  }
  if (lower.includes('科技') || lower.includes('未来') || lower.includes('人类')) {
    highlights.push('🔮 科技与人类命运');
  }
  if (lower.includes('经济') || lower.includes('中美') || lower.includes('全球') || lower.includes('贸易')) {
    highlights.push('🌍 世界格局洞察');
  }

  if (highlights.length === 0) {
    highlights.push('💡 多元视角碰撞');
  }

  // 加入人物特色
  if (guardianNames.length >= 2) {
    highlights.push(`👥 ${guardianNames.slice(0, 2).join(' × ')}`);
  }

  return highlights.slice(0, 4);
}

/** 基于话题生成矛盾冲突标签 */
function generateDebateConflicts(
  topic: string,
  guardianNames: string[]
): string[] {
  const lower = topic.toLowerCase();
  const conflicts: string[] = [];

  if (lower.includes('ai') || lower.includes('人工智能')) {
    conflicts.push('乐观派 vs 悲观派：技术进步是福祉还是威胁？');
    conflicts.push('短期冲击 vs 长期红利：谁在为转型买单？');
  }
  if (lower.includes('工作') || lower.includes('就业')) {
    conflicts.push('效率优先 vs 公平优先：社会该如何应对？');
  }
  if (lower.includes('投资') || lower.includes('理财') || lower.includes('比特币')) {
    conflicts.push('价值投资 vs 趋势投机：谁才是真正的智慧？');
    conflicts.push('风险爱好者 vs 风险厌恶者：财富的本质是什么？');
  }
  if (lower.includes('创业')) {
    conflicts.push('精益创业 vs 宏大愿景：哪种路径更可能成功？');
  }
  if (lower.includes('教育') || lower.includes('学习')) {
    conflicts.push('传统教育 vs AI 自学：什么能力真正不可替代？');
  }
  if (lower.includes('哲学') || lower.includes('人生') || lower.includes('意义')) {
    conflicts.push('存在主义 vs 斯多葛主义：如何面对不确定的世界？');
  }

  if (conflicts.length === 0) {
    conflicts.push('理想主义 vs 现实主义：谁更能洞察本质？');
    conflicts.push('长期主义 vs 短期主义：哪个策略更明智？');
  }

  return conflicts.slice(0, 3);
}
