'use client';

/**
 * Prismatic — useAuthMe Hook
 *
 * Uses useEffect + fetch directly (no React Query) to guarantee
 * the latest data is always fetched from the server on every render.
 * React Query caching/staleTime settings in Providers are bypassed.
 *
 * This hook is the authoritative source for user data on pages where
 * real-time accuracy is required (e.g. Settings after admin changes).
 */

import { useState, useEffect, useRef } from 'react';

export interface AuthUserMe {
  id: string;
  email: string;
  name: string | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  emailVerified: boolean;
  role: 'FREE' | 'PRO' | 'ADMIN';
  plan: 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  credits: number;
  avatar: string | null;
  canUseProFeatures: boolean;
  isAdmin?: boolean;
}

export function useAuthMe() {
  const [user, setUser] = useState<AuthUserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  // Use ref to track mounted state and avoid state updates on unmounted component
  const mountedRef = useRef(true);
  // Use a counter to trigger refetches
  const fetchCountRef = useRef(0);

  function doFetch() {
    let cancelled = false;
    const currentCount = ++fetchCountRef.current;

    async function fetchUser() {
      if (cancelled || currentCount !== fetchCountRef.current) return;
      if (!mountedRef.current) return;

      setIsFetching(true);
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' });
        if (cancelled || currentCount !== fetchCountRef.current) return;
        if (!mountedRef.current) return;

        if (!res.ok) {
          console.log('[useAuthMe] /api/user/me returned', res.status);
          if (mountedRef.current) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const data = await res.json();
        if (cancelled || currentCount !== fetchCountRef.current) return;
        if (!mountedRef.current) return;

        const newUser = data.user || null;
        if (mountedRef.current) {
          setUser(newUser);
          setIsLoading(false);
          console.log('[useAuthMe] fetched user:', newUser?.role, newUser?.plan, newUser?.credits);
        }
      } catch (err) {
        if (cancelled || currentCount !== fetchCountRef.current) return;
        console.error('[useAuthMe] fetch error:', err);
        if (mountedRef.current) {
          setUser(null);
          setIsLoading(false);
        }
      } finally {
        if (currentCount === fetchCountRef.current && mountedRef.current) {
          setIsFetching(false);
        }
      }
    }

    fetchUser();
  }

  useEffect(() => {
    mountedRef.current = true;
    doFetch();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function refetch() {
    fetchCountRef.current++;
    doFetch();
  }

  return { data: user, isLoading, isFetching, refetch };
}

