/**
 * Debate Visitor Participation API
 * GET  - List visitor contributions for a debate
 * POST - Submit a contribution as a human visitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { getPersonasByIds } from '@/lib/personas';

export const runtime = 'nodejs';

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// GET — List visitor contributions for a debate
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const debateId = searchParams.get('debateId');

  if (!debateId) {
    return NextResponse.json({ error: 'debateId required' }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const visitorId = await getVisitorId();

    const rows = await sql`
      SELECT
        v.id,
        v.content,
        v.created_at,
        v.visitor_id,
        v.is_ai_response
      FROM prismatic_forum_debate_visitors v
      WHERE v.debate_id = ${debateId}
      ORDER BY v.created_at ASC
    `;

    return NextResponse.json({
      contributions: (rows as any[]).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        visitorId: r.visitor_id,
        isAiResponse: r.is_ai_response ?? false,
      })),
    });
  } catch (error) {
    console.error('[Debate Visitor GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
  }
}

// POST — Submit a visitor contribution
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip')
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { debateId, content } = body;

    if (!debateId || !content) {
      return NextResponse.json({ error: 'debateId and content required' }, { status: 400 });
    }

    if (typeof content !== 'string' || content.trim().length < 2 || content.length > 300) {
      return NextResponse.json({ error: 'Content must be 2-300 characters' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Verify debate exists and is in 'running' status
    const [debate] = await sql`
      SELECT id, status FROM prismatic_forum_debates WHERE id = ${debateId}
    `;

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    // Allow participation in scheduled (waiting to start) or running debates
    if (debate.status === 'completed') {
      return NextResponse.json({ error: '辩论已结束，不能再发言' }, { status: 400 });
    }

    const visitorId = await getVisitorId();
    const ipHash = ip.slice(0, 64);

    const rows = await sql`
      INSERT INTO prismatic_forum_debate_visitors (debate_id, visitor_id, content, ip_hash)
      VALUES (${debateId}, ${visitorId}, ${content.trim()}, ${ipHash})
      RETURNING id, content, created_at
    `;

    return NextResponse.json({
      success: true,
      contribution: {
        id: (rows[0] as any).id,
        content: (rows[0] as any).content,
        createdAt: (rows[0] as any).created_at instanceof Date
          ? (rows[0] as any).created_at.toISOString()
          : String((rows[0] as any).created_at),
        visitorId,
        isAiResponse: false,
      },
    });
  } catch (error) {
    console.error('[Debate Visitor POST] Error:', error);
    return NextResponse.json({ error: 'Failed to submit contribution' }, { status: 500 });
  }
}

async function getVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('prismatic-visitor')?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
  }
  return visitorId;
}
