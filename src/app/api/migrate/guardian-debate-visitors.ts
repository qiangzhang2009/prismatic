/**
 * Migration: Add human visitor participation to debates
 * Run via POST /api/migrate
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Create table for human debate contributions
    await sql`
      CREATE TABLE IF NOT EXISTS prismatic_forum_debate_visitors (
        id            BIGSERIAL PRIMARY KEY,
        debate_id     BIGINT NOT NULL REFERENCES prismatic_forum_debates(id) ON DELETE CASCADE,
        visitor_id    VARCHAR(64),
        content       TEXT NOT NULL,
        ip_hash       VARCHAR(64),
        is_ai_response BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_debate_visitors_debate_id
      ON prismatic_forum_debate_visitors(debate_id)
    `;

    return NextResponse.json({ success: true, message: 'Migration complete' });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
