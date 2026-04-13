/**
 * Prismatic — Guardian AI Engine
 * "守望者计划" — The Guardian AI System
 *
 * How it works:
 * 1. When a comment is posted, we check if any guardian wants to respond
 * 2. Each guardian has a probability of responding (20-40% chance per guardian per comment)
 * 3. The LLM generates an authentic response in the persona's voice
 * 4. The response is saved as a persona interaction
 * 5. The comment appears with the persona's reply below it
 *
 * This creates the "living world" feeling — users never know if today their
 * comment will catch the attention of Einstein, Seneca, or Confucius.
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getTodayGuardians, recordPersonaInteraction, buildPersonaInteractionPrompt } from '@/lib/guardian';
import { getPersonasByIds } from '@/lib/personas';
import { createLLMProvider } from '@/lib/llm';

function createSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

function getSql() {
  let _sql: ReturnType<typeof createSql> | null = null;
  if (!_sql) _sql = createSql();
  return _sql;
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
// Each persona has a base probability of responding to a comment.
// These are tuned to create interesting behavior:
// - Some personas are more "talkative" (higher chance)
// - Some are more "thoughtful/selective" (lower chance)
const PERSONA_RESPONSE_PROB: Record<string, number> = {
  'socrates': 0.40,        // Socrates loves a good question
  'elon-musk': 0.35,       // Elon engaged with interesting ideas
  'warren-buffett': 0.30,  // Buffett selective, only best ideas
  'richard-feynman': 0.35, // Feynman loves curiosity
  'jordan-peterson': 0.30, // Peterson engaged with meaning
  'steve-jobs': 0.25,      // Jobs selective, only brilliant ideas
  'marcus-aurelius': 0.30, // Marcus shares wisdom
  'confucius': 0.35,        // Confucius values learning
  'charlie-munger': 0.25,  // Munger — only worth it if it's great
  'jacque-fresko': 0.20,   // Fresko — niche, more selective
  'templars': 0.30,
  'tao': 0.30,
};

// Default daily interaction limit per persona
const DEFAULT_DAILY_LIMIT = 20;

// ─── Check daily interaction limit ─────────────────────────────────────────────

async function checkPersonaDailyLimit(personaId: string): Promise<boolean> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  // Get the scheduled limit for today (if any)
  const schedule = await sql`
    SELECT max_interactions FROM prismatic_guardian_schedule
    WHERE persona_id = ${personaId} AND date = ${today}
  `;

  const maxInteractions = schedule[0]?.max_interactions ?? DEFAULT_DAILY_LIMIT;

  // Get current interaction count for today
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

async function generatePersonaResponse(
  personaId: string,
  personaNameZh: string,
  shiftTheme: string,
  commentContent: string,
  authorName: string
): Promise<string | null> {
  try {
    // Get persona data
    const personas = getPersonasByIds([personaId]);
    const persona = personas[0];
    if (!persona) return null;

    const llm = createLLMProvider(getLLMType());
    const model = getModelName();

    const prompt = buildPersonaInteractionPrompt(
      {
        nameZh: persona.nameZh,
        identityPrompt: persona.systemPromptTemplate || '',
        strengths: persona.strengths || [],
      },
      shiftTheme,
      commentContent,
      authorName
    );

    const result = await llm.chat({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请回复以上评论。' },
      ],
      temperature: 0.8,
      maxTokens: 200,
    });

    const response = result.content.trim();

    // Don't save if the AI decided to skip
    if (response === 'SKIP' || response.length < 5) {
      return null;
    }

    return response;
  } catch (error) {
    console.error(`[Guardian Engine] LLM error for ${personaId}:`, error);
    return null;
  }
}

// ─── Main Engine ────────────────────────────────────────────────────────────

/**
 * Process a new comment and potentially have guardians respond.
 * This is called from the POST /api/comments endpoint.
 *
 * Design decisions:
 * - We respond asynchronously (fire-and-forget) so it doesn't block the comment submission
 * - Max 1 guardian responds per comment (to avoid overwhelming the user)
 * - Each guardian has a probability check to avoid always responding
 */
export async function processCommentInteractions(
  commentId: string,
  commentContent: string,
  authorName: string
): Promise<void> {
  // Fire and forget — don't block the comment submission
  processCommentInteractionsAsync(commentId, commentContent, authorName).catch(err => {
    console.error('[Guardian Engine] Async processing failed:', err);
  });
}

async function processCommentInteractionsAsync(
  commentId: string,
  commentContent: string,
  authorName: string
): Promise<void> {
  try {
    const guardians = await getTodayGuardians();
    if (guardians.length === 0) return;

    // Randomly select one guardian to potentially respond
    // (In future: could allow multiple, but keeping it natural for now)
    const shuffled = [...guardians].sort(() => Math.random() - 0.5);
    const responder = shuffled[0];

    // Check daily interaction limit
    const withinLimit = await checkPersonaDailyLimit(responder.personaId);
    if (!withinLimit) {
      console.log(`[Guardian Engine] ${responder.personaNameZh} has reached daily interaction limit`);
      return;
    }

    const probability = PERSONA_RESPONSE_PROB[responder.personaId] ?? 0.25;
    if (Math.random() > probability) {
      // Guardian chose not to respond this time — creates natural behavior
      return;
    }

    // Generate the response
    const response = await generatePersonaResponse(
      responder.personaId,
      responder.personaNameZh,
      responder.shiftTheme,
      commentContent,
      authorName
    );

    if (!response) return;

    // Record the interaction and increment daily counter
    await recordPersonaInteraction(
      responder.personaId,
      commentId,
      'reply',
      response
    );
    await incrementPersonaDailyInteractions(responder.personaId);

    console.log(`[Guardian Engine] ${responder.personaNameZh} replied to comment ${commentId}: "${response.slice(0, 50)}..."`);
  } catch (error) {
    console.error('[Guardian Engine] Error processing interactions:', error);
  }
}
