/**
 * Prismatic — Guardian Schedule System
 * "守望者计划" — The Guardian System
 *
 * Design Philosophy:
 * - 3 guardians per day, rotating on a weekly cycle
 * - Each guardian has a "shift theme" — a special topic or tone for the day
 * - Guardians can reply to comments, react with emojis, or quote+reply
 * - The system uses LLM to generate authentic guardian responses
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getPersonasByIds } from '@/lib/personas';

function createSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

let _sql: ReturnType<typeof createSql> | null = null;
function getSql(): ReturnType<typeof createSql> {
  if (!_sql) _sql = createSql();
  return _sql;
}

// ─── Shift Themes ─────────────────────────────────────────────────────────────
// Curated themes for each shift slot — adds variety and narrative flavor
const SHIFT_THEMES = {
  1: [
    '今日话题：请分享你最近在思考的一个问题',
    '本周主题：什么塑造了你现在的思维方式？',
    '今日话题：你从失败中学到了什么？',
    '本周主题：如果你能和任何历史人物对话，你会选择谁？',
    '今日话题：你最想拥有哪种能力？',
    '本周主题：什么书/电影/经历改变了你的看法？',
    '今日话题：描述一个让你"原来如此"的时刻',
    '本周主题：你的榜样是谁？为什么？',
  ],
  2: [
    '哲学时间：简单解释一个改变你人生的观念',
    '思想实验：如果你知道自己的死期，你会怎么活？',
    '哲学时间：自由意志存在吗？',
    '思想实验：如果可以删除一段记忆，你选哪个？',
    '哲学时间：什么是幸福？如何衡量？',
    '思想实验：缸中之脑——如何证明你是真实的？',
    '哲学时间：时间的本质是什么？',
    '思想实验：如果可以预见未来，你会想看什么？',
  ],
  3: [
    '实践派：分享一个你正在尝试的习惯或方法',
    '今日问题：你在纠结什么决定？',
    '实践派：你的早晨/晚间例行程序是什么？',
    '今日问题：什么让你夜不能寐？',
    '实践派：你在读什么书？为什么？',
    '今日问题：有没有一句一直激励你的话？',
    '实践派：你是怎么学习的？有什么技巧？',
    '今日问题：你最近最大的挑战是什么？',
  ],
};

// ─── Schedule Generation ─────────────────────────────────────────────────────

/**
 * Generate a weekly guardian schedule for a given week start date (Monday).
 * Uses deterministic shuffling based on week number so the schedule
 * is the same for all users looking at the same week.
 */
function generateWeeklySchedule(weekStart: Date): Array<{ slot: number; personaId: string; shiftTheme: string }> {
  const personas = getPersonasByIds([
    'steve-jobs', 'warren-buffett', 'richard-feynman',
    'socrates', 'marcus-aurelius', 'confucius',
    'elon-musk', 'charlie-munger', 'jordan-peterson',
    'jacque-fresko', 'templars', 'tao',
  ]);

  if (personas.length < 9) {
    // Fallback: use IDs directly if personas not loaded
    const fallbackIds = [
      'steve-jobs', 'warren-buffett', 'richard-feynman',
      'socrates', 'marcus-aurelius', 'confucius',
      'elon-musk', 'charlie-munger', 'jordan-peterson',
    ];
    return fallbackIds.slice(0, 9).map((id, i) => ({
      personaId: id,
      slot: (i % 3) + 1,
      shiftTheme: SHIFT_THEMES[(i % 3) + 1 as 1 | 2 | 3][Math.floor(i / 3) % 8],
    }));
  }

  // Deterministic shuffle using week number as seed
  const weekNum = Math.floor((weekStart.getTime() - new Date('2024-01-01').getTime()) / (7 * 24 * 60 * 60 * 1000));
  const shuffled = [...personas].sort((a, b) => {
    const h1 = (weekNum * 17 + a.id.charCodeAt(0) * 31 + b.id.charCodeAt(1) * 13) % 997;
    const h2 = (weekNum * 17 + b.id.charCodeAt(0) * 31 + a.id.charCodeAt(1) * 13) % 997;
    return h1 - h2;
  });

  const schedule: Array<{ slot: number; personaId: string; shiftTheme: string }> = [];
  for (let day = 0; day < 7; day++) {
    for (let slot = 1; slot <= 3; slot++) {
      const idx = (day * 3 + slot - 1) % shuffled.length;
      const themeIdx = ((weekNum + day) * 3 + slot) % 8;
      schedule.push({
        slot,
        personaId: shuffled[idx].id,
        shiftTheme: SHIFT_THEMES[slot as 1 | 2 | 3][themeIdx],
      });
    }
  }
  return schedule;
}

