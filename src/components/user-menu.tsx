'use client';

/**
 * Prismatic — User Menu Component
 * Displays login button or user avatar dropdown based on auth state
 */

import { useState, useRef, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  Github,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return (
      <div className="w-9 h-9 rounded-full bg-bg-elevated animate-pulse" />
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => signIn('github')}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors px-3 py-2 rounded-lg hover:bg-bg-elevated"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">登录</span>
        </button>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-bg-elevated transition-colors"
      >
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name ?? 'User'}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-border-subtle"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-prism-gradient flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        <ChevronDown className={cn(
          'w-4 h-4 text-text-muted transition-transform hidden sm:block',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 origin-top-right"
          >
            <div className="rounded-xl border border-border-subtle bg-bg-elevated shadow-lg overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="flex items-center gap-3">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.name ?? 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-prism-gradient flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user?.name ?? 'User'}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {user?.email ?? ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to settings
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  设置
                </button>

                <div className="h-px bg-border-subtle my-1" />

                <button
                  onClick={() => {
                    setIsOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact sign-in button for inline use
 */
export function SignInButton({ provider }: { provider?: 'github' | 'google' | 'credentials' }) {
  const icons = {
    github: <Github className="w-4 h-4" />,
    google: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
    credentials: <Mail className="w-4 h-4" />,
  };

  const labels = {
    github: 'GitHub',
    google: 'Google',
    credentials: '邮箱',
  };

  return (
    <button
      onClick={() => signIn(provider)}
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
        provider === 'github' && 'bg-[#24292e] text-white hover:bg-[#2f363d]',
        provider === 'google' && 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
        !provider && 'bg-prism-gradient text-white hover:opacity-90'
      )}
    >
      {provider ? icons[provider] : <User className="w-4 h-4" />}
      {provider ? `使用 ${labels[provider]} 登录` : '登录'}
    </button>
  );
}
