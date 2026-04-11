/**
 * Diagnostic API — test DeepSeek connectivity from Vercel serverless
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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
