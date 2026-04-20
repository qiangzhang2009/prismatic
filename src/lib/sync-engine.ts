/**
 * Prismatic — Conversation Sync Engine
 *
 * Core logic for multi-device conversation synchronization.
 *
 * Architecture:
 *
 *  Each device has a unique anonymous deviceId (stored in localStorage).
 *  When a logged-in user opens the app on a device, we:
 *  1. Register/update the device in the DB
 *  2. Pull server conversations not on this device
 *  3. Push local conversations not yet on the server
 *  4. Detect and resolve conflicts
 *
 * Sync triggers:
 *  - On login (full sync)
 *  - On app focus (incremental sync)
 *  - On demand (user manually triggers)
 *  - On conversation close (lightweight push)
 *
 * Key design decisions:
 *  - "conversation key": sorted persona IDs joined by "-" — global ID for a conversation
 *    This means "Wittgenstein + Confucius" on Device A = "Confucius + Wittgenstein" on Device B
 *  - Content is stored in localStorage on the device
 *    Server only stores metadata + content hash + last sync timestamp
 *  - Full message content is only transmitted during conflict resolution
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalConversationSnapshot {
  /** Global conversation key (sorted persona IDs, e.g. "confucius-wittgenstein") */
  conversationKey: string;
  personaIds: string[];
  title?: string;
  tags?: string[];
  messageCount: number;
  /** SHA-256 hash of the full messages array */
  contentHash: string;
  /** ISO timestamp of the most recent message in this conversation */
  lastMessageAt: string;
  /** Full messages array (only sent on conflict) */
  messages?: SyncMessage[];
  /** ISO timestamp when this snapshot was taken on the device */
  snapshotAt: string;
}

export interface SyncMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  personaId?: string;
  timestamp: string;
}

export interface SyncRequest {
  /** Browser-generated anonymous device ID (used as Device.id) */
  deviceId: string;
  deviceInfo?: {
    deviceName?: string;
    deviceType?: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
    platform?: string;
    browser?: string;
    osVersion?: string;
  };
  /** Snapshots of all local conversations on this device */
  localSnapshots: LocalConversationSnapshot[];
  /** Token from the last successful sync (for incremental sync) */
  syncToken?: string;
  /** ISO timestamp of the last sync attempt */
  lastSyncAt?: string;
}

export interface SyncResult {
  success: boolean;
  /** Conversations to PULL from server to device */
  pullConversations: PullItem[];
  /** Acknowledged pushes — server confirmed receipt */
  acknowledged: string[];  // conversationKeys
  /** Conflicts that need user resolution */
  conflicts: ConflictItem[];
  /** New sync token for next incremental sync */
  syncToken: string;
  /** Stats */
  stats: {
    pushed: number;
    pulled: number;
    conflicts: number;
    durationMs: number;
  };
}

export interface PullItem {
  conversationKey: string;
  personaIds: string[];
  title?: string;
  tags?: string[];
  messages: SyncMessage[];
  serverUpdatedAt: string;
  /** True if this is a NEW conversation (not yet on device) */
  isNew: boolean;
}

export interface ConflictItem {
  conversationKey: string;
  personaIds: string[];
  localSnapshot: LocalConversationSnapshot;
  serverSnapshot: LocalConversationSnapshot;
  conflictType: 'CONTENT_OVERWRITE' | 'TITLE_CONFLICT' | 'BOTH_CREATED' | 'DELETED_CONFLICT';
  /** Pre-built merge suggestion (按时间排序合并) */
  suggestedMerge?: SyncMessage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a conversation key from persona IDs (always sorted for cross-device consistency) */
export function buildConversationKey(personaIds: string[]): string {
  return [...personaIds].sort().join('-');
}

/** SHA-256 hash of a JSON-serializable value */
export function contentHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
}

/** Extract message hash from a snapshot's content hash */
function extractMessageHash(snapshot: LocalConversationSnapshot): string {
  return snapshot.contentHash;
}

// ─── Core Sync Engine ────────────────────────────────────────────────────────

/**
 * Main sync function. Handles the full bidirectional sync for a device.
 */
