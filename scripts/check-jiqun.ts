import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const adminId = 'admin_1776672652233_htt4pahm';

  // Search all conversations for Chinese-named personas
  const allConvs = await sql`
    SELECT c.id, c."userId", c.mode, c."messageCount", c."personaIds", c."updatedAt", c."createdAt",
           u.email as owner_email
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
    ORDER BY c."updatedAt" DESC
    LIMIT 50
  `;

  console.log('=== All conversations ===');
  allConvs.forEach((r: any) => {
    console.log(`  ${r.id} | owner=${r.owner_email} | personas=${JSON.stringify(r.personaIds)} | msgs=${r.messageCount} | updated=${r.updatedAt}`);
  });

  // Also search messages for 济群法师 related content
  const msgs = await sql`
    SELECT DISTINCT m."conversationId", m.content, m."createdAt"
    FROM messages m
    WHERE m.content LIKE '%济群%' OR m.content LIKE '%法师%'
    ORDER BY m."createdAt" DESC
    LIMIT 10
  `;
  console.log('\n=== Messages mentioning 济群/法师 ===');
  msgs.forEach((r: any) => {
    console.log(`  conv=${r.conversationId} | ${r.content.slice(0, 60)} | ${r.createdAt}`);
  });

  // Check if admin has conversations with Chinese-named personas in messages
  const adminMsgs = await sql`
    SELECT m."conversationId", m.content, LEFT(m.content, 80) as preview, m."createdAt"
    FROM messages m
    WHERE m."userId" = ${adminId}
    ORDER BY m."createdAt" DESC
    LIMIT 30
  `;
  console.log('\n=== Admin recent messages ===');
  adminMsgs.forEach((r: any) => {
    console.log(`  ${r.conversationId} | ${r.preview} | ${r.createdAt}`);
  });
}

main().catch(console.error);
