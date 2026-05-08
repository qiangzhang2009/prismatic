'use client';

/**
 * Prismatic — User Menu Component (Auth Mode)
 * Supports both guest mode and full authentication
 * Shows user identity, permissions, and remaining daily quota
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  MessageSquare,
  Zap,
  Calendar,
  TrendingUp,
  ChevronRight,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

// Daily message limit configuration — must match USER_DAILY_LIMIT in message-stats.ts
const DAILY_LIMIT = 20;

// 积分信息缓存（避免频繁请求）
interface CachedPointsInfo {
  totalPoints: number;
  dailyPoints: number;
  paidPoints: number;
  timestamp: number;
}
let cachedPoints: CachedPointsInfo | null = null;
const POINTS_CACHE_TTL = 30000; // 30秒缓存

// 从 API 获取真实积分
async function fetchRealPoints(): Promise<{ total: number; daily: number; paid: number }> {
  try {
    const response = await fetch('/api/points/check', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      return {
        total: data.totalPoints || 0,
        daily: data.dailyPoints || 0,
        paid: data.paidPoints || 0,
      };
    }
  } catch (e) {
    console.error('[user-menu] Failed to fetch points:', e);
  }
  return { total: 0, daily: 0, paid: 0 };
}

// 获取积分信息（带缓存）
async function getPointsInfo(): Promise<{ total: number; daily: number; paid: number; remaining: number }> {
  const now = Date.now();
  if (cachedPoints && (now - cachedPoints.timestamp) < POINTS_CACHE_TTL) {
    return {
      total: cachedPoints.totalPoints,
      daily: cachedPoints.dailyPoints,
      paid: cachedPoints.paidPoints,
      remaining: cachedPoints.totalPoints,
    };
  }

  const points = await fetchRealPoints();
  cachedPoints = {
    totalPoints: points.total,
    dailyPoints: points.daily,
    paidPoints: points.paid,
    timestamp: now,
  };

  return {
    total: points.total,
    daily: points.daily,
    paid: points.paid,
    remaining: points.total,
  };
}

// 获取每日消息计数（用于本地追踪）
function getDailyCount(): { count: number; remaining: number; resetDate: string } {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const savedDate = localStorage.getItem(DAILY_DATE_KEY);

    let count = 0;
    if (savedDate !== today) {
      localStorage.setItem(DAILY_LIMIT_KEY, '0');
      localStorage.setItem(DAILY_DATE_KEY, today);
    } else {
      count = parseInt(localStorage.getItem(DAILY_LIMIT_KEY) ?? '0', 10);
    }

    return {
      count,
      remaining: Math.max(0, DAILY_LIMIT - count),
      resetDate: today,
    };
  } catch {
    return { count: 0, remaining: DAILY_LIMIT, resetDate: '' };
  }
}

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ total: 0, daily: 0, paid: 0, remaining: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle hydration - localStorage is not available during SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // 菜单打开时刷新积分信息
  useEffect(() => {
    if (isOpen && user) {
      getPointsInfo().then(setPointsInfo);
    }
  }, [isOpen, user]);

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
    window.location.href = '/';
  };

  // Plan labels and info
  const planInfo = {
    FREE: {
      label: '免费用户',
      color: 'text-text-muted',
      bg: 'bg-bg-surface',
      features: ['每日 10 条消息', '全部思想家角色', '所有对话模式'],
      upgrade: true,
    },
    MONTHLY: {
      label: '月度会员',
      color: 'text-prism-blue',
      bg: 'bg-prism-blue/10',
      features: ['每日无限消息', '全部人物角色', '优先响应'],
      upgrade: false,
    },
    YEARLY: {
      label: '年度会员',
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      features: ['每日无限消息', '全部人物角色', '优先响应', '年费优惠'],
      upgrade: false,
    },
    LIFETIME: {
      label: '终身会员',
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      features: ['每日无限消息', '全部人物角色', '优先响应', '永久会员'],
      upgrade: false,
    },
  };

  const currentPlan = user?.plan ? planInfo[user.plan as keyof typeof planInfo] : null;

  // Role labels
  const roleLabels: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    ADMIN: { label: '管理员', color: 'text-prism-purple', icon: ShieldCheck },
    PRO: { label: '高级用户', color: 'text-amber-400', icon: Star },
    FREE: { label: '普通用户', color: 'text-text-muted', icon: User },
  };

  // Handle hydration - show placeholder until mounted to prevent mismatch
  if (!mounted) {
    return (
      <div className="flex items-center gap-2 p-1.5 rounded-full">
        <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border-subtle" />
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button only — portal renders dropdown to body */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && user) {
            // 打开菜单时获取真实积分
            getPointsInfo().then(setPointsInfo);
          }
        }}
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

      {/* Portal: render dropdown to body to avoid z-index stacking context issues */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed right-6 top-[68px] w-80 origin-top-right z-[9999]"
              style={{ position: 'fixed' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-xl border border-border-subtle bg-bg-elevated shadow-xl shadow-black/30 overflow-hidden">
              {user ? (
                <>
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-border-subtle bg-gradient-to-r from-transparent via-bg-surface/50 to-transparent">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <Image unoptimized src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-border-subtle" width={48} height={48} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-prism-gradient flex items-center justify-center text-white text-lg font-medium ring-2 ring-border-subtle">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-text-primary truncate">
                          {user.name || user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-text-muted truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {/* Role Badge */}
                          {user.role === 'ADMIN' && (
                            <span className="inline-flex items-center gap-1 text-xs text-prism-purple bg-prism-purple/10 px-2 py-0.5 rounded-full font-medium">
                              <ShieldCheck className="w-3 h-3" />
                              管理员
                            </span>
                          )}
                          {user.role === 'PRO' && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium">
                              <Star className="w-3 h-3" />
                              高级用户
                            </span>
                          )}
                          {user.role === 'FREE' && (
                            <span className="inline-flex items-center gap-1 text-xs text-text-muted bg-bg-surface px-2 py-0.5 rounded-full">
                              <User className="w-3 h-3" />
                              普通用户
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Points Section - 真实积分显示 */}
                  <div className="px-4 py-3 border-b border-border-subtle bg-gradient-to-b from-transparent to-bg-surface/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-prism-blue" />
                        <span className="text-sm font-medium text-text-primary">剩余积分</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-sm font-bold",
                          pointsInfo.total > 5 ? 'text-prism-blue' : 'text-amber-400'
                        )}>
                          {pointsInfo.total}
                        </span>
                        <span className="text-xs text-text-muted">积分</span>
                      </div>
                    </div>
                    {/* 积分明细 */}
                    <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-prism-blue/60" />
                        每日: {pointsInfo.daily}
                      </span>
                      {pointsInfo.paid > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400/60" />
                          充值: {pointsInfo.paid}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pointsInfo.total > 5 ? 'bg-prism-blue' : 'bg-amber-400'
                        )}
                        style={{ width: `${Math.min((pointsInfo.total / DAILY_LIMIT) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      每天 00:00 重置 20 积分
                    </p>
                    {pointsInfo.total <= 5 && pointsInfo.total > 0 && (
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        积分不足？充值可继续使用
                      </p>
                    )}
                    {pointsInfo.total === 0 && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        积分已用完，请明天再来或充值
                      </p>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <MenuItem icon={History} label="历史对话" href="/conversations" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Bookmark} label="收藏人物" href="/bookmarks" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Settings} label="账号设置" href="/settings" onClick={() => setIsOpen(false)} />

                    {user.role === 'ADMIN' && (
                      <>
                        <div className="h-px bg-border-subtle my-1" />
                        <MenuItem icon={ShieldCheck} label="管理后台" href="/admin" onClick={() => setIsOpen(false)} />
                      </>
                    )}

                    <div className="h-px bg-border-subtle my-1" />

                    <MenuItem icon={Info} label="关于 Prismatic" href="/#about" onClick={() => setIsOpen(false)} />

                    {user.plan === 'FREE' && (
                      <div className="px-4 py-3 mx-2 my-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-prism-purple/10 border border-amber-500/20">
                        <p className="text-xs text-text-secondary mb-1.5">
                          <Crown className="w-3 h-3 inline mr-1 text-amber-400" />
                          升级到高级版
                        </p>
                        <p className="text-xs text-text-muted mb-2">
                          无限对话 + 全部人物角色
                        </p>
                        <a
                          href="/contact"
                          className="text-xs text-prism-blue hover:underline flex items-center gap-1"
                          onClick={() => setIsOpen(false)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          联系我们
                          <ChevronRight className="w-3 h-3" />
                        </a>
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
                  {/* Guest User Info */}
                  <div className="px-4 py-3 border-b border-border-subtle bg-gradient-to-r from-transparent via-bg-surface/30 to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                        <User className="w-6 h-6 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-text-primary">访客</p>
                        <p className="text-xs text-text-muted">免费体验，无需注册</p>
                      </div>
                    </div>
                  </div>

                  {/* Guest Quota Info */}
                  <div className="px-4 py-3 border-b border-border-subtle bg-gradient-to-b from-transparent to-bg-surface/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-prism-blue" />
                        <span className="text-sm font-medium text-text-primary">今日对话额度</span>
                      </div>
                      <span className="text-sm font-bold text-prism-blue">{DAILY_LIMIT} 条</span>
                    </div>
                    <p className="text-xs text-text-muted">
                      注册登录后可保存对话历史，享受高级功能
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <MenuItem icon={History} label="历史对话" href="/conversations" onClick={() => setIsOpen(false)} />
                    <MenuItem icon={Bookmark} label="收藏人物" href="/bookmarks" onClick={() => setIsOpen(false)} />
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
      </AnimatePresence>,
      document.body
    )}
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
