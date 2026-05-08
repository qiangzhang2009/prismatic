/**
 * 计费路由引擎（兼容层）
 * 
 * 迁移说明：
 * 旧系统使用 credits 字段 + 每日免费额度
 * 新系统使用 credits(充值) + dailyCredits(每日) 统一积分
 * 
 * 此文件保留用于兼容，未来可删除
 */

import { deductPoints, checkUserPoints, addPaidCredits, type PointsCheckResult } from '@/lib/points-service';

export type BillingMode = 'A' | 'B';
export type LLMProviderType = 'deepseek' | 'openai' | 'anthropic';

export interface BillingDecision {
  mode: BillingMode;
  provider: LLMProviderType;
  apiKey?: string;
  platformApiKey?: string;
  creditsToDeduct: number;
  allowed: boolean;
  reason?: string;
  pointsCheck?: PointsCheckResult;
}

export async function resolveBillingMode(userId: string): Promise<BillingDecision> {
  // 检查用户积分
  const pointsResult = await checkUserPoints(userId);

  return {
    mode: 'B',
    provider: 'deepseek',
    platformApiKey: process.env.DEEPSEEK_API_KEY,
    creditsToDeduct: 0,
    allowed: pointsResult.allowed,
    reason: pointsResult.reason,
    pointsCheck: pointsResult,
  };
}

/**
 * 增加用户充值积分（管理员手动充值 / 退款等）
 */
export async function addCredits(
  userId: string,
  amount: number,
  options: {
    type: 'RECHARGE' | 'ADMIN_ADD' | 'REFUND';
    description: string;
    operatorId?: string;
    conversationId?: string;
    ipAddress?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  return addPaidCredits(userId, amount, {
    type: options.type,
    description: options.description,
    operatorId: options.operatorId,
    conversationId: options.conversationId,
    ipAddress: options.ipAddress,
  });
}

/**
 * 扣除用户积分（对话消耗 / 管理员手动扣除）
 */
export async function deductCredits(
  userId: string,
  amount: number,
  options: {
    description: string;
    operatorId?: string;
    conversationId?: string;
    ipAddress?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  const result = await deductPoints(userId, amount, {
    description: options.description,
    conversationId: options.conversationId,
    ipAddress: options.ipAddress,
  });

  return {
    success: result.success,
    newBalance: result.remainingPoints,
  };
}
