'use client';

/**
 * Synced Conversations List — /conversations
 *
 * Shows all conversations for the current user from the local registry,
 * organized by device and last update time.
 * Includes search, filter by persona, and conflict resolution entry.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Clock, MessageSquare, Smartphone, Monitor, RefreshCw,
  AlertTriangle, ChevronRight, Filter, X, Bot, Trash2,
  ArrowUpDown, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { getPersonasByIds } from '@/lib/personas';

interface ConversationEntry {
  id: string;
  conversationKey: string;
  personaIds: string[];
  localTitle?: string;
  localTags?: string[];
  localMessageCount: number;
  contentHash: string;
  lastLocalUpdateAt: string;
  deviceId: string;
  deviceName?: string;
  syncedConversationId?: string;
}

interface ConversationRegistry {
  version: number;
  deviceId: string;
  lastSyncedAt?: string;
  conversations: ConversationEntry[];
  syncToken?: string;
}

const REGISTRY_KEY = 'prismatic-conversation-registry';

function loadRegistry(): ConversationRegistry | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type SortBy = 'time' | 'messageCount' | 'persona';
type FilterState = 'all' | 'synced' | 'unsynced' | 'conflict';

export default function ConversationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [registry, setRegistry] = useState<ConversationRegistry | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('time');
  const [filterState, setFilterState] = useState<FilterState>('all');
  const [selectedPersona, setSelectedPersona] = useState<string>('all');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setRegistry(loadRegistry());
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Reload registry on visibility change (sync may have updated it)
  useEffect(() => {
    const handler = () => {
      setRegistry(loadRegistry());
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const filteredAndSorted = useMemo(() => {
    if (!registry) return [];

    let items = [...registry.conversations];

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((c) => {
        const personas = getPersonasByIds(c.personaIds);
        const nameMatch = personas.some(
          (p) => p.nameZh.includes(q) || p.name.toLowerCase().includes(q)
        );
        const titleMatch = c.localTitle?.toLowerCase().includes(q);
        const tagMatch = c.localTags?.some((t) => t.toLowerCase().includes(q));
        return nameMatch || titleMatch || tagMatch;
      });
    }

    // Filter by state
    if (filterState === 'synced') {
      items = items.filter((c) => c.syncedConversationId);
    } else if (filterState === 'unsynced') {
      items = items.filter((c) => !c.syncedConversationId);
    }

    // Filter by persona
    if (selectedPersona !== 'all') {
      items = items.filter((c) => c.personaIds.includes(selectedPersona));
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(b.lastLocalUpdateAt).getTime() - new Date(a.lastLocalUpdateAt).getTime();
      }
      if (sortBy === 'messageCount') {
        return b.localMessageCount - a.localMessageCount;
      }
      return 0;
    });

    return items;
  }, [registry, search, sortBy, filterState, selectedPersona]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: ConversationEntry[] }[] = [];
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const thisWeek = new Date(now.getTime() - 7 * 86400000);
    const thisMonth = new Date(now.getTime() - 30 * 86400000);

    const buckets: Record<string, ConversationEntry[]> = {
      '今天': [], '昨天': [], '本周': [], '更早': [],
    };

    for (const item of filteredAndSorted) {
      const d = new Date(item.lastLocalUpdateAt);
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
    // Navigate to the chat with this persona combo
    const primaryId = conv.personaIds[0] ?? 'steve-jobs';
    router.push(`/?persona=${primaryId}&mode=solo`);
  };

  const allPersonas = useMemo(() => {
    if (!registry) return [];
    const ids = new Set<string>();
    registry.conversations.forEach((c) => c.personaIds.forEach((id) => ids.add(id)));
    return Array.from(ids).map((id) => getPersonasByIds([id])[0]).filter(Boolean);
  }, [registry]);

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
                {registry ? `${registry.conversations.length} 个对话 · 设备 ${registry.deviceId.slice(0, 8)}` : '加载中...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  <WifiOff className="w-3 h-3" /> 离线
                </span>
              )}
              <button
                onClick={() => setRegistry(loadRegistry())}
                className="w-8 h-8 rounded-full bg-bg-surface hover:bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                title="刷新"
              >
                <RefreshCw className="w-4 h-4" />
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
            {/* State filter */}
            {([
              ['all', '全部'],
              ['synced', '已同步'],
              ['unsynced', '未同步'],
            ] as [FilterState, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilterState(value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  filterState === value
                    ? 'bg-prism-purple/15 text-prism-purple border border-prism-purple/30'
                    : 'bg-bg-surface text-text-muted border border-border-subtle hover:text-text-primary'
                )}
              >
                {value === 'synced' && <Wifi className="w-3 h-3" />}
                {value === 'unsynced' && <WifiOff className="w-3 h-3" />}
                {label}
              </button>
            ))}

            <div className="w-px h-4 bg-border-subtle mx-1" />

            {/* Sort */}
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

            {/* Persona filter */}
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="text-xs bg-bg-surface text-text-muted border border-border-subtle rounded-full px-3 py-1.5 focus:outline-none focus:border-prism-purple"
            >
              <option value="all">全部人物</option>
              {allPersonas.map((p) => (
                <option key={p.id} value={p.id}>{p.nameZh}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Conversation list */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {grouped.length === 0 ? (
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
                      const personas = getPersonasByIds(conv.personaIds);
                      const title = conv.localTitle || personas.map((p) => p.nameZh).join(' × ');
                      const tags = conv.localTags ?? [];

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
                                {personas.slice(0, 3).map((p) => (
                                  <div
                                    key={p.id}
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
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-prism-purple transition-colors">
                                    {title}
                                  </p>
                                  {!conv.syncedConversationId && (
                                    <WifiOff className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[11px] text-text-muted bg-bg-surface px-1.5 py-0.5 rounded"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Meta */}
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                                  <MessageSquare className="w-3 h-3" />
                                  {conv.localMessageCount}
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                                  {conv.deviceId === registry?.deviceId ? (
                                    <Monitor className="w-3 h-3" />
                                  ) : (
                                    <Smartphone className="w-3 h-3" />
                                  )}
                                </div>
                                <span className="text-[11px] text-text-muted">
                                  {formatRelative(conv.lastLocalUpdateAt)}
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
      {registry && registry.conversations.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <div className="rounded-2xl border border-border-subtle bg-bg-surface/40 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-text-primary">{registry.conversations.length}</p>
                <p className="text-xs text-text-muted">总对话数</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-400">
                  {registry.conversations.filter((c) => c.syncedConversationId).length}
                </p>
                <p className="text-xs text-text-muted">已同步</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-400">
                  {registry.conversations.filter((c) => !c.syncedConversationId).length}
                </p>
                <p className="text-xs text-text-muted">待同步</p>
              </div>
            </div>
            {registry.lastSyncedAt && (
              <p className="text-xs text-text-muted text-center mt-3">
                最后同步: {new Date(registry.lastSyncedAt).toLocaleString('zh-CN')}
              </p>
            )}
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
