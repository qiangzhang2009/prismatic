'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { TrackingInitializer } from '@/components/tracking-initializer';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer />
        <TrackingInitializer />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}

/**
 * Initialize auth state on every page load.
 *
 * Key insight: Zustand's persist middleware runs SYNCHRONOUSLY during hydration,
 * setting `isInitialized = true` BEFORE the first useEffect ever fires.
 * So we CANNOT use `isInitialized` as the condition — it is already true.
 *
 * Solution: use a plain React ref to track if init() was called in this mount cycle.
 * The ref persists across re-renders but resets on unmount (new page = fresh ref).
 *
 * init() itself is safe to call multiple times: it returns the same promise
 * if already in flight, preventing race conditions.
 */
function AuthInitializer() {
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  // Use a React ref — not Zustand state — as the mount guard.
  // This ref is fresh on every page mount (different component tree).
  const initCalled = useRef(false);

  useEffect(() => {
    // Guard: only call init() once per mount cycle
    if (initCalled.current) return;
    initCalled.current = true;
    // isInitialized from Zustand is already true after hydration,
    // but we intentionally ignore it and always revalidate from server.
    // init() itself is idempotent (returns the same promise if in-flight).
    init();
  }, [init]);

  return null;
}
