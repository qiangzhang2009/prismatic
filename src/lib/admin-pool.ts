/**
 * Shared admin database pool — bypasses broken Prisma engine binary.
 * All admin API routes use this instead of Prisma Client.
 */
import { Pool, neon } from '@neondatabase/serverless';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    _pool = new Pool({ connectionString: url });
  }
  return _pool;
}

export async function closePool() {
  if (_pool) { await _pool.end(); _pool = null; }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function adminListUsers(opts: {
  page: number; pageSize: number; search?: string;
  status?: string; sortBy?: string; sortOrder?: string;
}) {
  const pool = getPool();
  const { page, pageSize, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' } = opts;
  const offset = (page - 1) * pageSize;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  let p = 1;

  // Status filter
  if (status === 'DELETED') {
    where += ` AND status = 'DELETED'`;
  } else if (status) {
    where += ` AND status = $${p++}`;
    params.push(status);
  } else {
    where += ` AND status != 'DELETED'`;
  }

  // Search
  if (search) {
    where += ` AND (LOWER(email) LIKE LOWER($${p++}) OR LOWER(name) LIKE LOWER($${p++}))`;
    const s = `%${search}%`;
    params.push(s, s);
  }

  // Order
  const col = sortBy === 'lastActive' ? 'updatedAt' : 'createdAt';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Main query with counts
  const q = `
    SELECT u.id, u.email, u.name, u.status, u.role, u.plan, u.credits, u.avatar,
           u.createdAt, u.updatedAt, u.preferences,
           (SELECT COUNT(*) FROM conversations c WHERE c."userId" = u.id) as "conversationCount",
           (SELECT COUNT(*) FROM messages m WHERE m."userId" = u.id) as "messageCount"
    FROM users u
    ${where}
    ORDER BY u."${col}" ${dir}
    LIMIT $${p++} OFFSET $${p++}
  `;
  params.push(pageSize, offset);

  const totalQ = `SELECT COUNT(*) as cnt FROM users u ${where}`;

  const [rows, countRows] = await Promise.all([
    pool.query(q, params),
    pool.query(totalQ, params.slice(0, -2)), // remove limit/offset
  ]);

  const total = parseInt(countRows.rows[0]?.cnt ?? '0', 10);

  const items = rows.rows.map(r => {
    let gender: string | null = null;
    let province: string | null = null;
    try {
      const prefs = typeof r.preferences === 'string' ? JSON.parse(r.preferences) : (r.preferences || {});
      gender = prefs.gender || null;
      province = prefs.province || null;
    } catch { /* ignore */ }
    return {
      id: r.id,
      email: r.email || '',
      name: r.name,
      gender,
      province,
      emailVerified: !!r.emailVerified,
      status: r.status,
      role: r.role || 'FREE',
      plan: r.plan || 'FREE',
      credits: r.credits || 0,
      avatar: r.avatar,
      conversationCount: parseInt(r.conversationCount ?? '0', 10),
      messageCount: parseInt(r.messageCount ?? '0', 10),
      lastActiveAt: null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  });

  return { items, total };
}

export async function adminGetUser(id: string) {
  const pool = getPool();
  const [userRows, convRows, msgRows] = await Promise.all([
    pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]),
    pool.query(`SELECT COUNT(*) as cnt FROM conversations WHERE "userId" = $1`, [id]),
    pool.query(`SELECT COUNT(*) as cnt FROM messages WHERE "userId" = $1`, [id]),
  ]);

  if (!userRows.rows[0]) return null;
  const r = userRows.rows[0];

  let gender: string | null = null;
  let province: string | null = null;
  try {
    const prefs = typeof r.preferences === 'string' ? JSON.parse(r.preferences) : (r.preferences || {});
    gender = prefs.gender || null;
    province = prefs.province || null;
  } catch { /* ignore */ }

  return {
    id: r.id,
    email: r.email || '',
    name: r.name,
    gender,
    province,
    emailVerified: !!r.emailVerified,
    status: r.status,
    role: r.role || 'FREE',
    plan: r.plan || 'FREE',
    credits: r.credits || 0,
    avatar: r.avatar,
    conversationCount: parseInt(convRows.rows[0]?.cnt ?? '0', 10),
    messageCount: parseInt(msgRows.rows[0]?.cnt ?? '0', 10),
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

export async function adminUpdateUser(id: string, updates: Record<string, unknown>) {
  const pool = getPool();
  if (Object.keys(updates).length === 0) return null;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(updates)) {
    if (v === null) {
      setClauses.push(`"${k}" = NULL`);
    } else if (typeof v === 'object' && v !== null) {
      setClauses.push(`"${k}" = $${i++}`);
      values.push(JSON.stringify(v));
    } else {
      setClauses.push(`"${k}" = $${i++}`);
      values.push(v);
    }
  }

  values.push(id);
  const q = `UPDATE users SET ${setClauses.join(', ')}, "updatedAt" = NOW() WHERE id = $${i} RETURNING *`;
  const result = await pool.query(q, values);
  return result.rows[0] ?? null;
}

export async function adminDeleteUser(id: string) {
  const pool = getPool();
  await pool.query(`UPDATE users SET status = 'DELETED', "updatedAt" = NOW() WHERE id = $1`, [id]);
  return true;
}

export async function adminAddCredits(userId: string, amount: number, description: string, operatorId: string) {
  const pool = getPool();
  // Get current balance
  const userR = await pool.query(`SELECT credits FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (!userR.rows[0]) throw new Error('User not found');
  const currentCredits = parseInt(userR.rows[0].credits ?? '0', 10);
  const newBalance = currentCredits + amount;

  // Update credits
  await pool.query(`UPDATE users SET credits = $1, "updatedAt" = NOW() WHERE id = $2`, [newBalance, userId]);

  // Insert log
  await pool.query(`
    INSERT INTO user_credit_logs ("userId", type, amount, balance, description, "operatorId", "createdAt")
    VALUES ($1, 'ADMIN_ADD', $2, $3, $4, $5, NOW())
  `, [userId, amount, newBalance, description || `管理员手动充值 ${amount} 积分`, operatorId]);

  return { newBalance };
}

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function adminListConversations(opts: {
  page: number; pageSize: number; search?: string; mode?: string;
  billingMode?: string; personaId?: string; dateFrom?: string; dateTo?: string; userId?: string;
}) {
  const pool = getPool();
  const { page, pageSize, search = '', mode = '', billingMode = '', personaId = '', dateFrom = '', dateTo = '', userId = '' } = opts;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (userId) { conditions.push(`c."userId" = $${p++}`); params.push(userId); }
  if (mode) { conditions.push(`c.mode = $${p++}`); params.push(mode); }
  if (dateFrom) { conditions.push(`c."createdAt" >= $${p++}`); params.push(new Date(dateFrom)); }
  if (dateTo) { conditions.push(`c."createdAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
  if (search) {
    conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND LOWER(m.content) LIKE LOWER($${p++}))`);
    params.push(`%${search}%`);
  }
  if (personaId) {
    conditions.push(`(c."personaIds" @> $${p++} OR EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m."personaId" = $${p++}))`);
    params.push(personaId, personaId);
  }
  if (billingMode === 'A') {
    conditions.push(`u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid'`);
  } else if (billingMode === 'B') {
    conditions.push(`(u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(pageSize, offset);

  const q = `
    SELECT c.id, c."userId", c.title, c.mode, c.participants, c.tags,
           c."messageCount", c."totalTokens", c."totalCost", c."personaIds",
           c."createdAt", c."updatedAt",
           u.id as "user.id", u.name as "user.name", u.email as "user.email",
           u.plan as "user.plan", u."apiKeyEncrypted" as "user.apiKeyEncrypted",
           u."apiKeyStatus" as "user.apiKeyStatus",
           msgs.data as messages
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'id', m.id, 'role', m.role, 'content', m.content,
        'personaId', m."personaId", 'tokensInput', m."tokensInput",
        'tokensOutput', m."tokensOutput", 'apiCost', m."apiCost",
        'modelUsed', m."modelUsed", 'createdAt', m."createdAt"
      ) ORDER BY m."createdAt" ASC) as data
      FROM messages m WHERE m."conversationId" = c.id
    ) msgs ON true
    ${where}
    ORDER BY c."createdAt" DESC
    LIMIT $${p++} OFFSET $${p++}
  `;

  const countQ = `SELECT COUNT(*) as cnt FROM conversations c LEFT JOIN users u ON u.id = c."userId" ${where}`;

  const [rows, countRows] = await Promise.all([
    pool.query(q, params),
    pool.query(countQ, params.slice(0, -2)),
  ]);

  const total = parseInt(countRows.rows[0]?.cnt ?? '0', 10);

  const conversations = rows.rows.map(r => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    mode: r.mode,
    participants: r.participants,
    tags: r.tags,
    messageCount: r.messageCount,
    totalTokens: r.totalTokens,
    totalCost: r.totalCost,
    personaIds: r.personaIds,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    billingMode: r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid' ? 'A' : 'B',
    user: r['user.id'] ? {
      id: r['user.id'],
      name: r['user.name'],
      email: r['user.email'],
      plan: r['user.plan'],
    } : null,
    messages: (r.messages || []).slice(0, 50),
  }));

  return { conversations, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function adminConversationsByUser(opts: {
  page: number; pageSize: number; search?: string; mode?: string;
  billingMode?: string; dateFrom?: string; dateTo?: string;
}) {
  const pool = getPool();
  const { page, pageSize, search = '', mode = '', billingMode = '', dateFrom = '', dateTo = '' } = opts;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (mode) { conditions.push(`c.mode = $${p++}`); params.push(mode); }
  if (dateFrom) { conditions.push(`c."createdAt" >= $${p++}`); params.push(new Date(dateFrom)); }
  if (dateTo) { conditions.push(`c."createdAt" <= $${p++}`); params.push(new Date(dateTo + 'T23:59:59Z')); }
  if (search) {
    conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND LOWER(m.content) LIKE LOWER($${p++}))`);
    params.push(`%${search}%`);
  }
  if (billingMode === 'A') {
    conditions.push(`u."apiKeyEncrypted" IS NOT NULL AND u."apiKeyStatus" = 'valid'`);
  } else if (billingMode === 'B') {
    conditions.push(`(u."apiKeyEncrypted" IS NULL OR u."apiKeyStatus" != 'valid')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const q = `
    SELECT c.*, u.id as "user.id", u.name as "user.name", u.email as "user.email",
           u.plan as "user.plan", u."apiKeyEncrypted" as "user.apiKeyEncrypted",
           u."apiKeyStatus" as "user.apiKeyStatus"
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
    ${where}
    ORDER BY c."createdAt" DESC
    LIMIT 1000
  `;

  const [rows] = await Promise.all([pool.query(q, params)]);

  // Group by userId
  const userMap: Record<string, {
    user: Record<string, unknown> | null; conversations: Record<string, unknown>[];
    totalMessages: number; totalCost: number; totalTokens: number;
    convCount: number; lastActivity: string;
  }> = {};

  for (const r of rows.rows) {
    const uid = r.userId;
    if (!userMap[uid]) {
      const hasApiKey = r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid';
      userMap[uid] = {
        user: r['user.id'] ? {
          id: r['user.id'], name: r['user.name'], email: r['user.email'],
          plan: r['user.plan'], apiKeyEncrypted: r['user.apiKeyEncrypted'], apiKeyStatus: r['user.apiKeyStatus'],
        } : null,
        conversations: [],
        totalMessages: 0, totalCost: 0, totalTokens: 0,
        convCount: 0, lastActivity: '',
      };
    }
    const hasApiKey = r['user.apiKeyEncrypted'] && r['user.apiKeyStatus'] === 'valid';
    userMap[uid].conversations.push({ ...r, billingMode: hasApiKey ? 'A' : 'B' });
    userMap[uid].totalMessages += r.messageCount || 0;
    userMap[uid].totalCost += Number(r.totalCost || 0);
    userMap[uid].totalTokens += r.totalTokens || 0;
    userMap[uid].convCount += 1;
    const act = r.updatedAt?.toISOString() || r.createdAt?.toISOString() || '';
    if (!userMap[uid].lastActivity || act > userMap[uid].lastActivity) {
      userMap[uid].lastActivity = act;
    }
  }

  const users = Object.values(userMap)
    .sort((a, b) => b.totalMessages - a.totalMessages || b.convCount - a.convCount);

  const paginated = users.slice((page - 1) * pageSize, page * pageSize);
  return {
    users: paginated,
    totalUsers: users.length,
    page, pageSize, totalPages: Math.ceil(users.length / pageSize),
  };
}

// ─── Topic clustering ─────────────────────────────────────────────────────────

export async function adminTopicData(days: number) {
  const pool = getPool();
  const startDate = new Date(Date.now() - days * 86400000);

  const [countRows, convRows] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM conversations WHERE "createdAt" >= $1 AND "messageCount" >= 2`, [startDate]),
    pool.query(`
      SELECT c.id, c.mode, c."createdAt",
             msgs.data as messages
      FROM conversations c
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('content', m.content) ORDER BY m."createdAt" ASC) as data
        FROM messages m WHERE m."conversationId" = c.id
      ) msgs ON true
      WHERE c."createdAt" >= $1 AND c."messageCount" >= 2
      ORDER BY c."messageCount" DESC
      LIMIT 500
    `, [startDate]),
  ]);

  const totalConversations = parseInt(countRows.rows[0]?.cnt ?? '0', 10);
  const conversations = convRows.rows.map((r: any) => ({
    ...r,
    messages: (r.messages || []).slice(0, 3),
  }));
  return { totalConversations, conversations };
}

