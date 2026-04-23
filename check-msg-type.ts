import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Check if any message content is JSON-encoded (double-serialized)
  const r = await pool.query(`
    SELECT m.id, m.role, m.content, m.metadata,
           json_typeof(m.metadata::json) as meta_type,
           json_extract_path(m.metadata::json, 'mode') as meta_mode
    FROM messages m
    WHERE m."conversationId" = (
      SELECT id FROM conversations ORDER BY "updatedAt" DESC LIMIT 1
    )
    ORDER BY m."createdAt" DESC
    LIMIT 5
  `);
  
  for (const row of r.rows) {
    const content = row.content;
    const isJson = content?.startsWith('{') || content?.startsWith('[');
    console.log(`role=${row.role} | content_type=${typeof content} | starts_json=${isJson} | first60=${content?.slice(0, 60).replace(/\n/g, ' ')}`);
    console.log(`  metadata=${row.metadata} | meta_type=${row.meta_type} | meta_mode=${row.meta_mode}`);
  }
  
  // Also check if content might have NULL bytes or other weird chars
  const latest = await pool.query(`
    SELECT m.content, octet_length(m.content) as len
    FROM messages m
    WHERE m."conversationId" = (SELECT id FROM conversations ORDER BY "updatedAt" DESC LIMIT 1)
    AND m.role = 'assistant'
    ORDER BY m."createdAt" DESC
    LIMIT 3
  `);
  console.log('\nLatest 3 assistant messages:');
  for (const m of latest.rows) {
    const first = m.content?.slice(0, 80).replace(/\n/g, '\\n').replace(/[\x00-\x1f]/g, '?');
    console.log(`  len=${m.len} | ${first}`);
  }
  
  await pool.end();
}
main().catch(console.error);
