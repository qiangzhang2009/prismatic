import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Admin's conversation - exact state
  const r = await pool.query(`
    SELECT c.id, c.mode, c."messageCount", c."updatedAt", c."createdAt",
           msgs.data as messages
    FROM conversations c
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'id', m.id, 'role', m.role, 'content', m.content,
        'personaId', m."personaId",
        'createdAt', m."createdAt",
        'metadata', m.metadata
      ) ORDER BY m."createdAt" DESC) as data
      FROM messages m WHERE m."conversationId" = c.id
    ) msgs ON true
    WHERE c."userId" = 'admin_1776672652233_htt4pahm'
    ORDER BY c."updatedAt" DESC
    LIMIT 1
  `);
  
  const conv = r.rows[0];
  if (!conv) { console.log('No conversations'); await pool.end(); return; }
  
  const msgs = conv.messages || [];
  const totalMsgs = msgs.length;
  
  console.log('Conversation:', conv.id);
  console.log('mode:', conv.mode);
  console.log('DB messageCount:', conv.messageCount);
  console.log('Actual messages in API response:', totalMsgs);
  console.log('Mismatch:', conv.messageCount !== totalMsgs ? `YES - off by ${totalMsgs - (conv.messageCount || 0)}` : 'no');
  
  // Check what's visible in the first 3 messages (preview) vs what the UI would show
  console.log('\nPreview (first 3 newest):');
  for (let i = 0; i < Math.min(3, totalMsgs); i++) {
    const m = msgs[i];
    const content = m.content ? m.content.slice(0, 50).replace(/\n/g, '|') : '[empty]';
    console.log(`  [${i}] ${m.role.padEnd(10)} | ${content}`);
  }
  
  // Check role distribution
  const roles: Record<string, number> = {};
  for (const m of msgs) roles[m.role] = (roles[m.role] || 0) + 1;
  console.log('\nRole distribution:', roles);
  
  // Check: are any assistant messages at the top of the preview?
  const topAssistant = msgs.findIndex(m => m.role === 'assistant');
  const topUser = msgs.findIndex(m => m.role !== 'assistant');
  console.log(`\nFirst assistant message at index: ${topAssistant}`);
  console.log(`First non-assistant message at index: ${topUser}`);
  
  // If assistant messages ARE in preview, why might they not be visible?
  // Check if content has any special characters
  const assistantMsgs = msgs.filter(m => m.role === 'assistant').slice(0, 3);
  console.log('\nSample assistant content (first 100 chars, cleaned):');
  for (const m of assistantMsgs) {
    const cleaned = m.content?.slice(0, 100).replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    console.log(`  "${cleaned}"`);
  }
  
  await pool.end();
}
main().catch(console.error);
