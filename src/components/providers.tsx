'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { TrackingInitializer } from '@/components/tracking-initializer';
import { migrateLegacyStorage, isMigrationComplete } from '@/lib/migrate-legacy-storage';

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
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(15, 15, 25, 0.95)',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
            maxWidth: '360px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
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
  const migrated = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  // Run legacy storage migration once on mount
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;

    if (isMigrationComplete()) return;

    // Defer migration slightly to not block initial render
    const timer = setTimeout(() => {
      const result = migrateLegacyStorage();
      if (result.migratedCount > 0) {
        console.info(
          `[Migration] Migrated ${result.migratedCount} legacy conversations ` +
          `(${result.totalMessages} total messages) from old localStorage format.`
        );
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}