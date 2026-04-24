import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Get admin user ID
  const adminRows = await sql`SELECT id, email, name FROM users WHERE email = 'zxq@zxqconsulting.com' LIMIT 1`;
  if (adminRows.length === 0) {
    console.log('Admin not found!');
    return;
  }
  const admin = adminRows[0];
  console.log(`Admin: ${admin.email} | id=${admin.id}`);

  // Get all conversations for admin
  const convs = await sql`
    SELECT c.id, c.mode, c."messageCount", c."personaIds", c."createdAt", c."updatedAt"
    FROM conversations c
    WHERE c."userId" = ${admin.id}
    ORDER BY c."updatedAt" DESC
    LIMIT 50
  `;
  console.log(`\nConversations for admin (${convs.length}):`);
  convs.forEach((r: any) => {
    console.log(`  ${r.id} | mode=${r.mode} | msgs=${r.messageCount} | personas=${JSON.stringify(r.personaIds)} | updated=${r.updatedAt}`);
  });

  // Also check messages table for admin userId - any orphaned messages?
  const orphanedMsgs = await sql`
    SELECT COUNT(*) as cnt, "conversationId"
    FROM messages
    WHERE "userId" = ${admin.id}
    GROUP BY "conversationId"
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `;
  console.log(`\nMessages per conversation (by admin userId):`);
  orphanedMsgs.forEach((r: any) => {
    console.log(`  conv=${r.conversationId} | count=${r.cnt}`);
  });

  // Check for conversations NOT belonging to admin that have admin messages
  // (same cross-user contamination issue)
  const crossUserConvs = await sql`
    SELECT DISTINCT m."conversationId"
    FROM messages m
    WHERE m."userId" = ${admin.id}
      AND m."conversationId" NOT IN (
        SELECT c.id FROM conversations c WHERE c."userId" = ${admin.id}
      )
  `;
  console.log(`\nAdmin messages in conversations NOT owned by admin: ${crossUserConvs.length}`);
  crossUserConvs.forEach((r: any) => {
    console.log(`  conv=${r.conversationId}`);
  });

  // Check all recent messages by admin (regardless of conversation owner)
  const recentMsgs = await sql`
    SELECT m.id, m."conversationId", m.role, LEFT(m.content, 80) as content, m."createdAt"
    FROM messages m
    WHERE m."userId" = ${admin.id}
    ORDER BY m."createdAt" DESC
    LIMIT 20
  `;
  console.log(`\nMost recent admin messages (${recentMsgs.length}):`);
  recentMsgs.forEach((r: any) => {
    console.log(`  ${r.conversationId} | ${r.role} | ${r.content} | ${r.createdAt}`);
  });

  // Check conversations with recent updates
  const recentConvs = await sql`
    SELECT c.id, c."userId", c.mode, c."messageCount", c."updatedAt",
           u.email as owner_email
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
    ORDER BY c."updatedAt" DESC
    LIMIT 20
  `;
  console.log(`\nMost recently updated conversations:`);
  recentConvs.forEach((r: any) => {
    console.log(`  ${r.id} | owner=${r.owner_email} | mode=${r.mode} | msgs=${r.messageCount} | updated=${r.updatedAt}`);
  });
}

main().catch(console.error);
