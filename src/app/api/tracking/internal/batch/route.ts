/**
 * POST /api/tracking/internal/batch — Batch tracking events from SDK
 * Receives batched events from zxqTrackV2 SDK and processes them individually.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  insertPrismaticEvent,
  insertPageEvent,
  upsertSession,
  isTrackingConfigured,
} from '@/lib/tracking';

export async function POST(req: NextRequest) {
  try {
    const { events } = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const configured = await isTrackingConfigured();
    if (!configured) {
      return NextResponse.json({ success: false, reason: 'not configured', processed: 0 }, { status: 200 });
    }

    let processed = 0;
    for (const event of events) {
      try {
        const eventType = event.event_type;
        const visitorId = event.visitor_id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const sessionId = event.session_id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Always upsert session
        await upsertSession({
          sessionId,
          visitorId,
          browser: event.browser || undefined,
          os: event.os || undefined,
          deviceType: event.device_type || 'desktop',
          country: event.geo_country || undefined,
        });

        // Handle persona events
        if (['persona_view', 'chat_start', 'chat_message', 'model_expand', 'graph_node_click', 'mode_switch'].includes(eventType)) {
          await insertPrismaticEvent({
            sessionId,
            visitorId,
            personaId: event.persona_id,
            domain: event.domain,
            eventType,
            eventData: event.event_data || {},
            aiLatencyMs: event.ai_latency_ms ? Number(event.ai_latency_ms) : undefined,
            modelUsed: event.model_used || undefined,
            confidenceScore: event.confidence_score ? parseFloat(String(event.confidence_score)) : undefined,
            conversationTurn: event.turn ? Number(event.turn) : undefined,
            mode: event.mode || undefined,
          });
        }

        // Handle page events
        if (['page_view', 'pageview', 'page_leave', 'scroll', 'click', 'heartbeat'].includes(eventType)) {
          await insertPageEvent({
            sessionId,
            visitorId,
            eventType: eventType === 'pageview' ? 'page_view' : eventType,
            urlPath: event.page_path || (event.page_url ? new URL(event.page_url).pathname : undefined),
            eventData: event.event_data || {},
            timezone: event.timezone || undefined,
            trafficSource: event.traffic_source || undefined,
            hostname: event.hostname || (event.page_url ? new URL(event.page_url).hostname : undefined),
            browser: event.browser || undefined,
            os: event.os || undefined,
            deviceType: event.device_type || 'desktop',
            country: event.geo_country || undefined,
            subdivision1: event.geo_region || undefined,
            city: event.geo_city || undefined,
            referrerDomain: event.referrer ? (() => { try { return new URL(event.referrer).hostname; } catch { return undefined; } })() : undefined,
          });
        }

        processed++;
      } catch (e) {
        console.error('Batch event processing error:', e);
      }
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error('Batch tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
