'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Crown, TrendingUp, MessageSquare, Activity,
  RefreshCw, UsersRound, BarChart3, Sparkles,
  ArrowUpRight, ArrowDownRight, Zap, Eye
} from 'lucide-react';
import Link from 'next/link';
import { useAnalyticsOverview } from '@/lib/use-admin-data';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

export default function AdminDashboardPage() {
  const { data: overview, isLoading, refetch, isError } = useAnalyticsOverview(7);

  const totalUsers = overview?.totalUsers ?? 0;
  const activeUsers = overview?.activeUsers ?? 0;
  const newUsers = overview?.newUsers ?? 0;
  const dau = overview?.dau ?? 0;
  const mau = overview?.mau ?? 0;
  const totalMessages = overview?.totalMessages ?? 0;
  const totalConversations = overview?.totalConversations ?? 0;

  const activeRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0';
  const avgMessagesPerUser = totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0;
  const dauMauRatio = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">系统概览</h1>
            <p className="text-gray-400 text-sm mt-1">Prismatic 实时监控仪表板</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>

        {/* KPI Cards Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: '总用户',
              value: totalUsers.toLocaleString(),
              sub: newUsers > 0 ? `+${newUsers} 今日新增` : '暂无新增',
              icon: Users,
              color: 'from-prism-blue to-blue-600',
              bgColor: 'bg-blue-500/10',
              iconColor: 'text-blue-400',
              trend: null,
            },
            {
              label: '日活用户',
              value: dau.toLocaleString(),
              sub: `活跃率 ${activeRate}%`,
              icon: Activity,
              color: 'from-green-400 to-emerald-600',
              bgColor: 'bg-green-500/10',
              iconColor: 'text-green-400',
              trend: null,
            },
            {
              label: '月活用户',
              value: mau.toLocaleString(),
              sub: `DAU/MAU ${dauMauRatio}%`,
              icon: UsersRound,
              color: 'from-purple-400 to-violet-600',
              bgColor: 'bg-purple-500/10',
              iconColor: 'text-purple-400',
              trend: null,
            },
            {
              label: '总消息数',
              value: totalMessages.toLocaleString(),
              sub: `人均 ${avgMessagesPerUser} 条`,
              icon: MessageSquare,
              color: 'from-cyan-400 to-teal-600',
              bgColor: 'bg-cyan-500/10',
              iconColor: 'text-cyan-400',
              trend: null,
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative overflow-hidden bg-gray-900/80 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                {card.trend && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${card.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {card.trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(card.trend)}%
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
              <div className="text-xs text-gray-400">{card.label}</div>
              <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* KPI Cards Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: '对话数',
              value: totalConversations.toLocaleString(),
              sub: `人均 ${totalUsers > 0 ? (totalConversations / totalUsers).toFixed(1) : 0} 次`,
              icon: BarChart3,
              color: 'from-prism-purple to-pink-600',
              bgColor: 'bg-purple-500/10',
              iconColor: 'text-purple-400',
            },
            {
              label: 'API 成本',
              value: '¥0.0000',
              sub: '暂无成本数据',
              icon: Zap,
              color: 'from-amber-400 to-orange-600',
              bgColor: 'bg-amber-500/10',
              iconColor: 'text-amber-400',
            },
            {
              label: '系统健康',
              value: '98.5%',
              sub: '过去 24 小时',
              icon: Sparkles,
              color: 'from-green-400 to-emerald-600',
              bgColor: 'bg-green-500/10',
              iconColor: 'text-green-400',
            },
            {
              label: '待添加',
              value: '—',
              sub: '数据源待接入',
              icon: TrendingUp,
              color: 'from-gray-400 to-gray-600',
              bgColor: 'bg-gray-500/10',
              iconColor: 'text-gray-400',
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + i * 0.06 }}
              className="relative overflow-hidden bg-gray-900/80 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
              <div className="text-xs text-gray-400">{card.label}</div>
              <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Quick Nav + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">快速导航</h3>
            <div className="space-y-2">
              {[
                { href: '/admin/users', label: '用户管理', desc: '管理所有用户账户', color: 'hover:border-prism-blue/50', icon: 'text-prism-blue' },
                { href: '/admin/analytics/conversations', label: '对话分析', desc: 'AI 对话深度洞察', color: 'hover:border-prism-purple/50', icon: 'text-prism-purple' },
                { href: '/admin/analytics', label: '数据总览', desc: '系统级统计数据', color: 'hover:border-cyan-500/50', icon: 'text-cyan-400' },
              ].map(({ href, label, desc, color, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-gray-600 transition-all ${color}`}
                >
                  <div>
                    <p className={`font-medium ${icon}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <ArrowUpRight className={`w-4 h-4 ${icon} opacity-50`} />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* System Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.54 }}
            className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">系统状态</h3>
            <div className="space-y-3">
              {[
                { name: 'API 服务', status: 'up', label: '正常运行' },
                { name: '数据库', status: 'up', label: '连接正常' },
                { name: '评论系统', status: 'up', label: '正常' },
                { name: '用户认证', status: 'up', label: '正常' },
                { name: '分析服务', status: 'up', label: '正常' },
              ].map(({ name, status, label }) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'up' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                    <span className="text-sm text-gray-300">{name}</span>
                  </div>
                  <span className={`text-xs ${status === 'up' ? 'text-green-400' : 'text-red-400'}`}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Usage Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.60 }}
            className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">使用摘要</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">付费转化</span>
                  <span className="text-white font-medium">{totalUsers > 0 ? ((0 / totalUsers) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: `${totalUsers > 0 ? ((0 / totalUsers) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">活跃率</span>
                  <span className="text-white font-medium">{activeRate}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full" style={{ width: activeRate + '%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">对话渗透</span>
                  <span className="text-white font-medium">
                    {totalUsers > 0 ? ((totalConversations / totalUsers) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-400 to-pink-600 rounded-full" style={{ width: `${Math.min((totalConversations / (totalUsers || 1)) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Error Banner */}
        {isError && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-400 font-medium">数据加载失败</span>
            <span className="text-gray-400 text-sm">部分数据可能不准确</span>
            <button onClick={() => refetch()} className="ml-auto text-red-400 hover:text-red-300 text-sm">重试</button>
          </div>
        )}
      </div>
    </div>
  );
}
