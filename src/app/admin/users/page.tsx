'use client';

/**
 * Prismatic — Admin User Management Page
 * Enhanced with per-user message usage tracking.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Users, Crown, Shield, Search,
  ChevronDown, Check, X, RefreshCw,
  Trash2, Edit3, ShieldCheck, Info,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Save,
  BarChart2, Calendar, Clock, MessageSquare,
  ChevronRight, TrendingDown, Activity
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type UserRole = 'FREE' | 'PRO' | 'ADMIN';
type SubscriptionPlan = 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';

interface User {
  id: string;
  email: string;
  name: string | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  emailVerified: boolean;
  role: UserRole;
  plan: SubscriptionPlan;
  avatar: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UsageStats {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  lastActivity: string | null;
}

interface AllUsersUsage {
  [userId: string]: UsageStats;
}

interface DetailUsage {
  today: number;
  week: number;
  total: number;
  history: Array<{ date: string; count: number }>;
  rank?: number;
}

interface EditState {
  name: string;
  gender: string;
  province: string;
  email: string;
}

interface SortConfig {
  key: 'name' | 'email' | 'plan' | 'role' | 'createdAt' | 'todayCount' | 'weekCount' | 'totalCount' | 'lastActivity';
  dir: 'asc' | 'desc';
}

const PROVINCES = [
  '北京', '上海', '天津', '重庆',
  '广东', '江苏', '浙江', '四川', '湖北', '湖南',
  '河北', '河南', '山东', '山西', '安徽', '福建', '江西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏',
  '云南', '贵州', '广西', '海南',
  '内蒙古', '黑龙江', '吉林', '辽宁',
  '港澳台', '海外', '未知'
];

function AdminUsersContent() {
  const searchParams = useSearchParams();
  const initialSort = searchParams.get('sort') === 'messages' ? { key: 'todayCount' as const, dir: 'desc' as const } : { key: 'createdAt' as const, dir: 'desc' as const };

  const [users, setUsers] = useState<User[]>([]);
  const [usage, setUsage] = useState<AllUsersUsage>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', gender: '', province: '', email: '' });
  const [filter, setFilter] = useState<'all' | 'FREE' | 'PRO' | 'ADMIN'>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sort, setSort] = useState<SortConfig>(initialSort);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [detailUsage, setDetailUsage] = useState<DetailUsage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, usageRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/usage?days=30', { credentials: 'include' }),
      ]);
      if (usersRes.status === 403 || usageRes.status === 403) {
        setError('需要管理员权限');
        return;
      }
      if (!usersRes.ok) throw new Error('Failed');
      const usersData = await usersRes.json();
      const usageData = await usageRes.json();
      setUsers(usersData.users || []);
      setUsage(usageData.allUsersUsage || {});
    } catch {
      setError('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailUsage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/usage?days=7`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDetailUsage(data);
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (user: User) => {
    setDetailUser(user);
    fetchUserDetail(user.id);
  };

  const closeDetail = () => {
    setDetailUser(null);
    setDetailUsage(null);
  };

  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditState({
      name: user.name || '',
      gender: user.gender || '',
      province: user.province || '',
      email: user.email,
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditState({ name: '', gender: '', province: '', email: '' });
  };

  const saveEdit = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          name: editState.name || null,
          gender: editState.gender || null,
          province: editState.province || null,
          email: editState.email || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, ...data.user } : u));
        setEditingUserId(null);
        showSuccess('用户信息已更新');
      } else {
        showError(data.error || '更新失败');
      }
    } catch {
      showError('更新失败');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('确定要禁用此用户吗？')) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        showSuccess('用户已禁用');
      } else {
        const data = await res.json();
        showError(data.error || '操作失败');
      }
    } catch {
      showError('操作失败');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
      (u.province && u.province.includes(search));
    const matchesFilter = filter === 'all' || u.role === filter || u.plan === filter;
    return matchesSearch && matchesFilter;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const ua = usage[a.id];
    const ub = usage[b.id];
    let av: any, bv: any;
    switch (sort.key) {
      case 'todayCount': av = ua?.todayCount ?? 0; bv = ub?.todayCount ?? 0; break;
      case 'weekCount': av = ua?.weekCount ?? 0; bv = ub?.weekCount ?? 0; break;
      case 'totalCount': av = ua?.totalCount ?? 0; bv = ub?.totalCount ?? 0; break;
      case 'lastActivity': av = ua?.lastActivity ?? ''; bv = ub?.lastActivity ?? ''; break;
      case 'name': av = a.name ?? ''; bv = b.name ?? ''; break;
      case 'email': av = a.email; bv = b.email; break;
      case 'plan': av = a.plan; bv = b.plan; break;
      case 'role': av = a.role; bv = b.role; break;
      case 'createdAt': av = a.createdAt; bv = b.createdAt; break;
      default: av = 0; bv = 0;
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: SortConfig['key']) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' }
    );
  };

  const SortIcon = ({ k }: { k: SortConfig['key'] }) => (
    <span className={`ml-1 ${sort.key === k ? 'text-prism-blue' : 'text-text-muted'}`}>
      {sort.key === k ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  const planOptions: SubscriptionPlan[] = ['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'];
  const roleOptions: UserRole[] = ['FREE', 'PRO', 'ADMIN'];
  const planLabels: Record<SubscriptionPlan, string> = { FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' };
  const roleLabels: Record<UserRole, string> = { FREE: '普通', PRO: '高级', ADMIN: '管理员' };
  const genderLabels = { male: '男', female: '女', null: '未设置' };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-prism-purple" />
              <span className="font-medium text-text-primary">用户管理</span>
              <span className="text-xs text-text-muted bg-bg-surface px-2 py-0.5 rounded-full">{users.length} 人</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/app" className="text-sm text-text-secondary hover:text-text-primary">返回应用</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Alerts ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{success}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />{error}
              {!users.length && <Link href="/auth/signin" className="ml-auto underline">去登录</Link>}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && !users.length ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-prism-blue animate-spin" />
          </div>
        ) : error && !users.length ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-4">{error}</p>
          </div>
        ) : (
          <>
            {/* ── Stats Bar ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: '总用户', value: users.length, color: 'blue' },
                { label: '今日活跃', value: Object.values(usage).filter(u => u.todayCount > 0).length, color: 'green' },
                { label: '本周消息', value: Object.values(usage).reduce((s, u) => s + u.weekCount, 0), color: 'cyan' },
                { label: '总消息', value: Object.values(usage).reduce((s, u) => s + u.totalCount, 0), color: 'purple' },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-border-subtle bg-bg-elevated p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    stat.color === 'blue' ? 'bg-prism-blue/10 text-prism-blue' :
                    stat.color === 'green' ? 'bg-green-400/10 text-green-400' :
                    stat.color === 'cyan' ? 'bg-prism-cyan/10 text-prism-cyan' :
                    'bg-prism-purple/10 text-prism-purple'
                  }`}>
                    {stat.label.includes('消息') ? <MessageSquare className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-text-primary">{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Filters + Search ──────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="text" placeholder="搜索邮箱、昵称、省份..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue text-sm" />
              </div>
              <div className="flex gap-2">
                {(['all', 'FREE', 'PRO', 'ADMIN'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filter === f ? 'bg-prism-blue text-white' : 'bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}>
                    {f === 'all' ? '全部' : f === 'FREE' ? '免费' : f === 'PRO' ? '高级' : '管理员'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead className="bg-bg-elevated">
                    <tr className="text-left text-xs text-text-muted uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('email')}>
                        用户 <SortIcon k="email" />
                      </th>
                      <th className="px-4 py-3 font-medium">性别/省份</th>
                      <th className="px-4 py-3 font-medium">邮箱验证</th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('role')}>
                        角色 <SortIcon k="role" />
                      </th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('plan')}>
                        套餐 <SortIcon k="plan" />
                      </th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('todayCount')}>
                        <div className="flex items-center gap-1">
                          今日消息 <SortIcon k="todayCount" />
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('weekCount')}>
                        <div className="flex items-center gap-1">
                          近7天 <SortIcon k="weekCount" />
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('lastActivity')}>
                        <div className="flex items-center gap-1">
                          最近活跃 <SortIcon k="lastActivity" />
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium cursor-pointer hover:text-text-primary select-none" onClick={() => handleSort('createdAt')}>
                        注册时间 <SortIcon k="createdAt" />
                      </th>
                      <th className="px-4 py-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {sortedUsers.map(user => {
                      const u = usage[user.id];
                      const hasUsage = u && (u.todayCount > 0 || u.weekCount > 0 || u.totalCount > 0);
                      return (
                        <tr key={user.id} className="hover:bg-bg-elevated/50 transition-colors group">
                          {/* User */}
                          <td className="px-4 py-3">
                            {editingUserId === user.id ? (
                              <div className="space-y-2">
                                <input value={editState.name} onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                                  placeholder="昵称" className="w-full px-2 py-1 rounded text-sm bg-bg-base border border-border-subtle text-text-primary" />
                                <input value={editState.email} onChange={e => setEditState(s => ({ ...s, email: e.target.value }))}
                                  placeholder="邮箱" className="w-full px-2 py-1 rounded text-sm bg-bg-base border border-border-subtle text-text-primary" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-prism-gradient flex items-center justify-center text-white text-xs font-medium">
                                  {user.name?.[0] || user.email[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-text-primary">{user.name || '未命名'}</p>
                                  <p className="text-xs text-text-muted">{user.email}</p>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Gender / Province */}
                          <td className="px-4 py-3">
                            {editingUserId === user.id ? (
                              <div className="space-y-2">
                                <select value={editState.gender} onChange={e => setEditState(s => ({ ...s, gender: e.target.value }))}
                                  className="w-full px-2 py-1 rounded text-sm bg-bg-base border border-border-subtle text-text-primary">
                                  <option value="">未设置</option>
                                  <option value="male">男</option>
                                  <option value="female">女</option>
                                </select>
                                <select value={editState.province} onChange={e => setEditState(s => ({ ...s, province: e.target.value }))}
                                  className="w-full px-2 py-1 rounded text-sm bg-bg-base border border-border-subtle text-text-primary">
                                  <option value="">未设置</option>
                                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <p className="text-text-primary">{genderLabels[user.gender as keyof typeof genderLabels] ?? '未设置'}</p>
                                <p className="text-xs text-text-muted">{user.province || '未知'}</p>
                              </div>
                            )}
                          </td>

                          {/* Email verified */}
                          <td className="px-4 py-3">
                            {user.emailVerified ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                                <CheckCircle className="w-3 h-3" />已验证
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                                <XCircle className="w-3 h-3" />未验证
                              </span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3">
                            <div className="group/role relative">
                              <Dropdown value={user.role} options={roleOptions} labels={roleLabels} onChange={async (r) => {
                                await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: user.id, role: r }) });
                                setUsers(users.map(u => u.id === user.id ? { ...u, role: r as UserRole } : u));
                                showSuccess('角色已更新');
                              }} colorMap={{ FREE: 'gray', PRO: 'amber', ADMIN: 'purple' }} />
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-3">
                            <Dropdown value={user.plan} options={planOptions} labels={planLabels} onChange={async (p) => {
                              await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: user.id, plan: p }) });
                              setUsers(users.map(u => u.id === user.id ? { ...u, plan: p as SubscriptionPlan } : u));
                              showSuccess('套餐已更新');
                            }} colorMap={{ FREE: 'gray', MONTHLY: 'blue', YEARLY: 'green', LIFETIME: 'purple' }} />
                          </td>

                          {/* Usage — Today */}
                          <td className="px-4 py-3">
                            {hasUsage ? (
                              <button
                                onClick={() => openDetail(user)}
                                className={`text-sm font-medium px-2 py-0.5 rounded transition-colors ${
                                  u!.todayCount >= 50 ? 'text-orange-400 bg-orange-400/10 hover:bg-orange-400/20' :
                                  u!.todayCount >= 30 ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' :
                                  u!.todayCount > 0 ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20' :
                                  'text-text-muted bg-bg-surface'
                                }`}
                                title="点击查看详情"
                              >
                                {u!.todayCount > 0 ? `${u!.todayCount} 条` : '-'}
                              </button>
                            ) : (
                              <span className="text-text-muted text-sm">-</span>
                            )}
                          </td>

                          {/* Usage — Week */}
                          <td className="px-4 py-3">
                            {hasUsage ? (
                              <span className={`text-sm font-medium ${
                                u!.weekCount > 200 ? 'text-amber-400' :
                                u!.weekCount > 0 ? 'text-text-primary' :
                                'text-text-muted'
                              }`}>
                                {u!.weekCount > 0 ? `${u!.weekCount} 条` : '-'}
                              </span>
                            ) : (
                              <span className="text-text-muted text-sm">-</span>
                            )}
                          </td>

                          {/* Last activity */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-text-muted">
                              {u?.lastActivity
                                ? new Date(u.lastActivity).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                                : '从未'}
                            </span>
                          </td>

                          {/* Created */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-text-muted">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            {editingUserId === user.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => saveEdit(user.id)}
                                  className="p-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEdit}
                                  className="p-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {hasUsage && (
                                  <button onClick={() => openDetail(user)}
                                    className="p-1.5 rounded-lg text-text-muted hover:bg-bg-surface hover:text-prism-blue transition-colors" title="用量详情">
                                    <BarChart2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => startEdit(user)}
                                  className="p-1.5 rounded-lg text-text-muted hover:bg-bg-surface hover:text-prism-blue transition-colors" title="编辑">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(user.id)}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10" title="禁用用户">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {sortedUsers.length === 0 && (
                <div className="text-center py-12 text-text-muted">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">没有找到用户</p>
                </div>
              )}
            </div>

            <p className="text-xs text-text-muted mt-3 text-right">
              共 {filteredUsers.length} 位用户 · 点击消息数查看详细用量
            </p>
          </>
        )}
      </main>

      {/* ── User Usage Detail Modal ─────────────────────────────── */}
      <UserUsageModal
        user={detailUser}
        usage={detailUsage}
        loading={detailLoading}
        onClose={closeDetail}
      />
    </div>
  );
}

