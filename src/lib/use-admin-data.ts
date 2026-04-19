/**
 * Prismatic — Admin Data Hooks (React Query)
 *
 * 提供管理员后台所需的数据获取 hooks，使用 React Query 管理服务器状态。
 * 替代原来在组件中直接 fetch 的模式。
 */

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { CapacityReport } from '@/lib/admin/capacity-monitor';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
export type SubscriptionPlan = 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  status: UserStatus;
  plan: SubscriptionPlan;
  credits: number;
  role?: string;
  createdAt: string;
  updatedAt: string;
  // 额外统计字段
  conversationCount?: number;
  messageCount?: number;
  lastActiveAt?: string;
}

export interface UserFilter {
  search?: string;
  status?: UserStatus | '';
  plan?: SubscriptionPlan | '';
  sortBy?: 'createdAt' | 'lastActive' | 'messageCount' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemOverview {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalMessages: number;
  totalConversations: number;
  totalApiCost: number;
  dau: number;
  mau: number;
  paidUsers: number;
  activeRate: number;
  dauMauRatio: number;
  totalMessagesWeek: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  targetUserId: string;
  action: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
  admin: { name?: string; email?: string };
  targetUser: { name?: string; email?: string };
}

export interface UserActivity {
  events: Array<{
    id: string;
    eventType: string;
    eventName: string;
    properties: string;
    context: string;
    personaName?: string;
    conversationId?: string;
    createdAt: string;
  }>;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    endedAt?: string;
    pageViews: number;
    messagesSent: number;
    deviceType?: string;
    country?: string;
  }>;
  metrics: Array<{
    statDate: string;
    messagesSent: number;
    personasUsedCount: number;
    timeSpentSeconds: number;
    lastConversationAt?: string;
  }>;
}

// ─── Shared API Fetcher ────────────────────────────────────────────────────────

export async function fetchAdminAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Users ─────────────────────────────────────────────────────────────────────

const usersKeys = {
  all: ['users'] as const,
  list: (filters?: UserFilter) => ['users', 'list', filters] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  activity: (id: string) => ['users', 'activity', id] as const,
};

export function useUsers(filters: UserFilter = {}) {
  const { page = 1, pageSize = 20, search, status, plan, sortBy, sortOrder } = filters;

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (plan) params.set('plan', plan);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);

  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: () => fetchAdminAPI<PaginatedResponse<User>>(`/api/admin/users?${params}`),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => fetchAdminAPI<User>(`/api/admin/users/${id}`),
    staleTime: 1000 * 60 * 2,
    enabled: !!id,
  });
}

export function useUserActivity(id: string) {
  return useQuery({
    queryKey: usersKeys.activity(id),
    queryFn: () => fetchAdminAPI<UserActivity>(`/api/admin/users/${id}/activity`),
    staleTime: 1000 * 60 * 5,
    enabled: !!id,
  });
}

// ─── User Mutations ─────────────────────────────────────────────────────────────

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      return fetchAdminAPI<User>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (updatedUser) => {
      // Invalidate user detail
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(updatedUser.id) });
      // Invalidate user list (to reflect status/plan changes)
      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return fetchAdminAPI<void>(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAddCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      return fetchAdminAPI<User>(`/api/admin/users/${id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(updatedUser.id) });
      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
    },
  });
}

// ─── System Overview ───────────────────────────────────────────────────────────

const overviewKeys = {
  all: ['system', 'overview'] as const,
};

export function useSystemOverview(days: number = 7) {
  return useQuery({
    queryKey: [...overviewKeys.all, days] as const,
    queryFn: () => fetchAdminAPI<SystemOverview>(`/api/admin/overview?days=${days}`),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ─── Audit Logs ────────────────────────────────────────────────────────────────

const auditKeys = {
  all: ['audit', 'logs'] as const,
  list: (limit: number, offset: number) => ['audit', 'logs', 'list', limit, offset] as const,
};

export function useAuditLogs(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: auditKeys.list(limit, offset),
    queryFn: () => fetchAdminAPI<{ logs: AuditLog[]; total: number }>(
      `/api/admin/audit?limit=${limit}&offset=${offset}`
    ),
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Analytics (Dashboard) ─────────────────────────────────────────────────────

const analyticsKeys = {
  overview: (days: number) => ['analytics', 'overview', days] as const,
  trend: (days: number) => ['analytics', 'trend', days] as const,
  personas: (days: number) => ['analytics', 'personas', days] as const,
};

export function useAnalyticsOverview(days: number = 7) {
  return useQuery({
    queryKey: analyticsKeys.overview(days),
    queryFn: () => fetchAdminAPI<SystemOverview>(`/api/analytics/overview?days=${days}`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAnalyticsTrend(days: number = 7) {
  return useQuery({
    queryKey: analyticsKeys.trend(days),
    queryFn: () => fetchAdminAPI<Array<{
      date: string;
      dau: number;
      sessions: number;
      messages: number;
      conversations: number;
    }>>(`/api/analytics/trend?days=${days}`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAnalyticsPersonas(days: number = 30) {
  return useQuery({
    queryKey: analyticsKeys.personas(days),
    queryFn: () => fetchAdminAPI<{ personas: Array<{
      personaId: string;
      personaName: string;
      views: number;
      conversations: number;
      avgTurns: number;
    }> }>(`/api/analytics/personas?days=${days}`),
    select: (data) => data.personas,
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Capacity Monitor ─────────────────────────────────────────────────────────

export function useCapacity() {
  return useQuery<CapacityReport>({
    queryKey: ['admin', 'capacity'],
    queryFn: () => fetchAdminAPI<CapacityReport>('/api/admin/capacity'),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

// ─── Prefetch Helpers ──────────────────────────────────────────────────────────

export function usePrefetchUser() {
  const queryClient = useQueryClient();

  return {
    prefetch: (id: string) => {
      queryClient.prefetchQuery({
        queryKey: usersKeys.detail(id),
        queryFn: () => fetchAdminAPI<User>(`/api/admin/users/${id}`),
        staleTime: 1000 * 60 * 2,
      });
    },
    prefetchActivity: (id: string) => {
      queryClient.prefetchQuery({
        queryKey: usersKeys.activity(id),
        queryFn: () => fetchAdminAPI<UserActivity>(`/api/admin/users/${id}/activity`),
        staleTime: 1000 * 60 * 5,
      });
    },
  };
}
