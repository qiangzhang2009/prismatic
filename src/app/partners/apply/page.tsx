'use client';

/**
 * Partner Application Page — /partners/apply
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, TrendingUp, Gift, CheckCircle2,
  MessageSquare, Loader2, ChevronRight, Zap, ShieldCheck
} from 'lucide-react';

const BENEFITS = [
  { icon: TrendingUp, title: '高佣金比例', desc: '成交金额 10% 起，永久分成' },
  { icon: Gift, title: '永久有效', desc: '你带来的客户，后续续费依然有分成' },
  { icon: MessageSquare, title: '专属二维码', desc: '一键生成带参数的推广二维码，方便微信群传播' },
  { icon: ShieldCheck, title: '实时统计', desc: '后台实时查看引流数据和佣金明细' },
];

const COMMISSION_TYPES = [
  { id: 'percentage', label: '按比例提成', desc: '按成交金额的比例计算佣金' },
  { id: 'fixed', label: '按固定金额', desc: '每单固定金额（适合高转化场景）' },
];

export default function PartnersApplyPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    wechat_id: '',
    email: '',
    commission_type: 'percentage',
    commission_rate: '20',
    commission_fixed: '',
    bio: '',
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.wechat_id) {
      setError('请填写姓名和微信号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          commission_rate: form.commission_type === 'percentage' ? Number(form.commission_rate) : 0,
          commission_fixed: form.commission_type === 'fixed' ? Number(form.commission_fixed) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '提交失败');
      setResult(data);
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="border-b border-border-subtle">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {step === 'form' ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-prism-blue to-prism-purple mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">成为推广合伙人</h1>
              <p className="text-sm text-text-secondary">分享 Prismatic，永久赚取佣金分成</p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated">
                  <div className="w-9 h-9 rounded-lg bg-prism-blue/15 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-prism-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{b.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6 space-y-4">
                <h2 className="text-base font-medium text-text-primary">基本信息</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">姓名/昵称 <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="你的名字或昵称"
                      className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">微信号 <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={form.wechat_id}
                      onChange={e => setForm(f => ({ ...f, wechat_id: e.target.value }))}
                      placeholder="用于结算佣金"
                      className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1.5">邮箱</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="选填，用于接收通知"
                    className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1.5">自我介绍</label>
                  <textarea
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="简单介绍一下自己（选填）"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue resize-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6 space-y-4">
                <h2 className="text-base font-medium text-text-primary">佣金模式</h2>
                <p className="text-xs text-text-muted">管理员审核通过后，将根据以下方式计算佣金</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COMMISSION_TYPES.map((ct) => (
                    <label
                      key={ct.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        form.commission_type === ct.id
                          ? 'border-prism-blue bg-prism-blue/5'
                          : 'border-border-subtle hover:border-border-medium'
                      }`}
                    >
                      <input
                        type="radio"
                        name="commission_type"
                        value={ct.id}
                        checked={form.commission_type === ct.id}
                        onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{ct.label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{ct.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {form.commission_type === 'percentage' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary">佣金比例</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={form.commission_rate}
                      onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                      className="w-20 px-3 py-2 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary focus:outline-none focus:border-prism-blue text-center"
                    />
                    <span className="text-sm text-text-secondary">%</span>
                    <span className="text-xs text-text-muted">（默认 10%，管理员可调整）</span>
                  </div>
                )}

                {form.commission_type === 'fixed' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary">每单固定</span>
                    <span className="text-sm text-text-muted">¥</span>
                    <input
                      type="number"
                      min="1"
                      value={form.commission_fixed}
                      onChange={e => setForm(f => ({ ...f, commission_fixed: e.target.value }))}
                      placeholder="5"
                      className="w-24 px-3 py-2 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary focus:outline-none focus:border-prism-blue"
                    />
                    <span className="text-xs text-text-muted">元（管理员可调整）</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-prism-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 提交申请...</> : '提交申请'}
              </button>

              <p className="text-center text-xs text-text-muted">
                提交后将由管理员审核，通过后即可获得专属推广链接
              </p>
            </form>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">申请已提交</h2>
            <p className="text-sm text-text-secondary mb-6">
              请等待管理员审核，通过后可在合伙人后台查看你的专属链接
            </p>

            {result?.dashboard_url && (
              <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5 mb-6">
                <p className="text-xs text-text-muted mb-2">审核通过后，访问以下地址登录合伙人后台：</p>
                <a
                  href={result.dashboard_url}
                  className="text-xs text-prism-blue hover:underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.dashboard_url}
                </a>
                <p className="text-[11px] text-text-muted mt-2">点击链接即可打开合伙人后台，建议收藏此页面</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/" className="px-5 py-2.5 rounded-xl border border-border-subtle text-sm text-text-secondary hover:bg-bg-surface transition-colors">
                返回首页
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
