'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { TrackingInitializer } from '@/components/tracking-initializer';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: 1, // Retry failed queries once
          },
          mutations: {
            retry: 0, // Don't retry mutations by default
          },
        },
        logger: {
          // Log errors in development
          log: process.env.NODE_ENV === 'development' ? console.log : () => {},
          warn: process.env.NODE_ENV === 'development' ? console.warn : () => {},
          error: process.env.NODE_ENV === 'development' ? console.error : () => {},
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <TrackingInitializer />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Sync auth state from server on every page load.
 *
 * Zustand store is purely in-memory (no localStorage persist for user).
 * Token lives in httpOnly cookie; server is always authoritative.
 */
function AuthInitializer() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return null;
}