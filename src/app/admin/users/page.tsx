'use client';

/**
 * Prismatic — Admin User Management Page
 * Enhanced with: gender, province, email verification, inline editing
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Users, Crown, Shield, Search,
  ChevronDown, Check, X, RefreshCw,
  Trash2, Edit3, ShieldCheck,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Save
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

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

interface Stats {
  total: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
  verified: number;
}

interface EditState {
  name: string;
  gender: string;
  province: string;
  email: string;
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', gender: '', province: '', email: '' });
  const [filter, setFilter] = useState<'all' | 'FREE' | 'PRO' | 'ADMIN'>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/stats', { credentials: 'include' }),
      ]);
      if (usersRes.status === 403 || statsRes.status === 403) {
        setError('需要管理员权限');
        return;
      }
      if (!usersRes.ok) throw new Error('Failed');
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      setUsers(usersData.users || []);
      // Stats might not have verified yet, default to 0
      setStats({ ...statsData, verified: usersData.users?.filter((u: User) => u.emailVerified).length ?? 0 });
    } catch {
      setError('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const planOptions: SubscriptionPlan[] = ['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'];
  const roleOptions: UserRole[] = ['FREE', 'PRO', 'ADMIN'];
  const planLabels: Record<SubscriptionPlan, string> = { FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' };
  const roleLabels: Record<UserRole, string> = { FREE: '普通', PRO: '高级', ADMIN: '管理员' };
  const genderLabels = { male: '男', female: '女', null: '未设置' };

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-prism-purple" />
              <span className="font-medium text-text-primary">用户管理</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">管理员面板</span>
            <Link href="/app" className="text-sm text-prism-blue hover:underline">返回应用</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
              <Link href="/auth/signin" className="ml-auto underline">去登录</Link>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
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
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <StatCard icon={Users} label="总用户" value={stats.total} color="blue" />
                <StatCard icon={TrendingUp} label="近30天新增" value={stats.recent} color="green" />
                <StatCard icon={CheckCircle} label="已验证邮箱" value={stats.verified} color="purple" />
                <StatCard icon={Crown} label="付费用户" value={(stats.byPlan.MONTHLY || 0) + (stats.byPlan.YEARLY || 0) + (stats.byPlan.LIFETIME || 0)} color="amber" />
                <StatCard icon={ShieldCheck} label="管理员" value={stats.byRole.ADMIN || 0} color="red" />
              </div>
            )}

            {/* Filters */}
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

            {/* Users Table */}
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-bg-elevated">
                    <tr className="text-left text-xs text-text-muted uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">用户</th>
                      <th className="px-4 py-3 font-medium">性别/省份</th>
                      <th className="px-4 py-3 font-medium">邮箱验证</th>
                      <th className="px-4 py-3 font-medium">角色</th>
                      <th className="px-4 py-3 font-medium">套餐</th>
                      <th className="px-4 py-3 font-medium">注册时间</th>
                      <th className="px-4 py-3 font-medium">最近登录</th>
                      <th className="px-4 py-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-bg-elevated/50 transition-colors">
                        {/* User info */}
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
                          <Dropdown value={user.role} options={roleOptions} labels={roleLabels} onChange={async (r) => {
                            await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: user.id, role: r }) });
                            setUsers(users.map(u => u.id === user.id ? { ...u, role: r as UserRole } : u));
                            showSuccess('角色已更新');
                          }} colorMap={{ FREE: 'gray', PRO: 'amber', ADMIN: 'purple' }} />
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3">
                          <Dropdown value={user.plan} options={planOptions} labels={planLabels} onChange={async (p) => {
                            await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: user.id, plan: p }) });
                            setUsers(users.map(u => u.id === user.id ? { ...u, plan: p as SubscriptionPlan } : u));
                            showSuccess('套餐已更新');
                          }} colorMap={{ FREE: 'gray', MONTHLY: 'blue', YEARLY: 'green', LIFETIME: 'purple' }} />
                        </td>

                        {/* Dates */}
                        <td className="px-4 py-3 text-xs text-text-muted">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
                        <td className="px-4 py-3 text-xs text-text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '从未'}</td>

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
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => startEdit(user)}
                                className="p-1.5 rounded-lg text-text-muted hover:bg-bg-elevated hover:text-prism-blue transition-colors" title="编辑">
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
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-text-muted">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">没有找到用户</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; color: 'blue' | 'green' | 'amber' | 'purple' | 'gray' | 'red';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-prism-blue bg-prism-blue/10',
    green: 'text-green-400 bg-green-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    purple: 'text-prism-purple bg-prism-purple/10',
    gray: 'text-text-muted bg-bg-elevated',
    red: 'text-red-400 bg-red-400/10',
  };
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

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
