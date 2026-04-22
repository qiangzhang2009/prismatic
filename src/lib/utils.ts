/**
 * Prismatic — Utility Functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Persona Domain Colors ───────────────────────────────────────────────────────

export const DOMAIN_GRADIENTS: Record<string, { from: string; to: string; label: string }> = {
  philosophy: { from: '#4d96ff', to: '#6bcb77', label: '哲学' },
  technology: { from: '#6bcb77', to: '#ffd93d', label: '科技' },
  investment: { from: '#ffd93d', to: '#ff6b6b', label: '投资' },
  science: { from: '#c77dff', to: '#4d96ff', label: '科学' },
  history: { from: '#f59e0b', to: '#ef4444', label: '历史' },
  literature: { from: '#ec4899', to: '#f97316', label: '文学' },
  product: { from: '#14b8a6', to: '#06b6d4', label: '产品' },
  strategy: { from: '#8b5cf6', to: '#c77dff', label: '战略' },
  default: { from: '#4d96ff', to: '#8e44ad', label: '其他' },
};

export function getDomainGradient(domains: string[]): { from: string; to: string; label: string } {
  const d = domains?.[0] || 'default';
  return DOMAIN_GRADIENTS[d] || DOMAIN_GRADIENTS.default;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function unquote(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/^"+|"+$/g, '');
}

export function decodeUnicodeEscapes(str: unknown): string {
  if (typeof str !== 'string') return '';
  let result = str;
  try {
    result = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    );
  } catch {
    // keep original
  }
  return result;
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 15);
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Color utilities
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getGradientCSS(from: string, to: string): string {
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Array utilities
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// Storage utilities
export const storage = {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};
