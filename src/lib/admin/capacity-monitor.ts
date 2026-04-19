/**
 * 容量监控核心函数
 * 监控 Neon Free Tier 数据库存储、连接数，并生成升级建议。
 */
import { prisma } from '@/lib/prisma';

export const NEON_LIMITS = {
  storageBytes: 512 * 1024 * 1024, // 0.5 GB
  maxConnections: 100,
};

export const STORAGE_WARNING_THRESHOLDS = {
  green:  0.70,
  yellow: 0.85,
  red:    0.95,
};

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  status: 'green' | 'yellow' | 'red';
  daysUntilFull: number | null;
  dailyGrowthBytes: number | null;
  messageCount: number;
  conversationCount: number;
  userCount: number;
}

export interface ComputeUsage {
  activeConnections: number;
  maxConnections: number;
  usedPercent: number;
  status: 'green' | 'yellow' | 'red';
}

export interface CapacityReport {
  storage: StorageUsage;
  compute: ComputeUsage;
  estimatedDaysBeforeLimit: number | null;
  recommendedTier: 'free' | 'standard' | 'pro';
  upgradeRecommendation: string;
  generatedAt: string;
}

function bytesToMB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * 获取数据库存储使用量（通过 pg_total_relation_size）
 * Neon 兼容的 SQL 查询
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  let usedBytes = 0;
  let messageCount = 0;
  let conversationCount = 0;
  let userCount = 0;

  try {
    const result = await prisma.$queryRaw<[{ total_bytes: bigint }]>`
      SELECT SUM(pg_total_relation_size(c.oid)) as total_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 't', 'm')
    `;
    usedBytes = Number(result[0]?.total_bytes || BigInt(0));
  } catch (err) {
    console.warn('[Capacity] Cannot query storage size (may lack permissions):', err);
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    [messageCount, conversationCount, userCount] = await Promise.all([
      prisma.message.count(),
      prisma.conversation.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);
  } catch (err) {
    console.warn('[Capacity] Cannot count records:', err);
  }

  const limitBytes = NEON_LIMITS.storageBytes;
  const usedPercent = limitBytes > 0 ? usedBytes / limitBytes : 0;

  let daysUntilFull: number | null = null;
  let dailyGrowthBytes: number | null = null;

  if (messageCount > 0) {
    try {
      const messageCount30d = await prisma.message.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      });
      const avgBytesPerMessage = 1024; // 1 KB 保守估算
      dailyGrowthBytes = Math.round((messageCount30d * avgBytesPerMessage) / 30);
      if (dailyGrowthBytes > 0) {
        daysUntilFull = Math.floor((limitBytes - usedBytes) / dailyGrowthBytes);
      }
    } catch (err) {
      console.warn('[Capacity] Cannot count recent messages:', err);
    }
  }

  const status: StorageUsage['status'] =
    usedPercent >= STORAGE_WARNING_THRESHOLDS.red   ? 'red'    :
    usedPercent >= STORAGE_WARNING_THRESHOLDS.yellow ? 'yellow' : 'green';

  return {
    usedBytes,
    limitBytes,
    usedPercent,
    status,
    daysUntilFull: daysUntilFull ?? null,
    dailyGrowthBytes,
    messageCount,
    conversationCount,
    userCount,
  };
}

/**
 * 获取数据库连接数使用量
 * Neon Free 对 pg_stat_activity 没有权限，降级处理
 */
export async function getComputeUsage(): Promise<ComputeUsage> {
  try {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'
    `;
    const activeConnections = Number(result[0]?.count || BigInt(0));
    const maxConnections = NEON_LIMITS.maxConnections;
    const usedPercent = activeConnections / maxConnections;
    return {
      activeConnections,
      maxConnections,
      usedPercent,
      status: usedPercent >= 0.80 ? 'yellow' : 'green',
    };
  } catch {
    // Neon Free 无权限，返回降级估算值
    return {
      activeConnections: 5,
      maxConnections: 100,
      usedPercent: 0.05,
      status: 'green',
    };
  }
}

/**
 * 生成完整容量报告
 */
export async function getCapacityReport(): Promise<CapacityReport> {
  const [storage, compute] = await Promise.all([
    getStorageUsage(),
    getComputeUsage(),
  ]);

  let estimatedDaysBeforeLimit: number | null = null;
  if (storage.daysUntilFull !== null) {
    estimatedDaysBeforeLimit = storage.daysUntilFull;
  }

  let recommendedTier: CapacityReport['recommendedTier'] = 'free';
  let upgradeRecommendation = '当前容量充足，继续观察。';

  if (storage.status === 'red') {
    recommendedTier = 'pro';
    upgradeRecommendation = `存储已达 ${(storage.usedPercent * 100).toFixed(1)}%，预计 ${storage.daysUntilFull} 天后耗尽。请立即升级至 Neon Standard（$20/月，含 3 GB 存储）。`;
  } else if (storage.status === 'yellow') {
    recommendedTier = 'standard';
    upgradeRecommendation = `存储使用率 ${(storage.usedPercent * 100).toFixed(1)}%，预计 ${storage.daysUntilFull} 天后达到上限。建议在 30 天内评估 Neon Standard。`;
  } else if (storage.usedPercent > 0.50) {
    recommendedTier = 'standard';
    upgradeRecommendation = '存储使用超过 50%，建议关注增长趋势，考虑提前规划 Standard Tier。';
  }

  return {
    storage,
    compute,
    estimatedDaysBeforeLimit,
    recommendedTier,
    upgradeRecommendation,
    generatedAt: new Date().toISOString(),
  };
}
