/**
 * Prismatic — Tracking System
 * Stores user behavior events directly in the same Neon PostgreSQL database.
 * Used by the Prismatic analytics dashboard.
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

// Prismatic's tenant UUID (inserted via migration)
const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

// ─── Health Check ──────────────────────────────────────────────────────────────

export async function isTrackingConfigured(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ─── Insert Prismatic Persona Event ──────────────────────────────────────────

export async function insertPrismaticEvent(data: {
  sessionId?: string;
  visitorId?: string;
  personaId?: string;
  personaName?: string;
  domain?: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  aiLatencyMs?: number;
  modelUsed?: string;
  confidenceScore?: number;
  conversationTurn?: number;
  mode?: string;
}): Promise<string | null> {
  if (!sql) return null;

  const rows = await sql`
    INSERT INTO public.prismatic_events
      (tenant_id, session_id, visitor_id, persona_id, persona_name, domain,
       event_type, event_data, ai_latency_ms, model_used, confidence_score,
       conversation_turn, mode, chat_start_time)
    VALUES (
      ${PRISMATIC_TENANT_ID},
      ${data.sessionId ?? null},
      ${data.visitorId ?? null},
      ${data.personaId ?? null},
      ${data.personaName ?? null},
      ${data.domain ?? null},
      ${data.eventType},
      ${JSON.stringify(data.eventData ?? {})},
      ${data.aiLatencyMs ?? null},
      ${data.modelUsed ?? null},
      ${data.confidenceScore ?? null},
      ${data.conversationTurn ?? 0},
      ${data.mode ?? null},
      CASE WHEN ${data.eventType} = 'chat_start' THEN NOW() ELSE NULL END
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

// ─── Insert Page Event ─────────────────────────────────────────────────────────

export async function insertPageEvent(data: {
  sessionId: string;
  visitorId: string;
  eventType?: string;
  urlPath?: string;
  urlQuery?: string;
  eventData?: Record<string, unknown>;
  sessionDurationMs?: number;
  isFirstVisit?: boolean;
  isReturningVisit?: boolean;
  timezone?: string;
  trafficSource?: string;
  hostname?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  country?: string;
  subdivision1?: string;
  city?: string;
  referrerDomain?: string;
}): Promise<string | null> {
  if (!sql) return null;

  const rows = await sql`
    INSERT INTO public.page_events
      (tenant_id, session_id, visitor_id, event_type, url_path,
       url_query, event_data, session_duration_ms, is_first_visit,
       is_returning_visit, timezone, traffic_source, hostname,
       browser, os, device_type, country, subdivision1, city, referrer_domain)
    VALUES (
      ${PRISMATIC_TENANT_ID},
      ${data.sessionId},
      ${data.visitorId},
      ${data.eventType ?? 'pageview'},
      ${data.urlPath ?? null},
      ${data.urlQuery ?? null},
      ${JSON.stringify(data.eventData ?? {})},
      ${data.sessionDurationMs ?? null},
      ${data.isFirstVisit ?? false},
      ${data.isReturningVisit ?? false},
      ${data.timezone ?? null},
      ${data.trafficSource ?? null},
      ${data.hostname ?? null},
      ${data.browser ?? null},
      ${data.os ?? null},
      ${data.deviceType ?? 'desktop'},
      ${data.country ?? null},
      ${data.subdivision1 ?? null},
      ${data.city ?? null},
      ${data.referrerDomain ?? null}
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

// ─── Upsert Session ────────────────────────────────────────────────────────────

export async function upsertSession(data: {
  sessionId: string;
  visitorId: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  country?: string;
}): Promise<string | null> {
  if (!sql) return null;

  const rows = await sql`
    INSERT INTO public.sessions
      (tenant_id, session_id, visitor_id, browser, os, device_type, country,
       first_visit, last_visit, page_count)
    VALUES (
      ${PRISMATIC_TENANT_ID},
      ${data.sessionId},
      ${data.visitorId},
      ${data.browser ?? null},
      ${data.os ?? null},
      ${data.deviceType ?? 'desktop'},
      ${data.country ?? null},
      NOW(), NOW(), 1
    )
    ON CONFLICT (session_id)
    DO UPDATE SET
      last_visit = NOW(),
      page_count = sessions.page_count + 1
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

// ─── Overview Stats ────────────────────────────────────────────────────────────

export async function getTrackingOverview(days: number = 7): Promise<{
  dau: number; wau: number; mau: number;
  sessions: number; totalEvents: number;
  totalPersonas: number; totalConversations: number;
}> {
  if (!sql) return { dau: 0, wau: 0, mau: 0, sessions: 0, totalEvents: 0, totalPersonas: 0, totalConversations: 0 };

  const [dauResult, wauResult, mauResult, sessionsResult, eventsResult, personasResult, conversationsResult] = await Promise.all([
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.page_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND created_at > NOW() - INTERVAL '1 day' AND event_type = 'pageview'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.page_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND created_at > NOW() - INTERVAL '7 days' AND event_type = 'pageview'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.page_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND created_at > NOW() - INTERVAL '30 days' AND event_type = 'pageview'`,
    sql`SELECT COUNT(DISTINCT session_id)::int as count FROM public.page_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(*)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT persona_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'persona_view' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT session_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'chat_start' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
  ]);

  return {
    dau: dauResult[0]?.count ?? 0,
    wau: wauResult[0]?.count ?? 0,
    mau: mauResult[0]?.count ?? 0,
    sessions: sessionsResult[0]?.count ?? 0,
    totalEvents: eventsResult[0]?.count ?? 0,
    totalPersonas: personasResult[0]?.count ?? 0,
    totalConversations: conversationsResult[0]?.count ?? 0,
  };
}

// ─── Persona Stats ─────────────────────────────────────────────────────────────

export async function getTrackingPersonas(days: number = 30, limit: number = 50): Promise<Array<{
  personaId: string; personaName: string; domain: string;
  views: number; conversations: number; avgTurns: number; graphClicks: number;
}>> {
  if (!sql) return [];

  const rows = await sql`
    SELECT
      persona_id,
      persona_name,
      COALESCE(domain, '') as domain,
      COUNT(CASE WHEN event_type = 'persona_view' THEN 1 END)::int as views,
      COUNT(CASE WHEN event_type = 'chat_start' THEN 1 END)::int as conversations,
      COALESCE(ROUND(AVG(CASE WHEN event_type = 'chat_message' THEN conversation_turn END)::numeric, 1), 0) as avg_turns,
      COUNT(CASE WHEN event_type = 'graph_node_click' THEN 1 END)::int as graph_clicks
    FROM public.prismatic_events
    WHERE tenant_id = ${PRISMATIC_TENANT_ID}
      AND created_at > NOW() - INTERVAL '${String(days)} days'
      AND persona_id IS NOT NULL
    GROUP BY persona_id, persona_name, domain
    ORDER BY views DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    personaId: String(r.persona_id ?? ''),
    personaName: String(r.persona_name ?? ''),
    domain: String(r.domain ?? ''),
    views: Number(r.views),
    conversations: Number(r.conversations),
    avgTurns: parseFloat(String(r.avg_turns)) || 0,
    graphClicks: Number(r.graph_clicks),
  }));
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export async function getTrackingFunnel(days: number = 30): Promise<Array<{ name: string; count: number; rate: number }>> {
  if (!sql) return [
    { name: '入口页浏览', count: 0, rate: 100 },
    { name: '人物浏览', count: 0, rate: 0 },
    { name: '对话开始', count: 0, rate: 0 },
    { name: '思维模型展开', count: 0, rate: 0 },
    { name: '图谱探索', count: 0, rate: 0 },
  ];

  const [totalVisitors, personaViews, chatStarts, modelExpands, graphClicks] = await Promise.all([
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.page_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'pageview' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'persona_view' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'chat_start' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'model_expand' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM public.prismatic_events WHERE tenant_id = ${PRISMATIC_TENANT_ID} AND event_type = 'graph_node_click' AND created_at > NOW() - INTERVAL '${String(days)} days'`,
  ]);

  const total = totalVisitors[0]?.count || 1;
  const toPercent = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return [
    { name: '入口页浏览', count: totalVisitors[0]?.count || 0, rate: 100 },
    { name: '人物浏览', count: personaViews[0]?.count || 0, rate: toPercent(personaViews[0]?.count || 0) },
    { name: '对话开始', count: chatStarts[0]?.count || 0, rate: toPercent(chatStarts[0]?.count || 0) },
    { name: '思维模型展开', count: modelExpands[0]?.count || 0, rate: toPercent(modelExpands[0]?.count || 0) },
    { name: '图谱探索', count: graphClicks[0]?.count || 0, rate: toPercent(graphClicks[0]?.count || 0) },
  ];
}

// ─── Visitor Profiles ──────────────────────────────────────────────────────────

export async function getTrackingVisitors(limit: number = 100): Promise<Array<{
  visitor_id: string; visit_count: number; total_duration_seconds: number;
  first_visit: string; last_visit: string; device_type: string; country: string;
}>> {
  if (!sql) return [];

  const rows = await sql`
    SELECT
      visitor_id,
      COUNT(*)::int as visit_count,
      SUM(session_duration_ms)::int / 1000 as total_duration_seconds,
      MIN(created_at) as first_visit,
      MAX(created_at) as last_visit,
      MAX(device_type) as device_type,
      MAX(country) as country
    FROM public.page_events
    WHERE tenant_id = ${PRISMATIC_TENANT_ID}
      AND visitor_id IS NOT NULL
    GROUP BY visitor_id
    ORDER BY visit_count DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    visitor_id: String(r.visitor_id ?? ''),
    visit_count: Number(r.visit_count),
    total_duration_seconds: Number(r.total_duration_seconds) || 0,
    first_visit: String(r.first_visit ?? ''),
    last_visit: String(r.last_visit ?? ''),
    device_type: String(r.device_type ?? 'unknown'),
    country: String(r.country ?? ''),
  }));
}

// ─── Trend ────────────────────────────────────────────────────────────────────

export async function getTrackingTrend(days: number = 7): Promise<Array<{
  date: string; dau: number; sessions: number; pageviews: number;
}>> {
  if (!sql) {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      result.push({ date: d.toISOString().split('T')[0], dau: 0, sessions: 0, pageviews: 0 });
    }
    return result;
  }

  const rows = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(DISTINCT visitor_id)::int as dau,
      COUNT(DISTINCT session_id)::int as sessions,
      COUNT(CASE WHEN event_type = 'pageview' THEN 1 END)::int as pageviews
    FROM public.page_events
    WHERE tenant_id = ${PRISMATIC_TENANT_ID}
      AND created_at > NOW() - INTERVAL '${String(days)} days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return rows.map((r: Record<string, unknown>) => ({
    date: String(r.date ?? ''),
    dau: Number(r.dau),
    sessions: Number(r.sessions),
    pageviews: Number(r.pageviews),
  }));
}

// ─── Device Stats ─────────────────────────────────────────────────────────────

export async function getTrackingDeviceStats(days: number = 30): Promise<Array<{
  device_type: string; count: number; percentage: number;
}>> {
  if (!sql) return [];

  const rows = await sql`
    SELECT
      COALESCE(device_type, 'unknown') as device_type,
      COUNT(*)::int as count
    FROM public.page_events
    WHERE tenant_id = ${PRISMATIC_TENANT_ID}
      AND created_at > NOW() - INTERVAL '${String(days)} days'
    GROUP BY device_type
    ORDER BY count DESC
  `;

  const total = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.count), 0) || 1;
  return rows.map((r: Record<string, unknown>) => ({
    device_type: String(r.device_type ?? 'unknown'),
    count: Number(r.count),
    percentage: Math.round((Number(r.count) / total) * 100),
  }));
}

// ─── Content Health ────────────────────────────────────────────────────────────

export async function getTrackingContentHealth(days: number = 30, limit: number = 50): Promise<Array<{
  url_path: string; pv: number; uv: number; bounceRate: number; avgScrollDepth: number;
}>> {
  if (!sql) return [];

  const rows = await sql`
    SELECT
      url_path,
      COUNT(*)::int as pv,
      COUNT(DISTINCT visitor_id)::int as uv,
      ROUND(
        COUNT(CASE WHEN page_count = 1 THEN 1 END)::numeric /
        NULLIF(COUNT(DISTINCT session_id), 0) * 100, 1
      ) as bounce_rate
    FROM public.page_events
    WHERE tenant_id = ${PRISMATIC_TENANT_ID}
      AND event_type = 'pageview'
      AND url_path IS NOT NULL
      AND created_at > NOW() - INTERVAL '${String(days)} days'
    GROUP BY url_path
    ORDER BY pv DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    url_path: String(r.url_path ?? ''),
    pv: Number(r.pv),
    uv: Number(r.uv),
    bounceRate: parseFloat(String(r.bounce_rate)) || 0,
    avgScrollDepth: 0,
  }));
}
