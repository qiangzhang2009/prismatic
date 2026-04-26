/**
 * Database Migration API - Run migrations
 * Protected by admin check (uses JWT token like other admin endpoints)
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function POST(req: NextRequest) {
  // Admin check using the same auth system as other admin endpoints
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 401 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Run migrations
    const results: string[] = [];

    // ── comments (Prisma-managed table) ─────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.comments (
          id          VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
          content     TEXT NOT NULL,
          user_id     VARCHAR(255),
          nickname    VARCHAR(255),
          gender      VARCHAR(50),
          avatar_seed VARCHAR(255),
          ip_hash     VARCHAR(255),
          geo_country_code VARCHAR(10),
          geo_country VARCHAR(100),
          geo_region VARCHAR(100),
          geo_city   VARCHAR(100),
          parent_id   VARCHAR(255),
          type        VARCHAR(20) DEFAULT 'comment',
          reactions   JSONB DEFAULT '[]',
          status      VARCHAR(20) DEFAULT 'published',
          persona_slug VARCHAR(255),
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          updated_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_user_created ON public.comments(user_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_status_created ON public.comments(status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_persona_slug ON public.comments(persona_slug, created_at DESC)`;
      results.push('comments (Prisma) ✓');
    } catch (e: any) {
      results.push(`comments (Prisma): ${e.message}`);
    }

    // ── guardian_discussions ────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.guardian_discussions (
          id              BIGSERIAL PRIMARY KEY,
          topic          TEXT NOT NULL,
          topic_source   VARCHAR(20) NOT NULL DEFAULT 'auto',
          content        TEXT DEFAULT '',
          participant_ids TEXT[] NOT NULL DEFAULT '{}',
          round_count    INTEGER DEFAULT 0,
          view_count     INTEGER DEFAULT 0,
          status         VARCHAR(20) NOT NULL DEFAULT 'active',
          started_at     TIMESTAMPTZ DEFAULT NOW(),
          ended_at       TIMESTAMPTZ,
          created_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_discussions_status ON public.guardian_discussions(status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_discussions_started ON public.guardian_discussions(started_at DESC)`;
      results.push('guardian_discussions ✓');
    } catch (e: any) {
      results.push(`guardian_discussions: ${e.message}`);
    }

    // ── prismatic_comments ──────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID DEFAULT '97e7123c-a201-4cbf-a483-b6d777433818',
          content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
          author_name VARCHAR(50) NOT NULL DEFAULT 'Anonymous',
          author_avatar VARCHAR(10) DEFAULT '👤',
          user_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          is_pinned BOOLEAN DEFAULT FALSE,
          is_hidden BOOLEAN DEFAULT FALSE,
          parent_id UUID,
          likes INTEGER DEFAULT 0,
          display_name VARCHAR(50)
        )
      `;
      results.push('prismatic_comments ✓');
    } catch (e: any) {
      results.push(`prismatic_comments: ${e.message}`);
    }

    // ── prismatic_guardian_schedule ─────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_guardian_schedule (
          date    DATE NOT NULL,
          slot    SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
          persona_id  VARCHAR(64) NOT NULL,
          shift_theme TEXT DEFAULT '',
          max_interactions INTEGER DEFAULT 65,
          PRIMARY KEY (date, slot)
        )
      `;
      results.push('prismatic_guardian_schedule ✓');
    } catch (e: any) {
      results.push(`prismatic_guardian_schedule: ${e.message}`);
    }

    // ── prismatic_guardian_stats ────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_guardian_stats (
          date            DATE NOT NULL,
          persona_id     VARCHAR(64) NOT NULL,
          interactions   INTEGER DEFAULT 0,
          comments_reviewed INTEGER DEFAULT 0,
          PRIMARY KEY (date, persona_id)
        )
      `;
      results.push('prismatic_guardian_stats ✓');
    } catch (e: any) {
      results.push(`prismatic_guardian_stats: ${e.message}`);
    }

    // ── prismatic_persona_interactions ───────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_persona_interactions (
          id              BIGSERIAL PRIMARY KEY,
          persona_id     VARCHAR(64) NOT NULL,
          comment_id     VARCHAR(64) NOT NULL,
          interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('reply', 'reaction', 'quote')),
          content        TEXT,
          emoji          VARCHAR(20),
          created_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.push('prismatic_persona_interactions ✓');
    } catch (e: any) {
      results.push(`prismatic_persona_interactions: ${e.message}`);
    }

    // ── prismatic_forum_debates ─────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_forum_debates (
          id              BIGSERIAL PRIMARY KEY,
          date            DATE NOT NULL,
          topic           TEXT NOT NULL,
          participant_ids  TEXT[] NOT NULL DEFAULT '{}',
          status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'running', 'completed')),
          live_viewers    INTEGER DEFAULT 0,
          view_count      INTEGER DEFAULT 0,
          votes           JSONB DEFAULT '{}',
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.push('prismatic_forum_debates ✓');
    } catch (e: any) {
      results.push(`prismatic_forum_debates: ${e.message}`);
    }

    // ── prismatic_forum_debate_turns ────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_turns (
          id          BIGSERIAL PRIMARY KEY,
          debate_id   BIGINT NOT NULL REFERENCES prismatic_forum_debates(id) ON DELETE CASCADE,
          round       SMALLINT NOT NULL DEFAULT 0,
          speaker_id  VARCHAR(64) NOT NULL,
          speaker_name VARCHAR(64) NOT NULL,
          content     TEXT NOT NULL,
          tone        VARCHAR(20) DEFAULT 'opening',
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.push('prismatic_forum_debate_turns ✓');
    } catch (e: any) {
      results.push(`prismatic_forum_debate_turns: ${e.message}`);
    }

    // ── prismatic_message_stats ─────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_message_stats (
          user_id        VARCHAR(64) NOT NULL,
          date          DATE NOT NULL,
          message_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, date)
        )
      `;
      results.push('prismatic_message_stats ✓');
    } catch (e: any) {
      results.push(`prismatic_message_stats: ${e.message}`);
    }

    // ── prismatic_forum_debate_visitors ─────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_visitors (
          id            BIGSERIAL PRIMARY KEY,
          debate_id     BIGINT NOT NULL,
          visitor_id    VARCHAR(64),
          content       TEXT NOT NULL CHECK (char_length(content) >= 2 AND char_length(content) <= 300),
          ip_hash       VARCHAR(64),
          is_ai_response BOOLEAN DEFAULT FALSE,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.push('prismatic_forum_debate_visitors ✓');
    } catch (e: any) {
      results.push(`prismatic_forum_debate_visitors: ${e.message}`);
    }

    // ── guardian_discussions ────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.guardian_discussions (
          id              BIGSERIAL PRIMARY KEY,
          topic          TEXT NOT NULL,
          topic_source   VARCHAR(20) NOT NULL DEFAULT 'auto',
          content        TEXT DEFAULT '',
          participant_ids TEXT[] NOT NULL DEFAULT '{}',
          round_count    INTEGER DEFAULT 0,
          view_count     INTEGER DEFAULT 0,
          status         VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'archived')),
          started_at     TIMESTAMPTZ DEFAULT NOW(),
          ended_at       TIMESTAMPTZ,
          created_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.push('guardian_discussions ✓');
    } catch (e: any) {
      results.push(`guardian_discussions: ${e.message}`);
    }

    // ── Indexes ────────────────────────────────────────────────────────────────
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_tenant ON public.prismatic_comments(tenant_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_created ON public.prismatic_comments(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_pinned ON public.prismatic_comments(is_pinned DESC, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_schedule_date ON public.prismatic_guardian_schedule(date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_stats_date ON public.prismatic_guardian_stats(date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_discussions_status ON public.guardian_discussions(status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_guardian_discussions_started ON public.guardian_discussions(started_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_forum_debates_date ON public.prismatic_forum_debates(date DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_forum_debate_turns_debate ON public.prismatic_forum_debate_turns(debate_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_debate_visitors_debate ON public.prismatic_forum_debate_visitors(debate_id)`;
      results.push('Indexes ✓');
    } catch (e: any) {
      results.push(`Indexes: ${e.message}`);
    }

    // ── comments guardian mention ────────────────────────────────────────────────
    try {
      await sql`ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentioned_guardian_id TEXT`;
      await sql`ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentioned_guardian_reply TEXT`;
      await sql`ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentioned_guardian_replied_at TIMESTAMPTZ`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_mentioned_guardian ON public.comments(mentioned_guardian_id) WHERE mentioned_guardian_id IS NOT NULL`;
      results.push('comments.guardian_mention ✓');
    } catch (e: any) {
      results.push(`comments.guardian_mention: ${e.message}`);
    }

    // ── Cleanup: remove non-persona records from distilled_personas ─────────────────
    try {
      const deleted = await sql`
        DELETE FROM public.distilled_personas
        WHERE "slug" IN (
          'greek-classics', 'chinese-classics', 'quantangshi',
          'three-kingdoms', 'journey-west', 'tripitaka',
          'sun-wukong', 'zhu-bajie'
        )
        RETURNING "slug"
      `;
      results.push(`Cleanup non-persona records: ${deleted.length} deleted`);
    } catch (e: any) {
      results.push(`Cleanup non-persona records: ${e.message}`);
    }

    // ── Sample comments ─────────────────────────────────────────────────────────
    try {
      const existingComments = await sql`SELECT COUNT(*) as count FROM public.prismatic_comments`;
      if (Number(existingComments[0]?.count || 0) === 0) {
        await sql`
          INSERT INTO public.prismatic_comments (content, author_name, author_avatar, display_name, is_pinned)
          VALUES
            ('这个产品太棒了！让乔布斯和芒格同时思考我的问题，感觉打开了新世界的大门 🚀', '产品爱好者', '🚀', '产品爱好者', true),
            ('作为一个哲学爱好者，终于找到了可以深入探讨斯多葛主义的工具。费曼的思维方式也让人受益匪浅！', '哲学探索者', '🦉', '哲学探索者', false),
            ('张一鸣的实用主义思维对我做产品很有启发，强力推荐！', '创业者小明', '💡', '创业者小明', false)
        `;
        results.push('Sample comments ✓');
      } else {
        results.push('Sample comments (already exist)');
      }
    } catch (e: any) {
      results.push(`Sample data: ${e.message}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET for checking migration status (public)
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const tableResults: Record<string, boolean> = {};
    const tables = [
      'comments',
      'guardian_discussions',
      'prismatic_comments',
      'prismatic_guardian_schedule',
      'prismatic_guardian_stats',
      'prismatic_persona_interactions',
      'prismatic_forum_debates',
      'prismatic_forum_debate_turns',
      'prismatic_message_stats',
      'prismatic_forum_debate_visitors',
    ];
    for (const t of tables) {
      try {
        const r = await sql`SELECT 1 FROM public.${sql.unsafe(t)} LIMIT 1`;
        tableResults[t] = true;
      } catch {
        tableResults[t] = false;
      }
    }
    return NextResponse.json({ tables: tableResults });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
