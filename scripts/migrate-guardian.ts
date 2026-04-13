/**
 * Database Migration Script - Complete Guardian System
 * Run: npx tsx scripts/migrate-guardian.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  // Create guardian_schedule table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_guardian_schedule (
        id BIGSERIAL PRIMARY KEY,
        date DATE NOT NULL,
        slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
        persona_id TEXT NOT NULL,
        shift_theme TEXT,
        max_interactions INTEGER NOT NULL DEFAULT 20,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT prismatic_guardian_schedule_pk UNIQUE (date, slot)
      )
    `;
    console.log('✅ prismatic_guardian_schedule table created');
  } catch (e: any) {
    console.log('⚠️ guardian_schedule:', e.message.split('\n')[0]);
  }

  // Create index on guardian_schedule
  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_guardian_schedule_date_idx ON public.prismatic_guardian_schedule (date DESC)`;
    console.log('✅ guardian_schedule date index created');
  } catch (e: any) {
    console.log('⚠️ guardian_schedule date index:', e.message.split('\n')[0]);
  }

  // Create persona_interactions table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_persona_interactions (
        id BIGSERIAL PRIMARY KEY,
        persona_id TEXT NOT NULL,
        comment_id TEXT NOT NULL,
        interaction_type TEXT NOT NULL CHECK (interaction_type IN ('reply', 'reaction', 'quote', 'mention')),
        content TEXT,
        emoji TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✅ prismatic_persona_interactions table created');
  } catch (e: any) {
    console.log('⚠️ persona_interactions:', e.message.split('\n')[0]);
  }

  // Create indexes on persona_interactions
  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_persona_interactions_persona_idx ON public.prismatic_persona_interactions (persona_id, created_at DESC)`;
    console.log('✅ persona_interactions persona index created');
  } catch (e: any) {
    console.log('⚠️ persona_interactions persona index:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_persona_interactions_comment_idx ON public.prismatic_persona_interactions (comment_id)`;
    console.log('✅ persona_interactions comment index created');
  } catch (e: any) {
    console.log('⚠️ persona_interactions comment index:', e.message.split('\n')[0]);
  }

  // Create guardian_stats table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_guardian_stats (
        id BIGSERIAL PRIMARY KEY,
        date DATE NOT NULL,
        persona_id TEXT NOT NULL,
        comments_reviewed INTEGER NOT NULL DEFAULT 0,
        interactions INTEGER NOT NULL DEFAULT 0,
        mentions_received INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT prismatic_guardian_stats_pk UNIQUE (date, persona_id)
      )
    `;
    console.log('✅ prismatic_guardian_stats table created');
  } catch (e: any) {
    console.log('⚠️ guardian_stats:', e.message.split('\n')[0]);
  }

  // Add max_interactions column if it doesn't exist
  try {
    await sql`ALTER TABLE public.prismatic_guardian_schedule ADD COLUMN IF NOT EXISTS max_interactions INTEGER NOT NULL DEFAULT 20`;
    console.log('✅ max_interactions column added to guardian_schedule');
  } catch (e: any) {
    console.log('⚠️ max_interactions:', e.message.split('\n')[0]);
  }

  // Add interactions column if it doesn't exist
  try {
    await sql`ALTER TABLE public.prismatic_guardian_stats ADD COLUMN IF NOT EXISTS interactions INTEGER NOT NULL DEFAULT 0`;
    console.log('✅ interactions column added to guardian_stats');
  } catch (e: any) {
    console.log('⚠️ interactions:', e.message.split('\n')[0]);
  }

  console.log('🎉 Guardian system migration complete!');
}

migrate().catch(console.error);
