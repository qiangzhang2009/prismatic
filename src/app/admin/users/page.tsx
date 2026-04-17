'use client';

import { Suspense, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, ChevronDown, ChevronUp, Edit3, Trash2, Crown,
  Shield, Eye, UserCheck, UserX, Filter, RefreshCw, Ban,
  ArrowUpRight, ArrowDownRight, Activity, Clock, MessageSquare
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useUsers, useUpdateUser, useDeleteUser, useAddCredits } from '@/lib/use-admin-data';
import type { User, UserFilter } from '@/lib/use-admin-data';

const PROVINCES = [
  '北京', '上海', '天津', '重庆',
  '广东', '江苏', '浙江', '四川', '湖北', '湖南',
  '河北', '河南', '山东', '山西', '安徽', '福建', '江西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏',
  '云南', '贵州', '广西', '海南',
  '内蒙古', '黑龙江', '吉林', '辽宁',
  '港澳台', '海外', '未知',
];

function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── State ────────────────────────────────────────────────────────────────────

  const [filters, setFilters] = useState<UserFilter>({
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<User['status'] | ''>('');
  const [selectedPlan, setSelectedPlan] = useState<User['plan'] | ''>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ─── API ──────────────────────────────────────────────────────────────────────

  const { data, isLoading, error, refetch } = useUsers(filters);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const addCredits = useAddCredits();

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const users = data?.items || [];
  const totalPages = data?.totalPages || 1;

  // Apply client-side filters (for status and plan, which aren't fully backend-filtered yet)
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (selectedStatus && user.status !== selectedStatus) return false;
      if (selectedPlan && user.plan !== selectedPlan) return false;
      return true;
    });
  }, [users, selectedStatus, selectedPlan]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  const handleSort = (key: UserFilter['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
    setExpandedRow(null);
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    await updateUser.mutateAsync({ id, data });
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) return;
    await deleteUser.mutateAsync(id);
  };

  const handleAddCredits = async (id: string, amount: number) => {
    await addCredits.mutateAsync({ id, amount });
  };

  // ─── Render Helpers ────────────────────────────────────────────────────────────

  const getStatusIcon = (status: User['status']) => {
    switch (status) {
      case 'ACTIVE': return <UserCheck className="w-4 h-4 text-green-400" />;
      case 'SUSPENDED': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'BANNED': return <Ban className="w-4 h-4 text-red-400" />;
      default: return <UserX className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPlanIcon = (plan: User['plan']) => {
    return plan !== 'FREE' ? <Crown className="w-4 h-4 text-amber-400" /> : null;
  };

  const getPlanBadge = (plan: User['plan']) => {
    const styles: Record<string, string> = {
      FREE: 'bg-gray-800 text-gray-300',
      PRO: 'bg-purple-900/30 text-purple-300 border border-purple-700',
      TEAM: 'bg-blue-900/30 text-blue-300 border border-blue-700',
      ENTERPRISE: 'bg-amber-900/30 text-amber-300 border border-amber-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[plan] || styles.FREE}`}>
        {plan}
      </span>
    );
  };

  // ─── Table Columns ─────────────────────────────────────────────────────────────

  const columns = [
    { key: 'name' as const, label: '用户', sortable: true, width: '20%' },
    { key: 'status' as const, label: '状态', sortable: true, width: '10%' },
    { key: 'plan' as const, label: '订阅计划', sortable: true, width: '10%' },
    { key: 'credits' as const, label: '信用点', sortable: true, width: '8%' },
    { key: 'createdAt' as const, label: '注册时间', sortable: true, width: '12%' },
    { key: 'lastActive' as const, label: '最后活跃', sortable: true, width: '12%' },
    { key: 'actions' as const, label: '操作', width: '15%' },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <p className="text-gray-400 text-sm mt-1">管理所有用户账户、订阅和信用额度</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Filter className="w-5 h-5" />
            筛选
          </h3>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索姓名、邮箱..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-prism-blue"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as User['status'] | '')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-prism-blue"
          >
            <option value="">所有状态</option>
            <option value="ACTIVE">活跃</option>
            <option value="SUSPENDED">暂停</option>
            <option value="BANNED">封禁</option>
          </select>

          {/* Plan Filter */}
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value as User['plan'] | '')}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-prism-blue"
          >
            <option value="">所有计划</option>
            <option value="FREE">Free</option>
            <option value="PRO">Pro</option>
            <option value="TEAM">Team</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">总用户</span>
            <Users className="w-5 h-5 text-prism-blue" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{data?.total || 0}</p>
        </div>
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">活跃用户</span>
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {filteredUsers.filter(u => u.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">付费用户</span>
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {filteredUsers.filter(u => u.plan !== 'FREE').length}
          </p>
        </div>
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">总消息数</span>
            <MessageSquare className="w-5 h-5 text-prism-purple" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {data?.items.reduce((sum, u) => sum + (u.messageCount || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-prism-blue animate-spin" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-400">加载失败: {error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-prism-blue hover:bg-blue-600 rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-800/50 border-b border-gray-700 text-sm font-medium text-gray-400">
              {columns.map(col => (
                <div key={col.key} className={`flex items-center gap-1 ${col.width || ''}`}>
                  {col.sortable && (
                    <button
                      onClick={() => handleSort(col.key as UserFilter['sortBy'])}
                      className="hover:text-white transition-colors"
                    >
                      {col.label}
                      {filters.sortBy === col.key && (
                        filters.sortOrder === 'asc'
                          ? <ChevronUp className="w-4 h-4 inline" />
                          : <ChevronDown className="w-4 h-4 inline" />
                      )}
                    </button>
                  )}
                  {!col.sortable && col.label}
                </div>
              ))}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-800">
              {filteredUsers.map((user, idx) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-800/30 transition-colors cursor-pointer ${
                    expandedRow === user.id ? 'bg-gray-800/50' : ''
                  }`}
                  onClick={() => setExpandedRow(expandedRow === user.id ? null : user.id)}
                >
                  {/* User */}
                  <div className="col-span-12 md:col-span-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-prism-blue to-prism-purple flex items-center justify-center text-white font-semibold">
                      {user.name?.[0] || user.email?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{user.name || '未命名'}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-4 md:col-span-1 flex items-center gap-2">
                    {getStatusIcon(user.status)}
                    <span className={`text-sm ${user.status === 'ACTIVE' ? 'text-green-400' : user.status === 'BANNED' ? 'text-red-400' : 'text-amber-400'}`}>
                      {user.status === 'ACTIVE' ? '活跃' : user.status === 'BANNED' ? '封禁' : user.status === 'SUSPENDED' ? '暂停' : '已删除'}
                    </span>
                  </div>

                  {/* Plan */}
                  <div className="col-span-4 md:col-span-1">
                    <div className="flex items-center gap-2">
                      {getPlanIcon(user.plan)}
                      {getPlanBadge(user.plan)}
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="col-span-4 md:col-span-1">
                    <div className="flex items-center gap-1">
                      <span className="text-white font-medium">{user.credits}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const amount = prompt('输入要添加的信用点数:');
                          if (amount && !isNaN(Number(amount))) {
                            handleAddCredits(user.id, Number(amount));
                          }
                        }}
                        className="text-prism-blue hover:text-blue-400 text-xs"
                        title="添加信用点"
                      >
                        + 添加
                      </button>
                    </div>
                  </div>

                  {/* Created At */}
                  <div className="col-span-4 md:col-span-1 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </div>

                  {/* Last Active */}
                  <div className="col-span-4 md:col-span-1 text-sm text-gray-400">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('zh-CN') : '从未'}
                  </div>

                  {/* Actions */}
                  <div className="col-span-12 md:col-span-1 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/users/${user.id}`);
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Open edit modal
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUser(user.id);
                      }}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>

                  {/* Expanded Row */}
                  {expandedRow === user.id && (
                    <div className="col-span-12 py-4 border-t border-gray-800">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-white font-medium mb-2">使用统计</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">消息总数</span>
                              <span className="text-white">{user.messageCount?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">对话数</span>
                              <span className="text-white">{user.conversationCount || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-white font-medium mb-2">账户信息</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">用户ID</span>
                              <span className="text-white font-mono text-xs">{user.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">注册时间</span>
                              <span className="text-white">{new Date(user.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-white font-medium mb-2">快速操作</h4>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className="px-3 py-1.5 bg-prism-blue/20 hover:bg-prism-blue/30 text-prism-blue rounded-lg text-sm transition-colors"
                            >
                              查看详情
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('请输入封禁原因:');
                                if (reason) {
                                  handleUpdateUser(user.id, { status: 'BANNED' });
                                }
                              }}
                              className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg text-sm transition-colors"
                            >
                              封禁用户
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                共 {data?.total || 0} 条记录，第 {filters.page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(filters.page! - 1)}
                  disabled={filters.page === 1}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  上一页
                </button>
                <button
                  onClick={() => handlePageChange(filters.page! + 1)}
                  disabled={filters.page === totalPages}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function AdminUsersPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">加载中...</div>}>
      <AdminUsersPage />
    </Suspense>
  );
}
