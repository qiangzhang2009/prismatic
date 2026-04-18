/**
 * Prismatic — Guardian Autonomous Discussion Engine
 * "守望者计划" — 每日自主话题讨论 + 多轮对话
 *
 * How it works:
 * 1. Every morning (cron-triggered), three guardians select a topic
 * 2. Each guardian posts an opening comment (Round 1)
 * 3. Guardians reply to each other (Round 2+): back-and-forth dialogue
 * 4. Discussions appear in the community section with guardian styling
 * 5. Users can read, react to, and reply to guardian comments
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';
import { getTodayGuardians } from '@/lib/guardian';
import { getPersonasByIds } from '@/lib/personas';
import { createLLMProvider } from '@/lib/llm';
import { COUNTRY_NAMES } from '@/lib/geo';

const prisma = new PrismaClient();

// ─── SQL helpers ──────────────────────────────────────────────────────────────

function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  // eslint-disable-next-line
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1 FROM ${sql.unsafe(tableName)} LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

async function requireTable(name: string): Promise<void> {
  if (!(await tableExists(name))) {
    throw new Error(`Table "${name}" does not exist`);
  }
}

// ─── Safe topics ──────────────────────────────────────────────────────────────

const DISCUSSION_SAFE_TOPICS = [
  '今天的你，最想思考的一个问题是什么？',
  '你觉得什么是真正的「智慧」？',
  '如果可以和一个历史人物共进午餐，你选谁？',
  '你从最近的失败中学到了什么？',
  '什么样的习惯，最值得坚持一辈子？',
  '什么书或电影，最近改变了你的看法？',
  '面对不确定性时，你的第一反应是什么？',
  '你认同「选择比努力更重要」这句话吗？',
  '什么样的关系，是最值得投资的？',
  '你相信「命运」还是相信「选择」？',
  '如果明天你有一整天的自由时间，你会怎么过？',
  '什么东西是你愿意用一切去交换的？',
  '你最近一次「原来如此」的顿悟时刻是什么？',
  '在你的领域里，最大的误解是什么？',
  '什么是你做过的最值得骄傲的决定？',
  'AI 会取代大部分人类工作吗？',
  '我们应该追求卓越还是追求平衡？',
  '幸福究竟来自内在还是外在条件？',
  '好奇心是天生的还是后天培养的？',
  '失败是成功之母，还是成功才让人真正成长？',
  '孤独对于创造和思考是必要的吗？',
  '长期关系中，激情与承诺哪个更重要？',
  '我们应该追求被人喜欢还是被人尊重？',
];

const BANNED_KEYWORDS = ['台湾', '香港', '新疆', '西藏', '民主', '革命', '独立', '抗议', '六四', '天安门'];

function pickDailyTopic(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return DISCUSSION_SAFE_TOPICS[dayOfYear % DISCUSSION_SAFE_TOPICS.length];
}

function isTopicSafe(topic: string): boolean {
  const lower = topic.toLowerCase();
  for (const kw of BANNED_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return false;
  }
  return true;
}

// ─── Discussion management ────────────────────────────────────────────────────

interface GuardianComment {
  personaId: string;
  personaNameZh: string;
  content: string;
  round: number;
  commentId?: string;
  replyToCommentId?: string;
}

async function createDiscussion(
  topic: string,
  participantIds: string[]
): Promise<number> {
  await requireTable('guardian_discussions');

  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  const existing = await sql`
    SELECT id FROM guardian_discussions WHERE DATE(started_at) = ${today} LIMIT 1
  `;
  if (existing.length > 0) {
    return (existing[0] as any).id;
  }

  const rows = await sql`
    INSERT INTO guardian_discussions (topic, participant_ids, status)
    VALUES (${topic}, ${participantIds}, ${'active'})
    RETURNING id
  `;
  return (rows as any[])?.[0]?.id ?? 0;
}

export async function getRecentDiscussions(limit: number = 5): Promise<
  Array<{
    id: number;
    topic: string;
    participantIds: string[];
    participantNames: string[];
    roundCount: number;
    viewCount: number;
    status: string;
    startedAt: string;
  }>
> {
  try {
    await requireTable('guardian_discussions');
  } catch {
    return [];
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, topic, participant_ids, round_count, view_count, status, started_at
    FROM guardian_discussions
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;

  const participantIds = [...new Set((rows as any[]).flatMap((r) => r.participant_ids ?? []))];
  const personas = getPersonasByIds(participantIds);
  const nameMap = new Map(personas.map((p) => [p.id, p.nameZh]));

  return (rows as any[]).map((r) => ({
    id: r.id,
    topic: r.topic,
    participantIds: r.participant_ids ?? [],
    participantNames: (r.participant_ids ?? []).map((id: string) => nameMap.get(id) ?? id),
    roundCount: r.round_count ?? 0,
    viewCount: r.view_count ?? 0,
    status: r.status,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
  }));
}

// ─── Guardian comment generation ───────────────────────────────────────────────

type CommentTone = 'reflection' | 'question' | 'insight' | 'challenge' | 'response';

const TONE_PROMPTS: Record<CommentTone, (personaName: string, topic: string, priorContent?: string) => string> = {
  reflection: (name, topic) =>
    `以${name}的视角，分享你对「${topic}」的个人思考。风格：${name}亲笔写信般真诚，60-120字，用第二人称「你」来称呼读者。`,
  question: (name, topic) =>
    `以${name}的视角，围绕「${topic}」提出一个发人深省的问题。风格：像${name}在对话中追问一样，有力度，40-80字。`,
  insight: (name, topic) =>
    `以${name}的视角，围绕「${topic}」给出一个真正有洞见的观点。风格：${name}的金句风格，简短有力，30-60字。`,
  challenge: (name, topic) =>
    `以${name}的视角，对「${topic}」提出一个挑战性的反思。风格：${name}的批判性思维，像他本人在质疑一个常识，40-80字。`,
  response: (name, topic, prior) =>
    prior
      ? `以${name}的视角，回应你同伴的观点：「${prior.slice(0, 100)}」。围绕「${topic}」展开讨论，承认对方有道理的地方，然后深化你自己的立场。风格：像${name}在真实对话中发言，50-100字，第一人称。`
      : `以${name}的视角，围绕「${topic}」表达你的思考。40-80字，第一人称，直接有观点。`,
};

async function generateGuardianComment(
  personaId: string,
  personaNameZh: string,
  systemPrompt: string,
  topic: string,
  tone: CommentTone,
  priorContent?: string
): Promise<string> {
  const llm = createLLMProvider('deepseek');
  const model = 'deepseek-chat';

  try {
    const userPrompt = TONE_PROMPTS[tone](personaNameZh, topic, priorContent);
    const result = await llm.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      maxTokens: 250,
    });
    return result.content.trim().slice(0, 300);
  } catch (err) {
    console.error(`[Guardian Discussion] LLM error for ${personaId}:`, err);
    return '';
  }
}

// ─── Geo distribution for guardians ───────────────────────────────────────────

const GUARDIAN_LOCATIONS: Record<string, { countryCode: string; region: string; city: string }> = {
  'socrates':           { countryCode: 'GR', region: 'Αττική', city: 'Αθήνα' },
  'marcus-aurelius':    { countryCode: 'IT', region: 'Lazio', city: 'Roma' },
  'confucius':          { countryCode: 'CN', region: '山东省', city: '曲阜' },
  'elon-musk':          { countryCode: 'US', region: 'California', city: 'Los Angeles' },
  'charlie-munger':     { countryCode: 'US', region: 'Nebraska', city: 'Omaha' },
  'richard-feynman':    { countryCode: 'US', region: 'New York', city: 'New York' },
  'steve-jobs':         { countryCode: 'US', region: 'California', city: 'Cupertino' },
  'nassim-taleb':       { countryCode: 'US', region: 'New York', city: 'New York' },
  'naval-ravikant':     { countryCode: 'US', region: 'California', city: 'San Francisco' },
  'zhuang-zi':          { countryCode: 'CN', region: '河南省', city: '商丘' },
  'lao-zi':             { countryCode: 'CN', region: '河南省', city: '鹿邑' },
  'warren-buffett':     { countryCode: 'US', region: 'Nebraska', city: 'Omaha' },
};

function getGuardianLocation(personaId: string) {
  return GUARDIAN_LOCATIONS[personaId] ?? { countryCode: 'US', region: 'Unknown', city: 'Unknown' };
}

// ─── Multi-round dialogue engine ───────────────────────────────────────────────

const GUARDIAN_OPENING_TONES: CommentTone[] = ['reflection', 'question', 'insight'];
const GUARDIAN_RESPONSE_TONES: CommentTone[] = ['challenge', 'response', 'insight'];

/**
 * Post a guardian comment and return the created comment ID.
 * Replies are threaded as sub-comments under the first comment.
 */
