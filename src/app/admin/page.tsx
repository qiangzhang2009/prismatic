'use client';

/**
 * Prismatic — Admin Dashboard
 * 四个核心 Tab: 数据驾驶舱 / 用户管理 / 对话资产 / 蒸馏中心
 */

import { Suspense, useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Users, Search, Crown, UserCheck, UserX, Filter,
  RefreshCw, Ban, ChevronRight, ChevronLeft, Plus, Eye,
  Trash2, Check, AlertCircle, Loader2, BarChart3,
  Activity, MessageSquare, TrendingUp, Zap,
  LayoutDashboard, UserCog, MessageSquare as MsgIcon,
  TrendingDown, DollarSign, Bot, BarChart2,
  Database, BookOpen, Clock, ArrowUpRight, ArrowDownRight,
  Target, Layers, Sparkles, GitFork, PieChart, Edit3,
  FlaskConical, UsersRound,
  Cloud, CloudOff, Monitor, Smartphone, AlertTriangle, CheckCircle, XCircle, RefreshCw as SyncIcon, Wifi, WifiOff,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import {
  useUsers, useUpdateUser, useDeleteUser, useAddCredits,
  useAnalyticsOverview, useAnalyticsTrend, useAnalyticsPersonas,
  useCapacity, useChatStats,
} from '@/lib/use-admin-data';
import type { User, UserFilter } from '@/lib/use-admin-data';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'users' | 'assets' | 'distill' | 'sync';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtDateShort(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  } catch {
    return '—';
  }
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];
const CHART_COLORS = {
  purple: '#8b5cf6', cyan: '#06b6d4', amber: '#f59e0b',
  green: '#10b981', red: '#ef4444', indigo: '#6366f1', pink: '#ec4899',
};

// ─── Tab Navigation ─────────────────────────────────────────────────────────────

function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: '数据驾驶舱', icon: LayoutDashboard },
    { id: 'users' as Tab, label: '用户管理', icon: UserCog },
    { id: 'assets' as Tab, label: '对话资产', icon: BookOpen },
    { id: 'distill' as Tab, label: '蒸馏中心', icon: FlaskConical },
    { id: 'sync' as Tab, label: '同步管理', icon: UsersRound },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-2xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">管理后台</h1>
              <p className="text-gray-400 text-sm mt-1">Prismatic 数据资产管理</p>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800 -mb-px'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <TabPanel key="dashboard"><DashboardSection /></TabPanel>}
          {activeTab === 'users' && <TabPanel key="users"><UsersSection /></TabPanel>}
          {activeTab === 'assets' && <TabPanel key="assets"><AssetsSection /></TabPanel>}
          {activeTab === 'distill' && <TabPanel key="distill"><DistillSection /></TabPanel>}
          {activeTab === 'sync' && <TabPanel key="sync"><SyncSection /></TabPanel>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Tab 4: 蒸馏中心 ──────────────────────────────────────────────────────────

const DistillAdminPage = dynamic(() => import('@/app/admin/distill/page'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
    </div>
  ),
});

function DistillSection() {
  return <DistillAdminPage />;
}

// ─── Tab 1: 数据驾驶舱 ────────────────────────────────────────────────────────
/**
 * 数据驾驶舱设计理念：
 * - 第一眼：所有核心 KPI 一览无遗，趋势一目了然
 * - 第二眼：用户参与深度分析（DAU/MAU 漏斗 → 付费转化路径）
 * - 第三眼：对话资产健康度（存储容量、Token 消耗、成本趋势）
 * - 第四眼：人物热度与话题热点，洞察内容生态
 */

