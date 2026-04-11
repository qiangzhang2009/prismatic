'use client';

import { Suspense } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Mail, ArrowLeft, Hexagon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function SignInContent() {
  const [providers, setProviders] = useState<Record<string, any> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('邮箱或密码错误');
      } else {
        window.location.href = '/app';
      }
    } catch {
      setError('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: '/app' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <div className="relative inline-block">
          <Hexagon className="w-16 h-16 text-prism-blue" strokeWidth={1} />
          <Sparkles className="w-5 h-5 text-prism-purple absolute -top-2 -right-2" />
        </div>
        <h1 className="text-2xl font-display font-bold gradient-text mt-4">
          登录 Prismatic
        </h1>
        <p className="text-text-secondary mt-2">
          选择登录方式开始体验
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-3 mb-8">
        {providers?.github && (
          <button
            onClick={() => handleOAuthSignIn('github')}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 bg-[#24292e] text-white hover:bg-[#2f363d] transition-colors font-medium"
          >
            <Github className="w-5 h-5" />
            使用 GitHub 登录
          </button>
        )}

        {providers?.google && (
          <button
            onClick={() => handleOAuthSignIn('google')}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 登录
          </button>
        )}
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-subtle" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-bg-base text-text-muted">或使用邮箱登录</span>
        </div>
      </div>

      <form onSubmit={handleCredentialsSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full rounded-xl px-4 py-3 bg-bg-surface border border-border-subtle focus:border-prism-blue focus:ring-1 focus:ring-prism-blue outline-none transition-colors placeholder:text-text-muted"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full rounded-xl px-4 py-3 bg-bg-surface border border-border-subtle focus:border-prism-blue focus:ring-1 focus:ring-prism-blue outline-none transition-colors placeholder:text-text-muted"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'w-full rounded-xl px-6 py-3.5 bg-prism-gradient text-white font-medium transition-all',
            'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? '登录中...' : '登录'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        演示账号: demo@prismatic.app / demo123
      </p>
    </motion.div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <header className="p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>
      </header>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-prism-blue border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <SignInContent />
      </Suspense>
    </div>
  );
}
