'use client';

/**
 * Persists chat messages to localStorage, keyed by conversation identity.
 * Each unique combination of selected personas gets its own conversation history.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentMessage } from '@/lib/types';

const STORAGE_VERSION = 2;

interface ConversationStore {
  version: number;
  messages: AgentMessage[];
  lastUpdated: number;
}

function getStorageKey(personaIds: string[]): string {
  const sorted = [...personaIds].sort().join('-');
  return `prismatic-convo-${sorted}`;
}

function loadConversation(personaIds: string[]): AgentMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(personaIds));
    if (!raw) return [];
    const store: ConversationStore = JSON.parse(raw);
    if (store.version !== STORAGE_VERSION) return [];
    return store.messages ?? [];
  } catch {
    return [];
  }
}

function saveConversation(personaIds: string[], messages: AgentMessage[]) {
  try {
    const store: ConversationStore = {
      version: STORAGE_VERSION,
      messages,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(getStorageKey(personaIds), JSON.stringify(store));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function deleteConversation(personaIds: string[]) {
  try {
    localStorage.removeItem(getStorageKey(personaIds));
  } catch {}
}

export function useChatHistory(personaIds: string[]) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => loadConversation(personaIds));
  const isInitialized = useRef(false);
  const prevIdsRef = useRef<string[]>(personaIds);
  const hasMessagesRef = useRef(false);

  // Load history when persona selection changes (only if no messages currently)
  useEffect(() => {
    const prev = prevIdsRef.current;
    const changed = prev.length !== personaIds.length ||
      prev.some((id, i) => id !== personaIds[i]);

    if (changed) {
      // Only switch history if current messages are empty
      // This prevents "accidental" history disappearance
      if (!hasMessagesRef.current) {
        prevIdsRef.current = personaIds;
        setMessages(loadConversation(personaIds));
      }
    }
  }, [personaIds]);

  // Track if we have messages
  useEffect(() => {
    hasMessagesRef.current = messages.length > 0;
  }, [messages]);

  // Initial mount: mark as initialized
  useEffect(() => {
    isInitialized.current = true;
  }, []);

  // Persist on every message change (after initialization)
  const setMessagesAndSave = useCallback((updater: (prev: AgentMessage[]) => AgentMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      if (isInitialized.current) {
        saveConversation(personaIds, next);
      }
      return next;
    });
  }, [personaIds]);

  const clearHistory = useCallback(() => {
    deleteConversation(personaIds);
    setMessages([]);
    hasMessagesRef.current = false;
  }, [personaIds]);

  return { messages, setMessages: setMessagesAndSave, clearHistory };
}