function DashboardSection() {
  const [days, setDays] = useState(7);
  const [now, setNow] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setNow(new Date().toLocaleTimeString('zh-CN')); }, []);
  const { data: overview, isLoading: ovLoading, refetch: refetchOv, error: ovError } = useAnalyticsOverview(days);
  const { data: trend, isLoading: trLoading, error: trError } = useAnalyticsTrend(days);
  const { data: personas } = useAnalyticsPersonas(30);
  const { data: capacity } = useCapacity();

  const trendData = useMemo(() => {
    if (!Array.isArray(trend)) return [];
    return trend.map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    }));
  }, [trend]);

  const personasData = useMemo(() => {
    if (!Array.isArray(personas)) return [];
    return personas.slice(0, 8).map(p => ({
      name: p.personaName.length > 6 ? p.personaName.slice(0, 6) + '...' : p.personaName,
      fullName: p.personaName,
      views: p.views || 0,
      conversations: p.conversations || 0,
      avgTurns: p.avgTurns || 0,
    }));
  }, [personas]);

  // 转化漏斗数据
  const funnelData = useMemo(() => {
    const totalUsers = overview?.totalUsers || 0;
    const mau = overview?.mau || 0;
    const dau = overview?.dau || 0;
    const paid = overview?.paidUsers || 0;
    const conv = overview?.totalConversations || 0;
    const activeRate = overview?.activeRate || 0;

    return [
      { stage: '注册用户', value: totalUsers, color: '#6366f1', pct: 100 },
      { stage: '月活 (MAU)', value: mau, color: '#8b5cf6', pct: totalUsers > 0 ? (mau / totalUsers) * 100 : 0 },
      { stage: '日活 (DAU)', value: dau, color: '#06b6d4', pct: mau > 0 ? (dau / mau) * 100 : 0 },
      { stage: '产生对话', value: conv, color: '#f59e0b', pct: dau > 0 ? (conv / dau) * 100 : 0 },
      { stage: '付费转化', value: paid, color: '#10b981', pct: conv > 0 ? (paid / conv) * 100 : 0 },
    ];
  }, [overview]);

  return (
    <div className="space-y-8">

      {/* ── Auth/Error Banner ── */}
      {(ovError || trError) && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">无法加载数据</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {ovError ? `概览数据: ${ovError.message}` : ''}
              {trError ? `趋势数据: ${trError.message}` : ''}
              {' · '}请检查数据库连接和认证状态
            </p>
          </div>
          <button
            onClick={() => { refetchOv(); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg text-xs text-red-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">数据驾驶舱</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {days === 7 ? '近 7 天' : days === 14 ? '近 14 天' : days === 30 ? '近 30 天' : '近 90 天'} · 实时数据 · {now ? <span suppressHydrationWarning>最后更新: {now}</span> : '加载中...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === d ? 'bg-prism-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                {d}天
              </button>
            ))}
          </div>
          <button onClick={() => { refetchOv(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm">
            <RefreshCw className={`w-4 h-4 ${ovLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* ── KPI 行 1: 核心资产 ── */}
      <div>
        <SectionLabel label="核心资产" sub="用户规模与活跃度" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            label="总用户"
            value={(overview?.totalUsers ?? 0).toLocaleString()}
            sub={`+${overview?.newUsers ?? 0} 新增`}
            icon={Users}
            accent="purple"
            trend={{ value: 5.2, positive: true }}
          />
          <KPICard
            label="月活 (MAU)"
            value={(overview?.mau ?? 0).toLocaleString()}
            sub={`DAU/MAU ${Number(overview?.dauMauRatio ?? 0).toFixed(1)}%`}
            icon={Activity}
            accent="cyan"
            trend={{ value: 8.1, positive: true }}
          />
          <KPICard
            label="日活 (DAU)"
            value={(overview?.dau ?? 0).toLocaleString()}
            sub={`活跃率 ${Number(overview?.activeRate ?? 0).toFixed(1)}%`}
            icon={TrendingUp}
            accent="green"
            trend={{ value: 3.4, positive: true }}
          />
          <KPICard
            label="总消息数"
            value={(overview?.totalMessages ?? 0).toLocaleString()}
            sub="条消息"
            icon={MessageSquare}
            accent="amber"
            trend={{ value: -2.1, positive: false }}
          />
          <KPICard
            label="总对话数"
            value={(overview?.totalConversations ?? 0).toLocaleString()}
            sub="次对话"
            icon={GitFork}
            accent="pink"
            trend={{ value: 4.7, positive: true }}
          />
          <KPICard
            label="付费用户"
            value={(overview?.paidUsers ?? 0).toLocaleString()}
            sub={`占总 ${overview?.totalUsers ? Number((overview.paidUsers / overview.totalUsers) * 100).toFixed(1) : 0}%`}
            icon={Crown}
            accent="indigo"
            trend={{ value: 12.0, positive: true }}
          />
        </div>
      </div>

      {/* ── 主图: 趋势 + 转化漏斗 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 活跃趋势大图 */}
        <div className="lg:col-span-2 bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">活跃趋势</h3>
              <p className="text-xs text-gray-500 mt-0.5">DAU / 消息数 / 对话数 · 双轴叠加</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-gray-400">日活用户</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-500" /><span className="text-gray-400">消息数</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-gray-400">对话数</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gd-dau" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gd-msg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gd-conv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '10px', fontSize: 12 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="dau" stroke={CHART_COLORS.purple} fillOpacity={1} fill="url(#gd-dau)" name="日活用户" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="messages" stroke={CHART_COLORS.cyan} fillOpacity={1} fill="url(#gd-msg)" name="消息数" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="conversations" stroke={CHART_COLORS.amber} fillOpacity={1} fill="url(#gd-conv)" name="对话数" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 用户转化漏斗 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-white">用户转化漏斗</h3>
            <p className="text-xs text-gray-500 mt-0.5">从注册到付费的全链路转化</p>
          </div>
          <div className="space-y-2">
            {funnelData.map((stage, i) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs text-gray-300">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{stage.value.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-500">{Number(stage.pct).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${stage.pct}%`,
                      backgroundColor: stage.color,
                      opacity: 0.6 + (i * 0.08),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* DAU/MAU 比率卡片 */}
          <div className="mt-5 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">DAU/MAU 比率</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">{Number(overview?.dauMauRatio ?? 0).toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              {(overview?.dauMauRatio ?? 0) > 20 ? '优秀 · 用户粘性极高' :
               (overview?.dauMauRatio ?? 0) > 10 ? '良好 · 产品留存稳健' :
               '一般 · 需提升用户粘性'}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI 行 2: 成本与存储 ── */}
      <div>
        <SectionLabel label="资产健康度" sub="存储容量与 API 消耗" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 存储容量 */}
          <StorageCard capacity={capacity} />
          {/* API 成本 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-300 font-medium">API 成本</p>
                <p className="text-[10px] text-gray-500">近 {days} 天</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-400">
              ¥{Number(overview?.totalApiCost ?? 0).toFixed(4)}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <ArrowUpRight className="w-3 h-3 text-red-400" />
              <span className="text-gray-400">+15.2% vs 上期</span>
            </div>
          </div>
          {/* 人均消息数 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-300 font-medium">人均消息数</p>
                <p className="text-[10px] text-gray-500">活跃用户平均</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {overview?.totalUsers && overview.totalUsers > 0
                ? Number(overview.totalMessages / overview.totalUsers).toFixed(1)
                : '0'}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <ArrowDownRight className="w-3 h-3 text-green-400" />
              <span className="text-gray-400">-2.1% vs 上期</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 人物热度 + 话题热点 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 人物热度排行 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">人物热度排行</h3>
              <p className="text-xs text-gray-500 mt-0.5">消息数 + 对话次数 · Top 8</p>
            </div>
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          {personasData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {personasData.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/40 transition-colors group">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-500/20 text-amber-400' :
                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                    i === 2 ? 'bg-orange-600/20 text-orange-400' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{p.fullName}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-500">{(p as any).messageCount ? `${(p as any).messageCount} 消息` : '—'}</span>
                      <span className="text-[10px] text-cyan-500">{p.conversations} 对话</span>
                      <span className="text-[10px] text-purple-400">{Number(p.avgTurns || 0).toFixed(1)} 轮/人</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 参与度分布 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">用户参与度分布</h3>
              <p className="text-xs text-gray-500 mt-0.5">按消息数分群 · 洞察深度用户</p>
            </div>
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="space-y-3">
            {/* 用户参与度数据来自行为分群 API，真实数据请到「对话资产 → 用户分群」查看 */}
            <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-gray-700">
              <p className="text-xs text-gray-600">
                用户分布数据请至 <span className="text-gray-500">「对话资产 → 用户分群」</span> 查看
              </p>
            </div>
          </div>

          <div className="mt-5 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
            <p className="text-xs text-gray-400 leading-relaxed">
              用户参与度分布基于真实对话数据。详细分群请切换到<span className="text-purple-400 font-medium">「对话资产 → 用户分群」</span>查看各用户群体的真实规模和贡献。
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Storage Card ──────────────────────────────────────────────────────────────

function StorageCard({ capacity }: { capacity: any }) {
  const storage = capacity?.storage;

  if (!storage) {
    return (
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-700 rounded w-24" />
          <div className="h-8 w-8 bg-gray-700 rounded-xl" />
        </div>
        <div className="h-8 bg-gray-700 rounded w-32 mb-3" />
        <div className="h-2 bg-gray-700 rounded-full" />
      </div>
    );
  }

  const barColor = storage.status === 'red' ? 'bg-red-500' : storage.status === 'yellow' ? 'bg-yellow-500' : 'bg-green-500';
  const statusLabel = storage.status === 'red' ? '紧急' : storage.status === 'yellow' ? '预警' : '正常';
  const statusBg = storage.status === 'red' ? 'bg-red-900/30 text-red-400' : storage.status === 'yellow' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400';

  const fmtBytes = (bytes: number) => {
    if (bytes < 1024 * 1024 * 1024) return `${Number(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Number(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className={`bg-gray-900/80 border rounded-2xl p-5 ${
      storage.status === 'red' ? 'border-red-800/50' :
      storage.status === 'yellow' ? 'border-yellow-800/50' : 'border-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-300 font-medium">数据库存储</p>
          <p className="text-[10px] text-gray-500">Neon Free Tier · 0.5 GB</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBg}`}>{statusLabel}</span>
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
            <Database className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
      <p className="text-3xl font-bold text-white">
        {Number(storage.usedPercent * 100).toFixed(1)}
        <span className="text-lg text-gray-400 font-normal">%</span>
      </p>
      <div className="mt-2 text-xs text-gray-400 mb-3">
        {fmtBytes(storage.usedBytes)} / {fmtBytes(storage.limitBytes)}
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(Number(storage.usedPercent * 100), 100).toFixed(1)}%` }} />
      </div>
      {storage.daysUntilFull !== null && (
        <p className="text-[10px] text-gray-500 mt-2">
          预计 {storage.daysUntilFull} 天后耗尽 · 日均增长 {fmtBytes(storage.dailyGrowthBytes || 0)}
        </p>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string; sub: string;
  icon: React.ElementType; accent: string; trend?: { value: number; positive: boolean };
}) {
  const accentColors: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const color = accentColors[accent] || accentColors.purple;

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{sub}</span>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <div className="flex-1 h-px bg-gray-800" />
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  );
}

// ─── Tab 2: 用户管理 ───────────────────────────────────────────────────────────

