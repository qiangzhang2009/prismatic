'use client';

/**
 * Prismatic — Sign Up Page
 * Fields: nickname, gender, province, email, password, verification code
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  Hexagon, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft,
  UserPlus, Check, Send, User, ChevronDown
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

// Chinese provinces (major ones for common use)
const PROVINCES = [
  '北京', '上海', '天津', '重庆',
  '广东', '江苏', '浙江', '四川', '湖北', '湖南',
  '河北', '河南', '山东', '山西', '安徽', '福建', '江西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏',
  '云南', '贵州', '广西', '海南',
  '内蒙古', '黑龙江', '吉林', '辽宁',
  '港澳台', '海外'
];

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

type Step = 'form' | 'verify';

export default function SignUpPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  // Form fields
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [province, setProvince] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showProvinceMenu, setShowProvinceMenu] = useState(false);

  // Step & state
  const [step, setStep] = useState<Step>('form');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    if (!email) { setError('请先填写邮箱'); return; }
    setSendingCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '发送失败');
        return;
      }
      setCodeSent(true);
      setCountdown(60);
      setStep('verify');
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('请填写昵称'); return; }
    if (!gender) { setError('请选择性别'); return; }
    if (!province) { setError('请选择所在省份'); return; }
    if (!email) { setError('请填写邮箱'); return; }
    if (password.length < 8) { setError('密码至少8位'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (!agreed) { setError('请先阅读并同意用户协议'); return; }

    sendCode();
  };

  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) { setError('验证码为6位数字'); return; }

    const result = await register(email, password, name, gender as 'male' | 'female', province, code);
    if (result.success) {
      router.push('/app');
    } else {
      setError(result.error || '注册失败');
    }
  };

  const resendCode = () => {
    if (countdown > 0) return;
    sendCode();
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回首页</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-gradient mb-4">
              <Hexagon className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-display font-bold gradient-text">{APP_NAME}</h1>
            <p className="text-text-muted mt-2">
              {step === 'form' ? '创建你的账号，免费开始体验' : '输入验证码完成注册'}
            </p>
          </div>

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {error && <ErrorMsg msg={error} />}

              {/* Nickname */}
              <Field label="昵称" required>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="给自己起个名字"
                    maxLength={50}
                    className="input-prismatic pl-10"
                  />
                </div>
              </Field>

              {/* Gender */}
              <Field label="性别" required>
                <div className="flex gap-3">
                  {GENDER_OPTIONS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value as 'male' | 'female')}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        gender === g.value
                          ? 'border-prism-blue bg-prism-blue/10 text-prism-blue'
                          : 'border-border-subtle text-text-secondary hover:border-border-medium'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Province */}
              <Field label="所在省份" required>
                <div className="relative">
                  <div
                    className="input-prismatic pl-3 pr-10 flex items-center cursor-pointer"
                    onClick={() => setShowProvinceMenu(!showProvinceMenu)}
                  >
                    <span className={province ? 'text-text-primary' : 'text-text-muted'}>
                      {province || '选择你所在的省份或直辖市'}
                    </span>
                  </div>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  {showProvinceMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowProvinceMenu(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-60 overflow-y-auto rounded-xl border border-border-subtle bg-bg-elevated shadow-xl">
                        {PROVINCES.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => { setProvince(p); setShowProvinceMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-bg-surface transition-colors ${
                              province === p ? 'text-prism-blue bg-prism-blue/5' : 'text-text-primary'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Field>

              {/* Email */}
              <Field label="邮箱地址" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input-prismatic pl-10"
                  />
                </div>
              </Field>

              {/* Password */}
              <Field label="密码（至少8位）" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="设置登录密码"
                    className="input-prismatic pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {/* Confirm Password */}
              <Field label="确认密码" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="input-prismatic pl-10"
                  />
                  {confirmPassword && (
                    <Check className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      password === confirmPassword ? 'text-green-400' : 'text-red-400'
                    }`} />
                  )}
                </div>
              </Field>

              {/* Agreement */}
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                    agreed ? 'bg-prism-blue border-prism-blue' : 'border-border-subtle hover:border-prism-blue/50'
                  }`}
                >
                  {agreed && <Check className="w-3 h-3 text-white" />}
                </button>
                <p className="text-xs text-text-muted leading-relaxed">
                  我已阅读并同意
                  <Link href="/terms" className="text-prism-blue hover:underline mx-1">《使用条款》</Link>
                  和
                  <Link href="/privacy" className="text-prism-blue hover:underline mx-1">《隐私政策》</Link>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading || sendingCode ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    获取验证码
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: Verify ── */}
          {step === 'verify' && (
            <form onSubmit={handleSubmitVerify} className="space-y-4">
              {error && <ErrorMsg msg={error} />}

              <div className="p-4 rounded-xl bg-prism-blue/5 border border-prism-blue/20">
                <p className="text-sm text-text-secondary mb-1">验证码已发送至</p>
                <p className="text-sm font-medium text-text-primary">{email}</p>
                <p className="text-xs text-text-muted mt-1">请查看邮箱，验证码10分钟内有效</p>
              </div>

              <Field label="验证码" required>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    className="input-prismatic pl-3 text-center text-lg tracking-widest font-mono"
                    autoFocus
                  />
                </div>
              </Field>

              <button
                type="submit"
                disabled={isLoading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    完成注册
                  </>
                )}
              </button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-text-muted">
                    <span className="text-prism-blue">{countdown}</span> 秒后可重新获取
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={sendingCode}
                    className="text-xs text-prism-blue hover:underline disabled:opacity-50"
                  >
                    {sendingCode ? '发送中...' : '重新获取验证码'}
                  </button>
                )}
                <span className="mx-2 text-text-muted">|</span>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setCode(''); setCodeSent(false); }}
                  className="text-xs text-text-muted hover:text-text-secondary"
                >
                  修改信息
                </button>
              </div>
            </form>
          )}

          {/* Footer links */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-bg-base text-text-muted">已有账号？</span>
            </div>
          </div>

          <Link
            href="/auth/signin"
            className="block w-full text-center py-2.5 rounded-xl border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all font-medium"
          >
            登录
          </Link>
        </motion.div>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {msg}
    </motion.div>
  );
}
