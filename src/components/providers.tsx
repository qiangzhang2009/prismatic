'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, useEffect, type ReactNode } from 'react';
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
 * Sync auth state from server on every page load.
 *
 * This component mounts on every page (not just the first one), so a simple
 * useEffect with no deps array ensures init() runs on every mount.
 * Zustand persist rehydrates synchronously from localStorage, but we ignore
 * the cached data and always fetch the latest from /api/auth/me.
 *
 * The server is the authoritative source — admin changes to role/plan/credits
 * are reflected immediately when the user visits any page.
 */
function AuthInitializer() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    // No guard, no ref — run on every mount.
    // init() is safe to call multiple times (it's async, returns a promise).
    init();
  }, [init]);

  return null;
}
