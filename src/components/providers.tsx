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

/** Initialize auth state on app mount */
function AuthInitializer() {
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    init();
  }, [init]);

  return null;
}
