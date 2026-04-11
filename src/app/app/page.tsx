/**
 * Prismatic — App Chat Page
 */

'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Hexagon, Sparkles, ArrowLeft } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import type { Mode } from '@/lib/types';

// Dynamic import to avoid SSR issues
const ChatInterface = dynamic(
  () => import('@/components/chat-interface').then((m) => m.ChatInterface),
  { ssr: false, loading: () => <ChatLoadingSkeleton /> }
);

function ChatLoadingSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated animate-pulse mb-4 mx-auto" />
        <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse mx-auto" />
      </div>
    </div>
  );
}

function AppPageFallback() {
  return (
    <div className="h-screen flex flex-col bg-bg-base">
      <header className="flex-shrink-0 px-4 h-14 flex items-center justify-between border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回首页</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
              <Sparkles className="w-2 h-2 text-prism-purple absolute -top-0.5 -right-0.5" />
            </div>
            <span className="font-display font-semibold text-sm gradient-text">{APP_NAME}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/personas" className="text-text-secondary hover:text-text-primary transition-colors">
            人物库
          </Link>
          <Link href="/methodology" className="text-text-secondary hover:text-text-primary transition-colors">
            方法论
          </Link>
          <Link href="/graph" className="text-text-secondary hover:text-text-primary transition-colors">
            图谱
          </Link>
        </div>
      </header>
      <ChatLoadingSkeleton />
    </div>
  );
}

function AppPageContent() {
  const searchParams = useSearchParams();

  const initialPersona = searchParams.get('persona') ?? undefined;
  const initialMode = (searchParams.get('mode') as Mode) ?? undefined;

  return (
    <div className="h-screen flex flex-col bg-bg-base">
      {/* App Header */}
      <header className="flex-shrink-0 px-4 h-14 flex items-center justify-between border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回首页</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
              <Sparkles className="w-2 h-2 text-prism-purple absolute -top-0.5 -right-0.5" />
            </div>
            <span className="font-display font-semibold text-sm gradient-text">{APP_NAME}</span>
          </div>
        </div>

        {/* App nav */}
        <div className="flex items-center gap-4 text-sm">
          <Link href="/personas" className="text-text-secondary hover:text-text-primary transition-colors">
            人物库
          </Link>
          <Link href="/methodology" className="text-text-secondary hover:text-text-primary transition-colors">
            方法论
          </Link>
          <Link href="/graph" className="text-text-secondary hover:text-text-primary transition-colors">
            图谱
          </Link>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          className="h-full"
          initialPersona={initialPersona}
          initialMode={initialMode}
        />
      </div>
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<AppPageFallback />}>
      <AppPageContent />
    </Suspense>
  );
}
