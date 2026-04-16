'use client';

/**
 * Prismatic — Subscribe Page
 * 会员订阅页面
 * - 订阅套餐说明
 * - 角色权限矩阵（Role = 功能权限）
 * - 套餐定价与财务测算（Plan = 用量配额）
 */

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Check, Shield, Crown, AlertTriangle,
  Zap, MessageCircle, TrendingUp, Users, DollarSign
} from 'lucide-react';

export default function SubscribePage() {
  return (
    <div className="min-h-screen bg-bg-base">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回首页</span>
        </Link>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-prism-amber" />
          <span className="text-sm font-medium text-text-primary">会员订阅</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-20">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-gradient mb-6">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold gradient-text mb-4">
            解锁全部思想家，探索无上限
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            订阅会员，解锁全部 8 种协作模式，获得无限对话额度。
            无论你是研究者、创作者还是终身学习者，这里都有你的思想伙伴。
          </p>
        </motion.div>

        {/* ── Subscription Plans ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-20"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-8 flex items-center justify-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            订阅套餐
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* FREE */}
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
              <div className="mb-4">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">免费体验</p>
                <p className="text-2xl font-bold text-text-primary">FREE</p>
              </div>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-3xl font-bold text-text-primary">¥0</span>
                <span className="text-sm text-text-muted mb-1">永久免费</span>
              </div>
              <div className="space-y-2 mb-6">
                {[
                  '每日 10 条对话额度',
                  '全部 40+ 蒸馏人物',
                  '单人对话模式',
                  '本地对话历史',
                ].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-text-muted mt-0.5">·</span>
                    {f}
                  </div>
                ))}
              </div>
              <div className="py-2.5 rounded-xl bg-bg-surface text-center text-sm text-text-muted cursor-default">
                免费使用
              </div>
            </div>

            {/* MONTHLY */}
            <div className="rounded-2xl border border-prism-blue/40 bg-gradient-to-b from-prism-blue/8 to-bg-elevated p-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-prism-blue text-white">
                  推荐
                </span>
              </div>
              <div className="mb-4">
                <p className="text-xs text-prism-blue uppercase tracking-wider mb-1">月度订阅</p>
                <p className="text-2xl font-bold text-text-primary">MONTHLY</p>
              </div>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-3xl font-bold text-text-primary">¥29</span>
                <span className="text-sm text-text-muted mb-1">/月</span>
              </div>
              <div className="space-y-2 mb-6">
                {[
                  '无限对话额度',
                  '全部 40+ 蒸馏人物',
                  '全部 8 种协作模式',
                  '优先响应队列',
                  '对话历史云同步',
                  '自定义 Persona',
                ].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { window.location.href = 'weixin://'; }}
                className="w-full py-2.5 rounded-xl bg-prism-blue text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                微信订阅 ¥29/月
              </button>
            </div>

            {/* YEARLY */}
            <div className="rounded-2xl border border-green-500/30 bg-gradient-to-b from-green-500/5 to-bg-elevated p-6">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-500 text-white">
                  年付更划算
                </span>
              </div>
              <div className="mb-4">
                <p className="text-xs text-green-400 uppercase tracking-wider mb-1">年度订阅</p>
                <p className="text-2xl font-bold text-text-primary">YEARLY</p>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-bold text-green-400">¥199</span>
                <span className="text-sm text-text-muted ml-1">一次性</span>
              </div>
              <p className="text-xs text-green-400 mb-4">相当于 ¥17/月，比月付省 ¥149/年</p>
              <div className="space-y-2 mb-6">
                {[
                  '永久无限额度',
                  '全部 40+ 蒸馏人物',
                  '全部 8 种协作模式',
                  '优先响应队列',
                  '对话历史云同步',
                  '自定义 Persona',
                ].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { window.location.href = 'weixin://'; }}
                className="w-full py-2.5 rounded-xl bg-green-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                微信订阅 ¥199/年
              </button>
            </div>
          </div>

          {/* LIFETIME */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="rounded-2xl border border-prism-purple/30 bg-gradient-to-b from-prism-purple/5 to-bg-elevated p-6 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-prism-purple uppercase tracking-wider mb-1">终身会员</p>
                  <p className="text-2xl font-bold text-text-primary">LIFETIME</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-prism-purple">¥399</span>
                  <p className="text-xs text-text-muted">一次性，永久有效</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 mb-5">
                {[
                  '永久无限额度，无需续费',
                  '全部 40+ 人物 + 未来新增人物',
                  '全部 8 种协作模式',
                  '最高优先级响应',
                  '云端同步 + 多设备支持',
                  '专属客服通道',
                ].map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-prism-purple flex-shrink-0 mt-0.5" />
                    {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { window.location.href = 'weixin://'; }}
                className="w-full py-2.5 rounded-xl bg-prism-purple text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                微信订阅 ¥399 终身会员
              </button>
            </div>
          </div>

          {/* Contact hint */}
          <p className="text-center text-xs text-text-muted mt-6">
            订阅或咨询：微信搜索 <span className="font-mono text-text-secondary font-medium">3740977</span>，备注「Prismatic会员」
          </p>
        </motion.div>

        {/* ── Role Permission Matrix ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-2 flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            角色权限矩阵（Role = 功能权限）
          </h2>
          <p className="text-sm text-text-muted text-center mb-8">
            角色决定你能使用哪些功能。与套餐（Plan）相互独立，可叠加
          </p>

          <div className="rounded-2xl border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-elevated border-b border-border-subtle">
                    <th className="text-left px-6 py-4 font-medium text-text-muted">权限项</th>
                    <th className="text-center px-4 py-4 font-medium text-gray-400">
                      普通用户<br /><span className="text-[10px] font-normal">FREE</span>
                    </th>
                    <th className="text-center px-4 py-4 font-medium text-amber-400">
                      高级用户<br /><span className="text-[10px] font-normal text-amber-400/60">PRO</span>
                    </th>
                    <th className="text-center px-4 py-4 font-medium text-prism-purple">
                      管理员<br /><span className="text-[10px] font-normal text-prism-purple/60">ADMIN</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {[
                    { feature: '每日对话额度', free: '10 条/天', pro: '无上限', admin: '无上限' },
                    { feature: '可用人物数量', free: '3 个 Persona', pro: '全部 40+', admin: '全部 40+' },
                    { feature: '协作模式', free: '仅 Solo 单人', pro: '全部 8 种模式', admin: '全部 8 种模式' },
                    { feature: '优先排队（高峰时）', free: '❌ 普通队列', pro: '✅ 优先响应', admin: '✅ 优先响应' },
                    { feature: '对话历史导出', free: '❌', pro: '✅ 图片/文本', admin: '✅ 图片/文本' },
                    { feature: '自定义 Persona 创建', free: '❌', pro: '✅', admin: '✅' },
                    { feature: '云端历史同步', free: '❌ 仅本地', pro: '✅', admin: '✅' },
                    { feature: '多设备支持', free: '❌', pro: '✅', admin: '✅' },
                    { feature: '专属客服', free: '❌', pro: '✅', admin: '✅' },
                    { feature: '管理员面板访问', free: '❌', pro: '❌', admin: '✅ 系统后台' },
                    { feature: '用户管理权限', free: '❌', pro: '❌', admin: '✅ 查看/编辑/禁用' },
                  ].map(row => (
                    <tr key={row.feature} className="hover:bg-bg-surface/50 transition-colors">
                      <td className="px-6 py-3.5 text-text-secondary font-medium">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center text-text-muted text-xs">{row.free}</td>
                      <td className="px-4 py-3.5 text-center text-amber-400 text-xs font-medium">{row.pro}</td>
                      <td className="px-4 py-3.5 text-center text-prism-purple text-xs font-medium">{row.admin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* ── Pricing & Financial Analysis ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="text-xl font-medium text-text-primary text-center mb-2 flex items-center justify-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            套餐定价与财务测算（Plan = 用量配额）
          </h2>
          <p className="text-sm text-text-muted text-center mb-8">
            套餐决定你的用量上限。我们坚持只收取覆盖成本的费用，让更多人用得起
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* API Cost */}
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
              <h3 className="font-medium text-text-primary mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-prism-blue" />
                Deepseek API 成本测算
              </h3>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: '模型', value: 'DeepSeek-V3.2 (deepseek-chat)' },
                  { label: 'Input（缓存未命中）', value: '¥0.0020 / 1K tokens' },
                  { label: 'Input（缓存命中）', value: '¥0.0002 / 1K tokens' },
                  { label: 'Output', value: '¥0.0030 / 1K tokens' },
                  { label: '单次对话估算', value: '≈ ¥0.00085（200 in + 150 out）' },
                  { label: '月度成本（10条/天）', value: '≈ ¥0.26 / 人/月' },
                  { label: '月度成本（无限制，日均50条）', value: '≈ ¥3.6 / 人/月' },
                ].map(item => (
                  <div key={item.label} className="flex items-start justify-between gap-3 py-1 border-b border-border-subtle last:border-0">
                    <span className="text-text-muted flex-shrink-0">{item.label}</span>
                    <span className="text-text-secondary font-medium text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan pricing */}
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
              <h3 className="font-medium text-text-primary mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                订阅套餐详情
              </h3>
              <div className="space-y-3">
                {[
                  { plan: '免费 FREE', price: '¥0', limit: '10 条/天', color: 'text-gray-400', bg: 'bg-gray-500/10', note: '' },
                  { plan: '月度订阅 MONTHLY', price: '¥29/月', limit: '无上限', color: 'text-prism-blue', bg: 'bg-prism-blue/10', note: '随时取消，自动续费' },
                  { plan: '年度订阅 YEARLY', price: '¥199/年 ≈ ¥17/月', limit: '无上限', color: 'text-green-400', bg: 'bg-green-400/10', note: '比月付省 ¥149/年' },
                  { plan: '终身订阅 LIFETIME', price: '¥399（一次性）', limit: '永久无上限', color: 'text-prism-purple', bg: 'bg-prism-purple/10', note: '永久有效' },
                ].map(item => (
                  <div key={item.plan} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${item.bg}`}>
                    <div>
                      <span className={`font-medium ${item.color}`}>{item.plan}</span>
                      {item.note && <p className="text-[10px] text-text-muted mt-0.5">{item.note}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${item.color}`}>{item.price}</span>
                      <p className="text-[10px] text-text-muted">{item.limit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Profitability table */}
          <div className="rounded-2xl border border-green-500/20 bg-gradient-to-b from-green-500/5 to-bg-elevated p-6">
            <h3 className="font-medium text-text-primary mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              盈亏平衡测算（以月度订阅 ¥29 为例）
            </h3>
            <p className="text-xs text-text-muted mb-4">数据基于 DeepSeek-V3.2 API 实际费率计算</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {['日均消息', '月消息量', 'API成本', '订阅收入', '毛利', '毛利率'].map(h => (
                      <th key={h} className="text-center py-2 px-3 text-[11px] text-text-muted font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {[
                    { daily: 10, msgs: 300, cost: '¥0.26', rev: '¥29', margin: '¥28.74', rate: '99.1%' },
                    { daily: 20, msgs: 600, cost: '¥0.51', rev: '¥29', margin: '¥28.49', rate: '98.2%' },
                    { daily: 50, msgs: 1500, cost: '¥1.28', rev: '¥29', margin: '¥27.72', rate: '95.6%' },
                    { daily: 100, msgs: 3000, cost: '¥2.55', rev: '¥29', margin: '¥26.45', rate: '91.2%' },
                    { daily: 200, msgs: 6000, cost: '¥5.10', rev: '¥29', margin: '¥23.90', rate: '82.4%' },
                  ].map(row => (
                    <tr key={row.daily} className="py-1.5">
                      <td className="text-center px-3 text-text-secondary">{row.daily} 条</td>
                      <td className="text-center px-3 text-text-muted">{row.msgs}</td>
                      <td className="text-center px-3 text-text-muted">{row.cost}</td>
                      <td className="text-center px-3 text-green-400 font-medium">{row.rev}</td>
                      <td className="text-center px-3 text-green-400 font-medium">{row.margin}</td>
                      <td className={`text-center px-3 font-medium ${parseFloat(row.rate) >= 80 ? 'text-green-400' : 'text-amber-400'}`}>
                        {row.rate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/15">
              <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-green-400">结论：</strong>即使日均 200 条重度用户，毛利率仍达 82% 以上。
                DeepSeek API 成本极低，订阅定价 ¥29/月 保本压力极小。
                未来用户量增长后，可考虑引入 Claude（高端档）做分层付费模型。
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <h2 className="text-xl font-medium text-text-primary mb-4 flex items-center justify-center gap-2">
            <Users className="w-5 h-5 text-prism-blue" />
            订阅或咨询
          </h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            微信搜索或扫码添加，备注「Prismatic会员」，我们将尽快与你联系
          </p>

          <div className="inline-flex flex-col items-center gap-4 p-8 rounded-2xl border border-border-subtle bg-bg-elevated">
            <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-border-subtle">
              <Image unoptimized src="/wechat-qr.png" alt="微信二维码" className="object-cover" fill />
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
              备注「Prismatic会员」或「Prismatic购买」
            </p>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
