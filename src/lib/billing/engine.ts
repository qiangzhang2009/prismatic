/**
 * 双模式计费路由引擎
 *
 * 路由逻辑：
 * 1. 用户有有效 API Key → 模式 A（User-Pays），平台零成本
 * 2. 用户无 API Key：
 *    - 订阅用户 → 模式 B 平台代付，不扣积分
 *    - 积分用户 → 模式 B 平台代付，检查并扣减积分
 *
 * 返回值包含：使用哪个 API Key、消耗多少积分、是否允许继续
 */
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';

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
}

/**
 * 核心路由决策函数 — 在用户发消息时调用
 */
export async function resolveBillingMode(userId: string): Promise<BillingDecision> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyEncrypted: true,
      apiKeyIv: true,
      apiKeyProvider: true,
      apiKeyStatus: true,
      plan: true,
      credits: true,
    },
  });

  if (!user) {
    return {
      mode: 'B',
      provider: 'deepseek',
      platformApiKey: process.env.DEEPSEEK_API_KEY,
      creditsToDeduct: 0,
      allowed: false,
      reason: 'User not found',
    };
  }

  // ── 模式 A：User-Pays API Key ─────────────────────────────────
  if (
    user.apiKeyEncrypted &&
    user.apiKeyStatus === 'valid' &&
    user.apiKeyIv
  ) {
    try {
      const apiKey = decryptApiKey(user.apiKeyEncrypted, user.apiKeyIv);
      const provider = (user.apiKeyProvider || 'deepseek') as LLMProviderType;
      return {
        mode: 'A',
        provider,
        apiKey,
        creditsToDeduct: 0,
        allowed: true,
      };
    } catch (err) {
      console.warn('[Billing] API Key decrypt failed, falling back to mode B', err);
    }
  }

  // ── 模式 B：平台代付 ─────────────────────────────────────────
  const plan = user.plan || 'FREE';
  if (plan !== 'FREE') {
    return {
      mode: 'B',
      provider: 'deepseek',
      platformApiKey: process.env.DEEPSEEK_API_KEY,
      creditsToDeduct: 0,
      allowed: true,
    };
  }

  // FREE 用户检查积分
  const credits = user.credits || 0;
  const CONSUME_PER_MESSAGE = 1;
  if (credits < CONSUME_PER_MESSAGE) {
    return {
      mode: 'B',
      provider: 'deepseek',
      platformApiKey: process.env.DEEPSEEK_API_KEY,
      creditsToDeduct: 0,
      allowed: false,
      reason: 'INSUFFICIENT_CREDITS',
    };
  }

  return {
    mode: 'B',
    provider: 'deepseek',
    platformApiKey: process.env.DEEPSEEK_API_KEY,
    creditsToDeduct: CONSUME_PER_MESSAGE,
    allowed: true,
  };
}

/**
 * 扣减积分（原子事务）— 仅 FREE 用户使用模式 B 时扣减
 */
export async function deductCreditsIfNeeded(
  userId: string,
  amount: number,
  options: {
    conversationId?: string;
    messageId?: string;
    description: string;
    ipAddress?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) return { success: true, newBalance: 0 };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true, plan: true },
    });
    if (!user || user.plan !== 'FREE') {
      return { success: true, newBalance: user?.credits || 0 };
    }
    if ((user.credits || 0) < amount) {
      return { success: false, newBalance: user.credits || 0 };
    }

    const newBalance = user.credits - amount;
    await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });
    await tx.userCreditLog.create({
      data: {
        userId,
        type: 'CONSUME',
        amount: -amount,
        balance: newBalance,
        conversationId: options.conversationId,
        messageId: options.messageId,
        description: options.description,
        ipAddress: options.ipAddress,
      },
    });
    return { success: true, newBalance };
  });
}

/**
 * 增加用户积分（管理员手动充值 / 退款等）
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
  if (amount <= 0) return { success: false, newBalance: 0 };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const newBalance = (user.credits || 0) + amount;
    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
    await tx.userCreditLog.create({
      data: {
        userId,
        type: options.type,
        amount,
        balance: newBalance,
        description: options.description,
        operatorId: options.operatorId,
        conversationId: options.conversationId,
        ipAddress: options.ipAddress,
      },
    });
    return { success: true, newBalance };
  });
}

/**
 * 扣除用户积分（管理员手动扣除）
 */
export async function deductCredits(
  userId: string,
  amount: number,
  options: {
    description: string;
    operatorId?: string;
    ipAddress?: string;
  }
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) return { success: false, newBalance: 0 };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    if (!user) throw new Error('User not found');
    if ((user.credits || 0) < amount) {
      return { success: false, newBalance: user.credits || 0 };
    }

    const newBalance = user.credits - amount;
    await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    });
    await tx.userCreditLog.create({
      data: {
        userId,
        type: 'ADMIN_DEDUCT',
        amount: -amount,
        balance: newBalance,
        description: options.description,
        operatorId: options.operatorId,
        ipAddress: options.ipAddress,
      },
    });
    return { success: true, newBalance };
  });
}
