/**
 * Prismatic — Admin Distillation Session API (Proxy)
 * GET/DELETE single session — proxies to main app.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const baseUrl = process.env.NEXT_PUBLIC_DISTILL_API_URL || MAIN_APP_URL;
  try {
    const url = new URL(`/api/admin/distill/${params.sessionId}`, baseUrl);
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    console.error('[Admin Distill Session GET]', err);
    return NextResponse.json(
      { error: '蒸馏服务不可用，无法获取会话详情', session: null },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const baseUrl = process.env.NEXT_PUBLIC_DISTILL_API_URL || MAIN_APP_URL;
  try {
    const url = new URL(`/api/admin/distill/${params.sessionId}`, baseUrl);
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    console.error('[Admin Distill Session DELETE]', err);
    return NextResponse.json(
      { error: '蒸馏服务不可用，无法取消会话', sessionId: null, status: 'unavailable' },
      { status: 503 },
    );
  }
}