/**
 * Ensure a schedule exists for all 7 days of a given week.
 * Upserts the generated schedule into the database.
 */
export async function ensureWeeklySchedule(weekStart: Date): Promise<void> {
  const sql = getSql();
  const schedule = generateWeeklySchedule(weekStart);

  for (let day = 0; day < 7; day++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);

    for (let slot = 1; slot <= 3; slot++) {
      const entry = schedule[day * 3 + slot - 1];
      if (!entry) continue;

      const dateStr = date.toISOString().slice(0, 10);
      await sql`
        INSERT INTO prismatic_guardian_schedule (date, slot, persona_id, shift_theme)
        VALUES (${dateStr}, ${entry.slot}, ${entry.personaId}, ${entry.shiftTheme})
        ON CONFLICT (date, slot) DO UPDATE SET shift_theme = ${entry.shiftTheme}
      `;
    }
  }
}

/**
 * Get today's guardians (3 personas on duty today).
 */
export async function getTodayGuardians(): Promise<Array<{
  slot: number;
  personaId: string;
  personaName: string;
  personaNameZh: string;
  personaTagline: string;
  gradientFrom: string;
  gradientTo: string;
  shiftTheme: string;
}>> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  // Ensure this week's schedule exists
  const weekStart = getWeekStart(new Date());
  await ensureWeeklySchedule(weekStart);

  // Get guardian schedule (without persona JOIN)
  const rows = await sql`
    SELECT gs.slot, gs.persona_id, gs.shift_theme, gs.max_interactions
    FROM prismatic_guardian_schedule gs
    WHERE gs.date = ${today}
    ORDER BY gs.slot ASC
  `;

  if (rows.length === 0) return [];

  // Get persona metadata from static data
  const personaIds = rows.map(r => r.persona_id as string);
  const personas = getPersonasByIds(personaIds);
  const personaMap = new Map(personas.map(p => [p.id, p]));

  return rows.map((r: any) => {
    const persona = personaMap.get(r.persona_id);
    return {
      slot: r.slot,
      personaId: r.persona_id,
      personaName: persona?.name || r.persona_id,
      personaNameZh: persona?.nameZh || r.persona_id,
      personaTagline: persona?.taglineZh || persona?.tagline || '',
      gradientFrom: persona?.gradientFrom || '#4d96ff',
      gradientTo: persona?.gradientTo || '#c77dff',
      shiftTheme: r.shift_theme || '',
    };
  });
}

/**
 * Get guardians for a specific date.
 */
export async function getGuardiansForDate(date: string): Promise<Array<{
  slot: number;
  personaId: string;
  personaName: string;
  personaNameZh: string;
  personaTagline: string;
  gradientFrom: string;
  gradientTo: string;
  shiftTheme: string;
}>> {
  const sql = getSql();
  const weekStart = getWeekStart(new Date(date));
  await ensureWeeklySchedule(weekStart);

  // Get guardian schedule (without persona JOIN)
  const rows = await sql`
    SELECT gs.slot, gs.persona_id, gs.shift_theme, gs.max_interactions
    FROM prismatic_guardian_schedule gs
    WHERE gs.date = ${date}
    ORDER BY gs.slot ASC
  `;

  if (rows.length === 0) return [];

  // Get persona metadata from static data
  const personaIds = rows.map(r => r.persona_id as string);
  const personas = getPersonasByIds(personaIds);
  const personaMap = new Map(personas.map(p => [p.id, p]));

  return rows.map((r: any) => {
    const persona = personaMap.get(r.persona_id);
    return {
      slot: r.slot,
      personaId: r.persona_id,
      personaName: persona?.name || r.persona_id,
      personaNameZh: persona?.nameZh || r.persona_id,
      personaTagline: persona?.taglineZh || persona?.tagline || '',
      gradientFrom: persona?.gradientFrom || '#4d96ff',
      gradientTo: persona?.gradientTo || '#c77dff',
      shiftTheme: r.shift_theme || '',
    };
  });
}

/**
 * Get schedule for a date range (for the calendar view).
 */
