'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Hexagon, Sparkles } from 'lucide-react';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  OAuthSignin: {
    title: 'OAuth 登录错误',
    description: '无法启动 OAuth 登录流程，请重试。',
  },
  OAuthCallback: {
    title: 'OAuth 回调错误',
    description: 'OAuth 回调处理失败，请重试。',
  },
  OAuthCreateAccount: {
    title: '账号创建失败',
    description: '无法创建账号，请联系管理员。',
  },
  Callback: {
    title: '回调错误',
    description: '登录回调处理失败，请重试。',
  },
  AccountNotLinked: {
    title: '账号未关联',
    description: '此邮箱已被其他登录方式使用，请尝试原始登录方式。',
  },
  CredentialsSignin: {
    title: '登录失败',
    description: '邮箱或密码错误，请检查后重试。',
  },
  default: {
    title: '认证错误',
    description: '发生未知错误，请重试。',
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') ?? 'default';
  const errorInfo = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default;

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>

        <div className="relative inline-block mb-6">
          <Hexagon className="w-12 h-12 text-prism-blue" strokeWidth={1} />
          <Sparkles className="w-4 h-4 text-prism-purple absolute -top-1 -right-1" />
        </div>

        <h1 className="text-2xl font-display font-bold gradient-text mb-2">
          {errorInfo.title}
        </h1>
        <p className="text-text-secondary mb-8">
          {errorInfo.description}
        </p>

        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full rounded-xl px-6 py-3.5 bg-prism-gradient text-white font-medium transition-all hover:opacity-90"
          >
            重新登录
          </Link>
          <Link
            href="/"
            className="block w-full rounded-xl px-6 py-3.5 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-medium transition-colors"
          >
            返回首页
          </Link>
        </div>

        {error !== 'default' && (
          <p className="mt-8 text-xs text-text-muted">
            Error: {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
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
        <AuthErrorContent />
      </Suspense>
    </div>
  );
}
