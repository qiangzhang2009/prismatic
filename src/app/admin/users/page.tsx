'use client';

import { Suspense, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Edit3, Trash2, Crown,
  UserCheck, UserX, Filter, RefreshCw, Ban,
  ChevronRight, ChevronLeft, Plus, X, Eye,
  Check, AlertCircle, Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useUsers, useUpdateUser, useDeleteUser, useAddCredits } from '@/lib/use-admin-data';
import type { User, UserFilter } from '@/lib/use-admin-data';

function AdminUsersPage() {
  const router = useRouter();

  const [filters, setFilters] = useState<UserFilter>({
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (selectedStatus && user.status !== selectedStatus) return false;
      if (selectedPlan && user.plan !== selectedPlan) return false;
      return true;
    });
  }, [users, selectedStatus, selectedPlan]);

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

  const handlePage = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
    setExpandedId(null);
  };

  const handleStatusChange = async (id: string, status: User['status']) => {
    await updateUser.mutateAsync({ id, data: { status } });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) return;
    await deleteUser.mutateAsync(id);
  };

  const handleAddCredits = async (id: string) => {
    const amount = prompt('输入要添加的信用点数:');
    if (amount && !isNaN(Number(amount))) {
      await addCredits.mutateAsync({ id, amount: Number(amount) });
    }
  };

  const totalActive = filteredUsers.filter(u => u.status === 'ACTIVE').length;
  const totalPaid = filteredUsers.filter(u => u.plan !== 'FREE').length;
  const totalMessages = filteredUsers.reduce((sum, u) => sum + (u.messageCount || 0), 0);

  const SortIcon = ({ col }: { col: string }) => {
    if (filters.sortBy !== col) return <span className="opacity-30 ml-1">↕</span>;
    return filters.sortOrder === 'asc'
      ? <span className="text-prism-blue ml-1">↑</span>
      : <span className="text-prism-blue ml-1">↓</span>;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-2xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">用户管理</h1>
            <p className="text-gray-400 text-sm mt-1">
              共 {data?.total || 0} 位用户，其中 {totalActive} 位活跃，{totalPaid} 位付费
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索姓名、邮箱..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-prism-blue text-sm"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as User['status'] | '')}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-prism-blue"
            >
              <option value="">全部状态</option>
              <option value="ACTIVE">活跃</option>
              <option value="SUSPENDED">暂停</option>
              <option value="BANNED">封禁</option>
            </select>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as User['plan'] | '')}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-prism-blue"
            >
              <option value="">全部计划</option>
              <option value="FREE">Free</option>
              <option value="PRO">Pro</option>
              <option value="TEAM">Team</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '总用户', value: data?.total || 0, icon: Users, color: 'text-prism-blue' },
            { label: '活跃用户', value: totalActive, icon: UserCheck, color: 'text-green-400' },
            { label: '付费用户', value: totalPaid, icon: Crown, color: 'text-amber-400' },
            { label: '总消息', value: totalMessages.toLocaleString(), icon: Filter, color: 'text-prism-purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className={`${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Table */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-800/60 border-b border-gray-700 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
              用户 <SortIcon col="name" />
            </div>
            <div className="col-span-2 text-gray-500 cursor-default">
              状态 / 计划
            </div>
            <div className="col-span-2 text-right text-gray-500 cursor-default">
              信用点
            </div>
            <div className="col-span-2 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort('createdAt')}>
              注册时间 <SortIcon col="createdAt" />
            </div>
            <div className="col-span-2 flex items-center cursor-pointer hover:text-white" onClick={() => handleSort('lastActive')}>
              最后活跃 <SortIcon col="lastActive" />
            </div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-prism-blue animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center justify-center py-20 gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-red-400 font-medium">加载失败</p>
                <p className="text-gray-400 text-sm">{error.message}</p>
                <button onClick={() => refetch()} className="mt-2 text-prism-blue hover:underline text-sm">重试</button>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && filteredUsers.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500">暂无用户数据</p>
            </div>
          )}

          {/* Rows */}
          {!isLoading && !error && filteredUsers.length > 0 && (
            <div className="divide-y divide-gray-800/60">
              {filteredUsers.map((user, idx) => (
                <div key={user.id}>
                  {/* Main Row */}
                  <div
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-800/40 cursor-pointer transition-colors ${expandedId === user.id ? 'bg-gray-800/50' : ''}`}
                    onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                  >
                    {/* User */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-prism-blue to-prism-purple flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {user.name?.[0] || user.email?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate text-sm">
                          {user.name || <span className="text-gray-500 italic">未命名</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Status / Plan */}
                    <div className="col-span-2 flex flex-col gap-1 justify-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium w-fit px-2 py-0.5 rounded-full ${
                        user.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400' :
                        user.status === 'BANNED' ? 'bg-red-900/50 text-red-400' :
                        user.status === 'SUSPENDED' ? 'bg-amber-900/50 text-amber-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {user.status === 'ACTIVE' && <UserCheck className="w-3 h-3" />}
                        {user.status === 'BANNED' && <Ban className="w-3 h-3" />}
                        {user.status === 'SUSPENDED' && <UserX className="w-3 h-3" />}
                        {user.status === 'ACTIVE' ? '活跃' : user.status === 'BANNED' ? '封禁' : user.status === 'SUSPENDED' ? '暂停' : '未知'}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full ${
                        user.plan !== 'FREE' ? 'bg-purple-900/50 text-purple-300' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {user.plan !== 'FREE' && <Crown className="w-3 h-3" />}
                        {user.plan}
                      </span>
                    </div>

                    {/* Credits */}
                    <div className="col-span-2 text-right flex items-center justify-end gap-2">
                      <span className="font-semibold text-amber-400 text-sm">{user.credits}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddCredits(user.id); }}
                        className="text-xs text-gray-500 hover:text-prism-blue transition-colors"
                        title="添加信用点"
                      >
                        +充
                      </button>
                    </div>

                    {/* Created At */}
                    <div className="col-span-2 text-sm text-gray-400">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                    </div>

                    {/* Last Active */}
                    <div className="col-span-2 text-sm text-gray-400">
                      {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('zh-CN') : <span className="text-gray-600">从未</span>}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4 text-gray-400 hover:text-prism-blue" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {expandedId === user.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-12 gap-4 px-4 py-4 bg-gray-900/40 border-t border-gray-800/50">
                          <div className="col-span-3">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">账户信息</h4>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">用户ID</span>
                                <span className="text-gray-300 font-mono text-xs">{user.id.slice(0, 16)}...</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">邮箱</span>
                                <span className="text-gray-300">{user.email || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">注册时间</span>
                                <span className="text-gray-300">
                                  {user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-3">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">使用统计</h4>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">对话数</span>
                                <span className="text-gray-300">{user.conversationCount?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">消息数</span>
                                <span className="text-gray-300">{user.messageCount?.toLocaleString() || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">最后活跃</span>
                                <span className="text-gray-300">
                                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('zh-CN') : '从未'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-3">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">快速操作</h4>
                            <div className="flex flex-col gap-1.5">
                              {user.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => handleStatusChange(user.id, 'BANNED')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs transition-colors w-fit"
                                >
                                  <Ban className="w-3 h-3" /> 封禁
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(user.id, 'ACTIVE')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg text-xs transition-colors w-fit"
                                >
                                  <Check className="w-3 h-3" /> 恢复
                                </button>
                              )}
                              <button
                                onClick={() => handleAddCredits(user.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 rounded-lg text-xs transition-colors w-fit"
                              >
                                <Plus className="w-3 h-3" /> 添加信用点
                              </button>
                            </div>
                          </div>
                          <div className="col-span-3 flex items-center justify-end">
                            <button
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-prism-blue/20 hover:bg-prism-blue/30 text-prism-blue rounded-lg text-sm transition-colors"
                            >
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
              <div className="text-sm text-gray-400">
                第 {filters.page} / {totalPages} 页，共 {data?.total || 0} 条
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePage(filters.page! - 1)}
                  disabled={filters.page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> 上一页
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 :
                    filters.page! <= 3 ? i + 1 :
                    filters.page! >= totalPages - 2 ? totalPages - 4 + i :
                    filters.page! - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePage(p)}
                      className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                        filters.page === p
                          ? 'bg-prism-blue text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePage(filters.page! + 1)}
                  disabled={filters.page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  下一页 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 text-prism-blue animate-spin" /></div>}>
      <AdminUsersPage />
    </Suspense>
  );
}
