/**
 * Diagnostic API — test DeepSeek connectivity from Vercel serverless
 * WARNING: This endpoint is open for debugging. Remove or add admin auth before production.
 * Currently: requires ADMIN role cookie check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

async function getSessionUser(sessionToken: string): Promise<{ userId: string; role: string } | null> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT user_id, role FROM public.sessions WHERE id = ${sessionToken} LIMIT 1`;
    if (!rows || rows.length === 0) return null;
    return { userId: String(rows[0].user_id), role: String(rows[0].role ?? 'FREE') };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // Auth check — only admins can access diagnostic endpoint
  const sessionToken = req.cookies.get('prismatic-session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionUser = await getSessionUser(sessionToken);
  if (!sessionUser || sessionUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DEEPSEEK_API_KEY_set: !!process.env.DEEPSEEK_API_KEY,
      LLM_PROVIDER: process.env.LLM_PROVIDER,
    },
    tests: {},
  };

  // Test 1: DNS resolution
  const start1 = Date.now();
  try {
    await fetch('https://api.deepseek.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    results.tests.dns = { ok: true, time_ms: Date.now() - start1 };
  } catch (e: any) {
    results.tests.dns = { ok: false, error: e.message, time_ms: Date.now() - start1 };
  }

  // Test 2: DeepSeek API with minimal request
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      results.tests.api = { ok: false, error: 'DEEPSEEK_API_KEY not set' };
    } else {
      const start2 = Date.now();
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      });
      const text = await res.text();
      results.tests.api = {
        ok: res.ok,
        status: res.status,
        time_ms: Date.now() - start2,
        response_preview: text.slice(0, 200),
      };
    }
  } catch (e: any) {
    results.tests.api = { ok: false, error: e.message, stack: e.stack?.slice(0, 300) };
  }

  // Test 3: OpenAI API (known to work from Vercel)
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      results.tests.openai = { ok: false, error: 'OPENAI_API_KEY not set' };
    } else {
      const start3 = Date.now();
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
      });
      const text = await res.text();
      results.tests.openai = {
        ok: res.ok,
        status: res.status,
        time_ms: Date.now() - start3,
        response_preview: text.slice(0, 200),
      };
    }
  } catch (e: any) {
    results.tests.openai = { ok: false, error: e.message };
  }

  return NextResponse.json(results);
}
