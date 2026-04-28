import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookies: Record<string, string> = {};
  req.cookies.getAll().forEach(c => { cookies[c.name] = c.value; });

  return NextResponse.json({
    cookies: Object.keys(cookies),
    cookieValues: Object.fromEntries(
      Object.entries(cookies).map(([k, v]) => [k, k === 'prismatic_token' ? v.slice(0, 20) + '...' : v])
    ),
    userAgent: req.headers.get('user-agent') || '',
    origin: req.headers.get('origin') || '',
    referer: req.headers.get('referer') || '',
    serverTime: new Date().toISOString(),
  });
}
