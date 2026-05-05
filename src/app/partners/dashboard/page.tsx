'use client';

/**
 * Partner Dashboard — /partners/dashboard?token=XXX
 * Full affiliate dashboard: stats, QR codes, conversions, withdrawals.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, TrendingUp, Wallet, QrCode, Copy,
  CheckCheck, ExternalLink, Loader2, ChevronRight, TrendingDown,
  Gift, Eye, RefreshCw, Download
} from 'lucide-react';

interface AffiliateStats {
  affiliate: {
    id: number;
    partner_id: string;
    name: string;
    wechat_id: string;
    referral_code: string;
    commission_type: string;
    commission_rate: number;
    commission_fixed: number;
    total_referrals: number;
    total_conversions: number;
    total_commission: number;
    pending_commission: number;
    withdrawn_commission: number;
    created_at: string;
  };
  recent_conversions: {
    id: number;
    plan: string;
    amount: string;
    commission: string;
    commission_status: string;
    created_at: string;
  }[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(n: any) {
  return Number(n ?? 0).toFixed(2);
}

export default function PartnersDashboardPage() {
  const [data, setData] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversions' | 'withdraw'>('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  const [token, setToken] = useState<string | null>(null);

  const [pendingApproval, setPendingApproval] = useState(false);

  const initDashboard = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/affiliates/dashboard?token=${token}`);
      const d = await res.json();
      if (d.pending_approval) {
        setPendingApproval(true);
        setData({ affiliate: d.affiliate, recent_conversions: [] });
      } else if (!res.ok) {
        throw new Error(d.error || 'Invalid or expired link');
      } else {
        setData(d);
      }
    } catch (e: any) {
      setError(e.message || '链接无效或已过期');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  useEffect(() => {
    initDashboard();
  }, [initDashboard]);

  const copyLink = () => {
    if (!data?.affiliate?.referral_code) return;
    const url = `https://prismatic.zxqconsulting.com/?ref=${data.affiliate.referral_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!data?.affiliate?.id || !token) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { setWithdrawMsg('请输入有效金额'); return; }
    if (amount > Number(data.affiliate.pending_commission)) {
      setWithdrawMsg(`可提现金额为 ¥${formatMoney(data.affiliate.pending_commission)}`);
      return;
    }
    setWithdrawLoading(true);
    setWithdrawMsg('');
    try {
      const res = await fetch(`/api/affiliates/withdrawals?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? '提现失败');
      setWithdrawMsg('提现申请已提交，请等待处理');
      setWithdrawAmount('');
      initDashboard();
    } catch (e: any) {
      setWithdrawMsg(e.message);
    } finally { setWithdrawLoading(false); }
  };

  const baseUrl = 'https://prismatic.zxqconsulting.com';
  const affiliateLink = useMemo(
    () => data?.affiliate ? `${baseUrl}/?ref=${data.affiliate.referral_code}` : '',
    [data?.affiliate]
  );
  const qrUrl = useMemo(
    () => affiliateLink ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(affiliateLink)}` : '',
    [affiliateLink]
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <p className="text-text-muted text-sm mb-4">请通过合伙人后台链接访问此页面</p>
        <Link href="/" className="text-prism-blue text-sm hover:underline">返回首页</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-prism-blue animate-spin mb-3" />
        <p className="text-sm text-text-muted">加载中...</p>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-elevated p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">账号审核中</h2>
          <p className="text-sm text-text-muted mb-6">
            您的合伙人账号正在审核中，管理员批准后即可正常使用。
          </p>
          {data?.affiliate?.name && (
            <p className="text-xs text-text-muted mb-4">
              账号：<span className="text-text-secondary">{data.affiliate.name}</span>
            </p>
          )}
          <Link href="/" className="text-prism-blue text-sm hover:underline">返回首页</Link>
        </div>
      </div>
    );
  }

  if (error || !data?.affiliate) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <p className="text-red-400 text-sm mb-4">{error || '加载失败'}</p>
        <Link href="/" className="text-prism-blue text-sm hover:underline">返回首页</Link>
      </div>
    );
  }

  const a = data.affiliate;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>返回首页</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <span className="text-sm text-text-secondary">合伙人后台</span>
          <span className="ml-auto text-xs text-prism-blue bg-prism-blue/10 px-2.5 py-1 rounded-full">
            {a.name}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* ── Stats Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: '我的佣金', value: `¥${formatMoney(a.total_commission)}`, sub: `待结算 ¥${formatMoney(a.pending_commission)}`, color: 'text-prism-blue', icon: Wallet },
            { label: '成功转化', value: String(a.total_conversions), sub: '付费成交用户', color: 'text-green-400', icon: TrendingUp },
            { label: '引流用户', value: String(a.total_referrals), sub: '注册用户数', color: 'text-purple-400', icon: Users },
            { label: '已提现', value: `¥${formatMoney(a.withdrawn_commission)}`, sub: '已结算佣金', color: 'text-amber-400', icon: Gift },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border-subtle bg-bg-elevated p-4">
              <p className="text-xs text-text-muted mb-2">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-text-muted mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Referral Link + QR ─────────────────────────────── */}
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6 mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-4">我的推广链接</h3>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface break-all">
                <span className="text-sm text-text-secondary font-mono text-xs">{affiliateLink}</span>
              </div>
            </div>
            <button
              onClick={copyLink}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-prism-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {copied ? <><CheckCheck className="w-4 h-4" /> 已复制</> : <><Copy className="w-4 h-4" /> 复制链接</>}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0 relative">
              {qrUrl ? (
                <>
                  <img src={qrUrl} alt="推广二维码" className="w-36 h-36 rounded-xl border border-border-subtle" />
                  <a
                    href={qrUrl}
                    download={`prismatic-ref-${data.affiliate.referral_code}.png`}
                    className="absolute bottom-1 right-1 bg-bg-base/80 text-[10px] text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded flex items-center gap-1"
                  >
                    <QrCode className="w-3 h-3" /> 下载
                  </a>
                </>
              ) : (
                <div className="w-36 h-36 rounded-xl border border-border-subtle bg-bg-surface flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-text-secondary">分享方式：</p>
              <div className="space-y-2">
                {[
                  { label: '微信群', tip: '直接分享二维码图片到微信群' },
                  { label: '朋友圈', tip: '长按保存二维码，发布朋友圈' },
                  { label: '私信', tip: '直接发送链接给好友' },
                ].map((s) => (
                  <div key={s.label} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-prism-blue mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-text-primary">{s.label}</p>
                      <p className="text-[11px] text-text-muted">{s.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div className="flex border-b border-border-subtle mb-6">
          {([
            ['overview', '数据总览'],
            ['conversions', `转化明细 (${a.total_conversions})`],
            ['withdraw', '提现'],
          ] as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-prism-blue text-prism-blue'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-primary">近期转化</h3>
                <button onClick={initDashboard} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 刷新
                </button>
              </div>
              {data.recent_conversions.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">暂无转化记录</p>
              ) : (
                <div className="space-y-3">
                  {data.recent_conversions.slice(0, 10).map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                      <div>
                        <p className="text-sm text-text-primary">{c.plan}</p>
                        <p className="text-xs text-text-muted">{formatDate(c.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-400">+¥{formatMoney(c.commission)}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          c.commission_status === 'paid' ? 'bg-green-500/15 text-green-400'
                          : c.commission_status === 'cancelled' ? 'bg-red-500/15 text-red-400'
                          : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {c.commission_status === 'paid' ? '已结算' : c.commission_status === 'cancelled' ? '已取消' : '待结算'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conversions */}
        {activeTab === 'conversions' && (
          <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
            {data.recent_conversions.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-12">暂无转化记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-text-muted border-b border-border-subtle">
                      <th className="text-left py-2 pr-4">套餐</th>
                      <th className="text-right py-2 px-4">实收金额</th>
                      <th className="text-right py-2 px-4">我的佣金</th>
                      <th className="text-right py-2 pl-4">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_conversions.map((c) => (
                      <tr key={c.id} className="border-b border-border-subtle last:border-0">
                        <td className="py-3 pr-4 text-text-primary">{c.plan}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">¥{formatMoney(c.amount)}</td>
                        <td className="py-3 px-4 text-right text-green-400 font-medium">+¥{formatMoney(c.commission)}</td>
                        <td className="py-3 pl-4 text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            c.commission_status === 'paid' ? 'bg-green-500/15 text-green-400'
                            : c.commission_status === 'cancelled' ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {c.commission_status === 'paid' ? '已结算' : c.commission_status === 'cancelled' ? '已取消' : '待结算'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Withdraw */}
        {activeTab === 'withdraw' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
              <h3 className="text-sm font-medium text-text-primary mb-1">申请提现</h3>
              <p className="text-xs text-text-muted mb-4">当前可提现：<span className="text-green-400 font-medium">¥{formatMoney(a.pending_commission)}</span></p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-text-secondary">¥</span>
                <input
                  type="number"
                  min="1"
                  max={formatMoney(a.pending_commission)}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder={formatMoney(a.pending_commission)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border-subtle bg-bg-surface text-sm text-text-primary focus:outline-none focus:border-prism-blue"
                />
                <button
                  onClick={() => setWithdrawAmount(formatMoney(a.pending_commission))}
                  className="text-xs text-prism-blue hover:underline"
                >
                  全部
                </button>
              </div>

              <div className="rounded-lg bg-bg-surface border border-border-subtle p-3 mb-4">
                <p className="text-xs text-text-muted mb-1">结算方式</p>
                <p className="text-sm text-text-primary">微信转账（微信号：{a.wechat_id}）</p>
              </div>

              {withdrawMsg && (
                <p className={`text-sm mb-3 ${withdrawMsg.includes('已提交') || withdrawMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
                  {withdrawMsg}
                </p>
              )}

              <button
                onClick={handleWithdraw}
                disabled={withdrawLoading || !withdrawAmount}
                className="w-full py-2.5 rounded-xl bg-prism-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {withdrawLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> 处理中...</> : '提交提现申请'}
              </button>

              <p className="text-[11px] text-text-muted text-center mt-3">
                提现申请提交后，管理员将在 1-3 个工作日内处理
              </p>
            </div>

            {/* Withdrawal history */}
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
              <h3 className="text-sm font-medium text-text-primary mb-4">提现记录</h3>
              <p className="text-xs text-text-muted text-center py-6">暂无提现记录</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