/* ─── Dropdown ─────────────────────────────────────────────────── */
function Dropdown<T extends string>({ value, options, labels, onChange, colorMap }: {
  value: string; options: readonly T[]; labels: Record<string, string>;
  onChange: (v: string) => void; colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const colorClass = colorMap[value] || 'gray';
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity ${
          colorClass === 'gray' ? 'bg-gray-500/10 text-text-muted' :
          colorClass === 'amber' ? 'bg-amber-400/10 text-amber-400' :
          colorClass === 'purple' ? 'bg-prism-purple/10 text-prism-purple' :
          colorClass === 'blue' ? 'bg-prism-blue/10 text-prism-blue' :
          colorClass === 'green' ? 'bg-green-400/10 text-green-400' :
          'bg-gray-500/10 text-text-muted'
        } hover:opacity-80`}>
        {labels[value]}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-border-subtle bg-bg-elevated shadow-lg overflow-hidden">
          {options.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:bg-bg-surface hover:text-text-primary">
              {labels[opt]}
              {opt === value && <Check className="w-3 h-3 text-prism-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── User Usage Modal ──────────────────────────────────────────── */
function UserUsageModal({ user, usage, loading, onClose }: {
  user: User | null;
  usage: DetailUsage | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!user) return null;

  const maxCount = usage?.history?.reduce((m, h) => Math.max(m, h.count), 0) || 1;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl bg-bg-elevated border border-border-subtle shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-prism-gradient flex items-center justify-center text-white text-sm font-medium">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{user.name || '未命名'}</p>
                <p className="text-xs text-text-muted">{user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
            {[
              { label: '今日消息', value: usage?.today ?? 0, color: 'text-prism-blue' },
              { label: '近7天', value: usage?.week ?? 0, color: 'text-prism-purple' },
              { label: '总消息', value: usage?.total ?? 0, color: 'text-prism-cyan' },
            ].map(stat => (
              <div key={stat.label} className="px-4 py-4 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{loading ? '-' : stat.value}</p>
                <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
                {usage?.rank && stat.label === '今日消息' && (
                  <p className="text-[10px] text-text-muted">排名第 {usage.rank}</p>
                )}
              </div>
            ))}
          </div>

          {/* History chart */}
          <div className="px-6 py-5">
            <p className="text-xs text-text-muted mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> 近7天用量趋势
            </p>

            {loading ? (
              <div className="h-24 flex items-end gap-2 justify-center">
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="flex-1 bg-bg-surface rounded-t animate-pulse" style={{ height: `${20 + i * 10}%` }} />
                ))}
              </div>
            ) : usage?.history?.length === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center text-text-muted">
                <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">暂无使用记录</p>
              </div>
            ) : (
              <div className="h-24 flex items-end gap-2">
                {(usage?.history ?? []).map((h, i) => {
                  const heightPct = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
                  const isToday = h.date === today;
                  return (
                    <div key={h.date} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full h-20 flex items-end justify-center">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPct, 3)}%` }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className={`w-full rounded-t transition-colors ${
                            isToday ? 'bg-prism-blue' : 'bg-prism-purple/60'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted">
                        {h.date.slice(5)}
                      </span>
                      {/* Hover tooltip */}
                      <div className="absolute hidden group-hover:block bg-bg-overlay border border-border-subtle rounded px-2 py-1 text-xs whitespace-nowrap z-10 shadow-xl">
                        <p className="text-text-primary">{h.date}</p>
                        <p className="text-prism-blue">{h.count} 条</p>
                      </div>
                    </div>
                  );
                })}
                {/* Padding for alignment */}
                {usage?.history?.length ? (
                  <div className="flex-1" />
                ) : null}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex justify-end">
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors">
              关闭
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-text-muted">加载中...</div>
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