async function postGuardianComment(
  guardian: {
    personaId: string;
    personaNameZh: string;
  },
  content: string,
  round: number,
  replyToCommentId?: string
): Promise<string | null> {
  if (!content || content.length < 10) return null;

  const loc = getGuardianLocation(guardian.personaId);
  try {
    const created = await prisma.comment.create({
      data: {
        content,
        nickname: guardian.personaNameZh,
        avatarSeed: null,
        type: replyToCommentId ? 'reply' : 'comment',
        status: 'published',
        geoCountryCode: loc.countryCode,
        geoCountry: COUNTRY_NAMES[loc.countryCode] || loc.countryCode,
        geoRegion: loc.region,
        geoCity: loc.city,
        parentId: replyToCommentId ?? null,
        reactions: [],
      },
    });
    console.log(`[Guardian Discussion] Round ${round}: ${guardian.personaNameZh} → "${content.slice(0, 50)}..."`);
    return created.id;
  } catch (err) {
    console.error(`[Guardian Discussion] Failed to save comment for ${guardian.personaId}:`, err);
    return null;
  }
}

/**
 * Build a one-line summary of prior comments for context.
 */
function buildPriorContext(comments: GuardianComment[]): string {
  return comments
    .map(c => `[${c.personaNameZh}]: ${c.content.slice(0, 80)}`)
    .join('\n');
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function runGuardianAutonomousDiscussion(
  manualTopic?: string
): Promise<{ success: boolean; discussionId?: number; topic?: string; error?: string }> {
  try {
    const guardians = await getTodayGuardians();
    if (guardians.length === 0) {
      return { success: false, error: '今日没有值班守望者' };
    }

    const topic = manualTopic ?? pickDailyTopic();
    if (!isTopicSafe(topic)) {
      return { success: false, error: '话题未通过安全审核' };
    }

    const participantIds = guardians.map(g => g.personaId);
    const discussionId = await createDiscussion(topic, participantIds);

    const personas = getPersonasByIds(participantIds);
    const personaMap = new Map(personas.map(p => [p.id, p]));

    const allComments: GuardianComment[] = [];
    const ROUNDS = 2; // Number of back-and-forth rounds

    // ── Round 1: Opening statements (each guardian posts one comment) ──────────
    for (let i = 0; i < guardians.length; i++) {
      const guardian = guardians[i];
      const persona = personaMap.get(guardian.personaId);
      if (!persona) continue;

      const tone = GUARDIAN_OPENING_TONES[i % GUARDIAN_OPENING_TONES.length];
      const systemPrompt = persona.systemPromptTemplate ||
        `你是${guardian.personaNameZh}。${persona.briefZh || persona.brief || ''}`;

      const content = await generateGuardianComment(
        guardian.personaId,
        guardian.personaNameZh,
        systemPrompt,
        topic,
        tone
      );

      const commentId = await postGuardianComment(guardian, content, 1);
      if (commentId) {
        allComments.push({
          personaId: guardian.personaId,
          personaNameZh: guardian.personaNameZh,
          content,
          round: 1,
          commentId,
        });
      }

      // Delay between posts to vary timestamps naturally
      await new Promise(r => setTimeout(r, 1200));
    }

    // ── Round 2+: Response rounds (each guardian responds to prior comments) ───
    for (let round = 2; round <= ROUNDS; round++) {
      const priorContext = buildPriorContext(allComments);

      for (let i = 0; i < guardians.length; i++) {
        const guardian = guardians[i];
        const persona = personaMap.get(guardian.personaId);
        if (!persona) continue;

        // Pick who to respond to (cycle through other guardians)
        const otherGuardians = guardians.filter(g => g.personaId !== guardian.personaId);
        const respondTo = otherGuardians[i % otherGuardians.length];
        const priorComment = allComments.find(c => c.personaId === respondTo?.personaId);

        const tone = GUARDIAN_RESPONSE_TONES[(round + i) % GUARDIAN_RESPONSE_TONES.length];
        const systemPrompt = persona.systemPromptTemplate ||
          `你是${guardian.personaNameZh}。${persona.briefZh || persona.brief || ''}`;

        const content = await generateGuardianComment(
          guardian.personaId,
          guardian.personaNameZh,
          systemPrompt,
          topic,
          tone,
          priorComment?.content
        );

        // Reply to the first comment of the guardian we're responding to
        const replyToCommentId = priorComment?.commentId;
        const commentId = await postGuardianComment(guardian, content, round, replyToCommentId ?? undefined);
        if (commentId) {
          allComments.push({
            personaId: guardian.personaId,
            personaNameZh: guardian.personaNameZh,
            content,
            round,
            commentId,
            replyToCommentId,
          });
        }

        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // ── Update discussion record ───────────────────────────────────────────────
    if (allComments.length > 0) {
      try {
        await requireTable('guardian_discussions');
        const sql = getSql();
        const summary = allComments
          .map(c => `【第${c.round}轮 · ${c.personaNameZh}】${c.content}`)
          .join('\n\n');
        await sql`
          UPDATE guardian_discussions
          SET
            round_count = ${allComments.length},
            content = ${summary},
            status = ${'completed'}
          WHERE id = ${discussionId}
        `;
      } catch { /* non-fatal */ }
    }

    console.log(`[Guardian Discussion] Completed: ${allComments.length} comments across ${ROUNDS} rounds, topic: "${topic}"`);
    return { success: true, discussionId, topic };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Guardian Discussion] Error:', message);
    return { success: false, error: message };
  }
}