export async function runSync(
  userId: string,
  request: SyncRequest
): Promise<SyncResult> {
  const startMs = Date.now();
  const { deviceId, localSnapshots, deviceInfo } = request;

  // ── Step 1: Register or update the device ──────────────────────────────
  // deviceId IS the Device.id (browser fingerprint → used as primary key)
  const device = await prisma.device.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      userId,
      deviceName: deviceInfo?.deviceName || null,
      deviceType: (deviceInfo?.deviceType as any) || 'UNKNOWN',
      platform: deviceInfo?.platform || null,
      browser: deviceInfo?.browser || null,
      osVersion: deviceInfo?.osVersion || null,
      lastActiveAt: new Date(),
    },
    update: {
      lastActiveAt: new Date(),
      ...(deviceInfo?.deviceName && { deviceName: deviceInfo.deviceName }),
      ...(deviceInfo?.deviceType && { deviceType: deviceInfo.deviceType as any }),
      ...(deviceInfo?.platform && { platform: deviceInfo.platform }),
      ...(deviceInfo?.browser && { browser: deviceInfo.browser }),
    },
  });

  // ── Step 2: Get all server-side local_conversations for this device ──
  const serverSnapshots = await prisma.localConversation.findMany({
    where: { deviceId: device.id },
    include: {
      device: false,
    },
  });

  // Map: conversationKey → server snapshot
  const serverMap = new Map<string, typeof serverSnapshots[0]>();
  for (const s of serverSnapshots) {
    serverMap.set(s.conversationKey, s);
  }

  // Map: conversationKey → local snapshot (from request)
  const localMap = new Map<string, LocalConversationSnapshot>();
  for (const s of localSnapshots) {
    localMap.set(s.conversationKey, s);
  }

  // ── Step 3: Classify all conversations ─────────────────────────────────
  const toPush: LocalConversationSnapshot[] = [];        // Local only or newer locally
  const toPull: PullItem[] = [];                         // Server only or newer on server
  const toUpdateLocal: PullItem[] = [];                  // Server has newer version
  const acknowledged: string[] = [];                    // Already in sync
  const conflicts: ConflictItem[] = [];                   // Need resolution

  const allKeys = new Set([...serverMap.keys(), ...localMap.keys()]);

  for (const key of allKeys) {
    const local = localMap.get(key);
    const server = serverMap.get(key);

    if (local && !server) {
      // Case A: Local only → push to server
      toPush.push(local);
    } else if (!local && server) {
      // Case B: Server only → pull to device
      const messages = await getServerMessages(server.syncedConversationId, key, server.personaIds);
      toPull.push({
        conversationKey: key,
        personaIds: server.personaIds,
        title: server.localTitle || undefined,
        tags: server.localTags,
        messages,
        serverUpdatedAt: server.lastLocalUpdateAt.toISOString(),
        isNew: true,
      });
    } else if (local && server) {
      // Case C: Both exist → check for conflicts
      const localHash = extractMessageHash(local);
      const serverHash = server.contentHash || '';

      const localTime = local.lastMessageAt ? new Date(local.lastMessageAt).getTime() : 0;
      const serverTime = server.lastLocalUpdateAt.getTime();

      if (localHash === serverHash) {
        // Case C1: Identical hash → already in sync
        acknowledged.push(key);
      } else if (Math.abs(localTime - serverTime) < 5000) {
        // Case C2: Modified within 5 seconds of each other → conflict
        const serverMessages = await getServerMessages(
          server.syncedConversationId,
          key,
          server.personaIds
        );
        const serverSnapshot: LocalConversationSnapshot = {
          conversationKey: key,
          personaIds: server.personaIds,
          title: server.localTitle || undefined,
          tags: server.localTags,
          messageCount: server.localMessageCount,
          contentHash: serverHash,
          lastMessageAt: server.lastLocalUpdateAt.toISOString(),
          messages: serverMessages,
          snapshotAt: server.lastLocalUpdateAt.toISOString(),
        };

        const conflict = detectConflict(local, serverSnapshot);
        conflicts.push(conflict);
      } else if (localTime > serverTime) {
        // Case C3: Local is newer → push local
        toPush.push(local);
      } else {
        // Case C4: Server is newer → pull server
        const serverMessages = await getServerMessages(
          server.syncedConversationId,
          key,
          server.personaIds
        );
        toUpdateLocal.push({
          conversationKey: key,
          personaIds: server.personaIds,
          title: server.localTitle || undefined,
          tags: server.localTags,
          messages: serverMessages,
          serverUpdatedAt: server.lastLocalUpdateAt.toISOString(),
          isNew: false,
        });
      }
    }
  }

  // ── Step 4: Execute pushes ────────────────────────────────────────────
  for (const snapshot of toPush) {
    await upsertLocalConversation(device.id, snapshot);
  }

  // ── Step 5: Build pull list (deduplicated) ───────────────────────────
  // Deduplicate: if both toPull (server-only) and toUpdateLocal (server-newer) have the same key, keep only one
  const pullMap = new Map<string, PullItem>();
  for (const item of [...toPull, ...toUpdateLocal]) {
    if (!pullMap.has(item.conversationKey) ||
        (pullMap.get(item.conversationKey)?.isNew === false && item.isNew === false)) {
      pullMap.set(item.conversationKey, item);
    }
  }
  const pullConversations = Array.from(pullMap.values());

  // ── Step 6: Generate sync token ──────────────────────────────────────
  const newSyncToken = nanoid(16);
  await prisma.device.update({
    where: { id: device.id },
    data: {
      syncToken: newSyncToken,
      lastSyncedAt: new Date(),
    },
  });

  // ── Step 7: Log the sync operation ───────────────────────────────────
  const syncLog = await prisma.syncLog.create({
    data: {
      userId,
      deviceId: device.id,
      direction: 'MERGE',
      pushedCount: toPush.length,
      pulledCount: pullConversations.length,
      mergedCount: toUpdateLocal.length,
      conflictCount: conflicts.length,
      status: conflicts.length === 0 ? 'SUCCESS' : conflicts.length > 3 ? 'FAILED' : 'PARTIAL',
      details: JSON.stringify({
        acknowledgedCount: acknowledged.length,
        conflicts: conflicts.map(c => ({
          key: c.conversationKey,
          type: c.conflictType,
        })),
      }),
      durationMs: Date.now() - startMs,
    },
  });

  // ── Step 8: Create conflict records for unresolved conflicts ─────────
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      await prisma.syncConflict.create({
        data: {
          syncLogId: syncLog.id,
          userId,
          conversationKey: conflict.conversationKey,
          personaIds: conflict.personaIds,
          localSnapshot: conflict.localSnapshot as any,
          serverSnapshot: conflict.serverSnapshot as any,
          conflictType: conflict.conflictType as any,
        },
      });
    }
  }

  const durationMs = Date.now() - startMs;

  return {
    success: true,
    pullConversations,
    acknowledged,
    conflicts: conflicts.map(c => ({
      ...c,
      localSnapshot: c.localSnapshot,
      serverSnapshot: c.serverSnapshot,
    })),
    syncToken: newSyncToken,
    stats: {
      pushed: toPush.length,
      pulled: pullConversations.length,
      conflicts: conflicts.length,
      durationMs,
    },
  };
}

