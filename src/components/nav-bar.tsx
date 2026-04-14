'use client';

import Link from 'next/link';
import { Hexagon, Sparkles, GitBranch, GitCompare, Swords } from 'lucide-react';
import { UserMenu } from '@/components/user-menu';
import { APP_NAME } from '@/lib/constants';

export function NavBar() {
  return (
    <nav className="z-50 glass border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <Hexagon className="w-8 h-8 text-prism-blue" strokeWidth={1.5} />
            <Sparkles className="w-3 h-3 text-prism-purple absolute -top-0.5 -right-0.5" />
          </div>
          <span className="font-display font-bold text-lg gradient-text">{APP_NAME}</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link href="/personas" className="text-text-secondary hover:text-text-primary transition-colors text-sm hidden md:block">
            人物档案馆
          </Link>
          <Link href="/graph" className="text-text-secondary hover:text-text-primary transition-colors text-sm hidden lg:flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            认知图谱
          </Link>
          <Link href="/methodology" className="text-text-secondary hover:text-text-primary transition-colors text-sm hidden md:block">
            蒸馏方法论
          </Link>
          <Link
            href="/compare"
            className="flex items-center gap-1.5 text-text-secondary hover:text-prism-blue transition-colors text-sm hidden lg:flex items-center"
            title="跨视角对比 — 让多位思想家同时回答你的问题"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>跨视角对比</span>
          </Link>
          <Link
            href="/clash"
            className="flex items-center gap-1.5 text-text-secondary hover:text-amber-400 transition-colors text-sm hidden lg:flex items-center"
            title="关公战秦琼 — 让任意两位历史人物同台辩论"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>关公战秦琼</span>
          </Link>
          <Link href="/app" className="text-sm bg-prism-gradient text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
            开始体验
          </Link>
          <div className="pl-2 border-l border-border-subtle">
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
