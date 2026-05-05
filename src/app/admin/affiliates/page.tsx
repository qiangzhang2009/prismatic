'use client';

/**
 * Admin — Affiliates Management
 * /admin/affiliates
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, RefreshCw, CheckCircle2, XCircle, Eye, Loader2,
  ArrowUpDown, Search, TrendingUp, Wallet
} from 'lucide-react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmt(n: any) { return Number(n ?? 0).toFixed(2); }

type StatusFilter = 'all' | 'pending' | 'active' | 'paused';

interface Affiliate {
  id: number;
  partner_id: string;
  name: string;
  wechat_id: string;
  email: string | null;
  referral_code: string;
  commission_type: string;
  commission_rate: number;
  commission_fixed: number;
  status: string;
  total_referrals: number;
  total_conversions: number;
  total_commission: number;
  pending_commission: number;
  withdrawn_commission: number;
  bio: string | null;
  created_at: string;
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Affiliate | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliates?status=all', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAffiliates(data.affiliates ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const handleAction = async (id: number, action: 'approve' | 'reject' | 'pause' | 'activate') => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) fetchAffiliates();
    } finally { setActionLoading(null); }
  };

  const filtered = affiliates.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.wechat_id.toLowerCase().includes(q) || a.referral_code.toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    referrals: affiliates.reduce((s, a) => s + (a.total_referrals ?? 0), 0),
    conversions: affiliates.reduce((s, a) => s + (a.total_conversions ?? 0), 0),
    commission: affiliates.reduce((s, a) => s + Number(a.total_commission ?? 0), 0),
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top bar */}
      <div className="sticky top-0 z-10 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/admin" className="text-sm text-text-secondary hover:text-text-primary">← 管理后台</Link>
          <div className="w-px h-5 bg-border-subtle" />
          <h1 className="font-display font-semibold">合伙人管理</h1>
          <button onClick={fetchAffiliates} className="ml-auto flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: '合伙人总数', value: affiliates.length, sub: `待审核 ${affiliates.filter(a => a.status === 'pending').length}`, icon: Users, color: 'prism-blue' },
            { label: '引流用户', value: totals.referrals, sub: '总注册数', icon: TrendingUp, color: 'green-500' },
            { label: '成功转化', value: totals.conversions, sub: '付费用户', icon: CheckCircle2, color: 'prism-purple' },
            { label: '应付佣金', value: `¥${fmt(totals.commission)}`, sub: '累计佣金', icon: Wallet, color: 'amber-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border-subtle bg-bg-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-muted">{s.label}</p>
                <s.icon className={`w-4 h-4 text-${s.color}`} />
              </div>
              <p className={`text-2xl font-bold text-${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索姓名/微信号/邀请码"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'active', 'paused'] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                    : 'text-text-muted border border-border-subtle hover:text-text-primary'
                }`}
              >
                {f === 'all' ? '全部' : f === 'pending' ? '待审核' : f === 'active' ? '已激活' : '已暂停'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted text-sm">暂无数据</div>
        ) : (
          <div className="rounded-2xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-elevated border-b border-border-subtle">
                <tr className="text-xs text-text-muted">
                  <th className="text-left px-4 py-3">合伙人</th>
                  <th className="text-left px-4 py-3">邀请码</th>
                  <th className="text-center px-4 py-3">引流</th>
                  <th className="text-center px-4 py-3">转化</th>
                  <th className="text-right px-4 py-3">累计佣金</th>
                  <th className="text-right px-4 py-3">待结算</th>
                  <th className="text-center px-4 py-3">状态</th>
                  <th className="text-center px-4 py-3">申请时间</th>
                  <th className="text-center px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-surface/50">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="font-medium text-text-primary">{a.name}</p>
                        <p className="text-xs text-text-muted font-mono">{a.wechat_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono bg-bg-surface px-2 py-1 rounded-lg">{a.referral_code}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-text-secondary">{a.total_referrals}</td>
                    <td className="px-4 py-3.5 text-center text-text-secondary">{a.total_conversions}</td>
                    <td className="px-4 py-3.5 text-right text-green-400 font-medium">¥{fmt(a.total_commission)}</td>
                    <td className="px-4 py-3.5 text-right text-amber-400">¥{fmt(a.pending_commission)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                        a.status === 'active' ? 'bg-green-500/15 text-green-400'
                        : a.status === 'pending' ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400'
                      }`}>
                        {a.status === 'active' ? '已激活' : a.status === 'pending' ? '待审核' : '已暂停'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-text-muted">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelected(a)}
                          className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {a.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(a.id, 'approve')}
                              disabled={actionLoading === a.id}
                              className="w-7 h-7 rounded-lg bg-green-500/15 hover:bg-green-500/25 flex items-center justify-center text-green-400 transition-colors disabled:opacity-50"
                              title="批准"
                            >
                              {actionLoading === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleAction(a.id, 'reject')}
                              disabled={actionLoading === a.id}
                              className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/25 flex items-center justify-center text-red-400 transition-colors disabled:opacity-50"
                              title="拒绝"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {a.status === 'active' && (
                          <button
                            onClick={() => handleAction(a.id, 'pause')}
                            disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                            title="暂停"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {a.status === 'paused' && (
                          <button
                            onClick={() => handleAction(a.id, 'activate')}
                            disabled={actionLoading === a.id}
                            className="w-7 h-7 rounded-lg bg-bg-surface hover:bg-bg-elevated flex items-center justify-center text-green-400 transition-colors disabled:opacity-50"
                            title="重新激活"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-elevated p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-medium text-text-primary">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary">✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">合伙人ID</span><span className="text-text-primary font-mono">{selected.partner_id}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">微信号</span><span className="text-text-primary font-mono">{selected.wechat_id}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">邮箱</span><span className="text-text-primary">{selected.email ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">邀请码</span><span className="text-prism-blue font-mono">{selected.referral_code}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">佣金模式</span><span className="text-text-primary">{selected.commission_type === 'percentage' ? `比例 ${selected.commission_rate}%` : selected.commission_type === 'fixed' ? `固定 ¥${selected.commission_fixed}` : '两者取高'}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">引流用户</span><span className="text-text-primary">{selected.total_referrals}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">成功转化</span><span className="text-text-primary">{selected.total_conversions}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">累计佣金</span><span className="text-green-400 font-medium">¥{fmt(selected.total_commission)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">待结算</span><span className="text-amber-400">¥{fmt(selected.pending_commission)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">已提现</span><span className="text-text-primary">¥{fmt(selected.withdrawn_commission)}</span></div>
                {selected.bio && <div className="border-t border-border-subtle pt-3"><p className="text-xs text-text-muted mb-1">自我介绍</p><p className="text-sm text-text-secondary">{selected.bio}</p></div>}
              </div>
              <div className="mt-5 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-muted mb-2">推广链接</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-prism-blue bg-prism-blue/10 px-3 py-2 rounded-lg truncate">
                    https://prismatic.zxqconsulting.com/?ref={selected.referral_code}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`https://prismatic.zxqconsulting.com/?ref=${selected.referral_code}`)}
                    className="flex-shrink-0 text-xs text-prism-blue hover:underline"
                  >
                    复制
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
