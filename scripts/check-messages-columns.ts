import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function main() {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position
  `;
  console.log('messages columns:');
  for (const r of cols as any[]) {
    console.log(' ', r.column_name);
  }
}

main().catch(console.error);
