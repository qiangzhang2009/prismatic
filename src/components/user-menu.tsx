'use client';

/**
 * Prismatic — User Menu Component (Guest Mode)
 * No auth required — everyone is a guest.
 * Session data is stored in localStorage.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  ChevronDown,
  Bookmark,
  History,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGuestSession } from '@/lib/guest-session';

export function UserMenu() {
  const { session } = useGuestSession();
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-bg-elevated transition-colors"
        aria-label="用户菜单"
      >
        <div className="w-8 h-8 rounded-full bg-prism-gradient flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-text-muted transition-transform hidden sm:block',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 origin-top-right z-50"
          >
            <div className="rounded-xl border border-border-subtle bg-bg-elevated shadow-lg overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-prism-gradient flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {session?.name ?? '访客'}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      免注册模式
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <MenuItem icon={History} label="历史对话" href="/app" onClick={() => setIsOpen(false)} />
                <MenuItem icon={Bookmark} label="收藏人物" href="/personas" onClick={() => setIsOpen(false)} />
                <MenuItem icon={Info} label="关于 Prismatic" href="/#about" onClick={() => setIsOpen(false)} />

                <div className="h-px bg-border-subtle my-1" />

                <p className="px-4 py-2 text-xs text-text-muted">
                  数据存储在本地浏览器
                  <br />
                  无需登录 · 完全免费
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/**
 * Compact sign-in button (for compatibility — redirects to app in guest mode)
 */
export function SignInButton() {
  return (
    <button
      onClick={() => window.location.href = '/app'}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-prism-gradient text-white hover:opacity-90 transition-all"
    >
      <User className="w-4 h-4" />
      开始使用
    </button>
  );
}
