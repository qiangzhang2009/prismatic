'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Hexagon, Sparkles, GitBranch, Leaf, Menu, X, Brain, Library } from 'lucide-react';
import { UserMenu } from '@/components/user-menu';
import { APP_NAME } from '@/lib/constants';

const NAV_LINKS = [
  { href: '/library', label: '智慧导师', mdOnly: true, amber: true },
  { href: '/personas', label: '人物档案馆', mdOnly: true },
  { href: '/graph', label: '认知图谱', lgOnly: true },
  { href: '/tcm-atlas', label: '中医图谱', mdOnly: true, emerald: true },
  { href: '/methodology', label: '蒸馏方法论', mdOnly: true },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="z-50 glass border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <Hexagon className="w-8 h-8 text-prism-blue" strokeWidth={1.5} />
            <Sparkles className="w-3 h-3 text-prism-purple absolute -top-0.5 -right-0.5" />
          </div>
          <span className="font-display font-bold text-lg gradient-text">{APP_NAME}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                link.amber
                  ? 'text-[#f59e0b]/70 hover:text-[#f59e0b] flex items-center gap-1'
                  : link.emerald
                  ? 'text-text-secondary hover:text-emerald-400 flex items-center gap-1'
                  : 'text-text-secondary hover:text-text-primary flex items-center gap-1'
              }`}
            >
              {link.href === '/tcm-atlas' && <Leaf className="w-3.5 h-3.5" />}
              {link.href === '/graph' && <GitBranch className="w-3.5 h-3.5" />}
              {link.href === '/library' && <Library className="w-3.5 h-3.5" />}
              {link.label}
            </Link>
          ))}
          <Link
            href="/tcm-assistant"
            className="text-sm text-[#c9a84c] hover:text-[#b8963e] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20 transition-all border border-[#c9a84c]/20 hover:border-[#c9a84c]/40"
          >
            <Brain className="w-3.5 h-3.5" />
            中医助手
          </Link>
          <Link
            href="/app"
            className="text-sm bg-prism-gradient text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            开始体验
          </Link>
          <div className="pl-2 border-l border-border-subtle">
            <UserMenu />
          </div>
        </div>

        {/* Mobile: hamburger + CTA */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            href="/app"
            className="text-sm bg-prism-gradient text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            开始体验
          </Link>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="菜单"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-text-secondary" />
            ) : (
              <Menu className="w-5 h-5 text-text-secondary" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-md">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-6 py-3 text-sm border-b border-white/5 transition-colors ${
                link.amber
                  ? 'text-[#f59e0b]/70 hover:text-[#f59e0b] hover:bg-white/5'
                  : link.emerald
                  ? 'text-emerald-400 hover:bg-white/5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {link.href === '/tcm-atlas' && <Leaf className="w-4 h-4" />}
              {link.href === '/graph' && <GitBranch className="w-4 h-4" />}
              {link.href === '/library' && <Library className="w-4 h-4" />}
              {link.label}
            </Link>
          ))}
          <Link
            href="/tcm-assistant"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-6 py-3 text-sm border-b border-white/5 transition-colors text-[#c9a84c] hover:bg-white/5"
          >
            <Brain className="w-4 h-4" />
            中医AI助手
          </Link>
        </div>
      )}
    </nav>
  );
}
