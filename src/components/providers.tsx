'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef, type ReactNode } from 'react';
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
      <AuthInitializer />
      <TrackingInitializer />
      <AuthReadyGate>{children}</AuthReadyGate>
    </QueryClientProvider>
  );
}

/**
 * Gate that waits for auth initialization before rendering children.
 * This ensures user data (including dailyCredits) is loaded before
 * any component tries to read it from the store.
 */
function AuthReadyGate({ children }: { children: ReactNode }) {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      setReady(true);
    }
  }, [isInitialized]);

  // Don't render children until auth is initialized
  // This prevents showing stale credit values (e.g., 5 instead of 20)
  if (!ready) {
    return null;
  }

  return <>{children}</>;
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