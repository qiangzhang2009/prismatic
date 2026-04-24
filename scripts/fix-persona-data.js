/**
 * Fix data issues in production database
 * 1. Deactivate jiqun (corpus is wrong person: 济群法师 instead of 刘慈欣)
 */
const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  console.log('=== Fixing production data ===\n');

  // Fix 1: Deactivate jiqun (wrong persona in corpus)
  const jiqun = await pool.query(`
    UPDATE distilled_personas
    SET "isActive" = false, "isPublished" = false
    WHERE slug = 'jiqun'
    RETURNING slug, name, "namezh", "isActive", "isPublished"
  `);
  if (jiqun.rows[0]) {
    console.log(`  ✓ jiqun deactivated (was: ${jiqun.rows[0].namezh})`);
  }

  console.log('\nDone.');
  await pool.end();
}

fix().catch(e => { console.error(e); process.exit(1); });
