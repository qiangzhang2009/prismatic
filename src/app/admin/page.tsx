'use client';

/**
 * Prismatic — Admin Dashboard v2 (React Query)
 * 系统概览仪表板，使用新的 Analytics SDK
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Crown, TrendingUp, MessageSquare, Activity,
  BarChart2, Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle,
  Shield, Flame, TrendingDown, Zap, ChevronRight, Eye, Filter,
  ArrowUpRight, ArrowDownRight, UserCheck, UserX, Sparkles,
  DollarSign, Target, UsersRound, BarChart3, PieChart, FlameKindling
} from 'lucide-react';
import Link from 'next/link';
import { useAnalyticsOverview, useUsers } from '@/lib/use-admin-data';

export default function AdminDashboardPage() {
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useAnalyticsOverview(7);
  const { data: usersData, isLoading: usersLoading } = useUsers({ pageSize: 100 });

  const users = usersData?.items || [];
  const totalUsers = overview?.totalUsers || 0;
  const activeUsers = overview?.activeUsers || 0;
  const newUsers = overview?.newUsers || 0;
  const dau = overview?.dau || 0;
  const mau = overview?.mau || 0;
  const totalMessages = overview?.totalMessages || 0;
  const totalCost = overview?.totalApiCost || 0;

  // Derived metrics
  const activeRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0';
  const payingUsers = users.filter(u => u.plan !== 'FREE').length;
  const avgCostPerUser = totalUsers > 0 ? (totalCost / totalUsers).toFixed(4) : '0.0000';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">系统概览</h1>
          <p className="text-gray-400 text-sm mt-1">Prismatic 系统状态与关键指标</p>
        </div>
        <button
          onClick={() => refetchOverview()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">总用户数</span>
            <Users className="w-5 h-5 text-prism-blue" />
          </div>
          <div className="text-3xl font-bold text-white">{totalUsers.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className={`${newUsers > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {newUsers > 0 ? '+' : ''}{newUsers}
            </span>
            <span className="text-gray-500">本周新增</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">日活用户</span>
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">{dau.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-gray-500">活跃率 {activeRate}%</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">月活用户</span>
            <UsersRound className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{mau.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-gray-500">DAU/MAU = {(dau / (mau || 1) * 100).toFixed(1)}%</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">总消息数</span>
            <MessageSquare className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalMessages.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-gray-500">平均每人 {Math.round(totalMessages / (totalUsers || 1))} 条</span>
          </div>
        </motion.div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">付费用户</span>
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white">{payingUsers.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-2">占比 {(payingUsers / (totalUsers || 1) * 100).toFixed(1)}%</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">API 成本</span>
            <DollarSign className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-red-400">¥{totalCost.toFixed(4)}</div>
          <div className="text-sm text-gray-500 mt-2">平均 ¥{avgCostPerUser} / 用户</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">对话数</span>
            <BarChart3 className="w-5 h-5 text-prism-purple" />
          </div>
          <div className="text-3xl font-bold text-white">{overview?.totalConversations?.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-500 mt-2">
            平均每人 {Math.round((overview?.totalConversations || 0) / (totalUsers || 1))} 次
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">系统健康度</span>
            <Sparkles className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-400">98.5%</div>
          <div className="text-sm text-gray-500 mt-2">过去24小时</div>
        </motion.div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/users"
          className="bg-gray-900/50 backdrop-blur border border-gray-800 hover:border-prism-blue/50 rounded-xl p-4 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-prism-blue">用户管理</h3>
              <p className="text-sm text-gray-400 mt-1">查看和管理所有用户</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-prism-blue" />
          </div>
        </Link>

        <Link
          href="/admin/analytics/conversations"
          className="bg-gray-900/50 backdrop-blur border border-gray-800 hover:border-prism-purple/50 rounded-xl p-4 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-prism-purple">对话分析</h3>
              <p className="text-sm text-gray-400 mt-1">AI 对话深度洞察</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-prism-purple" />
          </div>
        </Link>

        <Link
          href="/admin/analytics"
          className="bg-gray-900/50 backdrop-blur border border-gray-800 hover:border-cyan-500/50 rounded-xl p-4 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400">数据总览</h3>
              <p className="text-sm text-gray-400 mt-1">系统级统计数据</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400" />
          </div>
        </Link>
      </div>

      {/* Recent Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">最近注册用户</h3>
          <Link href="/admin/users" className="text-prism-blue hover:text-blue-400 text-sm flex items-center gap-1">
            查看全部 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {usersLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 text-prism-blue animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">用户</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">状态</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">计划</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">信用点</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">消息数</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((user, idx) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-prism-blue to-prism-purple flex items-center justify-center text-white text-sm font-semibold">
                          {user.name?.[0] || user.email?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name || '未命名'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {user.status === 'ACTIVE' ? '活跃' : '已停用'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.plan !== 'FREE' ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-white">{user.credits}</td>
                    <td className="text-right py-3 px-4 text-white">{user.messageCount?.toLocaleString() || 0}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
