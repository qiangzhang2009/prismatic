'use client';

/**
 * Prismatic — Client-side Auth Store
 *
 * Design principle: user identity lives in two places only:
 *   1. prismatic_token cookie  (httpOnly, sent with every request)
 *   2. Zustand store in memory (session only, never persisted)
 *
 * Why no localStorage persist for user?
 *   - Admin changes (role/plan/credits) must be reflected immediately
 *   - Stale localStorage data causes the "admin updates don't show" bug
 *   - Token auth is inherently stateless; the server is always authoritative
 */

import { create } from 'zustand';

export type UserRole = 'FREE' | 'PRO' | 'ADMIN';
export type SubscriptionPlan = 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  emailVerified: boolean;
  role: UserRole;
  plan: SubscriptionPlan;
  credits: number;
  avatar: string | null;
  canUseProFeatures: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string, gender?: string, province?: string, code?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
  fetchUser: () => Promise<void>;
  refresh: () => Promise<void>;
  canUsePro: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  init: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      set({ user: data.user || null, isLoading: false, isInitialized: true });
    } catch {
      set({ isLoading: false, isInitialized: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.error || 'Login failed' };
      }

      // Also fetch full user from /api/auth/me so we have complete data
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      const meData = await meRes.json();
      set({ user: meData.user || data.user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false });
      return { success: false, error: 'Network error' };
    }
  },

  register: async (email: string, password: string, name?: string, gender?: string, province?: string, code?: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, gender, province, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.error || '注册失败' };
      }

      // Also fetch full user so we have complete data
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      const meData = await meRes.json();
      set({ user: meData.user || data.user, isLoading: false });
      return { success: true };
    } catch {
      set({ isLoading: false });
      return { success: false, error: '网络错误' };
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // best-effort
    }
    set({ user: null, isInitialized: true });
  },

  updateUser: (data: Partial<AuthUser>) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...data } });
    }
  },

  fetchUser: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      set({ user: data.user || null });
    } catch {
      // ignore
    }
  },

  refresh: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      set({ user: data.user || null });
    } catch {
      // ignore
    }
  },

  canUsePro: () => {
    const user = get().user;
    return user?.canUseProFeatures ?? false;
  },
}));

// ─── Permission Helpers ────────────────────────────────────────────────────────

export function getFeatureLimit(plan: SubscriptionPlan): {
  dailyMessages: number;
  personaCount: number;
  exportEnabled: boolean;
  priority: boolean;
  customPersona: boolean;
} {
  switch (plan) {
    case 'FREE':
      return {
        dailyMessages: 10,
        personaCount: 3,
        exportEnabled: false,
        priority: false,
        customPersona: false,
      };
    case 'MONTHLY':
    case 'YEARLY':
    case 'LIFETIME':
      return {
        dailyMessages: 999999,
        personaCount: 999999,
        exportEnabled: true,
        priority: true,
        customPersona: true,
      };
    default:
      return {
        dailyMessages: 20,
        personaCount: 3,
        exportEnabled: false,
        priority: false,
        customPersona: false,
      };
  }
}

export function canUseFeature(plan: SubscriptionPlan, feature: keyof ReturnType<typeof getFeatureLimit>): boolean {
  const limits = getFeatureLimit(plan);
  return (limits as any)[feature] === true || typeof (limits as any)[feature] === 'number';
}
