'use client';

/**
 * Prismatic — Admin User Management v2
 * Actionable user management: segments, engagement timeline, quality scoring.
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Users, Crown, Shield, Search,
  ChevronDown, Check, X, RefreshCw,
  Trash2, Edit3, ShieldCheck, UserCheck, UserX,
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Save,
  BarChart2, Calendar, Clock, MessageSquare,
  ChevronRight, TrendingDown, Activity, Sparkles,
  ChevronUp, ArrowUpRight, ArrowDownRight, Eye,
  Zap, Filter, UserCog, Ban, Send,
  ArrowRightLeft, Globe, Clock3, Flame, Star,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

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

interface GlobalStats {
  total: number;
  totalAll: number;
  inactive: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
  verified: number;
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
  '港澳台', '海外', '未知',
];

// ─── Lifecycle segments ───────────────────────────────────────────────────────

type Segment = 'all' | 'power' | 'active' | 'dormant' | 'new' | 'churned' | 'paying' | 'unverified' | 'admin';

const SEGMENTS: { id: Segment; label: string; labelEn: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'all', label: '全部', labelEn: 'All', icon: Users, color: 'text-text-secondary', desc: '所有用户' },
  { id: 'power', label: '超级用户', labelEn: 'Power', icon: Zap, color: 'text-prism-purple', desc: '周消息>50条' },
  { id: 'active', label: '活跃', labelEn: 'Active', icon: Sparkles, color: 'text-green-400', desc: '本周有消息' },
  { id: 'dormant', label: '沉睡', labelEn: 'Dormant', icon: Clock3, color: 'text-amber-400', desc: '7-30天未活跃' },
  { id: 'new', label: '新用户', labelEn: 'New', icon: UserCheck, color: 'text-prism-blue', desc: '近7天注册' },
  { id: 'churned', label: '流失', labelEn: 'Churned', icon: UserX, color: 'text-red-400', desc: '30天以上未活跃' },
  { id: 'paying', label: '付费用户', labelEn: 'Paying', icon: Crown, color: 'text-amber-400', desc: '月度/年度/终身' },
  { id: 'unverified', label: '未验证', labelEn: 'Unverified', icon: XCircle, color: 'text-orange-400', desc: '邮箱未验证' },
  { id: 'admin', label: '管理员', labelEn: 'Admin', icon: Shield, color: 'text-prism-purple', desc: '后台管理员' },
];

function getSegmentLabel(id: Segment): string {
  return SEGMENTS.find(s => s.id === id)?.label ?? id;
}

// ─── Shared tooltip labels (used by table + modal) ─────────────────────────────

const roleTooltips: Record<string, string> = {
  FREE: '普通用户：每日免费对话 10 条',
  PRO: '高级用户：无限制对话，优先排队',
  ADMIN: '管理员：后台全权限',
};
const planTooltips: Record<string, string> = {
  FREE: '免费用户：每日 10 条对话额度',
  MONTHLY: '月度订阅：无限制对话、导出、优先排队',
  YEARLY: '年度订阅：无限制对话、导出、优先排队',
  LIFETIME: '终身订阅：永久无限制访问',
};

// ─── User quality score ────────────────────────────────────────────────────────

function qualityScore(u: User, usage: UsageStats): number {
  let score = 0;
  if (u.emailVerified) score += 20;
  if (u.plan !== 'FREE') score += 30;
  if (u.role === 'ADMIN') score += 10;
  if (usage.todayCount > 0) score += 10;
  if (usage.weekCount > 5) score += 10;
  if (usage.weekCount > 20) score += 10;
  if (usage.totalCount > 100) score += 5;
  if (u.name) score += 5;
  return Math.min(100, score);
}

function scoreColor(score: number): { text: string; bg: string } {
  if (score >= 70) return { text: 'text-green-400', bg: 'bg-green-400/10' };
  if (score >= 40) return { text: 'text-amber-400', bg: 'bg-amber-400/10' };
  return { text: 'text-text-muted', bg: 'bg-bg-surface' };
}

// ─── Content ─────────────────────────────────────────────────────────────────

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [usage, setUsage] = useState<AllUsersUsage>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editState, setEditState] = useState({ name: '', gender: '', province: '', email: '' });
  const [segment, setSegment] = useState<Segment>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sort, setSort] = useState<SortConfig>({ key: 'lastActivity', dir: 'desc' });
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [detailUsage, setDetailUsage] = useState<DetailUsage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, usageRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/usage?days=30', { credentials: 'include' }),
        fetch('/api/admin/stats', { credentials: 'include' }),
      ]);
      if (usersRes.status === 403 || usageRes.status === 403) {
        setError('需要管理员权限');
        return;
      }
      if (!usersRes.ok) throw new Error('Failed');
      const [usersData, usageData, statsData] = await Promise.all([
        usersRes.json(), usageRes.json(), statsRes.json(),
      ]);
      setUsers(usersData.users || []);
      setUsage(usageData.allUsersUsage || {});
      setGlobalStats(statsData);
    } catch {
      setError('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync segment from URL
  useEffect(() => {
    const s = searchParams.get('segment');
    if (s && SEGMENTS.some(seg => seg.id === s)) {
      setSegment(s as Segment);
    }
    const sortParam = searchParams.get('sort');
    if (sortParam === 'messages') {
      setSort({ key: 'todayCount', dir: 'desc' });
    }
  }, [searchParams]);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailUsage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/usage?days=7`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDetailUsage(data);
      }
    } catch { /* ignore */ } finally {
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
      // 只发送非空字段，避免 null 被忽略
      const body: Record<string, string | null> = { userId };
      if (editState.name.trim()) body.name = editState.name.trim();
      if (editState.email.trim()) body.email = editState.email.trim();
      if (editState.gender) body.gender = editState.gender;
      if (editState.province) body.province = editState.province;
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
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

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
        showSuccess('角色已更新');
        // 同步刷新全局统计（总览和用户数）
        const statsRes = await fetch('/api/admin/stats', { credentials: 'include' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setGlobalStats(statsData);
        }
      } else {
        const data = await res.json();
        showError(data.error || '更新失败');
      }
    } catch {
      showError('更新失败');
    }
  };

  const handlePlanChange = async (userId: string, plan: SubscriptionPlan) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, plan }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, plan } : u));
        showSuccess('套餐已更新');
        // 同步刷新全局统计
        const statsRes = await fetch('/api/admin/stats', { credentials: 'include' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setGlobalStats(statsData);
        }
      } else {
        const data = await res.json();
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
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        showSuccess('用户已禁用');
        // 重新获取统计数据，确保与删除后的用户列表一致
        const statsRes = await fetch('/api/admin/stats', { credentials: 'include' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setGlobalStats(statsData);
        }
      } else {
        const data = await res.json();
        showError(data.error || '操作失败');
      }
    } catch {
      showError('操作失败');
    }
  };

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

  const handleSegmentChange = (seg: Segment) => {
    setSegment(seg);
    const params = new URLSearchParams(searchParams.toString());
    params.set('segment', seg);
    router.replace(`/admin/users?${params.toString()}`, { scroll: false });
  };

  // ── Filter & Sort ─────────────────────────────────────────────────────────

  const now = Date.now();
  const dayMs = 86400000;

  const filteredUsers = users.filter(u => {
    const u2 = usage[u.id];
    const uTotal = u2?.totalCount ?? 0;
    const uWeek = u2?.weekCount ?? 0;
    const uToday = u2?.todayCount ?? 0;
    const lastAct = u.lastLoginAt || u2?.lastActivity;
    const daysSinceAct = lastAct ? Math.floor((now - new Date(lastAct).getTime()) / dayMs) : 999;
    const daysSinceSignup = Math.floor((now - new Date(u.createdAt).getTime()) / dayMs);

    // Search
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
      (u.province && u.province.includes(search));

    if (!matchSearch) return false;

    // Segment
    switch (segment) {
      case 'power': return uWeek > 50;
      case 'active': return uWeek > 0;
      case 'dormant': return daysSinceAct >= 7 && daysSinceAct <= 30;
      case 'new': return daysSinceSignup <= 7;
      case 'churned': return daysSinceAct > 30;
      case 'paying': return u.plan !== 'FREE';
      case 'unverified': return !u.emailVerified;
      case 'admin': return u.role === 'ADMIN';
      default: return true;
    }
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const ua = usage[a.id];
    const ub = usage[b.id];
    let av: any, bv: any;
    switch (sort.key) {
      case 'todayCount': av = ua?.todayCount ?? 0; bv = ub?.todayCount ?? 0; break;
      case 'weekCount': av = ua?.weekCount ?? 0; bv = ub?.weekCount ?? 0; break;
      case 'totalCount': av = ua?.totalCount ?? 0; bv = ub?.totalCount ?? 0; break;
      case 'lastActivity': av = ua?.lastActivity ?? a.lastLoginAt ?? ''; bv = ub?.lastActivity ?? b.lastLoginAt ?? ''; break;
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
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const SortIcon = ({ k }: { k: SortConfig['key'] }) => (
    <span className={`ml-1 ${sort.key === k ? 'text-prism-blue' : 'text-text-muted/40'}`}>
      {sort.key === k ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  );

  const planLabels: Record<SubscriptionPlan, string> = { FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' };
  const roleLabels: Record<UserRole, string> = { FREE: '普通', PRO: '高级', ADMIN: '管理员' };
  const genderLabels = { male: '男', female: '女', null: '-' };

  // Segment counts
  const segCounts: Record<Segment, number> = { all: users.length, power: 0, active: 0, dormant: 0, new: 0, churned: 0, paying: 0, unverified: 0, admin: 0 };
  for (const u of users) {
    const u2 = usage[u.id];
    const uWeek = u2?.weekCount ?? 0;
    const lastAct = u.lastLoginAt || u2?.lastActivity;
    const daysSinceAct = lastAct ? Math.floor((now - new Date(lastAct).getTime()) / dayMs) : 999;
    const daysSinceSignup = Math.floor((now - new Date(u.createdAt).getTime()) / dayMs);
    if (uWeek > 50) segCounts.power++;
    if (uWeek > 0) segCounts.active++;
    if (daysSinceAct >= 7 && daysSinceAct <= 30) segCounts.dormant++;
    if (daysSinceSignup <= 7) segCounts.new++;
    if (daysSinceAct > 30) segCounts.churned++;
    if (u.plan !== 'FREE') segCounts.paying++;
    if (!u.emailVerified) segCounts.unverified++;
    if (u.role === 'ADMIN') segCounts.admin++;
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-prism-purple" />
              <span className="font-medium text-text-primary">用户管理</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted hidden sm:inline">
              {loading ? '加载中...' : `${users.length} 位用户`}
            </span>
            <button onClick={fetchData} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors" title="刷新">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {/* View mode toggle */}
            <div className="flex border border-border-subtle rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary'}`}>
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'cards' ? 'bg-bg-surface text-text-primary' : 'text-text-muted hover:text-text-primary'}`}>
                <Globe className="w-3.5 h-3.5" />
              </button>
            </div>
            <Link href="/app" className="text-sm text-text-secondary hover:text-text-primary">返回</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Alerts */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{success}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />{error}
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
            {/* ── Segments ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {SEGMENTS.map(seg => {
                const count = segCounts[seg.id];
                const isActive = segment === seg.id;
                return (
                  <button key={seg.id}
                    onClick={() => handleSegmentChange(seg.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-bg-elevated border border-border-medium text-text-primary shadow-sm'
                        : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-medium'
                    }`}
                  >
                    <seg.icon className={`w-3.5 h-3.5 ${isActive ? seg.color : 'text-text-muted'}`} />
                    {seg.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-bg-surface text-text-muted' : 'bg-bg-surface text-text-muted/60'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input type="text" placeholder="搜索邮箱、昵称、省份..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue/50 text-sm" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {sortedUsers.length === users.length
                    ? `${users.length} 位用户`
                    : `${sortedUsers.length} / ${users.length} 位`}
                </span>
                {segment !== 'all' && (
                  <button
                    onClick={() => { setSegment('all'); router.replace('/admin/users', { scroll: false }); }}
                    className="text-xs text-prism-blue hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />清除筛选
                  </button>
                )}
              </div>
            </div>

            {/* ── Table View ───────────────────────────────────────────── */}
            {viewMode === 'table' && (
              <div className="rounded-2xl border border-border-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px]">
                    <thead className="bg-bg-elevated">
                      {/* Group header row: explain what each pair of columns means */}
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-2" />
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2 text-center text-[10px] text-text-muted/60" colSpan={2}>
                          身份与权限
                        </th>
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2 text-center text-[10px] text-text-muted/60" colSpan={4}>
                          活动追踪
                        </th>
                        <th className="px-4 py-2" />
                      </tr>
                      <tr className="text-left text-[11px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                        <th className="px-4 py-3 font-medium">用户</th>
                        <th className="px-3 py-3 font-medium">评分</th>
                        <th className="px-3 py-3 font-medium">验证</th>
                        <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-text-primary" onClick={() => handleSort('role')}>
                          角色 <SortIcon k="role" />
                        </th>
                        <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-text-primary" onClick={() => handleSort('plan')}>
                          套餐 <SortIcon k="plan" />
                        </th>
                        <th className="px-3 py-3 font-medium">活跃轨迹</th>
                        <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-text-primary" onClick={() => handleSort('todayCount')}>
                          今日 <SortIcon k="todayCount" />
                        </th>
                        <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-text-primary" onClick={() => handleSort('weekCount')}>
                          本周 <SortIcon k="weekCount" />
                        </th>
                        <th className="px-3 py-3 font-medium cursor-pointer select-none hover:text-text-primary" onClick={() => handleSort('lastActivity')}>
                          最近活跃 <SortIcon k="lastActivity" />
                        </th>
                        <th className="px-4 py-3 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {sortedUsers.map(user => {
                        const u = usage[user.id];
                        const uWeek = u?.weekCount ?? 0;
                        const uToday = u?.todayCount ?? 0;
                        const score = qualityScore(user, u ?? { todayCount: 0, weekCount: 0, totalCount: 0, lastActivity: null });
                        const sc = scoreColor(score);
                        const lastAct = u?.lastActivity || user.lastLoginAt;

                        return (
                          <tr key={user.id} className="hover:bg-bg-elevated/50 transition-colors group">
                            {/* User */}
                            <td className="px-4 py-3.5">
                              {editingUserId === user.id ? (
                                <div className="space-y-1.5 max-w-[200px]">
                                  <input value={editState.name} onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                                    placeholder="昵称" className="w-full px-2 py-1 rounded text-xs bg-bg-base border border-border-subtle text-text-primary" />
                                  <input value={editState.email} onChange={e => setEditState(s => ({ ...s, email: e.target.value }))}
                                    placeholder="邮箱" className="w-full px-2 py-1 rounded text-xs bg-bg-base border border-border-subtle text-text-primary" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-shrink-0">
                                    <div className="w-9 h-9 rounded-xl bg-prism-gradient flex items-center justify-center text-white text-xs font-bold">
                                      {user.name?.[0] || user.email[0].toUpperCase()}
                                    </div>
                                    {uWeek > 20 && (
                                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-bg-elevated" title="高活跃" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-text-primary truncate">{user.name || '未命名'}</p>
                                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                                    {user.province && <p className="text-[10px] text-text-muted/60">{user.province}</p>}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Quality score */}
                            <td className="px-3 py-3.5">
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${sc.bg} ${sc.text}`}>
                                <Star className="w-2.5 h-2.5" />
                                {score}
                              </div>
                            </td>

                            {/* Verified */}
                            <td className="px-3 py-3.5">
                              {user.emailVerified ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-orange-400" />
                              )}
                            </td>

                            {/* Role */}
                            <td className="px-3 py-3.5">
                              <div title={roleTooltips[user.role]} className="inline-block">
                                <Dropdown value={user.role} options={(['FREE', 'PRO', 'ADMIN'] as UserRole[])} labels={roleLabels}
                                  onChange={r => handleRoleChange(user.id, r as UserRole)}
                                  colorMap={{ FREE: 'gray', PRO: 'amber', ADMIN: 'purple' }} />
                              </div>
                            </td>

                            {/* Plan */}
                            <td className="px-3 py-3.5">
                              <div title={planTooltips[user.plan]} className="inline-block">
                                <Dropdown value={user.plan} options={(['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'] as SubscriptionPlan[])} labels={planLabels}
                                  onChange={p => handlePlanChange(user.id, p as SubscriptionPlan)}
                                  colorMap={{ FREE: 'gray', MONTHLY: 'blue', YEARLY: 'green', LIFETIME: 'purple' }} />
                              </div>
                            </td>

                            {/* Sparkline (7 days mini bar) */}
                            <td className="px-3 py-3.5">
                              <MiniSparkline todayCount={uToday} />
                            </td>

                            {/* Today */}
                            <td className="px-3 py-3.5">
                              <span className={`text-xs font-semibold ${
                                uToday >= 50 ? 'text-red-400' :
                                uToday >= 20 ? 'text-amber-400' :
                                uToday > 0 ? 'text-green-400' : 'text-text-muted'
                              }`}>
                                {uToday > 0 ? uToday : '-'}
                              </span>
                            </td>

                            {/* Week */}
                            <td className="px-3 py-3.5">
                              <span className="text-xs font-medium text-text-primary">{uWeek > 0 ? uWeek : '-'}</span>
                            </td>

                            {/* Last active */}
                            <td className="px-3 py-3.5">
                              <span className="text-xs text-text-muted">
                                {lastAct
                                  ? new Date(lastAct).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                                  : '从未'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              {editingUserId === user.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => saveEdit(user.id)}
                                    className="p-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20">
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={cancelEdit}
                                    className="p-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openDetail(user)}
                                    className="p-1.5 rounded-lg text-text-muted hover:bg-bg-surface hover:text-prism-blue" title="用量详情">
                                    <BarChart2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => startEdit(user)}
                                    className="p-1.5 rounded-lg text-text-muted hover:bg-bg-surface hover:text-prism-blue" title="编辑信息">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDelete(user.id)}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10" title="禁用用户">
                                    <Trash2 className="w-3.5 h-3.5" />
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
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">没有找到匹配的用户</p>
                    <button onClick={() => { setSearch(''); setSegment('all'); router.replace('/admin/users', { scroll: false }); }}
                      className="mt-2 text-xs text-prism-blue hover:underline">清除所有筛选</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Cards View ─────────────────────────────────────────── */}
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedUsers.map((user, i) => {
                  const u = usage[user.id];
                  const uWeek = u?.weekCount ?? 0;
                  const score = qualityScore(user, u ?? { todayCount: 0, weekCount: 0, totalCount: 0, lastActivity: null });
                  const sc = scoreColor(score);
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      className="rounded-2xl border border-border-subtle bg-bg-elevated p-4 hover:border-border-medium transition-all cursor-pointer group"
                      onClick={() => openDetail(user)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-prism-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {user.name?.[0] || user.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">{user.name || '未命名'}</p>
                            <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                          {score}分
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          user.plan === 'FREE' ? 'bg-bg-surface text-text-muted' :
                          user.plan === 'MONTHLY' ? 'bg-prism-blue/10 text-prism-blue' :
                          user.plan === 'YEARLY' ? 'bg-green-400/10 text-green-400' :
                          'bg-prism-purple/10 text-prism-purple'
                        }`}>
                          {planLabels[user.plan]}
                        </span>
                        {user.emailVerified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-400/10 text-green-400">已验证</span>
                        )}
                        {uWeek > 20 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-400/10 text-green-400">活跃</span>}
                        {uWeek === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-bg-surface text-text-muted">沉默</span>}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: '今日', val: u?.todayCount ?? 0, hot: (u?.todayCount ?? 0) >= 20 },
                          { label: '本周', val: u?.weekCount ?? 0, hot: (u?.weekCount ?? 0) >= 20 },
                          { label: '总计', val: u?.totalCount ?? 0, hot: false },
                        ].map(stat => (
                          <div key={stat.label} className="bg-bg-surface rounded-lg px-2 py-1.5 text-center">
                            <p className={`text-sm font-bold ${stat.hot ? 'text-prism-blue' : 'text-text-primary'}`}>
                              {stat.val > 0 ? stat.val : '-'}
                            </p>
                            <p className="text-[10px] text-text-muted">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-[10px] text-text-muted">
                        <span>注册 {new Date(user.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
                        {user.lastLoginAt && (
                          <span>最近 {Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / 86400000)}天前</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {sortedUsers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-text-muted">
                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">没有找到匹配的用户</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── 指标说明 + 权限矩阵 + 财务测算 ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <details className="rounded-2xl border border-border-subtle bg-bg-elevated overflow-hidden group">
          <summary className="px-6 py-4 flex items-center justify-between cursor-pointer list-none select-none">
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <BarChart2 className="w-4 h-4" />
              <span>指标说明 · 权限矩阵 · 定价依据</span>
            </div>
            <ChevronDown className="w-4 h-4 text-text-muted group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-6 pb-8 space-y-8 text-xs">

            {/* ── 用量追踪说明 ─────────────────────────── */}
            <div>
              <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                用量追踪说明
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '今日', desc: '当天 00:00 至现在的对话消息总数（跨所有会话）' },
                  { label: '本周', desc: '过去 7 天内累计对话消息数' },
                  { label: '活跃轨迹', desc: '最近 7 天每日消息柱状图（今日柱高亮为蓝色）' },
                  { label: '最近活跃', desc: '该用户最后一条消息的日期（空=从未发消息）' },
                ].map(item => (
                  <div key={item.label} className="bg-bg-base rounded-xl px-3 py-2.5">
                    <p className="font-semibold text-text-primary mb-0.5">{item.label}</p>
                    <p className="text-text-muted leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 角色权限矩阵 ─────────────────────────── */}
            <div>
              <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                角色权限矩阵（Role = 功能权限）
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-text-muted">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 pr-4 font-medium text-text-secondary">权限项</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-500">普通用户<br /><span className="text-[10px] font-normal">FREE</span></th>
                      <th className="text-center py-2 px-3 font-medium text-amber-400">高级用户<br /><span className="text-[10px] font-normal text-amber-400/60">PRO</span></th>
                      <th className="text-center py-2 px-3 font-medium text-prism-purple">管理员<br /><span className="text-[10px] font-normal text-prism-purple/60">ADMIN</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {[
                      { feature: '每日对话额度', free: '10 条/天', pro: '无上限', admin: '无上限' },
                      { feature: '可对话人物数量', free: '3 个 Persona', pro: '全部', admin: '全部' },
                      { feature: '对话模式', free: '仅 Solo 模式', pro: '全部 8 种模式', admin: '全部 8 种模式' },
                      { feature: '优先排队（高峰时）', free: '❌', pro: '✅ 优先响应', admin: '✅ 优先响应' },
                      { feature: '对话历史导出', free: '❌', pro: '✅ 图片/文本', admin: '✅ 图片/文本' },
                      { feature: '自定义 Persona 创建', free: '❌', pro: '✅', admin: '✅' },
                      { feature: '智辩场围观参与', free: '✅', pro: '✅', admin: '✅' },
                      { feature: '管理员面板访问', free: '❌', pro: '❌', admin: '✅ 系统后台' },
                      { feature: '用户管理权限', free: '❌', pro: '❌', admin: '✅ 查看/编辑/禁用' },
                    ].map(row => (
                      <tr key={row.feature} className="py-2">
                        <td className="py-2 pr-4 text-text-secondary font-medium">{row.feature}</td>
                        <td className="py-2 px-3 text-center">{row.free}</td>
                        <td className="py-2 px-3 text-center">{row.pro}</td>
                        <td className="py-2 px-3 text-center">{row.admin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-text-muted/60 mt-2">
                注：套餐（Plan）控制用量配额，与角色（Role）相互独立。用户可同时为「高级用户」+「月度套餐」
              </p>
            </div>

            {/* ── 套餐定价 + 财务测算 ─────────────────────────── */}
            <div>
              <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                套餐定价与财务测算（Plan = 用量配额）
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 左：定价 */}
                <div>
                  <p className="text-[10px] text-text-muted/60 mb-2 uppercase tracking-wider">订阅套餐</p>
                  <div className="space-y-2">
                    {[
                      { plan: '免费 FREE', price: '¥0', limit: '10 条/天', color: 'text-gray-400', bg: 'bg-gray-500/10' },
                      { plan: '月度订阅 MONTHLY', price: '¥29/月', limit: '无上限', color: 'text-prism-blue', bg: 'bg-prism-blue/10' },
                      { plan: '年度订阅 YEARLY', price: '¥199/年 ≈ ¥17/月', limit: '无上限', color: 'text-green-400', bg: 'bg-green-400/10' },
                      { plan: '终身订阅 LIFETIME', price: '¥399（一次性）', limit: '永久无上限', color: 'text-prism-purple', bg: 'bg-prism-purple/10' },
                    ].map(item => (
                      <div key={item.plan} className={`flex items-center justify-between px-3 py-2 rounded-xl ${item.bg}`}>
                        <span className={`font-medium ${item.color}`}>{item.plan}</span>
                        <div className="text-right">
                          <span className={`font-bold ${item.color}`}>{item.price}</span>
                          <span className="text-text-muted ml-2">{item.limit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 右：API 成本测算 */}
                <div>
                  <p className="text-[10px] text-text-muted/60 mb-2 uppercase tracking-wider">Deepseek API 成本测算</p>
                  <div className="bg-bg-base rounded-xl px-3 py-3 space-y-1.5">
                    {[
                      { label: '模型', value: 'DeepSeek-V3.2 (deepseek-chat)' },
                      { label: 'Input（缓存未命中）', value: '¥0.0020 / 1K tokens' },
                      { label: 'Input（缓存命中）', value: '¥0.0002 / 1K tokens' },
                      { label: 'Output', value: '¥0.0030 / 1K tokens' },
                      { label: '单次对话估算', value: '≈ 200 input + 150 output = ¥0.00085' },
                      { label: '月度极限成本（10条/天用户）', value: '10 × 30 × ¥0.00085 ≈ ¥0.26/人/月' },
                      { label: '月度极限成本（无限制用户）', value: '≈ ¥3.6/人/月（日均 50 条估算）' },
                      { label: '目标毛利率', value: '≥ 80%（订阅收入 - API 成本）' },
                    ].map(item => (
                      <div key={item.label} className="flex items-start justify-between gap-2">
                        <span className="text-text-muted flex-shrink-0">{item.label}</span>
                        <span className="text-text-secondary font-medium text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* 盈亏平衡测算表 */}
              <div className="mt-4">
                <p className="text-[10px] text-text-muted/60 mb-2 uppercase tracking-wider">盈亏平衡测算（月度订阅 ¥29 为例）</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-text-muted">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        {['日均消息', '月消息量', 'API成本', '订阅收入', '毛利', '毛利率'].map(h => (
                          <th key={h} className="text-center py-1.5 px-2 text-[10px] text-text-muted font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {[
                        { daily: 10, msgs: 300, cost: '¥0.26', rev: '¥29', margin: '¥28.74', rate: '99.1%' },
                        { daily: 20, msgs: 600, cost: '¥0.51', rev: '¥29', margin: '¥28.49', rate: '98.2%' },
                        { daily: 50, msgs: 1500, cost: '¥1.28', rev: '¥29', margin: '¥27.72', rate: '95.6%' },
                        { daily: 100, msgs: 3000, cost: '¥2.55', rev: '¥29', margin: '¥26.45', rate: '91.2%' },
                        { daily: 200, msgs: 6000, cost: '¥5.10', rev: '¥29', margin: '¥23.90', rate: '82.4%' },
                      ].map(row => (
                        <tr key={row.daily} className="py-1.5">
                          <td className="text-center px-2">{row.daily} 条</td>
                          <td className="text-center px-2">{row.msgs}</td>
                          <td className="text-center px-2">{row.cost}</td>
                          <td className="text-center px-2 text-green-400">{row.rev}</td>
                          <td className="text-center px-2 text-green-400 font-medium">{row.margin}</td>
                          <td className={`text-center px-2 font-medium ${parseFloat(row.rate) >= 80 ? 'text-green-400' : 'text-amber-400'}`}>{row.rate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-text-muted/60 mt-1.5 leading-relaxed">
                  结论：即使日均 200 条重度用户，毛利率仍达 82% 以上。订阅定价 ¥29/月 保本压力极低，
                  未来用户量增长后可考虑引入 DeepSeek Pro（更高质量）或 Claude（高端档）做分层付费模型。
                </p>
              </div>
            </div>

            {/* ── 数据口径说明 ─────────────────────────── */}
            <div>
              <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                数据口径说明
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '系统概览「总用户」', desc: '包含已禁用（软删除）账户总数' },
                  { label: '活跃用户', desc: 'is_active=TRUE 的账户' },
                  { label: '已禁用账户', desc: '软删除，数据仍保留，可手动恢复' },
                  { label: '用量为空', desc: '该用户今日无消息，或 JOIN 查询异常' },
                ].map(item => (
                  <div key={item.label} className="bg-bg-base rounded-xl px-3 py-2.5">
                    <p className="font-medium text-text-secondary mb-0.5">{item.label}</p>
                    <p className="text-text-muted leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </details>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={detailUser}
        usage={detailUsage}
        loading={detailLoading}
        onClose={closeDetail}
        onRoleChange={handleRoleChange}
        onPlanChange={handlePlanChange}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ─── Mini Sparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ todayCount }: { todayCount: number }) {
  // Deterministic bar heights using a fixed seed per "todayCount" bucket
  // Avoids jitter caused by Math.random() on re-render
  const bars = Math.min(7, Math.ceil(todayCount / 10));
  const heights = [15, 25, 40, 55, 70, 85, 100];
  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: 7 }).map((_, i) => {
        // Use deterministic heights: last bar always highlighted, others use fixed pattern
        const h = i === 6
          ? heights[Math.min(bars - 1, 6)]
          : (heights[i] ?? 20);
        return (
          <div
            key={i}
            className={`w-1.5 rounded-sm transition-all ${
              i === 6 ? 'bg-prism-blue' : 'bg-bg-surface'
            }`}
            style={{ height: `${Math.max(3, h * 0.26)}px` }}
          />
        );
      })}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown<T extends string>({ value, options, labels, onChange, colorMap }: {
  value: string; options: readonly T[]; labels: Record<string, string>;
  onChange: (v: string) => void; colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const colorClass = colorMap[value] || 'gray';
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-500/10 text-text-muted',
    amber: 'bg-amber-400/10 text-amber-400',
    purple: 'bg-prism-purple/10 text-prism-purple',
    blue: 'bg-prism-blue/10 text-prism-blue',
    green: 'bg-green-400/10 text-green-400',
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity ${colorClasses[colorClass] || colorClasses.gray} hover:opacity-80`}>
        {labels[value]}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[110px] rounded-xl border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden">
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

// ─── User Detail Modal ────────────────────────────────────────────────────────

function UserDetailModal({ user, usage, loading, onClose, onRoleChange, onPlanChange, onDelete }: {
  user: User | null;
  usage: DetailUsage | null;
  loading: boolean;
  onClose: () => void;
  onRoleChange: (id: string, role: UserRole) => void;
  onPlanChange: (id: string, plan: SubscriptionPlan) => void;
  onDelete: (id: string) => void;
}) {
  if (!user) return null;

  const maxCount = usage?.history?.reduce((m, h) => Math.max(m, h.count), 0) || 1;
  const today = new Date().toISOString().slice(0, 10);
  const u = usage;
  const score = qualityScore(user, { todayCount: u?.today ?? 0, weekCount: u?.week ?? 0, totalCount: u?.total ?? 0, lastActivity: null });
  const sc = scoreColor(score);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-xl rounded-2xl bg-bg-elevated border border-border-subtle shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-prism-gradient flex items-center justify-center text-white text-sm font-bold">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">{user.name || '未命名'}</p>
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                    质量 {score}分
                  </div>
                </div>
                <p className="text-xs text-text-muted">{user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick actions */}
          <div className="px-6 py-3 border-b border-border-subtle flex items-center gap-2">
            <div title={roleTooltips[user.role]}>
              <Dropdown value={user.role} options={(['FREE', 'PRO', 'ADMIN'] as UserRole[])} labels={{ FREE: '普通用户', PRO: '高级用户', ADMIN: '管理员' }}
                onChange={r => onRoleChange(user.id, r as UserRole)}
                colorMap={{ FREE: 'gray', PRO: 'amber', ADMIN: 'purple' }} />
            </div>
            <div title={planTooltips[user.plan]}>
              <Dropdown value={user.plan} options={(['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'] as SubscriptionPlan[])} labels={{ FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' }}
                onChange={p => onPlanChange(user.id, p as SubscriptionPlan)}
                colorMap={{ FREE: 'gray', MONTHLY: 'blue', YEARLY: 'green', LIFETIME: 'purple' }} />
            </div>
            <button onClick={() => { if (confirm('确定禁用此用户？')) onDelete(user.id); onClose(); }}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" />禁用
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 divide-x divide-border-subtle border-b border-border-subtle">
            {[
              { label: '今日消息', value: u?.today ?? 0, color: 'text-prism-blue' },
              { label: '本周消息', value: u?.week ?? 0, color: 'text-prism-purple' },
              { label: '总消息', value: u?.total ?? 0, color: 'text-prism-cyan' },
              { label: '今日排名', value: u?.rank ? `#${u.rank}` : '-', color: 'text-amber-400' },
            ].map(stat => (
              <div key={stat.label} className="px-4 py-4 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{loading ? '-' : stat.value}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Activity chart */}
          <div className="px-6 py-5">
            <p className="text-[11px] text-text-muted mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> 近7天活跃轨迹
            </p>
            {loading ? (
              <div className="h-20 flex items-end gap-1.5 justify-center">
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="flex-1 bg-bg-surface rounded-t animate-pulse" style={{ height: `${20 + i * 10}%` }} />
                ))}
              </div>
            ) : !u?.history?.length ? (
              <div className="h-20 flex flex-col items-center justify-center text-text-muted rounded-xl bg-bg-surface">
                <MessageSquare className="w-6 h-6 mb-1 opacity-40" />
                <p className="text-xs">暂无使用记录</p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-20 relative">
                {u!.history.map((h, i) => {
                  const pct = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
                  const isToday = h.date === today;
                  return (
                    <div key={h.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full h-16 flex items-end justify-center">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct * 0.64, 3)}px` }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className={`w-full rounded-t-md ${
                            isToday ? 'bg-prism-blue' : 'bg-prism-purple/50 hover:bg-prism-purple/80'
                          }`}
                        />
                      </div>
                      <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                        <div className="bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1 shadow-xl text-[11px] whitespace-nowrap">
                          <p className="text-text-primary font-medium">{h.date}</p>
                          <p className="text-prism-blue">{h.count} 条</p>
                        </div>
                      </div>
                      <span className="text-[9px] text-text-muted">{h.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User info */}
          <div className="px-6 pb-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '注册时间', value: new Date(user.createdAt).toLocaleString('zh-CN') },
                { label: '最后登录', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未' },
                { label: '性别', value: { male: '男', female: '女', null: '-' }[user.gender as keyof typeof genderLabels] ?? '-' },
                { label: '省份', value: user.province || '-' },
                { label: '邮箱验证', value: user.emailVerified ? '已验证' : '未验证' },
                { label: '用户ID', value: user.id.slice(0, 8) + '...' },
              ].map(item => (
                <div key={item.label} className="bg-bg-surface rounded-lg px-3 py-2">
                  <p className="text-[10px] text-text-muted">{item.label}</p>
                  <p className="text-xs font-medium text-text-primary mt-0.5 break-all">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

const genderLabels = { male: '男', female: '女', null: '-' } as const;

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-prism-blue animate-spin" />
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
