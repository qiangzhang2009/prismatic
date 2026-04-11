'use client';

/**
 * Prismatic — Sign In Page
 * GitHub OAuth + Hidden demo account access
 * Demo accounts are provided privately — not prominently displayed.
 */

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Sparkles, Github, X, ArrowRight } from 'lucide-react';
import { APP_NAME, DEMO_ACCOUNTS } from '@/lib/constants';

export default function SignInPage() {
  const [showDemo, setShowDemo] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGitHubSignIn = () => {
    setIsLoading(true);
    signIn('github', { callbackUrl: '/app' });
  };

  const handleDemoSignIn = async () => {
    if (!selectedDemo) return;
    setIsLoading(true);
    setError('');

    const account = DEMO_ACCOUNTS.find(a => a.email === selectedDemo);
    if (!account) {
      setError('请选择一个账号');
      setIsLoading(false);
      return;
    }

    const result = await signIn('demo-account', {
      email: account.email,
      password: account.password,
      redirect: false,
    });

    if (result?.error) {
      setError('登录失败，请稍后重试');
      setIsLoading(false);
    } else {
      window.location.href = '/app';
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
          <span className="font-display font-semibold gradient-text">{APP_NAME}</span>
        </Link>
        <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          返回首页
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="relative inline-block mb-4">
              <Hexagon className="w-16 h-16 text-prism-blue" strokeWidth={1} />
              <Sparkles className="w-5 h-5 text-prism-purple absolute -top-2 -right-2" />
            </div>
            <h1 className="text-2xl font-display font-bold gradient-text mb-2">登录 Prismatic</h1>
            <p className="text-sm text-text-secondary">折射之光 · 与卓越思考者对话</p>
          </div>

          {/* GitHub login */}
          <div className="space-y-4">
            <button
              onClick={handleGitHubSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 bg-[#24292e] hover:bg-[#2f363d] text-white font-medium transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Github className="w-5 h-5" />
              )}
              <span>{isLoading ? '跳转中...' : '使用 GitHub 登录'}</span>
            </button>

            {/* Hidden demo account access */}
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors py-1"
            >
              {showDemo ? '收起体验账号' : '有体验账号？'}
            </button>
          </div>

          {/* Demo account panel */}
          <AnimatePresence>
            {showDemo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">选择体验账号</p>
                    <button onClick={() => setShowDemo(false)} className="text-text-muted hover:text-text-primary">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button
                        key={account.email}
                        onClick={() => setSelectedDemo(account.email)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          selectedDemo === account.email
                            ? 'border-prism-blue bg-prism-blue/10 text-text-primary'
                            : 'border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border-medium'
                        }`}
                      >
                        <span className="font-medium">{account.label}</span>
                        <span className="ml-2 text-text-muted">{account.email}</span>
                      </button>
                    ))}
                  </div>

                  {selectedDemo && (
                    <button
                      onClick={handleDemoSignIn}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 bg-prism-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>登录</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}

                  {error && (
                    <p className="text-xs text-red-500 text-center">{error}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer links */}
          <div className="mt-10 space-y-2 text-center">
            <Link href="/personas" className="block text-sm text-prism-blue hover:underline">
              先看看 {40}+ 蒸馏人物
            </Link>
            <Link href="/methodology" className="block text-sm text-prism-blue hover:underline">
              了解方法论
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
