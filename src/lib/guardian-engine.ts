/**
 * Prismatic — Guardian AI Engine
 * "守望者计划" — The Guardian AI System
 *
 * Logic:
 * - If a user @-mentions ANY persona → that persona replies at 100%, immediately,
 *   no daily limit, no guardian-rotation gate. The mention IS the gate.
 * - If no @mention → today's rotating guardians reply probabilistically (25-40%).
 *
 * This creates the "living world" feeling: @mentions get guaranteed responses,
 * and without mentions, guardians organically engage with interesting conversations.
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { prisma } from '@/lib/prisma';
import { getTodayGuardians, recordPersonaInteraction, buildPersonaInteractionPrompt } from '@/lib/guardian';
import { PERSONAS } from '@/lib/personas';
import { createLLMProvider } from '@/lib/llm';

/** Create a fresh Neon handle per call to avoid stale pool connections in Vercel serverless. */
function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  // eslint-disable-next-line
  return neon(connectionString) as NeonQueryFunction<false, false>;
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

// ─── Probability tables ───────────────────────────────────────────────────────
const PERSONA_RESPONSE_PROB: Record<string, number> = {
  'socrates': 0.40, 'elon-musk': 0.35, 'warren-buffett': 0.30,
  'richard-feynman': 0.35, 'steve-jobs': 0.25, 'marcus-aurelius': 0.30,
  'confucius': 0.35, 'charlie-munger': 0.25, 'nassim-taleb': 0.30,
  'naval-ravikant': 0.35, 'zhuang-zi': 0.30, 'lao-zi': 0.30,
};

const DEFAULT_DAILY_LIMIT = 65;

// ─── Daily limit ─────────────────────────────────────────────────────────────
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1 FROM ${sql.unsafe(tableName)} LIMIT 1`;
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || (msg.includes('relation') && msg.includes('does not exist'))) {
      return false;
    }
    throw err;
  }
}

async function requireTable(tableName: string): Promise<void> {
  const exists = await tableExists(tableName);
  if (!exists) {
    console.warn(`[GuardianEngine] Table "${tableName}" not found — guardian engine disabled`);
  }
}

async function checkPersonaDailyLimit(personaId: string): Promise<boolean> {
  try { await requireTable('prismatic_guardian_schedule'); } catch {}
  try { await requireTable('prismatic_guardian_stats'); } catch {}
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);
  const schedule = await sql`
    SELECT max_interactions FROM prismatic_guardian_schedule
    WHERE persona_id = ${personaId} AND date = ${today}
  `;
  const maxInteractions = schedule[0]?.max_interactions ?? DEFAULT_DAILY_LIMIT;
  const stats = await sql`
    SELECT interactions FROM prismatic_guardian_stats
    WHERE persona_id = ${personaId} AND date = ${today}
  `;
  const currentInteractions = stats[0]?.interactions ?? 0;
  return currentInteractions < maxInteractions;
}

async function incrementPersonaDailyInteractions(personaId: string): Promise<void> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO prismatic_guardian_stats (date, persona_id, interactions, comments_reviewed)
    VALUES (${today}, ${personaId}, 1, 1)
    ON CONFLICT (date, persona_id)
    DO UPDATE SET interactions = prismatic_guardian_stats.interactions + 1,
                  comments_reviewed = prismatic_guardian_stats.comments_reviewed + 1
  `;
}

// ─── LLM Generation ──────────────────────────────────────────────────────────

const LLM_TIMEOUT_MS = 25_000;

/** Low-level LLM call with retry, returns null on persistent failure. */
async function callLLM(
  prompt: string,
  userMessage: string,
  maxTokens = 400
): Promise<string | null> {
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const llmType = getLLMType();
      const modelName = getModelName();
      const llm = createLLMProvider(llmType);

      // Race LLM call against a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const result = await llm.chat({
        model: modelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        maxTokens,
        // @ts-ignore LLMOptions does not include signal but AI SDK adapters accept it
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      const content = result.content;
      if (!content) return null;
      const trimmed = content.trim();
      if (!trimmed) return null;

      // Sanity check: if LLM returned only a name-like string with no real content, retry
      if (trimmed.length < 5 || /^(SKIP|NULL)$/i.test(trimmed)) return null;
      return trimmed;
    } catch (err) {
      const isLastAttempt = attempt === attempts - 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('timed out');
      const isRateLimit = errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('overloaded');
      console.error(
        `[Guardian Engine] LLM attempt ${attempt + 1}/${attempts} failed${isTimeout ? ' (timeout)' : isRateLimit ? ' (rate limit)' : ''}: ${errMsg.slice(0, 120)}`
      );
      if (isLastAttempt) return null;
      // Exponential backoff: 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, (1 << attempt) * 2000));
    }
  }
  return null;
}

