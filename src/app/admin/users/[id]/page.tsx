'use client';

/**
 * Prismatic — User Detail Page
 * 用户详情页，包含行为历史分析
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Mail, Phone, Shield, Crown,
  Calendar, Clock, MessageSquare, Activity,
  TrendingUp, Eye, Edit3, Trash2, Ban, UserCheck,
  BarChart2, PieChart, LineChart, RefreshCw
} from 'lucide-react';
import {
  LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useUser, useUserActivity, useUpdateUser, useDeleteUser, useAddCredits } from '@/lib/use-admin-data';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const { data: user, isLoading, error, refetch } = useUser(userId);
  const { data: activity, isLoading: activityLoading } = useUserActivity(userId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const addCredits = useAddCredits();

  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'conversations'>('overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 text-prism-blue animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">加载失败: {error?.message || '用户不存在'}</p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          返回管理后台
        </button>
      </div>
    );
  }

  const handleUpdateStatus = async (status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    await updateUser.mutateAsync({ id: userId, data: { status } });
  };

  const handleAddCredits = async () => {
    const amount = prompt('输入要添加的信用点数:');
    if (amount && !isNaN(Number(amount))) {
      await addCredits.mutateAsync({ id: userId, amount: Number(amount) });
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) return;
    await deleteUser.mutateAsync(userId);
    router.push('/admin');
  };

  // Prepare activity chart data
  const activityData = activity?.metrics?.slice(0, 30).reverse().map(m => ({
    date: new Date(m.statDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    messages: m.messagesSent,
    personas: m.personasUsedCount,
    timeSpent: Math.round(m.timeSpentSeconds / 60),
  })) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{user.name || '未命名用户'}</h1>
            <p className="text-gray-400 text-sm mt-1">用户ID: {userId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddCredits}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 rounded-lg transition-colors"
          >
            <Crown className="w-4 h-4" />
            添加信用点
          </button>
          <button
            onClick={() => router.push(`/admin/users/${userId}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            编辑
          </button>
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-prism-blue to-prism-purple flex items-center justify-center text-white text-2xl font-bold">
              {user.name?.[0] || user.email?.[0] || '?'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name || '未命名'}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {user.email || '无邮箱'}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {user.phone}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' :
                  user.status === 'BANNED' ? 'bg-red-900/30 text-red-400' :
                  'bg-amber-900/30 text-amber-400'
                }`}>
                  {user.status === 'ACTIVE' ? '活跃' : user.status === 'BANNED' ? '封禁' : '暂停'}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.plan !== 'FREE' ? 'bg-purple-900/30 text-purple-400' : 'bg-gray-800 text-gray-400'
                }`}>
                  {user.plan}
                </span>
                {user.role === 'ADMIN' && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-prism-purple/30 text-prism-purple">
                    管理员
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-400">{user.credits}</div>
            <div className="text-sm text-gray-400">信用点</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{user.conversationCount || 0}</div>
            <div className="text-sm text-gray-400">对话数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{user.messageCount || 0}</div>
            <div className="text-sm text-gray-400">消息数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : 'N/A'}
            </div>
            <div className="text-sm text-gray-400">注册时间</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('zh-CN') : '从未'}
            </div>
            <div className="text-sm text-gray-400">最后活跃</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-800">
          {user.status === 'ACTIVE' ? (
            <>
              <button
                onClick={() => handleUpdateStatus('SUSPENDED')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 rounded-lg transition-colors"
              >
                <Ban className="w-4 h-4" />
                暂停账户
              </button>
              <button
                onClick={() => handleUpdateStatus('BANNED')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg transition-colors"
              >
                <Ban className="w-4 h-4" />
                封禁账户
              </button>
            </>
          ) : (
            <button
              onClick={() => handleUpdateStatus('ACTIVE')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              恢复账户
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            删除账户
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-800">
        {[
          { id: 'overview', label: '行为概览', icon: BarChart2 },
          { id: 'activity', label: '活动历史', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-prism-blue text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">30天活动趋势</h3>
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="messages" stroke="#8b5cf6" name="消息数" />
                  <Line type="monotone" dataKey="personas" stroke="#06b6d4" name="使用人物数" />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">暂无活动数据</div>
            )}
          </motion.div>

          {/* Session Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activity?.sessions?.slice(0, 3).map(session => (
              <motion.div
                key={session.sessionId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">会话</span>
                  <span className="text-xs text-gray-500">{session.deviceType || '未知设备'}</span>
                </div>
                <div className="text-white font-medium">
                  {session.pageViews} 次浏览
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {session.messagesSent} 条消息
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(session.startedAt).toLocaleString('zh-CN')}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">最近活动</h3>
          {activity?.events && activity.events.length > 0 ? (
            <div className="space-y-3">
              {activity.events.slice(0, 20).map(event => (
                <div key={event.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.eventType === 'chat_start' ? 'bg-green-400' :
                      event.eventType === 'page_view' ? 'bg-blue-400' :
                      event.eventType === 'feature_used' ? 'bg-purple-400' :
                      'bg-gray-400'
                    }`} />
                    <div>
                      <p className="text-white">{event.eventName}</p>
                      <p className="text-xs text-gray-500">{event.personaName || event.eventType}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(event.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">暂无活动记录</div>
          )}
        </motion.div>
      )}
    </div>
  );
}
