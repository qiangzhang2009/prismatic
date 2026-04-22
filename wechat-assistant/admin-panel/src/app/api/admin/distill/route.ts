/**
 * Prismatic — Admin Distillation API (Proxy)
 * Proxies to the main Prismatic app's distillation API.
 * The main app runs on port 3000 (default Next.js).
 * Marked dynamic so Next.js doesn't try to pre-render at build time.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

function buildUrl(path: string, req: NextRequest, baseUrl: string): string {
  const url = new URL(path, baseUrl);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function proxyRequest(
  req: NextRequest,
  path: string,
): Promise<NextResponse> {
  // If NEXT_PUBLIC_DISTILL_API_URL is set (e.g. for cloud deployments), use it.
  // Otherwise fall back to localhost for local development.
  const baseUrl = process.env.NEXT_PUBLIC_DISTILL_API_URL || MAIN_APP_URL;

  try {
    const url = buildUrl(path, req, baseUrl);
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = ['POST', 'PUT', 'PATCH'].includes(req.method)
      ? await req.text()
      : undefined;

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Admin Distill Proxy]', err);
    // Return 503 so the front-end knows the service is unavailable.
    return NextResponse.json(
      {
        error: '蒸馏服务不可用，请确保 Prismatic 主应用正在运行',
        items: [],
        total: 0,
        byStatus: {},
      },
      { status: 503 },
    );
  }
}

// ─── GET /api/admin/distill ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return proxyRequest(req, '/api/admin/distill');
}

// ─── POST /api/admin/distill ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return proxyRequest(req, '/api/admin/distill');
}

// ─── DELETE /api/admin/distill ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, '/api/admin/distill');
}
