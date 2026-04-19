'use client';

/**
 * Prismatic — Admin Dashboard
 * 管理后台 - 四个 Tab 同级切换
 */

import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Crown, UserCheck, UserX, Filter,
  RefreshCw, Ban, ChevronRight, ChevronLeft, Plus, Eye,
  Trash2, Check, AlertCircle, Loader2, BarChart3,
  Activity, MessageSquare, TrendingUp, Zap,
  LayoutDashboard, UserCog, MessageSquare as MsgIcon,
  TrendingDown, DollarSign, Bot, BarChart2,
  Database, BookOpen,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
  PieChart as RePieChart, Pie, Cell,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import {
  useUsers, useUpdateUser, useDeleteUser, useAddCredits,
  useAnalyticsOverview, useAnalyticsTrend, useAnalyticsPersonas,
  useCapacity,
} from '@/lib/use-admin-data';
import type { User, UserFilter } from '@/lib/use-admin-data';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'conversations' | 'analytics' | 'chat-assets';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

interface ConversationAnalysis {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalTokens: number;
    totalApiCost: number;
    avgCostPerConversation: number;
    avgTokensPerMessage: number;
  };
  personas: Array<{
    personaId: string;
    personaName: string;
    conversationCount: number;
    totalTokens: number;
    totalCost: number;
  }>;
  dailyTrend: Array<{ date: string; messages: number; conversations: number; tokens: number; cost: number }>;
  modeStats: Array<{ mode: string; _count: { id: number }; _sum: { totalCost: number | null } }>;
  topUsers: Array<{ userId: string; name: string; messageCount: number; totalCost: number }>;
  period: { days: number; startDate: string };
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────

