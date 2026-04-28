'use client';

/**
 * useConversationSync — Multi-device Conversation Synchronization Hook
 *
 * Features:
 *  1. Automatic device registration on mount
 *  2. Bidirectional sync on login and app focus
 *  3. Real-time push after each message
 *  4. Offline queue: messages sent while offline are queued and pushed when online
 *  5. Conflict detection and resolution UI
 *  6. Visitor → Registered user migration on first login
 *
 * Storage Strategy:
 *  - localStorage: all conversation messages (already implemented in use-chat-history.ts)
 *  - DB (via API): conversation metadata, content hashes, and last sync timestamps
 *  - IndexedDB: offline message queue (backup for localStorage)
 *
 * Sync Triggers:
 *  - On login: full sync (all conversations)
 *  - On app focus: incremental sync
 *  - After each message: lightweight push
 *  - Every 5 minutes: background push (automatic)
 *  - On manual refresh: full sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentMessage } from '@/lib/types';
import { buildConversationKey } from '@/lib/sync-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  personaId?: string;
  timestamp: string;
}

export interface LocalConversationSnapshot {
  conversationKey: string;
  personaIds: string[];
  title?: string;
  tags?: string[];
  messageCount: number;
  contentHash: string;
  lastMessageAt: string;
  messages?: SyncMessage[];
  snapshotAt: string;
  mode?: string;
}

export interface ConflictItem {
  conversationKey: string;
  personaIds: string[];
  conflictType: string;
  localSnapshot: LocalConversationSnapshot;
  serverSnapshot: LocalConversationSnapshot;
  suggestedMerge?: SyncMessage[];
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'conflict';
  lastSyncedAt: string | null;
  syncToken: string | null;
  deviceId: string | null;
  conflicts: ConflictItem[];
  error: string | null;
  stats: {
    pushed: number;
    pulled: number;
    conflicts: number;
  };
}

export interface SyncResult {
  success: boolean;
  pullConversations: Array<{
    conversationKey: string;
    personaIds: string[];
    title?: string;
    messages: SyncMessage[];
    serverUpdatedAt: string;
    isNew: boolean;
  }>;
  acknowledged: string[];
  conflicts: ConflictItem[];
  syncToken: string;
  stats: {
    pushed: number;
    pulled: number;
    conflicts: number;
    durationMs: number;
  };
}

// ─── Device Fingerprint ────────────────────────────────────────────────────

/** Get or create a stable device ID for this browser/device */
function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'prismatic-device-id';
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    // SSR or private browsing — generate ephemeral ID
    return `ephemeral_${Date.now()}`;
  }
}

/** Extract device info from the browser */
function getDeviceInfo() {
  if (typeof window === 'undefined') return {};

  const ua = navigator.userAgent;
  const platform = navigator.platform;

  let deviceName = 'Unknown Device';
  let deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN' = 'UNKNOWN';
  let browser = 'Unknown Browser';
  let osVersion = '';

  // Platform detection
  if (/iPhone|iPad|iPod/i.test(ua)) {
    deviceType = /iPad/i.test(ua) ? 'TABLET' : 'MOBILE';
    const match = ua.match(/OS ([\d_]+)/);
    osVersion = match ? `iOS ${match[1].replace(/_/g, '.')}` : '';
  } else if (/Android/i.test(ua)) {
    deviceType = 'MOBILE';
    const match = ua.match(/Android ([\d.]+)/);
    osVersion = match ? `Android ${match[1]}` : '';
  } else if (/Mac/i.test(platform)) {
    deviceType = 'DESKTOP';
    const match = ua.match(/Mac OS X ([\d_.]+)/);
    osVersion = match ? `macOS ${match[1].replace(/_/g, '.')}` : '';
    deviceName = 'Mac';
  } else if (/Win/i.test(platform)) {
    deviceType = 'DESKTOP';
    deviceName = 'Windows PC';
  } else if (/Linux/i.test(platform)) {
    deviceType = 'DESKTOP';
    deviceName = 'Linux';
  }

  // Browser detection
  if (/Chrome\/[\d.]+/.test(ua) && !/Chromium|Edge/.test(ua)) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    browser = match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
    if (deviceType === 'DESKTOP' && deviceName === 'Mac') deviceName = 'Chrome on Mac';
  } else if (/Safari\/[\d.]+/.test(ua) && !/Chrome|Chromium/.test(ua)) {
    const match = ua.match(/Version\/([\d.]+)/);
    browser = match ? `Safari ${match[1].split('.')[0]}` : 'Safari';
    if (deviceType === 'DESKTOP' && deviceName === 'Mac') deviceName = 'Safari on Mac';
  } else if (/Firefox\/[\d.]+/.test(ua)) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    browser = match ? `Firefox ${match[1].split('.')[0]}` : 'Firefox';
  }

  return {
    deviceName,
    deviceType,
    platform: platform.toLowerCase(),
    browser,
    osVersion,
  };
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

