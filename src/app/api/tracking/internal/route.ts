/**
 * POST /api/tracking/internal — Receive tracking events from Prismatic frontend
 * Stores events directly in the Neon PostgreSQL database.
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
    const body = await req.json();
    const {
      event_type,
      session_id,
      visitor_id,
      page_path,
      page_url,
      page_title,
      referrer,
      user_agent,
      device_type,
      browser,
      os,
      screen_resolution,
      language,
      traffic_source,
      geo_country,
      geo_region,
      geo_city,
      geo_isp,
      event_data,
      // Prismatic-specific fields
      persona_id,
      persona_name,
      domain,
      mode,
      turn,
      ai_latency_ms,
      model_used,
      confidence_score,
      from_mode,
      to_mode,
    } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    const configured = await isTrackingConfigured();
    if (!configured) {
      return NextResponse.json({ success: false, reason: 'not configured' }, { status: 200 });
    }

    const effectiveVisitorId = visitor_id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const effectiveSessionId = session_id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Always upsert session first
    await upsertSession({
      sessionId: effectiveSessionId,
      visitorId: effectiveVisitorId,
      browser: browser || undefined,
      os: os || undefined,
      deviceType: device_type || 'desktop',
      country: geo_country || undefined,
    });

    // Handle Prismatic persona events
    if (['persona_view', 'chat_start', 'chat_message', 'model_expand', 'graph_node_click', 'mode_switch', 'first_visit', 'returning_visit'].includes(event_type)) {
      await insertPrismaticEvent({
        sessionId: effectiveSessionId,
        visitorId: effectiveVisitorId,
        personaId: persona_id,
        domain,
        eventType: event_type,
        eventData: event_data || {},
        aiLatencyMs: ai_latency_ms ? Number(ai_latency_ms) : undefined,
        modelUsed: model_used || undefined,
        confidenceScore: confidence_score ? parseFloat(String(confidence_score)) : undefined,
        conversationTurn: turn ? Number(turn) : undefined,
        mode: mode || undefined,
      });
    }

    // Handle page events
    if (['page_view', 'pageview', 'page_leave', 'scroll', 'click', 'heartbeat', 'first_visit', 'returning_visit'].includes(event_type)) {
      await insertPageEvent({
        sessionId: effectiveSessionId,
        visitorId: effectiveVisitorId,
        eventType: event_type === 'pageview' ? 'page_view' : event_type,
        urlPath: page_path || (page_url ? new URL(page_url).pathname : undefined),
        eventData: event_data || {},
        timezone: body.timezone || undefined,
        trafficSource: traffic_source || undefined,
        hostname: body.hostname || (page_url ? new URL(page_url).hostname : undefined),
        browser: browser || undefined,
        os: os || undefined,
        deviceType: device_type || 'desktop',
        country: geo_country || undefined,
        subdivision1: geo_region || undefined,
        city: geo_city || undefined,
        referrerDomain: referrer ? (() => { try { return new URL(referrer).hostname; } catch { return undefined; } })() : undefined,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tracking error:', error);
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
