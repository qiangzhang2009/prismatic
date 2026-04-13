/**
 * Prismatic — Forum Tables Migration
 *
 * Creates the following tables for the Debate Arena feature:
 *   - prismatic_forum_debates
 *   - prismatic_forum_debate_turns
 *   - prismatic_forum_debate_views
 *   - prismatic_forum_debate_votes
 *   - prismatic_forum_topic_suggestions
 *
 * Run:     npx ts-node scripts/create-forum-tables.ts
 * Rollback: npx ts-node scripts/create-forum-tables.ts rollback
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const sql = neon(DATABASE_URL);
  const action = process.argv[2];

  if (action === 'rollback') {
    console.log('Rolling back forum tables...\n');
    try {
      await sql`DROP TABLE IF EXISTS public.prismatic_forum_topic_suggestions`;
      await sql`DROP TABLE IF EXISTS public.prismatic_forum_debate_votes`;
      await sql`DROP TABLE IF EXISTS public.prismatic_forum_debate_views`;
      await sql`DROP TABLE IF EXISTS public.prismatic_forum_debate_turns`;
      await sql`DROP TABLE IF EXISTS public.prismatic_forum_debates`;
    } catch (e: any) {
      console.error('⚠️', e.message.split('\n')[0]);
    }
    console.log('Done — all forum tables dropped.');
    return;
  }

  console.log('Creating forum tables...\n');

  // ── prismatic_forum_debates ────────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debates (
        id              SERIAL PRIMARY KEY,
        date            DATE NOT NULL DEFAULT CURRENT_DATE,
        topic           TEXT NOT NULL,
        topic_source    TEXT NOT NULL DEFAULT 'auto'
                          CHECK (topic_source IN ('auto', 'manual', 'user_suggested')),
        status          TEXT NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled', 'running', 'completed')),
        participant_ids TEXT[] NOT NULL DEFAULT '{}',
        round_count     INTEGER NOT NULL DEFAULT 3,
        view_count      INTEGER NOT NULL DEFAULT 0,
        live_viewers    INTEGER NOT NULL DEFAULT 0,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (date)
      )
    `;
    console.log('✅ prismatic_forum_debates');
  } catch (e: any) {
    console.error('⚠️ prismatic_forum_debates:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_debates_date   ON public.prismatic_forum_debates (date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_debates_status ON public.prismatic_forum_debates (status)`;
    console.log('✅ indexes on prismatic_forum_debates');
  } catch (e: any) {
    console.error('⚠️ indexes:', e.message.split('\n')[0]);
  }

  // ── prismatic_forum_debate_turns ──────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_turns (
        id              SERIAL PRIMARY KEY,
        debate_id       INTEGER NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        round           INTEGER NOT NULL DEFAULT 1,
        speaker_id      TEXT NOT NULL,
        content         TEXT NOT NULL,
        tone            TEXT NOT NULL DEFAULT 'balanced',
        reaction_to_id  INTEGER REFERENCES public.prismatic_forum_debate_turns(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_debate_turns');
  } catch (e: any) {
    console.error('⚠️ prismatic_forum_debate_turns:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_turns_debate_id ON public.prismatic_forum_debate_turns (debate_id, round ASC)`;
    console.log('✅ index on prismatic_forum_debate_turns');
  } catch (e: any) {
    console.error('⚠️ index:', e.message.split('\n')[0]);
  }

  // ── prismatic_forum_debate_views ─────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_views (
        id         SERIAL PRIMARY KEY,
        debate_id  INTEGER NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        user_id    TEXT,
        ip_hash    TEXT,
        viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_debate_views');
  } catch (e: any) {
    console.error('⚠️ prismatic_forum_debate_views:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_views_debate_id ON public.prismatic_forum_debate_views (debate_id)`;
    console.log('✅ index on prismatic_forum_debate_views');
  } catch (e: any) {
    console.error('⚠️ index:', e.message.split('\n')[0]);
  }

  // ── prismatic_forum_debate_votes ─────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_votes (
        id          SERIAL PRIMARY KEY,
        debate_id   INTEGER NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL,
        persona_id  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (debate_id, user_id)
      )
    `;
    console.log('✅ prismatic_forum_debate_votes');
  } catch (e: any) {
    console.error('⚠️ prismatic_forum_debate_votes:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_votes_debate_id ON public.prismatic_forum_debate_votes (debate_id)`;
    console.log('✅ index on prismatic_forum_debate_votes');
  } catch (e: any) {
    console.error('⚠️ index:', e.message.split('\n')[0]);
  }

  // ── prismatic_forum_topic_suggestions ────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_topic_suggestions (
        id           SERIAL PRIMARY KEY,
        topic        TEXT NOT NULL,
        suggested_by TEXT,
        status       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_topic_suggestions');
  } catch (e: any) {
    console.error('⚠️ prismatic_forum_topic_suggestions:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.prismatic_forum_topic_suggestions (status)`;
    console.log('✅ index on prismatic_forum_topic_suggestions');
  } catch (e: any) {
    console.error('⚠️ index:', e.message.split('\n')[0]);
  }

  console.log('\n🎉 Forum tables migration complete!');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