/** Get all conversation snapshots from localStorage */
function getAllLocalSnapshots(messagesMap: Map<string, { messages: AgentMessage[]; title?: string; tags?: string[] }>): LocalConversationSnapshot[] {
  const snapshots: LocalConversationSnapshot[] = [];

  messagesMap.forEach((conversationData, conversationKey) => {
    const { messages, title, tags } = conversationData;
    if (!messages || messages.length === 0) return;

    // Extract persona IDs from conversationKey (e.g. "u:userId:steve-jobs:confucius" → ["steve-jobs", "confucius"])
    // Format: authenticated = "u:{userId}:{sorted persona IDs joined by :}", guest = "{sorted persona IDs joined by :}"
    const personaIds = conversationKey.startsWith('u:')
      ? conversationKey.split(':').slice(2)
      : conversationKey.split(':');

    // Quick content hash for localStorage (use last message id + count as proxy)
    const lastMsg = messages[messages.length - 1];
    const contentHash = `${lastMsg?.id ?? ''}:${messages.length}`;

    snapshots.push({
      conversationKey,
      personaIds,
      title,
      tags,
      messageCount: messages.length,
      contentHash,
      lastMessageAt: messages.length > 0
        ? (messages[messages.length - 1] as any).timestamp || new Date().toISOString()
        : new Date().toISOString(),
      snapshotAt: new Date().toISOString(),
    });
  });

  return snapshots;
}