/**
 * Push local conversations to the server (lightweight, for real-time sync)
 */
export async function pushConversations(
  userId: string,
  deviceId: string,
  snapshots: LocalConversationSnapshot[]
): Promise<{ success: boolean; acknowledged: string[] }> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId) {
    return { success: false, acknowledged: [] };
  }

  const acknowledged: string[] = [];
  for (const snapshot of snapshots) {
    await upsertLocalConversation(device.id, snapshot);
    acknowledged.push(snapshot.conversationKey);
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastActiveAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  return { success: true, acknowledged };
}

/**
 * Pull server conversations for a specific device (for initial load or manual refresh)
 */
export async function pullConversationsForDevice(
  userId: string,
  deviceId: string
): Promise<{ conversations: PullItem[]; syncToken: string | null }> {
  // deviceId IS the Device.id (browser fingerprint)
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId) {
    return { conversations: [], syncToken: null };
  }

  // LocalConversation.deviceId is the Prisma FK column → references Device.id
  const serverSnapshots = await prisma.localConversation.findMany({
    where: { deviceId: device.id },
  });

  const conversations: PullItem[] = [];
  for (const server of serverSnapshots) {
    const messages = await getServerMessages(
      server.syncedConversationId,
      server.conversationKey,
      server.personaIds
    );
    conversations.push({
      conversationKey: server.conversationKey,
      personaIds: server.personaIds,
      title: server.localTitle || undefined,
      tags: server.localTags,
      messages,
      serverUpdatedAt: server.lastLocalUpdateAt.toISOString(),
      isNew: true,
    });
  }

  return {
    conversations,
    syncToken: device.syncToken,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

async function upsertLocalConversation(
  deviceId: string,
  snapshot: LocalConversationSnapshot
): Promise<void> {
  // First check if there's a server conversation record for this key
  const existing = await prisma.localConversation.findUnique({
    where: {
      deviceId_conversationKey: {
        deviceId,
        conversationKey: snapshot.conversationKey,
      },
    },
  });

  // Create or find the actual Conversation record
  let conversationId: string | null = existing?.syncedConversationId || null;

  if (!conversationId && snapshot.messages && snapshot.messages.length > 0) {
    // First time this conversation is synced → create Conversation + Messages in DB
    conversationId = await createServerConversation(
      snapshot.conversationKey,
      snapshot.personaIds,
      snapshot.title,
      snapshot.tags,
      snapshot.messages,
      deviceId
    );
  } else if (conversationId && snapshot.messages && snapshot.messages.length > 0) {
    // Update existing conversation with new messages
    await updateServerConversation(
      conversationId,
      snapshot.messages,
      snapshot.lastMessageAt
    );
  }

  // Upsert the local conversation snapshot
  await prisma.localConversation.upsert({
    where: {
      deviceId_conversationKey: {
        deviceId,
        conversationKey: snapshot.conversationKey,
      },
    },
    create: {
      deviceId,
      conversationKey: snapshot.conversationKey,
      personaIds: snapshot.personaIds,
      localTitle: snapshot.title || null,
      localTags: snapshot.tags || [],
      localMessageCount: snapshot.messageCount,
      contentHash: extractMessageHash(snapshot),
      lastLocalUpdateAt: snapshot.lastMessageAt ? new Date(snapshot.lastMessageAt) : new Date(),
      syncedConversationId: conversationId,
    },
    update: {
      personaIds: snapshot.personaIds,
      localTitle: snapshot.title || null,
      localTags: snapshot.tags || [],
      localMessageCount: snapshot.messageCount,
      contentHash: extractMessageHash(snapshot),
      lastLocalUpdateAt: snapshot.lastMessageAt ? new Date(snapshot.lastMessageAt) : new Date(),
      syncedConversationId: conversationId,
    },
  });
}

async function createServerConversation(
  conversationKey: string,
  personaIds: string[],
  title: string | undefined,
  tags: string[] | undefined,
  messages: SyncMessage[],
  deviceId: string
): Promise<string> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error('Device not found');

  const conversationId = nanoid();

  // Create the conversation
  await prisma.conversation.create({
    data: {
      id: conversationId,
      userId: device.userId,
      title: title || null,
      mode: 'solo',
      participants: personaIds,
      personaIds,
      archived: false,
      tags: tags || [],
      messageCount: messages.length,
    },
  });

  // Create messages
  const messageRecords = messages.map(msg => ({
    id: msg.id || nanoid(),
    conversationId,
    userId: device.userId,
    role: (msg.role as string) === 'agent' ? 'assistant' : msg.role,
    content: msg.content,
    personaId: msg.personaId || null,
    source: 'web',
    createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }));

  if (messageRecords.length > 0) {
    await prisma.message.createMany({
      data: messageRecords,
      skipDuplicates: true,
    });
  }

  return conversationId;
}

