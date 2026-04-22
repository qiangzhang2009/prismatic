'use client';

/**
 * Prismatic — Distillation Admin Hooks (React Query)
 *
 * Provides React Query hooks for the distillation center in the admin panel.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  qualityGateSkipped?: boolean;
  newPersonaWithoutCorpus?: boolean;
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
  totalCost?: number;
  totalTokens?: number;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────────

const distillKeys = {
  all: ['distill'] as const,
  sessions: (status?: DistillStatus) => ['distill', 'sessions', status] as const,
  session: (id: string) => ['distill', 'session', id] as const,
};

// ─── Internal Fetcher ─────────────────────────────────────────────────────────

async function fetchDistillAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status} — 蒸馏服务不可用`);
  }
  return res.json();
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/distill — list all distillation sessions
 */
export function useDistillSessions(status?: DistillStatus) {
  return useQuery({
    queryKey: distillKeys.sessions(status),
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const data = await fetchDistillAPI<{
        items: DistillSession[];
        total: number;
        byStatus: Record<string, number>;
      }>(`/api/admin/distill${params}`);
      return Array.isArray(data.items) ? data.items : [];
    },
    staleTime: 1000 * 30,
    refetchInterval: 5000,
  });
}

/**
 * GET /api/admin/distill/[sessionId] — get single session detail
 */
export function useDistillSession(sessionId: string) {
  return useQuery({
    queryKey: distillKeys.session(sessionId),
    queryFn: async () => {
      return fetchDistillAPI<DistillSession>(`/api/admin/distill/${sessionId}`);
    },
    staleTime: 1000 * 5,
    refetchInterval: 3000,
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
      return fetchDistillAPI<{ sessionId: string; status: string }>(
        '/api/admin/distill',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
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
      return fetchDistillAPI<void>(`/api/admin/distill/${sessionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: distillKeys.all });
    },
  });
}
