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
 * Initialize auth state once on app mount.
 *
 * Strategy:
 * - On first mount: if user is persisted (localStorage), mark initialized → done.
 *   If no user is persisted, fetch from /api/auth/me to check cookie-based session.
 * - After login: useAuthStore.set({ user }) sets the user. AuthInitializer will
 *   re-run (user changed), but only calls init() if isInitialized is still false.
 *   Since persist marks isInitialized=true after hydration, it will NOT call init()
 *   and will NOT overwrite the freshly logged-in user.
 * - After logout: useAuthStore sets user=null. AuthInitializer re-runs, isInitialized
 *   is true (from persist hydration), so it does nothing.
 *
 * This eliminates the race condition where init() would fetch /api/auth/me after
 * login and potentially overwrite the just-set user with null (e.g. on slow networks).
 */
function AuthInitializer() {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const init = useAuthStore((s) => s.init);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current && !isInitialized) {
      initRef.current = true;
      if (!user) {
        init(); // 无缓存 → 从服务器拉取
      } else {
        // 有缓存 → 先显示缓存，同时后台刷新最新身份（管理员修改role/plan能立即生效）
        init();
      }
    }
  }, [user, isInitialized, init]);

  return null;
}
