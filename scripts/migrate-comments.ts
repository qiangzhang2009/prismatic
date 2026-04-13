/**
 * Database Migration Script v3
 * Run: npx tsx scripts/migrate-comments.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  console.log('📦 Upgrading comments table...');
  
  // Add reactions column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb`;
    console.log('✅ reactions column added');
  } catch (e: any) {
    console.log('⚠️ reactions:', e.message.split('\n')[0]);
  }

  // Add is_edited column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE`;
    console.log('✅ is_edited column added');
  } catch (e: any) {
    console.log('⚠️ is_edited:', e.message.split('\n')[0]);
  }

  // Add report_count column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0`;
    console.log('✅ report_count column added');
  } catch (e: any) {
    console.log('⚠️ report_count:', e.message.split('\n')[0]);
  }

  // Add view_count column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`;
    console.log('✅ view_count column added');
  } catch (e: any) {
    console.log('⚠️ view_count:', e.message.split('\n')[0]);
  }

  // Add ip_hash column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64)`;
    console.log('✅ ip_hash column added');
  } catch (e: any) {
    console.log('⚠️ ip_hash:', e.message.split('\n')[0]);
  }

  // Add device_info column
  try {
    await sql`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS device_info VARCHAR(255)`;
    console.log('✅ device_info column added');
  } catch (e: any) {
    console.log('⚠️ device_info:', e.message.split('\n')[0]);
  }

  // Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_comments_reactions ON public.prismatic_comments USING GIN (reactions)`;
    console.log('✅ reactions index');
  } catch (e: any) {
    console.log('⚠️ reactions index:', e.message.split('\n')[0]);
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_comments_report ON public.prismatic_comments(report_count DESC)`;
    console.log('✅ report_count index');
  } catch (e: any) {
    console.log('⚠️ report_count index:', e.message.split('\n')[0]);
  }

  console.log('🎉 Migration complete!');
}

migrate().catch(console.error);
