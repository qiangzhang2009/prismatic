'use client';

/**
 * Prismatic — Admin Dashboard Overview
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Crown, TrendingUp, Clock, Shield, ChevronRight, AlertTriangle } from 'lucide-react';

interface Stats {
  total: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data);
        }
      })
      .catch(() => setError('获取数据失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="text-text-muted">加载中...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
      <Shield className="w-12 h-12 text-text-muted mb-4" />
      <p className="text-text-secondary mb-4">{error}</p>
      <Link href="/auth/signin" className="text-prism-blue hover:underline">去登录</Link>
    </div>
  );

  const planLabels: Record<string, string> = { FREE: '免费', MONTHLY: '月度', YEARLY: '年度', LIFETIME: '终身' };

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="w-5 h-5" /></Link>
          <span className="font-medium text-text-primary">管理员面板</span>
          <div className="ml-auto flex gap-3">
            <Link href="/admin/users" className="text-sm text-prism-blue hover:underline">用户管理</Link>
            <Link href="/app" className="text-sm text-text-secondary hover:text-text-primary">返回应用</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-text-primary mb-8">系统概览</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard icon={Users} label="总用户" value={stats?.total || 0} color="blue" />
          <StatCard icon={TrendingUp} label="近30天新增" value={stats?.recent || 0} color="green" />
          <StatCard icon={Crown} label="付费用户" value={(stats?.byPlan.MONTHLY || 0) + (stats?.byPlan.YEARLY || 0) + (stats?.byPlan.LIFETIME || 0)} color="amber" />
          <StatCard icon={Shield} label="管理员" value={stats?.byRole.ADMIN || 0} color="purple" />
        </div>

        {/* Plans breakdown */}
        <div className="bg-bg-elevated rounded-xl border border-border-subtle p-6 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">用户套餐分布</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats?.byPlan || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between p-3 rounded-lg bg-bg-surface">
                <span className="text-sm text-text-secondary">{planLabels[plan] || plan}</span>
                <span className="text-lg font-bold text-text-primary">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Role breakdown */}
        <div className="bg-bg-elevated rounded-xl border border-border-subtle p-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">用户角色分布</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats?.byRole || {}).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between p-3 rounded-lg bg-bg-surface">
                <span className="text-sm text-text-secondary">{role === 'ADMIN' ? '管理员' : role === 'PRO' ? '高级用户' : '普通用户'}</span>
                <span className="text-lg font-bold text-text-primary">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-text-primary mb-4">快速操作</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/users" className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-bg-elevated hover:bg-bg-surface transition-colors">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-prism-blue" />
                <span className="text-text-primary">用户管理</span>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-${color === 'blue' ? 'prism-blue' : color === 'green' ? 'green-400' : color === 'amber' ? 'amber-400' : 'prism-purple'}`}>
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
