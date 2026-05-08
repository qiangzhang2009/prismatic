'use client';

/**
 * Shared daily limit hook for both persona chat and TCM chat.
 * Mirrors the logic in chat-interface.tsx so both UIs show identical quota behavior.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, getFeatureLimit } from '@/lib/auth-store';
import type { SubscriptionPlan } from '@/lib/auth-store';

export const DAILY_LIMIT_KEY = 'prismatic-daily-messages';
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyCount {
  count: number;
  dayStart: number;
}

function getDayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function getDailyCount(): DailyCount {
  try {
    const raw = localStorage.getItem(DAILY_LIMIT_KEY);
    if (!raw) return { count: 0, dayStart: getDayStart() };
    const data = JSON.parse(raw) as DailyCount;
    const today = getDayStart();
    if (data.dayStart !== today) {
      localStorage.removeItem(DAILY_LIMIT_KEY);
      return { count: 0, dayStart: today };
    }
    return data;
  } catch {
    return { count: 0, dayStart: getDayStart() };
  }
}

export function saveDailyCount(count: number) {
  try {
    localStorage.setItem(DAILY_LIMIT_KEY, JSON.stringify({
      count,
      dayStart: getDayStart(),
    }));
  } catch {}
}

export function useDailyLimit() {
  const user = useAuthStore(s => s.user);
  const isInitialized = useAuthStore(s => s.isInitialized);
  const refreshUser = useAuthStore(s => s.refresh);

  const plan = user?.plan ?? 'FREE';
  const credits = user?.credits ?? 0;      // 充值积分
  const dailyCredits = user?.dailyCredits ?? 0;  // 每日积分
  const limits = getFeatureLimit(plan);
  const isPaid = limits.dailyMessages >= 9999;
  // 有任何积分（每日+充值）
  const hasCredits = credits > 0 || dailyCredits > 0;
  const dailyLimit = limits.dailyMessages;

  const [dailyCount, setDailyCount] = useState<number>(() => {
    if (isPaid || hasCredits) return 0;
    return getDailyCount().count;
  });

  // 当用户数据加载完成且有积分时，重置 localStorage 计数为 0
  // 这确保页面加载时显示真实积分而不是旧的 localStorage 值
  useEffect(() => {
    if (isInitialized && hasCredits && dailyCount > 0) {
      // 有积分的用户不应该使用 localStorage 计数
      setDailyCount(0);
      saveDailyCount(0);
    }
  }, [isInitialized, hasCredits]);

  // 真正的额度用完：没有付费、没有积分且 localStorage 计数已达上限
  const limitReached = !isPaid && !hasCredits && dailyCount >= dailyLimit;
  // 积分已耗尽
  const creditsExhausted = credits <= 0 && dailyCredits <= 0;
  // 显示剩余：优先显示每日积分，每日积分用完则显示充值积分
  const dailyRemaining = isPaid ? '∞' : dailyCredits > 0 ? String(dailyCredits) : credits > 0 ? String(credits) : Math.max(0, dailyLimit - dailyCount);

  // Increment and persist count (called after a successful message)
  const incrementCount = useCallback(() => {
    if (isPaid || hasCredits) return;
    const { count } = getDailyCount();
    const next = count + 1;
    saveDailyCount(next);
    setDailyCount(next);
  }, [isPaid, hasCredits]);

  // Expose setDailyCount so callers can sync server-authoritative count.
  // CRITICAL: calling setDailyCount here causes immediate re-render, so the
  // pre-check on the next render sees the updated count. Without this, the
  // UI shows stale localStorage data (from before server sync) and the
  // pre-check allows one extra message before the 429 fires.
  const syncDailyCount = useCallback((count: number) => {
    saveDailyCount(count);
    setDailyCount(count);
  }, []);

  // Re-check on midnight / storage change
  useEffect(() => {
    if (isPaid || hasCredits) return;
    const check = () => {
      const { count } = getDailyCount();
      setDailyCount(count);
    };
    // Check every minute for midnight rollover
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [isPaid, hasCredits]);

  // Re-check when user changes
  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  return {
    plan,
    credits,
    isPaid,
    hasCredits,
    dailyLimit,
    dailyCount,
    dailyRemaining,
    limitReached,
    creditsExhausted,
    incrementCount,
    syncDailyCount,
  };
}
