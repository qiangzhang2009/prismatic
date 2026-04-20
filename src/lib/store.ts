/**
 * Prismatic — Global State Store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mode } from './types';

interface AppState {
  // Conversation
  currentMode: Mode;
  currentParticipants: string[];
  conversationId: string | null;
  messages: any[];

  // UI
  sidebarOpen: boolean;
  theme: 'dark' | 'light';

  // Favorites
  favoritePersonas: string[];
  recentConversations: { id: string; title: string; participants: string[]; updatedAt: string }[];

  // Actions
  setMode: (mode: Mode) => void;
  setParticipants: (ids: string[]) => void;
  addParticipant: (id: string) => void;
  removeParticipant: (id: string) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleFavorite: (id: string) => void;
  startConversation: (participants: string[], mode: Mode) => string;
  endConversation: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentMode: 'solo',
      currentParticipants: ['steve-jobs'],
      conversationId: null,
      messages: [],

      sidebarOpen: true,
      theme: 'dark',

      favoritePersonas: [],
      recentConversations: [],

      // Actions
      setMode: (mode) => set({ currentMode: mode }),

      setParticipants: (ids) => set({ currentParticipants: ids }),

      addParticipant: (id) =>
        set((state) => {
          if (state.currentParticipants.includes(id)) return state;
          const max = state.currentMode === 'prism' ? 3 : state.currentMode === 'roundtable' ? 8 : 6;
          if (state.currentParticipants.length >= max) return state;
          return { currentParticipants: [...state.currentParticipants, id] };
        }),

      removeParticipant: (id) =>
        set((state) => {
          const min = state.currentMode === 'solo' ? 1 : 2;
          if (state.currentParticipants.length <= min) return state;
          return { currentParticipants: state.currentParticipants.filter((i) => i !== id) };
        }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => set({ theme }),

      toggleFavorite: (id) =>
        set((state) => ({
          favoritePersonas: state.favoritePersonas.includes(id)
            ? state.favoritePersonas.filter((i) => i !== id)
            : [...state.favoritePersonas, id],
        })),

      startConversation: (participants, mode) => {
        const id = crypto.randomUUID();
        set({
          conversationId: id,
          currentParticipants: participants,
          currentMode: mode,
          messages: [],
        });
        return id;
      },

      endConversation: () =>
        set({
          conversationId: null,
          messages: [],
        }),
    }),
    {
      name: 'prismatic-storage',
      partialize: (state) => ({
        favoritePersonas: state.favoritePersonas,
        recentConversations: state.recentConversations,
        theme: state.theme,
      }),
    }
  )
);
