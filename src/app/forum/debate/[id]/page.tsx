/**
 * Prismatic — Debate Detail Page (Server Component)
 * 智辩场 — 单场辩论详情
 */

import { getDebateById } from '@/lib/debate-arena-engine';
import { DebateArenaClient } from '../client';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function DebateDetailPage({ searchParams }: Props) {
  const params = await searchParams;
  const id = params.id;

  let debate = null;
  let error = null;

  if (id) {
    try {
      debate = await getDebateById(parseInt(id, 10));
    } catch (e) {
      error = '加载辩论详情失败';
      console.error('[Debate Detail Page]', e);
    }
  }

  return (
    <DebateArenaClient
      debate={debate}
      error={error ?? undefined}
    />
  );
}
