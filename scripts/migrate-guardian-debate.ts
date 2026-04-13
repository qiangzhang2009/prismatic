/**
 * Database Migration Script — Debate Arena System
 * 智辩场辩论系统数据库迁移
 * Run: npx tsx scripts/migrate-guardian-debate.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  // ── 1. Forum Debates table ────────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debates (
        id              BIGSERIAL PRIMARY KEY,
        date            DATE        NOT NULL,
        topic           TEXT        NOT NULL,
        topic_source    TEXT        NOT NULL DEFAULT 'auto',
        -- auto | manual | user_suggested
        status          TEXT        NOT NULL DEFAULT 'scheduled',
        -- scheduled → running → completed
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        round_count     SMALLINT    NOT NULL DEFAULT 3,
        participant_ids TEXT[]      NOT NULL,
        view_count      INTEGER     NOT NULL DEFAULT 0,
        live_viewers    INTEGER     NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_debates table created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debates:', e.message.split('\n')[0]);
  }

  // Index for fetching today's debate
  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_forum_debates_date_idx ON public.prismatic_forum_debates (date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS prismatic_forum_debates_status_idx ON public.prismatic_forum_debates (status)`;
    console.log('✅ prismatic_forum_debates indexes created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debates indexes:', e.message.split('\n')[0]);
  }

  // ── 2. Debate Turns table ──────────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_turns (
        id              BIGSERIAL PRIMARY KEY,
        debate_id       BIGINT      NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        round           SMALLINT    NOT NULL,
        speaker_id      TEXT        NOT NULL,
        content         TEXT        NOT NULL,
        tone            TEXT,  -- provocative | supportive | synthesizing | questioning | opening
        reaction_to_id  BIGINT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_debate_turns table created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debate_turns:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_forum_debate_turns_debate_idx ON public.prismatic_forum_debate_turns (debate_id, round ASC)`;
    console.log('✅ prismatic_forum_debate_turns index created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debate_turns index:', e.message.split('\n')[0]);
  }

  // ── 3. Debate Views (围观记录) table ─────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_views (
        id              BIGSERIAL PRIMARY KEY,
        debate_id       BIGINT      NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        user_id         TEXT,
        ip_hash         TEXT,
        joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_debate_views table created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debate_views:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_forum_debate_views_debate_idx ON public.prismatic_forum_debate_views (debate_id)`;
    console.log('✅ prismatic_forum_debate_views index created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debate_views index:', e.message.split('\n')[0]);
  }

  // ── 4. Update guardian_schedule default to 65 ──────────────────────────────
  try {
    await sql`ALTER TABLE public.prismatic_guardian_schedule ALTER COLUMN max_interactions SET DEFAULT 65`;
    console.log('✅ guardian_schedule max_interactions default updated to 65');
  } catch (e: any) {
    console.log('⚠️ guardian_schedule max_interactions:', e.message.split('\n')[0]);
  }

  // ── 5. Debate votes table ─────────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_debate_votes (
        id              BIGSERIAL PRIMARY KEY,
        debate_id       BIGINT      NOT NULL REFERENCES public.prismatic_forum_debates(id) ON DELETE CASCADE,
        user_id         TEXT        NOT NULL,
        persona_id      TEXT        NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT prismatic_forum_debate_votes_unique UNIQUE (debate_id, user_id)
      )
    `;
    console.log('✅ prismatic_forum_debate_votes table created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_debate_votes:', e.message.split('\n')[0]);
  }

  // ── 6. Topic suggestions table ────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_forum_topic_suggestions (
        id              BIGSERIAL PRIMARY KEY,
        topic           TEXT        NOT NULL,
        suggested_by    TEXT,
        status          TEXT        NOT NULL DEFAULT 'pending',
        -- pending | approved | rejected
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_forum_topic_suggestions table created');
  } catch (e: any) {
    console.log('⚠️ prismatic_forum_topic_suggestions:', e.message.split('\n')[0]);
  }

  console.log('🎉 Debate Arena system migration complete!');
}

migrate().catch(console.error);
