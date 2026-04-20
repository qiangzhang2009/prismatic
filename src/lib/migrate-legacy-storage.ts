'use client';

/**
 * Migration utility: old localStorage format → new conversation registry
 *
 * Old format: prismatic-convo-{sorted-persona-ids} → { messages: AgentMessage[], version: number, lastUpdated: number }
 * New format: prismatic-conversation-registry → ConversationRegistry (see use-conversation-sync.ts)
 *
 * This utility should be called once on app initialization when a legacy user
 * visits with existing localStorage data.
 */

import type { LocalConversationSnapshot } from '@/lib/use-conversation-sync';
import type { AgentMessage } from '@/lib/types';

const OLD_PREFIX = 'prismatic-convo-';
const NEW_REGISTRY_KEY = 'prismatic-conversation-registry';

interface LegacyStore {
  version: number;
  messages: AgentMessage[];
  lastUpdated: number;
}

interface MigrationResult {
  migratedCount: number;
  skippedCount: number;
  totalMessages: number;
  errors: string[];
}

/**
 * Run the migration. Returns stats about what was migrated.
 * Safe to call multiple times — skips already-migrated entries.
 */
export function migrateLegacyStorage(): MigrationResult {
  const result: MigrationResult = {
    migratedCount: 0,
    skippedCount: 0,
    totalMessages: 0,
    errors: [],
  };

  try {
    // Load existing registry (if any)
    const existingRegistry = loadRegistry();

    // Scan all legacy conversation keys
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(OLD_PREFIX) && !key.includes('prismatic-chat-state')) {
        legacyKeys.push(key);
      }
    }

    if (legacyKeys.length === 0) {
      return result;
    }

    const existingKeys = new Set(
      (existingRegistry?.conversations ?? []).map((c: any) => c.conversationKey)
    );

    for (const key of legacyKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        let store: LegacyStore;
        try {
          store = JSON.parse(raw);
        } catch {
          result.errors.push(`Failed to parse ${key}`);
          continue;
        }

        if (!Array.isArray(store.messages)) {
          result.skippedCount++;
          continue;
        }

        // Skip empty conversations
        if (store.messages.length === 0) {
          result.skippedCount++;
          continue;
        }

        // Extract persona IDs from the key (format: prismatic-convo-{sorted-ids})
        const keyParts = key.replace(OLD_PREFIX, '');
        const sortedPersonaIds = keyParts.split('-');
        const personaIds = sortedPersonaIds;

        // Build conversation key (same as buildConversationKey)
        const conversationKey = [...personaIds].sort().join('|');

        // Skip if already migrated
        if (existingKeys.has(conversationKey)) {
          result.skippedCount++;
          continue;
        }

        // Build snapshot
        const userMessages = (store.messages as any[]).filter(
          (m) => (m as any).role === 'user' || (m as any).role === 'human'
        );
        const lastUserMessage = userMessages[userMessages.length - 1];
        const firstUserMessage = userMessages[0];

        const snapshot: LocalConversationSnapshot = {
          conversationKey,
          personaIds,
          title: extractTitle(store.messages as any[]),
          tags: [],
          messageCount: store.messages.length,
          messages: (store.messages as any[]).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            personaId: m.personaId,
            timestamp: new Date(m.timestamp ?? Date.now()).toISOString(),
          })),
          contentHash: '',
          lastMessageAt: store.lastUpdated
            ? new Date(store.lastUpdated).toISOString()
            : new Date().toISOString(),
          snapshotAt: new Date().toISOString(),
        };

        // Add to registry
        const deviceId = getOrCreateDeviceId();
        addToRegistry(snapshot, deviceId);

        result.migratedCount++;
        result.totalMessages += store.messages.length;
        existingKeys.add(conversationKey);

        // Remove the old key
        localStorage.removeItem(key);
      } catch (e) {
        result.errors.push(`Error migrating ${key}: ${e}`);
      }
    }

    // Mark migration as complete
    if (result.migratedCount > 0) {
      markMigrationComplete();
    }
  } catch (e) {
    result.errors.push(`Migration failed: ${e}`);
  }

  return result;
}

function loadRegistry(): any {
  try {
    const raw = localStorage.getItem(NEW_REGISTRY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveRegistry(registry: any) {
  try {
    localStorage.setItem(NEW_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Storage full
  }
}

function addToRegistry(snapshot: LocalConversationSnapshot, deviceId: string) {
  const registry = loadRegistry() ?? createEmptyRegistry(deviceId);

  registry.conversations = (registry.conversations as any[]).filter(
    (c: any) => c.conversationKey !== snapshot.conversationKey
  );
  registry.conversations.push({
    conversationKey: snapshot.conversationKey,
    personaIds: snapshot.personaIds,
    title: snapshot.title ?? '',
    tags: snapshot.tags ?? [],
    localMessageCount: snapshot.messageCount,
    contentHash: snapshot.contentHash,
    lastLocalUpdateAt: snapshot.lastMessageAt,
    deviceId,
  });

  saveRegistry(registry);
}

function createEmptyRegistry(deviceId: string): any {
  return {
    version: 1,
    deviceId,
    conversations: [],
    lastSyncedAt: null,
    syncToken: null,
  };
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem('prismatic-device-id');
    if (existing) return existing;
    const id = generateId();
    localStorage.setItem('prismatic-device-id', id);
    return id;
  } catch {
    return generateId();
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

function generateSnapshotId(): string {
  return `local-${generateId()}`;
}

function extractTitle(messages: any[]): string | undefined {
  const firstUserMsg = messages.find((m: any) => m.role === 'user' || m.role === 'human');
  if (!firstUserMsg) return undefined;
  const content = firstUserMsg.content;
  if (content.length <= 20) return content;
  return content.slice(0, 20) + '...';
}

const MIGRATION_KEY = 'prismatic-migration-v1-complete';

function markMigrationComplete() {
  try {
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  } catch {}
}

export function isMigrationComplete(): boolean {
  try {
    return localStorage.getItem(MIGRATION_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Check if any legacy conversations exist (unmigrated).
 */
export function hasLegacyData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(OLD_PREFIX) && !key.includes('prismatic-chat-state')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