export async function getScheduleRange(startDate: string, endDate: string): Promise<Array<{
  date: string;
  dayOfWeek: string;
  guardians: Array<{ slot: number; personaId: string; personaNameZh: string; gradientFrom: string; gradientTo: string; shiftTheme: string }>;
}>> {
  const sql = getSql();

  // Ensure all weeks in range
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = getWeekStart(start);
  while (current <= end) {
    await ensureWeeklySchedule(current);
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const rows = await sql`
    SELECT gs.date, gs.slot, gs.persona_id, gs.shift_theme
    FROM prismatic_guardian_schedule gs
    WHERE gs.date >= ${startDate} AND gs.date <= ${endDate}
    ORDER BY gs.date ASC, gs.slot ASC
  `;

  if (rows.length === 0) return [];

  // Get persona metadata from static data
  const personaIds = Array.from(new Set(rows.map(r => r.persona_id as string)));
  const personas = getPersonasByIds(personaIds);
  const personaMap = new Map(personas.map(p => [p.id, p]));

  // Group by date
  const byDate: Record<string, any> = {};
  for (const r of rows as any[]) {
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    if (!byDate[d]) {
      byDate[d] = { date: d, guardians: [] };
    }
    const persona = personaMap.get(r.persona_id);
    byDate[d].guardians.push({
      slot: r.slot,
      personaId: r.persona_id,
      personaNameZh: persona?.nameZh || r.persona_id,
      gradientFrom: persona?.gradientFrom || '#4d96ff',
      gradientTo: persona?.gradientTo || '#c77dff',
      shiftTheme: r.shift_theme || '',
    });
  }

  return Object.values(byDate).map((entry: any) => {
    const date = new Date(entry.date);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return {
      date: entry.date,
      dayOfWeek: days[date.getDay()],
      guardians: entry.guardians,
    };
  });
}

/**
 * Record a persona's interaction with a comment.
 */
export async function recordPersonaInteraction(
  personaId: string,
  commentId: string,
  type: 'reply' | 'reaction' | 'quote',
  content?: string,
  emoji?: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO prismatic_persona_interactions (persona_id, comment_id, interaction_type, content, emoji)
    VALUES (${personaId}, ${commentId}, ${type}, ${content ?? null}, ${emoji ?? null})
  `;
}

/**
 * Get all interactions for a specific comment.
 */
export async function getCommentInteractions(commentId: string): Promise<Array<{
  id: number;
  personaId: string;
  personaNameZh: string;
  gradientFrom: string;
  gradientTo: string;
  interactionType: string;
  content: string | null;
  emoji: string | null;
  createdAt: string;
}>> {
  const sql = getSql();
  const rows = await sql`
    SELECT pi.id, pi.persona_id, pi.interaction_type, pi.content, pi.emoji, pi.created_at
    FROM prismatic_persona_interactions pi
    WHERE pi.comment_id = ${commentId}
    ORDER BY pi.created_at ASC
  `;

  if (rows.length === 0) return [];

  // Get persona metadata from static data
  const personaIds = rows.map(r => r.persona_id as string);
  const personas = getPersonasByIds(personaIds);
  const personaMap = new Map(personas.map(p => [p.id, p]));

  return rows.map((r: any) => {
    const persona = personaMap.get(r.persona_id);
    return {
      id: r.id,
      personaId: r.persona_id,
      personaNameZh: persona?.nameZh || r.persona_id,
      gradientFrom: persona?.gradientFrom || '#4d96ff',
      gradientTo: persona?.gradientTo || '#c77dff',
      interactionType: r.interaction_type,
      content: r.content,
      emoji: r.emoji,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the interaction prompt for a persona based on shift theme.
 * This is used by the LLM engine to generate persona-specific responses.
 */
export function buildPersonaInteractionPrompt(
  persona: {
    nameZh: string;
    identityPrompt: string;
    strengths: string[];
  },
  shiftTheme: string,
  commentContent: string,
  authorName: string
): string {
  const behaviors = [
    '以该人物的风格对该评论发表看法或提问',
    '用该人物独特的思维框架分析评论中的观点',
    '引用该人物的一句名言或思想回应这条评论',
    '以该人物的口吻分享一个相关的洞见',
  ];

  const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

  return `${persona.identityPrompt}

你是"守望者计划"的今日值班者——${persona.nameZh}。
今日值班主题：${shiftTheme}

你正在浏览社区评论，你的任务是：
- ${behavior}
- 保持你的人物特色：${persona.strengths.join('、')}
- 回复要简洁有力，30-80字以内
- 可以适当使用 Markdown 格式
- 不要机械地回复，要像这个人物真正在说话

用户"${authorName}"的评论内容：
"${commentContent}"

请生成你的回复（如果你认为不值得回复，返回"SKIP"）：
`;
}
