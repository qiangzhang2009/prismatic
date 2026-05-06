/**
 * GET /api/tracking-sdk — Redirect to static asset
 * The SDK is a static file at /tracking-sdk.js served by Vercel CDN,
 * bypassing Edge Function cold starts and China-region latency.
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.redirect(new URL('/tracking-sdk.js', process.env.NODE_ENV === 'production'
    ? 'https://prismatic.zxqconsulting.com'
    : 'http://localhost:3000'), 302);
}
