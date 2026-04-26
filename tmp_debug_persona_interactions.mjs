import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Test the exact query from getCommentInteractions
  const testIds = [
    '045ea41a-71dc-4fcd-ac60-eeafdf5709c5',
    '8f94d3bc-f25b-489a-a154-a0643b550a70',
    '63cc8bb9-a06e-45af-b7d6-4c8bbea6e2d2',
  ];

  for (const id of testIds) {
    console.log(`\nTesting comment_id: ${id}`);
    try {
      const rows = await sql`
        SELECT pi.id, pi.persona_id, pi.interaction_type, pi.content, pi.emoji, pi.created_at
        FROM prismatic_persona_interactions pi
        WHERE pi.comment_id = ${id}
        ORDER BY pi.created_at ASC
      `;
      console.log(`  SUCCESS: ${rows.length} rows`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  // Also check if the table exists
  try {
    const tableExists = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prismatic_persona_interactions')`;
    console.log('\nTable prismatic_persona_interactions exists:', tableExists[0].exists);
  } catch (err) {
    console.error('Table check FAILED:', err.message);
  }
}

main().catch(console.error);
