'use client';

/**
 * Prismatic — Pricing Page
 * Clean, consumer-friendly pricing with no technical jargon
 */

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft, Zap, Check, MessageCircle, CreditCard
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

// ─── Credit Packs ──────────────────────────────────────────────────────────

const CREDIT_PACKS = [
  {
    id: 'starter',
    name: '尝鲜包',
    credits: 200,
    price: '¥9',
    perCredits: '200条',
    perPrice: '¥4.5/100条',
    description: '体验核心功能，适合轻度使用',
    color: 'blue',
    popular: false,
    badge: null,
  },
  {
    id: 'standard',
    name: '标准包',
    credits: 600,
    price: '¥25',
    perCredits: '600条',
    perPrice: '¥4.2/100条',
    description: '日常学习、研究的好选择',
    color: 'purple',
    popular: true,
    badge: '最受欢迎',
  },
  {
    id: 'plus',
    name: '增强包',
    credits: 1500,
    price: '¥59',
    perCredits: '1500条',
    perPrice: '¥3.9/100条',
    description: '重度用户、创作者首选',
    color: 'amber',
    popular: false,
    badge: '最划算',
  },
];

// ─── Subscription Plan ──────────────────────────────────────────────────────

const SUBSCRIPTION = {
  name: '月卡会员',
  price: '¥29',
  period: '/月',
  credits: 600,
  creditsPeriod: '每月',
  description: '订阅式，稳定使用',
  features: [
    '每月 600 条对话额度',
    '全部 40+ 蒸馏人物',
    '4 种协作模式',
    '对话历史云同步',
    '多端同步记录',
    '优先响应队列',
    '专属技术支持',
  ],
  color: 'blue',
  popular: false,
};

// ─── Free Tier Info ─────────────────────────────────────────────────────────

const FREE_TIER = {
  daily: 10,
  monthly: 30,
  features: [
    '每日 10 条免费对话额度',
    '3 个基础蒸馏人物（乔布斯、芒格、纳瓦尔）',
    'Solo 单人对话模式',
    '本地对话历史记录',
  ],
};

// ─── How it works ──────────────────────────────────────────────────────────

