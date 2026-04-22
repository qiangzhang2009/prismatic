/**
 * 计费路由引擎
 *
 * 路由逻辑：
 * 1. 用户有有效 API Key → 模式 A（User-Pays），平台零成本
 * 2. 付费用户（MONTHLY/YEARLY/LIFETIME）→ 模式 B 平台代付，无限
 * 3. FREE 用户 → 模式 B，每天限制 10 次（由 checkUserDailyLimit 统一控制）
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

export async function resolveBillingMode(userId: string): Promise<BillingDecision> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyEncrypted: true,
      apiKeyIv: true,
      apiKeyProvider: true,
      apiKeyStatus: true,
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

  // 模式 A：User-Pays API Key
  if (user.apiKeyEncrypted && user.apiKeyStatus === 'valid' && user.apiKeyIv) {
    try {
      const apiKey = decryptApiKey(user.apiKeyEncrypted, user.apiKeyIv);
      const provider = (user.apiKeyProvider || 'deepseek') as LLMProviderType;
      return { mode: 'A', provider, apiKey, creditsToDeduct: 0, allowed: true };
    } catch (err) {
      console.warn('[Billing] API Key decrypt failed, falling back to mode B', err);
    }
  }

  // 模式 B：平台代付（FREE 用户的次数限制由 checkUserDailyLimit 统一控制）
  return {
    mode: 'B',
    provider: 'deepseek',
    platformApiKey: process.env.DEEPSEEK_API_KEY,
    creditsToDeduct: 0,
    allowed: true,
  };
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
