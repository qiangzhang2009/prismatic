/**
 * User Bookmarks API — GET / POST / DELETE /api/user/bookmarks
 * Manages per-user persona bookmarks (favorites).
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

function sql() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(DATABASE_URL);
}

async function getUserId(req: NextRequest): Promise<string | null> {
  // Lazy import to avoid circular issues
  const { authenticateRequest } = await import('@/lib/user-management');
  return authenticateRequest(req);
}

// GET — list all bookmarks
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const db = sql();

    // Ensure table exists
    try {
      await db`CREATE TABLE IF NOT EXISTS prismatic_persona_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        persona_slug TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, persona_slug)
      )`;
    } catch (_) { /* table already exists */ }

    const rows = await db`
      SELECT persona_slug, created_at
      FROM prismatic_persona_bookmarks
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ bookmarks: rows.map((r: any) => ({
      slug: r.persona_slug,
      createdAt: r.created_at,
    })) });
  } catch (err) {
    console.error('[API/bookmarks GET]', err);
    return NextResponse.json({ bookmarks: [], error: String(err) }, { status: 500 });
  }
}

// POST — add or remove a bookmark (toggle)
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { slug } = await req.json();
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    const db = sql();

    // Check if already bookmarked
    const existing = await db`
      SELECT 1 FROM prismatic_persona_bookmarks
      WHERE user_id = ${userId} AND persona_slug = ${slug}
    `;

    if (existing.length > 0) {
      // Remove
      await db`
        DELETE FROM prismatic_persona_bookmarks
        WHERE user_id = ${userId} AND persona_slug = ${slug}
      `;
      return NextResponse.json({ action: 'removed', slug });
    } else {
      // Add
      await db`
        INSERT INTO prismatic_persona_bookmarks (user_id, persona_slug)
        VALUES (${userId}, ${slug})
      `;
      return NextResponse.json({ action: 'added', slug });
    }
  } catch (err) {
    // Auto-create table if missing
    if (String(err).includes('does not exist') || String(err).includes('relation') && String(err).includes('not exist')) {
      try {
        const db = sql();
        await db`
          CREATE TABLE IF NOT EXISTS prismatic_persona_bookmarks (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            persona_slug TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, persona_slug)
          );
          CREATE INDEX IF NOT EXISTS prismatic_bookmarks_user_idx ON prismatic_persona_bookmarks(user_id);
        `;
        return NextResponse.json({ action: 'table_created', retry: true });
      } catch (e2) {
        console.error('[API/bookmarks POST create table]', e2);
      }
    }
    console.error('[API/bookmarks POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a bookmark (or clear all)
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    const db = sql();
    if (slug) {
      await db`
        DELETE FROM prismatic_persona_bookmarks
        WHERE user_id = ${userId} AND persona_slug = ${slug}
      `;
      return NextResponse.json({ action: 'removed', slug });
    } else {
      // Clear all
      await db`
        DELETE FROM prismatic_persona_bookmarks WHERE user_id = ${userId}
      `;
      return NextResponse.json({ action: 'cleared' });
    }
  } catch (err) {
    console.error('[API/bookmarks DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
