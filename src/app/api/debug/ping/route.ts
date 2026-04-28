/**
 * GET /api/debug/ping — Simple connectivity test for debugging WeChat WebView sync issues.
 * Returns basic info + echoes back the deviceId from query params.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId') || 'unknown';
  const ts = Date.now();

  return NextResponse.json({
    pong: true,
    deviceId,
    serverTime: new Date().toISOString(),
    timestamp: ts,
    userAgent: req.headers.get('user-agent') || '',
    origin: req.headers.get('origin') || '',
    referer: req.headers.get('referer') || '',
    cookie: req.headers.get('cookie') || '',
    accept: req.headers.get('accept') || '',
  });
}
