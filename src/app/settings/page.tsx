'use client';

/**
 * Prismatic — Account Settings Page
 */
import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, User, Mail, Lock, Shield, Bell, Trash2,
  Save, CheckCircle, AlertTriangle, RefreshCw,
  ChevronRight, Smartphone, Github, Crown,
  Edit3, X, Check, Eye, EyeOff
} from 'lucide-react';
import { useAuthStore, AuthUser } from '@/lib/auth-store';

const PROVINCES = [
  '北京', '上海', '天津', '重庆',
  '广东', '江苏', '浙江', '四川', '湖北', '湖南',
  '河北', '河南', '山东', '山西', '安徽', '福建', '江西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏',
  '云南', '贵州', '广西', '海南',
  '内蒙古', '黑龙江', '吉林', '辽宁',
  '港澳台', '海外', '未知'
];

type Tab = 'profile' | 'account' | 'security' | 'notifications';

export default function SettingsPage() {
  const { user, refresh } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">请先登录</p>
          <Link href="/auth/signin" className="text-prism-blue hover:underline">去登录</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-border-subtle bg-bg-elevated sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-prism-blue" />
              <span className="font-medium text-text-primary">账号设置</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.plan !== 'FREE' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
                <Crown className="w-3 h-3" />
                {user.plan === 'MONTHLY' ? '月度会员' : user.plan === 'YEARLY' ? '年度会员' : '终身会员'}
              </span>
            )}
            <Link href="/app" className="text-sm text-prism-blue hover:underline">返回应用</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Notifications */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />{success}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />{error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <div className="flex flex-col gap-1 sticky top-24">
              {[
                { id: 'profile', label: '个人信息', icon: User },
                { id: 'account', label: '账号信息', icon: Mail },
                { id: 'security', label: '安全设置', icon: Lock },
                { id: 'notifications', label: '通知偏好', icon: Bell },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-prism-blue/10 text-prism-blue'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <ProfileTab key="profile" user={user} onSuccess={showSuccess} onError={showError} onLoading={setLoading} />
              )}
              {activeTab === 'account' && (
                <AccountTab key="account" user={user} onSuccess={showSuccess} onError={showError} />
              )}
              {activeTab === 'security' && (
                <SecurityTab key="security" user={user} onSuccess={showSuccess} onError={showError} />
              )}
              {activeTab === 'notifications' && (
                <NotificationsTab key="notifications" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab({ user, onSuccess, onError, onLoading }: {
  user: AuthUser;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
  onLoading: (b: boolean) => void;
}) {
  const { refresh } = useAuthStore();
  const [name, setName] = useState(user.name || '');
  const [gender, setGender] = useState(user.gender || '');
  const [province, setProvince] = useState(user.province || '');
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    onLoading(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, gender: gender || null, province: province || null }),
      });
      const data = await res.json();
      if (res.ok) {
        await refresh();
        setEditing(false);
        onSuccess('个人信息已更新');
      } else {
        onError(data.error || '保存失败');
      }
    } catch {
      onError('保存失败，请重试');
    } finally {
      onLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="text-lg font-medium text-text-primary mb-6">个人信息</h2>
      <div className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border-subtle bg-bg-elevated">
          {user.avatar ? (
            <Image unoptimized src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" width={64} height={64} />
          ) : (
            <div className="w-16 h-16 rounded-full bg-prism-gradient flex items-center justify-center text-white text-xl font-medium">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-text-primary">{user.name || '未设置昵称'}</p>
            <p className="text-xs text-text-muted">{user.email}</p>
            <p className="text-xs text-text-muted mt-1">头像由第三方账号设置，暂不支持手动更换</p>
          </div>
        </div>

        {/* Fields */}
        <div className="rounded-xl border border-border-subtle bg-bg-elevated divide-y divide-border-subtle">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-text-primary">昵称</p>
              {editing ? (
                <input value={name} onChange={e => setName(e.target.value)}
                  className="mt-1 w-full max-w-xs px-3 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary" />
              ) : (
                <p className="text-sm text-text-muted mt-0.5">{user.name || '未设置'}</p>
              )}
            </div>
            <button onClick={() => { if (editing) handleSave(); setEditing(!editing); }}
              className="flex items-center gap-1.5 text-sm text-prism-blue hover:underline">
              {editing ? <><Check className="w-3.5 h-3.5" /> 保存</> : <><Edit3 className="w-3.5 h-3.5" /> 编辑</>}
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-text-primary">性别</p>
              {editing ? (
                <select value={gender} onChange={e => setGender(e.target.value)}
                  className="mt-1 w-full max-w-xs px-3 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary">
                  <option value="">未设置</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              ) : (
                <p className="text-sm text-text-muted mt-0.5">
                  {gender === 'male' ? '男' : gender === 'female' ? '女' : '未设置'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-text-primary">所在省份</p>
              {editing ? (
                <select value={province} onChange={e => setProvince(e.target.value)}
                  className="mt-1 w-full max-w-xs px-3 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary">
                  <option value="">未设置</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <p className="text-sm text-text-muted mt-0.5">{user.province || '未设置'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Account Tab ─── */
function AccountTab({ user, onSuccess, onError }: {
  user: AuthUser;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const planLabels: Record<string, string> = {
    FREE: '免费版',
    MONTHLY: '月度会员',
    YEARLY: '年度会员',
    LIFETIME: '终身会员',
  };
  const roleLabels: Record<string, string> = {
    FREE: '普通用户',
    PRO: '高级用户',
    ADMIN: '管理员',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="text-lg font-medium text-text-primary mb-6">账号信息</h2>
      <div className="space-y-4">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated divide-y divide-border-subtle">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-text-primary">邮箱地址</p>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-text-primary">邮箱验证</p>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              user.emailVerified
                ? 'text-green-400 bg-green-400/10'
                : 'text-amber-400 bg-amber-400/10'
            }`}>
              {user.emailVerified ? <><CheckCircle className="w-3 h-3" /> 已验证</> : <><AlertTriangle className="w-3 h-3" /> 未验证</>}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-text-primary">当前套餐</p>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              user.plan === 'FREE'
                ? 'text-text-muted bg-bg-surface'
                : 'text-amber-400 bg-amber-400/10'
            }`}>
              {user.plan !== 'FREE' && <Crown className="w-3 h-3" />}
              {planLabels[user.plan]}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-text-primary">用户角色</p>
            <span className="text-sm text-text-muted">{roleLabels[user.role]}</span>
          </div>
        </div>

        {user.plan === 'FREE' && (
          <Link href="/pricing"
            className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group">
            <div>
              <p className="text-sm font-medium text-text-primary">升级到高级版</p>
              <p className="text-xs text-text-muted mt-0.5">解锁更多蒸馏人物和协作模式</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-400 mb-1">危险区域</p>
          <p className="text-xs text-text-muted mb-3">注销账号后，所有数据将被永久删除，此操作不可恢复。</p>
          <button
            onClick={() => { if (confirm('确定要注销账号吗？此操作不可恢复。')) onError('请联系管理员注销账号'); }}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> 注销账号
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Security Tab ─── */
function SecurityTab({ user, onSuccess, onError }: {
  user: AuthUser;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { onError('两次输入的密码不一致'); return; }
    if (newPassword.length < 4) { onError('密码长度不能少于4位'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        onSuccess('密码修改成功');
      } else {
        onError(data.error || '修改失败');
      }
    } catch {
      onError('修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="text-lg font-medium text-text-primary mb-6">安全设置</h2>
      <div className="space-y-4">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <p className="text-sm font-medium text-text-primary mb-4">修改密码</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">当前密码</label>
              <input type={showPassword ? 'text' : 'password'} value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-prism-blue" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">新密码</label>
              <input type={showPassword ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-prism-blue" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">确认新密码</label>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg-base border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-prism-blue" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setShowPassword(!showPassword)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
                {showPassword ? <><Eye className="w-3.5 h-3.5" /> 隐藏密码</> : <><Lock className="w-3.5 h-3.5" /> 显示密码</>}
              </button>
              <button onClick={handleChangePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-prism-gradient text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-elevated divide-y divide-border-subtle">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center">
                <Github className="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">GitHub 账号</p>
                <p className="text-xs text-text-muted">用于 GitHub OAuth 登录</p>
              </div>
            </div>
            <span className="text-xs text-text-muted">未关联</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">微信账号</p>
                <p className="text-xs text-text-muted">用于微信扫码登录</p>
              </div>
            </div>
            <span className="text-xs text-text-muted">未关联</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Notifications Tab ─── */
function NotificationsTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="text-lg font-medium text-text-primary mb-6">通知偏好</h2>
      <div className="rounded-xl border border-border-subtle bg-bg-elevated divide-y divide-border-subtle">
        {[
          { label: '系统通知', desc: '版本更新、维护公告等重要通知', enabled: true },
          { label: '订阅到期提醒', desc: '套餐到期前7天发送提醒', enabled: true },
          { label: '营销邮件', desc: '新产品、新功能介绍', enabled: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="text-xs text-text-muted">{item.desc}</p>
            </div>
            <button className={`relative w-10 h-6 rounded-full transition-colors ${item.enabled ? 'bg-prism-blue' : 'bg-gray-600'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${item.enabled ? 'left-5' : 'left-1'}`} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-3 px-1">通知功能开发中，暂时无法自定义。</p>
    </motion.div>
  );
}