/** Generate a persona response. Returns null on any failure. */
async function generatePersonaResponse(
  personaId: string,
  personaNameZh: string,
  shiftTheme: string,
  commentContent: string,
  authorName: string
): Promise<string | null> {
  const persona = PERSONAS[personaId];
  if (!persona) {
    console.error(`[Guardian Engine] PERSONAS[${personaId}] not found`);
    return null;
  }

  const systemPrompt = persona.systemPromptTemplate || '';
  const prompt = buildPersonaInteractionPrompt(
    {
      nameZh: personaNameZh,
      identityPrompt: systemPrompt,
      strengths: persona.strengths || [],
    },
    shiftTheme,
    commentContent,
    authorName
  );

  const response = await callLLM(prompt, '请回复以上评论。');

  if (!response) return null;
  if (response === 'SKIP') return null;
  // Require meaningful content
  if (response.replace(/\s/g, '').length < 5) return null;

  return response;
}

// ─── Default shift theme ───────────────────────────────────────────────────────

function getDefaultShiftTheme(): string {
  const themes = [
    '今日话题：分享一个你正在思考的问题',
    '哲学时间：什么塑造了你的思维方式？',
    '思想实验：如果你能和任何历史人物对话，你会选谁？',
    '实践派：分享一个你正在尝试的习惯',
  ];
  return themes[new Date().getDay() % themes.length];
}

// ─── Main Engine ───────────────────────────────────────────────────────────

/**
 * Process a new comment and potentially have guardians respond.
 * Called from the POST /api/comments endpoint.
 *
 * For @mention comments: runs SYNCHRONOUSLY — the API waits for the reply.
 * For organic comments: runs ASYNC (fire-and-forget).
 */
export async function processCommentInteractions(
  commentId: string,
  commentContent: string,
  authorName: string,
  mentionedGuardianId?: string | null
): Promise<{ replied: boolean; reply?: string; personaName?: string }> {
  if (!mentionedGuardianId) {
    processCommentInteractionsAsync(commentId, commentContent, authorName, null).catch(console.error);
    return { replied: false };
  }

  return processMentionReplySync(commentId, commentContent, authorName, mentionedGuardianId);
}

/** Synchronous path — used for @mentioned personas */
async function processMentionReplySync(
  commentId: string,
  commentContent: string,
  authorName: string,
  mentionedGuardianId: string
): Promise<{ replied: boolean; reply?: string; personaName?: string }> {
  try {
    const persona = PERSONAS[mentionedGuardianId];
    if (!persona) {
      console.error(`[Guardian Engine] Persona not found: ${mentionedGuardianId}`);
      return { replied: false };
    }

    let shiftTheme = getDefaultShiftTheme();
    try {
      const guardians = await getTodayGuardians();
      const today = guardians.find(g => g.personaId === mentionedGuardianId);
      if (today) shiftTheme = today.shiftTheme;
    } catch {
      // Use default theme
    }

    const response = await generatePersonaResponse(
      mentionedGuardianId,
      persona.nameZh,
      shiftTheme,
      commentContent,
      authorName
    );

    if (!response) {
      console.warn(`[Guardian Engine] No response generated for ${persona.nameZh}`);
      return { replied: false };
    }

    try {
      await recordPersonaInteraction(mentionedGuardianId, commentId, 'reply', response);
    } catch (err) {
      console.warn('[Guardian Engine] recordPersonaInteraction failed:', err);
    }

    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          mentionedGuardianReply: response,
          mentionedGuardianRepliedAt: new Date(),
        },
      });
    } catch (err) {
      console.warn('[Guardian Engine] Backfill failed:', err);
    }

    console.log(`[Guardian Engine] ${persona.nameZh} replied to comment ${commentId}`);
    return { replied: true, reply: response, personaName: persona.nameZh };
  } catch (err) {
    console.error('[Guardian Engine] processMentionReplySync threw:', err);
    return { replied: false };
  }
}

// ─── Async organic engagement ─────────────────────────────────────────────────

async function processCommentInteractionsAsync(
  commentId: string,
  commentContent: string,
  authorName: string,
  mentionedGuardianId: string | null
): Promise<void> {
  try {
    let guardians: any[];
    try {
      guardians = await getTodayGuardians();
    } catch {
      return;
    }
    if (guardians.length === 0) return;

    const shuffled = [...guardians].sort(() => Math.random() - 0.5);
    const responder = shuffled[0];
    const responseProbability = PERSONA_RESPONSE_PROB[responder.personaId] ?? 0.25;

    const withinLimit = await checkPersonaDailyLimit(responder.personaId).catch(() => true);
    if (!withinLimit) return;
    if (Math.random() > responseProbability) return;

    const response = await generatePersonaResponse(
      responder.personaId,
      responder.personaNameZh,
      responder.shiftTheme,
      commentContent,
      authorName
    );
    if (!response) return;

    await recordPersonaInteraction(responder.personaId, commentId, 'reply', response).catch(console.warn);
    await incrementPersonaDailyInteractions(responder.personaId).catch(console.warn);

    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          mentionedGuardianReply: response,
          mentionedGuardianRepliedAt: new Date(),
        },
      });
    } catch {}
  } catch (err) {
    console.error('[Guardian Engine] Async processing failed:', err);
  }
}
