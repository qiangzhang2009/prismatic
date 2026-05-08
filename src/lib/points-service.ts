/**
 * 纯积分系统服务
 * 
 * 设计原则：
 * 1. 单一货币：每个积分对应一次 AI 互动
 * 2. 每日活水：每天 20 积分，不积累
 * 3. 充值兜底：充值积分永久有效
 * 4. 统一扣费：全站所有 AI 互动消耗积分
 * 
 * 积分消耗优先级：
 * - 优先消耗每日积分 (dailyCredits)
 * - 每日积分用完则消耗充值积分 (credits)
 * - 充值积分用完 → 弹窗提醒购买
 */

import { prisma } from '@/lib/prisma';
import { getPool } from '@/lib/db-pool';

export const DAILY_CREDITS = 20; // 每日积分
export const DAILY_RESET_HOUR = 0; // 凌晨 0 点重置

// ─── 积分检查结果 ──────────────────────────────────────────────────────────────

export interface PointsCheckResult {
  allowed: boolean;
  totalPoints: number;     // 总积分 = 每日积分 + 充值积分
  dailyPoints: number;     // 每日积分
  paidPoints: number;      // 充值积分
  reason?: string;          // allowed=false 时的原因
  code?: string;           // 错误码
}

// ─── 积分消耗结果 ──────────────────────────────────────────────────────────────

export interface PointsDeductResult {
  success: boolean;
  remainingPoints: number;
  dailyPointsRemaining: number;
  paidPointsRemaining: number;
  deductedFrom: 'daily' | 'paid' | 'both'; // 扣费来源
}

// ─── 检查用户积分 ──────────────────────────────────────────────────────────────

/**
 * 检查用户是否有足够的积分进行 AI 互动
 * 
 * @returns PointsCheckResult
 *   - allowed: 是否允许互动
 *   - totalPoints: 总积分
 *   - dailyPoints: 每日积分
 *   - paidPoints: 充值积分
 *   - reason: 拒绝原因
 *   - code: 错误码
 */
