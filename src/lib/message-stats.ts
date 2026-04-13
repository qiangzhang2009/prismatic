/**
 * Prismatic — Message Usage Tracking
 * Records each message sent by a user so admins can see usage stats.
 * Uses Neon PostgreSQL (serverless, WebSocket-based).
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

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

// ─── Daily limit constants ───────────────────────────────────────────────────

// 普通用户每日对话上限
export const USER_DAILY_LIMIT = 35;

// 检查用户是否达到今日对话配额上限
export async function checkUserDailyLimit(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const current = await getDailyMessageCount(userId);
  return {
    allowed: current < USER_DAILY_LIMIT,
    current,
    limit: USER_DAILY_LIMIT,
  };
}

// ─── Record a message ─────────────────────────────────────────────────────────

export interface MessageRecord {
  id: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  count: number;
}

/**
 * Increment the message count for a user on a given date.
 * Uses UPSERT so we always add +1 regardless of whether a row exists.
 */
export async function recordMessage(userId: string): Promise<void> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  await sql`
    INSERT INTO prismatic_message_stats (user_id, date, message_count)
    VALUES (${userId}, ${today}, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET message_count = prismatic_message_stats.message_count + 1
  `;
}

/**
 * Get the total message count for a user on a specific date.
 */
export async function getDailyMessageCount(userId: string, date?: string): Promise<number> {
  const sql = getSql();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const rows = await sql`
    SELECT message_count FROM prismatic_message_stats
    WHERE user_id = ${userId} AND date = ${targetDate}
  `;
  return rows.length > 0 ? (rows[0] as any).message_count : 0;
}

/**
 * Get message counts for a user over a date range (last N days).
 */
export async function getUserMessageHistory(userId: string, days: number = 7): Promise<MessageRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, date, message_count
    FROM prismatic_message_stats
    WHERE user_id = ${userId}
      AND date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
    ORDER BY date DESC
  `;
  return rows.map((r: any) => ({
    id: r.user_id,
    userId: r.user_id,
    date: r.date,
    count: r.message_count,
  }));
}

/**
 * Get today's top N users by message count.
 */
export async function getTopUsersToday(limit: number = 10): Promise<Array<{ userId: string; date: string; count: number; email?: string; name?: string }>> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    SELECT
      ms.user_id,
      ms.date,
      ms.message_count AS count,
      u.email,
      u.name
    FROM prismatic_message_stats ms
    LEFT JOIN prismatic_users u ON u.id = ms.user_id
    WHERE ms.date = ${today}
    ORDER BY ms.message_count DESC
    LIMIT ${limit}
  `;
  return rows.map((r: any) => ({
    userId: r.user_id,
    date: r.date,
    count: r.count,
    email: r.email,
    name: r.name,
  }));
}

/**
 * Get global usage stats: today's total messages, this week's, and daily breakdown.
 */
export async function getGlobalUsageStats(days: number = 7): Promise<{
  todayTotal: number;
  weekTotal: number;
  avgDaily: number;
  dailyBreakdown: Array<{ date: string; total: number }>;
  byHour: Array<{ hour: number; count: number }>;
}> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  // Today's total
  const todayRows = await sql`
    SELECT COALESCE(SUM(message_count), 0) as total
    FROM prismatic_message_stats
    WHERE date = ${today}
  `;
  const todayTotal = Number((todayRows[0] as any)?.total ?? 0);

  // This week's total
  const weekRows = await sql`
    SELECT COALESCE(SUM(message_count), 0) as total
    FROM prismatic_message_stats
    WHERE date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
  `;
  const weekTotal = Number((weekRows[0] as any)?.total ?? 0);

  // Daily breakdown for last N days
  const dailyRows = await sql`
    SELECT date, SUM(message_count) as total
    FROM prismatic_message_stats
    WHERE date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
    GROUP BY date
    ORDER BY date ASC
  `;
  const dailyBreakdown = dailyRows.map((r: any) => ({
    date: r.date,
    total: Number(r.total),
  }));

  // Hourly breakdown (useful for capacity planning)
  // Note: our table only has date, not hour. We return a placeholder for now.
  const byHour: Array<{ hour: number; count: number }> = [];

  const avgDaily = dailyBreakdown.length > 0
    ? Math.round(weekTotal / dailyBreakdown.length)
    : 0;

  return { todayTotal, weekTotal, avgDaily, dailyBreakdown, byHour };
}

/**
 * Get per-user usage stats for all users (used by admin user list).
 */
export async function getAllUsersUsage(days: number = 7): Promise<Record<string, {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  lastActivity: string | null;
}>> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  const rows = await sql`
    SELECT
      user_id,
      date,
      message_count,
      MAX(date) OVER (PARTITION BY user_id) as last_date
    FROM prismatic_message_stats
    WHERE date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
  `;

  const result: Record<string, { todayCount: number; weekCount: number; totalCount: number; lastActivity: string | null }> = {};

  for (const r of rows as any[]) {
    const uid = r.user_id;
    if (!result[uid]) {
      result[uid] = { todayCount: 0, weekCount: 0, totalCount: 0, lastActivity: null };
    }
    result[uid].weekCount += r.message_count;
    if (r.date === today) {
      result[uid].todayCount = r.message_count;
    }
    if (r.last_date === r.date) {
      result[uid].lastActivity = r.date;
    }
  }

  // Total count across all time
  const totalRows = await sql`
    SELECT user_id, SUM(message_count) as total
    FROM prismatic_message_stats
    GROUP BY user_id
  `;
  for (const r of totalRows as any[]) {
    if (!result[r.user_id]) {
      result[r.user_id] = { todayCount: 0, weekCount: 0, totalCount: 0, lastActivity: null };
    }
    result[r.user_id].totalCount = Number(r.total);
  }

  return result;
}

/**
 * Get usage for a specific user over N days with per-date breakdown.
 */
export async function getUserUsageDetail(userId: string, days: number = 7): Promise<{
  today: number;
  week: number;
  total: number;
  history: Array<{ date: string; count: number }>;
  rank?: number;
}> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  const todayCount = await getDailyMessageCount(userId, today);

  const weekRows = await sql`
    SELECT COALESCE(SUM(message_count), 0) as total
    FROM prismatic_message_stats
    WHERE user_id = ${userId}
      AND date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
  `;
  const weekCount = Number((weekRows[0] as any)?.total ?? 0);

  const totalRows = await sql`
    SELECT COALESCE(SUM(message_count), 0) as total
    FROM prismatic_message_stats
    WHERE user_id = ${userId}
  `;
  const totalCount = Number((totalRows[0] as any)?.total ?? 0);

  const historyRows = await sql`
    SELECT date, message_count as count
    FROM prismatic_message_stats
    WHERE user_id = ${userId}
      AND date >= CURRENT_DATE - INTERVAL '${sql.unsafe(days.toString())} days'
    ORDER BY date DESC
  `;

  // Rank among today's users
  const rankRows = await sql`
    SELECT COUNT(*) + 1 as rank
    FROM prismatic_message_stats
    WHERE date = ${today}
      AND message_count > (
        SELECT COALESCE(message_count, 0) FROM prismatic_message_stats
        WHERE user_id = ${userId} AND date = ${today}
      )
  `;
  const rank = Number((rankRows[0] as any)?.rank ?? 0);

  return {
    today: todayCount,
    week: weekCount,
    total: totalCount,
    history: (historyRows as any[]).map(r => ({ date: r.date, count: Number(r.count) })),
    rank: rank > 0 ? rank : undefined,
  };
}
