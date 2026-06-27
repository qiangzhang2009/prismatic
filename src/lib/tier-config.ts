/**
 * Prismatic — Tier Configuration
 * Pricing tiers for persona library access
 */

export const TIER_CONFIG = {
  FREE: {
    label: '免费体验', labelEn: 'Free',
    color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.25)', icon: '🌿',
    description: '可体验基础对话', price: '¥0',
    credits: 0, features: ['每日10条', '基础人物', '单次对话'],
  },
  MONTHLY: {
    label: '月度订阅', labelEn: 'Monthly',
    color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.25)', icon: '🚀',
    description: '完整访问所有人物', price: '¥68/月',
    credits: 100, features: ['每日100条', '全部人物', '折射视图'],
  },
  YEARLY: {
    label: '年度订阅', labelEn: 'Yearly',
    color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.25)', icon: '⭐',
    description: '最优惠的选择', price: '¥399/年',
    credits: 200, features: ['每日200条', '全部人物', '智辩场'],
  },
  LIFETIME: {
    label: '终身会员', labelEn: 'Lifetime',
    color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)', icon: '👑',
    description: '永久会员权益', price: '¥999',
    credits: Infinity, features: ['无限条数', '全部人物', '专属顾问'],
  },
} as const;

export type TierId = keyof typeof TIER_CONFIG;
