import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Check: what messages exist AFTER the last admin conversation was updated?
  const cutoff = '2026-04-23T06:38:00Z'; // 1 min after jhSvRm5V1BY63siqvtxH0 last update

  const adminId = 'admin_1776672652233_htt4pahm';

  // All messages after cutoff
  const recentMsgs = await sql`
    SELECT m.id, m."conversationId", m."userId", m.role, LEFT(m.content, 60) as content, m."createdAt"
    FROM messages m
    WHERE m."createdAt" > ${cutoff}::timestamp
    ORDER BY m."createdAt" DESC
    LIMIT 30
  `;
  console.log(`\nMessages after ${cutoff}:`);
  recentMsgs.forEach((r: any) => {
    const isAdmin = r.userId === adminId;
    console.log(`  ${isAdmin ? '[ADMIN]' : '      '} ${r.conversationId} | userId=${String(r.userId).slice(0,12)} | ${r.role} | ${r.content} | ${r.createdAt}`);
  });

  // Check conversations table for any created after cutoff
  const recentConvs = await sql`
    SELECT c.id, c."userId", c.mode, c."messageCount", c."updatedAt", c."createdAt", u.email
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
    WHERE c."createdAt" > ${cutoff}::timestamp
       OR c."updatedAt" > ${cutoff}::timestamp
    ORDER BY c."updatedAt" DESC
    LIMIT 20
  `;
  console.log(`\nConversations updated after ${cutoff}:`);
  recentConvs.forEach((r: any) => {
    console.log(`  ${r.id} | owner=${r.email} | msgs=${r.messageCount} | updated=${r.updatedAt}`);
  });

  // Check for any conversations with admin messages but different userId in conversations table
  // (the cross-user contamination case)
  const crossContaminated = await sql`
    SELECT DISTINCT m."conversationId", m."userId" as msg_user, c."userId" as conv_owner
    FROM messages m
    JOIN conversations c ON c.id = m."conversationId"
    WHERE m."userId" != c."userId"
    LIMIT 10
  `;
  console.log(`\nCross-contaminated conversations (msg.user != conv.user): ${crossContaminated.length}`);
  crossContaminated.forEach((r: any) => {
    console.log(`  ${r.conversationId} | msg_by=${String(r.msg_user).slice(0,12)} | conv_owner=${String(r.conv_owner).slice(0,12)}`);
  });

  // What conversations does the admin have, and when were they last updated?
  const adminConvs = await sql`
    SELECT c.id, c."messageCount", c."updatedAt", c."createdAt",
           (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m."userId" = ${adminId}) as admin_msg_count
    FROM conversations c
    WHERE c."userId" = ${adminId}
    ORDER BY c."updatedAt" DESC
  `;
  console.log(`\nAdmin's conversations:`);
  adminConvs.forEach((r: any) => {
    console.log(`  ${r.id} | msgs_in_conv=${r.messageCount} | admin_msgs=${r.admin_msg_count} | updated=${r.updatedAt}`);
  });

  // Messages per conversation for admin (from messages table, per conversationId)
  const msgPerConv = await sql`
    SELECT m."conversationId", COUNT(*) as cnt, MIN(m."createdAt") as first, MAX(m."createdAt") as last
    FROM messages m
    WHERE m."userId" = ${adminId}
    GROUP BY m."conversationId"
    ORDER BY last DESC
  `;
  console.log(`\nAdmin messages by conversation:`);
  msgPerConv.forEach((r: any) => {
    console.log(`  ${r.conversationId} | count=${r.cnt} | first=${r.first} | last=${r.last}`);
  });
}

main().catch(console.error);
