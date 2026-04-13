/**
 * Database Migration Script v4 — Anonymous Comments + Geo + Guardian Duty
 * Run: npx tsx scripts/migrate-comments-geo.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const sql = neon(DATABASE_URL);

  // ── prismatic_comments: geo + avatar + gender ──────────────────────────────
  const columns: [string, string][] = [
    ['gender', 'VARCHAR(10)'],
    ['avatar_seed', 'VARCHAR(64)'],
    ['geo_country_code', 'VARCHAR(4)'],
    ['geo_country', 'VARCHAR(128)'],
    ['geo_region', 'VARCHAR(128)'],
    ['geo_city', 'VARCHAR(128)'],
  ];

  for (const [col, type] of columns) {
    try {
      await sql.unsafe(`ALTER TABLE public.prismatic_comments ADD COLUMN IF NOT EXISTS "${col}" ${type}`).raw();
      console.log(`✅ ${col} column added`);
    } catch (e: any) {
      console.log(`⚠️ ${col}: ${e.message.split('\n')[0]}`);
    }
  }

  // ── guardian_duties table ─────────────────────────────────────────────────
  console.log('\n📦 Creating guardian_duties table...');

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.guardian_duties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        persona_id VARCHAR(64) NOT NULL,
        duty_date DATE NOT NULL,
        interaction_count INTEGER DEFAULT 0,
        interaction_ids TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(persona_id, duty_date)
      )
    `).raw();
    console.log('✅ guardian_duties table created');
  } catch (e: any) {
    console.log(`⚠️ guardian_duties: ${e.message.split('\n')[0]}`);
  }

  // Index on duty_date
  try {
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_guardian_duties_date ON public.guardian_duties(duty_date)`).raw();
    console.log('✅ guardian_duties date index');
  } catch (e: any) {
    console.log(`⚠️ guardian_duties date index: ${e.message.split('\n')[0]}`);
  }

  // ── Indexes for geo columns ───────────────────────────────────────────────
  try {
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_comments_geo_country ON public.prismatic_comments(geo_country)`).raw();
    console.log('✅ geo_country index');
  } catch (e: any) {
    console.log(`⚠️ geo_country index: ${e.message.split('\n')[0]}`);
  }

  try {
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_comments_geo_region ON public.prismatic_comments(geo_region)`).raw();
    console.log('✅ geo_region index');
  } catch (e: any) {
    console.log(`⚠️ geo_region index: ${e.message.split('\n')[0]}`);
  }

  console.log('\n🎉 Migration complete!');
}

migrate().catch(console.error);