/** Compute SHA-256 hash of a value (browser-compatible via SubtleCrypto) */
async function sha256(message: string): Promise<string> {
  const buffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function computeContentHash(messages: AgentMessage[]): string {
  const recentMessages = messages.slice(-20).map(m => ({
    id: m.id,
    role: m.role,
    content: (m.content as string || '').slice(0, 200),
    timestamp: (m as any).timestamp,
  }));
  const payload = JSON.stringify({ count: messages.length, recent: recentMessages });
  // FNV-1a hash (deterministic, fast, sync) — both frontend and backend use this format
  // Matches sync-engine.ts contentHash() which uses crypto.createHash('sha256')
  // We use FNV-1a here since it's synchronous and sufficient for change detection
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

interface QueuedSnapshot {
  conversationKey: string;
  snapshot: LocalConversationSnapshot;
  queuedAt: string;
}

function getOfflineQueue(): QueuedSnapshot[] {
  try {
    const raw = localStorage.getItem('prismatic-sync-queue');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addToOfflineQueue(conversationKey: string, snapshot: LocalConversationSnapshot) {
  const queue = getOfflineQueue();
  const existing = queue.findIndex(q => q.conversationKey === conversationKey);
  if (existing >= 0) {
    queue[existing] = { conversationKey, snapshot, queuedAt: new Date().toISOString() };
  } else {
    queue.push({ conversationKey, snapshot, queuedAt: new Date().toISOString() });
  }
  try { localStorage.setItem('prismatic-sync-queue', JSON.stringify(queue)); } catch {}
}

function clearOfflineQueue() {
  try { localStorage.removeItem('prismatic-sync-queue'); } catch {}
}

function flushOfflineQueue(): QueuedSnapshot[] {
  const queue = getOfflineQueue();
  clearOfflineQueue();
  return queue;
}

// ─── Conversation Registry ────────────────────────────────────────────────────
// Maintains the mapping of conversationKey → messages for ALL conversations
// (not just the active one like useChatHistory does)

const REGISTRY_KEY = 'prismatic-conversation-registry';
const STORAGE_VERSION = 5;

interface ConversationRegistry {
  version: number;
  conversations: Record<string, {
    messages: AgentMessage[];
    title?: string;
    tags?: string[];
    lastUpdated: number;
    mode?: string;
    contentHash: string;       // SHA-256 hash for change detection
    lastSyncedAt?: string;    // ISO timestamp of last successful sync
    syncStatus: 'synced' | 'pending' | 'conflict'; // sync state
  }>;
}

export function loadRegistry(): ConversationRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return { version: STORAGE_VERSION, conversations: {} };
    const registry: ConversationRegistry = JSON.parse(raw);
    if (registry.version !== STORAGE_VERSION) {
      // Version migration: re-parse from old format
      return migrateRegistry(registry);
    }
    return registry;
  } catch { return { version: STORAGE_VERSION, conversations: {} }; }
}

function migrateRegistry(old: any): ConversationRegistry {
  // v1→v2: old format stored by persona pair, v2+ uses conversationKey
  // v2→v3: add metadata fields
  // v3→v4: conversation keys are now user-isolated (prefixed with userId)
  // v4→v5: add contentHash, lastSyncedAt, syncStatus fields
  const conversations: ConversationRegistry['conversations'] = {};
  for (const [key, data] of Object.entries(old.conversations || {})) {
    const d = data as any;
    conversations[key] = {
      messages: d.messages || [],
      title: d.title || '',
      tags: d.tags || [],
      lastUpdated: d.lastUpdated || Date.now(),
      mode: d.mode,
      contentHash: d.contentHash || '',
      lastSyncedAt: d.lastSyncedAt,
      syncStatus: d.syncStatus || 'synced',
    };
  }
  return { version: STORAGE_VERSION, conversations };
}

function saveRegistry(registry: ConversationRegistry) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Storage full — warn user
    console.warn('[Sync] localStorage full, sync may not work');
  }
}

function getOrCreateConversation(
  registry: ConversationRegistry,
  conversationKey: string
): ConversationRegistry['conversations'][string] {
  if (!registry.conversations[conversationKey]) {
    registry.conversations[conversationKey] = {
      messages: [],
      title: '',
      tags: [],
      lastUpdated: Date.now(),
      mode: undefined,
      contentHash: '',
      lastSyncedAt: undefined,
      syncStatus: 'synced',
    };
  }
  return registry.conversations[conversationKey];
}

// ─── Registry-Based Chat Hook ────────────────────────────────────────────────────
// Replaces useChatHistory: reads/writes to the same registry that sync uses.
// This eliminates the dual-storage bug where useChatHistory and useConversationSync
// used separate localStorage namespaces.

/**
 * useRegistryChat — reads and writes messages from the unified conversation registry.
 * Provides the same interface as useChatHistory but backed by the shared registry
 * so pushSnapshot and full sync both see the same data.
 *
 * @param personaIds — the currently selected persona IDs
 * @param userId — the logged-in user ID (for user-isolated keys)
 */
