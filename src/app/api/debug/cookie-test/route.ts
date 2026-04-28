/**
 * GET /api/debug/cookie-test — Returns cookies + auth status + deviceId (if sent).
 * Used to diagnose if WeChat WebView properly sends cookies and auth works.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookies: Record<string, string> = {};
  req.cookies.getAll().forEach(c => { cookies[c.name] = c.value; });

  const authUserId = await authenticateRequest(req);

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');

  return NextResponse.json({
    cookies: Object.keys(cookies),
    hasPrismaticToken: !!cookies['prismatic_token'],
    authUserId,
    deviceIdFromQuery: deviceId,
    userAgent: req.headers.get('user-agent') || '',
    serverTime: new Date().toISOString(),
  });
}
