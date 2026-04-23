import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Check: who owns conversation xHrWvYoPXceCtZqX2UzW2?
  const conv = await sql`SELECT id, "userId", mode FROM conversations WHERE id = 'xHrWvYoPXceCtZqX2UzW2' LIMIT 1`;
  console.log('Conversation owner:', conv[0]);

  // What messages does it have, with userId?
  const msgs = await sql`
    SELECT id, "userId", role, LEFT(content, 50) as content, "createdAt"
    FROM messages
    WHERE "conversationId" = 'xHrWvYoPXceCtZqX2UzW2'
    ORDER BY "createdAt" ASC
  `;
  console.log(`\nAll messages in conv xHrWvYoPXceCtZqX2UzW2 (${msgs.length}):`);
  msgs.forEach((r: any) => console.log(`  ${r["userId"]?.slice(0,8)} | ${r.role} | ${r.content} | ${r.createdAt}`));

  // Find the johnzhangfuture userId
  const john = await sql`SELECT id, email FROM users WHERE email = 'johnzhangfuture@gmail.com' LIMIT 1`;
  const johnId = john[0]?.id;
  console.log(`\njohnzhangfuture id: ${johnId}`);

  // Check what conversations johnzhangfuture's userId has
  const johnConvs = await sql`SELECT id, "userId", mode, "messageCount" FROM conversations WHERE "userId" = ${johnId}`;
  console.log(`\nConversations with johnzhangfuture userId: ${johnConvs.length}`);
  johnConvs.forEach((r: any) => console.log(`  ${r.id} | ${r.mode} | msgs=${r.messageCount}`));

  // Cross-check: messages table - count unique userIds per conversation
  const crossUser = await sql`
    SELECT "conversationId", COUNT(*) as cnt, array_agg(DISTINCT "userId") as user_ids
    FROM messages
    WHERE "conversationId" IN (
      SELECT id FROM conversations WHERE id = 'xHrWvYoPXceCtZqX2UzW2'
    )
    GROUP BY "conversationId"
  `;
  console.log('\nUserIds per conversation (cross-check):');
  crossUser.forEach((r: any) => console.log(`  ${r.conversationId} | count=${r.cnt} | users=${JSON.stringify(r.user_ids)}`));

  // Check conversations table for any with the john ID
  const johnConvsById = await sql`SELECT id, "userId", mode FROM conversations WHERE "userId" = ${johnId}`;
  console.log(`\nConversations where userId = johnzhangfuture: ${johnConvsById.length}`);
  johnConvsById.forEach((r: any) => console.log(`  ${r.id} | mode=${r.mode}`));
}

main().catch(console.error);