export function useRegistryChat(personaIds: string[], userId?: string) {
  const conversationKey = buildConversationKey(personaIds, userId);

  const [messages, setMessagesState] = useState<AgentMessage[]>(() => {
    const reg = loadRegistry();
    return reg.conversations[conversationKey]?.messages || [];
  });

  const isInitializedRef = useRef(false);
  const prevIdsRef = useRef<string[]>(personaIds);
  const hasMessagesRef = useRef(false);

  // Load history when persona selection changes (only if no messages currently)
  useEffect(() => {
    const prev = prevIdsRef.current;
    const changed = prev.length !== personaIds.length ||
      prev.some((id, i) => id !== personaIds[i]);

    if (changed) {
      if (!hasMessagesRef.current) {
        prevIdsRef.current = personaIds;
        const reg = loadRegistry();
        const key = buildConversationKey(personaIds, userId);
        setMessagesState(reg.conversations[key]?.messages || []);
      }
    }
  }, [personaIds, userId]);

  useEffect(() => {
    hasMessagesRef.current = messages.length > 0;
  }, [messages]);

  useEffect(() => {
    isInitializedRef.current = true;
  }, []);

  const setMessages = useCallback((updater: (prev: AgentMessage[]) => AgentMessage[]) => {
    setMessagesState(prev => {
      const next = updater(prev);
      if (isInitializedRef.current) {
        const reg = loadRegistry();
        if (!reg.conversations[conversationKey]) {
          reg.conversations[conversationKey] = {
            messages: [],
            title: '',
            tags: [],
            lastUpdated: Date.now(),
            mode: undefined,
            contentHash: '',
            lastSyncedAt: undefined,
            syncStatus: 'synced',
          };
        }
        reg.conversations[conversationKey].messages = next;
        reg.conversations[conversationKey].lastUpdated = Date.now();
        saveRegistry(reg);
      }
      return next;
    });
  }, [conversationKey]);

  const clearHistory = useCallback(() => {
    const reg = loadRegistry();
    delete reg.conversations[conversationKey];
    saveRegistry(reg);
    setMessagesState([]);
    hasMessagesRef.current = false;
  }, [conversationKey]);

  return { messages, setMessages, clearHistory };
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useConversationSync() {
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());
  const deviceId = deviceIdRef.current;

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncedAt: null,
    syncToken: null,
    deviceId,
    conflicts: [],
    error: null,
    stats: { pushed: 0, pulled: 0, conflicts: 0 },
  });

  const syncTokenRef = useRef<string | null>(null);
  const isOnlineRef = useRef<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const syncInProgressRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registryRef = useRef<ConversationRegistry>(loadRegistry());
  // Track conversations with pending sync (for UI indicator)
  const pendingKeysRef = useRef<Set<string>>(new Set());
  // Retry state per conversation key
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // ── Reliable fetch with retry (critical for WeChat WebView) ──────────────

  /** Fetch that retries up to 3 times with exponential backoff — designed for unreliable mobile networks */
  async function reliableFetch(url: string, options: RequestInit, key?: string, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // WeChat/X5 WebView is known to silently drop background fetch requests.
        // Using a short timeout forces the request to complete or fail fast,
        // avoiding the "hanging" state where the request is sent but never resolves.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return res;
      } catch (err) {
        lastError = err as Error;
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        const isNetErr = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'));

        if (isAbort || isNetErr) {
          // Retry with backoff: 1s, 2s, 4s
          if (attempt < maxRetries - 1) {
            const delay = (1 << attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
        }
        // 4xx/5xx or unexpected error — don't retry
        throw err;
      }
    }
    throw lastError || new Error('Max retries exceeded');
  }

  // ── Push a conversation snapshot ───────────────────────────────────────

  /** Call this after every message to push a snapshot to the server */
  const pushSnapshot = useCallback(async (personaIds: string[], _messages: AgentMessage[], title?: string, tags?: string[], mode?: string, userId?: string) => {
    const conversationKey = buildConversationKey(personaIds, userId);

    // Always read fresh messages from the registry (avoids stale closures from setTimeout timing)
    const reg = loadRegistry();
    const freshConv = reg.conversations[conversationKey];
    const messages = freshConv?.messages || _messages;

    const contentHash = computeContentHash(messages);
    const lastMsgAt = messages.length > 0
      ? ((messages[messages.length - 1] as any).timestamp as string || new Date().toISOString())
      : new Date().toISOString();

    const snapshot: LocalConversationSnapshot = {
      conversationKey,
      personaIds,
      title,
      tags,
      messageCount: messages.length,
      contentHash,
      lastMessageAt: lastMsgAt,
      snapshotAt: new Date().toISOString(),
      mode,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role === 'agent' ? 'assistant' : m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        personaId: m.personaId,
        timestamp: (m as any).timestamp || m.timestamp.toString(),
      })),
    };

    // Update registry immediately (optimistic update)
    reg.conversations[conversationKey] = {
      messages,
      title: title || '',
      tags: tags || [],
      lastUpdated: Date.now(),
      mode,
      contentHash,
      lastSyncedAt: reg.conversations[conversationKey]?.lastSyncedAt,
      syncStatus: 'pending',
    };
    saveRegistry(reg);
    registryRef.current = reg;

    if (!isOnlineRef.current) {
      addToOfflineQueue(conversationKey, snapshot);
      pendingKeysRef.current.add(conversationKey);
      return;
    }

    // Track pending
    pendingKeysRef.current.add(conversationKey);

    try {
      // Use reliableFetch with retries (critical for WeChat WebView)
      const res = await reliableFetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, snapshots: [snapshot] }),
      });

      if (res.ok) {
        // Sync succeeded — mark synced, clear retry count
        retryCountRef.current.delete(conversationKey);
        const reg2 = loadRegistry();
        if (reg2.conversations[conversationKey]) {
          reg2.conversations[conversationKey].syncStatus = 'synced';
          reg2.conversations[conversationKey].lastSyncedAt = new Date().toISOString();
          saveRegistry(reg2);
          registryRef.current = reg2;
        }
        pendingKeysRef.current.delete(conversationKey);
      } else if (res.status >= 500) {
        // Server error — retry with backoff
        throw new Error(`HTTP ${res.status}`);
      } else {
        // 4xx error — don't retry
        pendingKeysRef.current.delete(conversationKey);
      }
    } catch {
      // Network or server error — add to offline queue for later retry
      retryCountRef.current.set(conversationKey, (retryCountRef.current.get(conversationKey) || 0) + 1);
      addToOfflineQueue(conversationKey, snapshot);
    }
  }, [deviceId]);

  // ── Full sync ─────────────────────────────────────────────────────────

  const runFullSync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncInProgressRef.current) return null;
    if (!isOnlineRef.current) return null;

    syncInProgressRef.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      // Build snapshots for all conversations in the registry
      const allSnapshots = getAllLocalSnapshots(
        new Map(Object.entries(registryRef.current.conversations))
      );

      // Use reliableFetch with retries (critical for WeChat WebView)
      const result = await reliableFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceInfo: getDeviceInfo(),
          localSnapshots: allSnapshots,
          syncToken: syncTokenRef.current,
          lastSyncAt: syncState.lastSyncedAt,
        }),
      });

      if (!result.ok) {
        throw new Error(`Sync failed: ${result.status}`);
      }

      const syncResult: SyncResult = await result.json();

      // ── Apply pulled conversations to localStorage ─────────────────
      if (syncResult.pullConversations && syncResult.pullConversations.length > 0) {
        for (const pull of syncResult.pullConversations) {
          // Update local registry with pulled messages
          const conv = getOrCreateConversation(registryRef.current, pull.conversationKey);

          // Merge: add pulled messages that don't exist locally
          const localIds = new Set(conv.messages.map(m => m.id));
          const newMessages = pull.messages.filter((m: SyncMessage) => !localIds.has(m.id));

          if (newMessages.length > 0) {
            // Sort by timestamp and append
            const merged = ([...conv.messages, ...newMessages] as AgentMessage[]).sort((a, b) => {
              const aTime = new Date((a as any).timestamp || 0).getTime();
              const bTime = new Date((b as any).timestamp || 0).getTime();
              return aTime - bTime;
            });
            conv.messages = merged;
            conv.lastUpdated = Date.now();
          }

          if (pull.title) conv.title = pull.title;
        }
        saveRegistry(registryRef.current);
      }

      // ── Update sync state ───────────────────────────────────────────
      syncTokenRef.current = syncResult.syncToken;
      setSyncState(prev => ({
        ...prev,
        status: syncResult.conflicts.length > 0 ? 'conflict' : 'success',
        lastSyncedAt: new Date().toISOString(),
        syncToken: syncResult.syncToken,
        conflicts: syncResult.conflicts || [],
        error: null,
        stats: syncResult.stats,
      }));

      return syncResult;
    } catch (e) {
      const error = e instanceof Error ? e.message : '同步失败';
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return null;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [deviceId, syncState.lastSyncedAt]);

  // ── Resolve a conflict ───────────────────────────────────────────────

  const resolveConflict = useCallback(async (
    conversationKey: string,
    strategy: 'SERVER_WINS' | 'LOCAL_WINS' | 'MERGE_APPEND' | 'USER_DECIDES',
    resolvedMessages?: AgentMessage[]
  ) => {
    try {
      const result = await fetch('/api/sync/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationKey, strategy, resolvedMessages }),
      });

      if (!result.ok) throw new Error('Failed to resolve conflict');

      // Apply the resolution locally
      if (resolvedMessages) {
        const conv = getOrCreateConversation(registryRef.current, conversationKey);
        conv.messages = resolvedMessages;
        conv.lastUpdated = Date.now();
        saveRegistry(registryRef.current);
      }

      setSyncState(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.conversationKey !== conversationKey),
        status: prev.conflicts.length <= 1 ? 'success' : 'conflict',
      }));

      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Flush offline queue ──────────────────────────────────────────────

  const flushOfflineQueue_ = useCallback(async () => {
    const queue = flushOfflineQueue();
    if (queue.length === 0) return;

    try {
      const res = await reliableFetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          snapshots: queue.map(q => q.snapshot),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Re-queue on failure
      for (const item of queue) {
        addToOfflineQueue(item.conversationKey, item.snapshot);
      }
    }
  }, [deviceId]);

  // ── Online/offline listeners ─────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      // Flush offline queue and do a sync when coming back online
      flushOfflineQueue_().then(() => runFullSync());
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Intentionally empty: use refs for callbacks to avoid stale closures

  // ── On-mount full sync (critical for WeChat WebView) ─────────────────────
  // WeChat WebView doesn't trigger visibilitychange when you enter from an external link
  // (the page is already visible). Without this, sync never fires on first visit.
  // Delay slightly to let the component tree settle, then sync all local conversations.
  useEffect(() => {
    const timer = setTimeout(() => {
      runFullSync();
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // run once on mount

  // ── App focus listener (incremental sync) ────────────────────────────

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // App came into focus — do incremental sync
        runFullSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // Intentionally empty: runFullSync is stable via refs

  // ── Periodic background sync (every 2 minutes, reliable fetch) ─────────────

  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      if (isOnlineRef.current && !syncInProgressRef.current) {
        const reg = loadRegistry();
        const allSnapshots = getAllLocalSnapshots(
          new Map(Object.entries(reg.conversations))
        );
        if (allSnapshots.length > 0) {
          reliableFetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, snapshots: allSnapshots }),
          }).catch(() => {});
        }
      }
    }, 2 * 60 * 1000); // 2 minutes — reduced from 5 min for faster retry

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []); // Intentionally empty: reads fresh state from localStorage directly

  return {
    syncState,
    deviceId,
    pushSnapshot,
    runFullSync,
    resolveConflict,
    flushOfflineQueue: flushOfflineQueue_,
    registry: registryRef.current,
  };
}

