import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Simulate exactly what the admin API does for page 1
  const r = await pool.query(`
    SELECT c.id, c."updatedAt", c."messageCount", c.mode,
           msgs.data as messages
    FROM conversations c
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'id', m.id, 'role', m.role, 'content', m.content,
        'personaId', m."personaId", 'tokensInput', m."tokensInput",
        'tokensOutput', m."tokensOutput", 'apiCost', m."apiCost",
        'modelUsed', m."modelUsed", 'createdAt', m."createdAt",
        'metadata', m.metadata
      ) ORDER BY m."createdAt" DESC) as data
      FROM messages m WHERE m."conversationId" = c.id
    ) msgs ON true
    ORDER BY c."updatedAt" DESC
    LIMIT 20
  `);
  
  const conv = r.rows[0];
  if (!conv) { console.log('No conversations'); await pool.end(); return; }
  
  console.log('Admin API page 1, first conversation:');
  console.log('  ID:', conv.id);
  console.log('  updatedAt:', conv.updatedAt);
  console.log('  messageCount:', conv.messageCount);
  console.log('  mode:', conv.mode);
  console.log('  messages count:', conv.messages?.length || 0);
  console.log('  First 5 messages (newest first):');
  const msgs = conv.messages?.slice(0, 5) || [];
  for (const m of msgs) {
    const content = m.content ? m.content.slice(0, 60).replace(/\n/g, ' ') : '[empty]';
    console.log(`    ${m.role.padEnd(10)} | ${content}`);
  }
  
  await pool.end();
}
main().catch(console.error);
