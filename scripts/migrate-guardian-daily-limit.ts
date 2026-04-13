/**
 * Database Migration Script - Guardian Daily Limits
 * Run: npx tsx scripts/migrate-guardian-daily-limit.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  // Add max_interactions column to guardian_schedule
  try {
    await sql`ALTER TABLE public.prismatic_guardian_schedule ADD COLUMN IF NOT EXISTS max_interactions INTEGER NOT NULL DEFAULT 20`;
    console.log('✅ max_interactions column added to guardian_schedule');
  } catch (e: any) {
    console.log('⚠️ max_interactions:', e.message.split('\n')[0]);
  }

  // Add interactions column to guardian_stats
  try {
    await sql`ALTER TABLE public.prismatic_guardian_stats ADD COLUMN IF NOT EXISTS interactions INTEGER NOT NULL DEFAULT 0`;
    console.log('✅ interactions column added to guardian_stats');
  } catch (e: any) {
    console.log('⚠️ interactions:', e.message.split('\n')[0]);
  }

  console.log('🎉 Guardian daily limits migration complete!');
}

migrate().catch(console.error);
