'use client';

/**
 * User Conversations List — /conversations
 *
 * Shows all conversations for the authenticated user from the database.
 * Grouped by date, supports search and persona filtering.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageSquare, RefreshCw, ChevronRight, X,
  ArrowUpDown, Wifi, WifiOff, Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { getPersonasByIds, PERSONA_LIST } from '@/lib/personas';

interface ConversationEntry {
  id: string;
  mode: string;
  personaIds: string[];
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  firstContent?: string;
  lastContent?: string;
}

type SortBy = 'time' | 'messageCount';

export default function ConversationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [selectedPersona, setSelectedPersona] = useState<string>('all');
  const [isOnline, setIsOnline] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations?pageSize=100', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchConversations();
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [user]);

  // Reload on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchConversations();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [user]);

  // Build persona map for display
  const personaMap = useMemo(() => {
    const map: Record<string, { nameZh: string; accentColor: string; gradientFrom: string; gradientTo: string }> = {};
    for (const p of PERSONA_LIST) {
      map[p.id] = { nameZh: p.nameZh, accentColor: p.accentColor, gradientFrom: p.gradientFrom, gradientTo: p.gradientTo };
    }
    return map;
  }, []);

  const filteredAndSorted = useMemo(() => {
    let items = [...conversations];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) => {
        const nameMatch = c.personaIds.some((id) => {
          const p = personaMap[id];
          return p?.nameZh?.toLowerCase().includes(q);
        });
        const contentMatch = c.firstContent?.toLowerCase().includes(q)
          || c.lastContent?.toLowerCase().includes(q);
        return nameMatch || contentMatch;
      });
    }

    if (selectedPersona !== 'all') {
      items = items.filter((c) => c.personaIds.includes(selectedPersona));
    }

    items.sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return b.messageCount - a.messageCount;
    });

    return items;
  }, [conversations, search, sortBy, selectedPersona, personaMap]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: ConversationEntry[] }[] = [];
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const thisWeek = new Date(now.getTime() - 7 * 86400000);

    const buckets: Record<string, ConversationEntry[]> = {
      '今天': [], '昨天': [], '本周': [], '更早': [],
    };

    for (const item of filteredAndSorted) {
      const d = new Date(item.updatedAt);
      const dateStr = d.toDateString();
      if (dateStr === today) buckets['今天'].push(item);
      else if (dateStr === yesterday) buckets['昨天'].push(item);
      else if (d >= thisWeek) buckets['本周'].push(item);
      else buckets['更早'].push(item);
    }

    for (const [label, items] of Object.entries(buckets)) {
      if (items.length > 0) groups.push({ label, items });
    }

    return groups;
  }, [filteredAndSorted]);

  const handleConversationClick = (conv: ConversationEntry) => {
    const primaryId = conv.personaIds[0] ?? 'steve-jobs';
    router.push(`/?persona=${primaryId}&mode=solo`);
  };

  // Collect all unique persona IDs from conversations
  const allPersonaIds = useMemo(() => {
    const ids = new Set<string>();
    conversations.forEach((c) => c.personaIds.forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [conversations]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center mx-auto">
            <MessageSquare className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-xl font-semibold">登录后查看对话记录</h2>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-6 py-2.5 rounded-xl bg-prism-gradient text-white text-sm font-medium"
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">对话记录</h1>
              <p className="text-sm text-text-muted mt-0.5">
                {loading ? '加载中...' : `${conversations.length} 个对话`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  <WifiOff className="w-3 h-3" /> 离线
                </span>
              )}
              <button
                onClick={fetchConversations}
                className="w-8 h-8 rounded-full bg-bg-surface hover:bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                title="刷新"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-purple"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {([
              ['time', '最近'],
              ['messageCount', '消息数'],
            ] as [SortBy, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  sortBy === value
                    ? 'bg-bg-surface text-text-primary border border-border-medium'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                <ArrowUpDown className="w-3 h-3" />
                {label}
              </button>
            ))}

            <div className="w-px h-4 bg-border-subtle mx-1" />

            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="text-xs bg-bg-surface text-text-muted border border-border-subtle rounded-full px-3 py-1.5 focus:outline-none focus:border-prism-purple"
            >
              <option value="all">全部人物</option>
              {allPersonaIds.map((id) => {
                const p = personaMap[id];
                return p ? (
                  <option key={id} value={id}>{p.nameZh}</option>
                ) : null;
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {loading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-text-muted animate-spin mb-3" />
            <p className="text-sm text-text-muted">加载中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <button
              onClick={fetchConversations}
              className="px-4 py-2 rounded-lg bg-bg-surface border border-border-subtle text-sm text-text-primary hover:bg-bg-elevated"
            >
              重试
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-surface flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-base font-medium text-text-primary mb-2">暂无对话记录</h3>
            <p className="text-sm text-text-muted">
              {search ? '尝试其他关键词' : '开始与思想家对话吧'}
            </p>
            {!search && (
              <button
                onClick={() => router.push('/')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-prism-gradient text-white text-sm font-medium"
              >
                开始对话
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 px-1">
                  {label} · {items.length}
                </p>
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {items.map((conv, idx) => {
                      const personas = conv.personaIds
                        .map((id) => personaMap[id])
                        .filter(Boolean);
                      const title = personas.map((p) => p.nameZh).join(' × ') || '对话';

                      return (
                        <motion.div
                          key={conv.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <button
                            onClick={() => handleConversationClick(conv)}
                            className="w-full text-left group"
                          >
                            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl hover:bg-bg-surface/60 transition-colors">
                              {/* Persona avatars */}
                              <div className="flex -space-x-1.5 flex-shrink-0">
                                {personas.slice(0, 3).map((p, i) => (
                                  <div
                                    key={i}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-bg-base"
                                    style={{
                                      background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                                    }}
                                  >
                                    {p.nameZh.slice(0, 1)}
                                  </div>
                                ))}
                                {personas.length > 3 && (
                                  <div className="w-8 h-8 rounded-full bg-bg-elevated border-2 border-bg-base flex items-center justify-center text-[10px] font-medium text-text-muted">
                                    +{personas.length - 3}
                                  </div>
                                )}
                                {personas.length === 0 && (
                                  <div className="w-8 h-8 rounded-full bg-bg-elevated border-2 border-bg-base flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-text-muted" />
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate group-hover:text-prism-purple transition-colors mb-0.5">
                                  {title}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                  {conv.lastContent || conv.firstContent || '新对话'}
                                </p>
                              </div>

                              {/* Meta */}
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                                  <MessageSquare className="w-3 h-3" />
                                  {conv.messageCount}
                                </div>
                                <span className="text-[11px] text-text-muted">
                                  {formatRelative(conv.updatedAt)}
                                </span>
                              </div>

                              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-prism-purple transition-colors flex-shrink-0 mt-1" />
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      {!loading && conversations.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <div className="rounded-2xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-text-primary">{conversations.length}</p>
                <p className="text-xs text-text-muted">总对话数</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-400">
                  {conversations.reduce((s, c) => s + (c.messageCount || 0), 0)}
                </p>
                <p className="text-xs text-text-muted">总消息数</p>
              </div>
              <div>
                <p className="text-xl font-bold text-prism-purple">
                  {conversations.length > 0
                    ? formatRelative(conversations[0].updatedAt)
                    : '—'}
                </p>
                <p className="text-xs text-text-muted">最近对话</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