// ─── Login Migration ─────────────────────────────────────────────────────────────

/**
 * migrateUserConversations — call this when a user logs in.
 *
 * Renames all legacy conversation keys (without "u:" prefix) to user-isolated keys
 * (with "u:{userId}:" prefix). This prevents cross-user contamination when
 * multiple users share the same device/browser.
 */
export function migrateUserConversations(userId: string): number {
  const reg = loadRegistry();
  const legacyKeys = Object.keys(reg.conversations).filter(k => !k.startsWith('u:'));
  if (legacyKeys.length === 0) return 0;

  for (const legacyKey of legacyKeys) {
    const personaIds = legacyKey.split('-');
    const newKey = buildConversationKey(personaIds, userId);
    if (reg.conversations[newKey]) {
      delete reg.conversations[legacyKey];
      continue;
    }
    reg.conversations[newKey] = reg.conversations[legacyKey];
    delete reg.conversations[legacyKey];
  }

  saveRegistry(reg);
  console.log(`[Sync] Migrated ${legacyKeys.length} legacy conversations for user ${userId.slice(0, 8)}`);
  return legacyKeys.length;
}

// ─── Visitor → Registered Migration ──────────────────────────────────────────

/**
 * migrateVisitorConversations — call this on first login after visitor was using the app
 *
 * Moves all localStorage conversations from the "anonymous visitor" storage
 * to the registered user's account in the DB.
 */
