'use client';

/**
 * Prismatic — AI Conversation Analysis
 * AI 对话深度分析页面
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, Bot, DollarSign, Zap, TrendingUp,
  Clock, Users, BarChart2, RefreshCw, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

interface ConversationAnalysis {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalInputTokens: number;
    totalOutputTokens: number;
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
  dailyTrend: Array<{
    date: string;
    messages: number;
    conversations: number;
    tokens: number;
    cost: number;
  }>;
  modeStats: Array<{
    mode: string;
    _count: { id: number };
    _sum: { totalCost: number | null };
  }>;
  costByPersona: Array<{
    personaId: string;
    _sum: { apiCost: number | null };
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    messageCount: number;
    totalCost: number;
  }>;
  period: { days: number; startDate: string };
}

async function fetchConversationAnalysis(days: number): Promise<ConversationAnalysis> {
  const res = await fetch(`/api/analytics/conversations?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function ConversationAnalysisPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery<ConversationAnalysis>({
    queryKey: ['conversation-analysis', days],
    queryFn: () => fetchConversationAnalysis(days),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const overview = data?.overview;
  const personas = data?.personas || [];
  const dailyTrend = data?.dailyTrend || [];
  const modeStats = data?.modeStats || [];
  const topUsers = data?.topUsers || [];

  // Pie chart data for modes
  const modeChartData = modeStats.map(m => ({
    name: m.mode,
    value: m._count.id,
  }));

  // Cost by persona chart data
  const costChartData = personas.slice(0, 10).map(p => ({
    name: p.personaName.length > 8 ? p.personaName.slice(0, 8) + '...' : p.personaName,
    cost: p.totalCost,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">对话分析</h1>
          <p className="text-gray-400 text-sm mt-1">AI 对话深度分析 - Token 消耗与成本监控</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  days === d ? 'bg-prism-blue text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">总消息数</span>
            <MessageSquare className="w-5 h-5 text-prism-blue" />
          </div>
          <div className="text-3xl font-bold text-white">
            {(overview?.totalMessages || 0).toLocaleString()}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">总对话数</span>
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {(overview?.totalConversations || 0).toLocaleString()}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">Token 消耗</span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {((overview?.totalTokens || 0) / 1000).toFixed(1)}K
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">API 成本</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400">
            ¥{(overview?.totalApiCost || 0).toFixed(4)}
          </div>
        </motion.div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">平均每次对话成本</span>
            <BarChart2 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ¥{(overview?.avgCostPerConversation || 0).toFixed(4)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">平均每次消息 Token</span>
            <Zap className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {(overview?.avgTokensPerMessage || 0).toFixed(0)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">平均每次对话消息数</span>
            <MessageSquare className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {(overview && overview.totalConversations > 0
              ? (overview.totalMessages / overview.totalConversations).toFixed(1)
              : '0'
            )}
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">每日消息趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMessages)" name="消息数" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Mode Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">对话模式分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie
                data={modeChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {modeChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Persona Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">人物使用排行（Top 10）</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `¥${v.toFixed(4)}`} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: number) => [`¥${value.toFixed(4)}`, '成本']}
            />
            <Bar dataKey="cost" fill="#f59e0b" name="API 成本" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Top Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
      >
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
              {topUsers.map((user, idx) => {
                const userPersona = personas.find(p => p.personaName === user.name);
                return (
                  <tr key={user.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-prism-blue to-prism-purple flex items-center justify-center text-white text-sm font-semibold">
                          {user.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.userId.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white">{user.messageCount.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-cyan-400">
                      {userPersona ? (userPersona.totalTokens / 1000).toFixed(1) + 'K' : 'N/A'}
                    </td>
                    <td className="text-right py-3 px-4 text-amber-400">
                      ¥{user.totalCost.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <RefreshCw className="w-8 h-8 text-prism-blue animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
          <p className="text-red-400">加载失败: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
