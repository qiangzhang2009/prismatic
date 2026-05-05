'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Hexagon, Sparkles, GitBranch, Leaf, Menu, X, Brain, Library } from 'lucide-react';
import {
  User, Settings, Bookmark, History, Info,
  LogIn, UserPlus, ShieldCheck, Star, Crown,
  LogOut, ChevronRight, Zap,
} from 'lucide-react';
import { UserMenu } from '@/components/user-menu';
import { useAuthStore } from '@/lib/auth-store';
import { APP_NAME } from '@/lib/constants';

const NAV_LINKS = [
  { href: '/library', label: '智慧导师', mdOnly: true, amber: true },
  { href: '/personas', label: '人物档案馆', mdOnly: true },
  { href: '/graph', label: '认知图谱', lgOnly: true },
  { href: '/tcm-atlas', label: '中医图谱', mdOnly: true, emerald: true },
  { href: '/methodology', label: '蒸馏方法论', mdOnly: true },
];

// ─── Bookmark count badge ────────────────────────────────────────────────────
function BookmarkCount({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/bookmarks', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.bookmarks) setCount(d.bookmarks.length); })
      .catch(() => {});
  }, [user]);

  return (
    <>
      {children}
      {count > 0 && (
        <span className="ml-1 text-[10px] bg-amber-400/20 text-amber-400 rounded-full px-1.5 py-0.5 font-medium">
          {count}
        </span>
      )}
    </>
  );
}

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
          <BookmarkCount>
            <Link
              href="/bookmarks"
              className="text-sm text-text-secondary hover:text-amber-400 flex items-center gap-1"
            >
              <Bookmark className="w-3.5 h-3.5" />
              收藏
            </Link>
          </BookmarkCount>
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
          {/* Mobile: user account links — inline, no portal needed */}
          <div className="px-6 py-3 border-b border-white/5">
            <MobileUserSection onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Mobile User Section (inline, no portal) ────────────────────────────────────

const DAILY_LIMIT = 10;

function MobileUserSection({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuthStore();

  if (user) {
    return (
      <div>
        {/* User info header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-prism-gradient flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {user.name?.[0] || user.email[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.name || user.email.split('@')[0]}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          </div>
          {user.plan !== 'FREE' && (
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
        </div>

        {/* Role badge */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {user.role === 'ADMIN' && (
            <span className="inline-flex items-center gap-1 text-xs text-prism-purple bg-prism-purple/10 px-2 py-0.5 rounded-full font-medium">
              <ShieldCheck className="w-3 h-3" />管理员
            </span>
          )}
          {user.role === 'PRO' && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium">
              <Star className="w-3 h-3" />高级用户
            </span>
          )}
          {user.plan !== 'FREE' && (
            <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              <Crown className="w-3 h-3" />{user.plan === 'MONTHLY' ? '月度会员' : user.plan === 'YEARLY' ? '年度会员' : '终身会员'}
            </span>
          )}
        </div>

        {/* Menu links */}
        <div className="space-y-1">
          <MobileLink href="/app" icon={History} label="历史对话" onClose={onClose} />
          <MobileLink href="/bookmarks" icon={Bookmark} label="我的收藏" onClose={onClose} />
          <MobileLink href="/settings" icon={Settings} label="账号设置" onClose={onClose} />
          {user.role === 'ADMIN' && (
            <MobileLink href="/admin" icon={ShieldCheck} label="管理后台" onClose={onClose} />
          )}
          {user.plan === 'FREE' && (
            <div className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-prism-purple/10 border border-amber-500/20 mt-2">
              <p className="text-xs text-text-secondary mb-1">
                <Crown className="w-3 h-3 inline mr-1 text-amber-400" />升级高级版
              </p>
              <p className="text-xs text-text-muted mb-2">无限对话 + 全部人物角色</p>
              <a href="/contact" target="_blank" rel="noopener noreferrer" className="text-xs text-prism-blue hover:underline">联系我们 →</a>
            </div>
          )}
          <button
            onClick={async () => { await logout(); onClose(); window.location.href = '/'; }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>
    );
  }

  // Guest view
  return (
    <div>
      <p className="text-xs text-text-muted mb-3">免费体验，无需注册。注册登录后可保存对话历史，享受高级功能。</p>
      <div className="space-y-2">
        <Link
          href="/auth/signin"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full text-sm font-medium border border-border-subtle rounded-lg py-2.5 hover:bg-white/5 transition-colors text-text-primary"
        >
          <LogIn className="w-4 h-4" />
          登录
        </Link>
        <Link
          href="/auth/signup"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full text-sm font-medium bg-prism-gradient text-white rounded-lg py-2.5 hover:opacity-90 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          免费注册
        </Link>
      </div>
    </div>
  );
}

function MobileLink({
  href, icon: Icon, label, onClose,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 rounded-lg transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}
