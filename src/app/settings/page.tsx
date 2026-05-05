'use client';

/**
 * Prismatic — Account Settings Page
 *
 * Uses useAuthMe (React Query) as the authoritative data source for user info.
 * Zustand store is NOT used here to avoid any caching/reactivity edge cases.
 * React Query with staleTime:0 ensures we ALWAYS get fresh data from /api/auth/me.
 */
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, User, Mail, Lock, Shield, Bell, Trash2,
  Save, CheckCircle, AlertTriangle, RefreshCw,
  ChevronRight, Smartphone, Github, Crown,
  Edit3, X, Check, Eye, EyeOff, Zap, CreditCard, DollarSign, ChevronDown,
  Key, QrCode, Copy, CheckCheck,
} from 'lucide-react';
import { useAuthMe, type AuthUserMe } from '@/lib/use-auth-me';

/* ─── Payment Modal ─── */
function PaymentModal({ plan, onClose }: { plan: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const planInfo: Record<string, { label: string; price: string }> = {
    MONTHLY: { label: '月度订阅', price: '¥29/月' },
    YEARLY:  { label: '年度订阅', price: '¥199/年' },
    LIFETIME:{ label: '终身会员', price: '¥399' },
    'starter':{ label: '尝鲜包（200条）', price: '¥9' },
    'standard':{ label: '标准包（600条）', price: '¥25' },
    'plus':  { label: '增强包（1500条）', price: '¥59' },
  };

  const info = planInfo[plan] ?? { label: plan, price: '' };

  const handleCopy = () => {
    navigator.clipboard.writeText('3740977');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-elevated p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-medium text-text-primary">{info.label}</h3>
            <p className="text-xs text-text-muted mt-0.5">{info.price} · 扫码支付</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WeChat QR */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-border-subtle bg-bg-surface mb-3">
            <Image unoptimized src="/wechat-payment-1.png" alt="微信收款码" fill className="object-cover" />
          </div>
          <p className="text-sm text-text-secondary">打开微信，扫描上方二维码付款</p>
        </div>

        {/* Payment info */}
        <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <span className="text-green-400 font-bold text-sm">微</span>
              </div>
              <div>
                <p className="text-xs text-text-muted">微信号</p>
                <p className="text-sm font-medium text-text-primary font-mono">3740977</p>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-prism-blue hover:text-prism-blue/80 transition-colors"
            >
              {copied ? <><CheckCheck className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制</>}
            </button>
          </div>
          <div className="border-t border-border-subtle pt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">支</span>
            </div>
            <div>
              <p className="text-xs text-text-muted">支付宝收款码</p>
              <p className="text-xs text-text-muted">如有需要，微信添加后说明需要支付宝</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-400 font-medium mb-1">付款后自动到账</p>
          <p className="text-[11px] text-text-muted">
            付款时备注「Prismatic」，付款后微信搜索 3740977 发送付款截图，备注未填写时需提供注册邮箱核实
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
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

type Tab = 'profile' | 'account' | 'subscription' | 'security' | 'notifications';

export default function SettingsPage() {
  // Use React Query as authoritative data source — always fresh from server.
  // Bypasses Zustand store completely to eliminate any caching issues.
  const { data: user, isLoading, refetch, isFetching } = useAuthMe();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-prism-blue/30 border-t-prism-blue rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-secondary text-sm">加载中...</p>
        </div>
      </div>
    );
  }

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
            {user.credits > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-prism-blue bg-prism-blue/10 px-2 py-1 rounded-lg">
                <Zap className="w-3 h-3" />
                {user.credits} 条充值
              </span>
            )}
            <button
              onClick={() => refetch()}
              className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
              title="从服务器刷新身份信息"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              同步
            </button>
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
                { id: 'subscription', label: '会员订阅', icon: CreditCard },
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
              {activeTab === 'subscription' && (
                <SubscriptionTab key="subscription" user={user} />
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
  user: AuthUserMe;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
  onLoading: (b: boolean) => void;
}) {
  const { refetch } = useAuthMe();
  const [name, setName] = useState(user.name || '');
  const [gender, setGender] = useState(user.gender || '');
  const [province, setProvince] = useState(user.province || '');
  const [editing, setEditing] = useState(false);

  // Sync local form state when admin updates the user's profile.
  useEffect(() => {
    if (!editing) {
      setName(user.name || '');
      setGender(user.gender || '');
      setProvince(user.province || '');
    }
  }, [user, editing]);

  const handleSave = async () => {
    onLoading(true);
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, gender: gender || null, province: province || null }),
      });
      const data = await res.json();
      if (res.ok) {
        await refetch();
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
  user: AuthUserMe;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const { refetch } = useAuthMe();
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
  const genderLabels = { male: '男', female: '女', null: '-' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-text-primary">账号信息</h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          title="从服务器刷新最新身份"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          同步身份
        </button>
      </div>
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
          {user.credits > 0 && (
            <div className="flex items-center justify-between px-4 py-4">
              <p className="text-sm font-medium text-text-primary">充值条数</p>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-prism-blue bg-prism-blue/10">
                <Zap className="w-3 h-3" />
                {user.credits} 条可用
              </span>
            </div>
          )}
        </div>

        <Link href="/settings#subscription"
          onClick={() => document.querySelector<HTMLElement>('[data-tab="subscription"]')?.click()}
          className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group">
          <div>
            <p className="text-sm font-medium text-text-primary">升级到高级版</p>
            <p className="text-xs text-text-muted mt-0.5">查看定价方案和充值条数</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
        </Link>

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

/* ─── Subscription Tab ─── */
function SubscriptionTab({ user }: { user: AuthUserMe }) {
  const { refetch } = useAuthMe();
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyProvider, setApiKeyProvider] = useState<'deepseek' | 'openai' | 'anthropic'>('deepseek');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeySuccess, setApiKeySuccess] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);

  const [creditLogPage, setCreditLogPage] = useState(1);
  const [creditLogs, setCreditLogs] = useState<any[]>([]);
  const [creditLogsTotal, setCreditLogsTotal] = useState(0);
  const [creditLogsLoading, setCreditLogsLoading] = useState(false);

  // Fetch credit logs when tab is visible
  useEffect(() => {
    if (user?.plan === 'FREE') {
      setCreditLogsLoading(true);
      fetch(`/api/user/credit-logs?page=${creditLogPage}`)
        .then(r => r.json())
        .then(data => {
          setCreditLogs(data.logs || []);
          setCreditLogsTotal(data.total || 0);
        })
        .catch(() => {})
        .finally(() => setCreditLogsLoading(false));
    }
  }, [user?.plan, creditLogPage]);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) { setApiKeyError('请输入有效的 API Key'); return; }
    setApiKeyLoading(true);
    setApiKeyError('');
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKeyInput.trim(), provider: apiKeyProvider }),
      });
      const data = await res.json();
      if (!res.ok) { setApiKeyError(data.error || '保存失败'); return; }
      setApiKeySuccess(`已保存 ${data.provider?.toUpperCase()} Key`);
      setShowApiKeyInput(false);
      setApiKeyInput('');
      setTimeout(() => setApiKeySuccess(''), 3000);
      refetch();
    } catch { setApiKeyError('网络错误，请重试'); }
    finally { setApiKeyLoading(false); }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm('确定要删除 API Key 吗？删除后将使用平台代付模式。')) return;
    setApiKeyLoading(true);
    try {
      await fetch('/api/user/api-key', { method: 'DELETE' });
      refetch();
    } finally { setApiKeyLoading(false); }
  };

  const planLabels: Record<string, string> = {
    FREE: '免费版',
    MONTHLY: '月度会员',
    YEARLY: '年度会员',
    LIFETIME: '终身会员',
  };
  const planDesc: Record<string, string> = {
    FREE: '每日 10 条免费对话',
    MONTHLY: '无限对话额度，优先响应',
    YEARLY: '无限对话 + 年付更划算',
    LIFETIME: '永久无限额度，无需续费',
  };

  const plans = [
    { id: 'MONTHLY', name: '月度订阅', price: '¥29/月', badge: '推荐', color: 'prism-blue', popular: true },
    { id: 'YEARLY', name: '年度订阅', price: '¥199/年 ≈ ¥17/月', badge: '最划算', color: 'green-500', popular: false },
    { id: 'LIFETIME', name: '终身会员', price: '¥399 一次性', badge: '永久', color: 'prism-purple', popular: false },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-text-primary">会员订阅</h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          同步
        </button>
      </div>

      {/* Current status */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 mb-6">
        <p className="text-xs text-text-muted mb-2">当前订阅状态</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Crown className={`w-5 h-5 ${user.plan !== 'FREE' ? 'text-amber-400' : 'text-text-muted'}`} />
            <div>
              <p className="text-sm font-medium text-text-primary">{planLabels[user.plan]}</p>
              <p className="text-xs text-text-muted">{planDesc[user.plan]}</p>
            </div>
          </div>
          {user.credits > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-prism-blue/10 px-3 py-1.5 rounded-lg">
              <Zap className="w-4 h-4 text-prism-blue" />
              <span className="text-sm font-medium text-prism-blue">{user.credits} 条充值</span>
            </div>
          )}
        </div>
        {user.plan === 'FREE' && (
          <p className="text-xs text-text-muted mt-2">免费用户每日 10 条上限</p>
        )}
      </div>

      {/* API Key 管理区块（User-Pays 模式） */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-text-primary">API Key（User-Pays 模式）</span>
            {user.apiKeyStatus === 'valid' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-400">已设置</span>
            )}
          </div>
          {!showApiKeyInput && user.apiKeyStatus !== 'valid' && (
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              设置 Key
            </button>
          )}
        </div>

        {apiKeySuccess && (
          <div className="mb-3 p-2 rounded-lg bg-green-400/10 text-green-400 text-xs">
            {apiKeySuccess}
          </div>
        )}

        {showApiKeyInput ? (
          <div className="space-y-2">
            <select
              value={apiKeyProvider}
              onChange={e => setApiKeyProvider(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-sm text-text-primary"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="粘贴你的 API Key..."
              className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border-subtle text-sm text-text-primary placeholder-text-muted/50 font-mono"
            />
            {apiKeyError && <p className="text-xs text-red-400">{apiKeyError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveApiKey}
                disabled={apiKeyLoading}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {apiKeyLoading ? '验证中...' : '保存并验证'}
              </button>
              <button
                onClick={() => { setShowApiKeyInput(false); setApiKeyError(''); setApiKeyInput(''); }}
                className="px-4 py-2 rounded-lg bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors"
              >
                取消
              </button>
            </div>
            <p className="text-[10px] text-text-muted/60">
              你的 API Key 使用 AES-256-GCM 加密存储，仅用于调用你自己的 LLM 账户
            </p>
          </div>
        ) : user.apiKeyStatus === 'valid' ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary">
                {user.apiKeyProvider?.toUpperCase()} Key 已设置
              </p>
              <p className="text-[10px] text-text-muted/60 mt-0.5">对话费用直接从你的 LLM 账户扣除，平台零成本</p>
            </div>
            <button
              onClick={handleDeleteApiKey}
              disabled={apiKeyLoading}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              删除
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            使用你自己的 API Key 可以零平台成本无限对话，支持 DeepSeek / OpenAI / Anthropic
          </p>
        )}
      </div>

      {/* Subscription plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-5 ${
              plan.color === 'prism-blue'
                ? 'border-prism-blue/40 bg-gradient-to-b from-prism-blue/8 to-bg-elevated'
                : plan.color === 'green-500'
                ? 'border-green-500/30 bg-gradient-to-b from-green-500/5 to-bg-elevated'
                : 'border-prism-purple/30 bg-gradient-to-b from-prism-purple/5 to-bg-elevated'
            }`}
          >
            {plan.popular && (
              <div className="text-center mb-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-${plan.color}/15 text-${plan.color}`}>
                  {plan.badge}
                </span>
              </div>
            )}
            <p className={`text-sm font-medium ${
              plan.color === 'prism-blue' ? 'text-prism-blue' : plan.color === 'green-500' ? 'text-green-400' : 'text-prism-purple'
            }`}>{plan.name}</p>
            <p className="text-xl font-bold text-text-primary mt-1">{plan.price}</p>
            <p className="text-xs text-text-muted mt-1 mb-4">
              {plan.id === 'MONTHLY' ? '随时取消，自动续费'
                : plan.id === 'YEARLY' ? '比月付省 ¥149/年'
                : '永久有效，无需续费'}
            </p>
            <button
              onClick={() => setPaymentPlan(plan.id)}
              className={`w-full py-2 rounded-xl text-sm font-medium transition-opacity text-white ${
                plan.color === 'prism-blue' ? 'bg-prism-blue hover:opacity-90'
                  : plan.color === 'green-500' ? 'bg-green-500 hover:opacity-90'
                  : 'bg-prism-purple hover:opacity-90'
              }`}
            >
              微信购买
            </button>
          </div>
        ))}
      </div>

      {/* Credit packs */}
      <div className="mb-6">
        <p className="text-sm font-medium text-text-primary mb-3">充值问答条数</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: '尝鲜包', credits: 200, price: '¥9', per: '¥4.5/100条' },
            { name: '标准包', credits: 600, price: '¥25', per: '¥4.2/100条', popular: true },
            { name: '增强包', credits: 1500, price: '¥59', per: '¥3.9/100条', best: true },
          ].map(pack => (
            <div key={pack.name} className="rounded-xl border border-border-subtle bg-bg-elevated p-4 text-center">
              {pack.popular && <span className="text-[10px] text-prism-purple bg-prism-purple/10 px-1.5 py-0.5 rounded-full">最受欢迎</span>}
              {pack.best && <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">最划算</span>}
              <p className="text-sm font-medium text-text-primary mt-1">{pack.name}</p>
              <p className="text-lg font-bold text-text-primary">{pack.price}</p>
              <p className="text-xs text-text-muted">{pack.credits} 条</p>
              <p className="text-[10px] text-text-muted/60">{pack.per}</p>
              <button
                onClick={() => setPaymentPlan(pack.name === '尝鲜包' ? 'starter' : pack.name === '标准包' ? 'standard' : 'plus')}
                className="mt-2 w-full py-1.5 rounded-lg bg-bg-surface text-sm text-text-secondary hover:bg-bg-overlay transition-colors"
              >
                微信购买
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2 text-center">充值条数永久有效，不清零，不过期</p>
      </div>

      {/* 积分流水（FREE 用户） */}
      {user.plan === 'FREE' && (
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">积分流水</p>
          {creditLogsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-bg-surface rounded-lg animate-pulse" />)}
            </div>
          ) : creditLogs.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">暂无积分变动记录</p>
          ) : (
            <div className="space-y-1">
              {creditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-surface">
                  <div>
                    <p className="text-xs text-text-secondary">{log.description || log.type}</p>
                    <p className="text-[10px] text-text-muted/60">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.amount > 0 ? `+${log.amount}` : log.amount}
                  </span>
                </div>
              ))}
              {creditLogsTotal > 20 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setCreditLogPage(p => Math.max(1, p - 1))}
                    disabled={creditLogPage === 1}
                    className="text-xs text-text-muted disabled:opacity-30"
                  >上一页</button>
                  <span className="text-xs text-text-muted">{creditLogPage} / {Math.ceil(creditLogsTotal / 20)}</span>
                  <button
                    onClick={() => setCreditLogPage(p => p + 1)}
                    disabled={creditLogPage >= Math.ceil(creditLogsTotal / 20)}
                    className="text-xs text-text-muted disabled:opacity-30"
                  >下一页</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contact */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 text-center">
        <p className="text-sm text-text-secondary mb-1">购买或咨询</p>
        <p className="text-xs text-text-muted">微信搜索 <span className="font-mono font-medium text-text-primary">3740977</span> 备注「Prismatic会员」</p>
      </div>

      <AnimatePresence>
        {paymentPlan && (
          <PaymentModal plan={paymentPlan} onClose={() => setPaymentPlan(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Security Tab ─── */
function SecurityTab({ user, onSuccess, onError }: {
  user: AuthUserMe;
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