export async function checkUserPoints(userId: string): Promise<PointsCheckResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // 开发环境：允许所有请求
    return {
      allowed: true,
      totalPoints: 999,
      dailyPoints: 20,
      paidPoints: 0,
    };
  }

  const pool = getPool();

  // 获取用户积分信息
  const rows = await pool.query(
    `SELECT credits, "dailyCredits", "lastDailyResetAt"
     FROM users WHERE id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [userId]
  );

  if (rows.rows.length === 0) {
    return {
      allowed: false,
      totalPoints: 0,
      dailyPoints: 0,
      paidPoints: 0,
      reason: '用户不存在或已被禁用',
      code: 'USER_NOT_FOUND',
    };
  }

  const { credits, dailyCredits, lastDailyResetAt } = rows.rows[0] as {
    credits: number;
    dailyCredits: number;
    lastDailyResetAt: Date;
  };

  // 检查是否需要刷新每日积分
  const now = new Date();
  const resetTime = getResetTime();
  const lastReset = new Date(lastDailyResetAt);

  // 如果当前时间已过重置时间且上次重置不在今天，则需要重置
  let effectiveDailyCredits = dailyCredits;
  if (now >= resetTime && lastReset < resetTime) {
    // 每日积分已刷新（由定时任务处理），使用当前值
    effectiveDailyCredits = DAILY_CREDITS;
  }

  const totalPoints = effectiveDailyCredits + (credits || 0);
  const allowed = totalPoints > 0;

  return {
    allowed,
    totalPoints,
    dailyPoints: effectiveDailyCredits,
    paidPoints: credits || 0,
    reason: allowed ? undefined : '积分不足，请明天再来或充值',
    code: allowed ? undefined : 'POINTS_EXHAUSTED',
  };
}

// ─── 获取重置时间 ──────────────────────────────────────────────────────────────

function getResetTime(): Date {
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(DAILY_RESET_HOUR, 0, 0, 0); // 今天凌晨 0 点
  if (now < reset) {
    // 如果当前时间早于今天凌晨，说明还在昨天，需要设置为昨天凌晨
    reset.setDate(reset.getDate() - 1);
  }
  return reset;
}

// ─── 扣除积分 ─────────────────────────────────────────────────────────────────

/**
 * 扣除用户积分
 * 
 * 消耗优先级：
 * 1. 优先消耗每日积分
 * 2. 每日积分不足则消耗充值积分
 * 
 * @param userId 用户ID
 * @param amount 扣除数量（默认1）
 * @param options 额外选项
 * @returns PointsDeductResult
 */
export async function deductPoints(
  userId: string,
  amount: number = 1,
  options: {
    description: string;
    conversationId?: string;
    messageId?: string;
    ipAddress?: string;
    operatorId?: string;
  }
): Promise<PointsDeductResult> {
  if (amount <= 0) {
    return {
      success: false,
      remainingPoints: 0,
      dailyPointsRemaining: 0,
      paidPointsRemaining: 0,
      deductedFrom: 'daily',
    };
  }

  const pool = getPool();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 获取当前积分状态
    const rows = await client.query(
      `SELECT credits, "dailyCredits", "lastDailyResetAt"
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (rows.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }

    const { credits, dailyCredits, lastDailyResetAt } = rows.rows[0] as {
      credits: number;
      dailyCredits: number;
      lastDailyResetAt: Date;
    };

    const now = new Date();
    const resetTime = getResetTime();
    const lastReset = new Date(lastDailyResetAt);

    // 计算有效每日积分
    let effectiveDailyCredits = dailyCredits;
    if (now >= resetTime && lastReset < resetTime) {
      // 每日积分已过期，刷新为满额
      effectiveDailyCredits = DAILY_CREDITS;
    }

    const effectivePaidCredits = credits || 0;
    const totalPoints = effectiveDailyCredits + effectivePaidCredits;

    if (totalPoints < amount) {
      // 积分不足
      await client.query('ROLLBACK');
      return {
        success: false,
        remainingPoints: totalPoints,
        dailyPointsRemaining: effectiveDailyCredits,
        paidPointsRemaining: effectivePaidCredits,
        deductedFrom: 'daily',
      };
    }

    // 计算扣费
    let dailyDeduct = Math.min(amount, effectiveDailyCredits);
    let paidDeduct = amount - dailyDeduct;

    const newDailyCredits = effectiveDailyCredits - dailyDeduct;
    const newPaidCredits = effectivePaidCredits - paidDeduct;
    const newTotal = newDailyCredits + newPaidCredits;

    // 更新用户积分
    await client.query(
      `UPDATE users SET
         "dailyCredits" = $1,
         credits = $2,
         "lastDailyResetAt" = CASE
           WHEN $3::timestamp > "lastDailyResetAt"::timestamp THEN $3
           ELSE "lastDailyResetAt"
         END
       WHERE id = $4`,
      [newDailyCredits, newPaidCredits, resetTime, userId]
    );

    // 记录积分日志
    // 每日积分消耗
    if (dailyDeduct > 0) {
      await client.query(
        `INSERT INTO user_credit_logs
           ("id", "userId", type, amount, balance, "conversationId", "messageId", description, "ipAddress", "createdAt")
         VALUES ($1, $2, 'CONSUME', $3, $4, $5, $6, $7, $8, NOW())`,
        [
          `pts_${Date.now()}_d`,
          userId,
          -dailyDeduct,
          newTotal,
          options.conversationId || null,
          options.messageId || null,
          `[每日] ${options.description}`,
          options.ipAddress || null,
        ]
      );
    }

    // 充值积分消耗
    if (paidDeduct > 0) {
      await client.query(
        `INSERT INTO user_credit_logs
           ("id", "userId", type, amount, balance, "conversationId", "messageId", description, "ipAddress", "createdAt")
         VALUES ($1, $2, 'CONSUME', $3, $4, $5, $6, $7, $8, NOW())`,
        [
          `pts_${Date.now()}_p`,
          userId,
          -paidDeduct,
          newTotal,
          options.conversationId || null,
          options.messageId || null,
          `[充值] ${options.description}`,
          options.ipAddress || null,
        ]
      );
    }

    await client.query('COMMIT');
    return {
      success: true,
      remainingPoints: newTotal,
      dailyPointsRemaining: newDailyCredits,
      paidPointsRemaining: newPaidCredits,
      deductedFrom: paidDeduct > 0 && dailyDeduct > 0 ? 'both' : paidDeduct > 0 ? 'paid' : 'daily',
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ─── 充值积分 ─────────────────────────────────────────────────────────────────

/**
 * 增加用户充值积分（管理员手动充值 / 用户购买）
 */
export async function addPaidCredits(
  userId: string,
  amount: number,
  options: {
    type: 'RECHARGE' | 'ADMIN_ADD' | 'REFUND' | 'DAILY_GRANT';
    description: string;
    operatorId?: string;
    conversationId?: string;
    ipAddress?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) {
    return { success: false, newBalance: 0 };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 获取当前充值积分
    const rows = await client.query(
      `SELECT credits FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (rows.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }

    const currentCredits = rows.rows[0].credits || 0;
    const newBalance = currentCredits + amount;

    // 更新充值积分
    await client.query(
      `UPDATE users SET credits = $1 WHERE id = $2`,
      [newBalance, userId]
    );

    // 记录积分日志
    await client.query(
      `INSERT INTO user_credit_logs
         ("id", "userId", type, amount, balance, "conversationId", description, "operatorId", "ipAddress", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        `pts_add_${Date.now()}`,
        userId,
        options.type,
        amount,
        newBalance,
        options.conversationId || null,
        options.description,
        options.operatorId || null,
        options.ipAddress || null,
      ]
    );

    await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ─── 每日重置 ─────────────────────────────────────────────────────────────────

/**
 * 每日重置所有用户的每日积分（由定时任务调用）
 * 
 * 注意：这个函数会遍历所有活跃用户，性能可能较慢
 * 建议使用增量更新，只重置当天未刷新过的用户
 */
export async function resetDailyCredits(): Promise<{ resetCount: number }> {
  const pool = getPool();
  const resetTime = getResetTime();
  const resetTimeStr = resetTime.toISOString();

  // 只重置当天未重置的用户
  const result = await pool.query(
    `UPDATE users
     SET "dailyCredits" = $1,
         "lastDailyResetAt" = $2::timestamp
     WHERE status = 'ACTIVE'
       AND "lastDailyResetAt" < $2::timestamp
       AND "dailyCredits" < $1`,
    [DAILY_CREDITS, resetTimeStr]
  );

  // 记录每日重置日志
  await pool.query(
    `INSERT INTO user_credit_logs
       ("id", "userId", type, amount, balance, description, "createdAt")
     SELECT
       'daily_reset_' || $1 || '_' || id,
       id,
       'DAILY_RESET',
       $2 - "dailyCredits",
       $2,
       '每日积分重置',
       NOW()
     FROM users
     WHERE status = 'ACTIVE'
       AND "lastDailyResetAt" < $1::timestamp
       AND "dailyCredits" < $1`,
    [resetTimeStr, DAILY_CREDITS]
  );

  return { resetCount: result.rowCount || 0 };
}

// ─── 获取用户积分信息 ─────────────────────────────────────────────────────────

export interface UserPointsInfo {
  totalPoints: number;
  dailyPoints: number;
  paidPoints: number;
  lastResetAt: Date | null;
  isResetDue: boolean;
}

export async function getUserPointsInfo(userId: string): Promise<UserPointsInfo | null> {
  const pool = getPool();

  const rows = await pool.query(
    `SELECT credits, "dailyCredits", "lastDailyResetAt"
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (rows.rows.length === 0) {
    return null;
  }

  const { credits, dailyCredits, lastDailyResetAt } = rows.rows[0] as {
    credits: number;
    dailyCredits: number;
    lastDailyResetAt: Date;
  };

  const now = new Date();
  const resetTime = getResetTime();
  const lastReset = new Date(lastDailyResetAt);

  // 判断是否需要重置
  const isResetDue = now >= resetTime && lastReset < resetTime;

  // 计算有效积分
  let effectiveDailyCredits = dailyCredits;
  if (isResetDue) {
    effectiveDailyCredits = DAILY_CREDITS;
  }

  return {
    totalPoints: effectiveDailyCredits + (credits || 0),
    dailyPoints: effectiveDailyCredits,
    paidPoints: credits || 0,
    lastResetAt: lastReset,
    isResetDue,
  };
}

// ─── 兼容旧 API ────────────────────────────────────────────────────────────────

/**
 * @deprecated 使用 checkUserPoints 替代
 * 兼容旧的 checkUserDailyLimit 函数
 */
export async function checkUserDailyLimit(
  userId: string,
  _plan: string = 'FREE',
  _credits: number = 0
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  reason?: string;
}> {
  const result = await checkUserPoints(userId);

  return {
    allowed: result.allowed,
    current: result.totalPoints,
    limit: result.totalPoints + 1, // 估算
    reason: result.reason,
  };
}
