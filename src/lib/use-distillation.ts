/**
 * Prismatic — Distillation Admin Hooks (React Query)
 *
 * 提供蒸馏系统管理员后台所需的 React Query hooks。
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAdminAPI } from './use-admin-data';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DistillStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DistillationOptions {
  qualityThreshold?: number;
  maxIterations?: number;
  autoApprove?: boolean;
  maxCost?: number;
  language?: string;
}

export interface DistillScoreBreakdown {
  voiceFidelity: number;
  knowledgeDepth: number;
  reasoningPattern: number;
  safetyCompliance: number;
}

export interface DistillSessionScoreBreakdown {
  voiceFidelity: number;
  knowledgeDepth: number;
  reasoningPattern: number;
  safetyCompliance: number;
}

export interface DistillScoreFinding {
  id: string;
  severity: string;
  title: string;
  category: string;
  fixSuggestion: string;
}

export interface DistillScore {
  overall: number;
  grade: string;
  breakdown: DistillScoreBreakdown;
  findings: DistillScoreFinding[];
}

export interface DistillCorpusStats {
  totalWords: number;
  sources: string[];
  qualityScore: number;
}

export interface DistillResult {
  finalScore: number;
  thresholdPassed: boolean;
  deploymentStatus: 'ready' | 'needs-review' | 'needs-work';
  iterations: number;
  totalCost: number;
  totalTokens: number;
  personaType: string;
  qualityThreshold: number;
  corpusStats: DistillCorpusStats;
  score: DistillScore;
}

export interface DistillSession {
  id: string;
  personaName: string;
  personaId?: string;
  status: DistillStatus;
  options?: DistillationOptions;
  createdAt: string;
  completedAt?: string;
  result?: DistillResult;
  error?: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────────

const distillKeys = {
  all: ['distill'] as const,
  sessions: (status?: DistillStatus) => ['distill', 'sessions', status] as const,
  session: (id: string) => ['distill', 'session', id] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/distill — list all distillation sessions
 */
export function useDistillSessions(status?: DistillStatus) {
  return useQuery({
    queryKey: distillKeys.sessions(status),
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await fetchAdminAPI<{ items: DistillSession[]; total: number; byStatus: Record<string, number> }>(`/api/admin/distill${params}`);
      return Array.isArray(res.items) ? res.items : [];
    },
    staleTime: 1000 * 30,
  });
}

/**
 * GET /api/admin/distill/[sessionId] — get single session detail
 */
export function useDistillSession(sessionId: string) {
  return useQuery({
    queryKey: distillKeys.session(sessionId),
    queryFn: async () => {
      const res = await fetchAdminAPI<DistillSession>(`/api/admin/distill/${sessionId}`);
      return res;
    },
    staleTime: 1000 * 10,
    enabled: !!sessionId,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/distill — start a new distillation session
 */
export function useStartDistillation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      personaName: string;
      personaId?: string;
      options?: DistillationOptions;
    }) => {
      return fetchAdminAPI<DistillSession>('/api/admin/distill', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distillKeys.all });
    },
  });
}

/**
 * DELETE /api/admin/distill/[sessionId] — cancel a distillation session
 */
export function useCancelDistillation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return fetchAdminAPI<void>(`/api/admin/distill/${sessionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distillKeys.all });
    },
  });
}

// ─── Prefetch Helpers ──────────────────────────────────────────────────────────

export function usePrefetchDistillSession() {
  const queryClient = useQueryClient();

  return {
    prefetch: (sessionId: string) => {
      queryClient.prefetchQuery({
        queryKey: distillKeys.session(sessionId),
        queryFn: () => fetchAdminAPI<DistillSession>(`/api/admin/distill/${sessionId}`),
        staleTime: 1000 * 10,
      });
    },
  };
}
