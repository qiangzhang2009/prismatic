'use client';

/**
 * Prismatic — Forgot Password Page
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Hexagon, Mail, ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || '验证码已发送到您的邮箱');
      } else {
        setStatus('error');
        setMessage(data.error || '发送失败，请稍后重试');
      }
    } catch {
      setStatus('error');
      setMessage('网络错误，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <header className="p-6">
        <Link href="/auth/signin" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回登录</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
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
            <p className="text-text-muted mt-2">重置密码</p>
          </div>

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 rounded-2xl border border-border-subtle bg-bg-elevated"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-lg font-medium text-text-primary mb-2">验证码已发送</h2>
              <p className="text-sm text-text-secondary mb-6">
                我们已向 <span className="font-medium">{email}</span> 发送了验证码，请查收邮件。
              </p>
              <p className="text-xs text-text-muted mb-4">
                没有收到邮件？请检查垃圾邮件文件夹，或确认邮箱地址是否正确。
              </p>
              <Link
                href="/auth/signin"
                className="text-sm text-prism-blue hover:underline"
              >
                返回登录
              </Link>
            </motion.div>
          ) : (
            <>
              {message && status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {message}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    注册邮箱
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue focus:ring-1 focus:ring-prism-blue/30 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {status === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      发送验证码
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 p-4 rounded-xl bg-bg-elevated border border-border-subtle">
                <h3 className="text-sm font-medium text-text-primary mb-2">没有收到邮件？</h3>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>· 检查邮箱地址是否正确</li>
                  <li>· 查看垃圾邮件/推广邮件文件夹</li>
                  <li>· 联系微信客服：3740977</li>
                </ul>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
