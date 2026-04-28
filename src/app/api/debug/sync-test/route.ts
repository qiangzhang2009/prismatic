/**
 * POST /api/debug/sync-test — Diagnostic endpoint for testing sync connectivity.
 * This endpoint bypasses auth and logs EVERYTHING to help debug WeChat WebView issues.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  console.log('[SYNC-DIAG] POST /api/debug/sync-test hit!');
  console.log('[SYNC-DIAG] deviceId:', body.deviceId);
  console.log('[SYNC-DIAG] body keys:', Object.keys(body));
  console.log('[SYNC-DIAG] localSnapshots count:', body.localSnapshots?.length);
  console.log('[SYNC-DIAG] user-agent:', headers['user-agent']);
  console.log('[SYNC-DIAG] origin:', headers['origin']);
  console.log('[SYNC-DIAG] referer:', headers['referer']);
  console.log('[SYNC-DIAG] cookie length:', headers['cookie']?.length);
  console.log('[SYNC-DIAG] all headers:', JSON.stringify(headers));

  return NextResponse.json({
    received: true,
    deviceId: body.deviceId,
    localSnapshotsCount: body.localSnapshots?.length || 0,
    userAgent: headers['user-agent'],
    origin: headers['origin'],
    referer: headers['referer'],
    cookiePresent: !!(headers['cookie']),
    serverTime: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId') || 'unknown';

  console.log('[SYNC-DIAG] GET /api/debug/sync-test hit! deviceId:', deviceId);
  console.log('[SYNC-DIAG] user-agent:', req.headers.get('user-agent'));
  console.log('[SYNC-DIAG] referer:', req.headers.get('referer'));

  return NextResponse.json({
    pong: true,
    deviceId,
    serverTime: new Date().toISOString(),
    userAgent: req.headers.get('user-agent') || '',
    referer: req.headers.get('referer') || '',
    cookiePresent: !!(req.headers.get('cookie')),
  });
}