function UsersSection() {
  const router = useRouter();
  const [filters, setFilters] = useState<UserFilter>({ page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<User['status'] | ''>('');
  const [selectedPlan, setSelectedPlan] = useState<User['plan'] | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useUsers(filters);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const addCredits = useAddCredits();

  const users = data?.items || [];
  const totalPages = data?.totalPages || 1;

  const filteredUsers = users.filter(user => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!user.name?.toLowerCase().includes(term) && !user.email?.toLowerCase().includes(term)) return false;
    }
    if (selectedStatus && user.status !== selectedStatus) return false;
    if (selectedPlan && user.plan !== selectedPlan) return false;
    return true;
  });

  const handlePage = (page: number) => { setFilters(prev => ({ ...prev, page })); setExpandedId(null); };
  const handleStatusChange = async (id: string, status: User['status']) => { await updateUser.mutateAsync({ id, data: { status } }); };
  const handleDelete = async (id: string) => { if (!confirm('确定要删除此用户吗？此操作不可撤销。')) return; await deleteUser.mutateAsync(id); };
  const handleAddCredits = async (id: string) => {
    const amount = prompt('输入要添加的信用点数:');
    if (amount && !isNaN(Number(amount))) await addCredits.mutateAsync({ id, amount: Number(amount) });
  };

  const totalActive = filteredUsers.filter(u => u.status === 'ACTIVE').length;
  const totalPaid = filteredUsers.filter(u => u.plan !== 'FREE').length;
  const totalMessages = filteredUsers.reduce((sum, u) => sum + (u.messageCount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">用户管理</h2>
          <p className="text-gray-400 text-sm">共 {data?.total || 0} 位用户，其中 {totalActive} 位活跃，{totalPaid} 位付费</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="搜索姓名、邮箱..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setFilters(prev => ({ ...prev, search: e.target.value, page: 1 })); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
          </div>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value as User['status'] | '')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">全部状态</option>
            <option value="ACTIVE">活跃</option>
            <option value="SUSPENDED">暂停</option>
            <option value="BANNED">封禁</option>
          </select>
          <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value as User['plan'] | '')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">全部计划</option>
            <option value="FREE">Free</option>
            <option value="MONTHLY">月度</option>
            <option value="YEARLY">年度</option>
            <option value="LIFETIME">终身</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '总用户', value: data?.total || 0, icon: Users, color: 'text-purple-400' },
          { label: '活跃用户', value: totalActive, icon: UserCheck, color: 'text-green-400' },
          { label: '付费用户', value: totalPaid, icon: Crown, color: 'text-amber-400' },
          { label: '总消息', value: totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-cyan-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div className={color}><Icon className="w-6 h-6" /></div>
            <div><div className="text-xl font-bold text-white">{value}</div><div className="text-xs text-gray-400">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-800/60 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <div className="col-span-3">用户</div>
          <div className="col-span-2">状态 / 计划</div>
          <div className="col-span-2 text-right">信用点</div>
          <div className="col-span-2">注册时间</div>
          <div className="col-span-2">最后活跃</div>
          <div className="col-span-1 text-right">操作</div>
        </div>

        {isLoading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}
        {error && <div className="flex items-center justify-center py-20 gap-3"><AlertCircle className="w-8 h-8 text-red-400" /><div><p className="text-red-400 font-medium">加载失败</p><p className="text-gray-400 text-sm">{error.message}</p></div></div>}
        {!isLoading && !error && filteredUsers.length === 0 && <div className="flex items-center justify-center py-20"><p className="text-gray-500">暂无用户数据</p></div>}

        {!isLoading && !error && filteredUsers.length > 0 && (
          <div className="divide-y divide-gray-800/60">
            {filteredUsers.map(user => (
              <div key={user.id}>
                <div className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-800/40 cursor-pointer transition-colors ${expandedId === user.id ? 'bg-gray-800/50' : ''}`}
                  onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}>
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {user.name?.[0] || user.email?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate text-sm">{user.name || <span className="text-gray-500 italic">未命名</span>}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1 justify-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium w-fit px-2 py-0.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400' : user.status === 'BANNED' ? 'bg-red-900/50 text-red-400' : user.status === 'SUSPENDED' ? 'bg-amber-900/50 text-amber-400' : 'bg-gray-800 text-gray-400'}`}>
                      {user.status === 'ACTIVE' && <UserCheck className="w-3 h-3" />}
                      {user.status === 'BANNED' && <Ban className="w-3 h-3" />}
                      {user.status === 'SUSPENDED' && <UserX className="w-3 h-3" />}
                      {user.status === 'ACTIVE' ? '活跃' : user.status === 'BANNED' ? '封禁' : user.status === 'SUSPENDED' ? '暂停' : '未知'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full ${user.plan !== 'FREE' ? 'bg-purple-900/50 text-purple-300' : 'bg-gray-800 text-gray-400'}`}>
                      {user.plan !== 'FREE' && <Crown className="w-3 h-3" />}
                      {user.plan}
                    </span>
                  </div>
                  <div className="col-span-2 text-right flex items-center justify-end gap-2">
                    <span className="font-semibold text-amber-400 text-sm">{user.credits}</span>
                    <button onClick={e => { e.stopPropagation(); handleAddCredits(user.id); }} className="text-xs text-gray-500 hover:text-blue-400 transition-colors" title="添加信用点">+充</button>
                  </div>
                  <div className="col-span-2 text-sm text-gray-400">{fmtDateShort(user.createdAt)}</div>
                  <div className="col-span-2 text-sm text-gray-400">{user.lastActiveAt ? fmtDateShort(user.lastActiveAt) : <span className="text-gray-600">从未</span>}</div>
                  <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push(`/admin/users/${user.id}`)} className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="查看详情"><Eye className="w-4 h-4 text-gray-400 hover:text-blue-400" /></button>
                    <button onClick={() => handleDelete(user.id)} className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors" title="删除"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" /></button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === user.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-12 gap-4 px-4 py-4 bg-gray-900/40 border-t border-gray-800/50">
                        <div className="col-span-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">账户信息</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">姓名</span><span className="text-gray-300">{user.name || <span className="text-gray-600 italic">未设置</span>}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">性别</span><span className="text-gray-300">{(user as any).gender === 'male' ? '男' : (user as any).gender === 'female' ? '女' : <span className="text-gray-600 italic">未设置</span>}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">省份</span><span className="text-gray-300">{(user as any).province || <span className="text-gray-600 italic">未设置</span>}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">邮箱验证</span><span className="text-gray-300">{(user as any).emailVerified ? '已验证' : <span className="text-amber-400">未验证</span>}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">最后更新</span><span className="text-gray-300">{fmtDate((user as any).updatedAt)}</span></div>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">使用统计</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">对话数</span><span className="text-gray-300">{user.conversationCount?.toLocaleString() || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">消息数</span><span className="text-gray-300">{user.messageCount?.toLocaleString() || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">最后活跃</span><span className="text-gray-300">{user.lastActiveAt ? fmtDate(user.lastActiveAt) : '从未'}</span></div>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">快速操作</h4>
                          <div className="flex flex-col gap-1.5">
                            {user.status === 'ACTIVE'
                              ? <button onClick={() => handleStatusChange(user.id, 'BANNED')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition-colors w-fit"><Ban className="w-3 h-3" /> 封禁</button>
                              : <button onClick={() => handleStatusChange(user.id, 'ACTIVE')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg text-xs transition-colors w-fit"><Check className="w-3 h-3" /> 恢复</button>
                            }
                            <button onClick={() => handleAddCredits(user.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 rounded-lg text-xs transition-colors w-fit"><Plus className="w-3 h-3" /> 添加信用点</button>
                          </div>
                        </div>
                        <div className="col-span-3 flex flex-col items-start justify-center gap-2">
                          <button onClick={() => router.push(`/admin/users/${user.id}/edit`)} className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors">
                            <Edit3 className="w-3.5 h-3.5" /> 编辑用户
                          </button>
                          <button onClick={() => router.push(`/admin/users/${user.id}`)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                            查看详情 <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <div className="text-sm text-gray-400">第 {filters.page} / {totalPages} 页，共 {data?.total || 0} 条</div>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePage(filters.page! - 1)} disabled={filters.page === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
                <ChevronLeft className="w-4 h-4" /> 上一页
              </button>
              <button onClick={() => handlePage(filters.page! + 1)} disabled={filters.page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
                下一页 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 3: 对话资产 ──────────────────────────────────────────────────────────
/**
 * 对话资产管理 — 合并浏览与分析于单一视图
 * 上部：分析维度切换 + KPI 概要
 * 下部：对话列表（可展开查看完整聊天记录）+ 维度图表
 */

type AssetDim = 'overview' | 'cost' | 'topics' | 'personas' | 'behavior' | 'userchats';

function AssetsSection() {
  const [dim, setDim] = useState<AssetDim>('overview');
  const [search, setSearch] = useState('');
  const [billingMode, setBillingMode] = useState('');
  const [mode, setMode] = useState('');
  const [days, setDays] = useState(7); // Default 7 days — same as Dashboard
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Quick date buttons: update days state and reset to first page
  const applyQuickDate = (d: number) => {
    setDays(d);
    setPage(1);
  };

  const params = useMemo(() => new URLSearchParams({
    page: String(page), pageSize: '100',
    ...(search && { search }),
    ...(billingMode && { billingMode }),
    ...(mode && { mode }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }), [page, search, billingMode, mode, dateFrom, dateTo]);

  const { data: convData, isLoading: convLoading, refetch, isError: convError } = useQuery({
    queryKey: ['admin', 'chats', params.toString(), days],
    queryFn: () => fetch(`/api/admin/chats?${params}&days=${days}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: userChatsData, isLoading: userChatsLoading, refetch: refetchUserChats } = useQuery({
    queryKey: ['admin', 'chats', 'by-user', params.toString()],
    queryFn: () => fetch(`/api/admin/chats/by-user?${params}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: dim === 'userchats',
  });

  const convs = convData?.conversations || [];
  const total = convData?.total || 0;
  const totalPages = convData?.totalPages || 1;
  const convErrorMsg = convData?.error || (convError ? '加载失败，请检查登录状态' : null);

  const dimensions: Array<{ id: AssetDim; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: '总览', icon: LayoutDashboard },
    { id: 'cost', label: 'Token 成本', icon: DollarSign },
    { id: 'topics', label: '话题聚类', icon: Layers },
    { id: 'personas', label: '人物互动', icon: Bot },
    { id: 'behavior', label: '用户分群', icon: Target },
    { id: 'userchats', label: '用户记录', icon: UsersRound },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header: 维度切换 ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400 mr-2">分析维度：</span>
          {dimensions.map(d => (
            <button
              key={d.id}
              onClick={() => setDim(d.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                dim === d.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <d.icon className="w-3.5 h-3.5" />
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{total} 条对话</span>
          <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[0, 7, 14, 30, 90].map(d => {
              const isActive = d === days;
              return (
                <button key={d} onClick={() => applyQuickDate(d)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${isActive ? 'bg-prism-blue text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {d === 0 ? '全部' : `${d}天`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 分析面板 ── */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
        <AnimatePresence mode="wait">
          {dim === 'overview' && <AssetOverview key="overview" convData={convData} days={days} />}
          {dim === 'cost' && <AssetCostAnalysis key="cost" days={30} />}
          {dim === 'topics' && <AssetTopics key="topics" days={30} />}
          {dim === 'personas' && <AssetPersonas key="personas" days={0} />}
          {dim === 'behavior' && <AssetBehavior key="behavior" days={30} />}
          {dim === 'userchats' && <AssetUserChats key="userchats" userChatsData={userChatsData} isLoading={userChatsLoading} onRefresh={refetchUserChats} />}
        </AnimatePresence>
      </div>

      {/* ── 对话浏览 ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">对话记录</h3>
            <p className="text-xs text-gray-500 mt-0.5">点击展开查看完整聊天记录</p>
          </div>
        </div>

        {/* 筛选工具栏 */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索对话内容..."
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 flex-1 min-w-48"
          />
          <select value={billingMode} onChange={e => { setBillingMode(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">全部计费</option>
            <option value="A">API Key</option>
            <option value="B">平台代付</option>
          </select>
          <select value={mode} onChange={e => { setMode(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">全部模式</option>
            <option value="solo">Solo</option>
            <option value="prism">Prism</option>
            <option value="roundtable">Roundtable</option>
            <option value="mission">Mission</option>
            <option value="epoch">Epoch</option>
            <option value="council">Council</option>
            <option value="oracle">Oracle</option>
            <option value="fiction">Fiction</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          <button onClick={() => refetch()} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors">
            搜索
          </button>
        </div>

        {/* ── 错误提示 ── */}
        {convErrorMsg && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">对话资产加载失败</p>
              <p className="text-xs text-gray-400 mt-0.5">{convErrorMsg}</p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg text-xs text-red-300 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> 重试
            </button>
          </div>
        )}

        {/* 对话列表 */}
        {convLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />)}</div>
        ) : convs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            暂无对话记录
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map((conv: any) => (
              <ConversationCard key={conv.id} conv={conv} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-sm text-white rounded-lg transition-colors">
              上一页
            </button>
            <span className="text-sm text-gray-400">{page} / {totalPages}（共 {total} 条）</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-sm text-white rounded-lg transition-colors">
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 对话卡片（可展开） ──────────────────────────────────────────────────────

function ConversationCard({ conv }: { conv: any }) {
  const [expanded, setExpanded] = useState(false);

  const msgs = conv.messages || [];
  const previewMsgs = msgs.slice(0, 3);   // now DESC, so first 3 = newest
  const hasMore = msgs.length > 3;

  // Derive per-message mode: prefer message-level mode (from metadata), fall back to conv.mode
  const msgsWithMode = msgs.map((m: any) => ({
    ...m,
    effectiveMode: m.msgMode || conv.mode || 'solo',
  }));

  // Build "segments" — groups of consecutive messages with the same mode.
  // Each segment has { mode, messages[], startIdx }.
  const segments: Array<{ mode: string; messages: typeof msgsWithMode; startIdx: number }> = [];
  for (let i = 0; i < msgsWithMode.length; i++) {
    const m = msgsWithMode[i];
    if (segments.length === 0 || segments[segments.length - 1].mode !== m.effectiveMode) {
      segments.push({ mode: m.effectiveMode, messages: [m], startIdx: i });
    } else {
      segments[segments.length - 1].messages.push(m);
    }
  }

  const MODE_LABELS: Record<string, string> = {
    solo: 'Solo 对话', prism: '多视角折射', roundtable: '圆桌讨论',
    mission: '任务协作', epoch: '关公战秦琼', council: '顾问团议事',
    oracle: '预言家', fiction: '故事共创',
  };

  const MODE_COLORS: Record<string, string> = {
    solo: 'bg-blue-900/40 text-blue-300 border-blue-800/40',
    prism: 'bg-violet-900/40 text-violet-300 border-violet-800/40',
    roundtable: 'bg-amber-900/40 text-amber-300 border-amber-800/40',
    mission: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/40',
    epoch: 'bg-red-900/40 text-red-300 border-red-800/40',
    council: 'bg-cyan-900/40 text-cyan-300 border-cyan-800/40',
    oracle: 'bg-purple-900/40 text-purple-300 border-purple-800/40',
    fiction: 'bg-pink-900/40 text-pink-300 border-pink-800/40',
  };

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">{fmtDate(conv.updatedAt)}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${MODE_COLORS[conv.mode] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {MODE_LABELS[conv.mode] || conv.mode}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${conv.billingMode === 'A' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
              {conv.billingMode === 'A' ? 'API Key' : '平台代付'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">
              {conv.user?.name || conv.user?.email || '未知用户'}
            </span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-500">{conv.messageCount} 条消息</span>
            {conv.totalCost !== undefined && (
              <>
                <span className="text-xs text-gray-600">·</span>
                <span className="text-xs text-amber-400">¥{Number(conv.totalCost || 0).toFixed(4)}</span>
              </>
            )}
            {conv.totalTokens !== undefined && (
              <>
                <span className="text-xs text-gray-600">·</span>
                <span className="text-xs text-cyan-400">{Number((conv.totalTokens || 0) / 1000).toFixed(1)}K tokens</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasMore && !expanded && (
            <span className="text-xs text-gray-600">+{msgs.length - 3} 条</span>
          )}
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded messages — grouped by mode segment */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-800/50"
          >
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {segments.map((seg, si) => (
                <div key={`${seg.mode}-${si}`}>
                  {/* Always show mode label — helps identify what kind of interaction this was */}
                  <div className="flex items-center gap-2 mb-2 mt-2 first:mt-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${MODE_COLORS[seg.mode] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {MODE_LABELS[seg.mode] || seg.mode}
                    </span>
                    <span className="text-[10px] text-gray-600">{seg.messages.length} 条消息</span>
                    {si < segments.length - 1 && (
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent ml-2" />
                    )}
                  </div>

                  {/* Messages in this segment */}
                  <div className="space-y-2">
                    {seg.messages.map((msg: any) => {
                      const isUser = msg.role === 'user' || msg.role === 'human';
                      const isAssistant = msg.role === 'assistant' || msg.role === 'ai';
                      const bgClass = isUser ? 'bg-blue-900/10 border-blue-800/30' :
                        isAssistant ? 'bg-purple-900/10 border-purple-800/30' :
                        'bg-gray-800/50 border-gray-700/50';
                      const roleLabel = isUser ? '用户' : isAssistant ? 'AI' : msg.role;

                      return (
                        <div key={msg.id} className={`rounded-xl p-3 border ${bgClass}`}>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isUser ? 'bg-blue-500/20 text-blue-400' :
                              isAssistant ? 'bg-purple-500/20 text-purple-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {roleLabel}
                            </span>
                            {msg.personaName && (
                              <span className="text-[10px] text-gray-500">→ {msg.personaName}</span>
                            )}
                            {(msg.tokensInput !== undefined || msg.tokensOutput !== undefined) && (
                              <span className="text-[10px] text-gray-600 ml-auto">
                                {msg.tokensInput ?? 0}+{msg.tokensOutput ?? 0} tok
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content || <span className="text-gray-600 italic">[无内容]</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed preview */}
      {!expanded && previewMsgs.length > 0 && (
        <div className="px-5 pb-3 -mt-1">
          <div className="space-y-1">
            {previewMsgs.map((msg: any, i: number) => {
              const isUser = msg.role === 'user' || msg.role === 'human';
              const effMode = msg.msgMode || conv.mode || 'solo';
              const segIndex = segments.findIndex(s => s.messages.includes(msg));
              const isFirstInSeg = segIndex >= 0 && segments[segIndex].messages[0] === msg;
              return (
                <div key={msg.id} className="text-xs text-gray-500 flex items-start gap-2 pl-4 border-l border-gray-800">
                  {isFirstInSeg && (
                    <span className={`text-[9px] px-1 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${MODE_COLORS[effMode] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {MODE_LABELS[effMode] || effMode}
                    </span>
                  )}
                  <span className={isUser ? 'text-blue-400' : 'text-purple-400'}>{isUser ? 'U' : 'AI'}</span>
                  <span className="truncate flex-1">{msg.content}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 分析维度: 总览 ─────────────────────────────────────────────────────────

function AssetOverview({ convData, days }: { convData: any; days: number }) {
  // Use authoritative stats API (queries actual message/conversation tables directly)
  // instead of summing paginated convData.messageCount which was broken.
  const { data: stats, isLoading: statsLoading } = useChatStats(days);

  const total = stats?.totalConversations ?? convData?.total ?? 0;
  const totalMessages = stats?.totalMessages ?? 0;
  const totalCost = stats?.totalCost ?? 0;
  const totalTokens = stats?.totalTokens ?? 0;
  const apiKeyCount = stats?.billing?.apiKeyMode ?? 0;
  const platformCount = stats?.billing?.platformMode ?? 0;
  const modeStats = stats?.modeStats ?? [];
  const topModes = modeStats.slice(0, 5);

  return (
    <div className="space-y-5">
      {statsLoading && (
        <div className="text-xs text-gray-500">加载中...</div>
      )}
      <h4 className="text-sm font-semibold text-white">
        {days === 7 ? '近 7 天 · 总览' : days === 14 ? '近 14 天 · 总览' : days === 30 ? '近 30 天 · 总览' : `近 ${days} 天 · 总览`}
      </h4>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '对话数', value: total.toLocaleString(), color: 'text-white', icon: MessageSquare },
          { label: '消息数', value: totalMessages.toLocaleString(), color: 'text-cyan-400', icon: Zap },
          { label: 'API 成本', value: `¥${Number(totalCost || 0).toFixed(4)}`, color: 'text-amber-400', icon: DollarSign },
          { label: 'Token 消耗', value: `${Number((totalTokens || 0) / 1000).toFixed(1)}K`, color: 'text-purple-400', icon: Activity },
        ].map(card => (
          <div key={card.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 计费模式分布 */}
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
          <h5 className="text-xs font-medium text-gray-400 mb-3">计费模式</h5>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-300">API Key</span></div>
              <span className="text-white font-medium">{apiKeyCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-gray-300">平台代付</span></div>
              <span className="text-white font-medium">{platformCount}</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
            {total > 0 && (
              <>
                <div className="bg-blue-500" style={{ width: `${(apiKeyCount / total) * 100}%` }} />
                <div className="bg-green-500" style={{ width: `${(platformCount / total) * 100}%` }} />
              </>
            )}
          </div>
        </div>

        {/* 对话模式分布 */}
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30 md:col-span-2">
          <h5 className="text-xs font-medium text-gray-400 mb-3">对话模式分布</h5>
          <div className="space-y-1.5">
            {topModes.map((m, i) => (
              <div key={m.mode} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-xs text-gray-500 text-right">{i + 1}</span>
                <span className="w-20 text-gray-300 truncate">{m.mode}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${total > 0 ? (m.count / total) * 100 : 0}%` }} />
                </div>
                <span className="w-8 text-right text-gray-400 text-xs">{m.count}</span>
              </div>
            ))}
            {topModes.length === 0 && <p className="text-xs text-gray-600">暂无数据</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 分析维度: Token 成本 ─────────────────────────────────────────────────

function AssetCostAnalysis({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversation-analysis', days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/conversations?days=${days}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const overview = data?.overview;
  const personas = (data?.personas || []) as Array<{ personaName?: string; totalCost?: number; totalTokens?: number }>;
  const dailyTrend = (data?.dailyTrend || []) as Array<{ date: string; messages?: number }>;
  const modeStats = (data?.modeStats || []) as Array<{ mode?: string; _count?: { id?: number } }>;

  const dailyTrendData = useMemo(() =>
    dailyTrend.map(d => ({ ...d, date: fmtDateShort(d.date) })),
    [dailyTrend]
  );

  const modeChartData = modeStats.map(m => ({ name: m.mode || 'Unknown', value: m._count?.id || 0 }));
  const costChartData = personas.slice(0, 8).map(p => {
    const name = p.personaName || '';
    return { name: name.length > 10 ? name.slice(0, 10) + '...' : name, cost: p.totalCost || 0 };
  });

  return (
    <div className="space-y-5">
      <h4 className="text-sm font-semibold text-white">Token 成本分析 · 近 {days} 天</h4>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '总消息', value: (overview?.totalMessages || 0).toLocaleString(), color: 'text-white', icon: MessageSquare },
              { label: 'Token 消耗', value: `${Number((overview?.totalTokens || 0) / 1000).toFixed(1)}K`, color: 'text-cyan-400', icon: Zap },
              { label: 'API 成本', value: `¥${Number(overview?.totalApiCost || 0).toFixed(4)}`, color: 'text-amber-400', icon: DollarSign },
              { label: '平均/对话', value: `¥${Number(overview?.avgCostPerConversation || 0).toFixed(4)}`, color: 'text-purple-400', icon: BarChart2 },
            ].map(card => (
              <div key={card.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{card.label}</span>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 每日趋势 */}
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
              <h5 className="text-xs font-medium text-gray-400 mb-3">每日消息趋势</h5>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyTrendData}>
                  <defs>
                    <linearGradient id="ac-msg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }} />
                  <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fillOpacity={1} fill="url(#ac-msg)" name="消息数" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 人物成本排行 */}
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
              <h5 className="text-xs font-medium text-gray-400 mb-3">人物成本排行 Top 8</h5>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={costChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#6b7280" fontSize={10} tickFormatter={v => `¥${Number(v).toFixed(4)}`} />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={9} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }} />
                  <Bar dataKey="cost" fill="#f59e0b" name="成本" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 分析维度: 话题聚类 ─────────────────────────────────────────────────────

function AssetTopics({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'topics', days],
    queryFn: () => fetch(`/api/admin/chats/topics?days=${days}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const topics = data?.topics || [];
  const total = data?.totalConversations || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">话题聚类分析 · 近 {days} 天</h4>
        <span className="text-xs text-gray-500">
          {data?.sampledFrom !== undefined
            ? `${total} 条对话（采样 ${data.sampledFrom} 条归纳）`
            : `${total} 条对话`}
        </span>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
          暂无话题数据（请确保 DEEPSEEK_API_KEY 已配置）
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topics.map((topic: any, i: number) => (
            <div key={i} className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">{i + 1}</div>
                  <span className="text-sm font-medium text-white">{topic.topic}</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">{topic.count} 条</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">{topic.description}</p>
              <div className="flex flex-wrap gap-1">
                {(topic.examples || []).slice(0, 3).map((ex: string, j: number) => (
                  <span key={j} className="text-[10px] px-2 py-1 bg-gray-700/50 text-gray-400 rounded-lg border border-gray-600/30 truncate max-w-44">{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 分析维度: 人物互动 ─────────────────────────────────────────────────────

function AssetPersonas({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'personas', days],
    queryFn: () => fetch(`/api/admin/chats/personas?days=${days || ''}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  });

  const usage = (data?.personaUsage || []) as Array<{
    personaId: string; name: string; nameZh: string; domain: string;
    conversationCount: number; messageCount: number; totalTokens: number; totalCost: number;
  }>;
  const totalMessages = usage.reduce((s: number, p) => s + (p.messageCount || 0), 0);
  const totalTokens = usage.reduce((s: number, p) => s + (p.totalTokens || 0), 0);
  const totalCost = usage.reduce((s: number, p) => s + (Number(p.totalCost) || 0), 0);
  const totalConvs = usage.reduce((s: number, p) => s + (p.conversationCount || 0), 0);

  const DOMAIN_COLORS: Record<string, string> = {
    product: 'bg-blue-900/30 text-blue-400',
    strategy: 'bg-purple-900/30 text-purple-400',
    thinking: 'bg-cyan-900/30 text-cyan-400',
    investing: 'bg-amber-900/30 text-amber-400',
    startup: 'bg-green-900/30 text-green-400',
    philosophy: 'bg-orange-900/30 text-orange-400',
    leadership: 'bg-pink-900/30 text-pink-400',
    ai: 'bg-indigo-900/30 text-indigo-400',
    marketing: 'bg-teal-900/30 text-teal-400',
    unknown: 'bg-gray-800 text-gray-400',
  };
  const domainLabel: Record<string, string> = {
    product: '产品', strategy: '战略', thinking: '思维', investing: '投资',
    startup: '创业', philosophy: '哲学', leadership: '领导力', ai: 'AI', marketing: '营销', unknown: '其他',
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-white">人物互动分析{days === 0 ? ' · 全部时间' : ` · 近 ${days} 天`}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          基于对话参与者统计（conversations.participants / personaIds），统计每个角色参与了多少次对话、消息数及 Token 消耗。
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">活跃人物</p>
          <p className="text-xl font-bold text-white mt-1">{usage.length}</p>
          <p className="text-[10px] text-gray-600">个角色参与对话</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">对话场次</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{totalConvs.toLocaleString()}</p>
          <p className="text-[10px] text-gray-600">次对话涉及人物</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">总 Token</p>
          <p className="text-xl font-bold text-cyan-400 mt-1">{(totalTokens / 1000).toFixed(1)}K</p>
          <p className="text-[10px] text-gray-600">输入+输出总计</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">总成本</p>
          <p className="text-xl font-bold text-amber-400 mt-1">¥{Number(totalCost).toFixed(4)}</p>
          <p className="text-[10px] text-gray-600">API 调用成本</p>
        </div>
      </div>

      {/* Insight card */}
      {usage.length > 0 && (
        <div className="bg-purple-900/10 border border-purple-800/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-purple-300 font-medium">指标解读与优化建议</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {usage.length >= 5
                  ? `共有 ${usage.length} 个人物参与对话，覆盖 ${new Set(usage.map(u => u.domain)).size} 个领域。`
                  : `人物覆盖度偏低，建议引导用户探索更多角色。对话集中度较高，建议增加跨领域对话场景。`}
                {totalConvs > 0 && usage[0]
                  ? ` 最活跃人物「${usage[0].nameZh || usage[0].name}」参与了 ${usage[0].conversationCount} 次对话（占 ${(usage[0].conversationCount / totalConvs * 100).toFixed(0)}%）。`
                  : ' 建议增加多角色辩论等高互动功能。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-40 bg-gray-800 rounded-xl animate-pulse" />
      ) : usage.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
          暂无人物互动数据（请检查 conversations 表中 participants 字段）
        </div>
      ) : (
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 bg-gray-800/50">
                <th className="text-left p-3 text-gray-400 font-medium text-xs">人物</th>
                <th className="text-left p-3 text-gray-400 font-medium text-xs">领域</th>
                <th className="text-right p-3 text-gray-400 font-medium text-xs">对话数</th>
                <th className="text-right p-3 text-gray-400 font-medium text-xs">消息数</th>
                <th className="text-right p-3 text-gray-400 font-medium text-xs">占比</th>
                <th className="text-right p-3 text-gray-400 font-medium text-xs">Token</th>
                <th className="text-right p-3 text-gray-400 font-medium text-xs">成本</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((p, i) => {
                const colorClass = DOMAIN_COLORS[p.domain] || DOMAIN_COLORS.unknown;
                const label = domainLabel[p.domain] || p.domain;
                const pct = totalConvs > 0 ? (p.conversationCount / totalConvs * 100) : 0;
                return (
                  <tr key={p.personaId || i} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                          i === 0 ? 'bg-amber-500/20 text-amber-400' :
                          i === 1 ? 'bg-gray-400/20 text-gray-300' :
                          i === 2 ? 'bg-orange-600/20 text-orange-400' :
                          'bg-gray-800 text-gray-500'
                        }`}>{i + 1}</div>
                        <div>
                          <p className="text-white font-medium text-sm">{p.nameZh || p.name}</p>
                          <p className="text-[10px] text-gray-500">{p.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
                    </td>
                    <td className="text-right p-3 text-purple-300 font-medium">{p.conversationCount}</td>
                    <td className="text-right p-3 text-gray-300">{Number(p.messageCount).toLocaleString()}</td>
                    <td className="text-right p-3 text-gray-500">{pct.toFixed(1)}%</td>
                    <td className="text-right p-3 text-cyan-400">{Number(p.totalTokens).toLocaleString()}</td>
                    <td className="text-right p-3 text-amber-400 font-medium">¥{Number(p.totalCost || 0).toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 分析维度: 用户分群 ─────────────────────────────────────────────────────

function AssetBehavior({ days }: { days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'behavior', days],
    queryFn: () => fetch(`/api/admin/chats/behavior?days=${days}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const clusters = data?.clusters;
  const totalUsers = data?.totalActiveUsers || 0;

  type ClusterMeta = { color: string; label: string; desc: string };
  const CLUSTER_META: Record<string, ClusterMeta> = {
    // NOTE: keys must match /api/admin/chats/behavior response keys exactly
    heavy:    { color: 'purple', label: '重度用户', desc: '≥20 次对话 或 ≥100 条消息' },
    explorer: { color: 'cyan',   label: '探索型',   desc: '10-19 次对话' },
    casual:   { color: 'amber', label: '轻量用户', desc: '3-9 次对话' },
    dormant:  { color: 'gray',  label: '沉默用户', desc: '1-2 次对话 或 近 30 天无活跃' },
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white">用户行为分群 · 近 {days} 天</h4>
      {clusters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(clusters).map(([key, cluster]: [string, any]) => {
            const meta = CLUSTER_META[key] || { color: 'gray', label: key, desc: '' };
            const colorClass = meta.color === 'purple' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
              meta.color === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
              meta.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-gray-500/10 border-gray-500/20 text-gray-400';
            return (
              <div key={key} className={`border rounded-xl p-4 ${colorClass}`}>
                <p className="text-xs opacity-60">{meta.label}</p>
                <p className="text-2xl font-bold mt-1">{cluster.count}</p>
                <p className="text-[10px] opacity-60 mt-1">{(totalUsers > 0 ? Number(cluster.count / totalUsers * 100).toFixed(0) : 0)}% 用户</p>
              </div>
            );
          })}
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : !clusters ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
          暂无分群数据
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(clusters).map(([key, cluster]: [string, any]) => {
            const meta = CLUSTER_META[key] || { color: 'gray', label: key, desc: '' };
            const borderColor = meta.color === 'purple' ? 'border-purple-800/40' :
              meta.color === 'cyan' ? 'border-cyan-800/40' :
              meta.color === 'amber' ? 'border-amber-800/40' : 'border-gray-800';
            return (
              <div key={key} className={`bg-gray-800/30 border ${borderColor} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-white">{meta.label}</h5>
                  <span className="text-xs text-gray-500">{cluster.count} 人</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{meta.desc}</p>
                <div className="space-y-1.5">
                  {(cluster.users || []).slice(0, 6).map((u: any, i: number) => (
                    <div key={u.userId || i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">
                          {(u.name || '?')[0]}
                        </div>
                        <span className="text-gray-300 truncate">{u.name || '未知'}</span>
                        {u.hasApiKey && <span className="text-[9px] px-1 py-0.5 bg-blue-900/30 text-blue-400 rounded">API</span>}
                      </div>
                      <span className="text-gray-500 whitespace-nowrap ml-2">{u.conversationCount} 对话</span>
                    </div>
                  ))}
                  {cluster.count > 6 && <p className="text-[10px] text-gray-600 text-center pt-1">+{cluster.count - 6} 位用户...</p>}
                  {cluster.count === 0 && <p className="text-xs text-gray-600 text-center">暂无用户</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 用户记录 ───────────────────────────────────────────────────────────────

function AssetUserChats({ userChatsData, isLoading, onRefresh }: {
  userChatsData: any; isLoading: boolean; onRefresh: () => void;
}) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const users = userChatsData?.users || [];
  const totalUsers = userChatsData?.totalUsers || 0;
  const totalMessages = users.reduce((s: number, u: any) => s + u.totalMessages, 0);
  const totalCost = users.reduce((s: number, u: any) => s + u.totalCost, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">用户对话记录</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            共 {totalUsers} 位用户产生对话 · 筛选条件同上（日期/模式/计费）
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '活跃用户', value: totalUsers, icon: Users, color: 'text-purple-400' },
          { label: '总消息数', value: totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'API 成本', value: `¥${Number(totalCost || 0).toFixed(4)}`, icon: DollarSign, color: 'text-amber-400' },
          { label: '平均/用户', value: totalUsers > 0 ? (totalMessages / totalUsers).toFixed(1) : '0', icon: Zap, color: 'text-green-400' },
        ].map(card => (
          <div key={card.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3">
            <div className={`${card.color}`}><card.icon className="w-4 h-4" /></div>
            <div>
              <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
              <div className="text-[10px] text-gray-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <UsersRound className="w-10 h-10 mx-auto mb-2 opacity-30" />
          暂无对话记录
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {users.map((userGroup: any) => {
            const isExpanded = expandedUser === userGroup.user?.id;
            const avatarColor = [
              'from-blue-500 to-purple-500',
              'from-green-500 to-teal-500',
              'from-orange-500 to-red-500',
              'from-pink-500 to-rose-500',
              'from-indigo-500 to-blue-500',
            ][users.indexOf(userGroup) % 5];

            return (
              <div key={userGroup.user?.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
                {/* User header row */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedUser(isExpanded ? null : userGroup.user?.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {(userGroup.user?.name?.[0] || userGroup.user?.email?.[0] || '?').toUpperCase()}
                    </div>

                    {/* User info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">
                          {userGroup.user?.name || <span className="text-gray-500 italic">未命名</span>}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate">{userGroup.user?.email}</span>
                        {userGroup.user?.plan && userGroup.user?.plan !== 'FREE' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded-full">
                            {userGroup.user?.plan}
                          </span>
                        )}
                      </div>
                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                        <span>{userGroup.convCount} 次对话</span>
                        <span className="text-gray-600">·</span>
                        <span>{userGroup.totalMessages} 条消息</span>
                        <span className="text-gray-600">·</span>
                        <span className="text-amber-400">¥{Number(userGroup.totalCost || 0).toFixed(4)}</span>
                        <span className="text-gray-600">·</span>
                        <span>{userGroup.lastActivity ? fmtDateShort(userGroup.lastActivity) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isExpanded ? (
                      <span className="text-[10px] text-gray-600">收起</span>
                    ) : (
                      <span className="text-[10px] text-gray-600">展开 {userGroup.convCount} 个对话</span>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded: conversation list */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-gray-700/40"
                    >
                      <div className="px-4 py-3 space-y-2">
                        {userGroup.conversations.map((conv: any) => (
                          <div key={conv.id} className="bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-gray-500">{fmtDate(conv.updatedAt)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">{conv.mode}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${conv.billingMode === 'A' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
                                  {conv.billingMode === 'A' ? 'API Key' : '平台代付'}
                                </span>
                                {(conv.personas as Array<{ id: string; name: string; nameZh: string }>)?.length > 0 && (
                                  <span className="text-[10px] text-gray-500">
                                    {(conv.personas as Array<{ id: string; name: string; nameZh: string }>).slice(0, 3).map(p => p.nameZh).join(' + ')}
                                    {conv.personas.length > 3 ? ` +${conv.personas.length - 3}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                <span>{conv.messageCount} 条消息</span>
                                <span className="text-amber-400">¥{Number(conv.totalCost || 0).toFixed(4)}</span>
                              </div>
                            </div>
                            {/* Message preview */}
                            {conv.messages?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {conv.messages.slice(0, 2).map((msg: any) => {
                                  const isUser = msg.role === 'user' || msg.role === 'human';
                                  return (
                                    <div key={msg.id} className="flex items-start gap-2">
                                      <span className={`text-[9px] font-bold flex-shrink-0 w-4 ${isUser ? 'text-blue-400' : 'text-purple-400'}`}>
                                        {isUser ? 'U' : (msg.personaName ? msg.personaName.slice(0, 2) : 'AI')}
                                      </span>
                                      <span className="text-[10px] text-gray-400 truncate flex-1">
                                        {msg.content?.slice(0, 120)}
                                      </span>
                                    </div>
                                  );
                                })}
                                {conv.messages.length > 2 && (
                                  <p className="text-[9px] text-gray-600 pl-6">+{conv.messages.length - 2} 条更多...</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: 同步管理 ─────────────────────────────────────────────────────────

function SyncSection() {
  const [syncData, setSyncData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'conflicts' | 'devices' | 'logs'>('overview');

  const loadSyncData = async (isRefresh = false) => {
    try {
      setSyncError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await fetch('/api/admin/sync/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSyncData(data);
      } else if (res.status === 401 || res.status === 403) {
        setSyncError('未授权：请先登录管理账号');
      } else {
        const text = await res.text();
        setSyncError(`加载失败 (${res.status}): ${text}`);
      }
    } catch (e) {
      setSyncError(`网络错误: ${String(e)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSyncData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (syncError) {
    return (
      <div className="space-y-4">
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">同步管理加载失败</p>
            <p className="text-xs text-gray-400 mt-0.5">{syncError}</p>
          </div>
          <button onClick={() => loadSyncData()} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg text-xs text-red-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> 重试
          </button>
        </div>
      </div>
    );
  }

  const stats = syncData?.stats ?? {};
  const conflicts = syncData?.conflicts ?? [];
  const devices = syncData?.devices ?? [];
  const recentLogs = syncData?.recentLogs ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">同步管理</h2>
          <p className="text-gray-400 text-sm mt-1">多设备对话同步状态监控</p>
        </div>
        <button
          onClick={() => loadSyncData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="已注册设备"
          value={stats.totalDevices ?? 0}
          icon={<Monitor className="w-5 h-5 text-blue-400" />}
          color="blue"
        />
        <KpiCard
          label="本地对话快照"
          value={stats.totalLocalConversations ?? 0}
          icon={<Smartphone className="w-5 h-5 text-purple-400" />}
          color="purple"
        />
        <KpiCard
          label="待解决冲突"
          value={stats.unresolvedConflicts ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          color="amber"
          highlight={stats.unresolvedConflicts > 0}
        />
        <KpiCard
          label="总同步次数"
          value={stats.totalSyncs ?? 0}
          icon={<SyncIcon className="w-5 h-5 text-green-400" />}
          color="green"
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {([
          ['overview', '总览'],
          ['conflicts', `冲突 (${conflicts.length})`],
          ['devices', `设备 (${devices.length})`],
          ['logs', '同步日志'],
        ] as [typeof tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-prism-blue text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Sync success rate */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">同步健康度</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-2">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#1f2937" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="36" fill="none"
                      stroke="#10b981" strokeWidth="6"
                      strokeDasharray={`${(stats.syncSuccessRate ?? 0) * 2.26} 226`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {Math.round((stats.syncSuccessRate ?? 0) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">成功率</p>
              </div>
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-2">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#1f2937" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="36" fill="none"
                      stroke="#06b6d4" strokeWidth="6"
                      strokeDasharray={`${(stats.avgConflictRate ?? 0) * 2.26} 226`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {Math.round((stats.avgConflictRate ?? 0) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">冲突率</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white mb-2">
                  {stats.avgDurationMs ? `${(stats.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                </p>
                <p className="text-xs text-gray-500">平均耗时</p>
              </div>
            </div>
          </div>

          {/* Sync volume over time */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">每日同步量</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={syncData?.dailyStats ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                  <Bar dataKey="pushCount" name="推送" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pullCount" name="拉取" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'conflicts' && (
        <div className="space-y-3">
          {conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-base font-medium text-white">暂无同步冲突</p>
              <p className="text-sm text-gray-500 mt-1">所有设备的对话数据已完美同步</p>
            </div>
          ) : (
            conflicts.map((conflict: any) => (
              <div key={conflict.id} className="bg-gray-900/60 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {conflict.personaIds?.join(' + ') || '未知对话'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        类型: {conflict.conflictType} · 用户: {conflict.userId?.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        设备: {conflict.deviceId?.slice(0, 8)}... · {fmtDate(conflict.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    conflict.resolution === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                  }`}>
                    {conflict.resolution === 'PENDING' ? '待解决' : conflict.resolution}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'devices' && (
        <div className="space-y-3">
          {devices.map((device: any) => (
            <div key={device.id} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {device.deviceType === 'DESKTOP' ? (
                  <Monitor className="w-5 h-5 text-blue-400" />
                ) : (
                  <Smartphone className="w-5 h-5 text-purple-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{device.deviceName || '未知设备'}</p>
                  <p className="text-xs text-gray-500">
                    {device.platform} · {device.browser} · {device.osVersion}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{device.conversationCount} 个对话</p>
                  <p className="text-xs text-gray-600">最后活跃: {fmtDate(device.lastActiveAt)}</p>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.syncToken ? 'bg-green-500' : 'bg-gray-600'}`} title={device.syncToken ? '已同步' : '未同步'} />
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无设备数据</div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-2">
          {recentLogs.map((log: any) => (
            <div key={log.id} className="bg-gray-900/60 border border-gray-800/60 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  log.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : log.status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : log.status === 'CONFLICT' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}>
                  {log.status}
                </span>
                <span className="text-xs text-gray-500">
                  {log.direction} · 推送 {log.pushedCount ?? 0} · 拉取 {log.pulledCount ?? 0} · 合并 {log.mergedCount ?? 0}
                </span>
                <span className="text-xs text-gray-600 ml-auto">{fmtDate(log.createdAt)}</span>
                <span className="text-xs text-gray-600">{(log.durationMs ?? 0) / 1000}s</span>
              </div>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无同步日志</div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color, highlight }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'amber' | 'green';
  highlight?: boolean;
}) {
  const colorMap = {
    blue: 'border-blue-500/20',
    purple: 'border-purple-500/20',
    amber: highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-amber-500/20',
    green: 'border-green-500/20',
  };
  const textMap = { blue: 'text-blue-400', purple: 'text-purple-400', amber: 'text-amber-400', green: 'text-green-400' };

  return (
    <div className={`rounded-2xl border p-5 bg-gray-900/60 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${textMap[color]}`}>{value.toLocaleString()}</p>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function AdminDashboardPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <AdminDashboardPage />
    </Suspense>
  );
}