// ─── Behavior clustering ─────────────────────────────────────────────────────

export async function adminBehaviorData(days: number) {
  const pool = getPool();
  const startDate = new Date(Date.now() - days * 86400000);

  const groupResult = await pool.query(`
    SELECT c."userId",
           COUNT(*) as "convCount",
           COALESCE(SUM(c."messageCount"), 0) as "msgCount",
           COALESCE(SUM(c."totalCost"::numeric), 0) as "costSum"
    FROM conversations c
    WHERE c."createdAt" >= $1
    GROUP BY c."userId"
    ORDER BY "convCount" DESC
    LIMIT 200
  `, [startDate]);

  const userIds = groupResult.rows.map((r: { userId: string }) => r.userId);
  const allRows = await pool.query(`
    SELECT id, name, email, plan, "apiKeyEncrypted"
    FROM users
    WHERE id = ANY($1::text[])
  `, [userIds]);

  const userMap: Record<string, Record<string, unknown>> = {};
  for (const u of allRows.rows) userMap[u.id] = u;

  return groupResult.rows.map(r => ({
    userId: r.userId,
    name: userMap[r.userId]?.name || userMap[r.userId]?.email || r.userId,
    plan: userMap[r.userId]?.plan || 'FREE',
    hasApiKey: !!userMap[r.userId]?.apiKeyEncrypted,
    conversationCount: parseInt(r.convCount ?? '0', 10),
    messageCount: parseInt(r.msgCount ?? '0', 10),
    totalCost: Number(r.costSum || 0),
  }));
}