async function updateServerConversation(
  conversationId: string,
  messages: SyncMessage[],
  lastMessageAt: string
): Promise<void> {
  // Upsert messages (skip duplicates)
  const messageRecords = messages.map(msg => ({
    id: msg.id || nanoid(),
    conversationId,
    userId: '', // filled by conversation lookup
    role: (msg.role as string) === 'agent' ? 'assistant' : msg.role,
    content: msg.content,
    personaId: msg.personaId || null,
    source: 'web',
    createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }));

  if (messageRecords.length > 0) {
    await prisma.message.createMany({
      data: messageRecords,
      skipDuplicates: true,
    });
  }

  // Update conversation stats
  const totalMessages = await prisma.message.count({ where: { conversationId } });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messageCount: totalMessages,
      updatedAt: lastMessageAt ? new Date(lastMessageAt) : new Date(),
    },
  });
}

async function getServerMessages(
  conversationId: string | null,
  _conversationKey: string,
  _personaIds: string[]
): Promise<SyncMessage[]> {
  if (!conversationId) return [];

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      personaId: true,
      createdAt: true,
    },
  });

  return messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
    personaId: m.personaId || undefined,
    timestamp: m.createdAt.toISOString(),
  }));
}

function detectConflict(
  local: LocalConversationSnapshot,
  server: LocalConversationSnapshot
): ConflictItem {
  const conflictType: ConflictItem['conflictType'] =
    local.messageCount === 0 || server.messageCount === 0
      ? 'DELETED_CONFLICT'
      : local.title !== server.title
        ? 'TITLE_CONFLICT'
        : 'CONTENT_OVERWRITE';

  // Build suggested merge: interleave by timestamp
  const suggestedMerge = buildSuggestedMerge(local.messages || [], server.messages || []);

  return {
    conversationKey: local.conversationKey,
    personaIds: local.personaIds,
    localSnapshot: local,
    serverSnapshot: server,
    conflictType,
    suggestedMerge,
  };
}