function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs = [
    { id: 'overview' as Tab, label: '系统概览', icon: LayoutDashboard },
    { id: 'users' as Tab, label: '用户管理', icon: UserCog },
    { id: 'conversations' as Tab, label: '对话分析', icon: MessageSquare },
    { id: 'analytics' as Tab, label: '数据总览', icon: BarChart3 },
    { id: 'chat-assets' as Tab, label: '对话资产', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-2xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">管理后台</h1>
              <p className="text-gray-400 text-sm mt-1">Prismatic 实时监控与数据分析</p>
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
          {activeTab === 'overview' && <TabPanel key="overview"><OverviewSection /></TabPanel>}
          {activeTab === 'users' && <TabPanel key="users"><UsersSection /></TabPanel>}
          {activeTab === 'conversations' && <TabPanel key="conversations"><ConversationsSection /></TabPanel>}
          {activeTab === 'analytics' && <TabPanel key="analytics"><AnalyticsSection /></TabPanel>}
          {activeTab === 'chat-assets' && <TabPanel key="chat-assets"><ChatAssetsSection /></TabPanel>}
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

// ─── Tab 1: 系统概览 ───────────────────────────────────────────────────────────

function OverviewSection() {
  const { data: overview, isLoading, refetch, isError } = useAnalyticsOverview(7);

  const totalUsers = overview?.totalUsers ?? 0;
  const newUsers = overview?.newUsers ?? 0;
  const dau = overview?.dau ?? 0;
  const mau = overview?.mau ?? 0;
  const totalMessages = overview?.totalMessages ?? 0;
  const totalConversations = overview?.totalConversations ?? 0;
  const paidUsers = overview?.paidUsers ?? 0;
  const activeRate = overview?.activeRate ?? 0;
  const dauMauRatio = overview?.dauMauRatio ?? 0;
  const avgMessagesPerUser = totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">系统概览</h2>
          <p className="text-gray-400 text-sm">过去 7 天数据</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总用户', value: totalUsers.toLocaleString(), sub: newUsers > 0 ? `+${newUsers} 今日新增` : '暂无新增', icon: Users, iconColor: 'text-blue-400' },
          { label: '日活用户', value: dau.toLocaleString(), sub: `活跃率 ${activeRate}%`, icon: Activity, iconColor: 'text-green-400' },
          { label: '月活用户', value: mau.toLocaleString(), sub: `DAU/MAU ${dauMauRatio}%`, icon: Users, iconColor: 'text-purple-400' },
          { label: '总消息数', value: totalMessages.toLocaleString(), sub: `人均 ${avgMessagesPerUser} 条`, icon: MessageSquare, iconColor: 'text-cyan-400' },
        ].map(card => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '对话数', value: totalConversations.toLocaleString(), sub: `人均 ${totalUsers > 0 ? (totalConversations / totalUsers).toFixed(1) : 0} 次`, icon: BarChart3, iconColor: 'text-purple-400' },
          { label: 'API 成本', value: '¥0.0000', sub: '暂无成本数据', icon: Zap, iconColor: 'text-amber-400' },
          { label: '消息数', value: totalMessages.toLocaleString(), sub: `人均 ${avgMessagesPerUser} 条`, icon: MessageSquare, iconColor: 'text-cyan-400' },
          { label: '付费用户', value: paidUsers.toLocaleString(), sub: '非 Free 计划用户', icon: Crown, iconColor: 'text-amber-400' },
        ].map(card => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>

      {/* 使用摘要 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 付费转化 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">付费转化</h3>
          <div className="text-3xl font-bold text-amber-400 mb-1">{paidUsers || 0}</div>
          <div className="text-xs text-gray-500">付费用户</div>
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
              style={{ width: `${totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">占总用户 {totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0}%</div>
        </div>

        {/* 活跃率 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">活跃率</h3>
          <div className="text-3xl font-bold text-green-400 mb-1">{activeRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">今日活跃 / 总用户</div>
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full"
              style={{ width: `${Math.min(activeRate, 100)}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">DAU/MAU {dauMauRatio.toFixed(1)}%</div>
        </div>

        {/* 对话渗透 */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">对话渗透</h3>
          <div className="text-3xl font-bold text-purple-400 mb-1">
            {totalUsers > 0 ? ((totalConversations / totalUsers) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-gray-500">总对话数 / 总用户</div>
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-400 to-pink-600 rounded-full"
              style={{ width: `${Math.min((totalConversations / (totalUsers || 1)) * 100, 100)}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">共 {totalConversations.toLocaleString()} 次对话</div>
        </div>
      </div>

      {isError && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3">
          <span className="text-red-400 font-medium">数据加载失败</span>
          <span className="text-gray-400 text-sm">部分数据可能不准确</span>
          <button onClick={() => refetch()} className="ml-auto text-red-400 hover:text-red-300 text-sm">重试</button>
        </div>
      )}

      {/* 数据库容量监控 */}
      <CapacityCard />
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, iconColor }: {
  label: string; value: string; sub: string; icon: React.ElementType; iconColor: string;
}) {
  return (
    <div className="relative overflow-hidden bg-gray-900/80 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors group">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

// ─── 数据库容量监控卡片 ───────────────────────────────────────────────────────

function CapacityCard() {
  const { data: report, isLoading } = useCapacity();

  if (isLoading) {
    return (
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-gray-500" />
          <div className="h-4 bg-gray-700 rounded w-24" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-700 rounded w-full" />
          <div className="h-3 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { storage } = report;
  const barColor = storage.status === 'red' ? 'bg-red-500'
    : storage.status === 'yellow' ? 'bg-yellow-500' : 'bg-green-500';
  const borderColor = storage.status === 'red' ? 'border-red-500/40'
    : storage.status === 'yellow' ? 'border-yellow-500/40' : 'border-gray-700';
  const labelColor = storage.status === 'red' ? 'text-red-400'
    : storage.status === 'yellow' ? 'text-yellow-400' : 'text-green-400';
  const badgeBg = storage.status === 'red' ? 'bg-red-900/30 text-red-400'
    : storage.status === 'yellow' ? 'bg-yellow-900/30 text-yellow-400'
    : 'bg-green-900/30 text-green-400';

  const fmtBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className={`bg-gray-900/80 border ${borderColor} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300 font-medium">数据库存储</span>
        </div>
        <div className="flex items-center gap-2">
          {storage.daysUntilFull !== null && (
            <span className={`text-xs ${labelColor}`}>
              预计 {storage.daysUntilFull} 天后耗尽
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeBg}`}>
            {storage.status === 'red' ? '紧急' : storage.status === 'yellow' ? '预警' : '正常'}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-gray-800 rounded-full h-2.5 mb-3">
        <div
          className={`h-2.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(storage.usedPercent * 100, 100).toFixed(1)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-semibold text-sm">
          {fmtBytes(storage.usedBytes)}
          <span className="text-gray-500"> / {fmtBytes(storage.limitBytes)}</span>
        </span>
        <span className="text-gray-400 text-sm">{(storage.usedPercent * 100).toFixed(1)}%</span>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-3">
        <div>
          <div className="text-gray-400 font-medium">{storage.messageCount.toLocaleString()}</div>
          <div>消息</div>
        </div>
        <div>
          <div className="text-gray-400 font-medium">{storage.conversationCount.toLocaleString()}</div>
          <div>对话</div>
        </div>
        <div>
          <div className="text-gray-400 font-medium">{storage.userCount.toLocaleString()}</div>
          <div>用户</div>
        </div>
      </div>

      {/* 升级建议 */}
      {storage.status !== 'green' && report.upgradeRecommendation && (
        <div className={`p-3 rounded-xl text-xs ${storage.status === 'red' ? 'bg-red-900/20 text-red-300' : 'bg-yellow-900/20 text-yellow-300'}`}>
          {report.upgradeRecommendation}
        </div>
      )}
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

  const SortIcon = ({ col }: { col: string }) => (
    filters.sortBy !== col
      ? <span className="opacity-30 ml-1 text-xs">↕</span>
      : filters.sortOrder === 'asc' ? <span className="text-blue-400 ml-1 text-xs">↑</span> : <span className="text-blue-400 ml-1 text-xs">↓</span>
  );

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
          { label: '总用户', value: data?.total || 0, icon: Users, color: 'text-blue-400' },
          { label: '活跃用户', value: totalActive, icon: UserCheck, color: 'text-green-400' },
          { label: '付费用户', value: totalPaid, icon: Crown, color: 'text-amber-400' },
          { label: '总消息', value: totalMessages.toLocaleString(), icon: Filter, color: 'text-purple-400' },
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
                  <div className="col-span-2 text-sm text-gray-400">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}</div>
                  <div className="col-span-2 text-sm text-gray-400">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('zh-CN') : <span className="text-gray-600">从未</span>}</div>
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
                            <div className="flex justify-between"><span className="text-gray-500">用户ID</span><span className="text-gray-300 font-mono text-xs">{user.id.slice(0, 16)}...</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">邮箱</span><span className="text-gray-300">{user.email || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">注册时间</span><span className="text-gray-300">{user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}</span></div>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">使用统计</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">对话数</span><span className="text-gray-300">{user.conversationCount?.toLocaleString() || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">消息数</span><span className="text-gray-300">{user.messageCount?.toLocaleString() || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">最后活跃</span><span className="text-gray-300">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('zh-CN') : '从未'}</span></div>
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
                        <div className="col-span-3 flex items-center justify-end">
                          <button onClick={() => router.push(`/admin/users/${user.id}`)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors">
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

// ─── Tab 3: 对话分析 ───────────────────────────────────────────────────────────

async function fetchConversationAnalysis(days: number): Promise<ConversationAnalysis> {
  const res = await fetch(`/api/analytics/conversations?days=${days}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

function ConversationsSection() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useQuery<ConversationAnalysis>({
    queryKey: ['conversation-analysis', days],
    queryFn: () => fetchConversationAnalysis(days),
    staleTime: 1000 * 60 * 5,
  });

  const overview = data?.overview;
  const personas = data?.personas || [];
  const dailyTrend = data?.dailyTrend || [];
  const modeStats = data?.modeStats || [];
  const topUsers = data?.topUsers || [];
  const modeChartData = modeStats.map(m => ({ name: m.mode, value: m._count.id }));
  const costChartData = personas.slice(0, 10).map(p => ({
    name: p.personaName.length > 8 ? p.personaName.slice(0, 8) + '...' : p.personaName,
    cost: p.totalCost,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">对话分析</h2>
          <p className="text-gray-400 text-sm">Token 消耗与成本监控</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === d ? 'bg-prism-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                {d}天
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总消息数', value: (overview?.totalMessages || 0).toLocaleString(), icon: MessageSquare, iconColor: 'text-blue-400' },
          { label: '总对话数', value: (overview?.totalConversations || 0).toLocaleString(), icon: Zap, iconColor: 'text-purple-400' },
          { label: 'Token 消耗', value: `${((overview?.totalTokens || 0) / 1000).toFixed(1)}K`, icon: Activity, iconColor: 'text-cyan-400' },
          { label: 'API 成本', value: `¥${(overview?.totalApiCost || 0).toFixed(4)}`, icon: DollarSign, iconColor: 'text-amber-400' },
        ].map(card => (
          <div key={card.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div className={`text-3xl font-bold ${card.label === 'API 成本' ? 'text-amber-400' : 'text-white'}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: '平均每次对话成本', value: `¥${(overview?.avgCostPerConversation || 0).toFixed(4)}`, icon: BarChart2 },
          { label: '平均每次消息 Token', value: `${(overview?.avgTokensPerMessage || 0).toFixed(0)}`, icon: Zap },
          { label: '平均每次对话消息数', value: overview && overview.totalConversations > 0 ? (overview.totalMessages / overview.totalConversations).toFixed(1) : '0', icon: MessageSquare },
        ].map(card => (
          <div key={card.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{card.label}</span>
              <card.icon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">每日消息趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorMsg3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={v => new Date(v).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMsg3)" name="消息数" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">对话模式分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie data={modeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}>
                {modeChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">人物使用排行（Top 10）</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={v => `¥${v.toFixed(4)}`} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={value => [`¥${Number(value).toFixed(4)}`, '成本']} />
            <Bar dataKey="cost" fill="#f59e0b" name="API 成本" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">高消耗用户排行</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">用户</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">消息数</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Token 消耗</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">API 成本</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map(user => {
                const userPersona = personas.find(p => p.personaName === user.name);
                return (
                  <tr key={user.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                          {user.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.userId.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white">{user.messageCount.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-cyan-400">{userPersona ? `${(userPersona.totalTokens / 1000).toFixed(1)}K` : 'N/A'}</td>
                    <td className="text-right py-3 px-4 text-amber-400">¥{user.totalCost.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
          <p className="text-red-400">加载失败: {error.message}</p>
          <button onClick={() => refetch()} className="mt-2 px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg">重试</button>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: 数据总览 ───────────────────────────────────────────────────────────

function AnalyticsSection() {
  const [days, setDays] = useState(7);
  const { data: overview, isLoading, refetch, isError } = useAnalyticsOverview(days);
  const { data: trend } = useAnalyticsTrend(days);
  const { data: personas } = useAnalyticsPersonas(30);

  const trendData = Array.isArray(trend) ? trend : [];
  const personasData = Array.isArray(personas) ? personas.slice(0, 8) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">数据总览</h2>
          <p className="text-gray-400 text-sm">过去 {days} 天数据</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === d ? 'bg-prism-blue text-white' : 'text-gray-400 hover:text-white'}`}>
                {d}天
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: '日活用户 (DAU)', value: overview?.dau ?? 0, change: 12.5, changeType: 'positive' as const, icon: Users },
          { title: '月活用户 (MAU)', value: overview?.mau ?? 0, change: 8.3, changeType: 'positive' as const, icon: Activity },
          { title: '总消息数', value: overview?.totalMessages ?? 0, change: -2.1, changeType: 'negative' as const, icon: MsgIcon },
          { title: 'API 成本', value: `¥${(overview?.totalApiCost ?? 0).toFixed(2)}`, change: 15.2, changeType: 'negative' as const, icon: DollarSign, isCurrency: true },
        ].map(card => (
          <div key={card.title} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{card.title}</span>
              <div className="w-10 h-10 rounded-lg bg-prism-blue/20 flex items-center justify-center">
                <card.icon className="w-5 h-5 text-prism-blue" />
              </div>
            </div>
            <div className={`text-3xl font-bold mb-2 ${card.isCurrency ? 'text-amber-400' : 'text-white'}`}>{card.value}</div>
            <div className={`flex items-center gap-1 text-sm ${card.changeType === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
              {card.changeType === 'positive' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{card.change > 0 ? '+' : ''}{card.change.toFixed(1)}%</span>
              <span className="text-gray-500">vs 上期</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '总用户数', value: overview?.totalUsers ?? 0, change: 5.0, changeType: 'positive' as const, icon: Users },
          { title: '新增用户', value: overview?.newUsers ?? 0, change: 18.7, changeType: 'positive' as const, icon: Zap },
          { title: '总对话数', value: overview?.totalConversations ?? 0, change: 3.2, changeType: 'positive' as const, icon: BarChart2 },
        ].map(card => (
          <div key={card.title} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">{card.title}</span>
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                <card.icon className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{card.value.toLocaleString()}</div>
            <div className={`flex items-center gap-1 text-sm ${card.changeType === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
              {card.changeType === 'positive' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{card.change > 0 ? '+' : ''}{card.change.toFixed(1)}%</span>
              <span className="text-gray-500">vs 上期</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">活跃趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorDau2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMsg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={v => new Date(v).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              <Area type="monotone" dataKey="dau" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDau2)" name="日活用户" />
              <Area type="monotone" dataKey="messages" stroke="#06b6d4" fillOpacity={1} fill="url(#colorMsg2)" name="消息数" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">人物热度排行</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={personasData.map(p => ({
              name: p.personaName.length > 6 ? p.personaName.slice(0, 6) + '...' : p.personaName,
              views: p.views || 0,
              conversations: p.conversations || 0,
            }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="views" fill="#8b5cf6" name="浏览次数" />
              <Bar dataKey="conversations" fill="#06b6d4" name="对话次数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isError && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3">
          <span className="text-red-400 font-medium">数据加载失败</span>
          <span className="text-gray-400 text-sm">部分数据可能不准确</span>
          <button onClick={() => refetch()} className="ml-auto text-red-400 hover:text-red-300 text-sm">重试</button>
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: 对话资产 ──────────────────────────────────────────────────────────

type ChatAssetsTab = 'browse' | 'topics' | 'personas' | 'behavior';

function ChatAssetsSection() {
  const [activeTab, setActiveTab] = useState<ChatAssetsTab>('browse');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-gray-800">
        {([
          { id: 'browse' as ChatAssetsTab, label: '对话浏览' },
          { id: 'topics' as ChatAssetsTab, label: '话题聚类' },
          { id: 'personas' as ChatAssetsTab, label: '人物互动' },
          { id: 'behavior' as ChatAssetsTab, label: '用户分群' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'browse' && <ChatBrowseTab />}
      {activeTab === 'topics' && <ChatTopicsTab />}
      {activeTab === 'personas' && <ChatPersonasTab />}
      {activeTab === 'behavior' && <ChatBehaviorTab />}
    </div>
  );
}

// Sub-tab: Chat Browse
function ChatBrowseTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [billingMode, setBillingMode] = useState('');
  const [mode, setMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params = new URLSearchParams({
    page: String(page), pageSize: '20',
    ...(search && { search }),
    ...(billingMode && { billingMode }),
    ...(mode && { mode }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'chats', params.toString()],
    queryFn: () => fetch(`/api/admin/chats?${params}`).then(r => r.json()),
    staleTime: 1000 * 30,
  });

  const convs = rawData?.conversations || [];
  const total = rawData?.total || 0;
  const totalPages = rawData?.totalPages || 1;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="搜索对话内容..."
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 flex-1 min-w-48"
        />
        <select value={billingMode} onChange={e => { setBillingMode(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">全部模式</option>
          <option value="A">User-Pays (API Key)</option>
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
        <button onClick={() => refetch()} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
          搜索
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-900 rounded-lg animate-pulse" />)}</div>
      ) : convs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无对话记录</div>
      ) : (
        <div className="space-y-2">
          {convs.map((conv: any) => (
            <div key={conv.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{new Date(conv.createdAt).toLocaleString('zh-CN')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{conv.mode}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${conv.billingMode === 'A' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
                    {conv.billingMode === 'A' ? 'API Key' : '平台代付'}
                  </span>
                  <span className="text-xs text-gray-500">用户: {conv.user?.name || conv.user?.email || '未知'}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {conv.messageCount} 条 · {conv.messages?.[0]?.content?.slice(0, 40) || ''}...
                </span>
              </div>
              {conv.messages?.slice(0, 3).map((msg: any) => (
                <div key={msg.id} className="text-xs text-gray-400 truncate mt-1 pl-4 border-l border-gray-800">
                  <span className="text-gray-600">[{msg.role}]</span> {msg.content?.slice(0, 80)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
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
  );
}

// Sub-tab: Topic Clustering
function ChatTopicsTab() {
  const [days, setDays] = useState('7');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'topics', days],
    queryFn: () => fetch(`/api/admin/chats/topics?days=${days}`).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const topics = data?.topics || [];
  const total = data?.totalConversations || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">分析时间范围：</span>
        <select value={days} onChange={e => setDays(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="7">近 7 天</option>
          <option value="14">近 14 天</option>
          <option value="30">近 30 天</option>
          <option value="90">近 90 天</option>
        </select>
        <span className="text-xs text-gray-500">共 {total} 条对话</span>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-900 rounded-lg animate-pulse" />)}</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无话题数据（请确保 DEEPSEEK_API_KEY 已配置）</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topics.map((topic: any, i: number) => (
            <div key={i} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{topic.topic}</span>
                <span className="text-xs text-gray-500">{topic.count} 条</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{topic.description}</p>
              <div className="flex flex-wrap gap-1">
                {(topic.examples || []).slice(0, 3).map((ex: string, j: number) => (
                  <span key={j} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full truncate max-w-40">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sub-tab: Persona Interaction
function ChatPersonasTab() {
  const [days, setDays] = useState('30');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'personas', days],
    queryFn: () => fetch(`/api/admin/chats/personas?days=${days}`).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const usage = data?.personaUsage || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">分析时间范围：</span>
        <select value={days} onChange={e => setDays(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="7">近 7 天</option>
          <option value="14">近 14 天</option>
          <option value="30">近 30 天</option>
          <option value="90">近 90 天</option>
        </select>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-900 rounded-lg animate-pulse" />)}</div>
      ) : usage.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无数据</div>
      ) : (
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left p-3 font-medium">人物</th>
                <th className="text-right p-3 font-medium">消息数</th>
                <th className="text-right p-3 font-medium">总 Token</th>
                <th className="text-right p-3 font-medium">总成本</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((p: any) => (
                <tr key={p.personaId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="p-3 text-white font-medium">{p.personaId}</td>
                  <td className="p-3 text-right text-gray-400">{p.messageCount.toLocaleString()}</td>
                  <td className="p-3 text-right text-gray-400">{p.totalTokens.toLocaleString()}</td>
                  <td className="p-3 text-right text-amber-400">¥{p.totalCost?.toFixed(4) || '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Sub-tab: User Behavior Clustering
function ChatBehaviorTab() {
  const [days, setDays] = useState('30');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chats', 'behavior', days],
    queryFn: () => fetch(`/api/admin/chats/behavior?days=${days}`).then(r => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const clusters = data?.clusters;
  const totalUsers = data?.totalActiveUsers || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">分析时间范围：</span>
        <select value={days} onChange={e => setDays(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="7">近 7 天</option>
          <option value="14">近 14 天</option>
          <option value="30">近 30 天</option>
          <option value="90">近 90 天</option>
        </select>
        <span className="text-xs text-gray-500">活跃用户 {totalUsers} 人</span>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-900 rounded-xl animate-pulse" />)}</div>
      ) : !clusters ? (
        <div className="text-center py-12 text-gray-500">暂无数据</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(clusters).map(([key, cluster]: [string, any]) => (
            <div key={key} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">{cluster.label}</h4>
                <span className="text-xs text-gray-500">{cluster.count} 人</span>
              </div>
              <div className="space-y-2">
                {(cluster.users || []).map((u: any) => (
                  <div key={u.userId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-300 truncate">{u.name || '未知'}</span>
                      {u.hasApiKey && <span className="text-[10px] px-1 py-0.5 bg-blue-900/30 text-blue-400 rounded">API</span>}
                    </div>
                    <span className="text-gray-500 whitespace-nowrap ml-2">{u.conversationCount} 对话</span>
                  </div>
                ))}
                {cluster.count > 10 && (
                  <p className="text-[10px] text-gray-600">+{cluster.count - 10} 位用户...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
