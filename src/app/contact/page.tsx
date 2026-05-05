/**
 * Prismatic — Contact / Upgrade Page
 * 联系我们 · 升级高级版
 * Central hub for upgrade, payment, and contact info.
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hexagon, ArrowLeft, Github, MessageCircle, Crown,
  Zap, Check, X, Loader2, Copy, CheckCheck, ChevronRight
} from 'lucide-react';

/* ─── Payment Modal ──────────────────────────────────────────────────────────── */

const PAYMENT_PLANS: Record<string, { label: string; price: string; desc: string }> = {
  MONTHLY:  { label: '月度订阅', price: '¥29/月',   desc: '随时取消，自动续费' },
  YEARLY:   { label: '年度订阅', price: '¥199/年',  desc: '约¥17/月，省149元' },
  LIFETIME: { label: '终身会员', price: '¥399',     desc: '一次付费，永久有效' },
  starter:  { label: '尝鲜包（200条）', price: '¥9',  desc: '永久有效' },
  standard: { label: '标准包（600条）', price: '¥25', desc: '永久有效' },
  plus:     { label: '增强包（1500条）', price: '¥59', desc: '永久有效' },
};

function PaymentModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const info = PAYMENT_PLANS[planId] ?? { label: planId, price: '', desc: '' };

  const handleCopy = () => {
    navigator.clipboard.writeText('3740977');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-elevated p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-medium text-text-primary">{info.label}</h3>
            <p className="text-xs text-text-muted mt-0.5">{info.price} · 扫码支付</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-5">
          <div className="relative w-48 h-48 rounded-2xl overflow-hidden border border-border-medium shadow-xl mb-3">
            <Image src="/wechat-payment-1.png" alt="微信收款码" fill className="object-cover" unoptimized />
          </div>
          <p className="text-sm text-text-secondary">打开微信，扫描上方二维码付款</p>
        </div>

        <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <span className="text-green-400 font-bold text-sm">微</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">微信号</p>
                <p className="text-sm font-medium text-text-primary font-mono">3740977</p>
              </div>
            </div>
            <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-prism-blue hover:text-prism-blue/80 transition-colors">
              {copied ? <><CheckCheck className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制</>}
            </button>
          </div>
          <div className="border-t border-border-subtle pt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">支</span>
            </div>
            <div>
              <p className="text-xs text-text-muted">支付宝收款码</p>
              <p className="text-xs text-text-muted">如有需要，微信添加后说明需要支付宝</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-400 font-medium mb-1">付款后自动到账</p>
          <p className="text-[11px] text-text-muted">
            付款时备注「Prismatic」，付款后微信搜索 3740977 发送付款截图
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

const SUBSCRIPTION_PLANS = [
  { id: 'MONTHLY',  label: '月度订阅',  price: '¥29/月',  desc: '无限对话，自动续费', color: 'prism-blue',  popular: false },
  { id: 'YEARLY',   label: '年度订阅',  price: '¥199/年', desc: '约¥17/月，省149元', color: 'green-500', popular: true  },
  { id: 'LIFETIME', label: '终身会员',  price: '¥399',   desc: '一次付费，永久有效', color: 'prism-purple',popular: false },
];

const CREDIT_PACKS = [
  { id: 'starter',  label: '尝鲜包',  credits: '200条', price: '¥9',  note: '¥4.5/100条' },
  { id: 'standard',label: '标准包',  credits: '600条', price: '¥25', note: '最受欢迎', popular: true },
  { id: 'plus',    label: '增强包',  credits: '1500条', price: '¥59', note: '¥3.9/100条' },
];

export default function ContactPage() {
  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>返回首页</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-gradient mb-5 shadow-lg shadow-prism-blue/25">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-3">升级高级版</h1>
          <p className="text-text-secondary max-w-md mx-auto">
            扫码联系微信，备注「Prismatic」，立即解锁无限对话额度
          </p>
        </motion.div>

        {/* ── WeChat QR Hero Card ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-10 rounded-2xl border border-border-subtle bg-bg-elevated p-8 text-center"
        >
          <div className="inline-flex flex-col items-center gap-5">
            <div className="relative w-56 h-56 rounded-2xl overflow-hidden border-2 border-border-medium shadow-2xl">
              <Image src="/wechat-qr.png" alt="微信二维码" fill className="object-cover" unoptimized />
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">微信扫码 · 长按识别</p>
              <p className="text-2xl font-bold text-text-primary font-mono tracking-wider">3740977</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                '① 截图或扫码',
                '② 添加好友备注「Prismatic」',
                '③ 付款后发送截图，立刻开通',
              ].map((step) => (
                <span key={step} className="text-xs text-text-secondary bg-bg-surface px-3 py-1.5 rounded-full border border-border-subtle">
                  {step}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Subscription Plans ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">订阅套餐</h2>
            <span className="text-xs text-text-muted">永久有效 · 不过期</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className="relative rounded-2xl border p-5 text-center bg-bg-elevated"
                style={{
                  borderColor: plan.color === 'prism-blue'  ? 'rgba(99,102,241,0.3)'
                            : plan.color === 'green-500'   ? 'rgba(34,197,94,0.3)'
                            : 'rgba(168,85,247,0.3)',
                  background: plan.color === 'prism-blue'  ? 'linear-gradient(180deg, rgba(99,102,241,0.06), transparent)'
                            : plan.color === 'green-500'   ? 'linear-gradient(180deg, rgba(34,197,94,0.06), transparent)'
                            : 'linear-gradient(180deg, rgba(168,85,247,0.06), transparent)',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-medium px-3 py-1 rounded-full text-white"
                      style={{ background: plan.color === 'prism-blue' ? '#6366f1' : plan.color === 'green-500' ? '#22c55e' : '#a855f7' }}>
                      最划算
                    </span>
                  </div>
                )}
                <p className="text-sm font-medium text-text-primary mb-1">{plan.label}</p>
                <p className="text-2xl font-bold text-text-primary mb-0.5">{plan.price}</p>
                <p className="text-xs text-text-muted mb-4">{plan.desc}</p>
                <button
                  onClick={() => setPaymentPlan(plan.id)}
                  className="w-full py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: plan.color === 'prism-blue' ? '#6366f1' : plan.color === 'green-500' ? '#22c55e' : '#a855f7' }}
                >
                  微信购买
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Credit Packs ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">充值条数</h2>
            <span className="text-xs text-text-muted">永久有效 · 不清零</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div key={pack.id} className="relative rounded-2xl border border-border-subtle bg-bg-elevated p-5 text-center">
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-prism-purple text-white">最受欢迎</span>
                  </div>
                )}
                <p className="text-sm font-medium text-text-primary mb-1">{pack.label}</p>
                <p className="text-2xl font-bold text-text-primary mb-0.5">{pack.price}</p>
                <p className="text-xs text-text-muted mb-1">{pack.credits}</p>
                <p className="text-[11px] text-text-muted/60 mb-4">{pack.note}</p>
                <button
                  onClick={() => setPaymentPlan(pack.id)}
                  className="w-full py-2 rounded-xl text-sm font-medium bg-prism-blue text-white hover:opacity-90 transition-opacity"
                >
                  微信购买
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Feature highlights ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="mb-8"
        >
          <h2 className="text-lg font-medium text-text-primary mb-4 text-center">高级版权益</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['无限对话额度', '无每日次数限制'],
              ['全部 40+ 蒸馏人物', '包括未来新增人物'],
              ['8 种协作模式', '折射·圆桌·对决·任务等'],
              ['优先响应队列', '付费用户优先处理'],
              ['云端对话同步', '多设备无缝切换'],
              ['专属技术支持', '微信客服快速响应'],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated">
                <div className="w-6 h-6 rounded-full bg-prism-blue/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-prism-blue" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Other Contact ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          <a
            href="https://github.com/qiangzhang2009/prismatic"
            target="_blank" rel="noopener noreferrer"
            className="group rounded-2xl p-5 border border-border-subtle bg-bg-elevated hover:border-border-medium transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center group-hover:scale-110 transition-transform">
                <Github className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-text-primary">GitHub</h3>
                <p className="text-xs text-text-muted">Bug 反馈 · 功能建议</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          <div className="rounded-2xl p-5 border border-border-subtle bg-bg-elevated">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-text-primary">社区反馈</h3>
                <p className="text-xs text-text-muted">人物准确性 · 表达风格建议</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── About ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          className="rounded-2xl p-6 border border-border-subtle bg-bg-elevated"
        >
          <h2 className="font-semibold text-sm text-text-primary mb-2">关于 Prismatic</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            Prismatic 是一个开源 AI 多智能体协作平台，将人类卓越思维家的心智模型进行科学蒸馏，
            为用户提供多维度的认知协作体验。基于 MIT License 开源，欢迎各界贡献者参与。
          </p>
          <div className="mt-3 flex items-center gap-5 text-xs text-text-muted">
            <span>33+ 蒸馏人物</span>
            <span>8 种协作模式</span>
            <span>100+ 心智模型</span>
          </div>
        </motion.div>
      </main>

      <footer className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-secondary">Prismatic</span>
          </div>
          <div className="text-sm text-text-muted">
            MIT License · {new Date().getFullYear()}
          </div>
        </div>
      </footer>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentPlan && (
          <PaymentModal planId={paymentPlan} onClose={() => setPaymentPlan(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