/**
 * Build a merged message list by interleaving local and server messages by timestamp.
 * This is the default resolution strategy.
 */
function buildSuggestedMerge(
  localMessages: SyncMessage[],
  serverMessages: SyncMessage[]
): SyncMessage[] {
  const all: SyncMessage[] = [
    ...localMessages,
    ...serverMessages,
  ];

  return all
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    })
    .filter((msg, idx, arr) => {
      // Deduplicate by ID if same message appears on both sides
      if (!msg.id) return true;
      return idx === arr.findIndex(m => m.id === msg.id);
    });
}

/**
 * Resolve a conflict with a given strategy.
 */
export async function resolveConflict(
  userId: string,
  conversationKey: string,
  strategy: 'SERVER_WINS' | 'LOCAL_WINS' | 'MERGE_APPEND' | 'USER_DECIDES',
  resolvedMessages?: SyncMessage[]
): Promise<{ success: boolean }> {
  const conflict = await prisma.syncConflict.findFirst({
    where: {
      conversationKey,
      syncLog: { userId },
    },
    include: { syncLog: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!conflict) return { success: false };

  const resolvedAt = new Date();

  if (resolvedMessages) {
    // User decided — use their custom merged messages
    // This would need the full device + conversation context to upsert
    // For now, just mark as resolved
  }

  await prisma.syncConflict.update({
    where: { id: conflict.id },
    data: {
      resolution: strategy,
      resolvedAt,
    },
  });

  return { success: true };
}

// ─── Visitor → Registered User Migration ────────────────────────────────────

/**
 * Migrate conversations from a visitor session to a registered user account.
 * Called when a guest user signs up / logs in.
 *
 * @param userId — the newly authenticated user's ID
 * @param visitorId — the anonymous visitor ID from localStorage
 * @param migrationSnapshots — conversations from localStorage to migrate
 */
export async function migrateVisitorConversations(
  userId: string,
  visitorId: string,
  migrationSnapshots: LocalConversationSnapshot[]
): Promise<{ migrated: number; conflicts: number }> {
  let migrated = 0;
  let conflicts = 0;

  // Check if user already has conversations with the same keys
  const existingConversations = await prisma.conversation.findMany({
    where: { userId },
    include: { messages: true },
  });

  const existingKeys = new Set(
    existingConversations.map(c => {
      const ids = c.personaIds || [];
      return [...ids].sort().join('-');
    })
  );

  for (const snapshot of migrationSnapshots) {
    if (existingKeys.has(snapshot.conversationKey)) {
      // Conflict: user already has this conversation → merge
      const existing = existingConversations.find(c => {
        const ids = c.personaIds || [];
        return [...ids].sort().join('-') === snapshot.conversationKey;
      });

      if (existing && snapshot.messages) {
        // Merge: add local messages to existing conversation
        const existingIds = new Set(existing.messages.map(m => m.id));
        const newMessages = snapshot.messages
          .filter(m => !existingIds.has(m.id))
          .map(msg => ({
            id: msg.id || nanoid(),
            conversationId: existing.id,
            userId,
            role: (msg.role as string) === 'agent' ? 'assistant' : msg.role,
            content: msg.content,
            personaId: msg.personaId || null,
            source: 'web',
            createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          }));

        if (newMessages.length > 0) {
          await prisma.message.createMany({ data: newMessages, skipDuplicates: true });
        }

        await prisma.conversation.update({
          where: { id: existing.id },
          data: {
            messageCount: existing.messages.length + newMessages.length,
            title: snapshot.title || existing.title || null,
          },
        });
      }
      conflicts++;
    } else {
      // No conflict → create new conversation
      if (snapshot.messages && snapshot.messages.length > 0) {
        await createServerConversation(
          snapshot.conversationKey,
          snapshot.personaIds,
          snapshot.title,
          snapshot.tags,
          snapshot.messages,
          '' // no device for migrated conversations
        );

        await prisma.conversationMigration.create({
          data: {
            userId,
            visitorId,
            conversationKey: snapshot.conversationKey,
            personaIds: snapshot.personaIds,
            messageCount: snapshot.messageCount,
            messagesJson: JSON.stringify(snapshot.messages || []),
            status: 'completed',
            completedAt: new Date(),
          },
        });

        migrated++;
      }
    }
  }

  return { migrated, conflicts };
}
