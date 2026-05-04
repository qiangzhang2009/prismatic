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
  const refreshUser = useAuthStore(s => s.refresh);

  const plan = user?.plan ?? 'FREE';
  const credits = user?.credits ?? 0;
  const limits = getFeatureLimit(plan);
  const isPaid = limits.dailyMessages >= 9999;
  const hasCredits = credits > 0;
  const dailyLimit = limits.dailyMessages;

  const [dailyCount, setDailyCount] = useState<number>(() => {
    if (isPaid || hasCredits) return 0;
    return getDailyCount().count;
  });

  const limitReached = !isPaid && !hasCredits && dailyCount >= dailyLimit;
  const creditsExhausted = credits <= 0;
  const dailyRemaining = isPaid ? '∞' : hasCredits
    ? String(credits)
    : Math.max(0, dailyLimit - dailyCount);

  // Increment and persist count (called after a successful message)
  const incrementCount = useCallback(() => {
    if (isPaid || hasCredits) return;
    const { count } = getDailyCount();
    const next = count + 1;
    saveDailyCount(next);
    setDailyCount(next);
  }, [isPaid, hasCredits]);

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
  };
}
