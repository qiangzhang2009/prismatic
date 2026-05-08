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
  credits: number;        // 总积分 = dailyCredits + paidCredits
  dailyCredits?: number;  // 每日积分
  paidCredits?: number;   // 充值积分
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
    const currentUser = get().user;
    console.log('[auth] init: currentUser', currentUser ? `id=${currentUser.id} dailyCredits=${currentUser.dailyCredits}` : 'null');
    set({ isLoading: true });
    try {
      // Use /api/auth/me instead of /api/user/me because they may return different values
      // /api/auth/me returns correct dailyCredits from database
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newUser = data.user || null;
      console.log('[auth] init: server returned user', newUser ? `id=${newUser.id} dailyCredits=${newUser.dailyCredits} credits=${newUser.credits}` : 'null');
      
      // Always update with server data - server is authoritative
      set({ user: newUser, isLoading: false, isInitialized: true });
      console.log('[auth] init: UPDATED user, isInitialized=true');
      
      if (!newUser && !currentUser) {
        console.warn('[auth] init: /api/auth/me returned null user');
      }
    } catch (err) {
      console.error('[auth] init: failed to fetch user', err);
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

      // Log full user object for debugging
      console.log('[auth] login response data.user:', JSON.stringify(data.user));
      console.log('[auth] login response user.credits:', data.user?.credits, 'dailyCredits:', data.user?.dailyCredits, 'paidCredits:', data.user?.paidCredits);
      
      // Validate the user object has required fields
      if (data.user && typeof data.user.dailyCredits === 'undefined') {
        console.error('[auth] login: ERROR - dailyCredits is undefined in login response!');
      }
      
      // 必须设置 isInitialized 为 true，否则 ChatInterface 的 limitReached 判断会出错
      set({ user: data.user || null, isLoading: false, isInitialized: true });
      
      // Double-check the user was set correctly
      const setUser = get().user;
      console.log('[auth] login: after set, get().user.dailyCredits:', setUser?.dailyCredits, 'credits:', setUser?.credits);
      
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

      // Use user from register response directly — avoids /api/auth/me race.
      // 必须设置 isInitialized 为 true，否则 ChatInterface 的 limitReached 判断会出错
      set({ user: data.user || null, isLoading: false, isInitialized: true });
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
    } else if (data && Object.keys(data).length > 0) {
      set({ user: data as AuthUser });
    }
  },

  fetchUser: async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        console.warn('[auth] fetchUser: server returned', res.status, data);
        return;
      }
      const newUser = data.user || null;
      if (newUser) {
        set(state => {
          // 检查是否有变化（包括 dailyCredits）
          const changed = state.user
            ? JSON.stringify({ 
                role: state.user.role, 
                plan: state.user.plan, 
                credits: state.user.credits,
                dailyCredits: state.user.dailyCredits 
              })
            !== JSON.stringify({ 
                role: newUser.role, 
                plan: newUser.plan, 
                credits: newUser.credits,
                dailyCredits: newUser.dailyCredits 
              })
            : true;
          if (changed) {
            console.log('[auth] fetchUser: user data changed → updating store', {
              role: `${state.user?.role} → ${newUser.role}`,
              plan: `${state.user?.plan} → ${newUser.plan}`,
              credits: `${state.user?.credits} → ${newUser.credits}`,
              dailyCredits: `${state.user?.dailyCredits} → ${newUser.dailyCredits}`,
            });
          }
          return { user: newUser };
        });
      } else {
        set({ user: null });
      }
    } catch (err) {
      console.error('[auth] fetchUser: network error', err);
    }
  },

  refresh: async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        console.warn('[auth] refresh: server returned', res.status, data);
        return;
      }
      set({ user: data.user || null });
    } catch (err) {
      console.error('[auth] refresh: network error', err);
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
        dailyMessages: 20,
        personaCount: 3,
        exportEnabled: false,
        priority: false,
        customPersona: false,
      };
    case 'MONTHLY':
    case 'YEARLY':
    case 'LIFETIME':
      return {
        dailyMessages: 99999,
        personaCount: 99999,
        exportEnabled: true,
        priority: true,
        customPersona: true,
      };
  }
}

export function canUseFeature(plan: SubscriptionPlan, feature: keyof ReturnType<typeof getFeatureLimit>): boolean {
  const limits = getFeatureLimit(plan);
  return (limits as any)[feature] === true || typeof (limits as any)[feature] === 'number';
}
