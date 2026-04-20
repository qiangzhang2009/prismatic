/**
 * Prismatic — Persona Library Hooks
 *
 * 提供蒸馏人物库的 React Query hooks，读取 DB 中的蒸馏结果。
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DistilledPersonaSummary {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: string;
  tagline: string;
  taglineZh: string;
  avatar: string | null;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  brief: string;
  briefZh: string;
  finalScore: number;
  qualityGrade: string;
  thresholdPassed: boolean;
  qualityGateSkipped: boolean;
  corpusItemCount: number;
  corpusTotalWords: number;
  corpusSources: unknown[];
  distillVersion: string;
  distillDate: Date | string;
  isPublished: boolean;
  createdAt: Date | string;
}

export interface PersonaLibraryResponse {
  items: DistilledPersonaSummary[];
  total: number;
  domains: string[];
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export function usePersonaLibrary(params?: {
  domain?: string;
  published?: boolean;
  search?: string;
  sortBy?: string;
  limit?: number;
}) {
  const { domain, published, search, sortBy, limit } = params ?? {};

  const searchParams = new URLSearchParams();
  if (domain) searchParams.set('domain', domain);
  if (published) searchParams.set('published', 'true');
  if (search) searchParams.set('search', search);
  if (sortBy) searchParams.set('sortBy', sortBy);
  if (limit) searchParams.set('limit', String(limit));

  const query = searchParams.toString();

  return useQuery({
    queryKey: ['persona-library', { domain, published, search, sortBy, limit }],
    queryFn: () =>
      fetch(`/api/persona-library${query ? `?${query}` : ''}`)
        .then(r => r.json() as Promise<PersonaLibraryResponse>),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDistilledPersona(slug: string) {
  return useQuery({
    queryKey: ['persona-library', slug],
    queryFn: () =>
      fetch(`/api/persona-library/${encodeURIComponent(slug)}`)
        .then(r => r.json()),
    enabled: !!slug,
    staleTime: 1000 * 60,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function usePublishPersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, isPublished }: { slug: string; isPublished: boolean }) => {
      const res = await fetch(`/api/persona-library/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      });
      if (!res.ok) throw new Error('Failed to update persona');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persona-library'] });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { slug: string } & Record<string, unknown>) => {
      const { slug, ...body } = data;
      const res = await fetch(`/api/persona-library/${encodeURIComponent(slug as string)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update persona');
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['persona-library'] });
      queryClient.invalidateQueries({ queryKey: ['persona-library', vars.slug] });
    },
  });
}
