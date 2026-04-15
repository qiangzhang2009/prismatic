'use client';

/**
 * Prismatic — Admin Dashboard v2
 * World-class admin dashboard with actionable insights.
 * Every metric answers: "So what? What should I do?"
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Crown, TrendingUp, MessageSquare, Activity,
  BarChart2, Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle,
  Shield, Flame, TrendingDown, Zap, ChevronRight, Eye, Filter,
  ArrowUpRight, ArrowDownRight, UserCheck, UserX, Sparkles,
  Wallet, MousePointerClick, Repeat, CalendarDays, Timer,
  Target, UsersRound, BarChart3, PieChart, FlameKindling
} from 'lucide-react';

// ─── Data Types ──────────────────────────────────────────────────────────────

interface GlobalStats {
  total: number;
  totalAll: number;
  inactive: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
  verified: number;
}

interface UsageStats {
  todayTotal: number;
  weekTotal: number;
  avgDaily: number;
  dailyBreakdown: Array<{ date: string; total: number }>;
  byHour: Array<{ hour: number; count: number }>;
}

interface TopUser {
  userId: string;
  email?: string;
  name?: string;
  count: number;
  date: string;
}

interface AllUsersUsage {
  [userId: string]: {
    todayCount: number;
    weekCount: number;
    totalCount: number;
    lastActivity: string | null;
    sessionsCount?: number;
    avgSessionLength?: number;
  };
}

interface CohortedUser {
  userId: string;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  todayCount: number;
  weekCount: number;
  totalCount: number;
  daysSinceSignup: number;
  daysSinceActive: number;
  isActive: boolean;
  lifecycleStage: 'new' | 'active' | 'dormant' | 'churned';
}

interface RetentionBucket {
  cohort: string;
  count: number;
  retained: number[];
  rate: number[];
}

interface RevenueMetrics {
  mrr: number;
  payingUsers: number;
  arpu: number;
  upgradeRate: number;
}

interface EngagementDepth {
  light: number;
  medium: number;
  heavy: number;
  power: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [allUsage, setAllUsage] = useState<AllUsersUsage>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [days, setDays] = useState(14);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usageRes] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }),
        fetch(`/api/admin/usage?days=${days}`, { credentials: 'include' }),
      ]);
      if (statsRes.status === 403 || usageRes.status === 403) {
        setError('需要管理员权限');
        return;
      }
      if (!statsRes.ok || !usageRes.ok) throw new Error('API error');
      const [statsData, usageData] = await Promise.all([statsRes.json(), usageRes.json()]);
      setStats(statsData);
      setUsage(usageData.globalStats);
      setTopUsers(usageData.topUsers || []);
      setAllUsage(usageData.allUsersUsage || {});
      setLastRefresh(new Date());
    } catch {
      setError('获取数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Update "now" every minute for "active right now" display
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Computed Metrics ──────────────────────────────────────────────────────

  const payingUsers = (stats?.byPlan?.MONTHLY ?? 0) + (stats?.byPlan?.YEARLY ?? 0) + (stats?.byPlan?.LIFETIME ?? 0);
  const freeUsers = stats?.byPlan?.FREE ?? 0;
  const upgradeRate = stats?.total ? Math.round((payingUsers / stats.total) * 100) : 0;
  const verifiedRate = stats?.total ? Math.round(((stats.verified ?? 0) / stats.total) * 100) : 0;
  const avgDaily = usage?.avgDaily ?? 0;

  // Active users: had activity in last 7 days
  const activeUsers = Object.values(allUsage).filter(u => u.weekCount > 0).length;
  const totalUsers = stats?.total ?? 0;
  const weeklyActiveRate = totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0;

  // Churned users: no activity in 30 days
  const churnedUsers = Object.values(allUsage).filter(u => {
    if (!u.lastActivity) return false;
    const daysSince = (Date.now() - new Date(u.lastActivity).getTime()) / 86400000;
    return daysSince > 30;
  }).length;

  // DAU estimate: todayTotal / avg_daily_per_active_user (rough)
  const dauEstimate = usage?.todayTotal ?? 0;
  const mauEstimate = Object.values(allUsage).filter(u => u.totalCount > 0).length;
  const dauMauRatio = mauEstimate ? Math.round((dauEstimate / mauEstimate) * 100) : 0;

  // Peak hour
  const peakHour = usage?.byHour?.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 });

  // Engagement depth
  const engagement: EngagementDepth = {
    light: Object.values(allUsage).filter(u => u.weekCount >= 1 && u.weekCount <= 5).length,
    medium: Object.values(allUsage).filter(u => u.weekCount > 5 && u.weekCount <= 20).length,
    heavy: Object.values(allUsage).filter(u => u.weekCount > 20 && u.weekCount <= 50).length,
    power: Object.values(allUsage).filter(u => u.weekCount > 50).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-secondary hover:text-text-primary">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Shield className="w-5 h-5 text-prism-purple" />
            <div>
              <span className="font-medium text-text-primary">管理员面板</span>
              <span className="ml-2 text-xs text-text-muted bg-bg-surface px-2 py-0.5 rounded-full">
                v2
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-text-muted hidden sm:inline">
                {lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchData}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/admin/users" className="text-sm text-prism-blue hover:underline">用户管理</Link>
            <Link href="/app" className="text-sm text-text-secondary hover:text-text-primary">返回应用</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">控制台总览</h1>
            <p className="text-sm text-text-muted mt-1">
              {now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex gap-2">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  days === d ? 'bg-prism-blue text-white' : 'bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}>
                近{d}天
              </button>
            ))}
          </div>
        </div>

        {error && !stats ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button onClick={fetchData} className="text-prism-blue hover:underline">重试</button>
          </div>
        ) : (
          <>
            {/* ── Section 1: Primary KPI Strip ───────────────────────────────── */}
            <KPIStrip
              stats={stats}
              usage={usage}
              payingUsers={payingUsers}
              activeUsers={activeUsers}
              weeklyActiveRate={weeklyActiveRate}
              loading={loading}
            />

            {/* ── Section 2: Engagement Funnel + Revenue ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <EngagementFunnel
                engagement={engagement}
                total={activeUsers}
                loading={loading && !Object.keys(allUsage).length}
              />
              <RevenueCard
                payingUsers={payingUsers}
                freeUsers={freeUsers}
                upgradeRate={upgradeRate}
                total={totalUsers}
                loading={loading && !stats}
              />
              <LifecycleCard
                stats={stats}
                activeUsers={activeUsers}
                churnedUsers={churnedUsers}
                loading={loading && !stats}
              />
            </div>

            {/* ── Section 3: Usage Chart + Active Users ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <DailyUsageChart
                  usage={usage}
                  days={days}
                  loading={loading && !usage}
                />
              </div>
              <TopUsersPanel
                topUsers={topUsers}
                loading={loading && !topUsers.length}
              />
            </div>

            {/* ── Section 4: Insight Cards ───────────────────────────────────── */}
            <InsightsRow
              stats={stats}
              usage={usage}
              peakHour={peakHour}
              avgDaily={avgDaily}
              verifiedRate={verifiedRate}
              dauMauRatio={dauMauRatio}
              loading={loading}
            />

            {/* ── Section 5: Quick Actions ────────────────────────────────────── */}
            <QuickActionsRow stats={stats} />
          </>
        )}
      </main>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KPIStrip({ stats, usage, payingUsers, activeUsers, weeklyActiveRate, loading }: {
  stats: GlobalStats | null;
  usage: UsageStats | null;
  payingUsers: number;
  activeUsers: number;
  weeklyActiveRate: number;
  loading: boolean;
}) {
  const kpis = [
    {
      icon: Users,
      label: '总用户',
      value: stats?.totalAll ?? 0,
      sub: `${stats?.total ?? 0} 活跃 · +${stats?.recent ?? 0} 本月新`,
      accent: 'blue',
      delta: stats?.recent ? `+${stats.recent}` : undefined,
    },
    {
      icon: Sparkles,
      label: '本周活跃',
      value: activeUsers,
      sub: `周活跃率 ${weeklyActiveRate}%`,
      accent: 'green',
    },
    {
      icon: MessageSquare,
      label: '今日消息',
      value: usage?.todayTotal ?? 0,
      sub: `日均 ${usage?.avgDaily ?? 0} 条`,
      accent: 'cyan',
    },
    {
      icon: Repeat,
      label: '本周消息',
      value: usage?.weekTotal ?? 0,
      sub: `日均 ${usage?.avgDaily ?? 0} 条`,
      accent: 'purple',
    },
    {
      icon: Crown,
      label: '付费用户',
      value: payingUsers,
      sub: `占总 ${stats?.total ? Math.round(payingUsers / stats.total * 100) : 0}%`,
      accent: 'amber',
    },
    {
      icon: Wallet,
      label: '验证率',
      value: `${stats?.total ? Math.round((stats.verified ?? 0) / stats.total * 100) : 0}%`,
      sub: `${stats?.verified ?? 0} / ${stats?.total ?? 0}`,
      accent: 'rose',
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 hover:border-border-medium transition-colors"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
            kpi.accent === 'blue' ? 'bg-prism-blue/12 text-prism-blue' :
            kpi.accent === 'green' ? 'bg-green-400/12 text-green-400' :
            kpi.accent === 'cyan' ? 'bg-cyan-400/12 text-cyan-400' :
            kpi.accent === 'purple' ? 'bg-prism-purple/12 text-prism-purple' :
            kpi.accent === 'amber' ? 'bg-amber-400/12 text-amber-400' :
            'bg-rose-400/12 text-rose-400'
          }`}>
            <kpi.icon className="w-4.5 h-4.5" />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-2xl font-bold ${kpi.isText ? 'text-text-primary' : 'text-text-primary'}`}>
                {loading ? '-' : kpi.isText ? kpi.value : (typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value)}
              </p>
              <p className="text-xs font-medium text-text-primary mt-0.5">{kpi.label}</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{kpi.sub}</p>
            </div>
            {kpi.delta && (
              <span className="text-[10px] text-green-400 font-medium bg-green-400/10 px-1.5 py-0.5 rounded-full">
                {kpi.delta}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Engagement Funnel ───────────────────────────────────────────────────────

function EngagementFunnel({ engagement, total, loading }: {
  engagement: EngagementDepth;
  total: number;
  loading: boolean;
}) {
  const levels = [
    { key: 'light', label: '轻度用户', sub: '1-5条/周', color: 'bg-blue-400/60', accent: 'text-blue-400', bg: 'bg-blue-400/10' },
    { key: 'medium', label: '中度用户', sub: '6-20条/周', color: 'bg-green-400/60', accent: 'text-green-400', bg: 'bg-green-400/10' },
    { key: 'heavy', label: '重度用户', sub: '21-50条/周', color: 'bg-amber-400/60', accent: 'text-amber-400', bg: 'bg-amber-400/10' },
    { key: 'power', label: '超级用户', sub: '50+条/周', color: 'bg-prism-purple/80', accent: 'text-prism-purple', bg: 'bg-prism-purple/10' },
  ] as const;

  const maxVal = Math.max(engagement.light, engagement.medium, engagement.heavy, engagement.power, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-bg-elevated rounded-2xl border border-border-subtle p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">用户活跃分层</h3>
          <p className="text-xs text-text-muted mt-0.5">{total} 位本周活跃用户</p>
        </div>
        <MousePointerClick className="w-4 h-4 text-text-muted" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-8 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {levels.map(level => {
            const val = engagement[level.key];
            const pct = total ? Math.round((val / total) * 100) : 0;
            return (
              <div key={level.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${level.color}`} />
                    <span className={`text-xs font-medium ${level.accent}`}>{level.label}</span>
                    <span className="text-[10px] text-text-muted">{level.sub}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">{val.toLocaleString()}</span>
                    <span className="text-[10px] text-text-muted">({pct}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${level.color}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Revenue Card ────────────────────────────────────────────────────────────

function RevenueCard({ payingUsers, freeUsers, upgradeRate, total, loading }: {
  payingUsers: number;
  freeUsers: number;
  upgradeRate: number;
  total: number;
  loading: boolean;
}) {
  const planData = [
    { label: '终身', count: 0, color: 'bg-prism-purple' },
    { label: '年度', count: 0, color: 'bg-green-400' },
    { label: '月度', count: 0, color: 'bg-prism-blue' },
    { label: '免费', count: freeUsers, color: 'bg-text-muted' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-bg-elevated rounded-2xl border border-border-subtle p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">用户套餐分布</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {payingUsers} 人已付费 · 转化率 {upgradeRate}%
          </p>
        </div>
        <PieChart className="w-4 h-4 text-text-muted" />
      </div>

      {/* Stacked bar */}
      {loading ? (
        <div className="h-10 bg-bg-surface rounded-xl animate-pulse mb-4" />
      ) : (
        <div className="h-10 bg-bg-surface rounded-xl overflow-hidden flex mb-4">
          {total > 0 ? (
            <>
              <div className="h-full bg-prism-purple/80 transition-all" style={{ width: `${(0/total*100).toFixed(1)}%` }} />
              <div className="h-full bg-green-400/80 transition-all" style={{ width: `${(0/total*100).toFixed(1)}%` }} />
              <div className="h-full bg-prism-blue/80 transition-all" style={{ width: `${(0/total*100).toFixed(1)}%` }} />
              <div className="h-full bg-text-muted/50 transition-all" style={{ width: `${(freeUsers/total*100).toFixed(1)}%` }} />
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-text-muted text-xs">暂无数据</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="space-y-2">
        {[...planData].reverse().map(plan => (
          <div key={plan.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-sm ${plan.color}`} />
              <span className="text-xs text-text-secondary">{plan.label}</span>
            </div>
            <span className="text-xs font-medium text-text-primary">
              {loading ? '-' : plan.count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Conversion nudge */}
      {upgradeRate < 5 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-400/8 px-3 py-2 rounded-lg">
            <TrendingUp className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>转化率偏低，建议推送升级引导弹窗给高活跃免费用户</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Lifecycle Card ───────────────────────────────────────────────────────────

function LifecycleCard({ stats, activeUsers, churnedUsers, loading }: {
  stats: GlobalStats | null;
  activeUsers: number;
  churnedUsers: number;
  loading: boolean;
}) {
  const newUsers = stats?.recent ?? 0;
  const dormantUsers = (stats?.total ?? 0) - activeUsers - churnedUsers;
  const dormantRate = stats?.total ? Math.round((dormantUsers / stats.total) * 100) : 0;

  const stages = [
    { label: '新用户', count: newUsers, color: 'text-green-400', bg: 'bg-green-400/10', bar: 'bg-green-400/60', icon: UserCheck },
    { label: '活跃用户', count: activeUsers, color: 'text-prism-blue', bg: 'bg-prism-blue/10', bar: 'bg-prism-blue/60', icon: Sparkles },
    { label: '沉睡用户', count: dormantUsers, color: 'text-amber-400', bg: 'bg-amber-400/10', bar: 'bg-amber-400/60', icon: Timer },
    { label: '流失用户', count: churnedUsers, color: 'text-red-400', bg: 'bg-red-400/10', bar: 'bg-red-400/60', icon: UserX },
  ];

  const maxCount = Math.max(newUsers, activeUsers, dormantUsers, churnedUsers, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-bg-elevated rounded-2xl border border-border-subtle p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">用户生命周期</h3>
          <p className="text-xs text-text-muted mt-0.5">当前分布</p>
        </div>
        <CalendarDays className="w-4 h-4 text-text-muted" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-bg-surface rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {stages.map(stage => {
            const pct = maxCount > 0 ? Math.round((stage.count / maxCount) * 100) : 0;
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg ${stage.bg} flex items-center justify-center flex-shrink-0`}>
                  <stage.icon className={`w-3.5 h-3.5 ${stage.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{stage.label}</span>
                    <span className={`text-xs font-semibold ${stage.color}`}>{stage.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${stage.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dormantRate > 30 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-400/8 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>沉睡率{dormantRate}%偏高，建议触达近30天未活跃用户推送召回</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Daily Usage Chart ────────────────────────────────────────────────────────

function DailyUsageChart({ usage, days, loading }: {
  usage: UsageStats | null;
  days: number;
  loading: boolean;
}) {
  const maxDaily = usage?.dailyBreakdown?.reduce((m, d) => Math.max(m, d.total), 0) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-bg-elevated rounded-2xl border border-border-subtle p-5 h-full"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">每日消息量趋势</h3>
          <p className="text-xs text-text-muted mt-0.5">近{days}天 · 单位：条</p>
        </div>
        {usage && (
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-prism-blue" />
              <span>今日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-prism-purple/60" />
              <span>历史</span>
            </div>
          </div>
        )}
      </div>

      {loading && !usage ? (
        <div className="h-40 flex items-end gap-2">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex-1 bg-bg-surface rounded-t animate-pulse" style={{ height: `${30 + Math.random() * 60}%` }} />
          ))}
        </div>
      ) : !usage?.dailyBreakdown?.length ? (
        <div className="h-40 flex flex-col items-center justify-center text-text-muted">
          <BarChart2 className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      ) : (
        <div className="relative">
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[11px] text-text-muted text-right pr-2">
            <span>{maxDaily}</span>
            <span>{Math.round(maxDaily / 2)}</span>
            <span>0</span>
          </div>

          <div className="ml-14 flex items-end gap-1 h-40">
            {usage!.dailyBreakdown.map((day, i) => {
              const heightPct = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end justify-center h-36">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPct, 1.5)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }}
                      className={`w-full rounded-t-md transition-colors ${
                        isToday ? 'bg-prism-blue' : 'bg-prism-purple/50 hover:bg-prism-purple/70'
                      }`}
                    />
                  </div>
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none">
                    <div className="bg-bg-overlay border border-border-subtle rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                      <p className="text-xs text-text-primary font-medium">{day.date}</p>
                      <p className="text-xs text-prism-blue">{day.total} 条</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted leading-none">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {usage && (
        <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-6 text-xs text-text-muted">
          <span>今日: <span className="text-text-primary font-medium">{usage.todayTotal}</span> 条</span>
          <span>本周: <span className="text-text-primary font-medium">{usage.weekTotal}</span> 条</span>
          <span>日均: <span className="text-text-primary font-medium">{usage.avgDaily}</span> 条</span>
          {usage.weekTotal > 0 && (
            <span className="ml-auto">
              相比上周:{' '}
              <span className={usage.todayTotal > (usage.weekTotal / days) ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                {usage.todayTotal > (usage.weekTotal / days) ? '+' : ''}
                {Math.round(((usage.todayTotal) / (usage.weekTotal / days) - 1) * 100)}%
              </span>
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Top Users Panel ──────────────────────────────────────────────────────────

function TopUsersPanel({ topUsers, loading }: { topUsers: TopUser[]; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-bg-elevated rounded-2xl border border-border-subtle p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">今日活跃 TOP 5</h3>
          <p className="text-xs text-text-muted mt-0.5">按消息量排名</p>
        </div>
        <TrendingUp className="w-4 h-4 text-text-muted" />
      </div>

      {loading && !topUsers.length ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-bg-surface animate-pulse" />
            <div className="flex-1 h-4 bg-bg-surface rounded animate-pulse" />
            <div className="w-10 h-4 bg-bg-surface rounded animate-pulse" />
          </div>
        ))}</div>
      ) : topUsers.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">暂无活跃用户</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {topUsers.slice(0, 5).map((u, i) => (
            <div key={u.userId} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-surface transition-colors">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i === 0 ? 'bg-amber-400/20 text-amber-400' :
                i === 1 ? 'bg-gray-300/20 text-gray-300' :
                i === 2 ? 'bg-orange-400/20 text-orange-400' :
                'bg-bg-surface text-text-muted'
              }`}>
                {i + 1}
              </div>
              <div className="w-8 h-8 rounded-full bg-prism-gradient flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {u.name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{u.name || u.email || '未知用户'}</p>
                <p className="text-[10px] text-text-muted truncate">{u.email || ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-prism-blue">{u.count}</p>
                <p className="text-[10px] text-text-muted">条消息</p>
              </div>
            </div>
          ))}
          <Link
            href="/admin/users?sort=messages"
            className="flex items-center justify-center gap-1 pt-2 text-xs text-prism-blue hover:underline"
          >
            查看完整排名 <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ─── Insights Row ─────────────────────────────────────────────────────────────

function InsightsRow({ stats, usage, peakHour, avgDaily, verifiedRate, dauMauRatio, loading }: {
  stats: GlobalStats | null;
  usage: UsageStats | null;
  peakHour: { hour: number; count: number } | undefined;
  avgDaily: number;
  verifiedRate: number;
  dauMauRatio: number;
  loading: boolean;
}) {
  const insights = [
    {
      icon: Clock,
      label: '用户活跃高峰',
      value: peakHour ? `${peakHour.hour.toString().padStart(2, '0')}:00` : '-',
      sub: `此时段消息量 ${peakHour?.count ?? 0} 条`,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      insight: peakHour && peakHour.hour >= 20
        ? '晚间用户活跃，建议此时推送通知'
        : peakHour && peakHour.hour <= 10
        ? '早间用户活跃，适合推送早间内容'
        : '用户分布较均匀',
    },
    {
      icon: BarChart3,
      label: '日均消息',
      value: avgDaily.toString(),
      sub: '近7天平均每日',
      color: 'text-prism-blue',
      bg: 'bg-prism-blue/10',
      insight: avgDaily > 50
        ? '用户参与度良好'
        : avgDaily > 20
        ? '参与度中等，有提升空间'
        : '参与度偏低，需要激活策略',
    },
    {
      icon: Target,
      label: 'DAU/MAU 比率',
      value: `${dauMauRatio}%`,
      sub: '用户粘性指标',
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      insight: dauMauRatio > 20
        ? '产品粘性优秀，用户习惯已养成'
        : dauMauRatio > 10
        ? '粘性中等，需提升回访率'
        : '粘性偏低，留存是首要任务',
    },
    {
      icon: CheckCircle,
      label: '邮箱验证率',
      value: `${verifiedRate}%`,
      sub: `${stats?.verified ?? 0}/${stats?.total ?? 0}`,
      color: 'text-prism-purple',
      bg: 'bg-prism-purple/10',
      insight: verifiedRate > 70
        ? '用户质量高，邮箱触达率高'
        : '建议注册时强制验证邮箱',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {insights.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 + i * 0.05 }}
          className="rounded-2xl border border-border-subtle bg-bg-elevated p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{loading ? '-' : item.value}</p>
          <p className="text-xs font-medium text-text-primary mt-0.5">{item.label}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{loading ? '' : item.sub}</p>
          {!loading && (
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <p className="text-[11px] text-text-muted leading-relaxed">
                <span className="text-text-secondary font-medium">洞察：</span>
                {item.insight}
              </p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActionsRow({ stats }: { stats: GlobalStats | null }) {
  const payingUsers = (stats?.byPlan?.MONTHLY ?? 0) + (stats?.byPlan?.YEARLY ?? 0) + (stats?.byPlan?.LIFETIME ?? 0);
  const freeUsers = stats?.byPlan?.FREE ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mb-6"
    >
      <h2 className="text-base font-semibold text-text-primary mb-4">快速操作</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users" className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface hover:border-border-medium transition-all group">
          <div className="w-10 h-10 rounded-xl bg-prism-blue/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-prism-blue" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">用户管理</p>
            <p className="text-xs text-text-muted mt-0.5">{stats?.totalAll ?? 0} 位用户 · 增删改查</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link href="/admin/users?filter=PRO" className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface hover:border-border-medium transition-all group">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">付费用户</p>
            <p className="text-xs text-text-muted mt-0.5">{payingUsers} 人已付费 · 转化 {(stats?.total ? Math.round(payingUsers / stats.total * 100) : 0)}%</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link href="/admin/users?filter=FREE" className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface hover:border-border-medium transition-all group">
          <div className="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">免费用户</p>
            <p className="text-xs text-text-muted mt-0.5">{freeUsers} 人待转化 · 可推送升级引导</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link href="/forum/debate" className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface hover:border-border-medium transition-all group">
          <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">智辩场</p>
            <p className="text-xs text-text-muted mt-0.5">管理每日辩论 · 围观讨论</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
