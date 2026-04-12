'use client';

/**
 * Prismatic — User Menu Component (Auth Mode)
 * Supports both guest mode and full authentication
 */

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  User,
  Settings,
  ChevronDown,
  Bookmark,
  History,
  Info,
  LogOut,
  LogIn,
  UserPlus,
  Shield,
  Crown,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

export function UserMenu() {
  const { user, logout, isInitialized } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const planLabel = user?.plan === 'FREE' ? '免费用户' 
    : user?.plan === 'MONTHLY' ? '月度会员' 
    : user?.plan === 'YEARLY' ? '年度会员' 
    : user?.plan === 'LIFETIME' ? '终身会员' 
    : '免费用户';

  const planColor = user?.plan === 'FREE' ? 'text-text-muted'
    : user?.role === 'ADMIN' ? 'text-prism-purple'
    : 'text-amber-400';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-bg-elevated transition-colors"
        aria-label="用户菜单"
      >
        {user ? (
          <>
            {user.avatar ? (
              <Image unoptimized src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" width={32} height={32} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-prism-gradient flex items-center justify-center text-white text-sm font-medium">
                {user.name?.[0] || user.email[0].toUpperCase()}
              </div>
            )}
            {user.plan !== 'FREE' && (
              <Crown className="w-3.5 h-3.5 text-amber-400 -ml-1" />
            )}
          </>
        ) : (
          <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
            <User className="w-4 h-4 text-text-muted" />
          </div>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-text-muted transition-transform hidden sm:block',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 origin-top-right z-50"
          >
            <div className="rounded-xl border border-border-subtle bg-bg-elevated shadow-lg overflow-hidden">
              {user ? (
                <>
                  {/* Authenticated user info */}
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <Image unoptimized src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" width={40} height={40} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-prism-gradient flex items-center justify-center text-white font-medium">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {user.name || user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-text-muted truncate">{user.email}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {user.role === 'ADMIN' && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-prism-purple bg-prism-purple/10 px-1.5 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3" />
                              管理员
                            </span>
                          )}
                          {user.plan !== 'FREE' && user.role !== 'ADMIN' && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              <Crown className="w-3 h-3" />
                              {planLabel}
                            </span>
                          )}
                          {user.plan === 'FREE' && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-text-muted">
                              <Shield className="w-3 h-3" />
                              免费用户
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <MenuItem icon={History} label="历史对话" href="/app" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Bookmark} label="收藏人物" href="/personas" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Settings} label="账号设置" href="/settings" onClick={() => setIsOpen(false)} />
                    
                    {user.role === 'ADMIN' && (
                      <>
                        <div className="h-px bg-border-subtle my-1" />
                        <MenuItem icon={ShieldCheck} label="用户管理" href="/admin/users" onClick={() => setIsOpen(false)} />
                        <MenuItem icon={Shield} label="系统概览" href="/admin" onClick={() => setIsOpen(false)} />
                      </>
                    )}
                    
                    <div className="h-px bg-border-subtle my-1" />
                    
                    <MenuItem icon={Info} label="关于 Prismatic" href="/#about" onClick={() => setIsOpen(false)} />
                    
                    {user.plan === 'FREE' && (
                      <div className="px-4 py-3 mx-2 my-1 rounded-lg bg-gradient-to-r from-amber-500/10 to-prism-purple/10 border border-amber-500/20">
                        <p className="text-xs text-text-secondary mb-1.5">
                          <Crown className="w-3 h-3 inline mr-1 text-amber-400" />
                          升级到高级版
                        </p>
                        <p className="text-xs text-text-muted mb-2">
                          联系我们开通
                        </p>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Guest user info */}
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                        <User className="w-5 h-5 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">访客</p>
                        <p className="text-xs text-text-muted">免费体验，无需注册</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <MenuItem icon={History} label="历史对话" href="/app" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Bookmark} label="收藏人物" href="/personas" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Info} label="关于 Prismatic" href="/#about" onClick={() => setIsOpen(false)} />
                    
                    <div className="h-px bg-border-subtle my-1" />
                    
                    <div className="px-4 py-2">
                      <p className="text-xs text-text-muted mb-2">
                        注册后可保存对话历史，享受高级功能
                      </p>
                      <div className="space-y-2">
                        <Link
                          href="/auth/signin"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-center gap-2 w-full text-sm font-medium border border-border-subtle rounded-lg py-2 hover:bg-bg-surface transition-colors text-text-primary"
                        >
                          <LogIn className="w-4 h-4" />
                          登录
                        </Link>
                        <Link
                          href="/auth/signup"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-center gap-2 w-full text-sm font-medium bg-prism-gradient text-white rounded-lg py-2 hover:opacity-90 transition-all"
                        >
                          <UserPlus className="w-4 h-4" />
                          免费注册
                        </Link>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const handleClick = () => { onClick?.(); };

  if (href) {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/**
 * Compact sign-in button (for compatibility)
 */
export function SignInButton() {
  return (
    <Link
      href="/auth/signin"
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-prism-gradient text-white hover:opacity-90 transition-all"
    >
      <User className="w-4 h-4" />
      登录 / 注册
    </Link>
  );
}
