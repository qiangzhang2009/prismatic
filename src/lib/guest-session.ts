'use client';

/**
 * Prismatic — Guest Session Manager
 * Simple localStorage-based session for no-auth mode
 * Provides persistent user preferences without requiring sign-up
 */

import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

const SESSION_KEY = 'prismatic_guest_session';
const PREFERENCES_KEY = 'prismatic_preferences';
const CONVERSATIONS_KEY = 'prismatic_conversations';

export interface GuestSession {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface GuestPreferences {
  defaultMode: 'solo' | 'prism' | 'roundtable' | 'mission';
  favoritePersonas: string[];
  language: 'zh' | 'en';
  theme: 'dark' | 'light';
}

export interface GuestConversation {
  id: string;
  mode: string;
  participants: string[];
  title?: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

function createGuestSession(): GuestSession {
  return {
    id: nanoid(16),
    name: `访客_${nanoid(4)}`,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

function createDefaultPreferences(): GuestPreferences {
  return {
    defaultMode: 'solo',
    favoritePersonas: [],
    language: 'zh',
    theme: 'dark',
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useGuestSession() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [preferences, setPreferences] = useState<GuestPreferences>(createDefaultPreferences());
  const [conversations, setConversations] = useState<GuestConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(SESSION_KEY);
      const storedPrefs = localStorage.getItem(PREFERENCES_KEY);
      const storedConvs = localStorage.getItem(CONVERSATIONS_KEY);

      if (storedSession) {
        const sess = JSON.parse(storedSession) as GuestSession;
        // Update last active
        sess.lastActiveAt = new Date().toISOString();
        setSession(sess);
        localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      } else {
        // Auto-create guest session
        const newSession = createGuestSession();
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
        setSession(newSession);
      }

      if (storedPrefs) {
        setPreferences(JSON.parse(storedPrefs));
      }

      if (storedConvs) {
        setConversations(JSON.parse(storedConvs));
      }
    } catch (e) {
      console.warn('[GuestSession] localStorage read error:', e);
    }
    setIsLoading(false);
  }, []);

  // ── Session ──────────────────────────────────────────────────────────────────

  const updateSession = useCallback((updates: Partial<GuestSession>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates, lastActiveAt: new Date().toISOString() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Preferences ───────────────────────────────────────────────────────────────

  const updatePreferences = useCallback((updates: Partial<GuestPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Conversations ─────────────────────────────────────────────────────────────

  const createConversation = useCallback(
    (data: { mode: string; participants: string[]; title?: string }) => {
      const conv: GuestConversation = {
        id: nanoid(16),
        mode: data.mode,
        participants: data.participants,
        title: data.title,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archived: false,
      };
      setConversations((prev) => {
        const updated = [conv, ...prev];
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        return updated;
      });
      return conv;
    },
    []
  );

  const updateConversation = useCallback(
    (id: string, updates: Partial<GuestConversation>) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        );
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addMessage = useCallback(
    (conversationId: string, message: any) => {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            messages: [...c.messages, message],
            updatedAt: new Date().toISOString(),
          };
        });
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  // ── Toggle Favorite ──────────────────────────────────────────────────────────

  const toggleFavorite = useCallback((personaId: string) => {
    setPreferences((prev) => {
      const favorites = prev.favoritePersonas.includes(personaId)
        ? prev.favoritePersonas.filter((id) => id !== personaId)
        : [...prev.favoritePersonas, personaId];
      const updated = { ...prev, favoritePersonas: favorites };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    totalConversations: conversations.filter((c) => !c.archived).length,
    favoriteCount: preferences.favoritePersonas.length,
    daysSinceCreation: session
      ? Math.floor(
          (Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0,
  };

  return {
    session,
    preferences,
    conversations: conversations.filter((c) => !c.archived),
    isLoading,
    stats,
    updateSession,
    updatePreferences,
    toggleFavorite,
    createConversation,
    updateConversation,
    deleteConversation,
    addMessage,
  };
}
