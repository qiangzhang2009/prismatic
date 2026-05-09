/**
 * POST /api/cron/guardian-schedule — Vercel Cron entry point for Guardian Schedule Generation
 * Triggered every day at 00:00 (Asia/Shanghai) via vercel.json cron config.
 * 
 * This ensures the schedule table always has data for the next 14 days.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getWeekStart } from '@/lib/guardian';

const DATABASE_URL = process.env.DATABASE_URL;

// Guardian persona pool
const GUARDIAN_POOL = [
  'socrates', 'marcus-aurelius', 'confucius',
  'elon-musk', 'charlie-munger', 'richard-feynman',
  'steve-jobs', 'nassim-taleb', 'naval-ravikant',
  'zhuang-zi', 'lao-zi', 'warren-buffett',
];

// Shift themes for variety
const SHIFT_THEMES = [
  // Slot 1: 开放性问题
  [
    '今日话题：请分享你最近在思考的一个问题',
    '今日话题：你从失败中学到了什么？',
    '今日话题：你最想拥有哪种能力？',
    '今日话题：描述一个让你"原来如此"的时刻',
    '本周主题：什么塑造了你现在的思维方式？',
    '本周主题：如果你能和任何历史人物对话，你会选择谁？',
    '本周主题：你的榜样是谁？为什么？',
    '本周主题：什么书/电影/经历改变了你的看法？',
  ],
  // Slot 2: 哲学思考
  [
    '哲学时间：自由意志存在吗？',
    '哲学时间：什么是幸福？如何衡量？',
    '哲学时间：时间的本质是什么？',
    '哲学时间：简单解释一个改变你人生的观念',
    '思想实验：如果你知道自己的死期，你会怎么活？',
    '思想实验：如果可以预见未来，你会想看什么？',
    '思想实验：缸中之脑——如何证明你是真实的？',
    '思想实验：如果可以删除一段记忆，你选哪个？',
  ],
  // Slot 3: 实践问题
  [
    '实践派：分享一个你正在尝试的习惯或方法',
    '实践派：你的早晨/晚间例行程序是什么？',
    '实践派：你在读什么书？为什么？',
    '实践派：你是怎么学习的？有什么技巧？',
    '今日问题：什么让你夜不能寐？',
    '今日问题：有没有一句一直激励你的话？',
    '今日问题：你最近最大的挑战是什么？',
    '今日问题：你在纠结什么决定？',
  ],
];

/**
 * Generate deterministic schedule for a week using week number as seed
 */
function generateWeekSchedule(weekStart: Date, startDay: number = 0): Array<{
  date: string;
  slot: number;
  personaId: string;
  shiftTheme: string;
}> {
  const schedule: Array<{
    date: string;
    slot: number;
    personaId: string;
    shiftTheme: string;
  }> = [];

  // Week number as seed for deterministic shuffling
  const weekNum = Math.floor((weekStart.getTime() - new Date('2024-01-01').getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Shuffle guardian pool deterministically
  const shuffled = [...GUARDIAN_POOL].sort((a, b) => {
    const h1 = (weekNum * 17 + a.charCodeAt(0) * 31 + b.charCodeAt(1) * 13) % 997;
    const h2 = (weekNum * 17 + b.charCodeAt(0) * 31 + a.charCodeAt(1) * 13) % 997;
    return h1 - h2;
  });

  // Generate for 7 days, 3 slots each
  for (let dayOffset = startDay; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().slice(0, 10);

    for (let slot = 1; slot <= 3; slot++) {
      const idx = (dayOffset * 3 + slot - 1) % shuffled.length;
      const themeIdx = ((weekNum + dayOffset) * 3 + slot) % SHIFT_THEMES[slot - 1].length;

      schedule.push({
        date: dateStr,
        slot,
        personaId: shuffled[idx],
        shiftTheme: SHIFT_THEMES[slot - 1][themeIdx],
      });
    }
  }

  return schedule;
}

export async function POST(req: NextRequest) {
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const sql = neon(DATABASE_URL);

    // Generate schedule for next 14 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start from today, ensure at least 14 days ahead
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 14);

    let inserted = 0;
    let skipped = 0;

    // Generate week by week
    let currentWeekStart = getWeekStart(today);
    while (currentWeekStart <= endDate) {
      // Generate 7 days from this week's Monday
      const weekSchedule = generateWeekSchedule(currentWeekStart);

      for (const entry of weekSchedule) {
        const entryDate = new Date(entry.date);
        
        // Only process dates within our target range
        if (entryDate < today || entryDate > endDate) {
          skipped++;
          continue;
        }

        try {
          await sql`
            INSERT INTO prismatic_guardian_schedule (date, slot, persona_id, shift_theme, max_interactions)
            VALUES (${entry.date}, ${entry.slot}, ${entry.personaId}, ${entry.shiftTheme}, 5)
            ON CONFLICT (date, slot) DO NOTHING
          `;
          inserted++;
        } catch (e) {
          console.error(`[Schedule] Failed to insert ${entry.date} slot ${entry.slot}:`, e);
        }
      }

      // Move to next week
      currentWeekStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    // Count total in database
    const countResult = await sql`SELECT COUNT(*) as cnt FROM prismatic_guardian_schedule`;
    const total = countResult[0]?.cnt || 0;

    console.log(`[Guardian Schedule] Generated ${inserted} new entries, skipped ${skipped} existing. Total: ${total}`);

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total,
      generatedUntil: endDate.toISOString().slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Guardian Schedule] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  
  // Simple auth check (in production, use proper auth)
  if (secret !== 'debug') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to POST logic
  return POST(new NextRequest(req.url, { method: 'POST' }));
}
