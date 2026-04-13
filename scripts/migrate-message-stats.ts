/**
 * Database Migration Script - Message Stats Table
 * Run: npx tsx scripts/migrate-message-stats.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  // Create message_stats table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public.prismatic_message_stats (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT prismatic_message_stats_pk UNIQUE (user_id, date)
      )
    `;
    console.log('✅ prismatic_message_stats table created');
  } catch (e: any) {
    console.log('⚠️ message_stats table:', e.message.split('\n')[0]);
  }

  // Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_message_stats_user_date_idx ON public.prismatic_message_stats (user_id, date DESC)`;
    console.log('✅ user_date index created');
  } catch (e: any) {
    console.log('⚠️ user_date index:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_message_stats_date_idx ON public.prismatic_message_stats (date DESC)`;
    console.log('✅ date index created');
  } catch (e: any) {
    console.log('⚠️ date index:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS prismatic_message_stats_user_idx ON public.prismatic_message_stats (user_id)`;
    console.log('✅ user index created');
  } catch (e: any) {
    console.log('⚠️ user index:', e.message.split('\n')[0]);
  }

  console.log('🎉 Message stats migration complete!');
}

migrate().catch(console.error);
