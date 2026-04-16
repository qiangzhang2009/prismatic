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
 * Zustand store is now purely in-memory (no localStorage persist for user).
 * Token lives in httpOnly cookie; server is always authoritative.
 * Admin changes (role/plan/credits) are immediately reflected on next navigation.
 */
function AuthInitializer() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return null;
}