export async function migrateVisitorConversationsToServer(
  userId: string,
  visitorId: string,
  registry: ConversationRegistry
): Promise<{ migrated: number; conflicts: number }> {
  // Convert registry to snapshots
  const snapshots: LocalConversationSnapshot[] = [];

  for (const [conversationKey, data] of Object.entries(registry.conversations)) {
    if (!data.messages || data.messages.length === 0) continue;

    // Extract persona IDs from conversationKey (e.g. "u:userId:steve-jobs:confucius" → ["steve-jobs", "confucius"])
    // Format: authenticated = "u:{userId}:{sorted persona IDs joined by :}", guest = "{sorted persona IDs joined by :}"
    const personaIds = conversationKey.startsWith('u:')
      ? conversationKey.split(':').slice(2)
      : conversationKey.split(':');

    const snapshot: LocalConversationSnapshot = {
      conversationKey,
      personaIds,
      title: data.title,
      tags: data.tags,
      messageCount: data.messages.length,
      contentHash: computeContentHash(data.messages),
      lastMessageAt: data.messages.length > 0
        ? ((data.messages[data.messages.length - 1] as any).timestamp as string || new Date().toISOString())
        : new Date().toISOString(),
      snapshotAt: new Date().toISOString(),
      mode: data.mode,
    };
    snapshots.push(snapshot);
  }

  try {
    const result = await fetch('/api/sync/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, visitorId, snapshots }),
    });

    if (!result.ok) throw new Error('Migration failed');

    const data = await result.json();
    return { migrated: data.migrated, conflicts: data.conflicts };
  } catch {
    return { migrated: 0, conflicts: 0 };
  }
}