// ─── Persona usage ────────────────────────────────────────────────────────────

export async function adminPersonaData(days: number) {
  const pool = getPool();
  const startDate = new Date(Date.now() - days * 86400000);

  const [msgRows, convRows] = await Promise.all([
    pool.query(`
      SELECT m."personaId",
             COUNT(*) as "msgCount",
             COALESCE(SUM(m."tokensInput" + m."tokensOutput"), 0) as "tokenSum",
             COALESCE(SUM(m."apiCost"::numeric), 0) as "costSum"
      FROM messages m
      WHERE m."createdAt" >= $1 AND m."personaId" IS NOT NULL
      GROUP BY m."personaId"
      ORDER BY "msgCount" DESC
    `, [startDate]),
    pool.query(`
      SELECT id, participants, "personaIds", "messageCount", "totalCost", "totalTokens"
      FROM conversations
      WHERE "createdAt" >= $1
      LIMIT 500
    `, [startDate]),
  ]);

  return { msgStats: msgRows.rows, convStats: convRows.rows };
}

// ─── User stats ──────────────────────────────────────────────────────────────

export async function adminUserStats() {
  const pool = getPool();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [totalRows, newRows, roleRows, planRows, activeRows] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM users WHERE status = 'ACTIVE'`),
    pool.query(`SELECT COUNT(*) as cnt FROM users WHERE status = 'ACTIVE' AND "createdAt" >= $1`, [todayStart]),
    pool.query(`SELECT role, COUNT(*) as cnt FROM users WHERE status = 'ACTIVE' GROUP BY role`),
    pool.query(`SELECT plan, COUNT(*) as cnt FROM users WHERE status = 'ACTIVE' GROUP BY plan`),
    pool.query(`SELECT COUNT(DISTINCT "userId") as cnt FROM conversations WHERE "createdAt" >= $1`, [todayStart]),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of roleRows.rows) byRole[r.role || 'FREE'] = parseInt(r.cnt ?? '0', 10);

  const byPlan: Record<string, number> = {};
  for (const r of planRows.rows) byPlan[r.plan || 'FREE'] = parseInt(r.cnt ?? '0', 10);

  return {
    totalUsers: parseInt(totalRows.rows[0]?.cnt ?? '0', 10),
    activeUsers: parseInt(activeRows.rows[0]?.cnt ?? '0', 10),
    newUsersToday: parseInt(newRows.rows[0]?.cnt ?? '0', 10),
    byRole,
    byPlan,
  };
}

// ─── User activity ─────────────────────────────────────────────────────────

export async function adminUserActivity(userId: string) {
  const pool = getPool();
  const [eventsR, sessionsR, metricsR] = await Promise.all([
    pool.query(`
      SELECT id, "eventType", "eventName", properties, context, "personaName",
             "conversationId", "createdAt"
      FROM user_events
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 50
    `, [userId]),
    pool.query(`
      SELECT "sessionId", "startedAt", "endedAt", "pageViews", "messagesSent",
             "deviceType", country
      FROM user_sessions
      WHERE "userId" = $1
      ORDER BY "startedAt" DESC
      LIMIT 10
    `, [userId]),
    pool.query(`
      SELECT "statDate", "messagesSent", "personasUsedCount", "timeSpentSeconds", "lastConversationAt"
      FROM daily_metrics
      WHERE "userId" = $1
      ORDER BY "statDate" DESC
      LIMIT 30
    `, [userId]),
  ]);

  return {
    events: eventsR.rows.map(r => ({ ...r, createdAt: r.createdAt?.toISOString() })),
    sessions: sessionsR.rows.map(r => ({ ...r, startedAt: r.startedAt?.toISOString(), endedAt: r.endedAt?.toISOString() })),
    metrics: metricsR.rows.map(r => ({ ...r, lastConversationAt: r.lastConversationAt?.toISOString() })),
  };
}

// ─── Sync stats ─────────────────────────────────────────────────────────────
// Tables may not exist — graceful empty fallback

export async function adminSyncStats() {
  const pool = getPool();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  async function safeQuery(sql: string, params: unknown[] = []) {
    try {
      return await pool.query(sql, params);
    } catch {
      return { rows: [] };
    }
  }

  const [deviceCount, localConvCount, syncLogCount, conflictCount, conflictsR,
    devicesR, logsR, dailyGroupR, successR] = await Promise.all([
    safeQuery(`SELECT COUNT(*) as cnt FROM devices`),
    safeQuery(`SELECT COUNT(*) as cnt FROM local_conversations`),
    safeQuery(`SELECT COUNT(*) as cnt FROM sync_logs`),
    safeQuery(`SELECT COUNT(*) as cnt FROM sync_conflicts WHERE resolution IS NULL`),
    safeQuery(`SELECT id, "userId", "conversationKey", "conflictType", resolution, "createdAt", "personaIds"
               FROM sync_conflicts ORDER BY "createdAt" DESC LIMIT 20`),
    safeQuery(`SELECT d.*, (SELECT COUNT(*) FROM local_conversations lc WHERE lc."deviceId" = d.id) as "conversationCount"
               FROM devices d ORDER BY "lastActiveAt" DESC LIMIT 20`),
    safeQuery(`SELECT sl.* FROM sync_logs sl ORDER BY sl."createdAt" DESC LIMIT 50`),
    safeQuery(`
      SELECT "createdAt"::date as day,
             COUNT(*) as "syncCount",
             COALESCE(SUM("pushedCount"), 0) as "pushedSum",
             COALESCE(SUM("pulledCount"), 0) as "pulledSum"
      FROM sync_logs
      WHERE "createdAt" >= $1
      GROUP BY day
      ORDER BY day
    `, [thirtyDaysAgo]),
    safeQuery(`SELECT "durationMs", "conflictCount" FROM sync_logs WHERE status = 'SUCCESS' ORDER BY "createdAt" DESC LIMIT 500`),
  ]);

  const totalDevices = parseInt(deviceCount.rows[0]?.cnt ?? '0', 10);
  const totalLocalConversations = parseInt(localConvCount.rows[0]?.cnt ?? '0', 10);
  const totalSyncLogs = parseInt(syncLogCount.rows[0]?.cnt ?? '0', 10);
  const unresolvedConflicts = parseInt(conflictCount.rows[0]?.cnt ?? '0', 10);

  const successLogs = successR.rows;
  const totalSyncs = successLogs.length;
  const avgDurationMs = totalSyncs > 0
    ? successLogs.reduce((s, l) => s + (l.durationMs || 0), 0) / totalSyncs : 0;
  const totalConflicts = successLogs.reduce((s, l) => s + (l.conflictCount || 0), 0);
  const avgConflictRate = totalSyncs > 0 ? totalConflicts / totalSyncs : 0;
  const syncSuccessRate = totalSyncLogs > 0 ? totalSyncs / totalSyncLogs : 0;

  const dailyStatsMap: Record<string, { date: string; pushCount: number; pullCount: number }> = {};
  for (const row of dailyGroupR.rows) {
    const key = new Date(row.day).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    dailyStatsMap[key] = {
      date: key,
      pushCount: parseInt(row.pushedSum ?? '0', 10),
      pullCount: parseInt(row.pulledSum ?? '0', 10),
    };
  }

  return {
    stats: { totalDevices, totalLocalConversations, totalSyncs, unresolvedConflicts, avgDurationMs, avgConflictRate, syncSuccessRate },
    conflicts: conflictsR.rows.map(r => ({ ...r, createdAt: r.createdAt?.toISOString() })),
    devices: devicesR.rows.map(r => ({
      ...r,
      conversationCount: r.conversationCount,
      lastActiveAt: r.lastActiveAt?.toISOString(),
      lastSyncedAt: r.lastSyncedAt?.toISOString(),
    })),
    recentLogs: logsR.rows.map(r => ({ ...r, createdAt: r.createdAt?.toISOString() })),
    dailyStats: Object.values(dailyStatsMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  };
}

// ─── Capacity / Neon stats ─────────────────────────────────────────────────

export async function adminCapacityReport() {
  const pool = getPool();

  let usedBytes = 0;
  let messageCount = 0;
  let conversationCount = 0;
  let userCount = 0;
  let messageCount30d = 0;

  try {
    const storageR = await pool.query(`
      SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0) as total_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 't', 'm')
    `);
    usedBytes = Number(storageR.rows[0]?.total_bytes || 0);
  } catch { /* no permission */ }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [msgR, convR, userR, msg30dR] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM messages`),
    pool.query(`SELECT COUNT(*) as cnt FROM conversations`),
    pool.query(`SELECT COUNT(*) as cnt FROM users WHERE status = 'ACTIVE'`),
    pool.query(`SELECT COUNT(*) as cnt FROM messages WHERE "createdAt" >= $1`, [thirtyDaysAgo]),
  ]);

  messageCount = parseInt(msgR.rows[0]?.cnt ?? '0', 10);
  conversationCount = parseInt(convR.rows[0]?.cnt ?? '0', 10);
  userCount = parseInt(userR.rows[0]?.cnt ?? '0', 10);
  messageCount30d = parseInt(msg30dR.rows[0]?.cnt ?? '0', 10);

  const limitBytes = 512 * 1024 * 1024; // Neon Free 0.5 GB
  const usedPercent = limitBytes > 0 ? usedBytes / limitBytes : 0;
  const dailyGrowthBytes = messageCount30d > 0 ? Math.round((messageCount30d * 1024) / 30) : 0;
  const daysUntilFull = dailyGrowthBytes > 0 ? Math.floor((limitBytes - usedBytes) / dailyGrowthBytes) : null;

  const storageStatus: 'green' | 'yellow' | 'red' =
    usedPercent >= 0.95 ? 'red' : usedPercent >= 0.85 ? 'yellow' : 'green';

  let recommendedTier: 'free' | 'standard' | 'pro' = 'free';
  let upgradeRecommendation = '当前容量充足，继续观察。';
  if (storageStatus === 'red') {
    recommendedTier = 'pro';
    upgradeRecommendation = `存储已达 ${(usedPercent * 100).toFixed(1)}%，预计 ${daysUntilFull} 天后耗尽。请立即升级。`;
  } else if (storageStatus === 'yellow') {
    recommendedTier = 'standard';
    upgradeRecommendation = `存储使用率 ${(usedPercent * 100).toFixed(1)}%，建议评估。`;
  } else if (usedPercent > 0.50) {
    recommendedTier = 'standard';
    upgradeRecommendation = '存储使用超过 50%，建议关注增长趋势。';
  }

  return {
    storage: { usedBytes, limitBytes, usedPercent, status: storageStatus, daysUntilFull, dailyGrowthBytes, messageCount, conversationCount, userCount },
    compute: { activeConnections: 5, maxConnections: 100, usedPercent: 0.05, status: 'green' as const },
    estimatedDaysBeforeLimit: daysUntilFull,
    recommendedTier,
    upgradeRecommendation,
    generatedAt: new Date().toISOString(),
  };
}
