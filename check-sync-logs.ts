// @ts-nocheck
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  const cols = await pool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sync_logs'
    ORDER BY ordinal_position
  `);
  console.log('sync_logs columns:');
  for (const c of cols.rows) {
    console.log(' ', c.column_name, '|', c.data_type, c.character_maximum_length ? `(${c.character_maximum_length})` : '', '| nullable:', c.is_nullable, '| default:', c.column_default?.slice(0, 60));
  }
  
  // Also check devices table
  const devs = await pool.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices'
    ORDER BY ordinal_position
  `);
  console.log('\ndevices columns:');
  for (const c of devs.rows) {
    console.log(' ', c.column_name, '|', c.data_type, c.character_maximum_length ? `(${c.character_maximum_length})` : '');
  }
  
  await pool.end();
}
main().catch(console.error);
