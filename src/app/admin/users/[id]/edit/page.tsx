'use client';

/**
 * Prismatic — User Edit Page
 * 编辑用户信息：姓名、邮箱、角色、套餐、状态、个人信息
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, RefreshCw, User, Mail, Shield,
  Crown, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';
import { useUser } from '@/lib/use-admin-data';

const ROLES = ['FREE', 'PRO', 'ADMIN'] as const;
const PLANS = ['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'] as const;
const STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;

export default function UserEditPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const { data: user, isLoading, error } = useUser(userId);

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'FREE',
    plan: 'FREE',
    status: 'ACTIVE',
    gender: '',
    province: '',
    credits: 0,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        role: (user.role as typeof ROLES[number]) || 'FREE',
        plan: (user.plan as typeof PLANS[number]) || 'FREE',
        status: (user.status as typeof STATUSES[number]) || 'ACTIVE',
        gender: (user as any).gender || '',
        province: (user as any).province || '',
        credits: user.credits || 0,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/edit`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || null,
          email: form.email || null,
          role: form.role,
          plan: form.plan,
          status: form.status,
          gender: form.gender || null,
          province: form.province || null,
          credits: form.credits,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '保存失败' });
      } else {
        setMessage({ type: 'success', text: '保存成功' });
        setTimeout(() => router.push(`/admin/users/${userId}`), 1200);
      }
    } catch (err) {
      setMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setSaving(false);
    }
  };

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

  const inputClass = (field: string) =>
    `w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-prism-blue/50 focus:border-prism-blue transition-colors`;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/admin/users/${userId}`)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">编辑用户</h1>
          <p className="text-gray-400 text-sm mt-1">{user.email || userId}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/30 border border-green-800 text-green-400'
              : 'bg-red-900/30 border border-red-800 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          {message.text}
        </motion.div>
      )}

      <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-prism-blue" />
            基本信息
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">邮箱</label>
              <input
                type="email"
                className={inputClass('email')}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">姓名</label>
              <input
                type="text"
                className={inputClass('name')}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="显示名称"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">性别</label>
              <select
                className={inputClass('gender')}
                value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              >
                <option value="">未设置</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">省份</label>
              <input
                type="text"
                className={inputClass('province')}
                value={form.province}
                onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                placeholder="如：北京、上海"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Role & Plan */}
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-prism-purple" />
            角色与套餐
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">角色</label>
              <select
                className={inputClass('role')}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as typeof ROLES[number] }))}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">套餐</label>
              <select
                className={inputClass('plan')}
                value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value as typeof PLANS[number] }))}
              >
                {PLANS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">状态</label>
              <select
                className={inputClass('status')}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof STATUSES[number] }))}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">积分</label>
              <input
                type="number"
                min="0"
                className={inputClass('credits')}
                value={form.credits}
                onChange={e => setForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => router.push(`/admin/users/${userId}`)}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-prism-blue hover:bg-prism-blue/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