// ─── Compatibility shim for existing useChatHistory ────────────────────────

/**
 * Extends the existing useChatHistory pattern to work with the sync system.
 *
 * Replace `useChatHistory` with `useSyncedChatHistory` in chat components.
 * The API is identical but messages are also synced to the server.
 */
export function useSyncedChatHistory(personaIds: string[]) {
  const conversationKey = buildConversationKey(personaIds);

  const registry = loadRegistry();
  const conv = registry.conversations[conversationKey];
  const [messages, setMessages] = useState<AgentMessage[]>(conv?.messages || []);

  const { pushSnapshot } = useConversationSync();

  const setMessagesAndSync = useCallback(async (updater: (prev: AgentMessage[]) => AgentMessage[]) => {
    setMessages(prev => {
      const next = updater(prev);

      // Save to registry
      const reg = loadRegistry();
      reg.conversations[conversationKey] = {
        messages: next,
        title: reg.conversations[conversationKey]?.title || '',
        tags: reg.conversations[conversationKey]?.tags || [],
        lastUpdated: Date.now(),
        mode: reg.conversations[conversationKey]?.mode,
        contentHash: reg.conversations[conversationKey]?.contentHash || '',
        lastSyncedAt: reg.conversations[conversationKey]?.lastSyncedAt,
        syncStatus: reg.conversations[conversationKey]?.syncStatus || 'synced',
      };
      saveRegistry(reg);

      // Push to server
      pushSnapshot(personaIds, next, reg.conversations[conversationKey]?.title);

      return next;
    });
  }, [conversationKey, personaIds, pushSnapshot]);

  const clearHistory = useCallback(() => {
    const reg = loadRegistry();
    delete reg.conversations[conversationKey];
    saveRegistry(reg);
    setMessages([]);
  }, [conversationKey]);

  return { messages, setMessages: setMessagesAndSync, clearHistory };
}
