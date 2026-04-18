/**
 * Prismatic — Guardian Autonomous Discussion Engine
 * "守望者计划" — 每日自主话题讨论
 *
 * How it works:
 * 1. Every morning (cron-triggered), three guardians select a topic collaboratively
 * 2. Each guardian may post 1-2 comments on the topic in their authentic voice
 * 3. Discussions appear in the community section
 * 4. Users can read, react to, and reply to guardian comments
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

function generateTopic(guardians: Awaited<ReturnType<typeof getTodayGuardians>>): string {
  const guardianNames = guardians.map(g => g.personaNameZh).join('、');
  return `今日守望者话题（${guardianNames}）：\n${pickDailyTopic()}`;
}

// ─── Discussion management ────────────────────────────────────────────────────

async function createDiscussion(
  topic: string,
  participantIds: string[]
): Promise<number> {
  await requireTable('guardian_discussions');

  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  // One discussion per day max
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

interface GuardianComment {
  personaId: string;
  personaNameZh: string;
  content: string;
  tone: 'reflection' | 'question' | 'insight' | 'challenge';
}

async function generateGuardianComment(
  personaId: string,
  personaNameZh: string,
  systemPrompt: string,
  topic: string,
  tone: GuardianComment['tone']
): Promise<string> {
  const toneMap: Record<string, string> = {
    reflection: `以${personaNameZh}的视角，分享你对「${topic}」的个人思考。风格：${personaNameZh}亲笔写信般真诚，50-120字，用第二人称「你」来称呼读者。`,
    question: `以${personaNameZh}的视角，围绕「${topic}」提出一个发人深省的问题。风格：像${personaNameZh}在对话中追问一样，有力度，30-80字。`,
    insight: `以${personaNameZh}的视角，围绕「${topic}」给出一个真正有洞见的观点。风格：${personaNameZh}的金句风格，简短有力，30-60字。`,
    challenge: `以${personaNameZh}的视角，对「${topic}」提出一个挑战性的反思。风格：${personaNameZh}的批判性思维，像他本人在质疑一个常识，30-80字。`,
  };

  const llm = createLLMProvider('deepseek');
  const model = 'deepseek-chat';

  try {
    const result = await llm.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: toneMap[tone] },
      ],
      temperature: 0.8,
      maxTokens: 200,
    });
    return result.content.trim().slice(0, 300);
  } catch (err) {
    console.error(`[Guardian Discussion] LLM error for ${personaId}:`, err);
    return '';
  }
}

// ─── Geo distribution for guardians ───────────────────────────────────────────

// Guardians "post from" different locations around the Chinese-speaking world
const GUARDIAN_LOCATIONS: Record<string, { countryCode: string; region: string; city: string }> = {
  'socrates':           { countryCode: 'GR', region: 'Αττική', city: 'Αθήνα' },
  'marcus-aurelius':    { countryCode: 'IT', region: 'Lazio', city: 'Roma' },
  'confucius':          { countryCode: 'CN', region: '山东省', city: '曲阜' },
  'elon-musk':          { countryCode: 'US', region: 'California', city: 'Los Angeles' },
  'charlie-munger':     { countryCode: 'US', region: 'Nebraska', city: 'Omaha' },
  'richard-feynman':     { countryCode: 'US', region: 'New York', city: 'New York' },
  'steve-jobs':         { countryCode: 'US', region: 'California', city: 'Cupertino' },
  'nassim-taleb':       { countryCode: 'US', region: 'New York', city: 'New York' },
  'naval-ravikant':     { countryCode: 'US', region: 'California', city: 'San Francisco' },
  'zhuang-zi':           { countryCode: 'CN', region: '河南省', city: '商丘' },
  'lao-zi':             { countryCode: 'CN', region: '河南省', city: '鹿邑' },
  'warren-buffett':      { countryCode: 'US', region: 'Nebraska', city: 'Omaha' },
};

function getGuardianLocation(personaId: string) {
  return GUARDIAN_LOCATIONS[personaId] ?? { countryCode: 'US', region: 'Unknown', city: 'Unknown' };
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

    const tones: GuardianComment['tone'][] = ['reflection', 'question', 'insight'];
    const results: GuardianComment[] = [];

    for (let i = 0; i < guardians.length; i++) {
      const guardian = guardians[i];
      const persona = personaMap.get(guardian.personaId);
      if (!persona) continue;

      const tone = tones[i % tones.length];
      const content = await generateGuardianComment(
        guardian.personaId,
        guardian.personaNameZh,
        persona.systemPromptTemplate || `你是${guardian.personaNameZh}。${persona.briefZh || persona.brief || ''}`,
        topic,
        tone
      );

      if (!content || content.length < 10) continue;

      const loc = getGuardianLocation(guardian.personaId);

      try {
        await prisma.comment.create({
          data: {
            content,
            nickname: guardian.personaNameZh,
            avatarSeed: null,
            type: 'comment',
            status: 'published',
            geoCountryCode: loc.countryCode,
            geoCountry: COUNTRY_NAMES[loc.countryCode] || loc.countryCode,
            geoRegion: loc.region,
            geoCity: loc.city,
            reactions: [],
          },
        });
        results.push({ personaId: guardian.personaId, personaNameZh: guardian.personaNameZh, content, tone });
        console.log(`[Guardian Discussion] ${guardian.personaNameZh} posted: "${content.slice(0, 40)}..."`);
      } catch (err) {
        console.error(`[Guardian Discussion] Failed to save comment for ${guardian.personaId}:`, err);
      }

      // Small delay between posts to vary timestamps naturally
      await new Promise(r => setTimeout(r, 1500));
    }

    // Update discussion stats
    if (results.length > 0) {
      try {
        await requireTable('guardian_discussions');
        const sql = getSql();
        await sql`
          UPDATE guardian_discussions
          SET round_count = ${results.length}, content = ${results.map(r => `【${r.personaNameZh}】${r.content}`).join('\n\n')}
          WHERE id = ${discussionId}
        `;
      } catch { /* non-fatal */ }
    }

    console.log(`[Guardian Discussion] Completed: ${results.length} comments, topic: "${topic}"`);
    return { success: true, discussionId, topic };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Guardian Discussion] Error:', message);
    return { success: false, error: message };
  }
}
