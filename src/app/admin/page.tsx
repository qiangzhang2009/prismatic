'use client';

/**
 * Prismatic — Admin Dashboard Overview
 * Enhanced with real-time usage stats, charts, and top users.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Crown, TrendingUp, MessageSquare, Activity,
  BarChart2, Calendar, Clock, TrendingDown, Zap,
  ChevronRight, RefreshCw, AlertTriangle, CheckCircle, Shield
} from 'lucide-react';

interface GlobalStats {
  total: number;
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

export default function AdminPage() {
  const [userStats, setUserStats] = useState<GlobalStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [days, setDays] = useState(7);

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

      const statsData = await statsRes.json();
      const usageData = await usageRes.json();

      setUserStats(statsData);
      setUsageStats(usageData.globalStats);
      setTopUsers(usageData.topUsers || []);
      setLastRefresh(new Date());
    } catch {
      setError('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const planLabels: Record<string, string> = { FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' };

  // Calculate chart dimensions
  const maxDaily = usageStats?.dailyBreakdown?.reduce((max, d) => Math.max(max, d.total), 0) || 1;

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
            <span className="font-medium text-text-primary">管理员面板</span>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-text-muted hidden sm:inline">
                更新于 {lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
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
        {/* Title + time range */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">系统概览</h1>
            <p className="text-sm text-text-muted mt-1">实时监控用户增长和消息用量</p>
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

        {error && !userStats ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button onClick={fetchData} className="text-prism-blue hover:underline">重试</button>
          </div>
        ) : (
          <>
            {/* ── Row 1: Key Metric Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={Users}
                label="总用户"
                value={userStats?.total ?? 0}
                sub={`近30天 +${userStats?.recent ?? 0}`}
                color="blue"
                trend={userStats?.recent ? '+' : undefined}
                loading={loading && !userStats}
              />
              <StatCard
                icon={MessageSquare}
                label="今日消息"
                value={usageStats?.todayTotal ?? 0}
                sub={`近${days}天 ${usageStats?.weekTotal ?? 0} 条`}
                color="cyan"
                loading={loading && !usageStats}
              />
              <StatCard
                icon={TrendingUp}
                label="日均消息"
                value={usageStats?.avgDaily ?? 0}
                sub="近7天平均"
                color="green"
                loading={loading && !usageStats}
              />
              <StatCard
                icon={Crown}
                label="付费用户"
                value={(userStats?.byPlan?.MONTHLY ?? 0) + (userStats?.byPlan?.YEARLY ?? 0) + (userStats?.byPlan?.LIFETIME ?? 0)}
                sub={`共 ${userStats?.total ?? 0} 人`}
                color="amber"
                loading={loading && !userStats}
              />
            </div>

            {/* ── Row 2: Daily Usage Chart ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-bg-elevated rounded-xl border border-border-subtle p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">每日消息量趋势</h2>
                  <p className="text-xs text-text-muted mt-0.5">近{days}天系统总消息量</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Activity className="w-3.5 h-3.5" />
                  实时
                </div>
              </div>

              {loading && !usageStats ? (
                <div className="h-32 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-prism-blue animate-spin" />
                </div>
              ) : usageStats?.dailyBreakdown?.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-text-muted">
                  <BarChart2 className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">暂无用量数据</p>
                  <p className="text-xs mt-1">发送消息后将在此显示</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs text-text-muted text-right pr-2">
                    <span>{maxDaily}</span>
                    <span>{Math.round(maxDaily / 2)}</span>
                    <span>0</span>
                  </div>

                  {/* Bars */}
                  <div className="ml-14 flex items-end gap-2 h-32">
                    {(usageStats?.dailyBreakdown ?? []).map((day, i) => {
                      const heightPct = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                      const isToday = day.date === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="relative w-full flex items-end justify-center h-28">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(heightPct, 2)}%` }}
                              transition={{ duration: 0.6, delay: i * 0.05 }}
                              className={`w-full rounded-t-md transition-colors ${
                                isToday ? 'bg-prism-blue' : 'bg-prism-purple/60'
                              } hover:bg-prism-blue group-hover:opacity-90`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                              <div className="bg-bg-overlay border border-border-subtle rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                                <p className="text-xs text-text-primary font-medium">{day.date}</p>
                                <p className="text-xs text-prism-blue">{day.total} 条消息</p>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-text-muted">
                            {day.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary row */}
              {usageStats && (
                <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-6 text-xs text-text-muted">
                  <span>今日: <span className="text-text-primary font-medium">{usageStats.todayTotal}</span> 条</span>
                  <span>本周: <span className="text-text-primary font-medium">{usageStats.weekTotal}</span> 条</span>
                  <span>日均: <span className="text-text-primary font-medium">{usageStats.avgDaily}</span> 条</span>
                </div>
              )}
            </motion.div>

            {/* ── Row 3: Top Users + Plan Distribution ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top users today */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-bg-elevated rounded-xl border border-border-subtle p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">今日活跃用户 TOP 10</h2>
                    <p className="text-xs text-text-muted mt-0.5">按消息发送量排名</p>
                  </div>
                  <Zap className="w-4 h-4 text-prism-blue" />
                </div>

                {loading && topUsers.length === 0 ? (
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-bg-surface animate-pulse" />
                        <div className="flex-1 h-4 bg-bg-surface rounded animate-pulse" />
                        <div className="w-10 h-4 bg-bg-surface rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : topUsers.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">暂无活跃用户</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topUsers.map((u, i) => (
                      <div key={u.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-surface transition-colors">
                        {/* Rank */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-amber-400/20 text-amber-400' :
                          i === 1 ? 'bg-gray-300/20 text-gray-300' :
                          i === 2 ? 'bg-orange-400/20 text-orange-400' :
                          'bg-bg-surface text-text-muted'
                        }`}>
                          {i + 1}
                        </div>
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-prism-gradient flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {u.name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        {/* Name/Email */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{u.name || u.email || '未知用户'}</p>
                          <p className="text-xs text-text-muted truncate">{u.email || ''}</p>
                        </div>
                        {/* Count */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-text-primary">{u.count}</p>
                          <p className="text-[10px] text-text-muted">条</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Plan + Role distribution */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-bg-elevated rounded-xl border border-border-subtle p-6"
              >
                <h2 className="text-base font-semibold text-text-primary mb-4">用户分布</h2>

                {/* Plan distribution */}
                <div className="mb-6">
                  <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">套餐分布</p>
                  <div className="space-y-3">
                    {(['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'] as const).map(plan => {
                      const count = userStats?.byPlan?.[plan] ?? 0;
                      const total = userStats?.total ?? 1;
                      const pct = Math.round((count / total) * 100);
                      const colors: Record<string, string> = {
                        FREE: 'bg-text-muted',
                        MONTHLY: 'bg-prism-blue',
                        YEARLY: 'bg-green-400',
                        LIFETIME: 'bg-prism-purple',
                      };
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-text-secondary">{planLabels[plan]}</span>
                            <span className="text-sm text-text-primary font-medium">{count} <span className="text-text-muted text-xs">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${colors[plan]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Role distribution */}
                <div>
                  <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">角色分布</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { role: 'ADMIN', label: '管理员', color: 'text-prism-purple', bg: 'bg-prism-purple/10', icon: Shield },
                      { role: 'PRO', label: '高级用户', color: 'text-amber-400', bg: 'bg-amber-400/10', icon: Crown },
                      { role: 'FREE', label: '普通用户', color: 'text-text-muted', bg: 'bg-bg-surface', icon: Users },
                    ].map(item => {
                      const count = userStats?.byRole?.[item.role] ?? 0;
                      return (
                        <div key={item.role} className={`rounded-lg border border-border-subtle p-3 text-center ${item.bg}`}>
                          <item.icon className={`w-4 h-4 mx-auto mb-1.5 ${item.color}`} />
                          <p className="text-xl font-bold text-text-primary">{count}</p>
                          <p className={`text-xs ${item.color}`}>{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Email verification */}
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">邮箱验证率</span>
                    <span className="text-sm text-text-primary font-medium">
                      {userStats?.verified ?? 0}/{userStats?.total ?? 0}
                    </span>
                  </div>
                  <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400"
                      style={{ width: `${userStats?.total ? Math.round((userStats.verified / userStats.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── Row 4: Quick Actions ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-base font-semibold text-text-primary mb-4">快速操作</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/admin/users" className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-prism-blue/10 flex items-center justify-center">
                      <Users className="w-4.5 h-4.5 text-prism-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">用户管理</p>
                      <p className="text-xs text-text-muted">查看所有用户及用量</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/admin/users?filter=FREE" className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center">
                      <Crown className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">免费用户</p>
                      <p className="text-xs text-text-muted">{userStats?.byPlan?.FREE ?? 0} 人未付费</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/admin/users?sort=messages" className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center">
                      <TrendingUp className="w-4.5 h-4.5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">高活跃用户</p>
                      <p className="text-xs text-text-muted">按消息量排序</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, sub, color, trend, loading }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'cyan' | 'gray';
  trend?: string;
  loading?: boolean;
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-prism-blue/10', icon: 'text-prism-blue' },
    green: { bg: 'bg-green-400/10', icon: 'text-green-400' },
    amber: { bg: 'bg-amber-400/10', icon: 'text-amber-400' },
    purple: { bg: 'bg-prism-purple/10', icon: 'text-prism-purple' },
    cyan: { bg: 'bg-prism-cyan/10', icon: 'text-prism-cyan' },
    gray: { bg: 'bg-bg-surface', icon: 'text-text-muted' },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && <span className="text-xs text-green-400 font-medium">{trend}</span>}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-text-primary">{loading ? '-' : value.toLocaleString()}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
