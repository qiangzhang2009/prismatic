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
import { recordPersonaInteraction, buildPersonaInteractionPrompt } from '@/lib/guardian';
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

// ─── LLM Generation ──────────────────────────────────────────────────────────

// Vercel Hobbyist Node.js runtime: ~60s limit per serverless function.
// DeepSeek typically responds in 3-15s. 55s gives plenty of headroom.
const LLM_TIMEOUT_MS = 55_000;

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

      if (trimmed.length < 5 || /^(SKIP|NULL)$/i.test(trimmed)) return null;
      return trimmed;
    } catch (err) {
      const isLastAttempt = attempt === attempts - 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('timed out');
      const isRateLimit = errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('overloaded');
      console.error(
        `[Guardian Engine] LLM attempt ${attempt + 1}/${attempts} failed${isTimeout ? ' (timeout)' : isRateLimit ? ' (rate limit)' : ''}: ${errMsg.slice(0, 200)}`
      );
      if (isLastAttempt) return null;
      await new Promise(resolve => setTimeout(resolve, (1 << attempt) * 1000));
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
 * For @mention comments: SYNCHRONOUS — waits for LLM, updates DB, returns reply.
 * For organic comments: ASYNC fire-and-forget (probabilistic, schedule-based).
 */
export async function processCommentInteractions(
  commentId: string,
  commentContent: string,
  authorName: string,
  mentionedGuardianId?: string | null
): Promise<{ replied: boolean; reply?: string; personaName?: string }> {
  if (!mentionedGuardianId) {
    // Organic engagement: fire-and-forget, schedule-based
    processOrganicEngagement(commentId, commentContent, authorName).catch(console.error);
    return { replied: false };
  }

  // @mention path: SYNCHRONOUS — the API route awaits this call.
  // The LLM runs within the request lifecycle so DB is updated before the response.
  return processMentionedReply(commentId, commentContent, authorName, mentionedGuardianId);
}

/**
 * Handle @mentioned persona reply — SYNCHRONOUS.
 * NO schedule dependency, NO daily limit. Any persona in the library can respond.
 */
async function processMentionedReply(
  commentId: string,
  commentContent: string,
  authorName: string,
  mentionedGuardianId: string
): Promise<{ replied: boolean; reply?: string; personaName?: string }> {
  console.log(`[Guardian Engine] processMentionedReply called: commentId=${commentId}, personaId=${mentionedGuardianId}, content=${commentContent.slice(0, 50)}`);
  const persona = PERSONAS[mentionedGuardianId];
  if (!persona) {
    console.error(`[Guardian Engine] Persona not found: ${mentionedGuardianId}`);
    return { replied: false };
  }

  const shiftTheme = getDefaultShiftTheme();

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
    console.warn('[Guardian Engine] DB update failed:', err);
  }

  console.log(`[Guardian Engine] ${persona.nameZh} replied to comment ${commentId}`);
  return { replied: true, reply: response, personaName: persona.nameZh };
}

// ─── Async organic engagement (schedule-based, fire-and-forget) ──────────────

async function processOrganicEngagement(
  commentId: string,
  commentContent: string,
  authorName: string
): Promise<void> {
  try {
    const { getTodayGuardians } = await import('@/lib/guardian');
    let guardians: any[];
    try {
      guardians = await getTodayGuardians();
    } catch {
      return;
    }
    if (guardians.length === 0) return;

    const shuffled = [...guardians].sort(() => Math.random() - 0.5);
    const responder = shuffled[0];

    const responseProbability = 0.25;
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

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        mentionedGuardianReply: response,
        mentionedGuardianRepliedAt: new Date(),
      },
    }).catch(() => {});
  } catch (err) {
    console.error('[Guardian Engine] Organic engagement failed:', err);
  }
}