const QNA_EXAMPLES = [
  { scenario: '单人深度对话（Solo）', credits: 1, description: '发送一条消息，等待一个人物回复' },
  { scenario: '折射视图（Prism）', credits: 2, description: '2-3个人物同时回答同一问题' },
  { scenario: '圆桌辩论（Roundtable）', credits: 3, description: '4-8个人物进行多轮辩论' },
  { scenario: '任务模式（Mission）', credits: 4, description: '多角色分工协作完成复杂任务' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回首页</span>
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-gradient mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold gradient-text mb-4">
            按需付费，不浪费一分钱
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto mb-6">
            每次对话消耗对应条数，明码标价。充值条数永久有效，用完再买。
            我们坚持只收取覆盖运营成本的费用，让更多人能用上好东西。
          </p>

          {/* Free tier callout */}
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-green-500/20 bg-green-500/5 text-sm">
            <span className="text-green-400 font-medium">免费体验</span>
            <span className="text-text-muted">每日</span>
            <span className="text-green-400 font-bold">{FREE_TIER.daily}条</span>
            <span className="text-text-muted">对话额度，登录后即可使用</span>
          </div>
        </motion.div>

        {/* ── Credit Packs ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-2">
            💎 充值问答条数
          </h2>
          <p className="text-sm text-text-muted text-center mb-8">
            条数永久有效，用完再买，无月费压力
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CREDIT_PACKS.map((pack) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: CREDIT_PACKS.indexOf(pack) * 0.08 }}
                className="relative rounded-2xl border p-6 bg-bg-elevated hover:border-prism-blue/40 transition-all duration-200"
              >
                {pack.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                      pack.color === 'purple'
                        ? 'bg-prism-purple text-white'
                        : 'bg-prism-amber text-black'
                    }`}>
                      {pack.badge}
                    </span>
                  </div>
                )}

                <div className="mb-1">
                  <span className="text-xs text-text-muted">{pack.name}</span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold text-text-primary">{pack.price}</span>
                  <span className="text-sm text-text-muted mb-1">一次性</span>
                </div>
                <div className="text-sm text-text-secondary mb-4">
                  <span className="font-medium text-text-primary">{pack.credits}</span> 条对话额度
                  <span className="text-text-muted ml-1">({pack.perPrice})</span>
                </div>
                <p className="text-xs text-text-muted mb-6">{pack.description}</p>

                <button
                  onClick={() => { window.location.href = 'weixin://'; }}
                  className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    pack.color === 'purple'
                      ? 'bg-prism-purple text-white hover:opacity-90'
                      : pack.color === 'amber'
                      ? 'bg-prism-amber text-black hover:opacity-90'
                      : 'bg-prism-blue text-white hover:opacity-90'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  微信购买 {pack.price}
                </button>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-text-muted text-center mt-4">
            💡 充值条数永久有效，不清零，不过期
          </p>
        </motion.div>

        {/* ── Monthly Subscription ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-2">
            📅 月卡会员（订阅制）
          </h2>
          <p className="text-sm text-text-muted text-center mb-8">
            适合稳定使用的用户，每月自动续费，随时可取消
          </p>

          <div className="max-w-md mx-auto">
            <div className="rounded-2xl border border-prism-blue/30 bg-gradient-to-b from-prism-blue/8 to-bg-elevated p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-1">{SUBSCRIPTION.name}</h3>
                  <p className="text-xs text-text-muted">{SUBSCRIPTION.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-text-primary">{SUBSCRIPTION.price}</div>
                  <div className="text-sm text-text-muted">{SUBSCRIPTION.period}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-base border border-border-subtle mb-6">
                <Zap className="w-4 h-4 text-prism-blue" />
                <span className="text-sm text-text-primary">
                  每月 <span className="font-bold text-prism-blue">{SUBSCRIPTION.credits}</span> 条对话额度
                </span>
                  <span className="text-xs text-text-muted ml-auto">每月补充</span>
              </div>

              <ul className="space-y-3 mb-8">
                {SUBSCRIPTION.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => { window.location.href = 'weixin://'; }}
                className="w-full py-2.5 rounded-xl bg-prism-blue text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                微信订阅 {SUBSCRIPTION.price}{SUBSCRIPTION.period}
              </button>
              <p className="text-xs text-text-muted text-center mt-2">
                随时取消 · 次月生效 · 自动续费
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── How credits work ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-2">
            📊 问答条数如何计算
          </h2>
          <p className="text-sm text-text-muted text-center mb-8">
            不同模式消耗不同条数，条数 = 参与人物数 × 模式系数
          </p>

          <div className="rounded-2xl border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead className="bg-bg-elevated">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">协作模式</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-text-muted">消耗条数</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {QNA_EXAMPLES.map(({ scenario, credits, description }) => (
                  <tr key={scenario}>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">{scenario}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-prism-blue/10 text-prism-blue font-bold text-sm">
                        {credits}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-text-muted text-center mt-4">
            💡 圆桌辩论和任务模式消耗条数 = 参与人数 × 模式基础条数
          </p>
        </motion.div>

        {/* ── Free vs Paid ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-6">
            免费 vs 付费对比
          </h2>
          <div className="rounded-2xl border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead className="bg-bg-elevated">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">功能</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-text-muted">免费</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-text-muted">充值条数</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-text-muted">月卡会员</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {[
                  ['每日免费额度', `${FREE_TIER.daily}条/天`, '按需充值，无上限', '600条/月'],
                  ['可用人物', '3个（基础）', '全部 40+', '全部 40+'],
                  ['协作模式', 'Solo', '全部 4 种', '全部 4 种'],
                  ['对话历史', '仅本地', '仅本地', '云端同步'],
                  ['多设备同步', '不支持', '不支持', '支持'],
                  ['优先响应', '普通队列', '普通队列', '优先队列'],
                  ['专属客服', '不支持', '不支持', '支持'],
                  ['订阅月费', '¥0', '¥0（按需购买）', '¥29/月'],
                ].map(([feature, free, credits, sub]) => (
                  <tr key={feature as string}>
                    <td className="px-6 py-4 text-sm text-text-primary">{feature}</td>
                    <td className="px-6 py-4 text-sm text-center text-text-muted">{free}</td>
                    <td className="px-6 py-4 text-sm text-center text-prism-blue font-medium">{credits}</td>
                    <td className="px-6 py-4 text-sm text-center text-prism-purple font-medium">{sub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <h2 className="text-xl font-medium text-text-primary mb-4">购买或咨询</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            微信搜索或扫码添加，备注「Prismatic购买」，我们将尽快与你联系
          </p>

          <div className="inline-flex flex-col items-center gap-4 p-8 rounded-2xl border border-border-subtle bg-bg-elevated">
            <div className="w-48 h-48 rounded-xl overflow-hidden border border-border-subtle">
              <Image unoptimized src="/wechat-qr.png" alt="微信二维码" className="w-full h-full object-cover" fill />
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">微信号</p>
              <p className="text-lg font-bold text-text-primary font-mono">3740977</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <MessageCircle className="w-4 h-4" />
              微信搜索：3740977
            </div>
            <p className="text-xs text-text-muted text-center mt-1">
              备注「Prismatic购买」或「Prismatic会员」
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
