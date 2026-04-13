/**
 * Prismatic — Debate Arena Page (Server Component)
 * 智辩场 — 每日辩论围观页
 */

import { getDebateByDate } from '@/lib/debate-arena-engine';
import { DebateArenaClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DebateArenaPage() {
  let debate = null;
  let preview = null;
  let error = null;

  try {
    debate = await getDebateByDate();
    if (!debate) {
      // Import preview dynamically to avoid circular deps
      const { previewTodaysDebate } = await import('@/lib/debate-arena-engine');
      preview = await previewTodaysDebate();
    }
  } catch (e) {
    error = '加载辩论数据失败';
    console.error('[Debate Arena Page]', e);
  }

  return (
    <DebateArenaClient
      debate={debate}
      preview={preview ?? undefined}
      error={error ?? undefined}
    />
  );
}
