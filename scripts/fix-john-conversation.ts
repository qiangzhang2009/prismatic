/**
 * Fix johnzhangfuture conversation ownership.
 *
 * Root cause: johnzhangfuture used the same browser/device as 朴素贝叶斯.
 * Browser's localStorage cached conversationId=xHrWvYoPXceCtZqX2UzW2
 * (created by 朴素贝叶斯). Messages were persisted under johnzhangfuture's
 * userId, but conversations.userId stayed with 朴素贝叶斯.
 *
 * Fix: reassign conversations.userId to johnzhangfuture.
 * Also update any messages with mismatched userId.
 */
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const johnId = '559a89d2-888c-4e5c-9e39-6459a9794b61';
  const puhuaId = 'd523fac4-3584-4cb3-8c41-e50fdb7ce69e';

  // Step 1: Find all conversations that have messages from johnzhangfuture
  const johnConvs = await sql`
    SELECT DISTINCT m."conversationId"
    FROM messages m
    WHERE m."userId" = ${johnId}
  `;
  console.log(`Messages from johnzhangfuture in conversations:`);
  johnConvs.forEach((r: any) => console.log(`  ${r.conversationId}`));

  // Step 2: Reassign these conversations to johnzhangfuture
  for (const row of johnConvs) {
    const convId = row.conversationId;
    // Check who currently owns it
    const conv = await sql`SELECT id, "userId" FROM conversations WHERE id = ${convId} LIMIT 1`;
    if (conv.length > 0) {
      const currentOwner = conv[0].userId;
      if (currentOwner === johnId) {
        console.log(`Already owned by johnzhangfuture: ${convId}`);
      } else {
        console.log(`Reassigning ${convId} from ${currentOwner} to johnzhangfuture`);
        await sql`UPDATE conversations SET "userId" = ${johnId}, "updatedAt" = NOW() WHERE id = ${convId}`;
      }
    }
  }

  // Step 3: Fix any messages with wrong userId
  // (messages that belong to this conversation but have the old userId)
  // Only fix if the message userId doesn't match the conversation owner
  const convIds = johnConvs.map((r: any) => r.conversationId);
  if (convIds.length > 0) {
    const fixResult = await sql`
      UPDATE messages
      SET "userId" = ${johnId}
      WHERE "conversationId" = ANY(${convIds}::text[])
        AND "userId" != ${johnId}
    `;
    console.log(`Updated ${fixResult.length} messages with new userId`);
  }

  // Step 4: Verify
  console.log('\n=== Verification ===');
  const verify = await sql`
    SELECT c.id, c."userId", c.mode, c."messageCount",
           (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m."userId" = ${johnId}) as "johnMsgs",
           (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id AND m."userId" != ${johnId}) as "otherMsgs"
    FROM conversations c
    WHERE c."userId" = ${johnId}
  `;
  console.log(`\nConversations now owned by johnzhangfuture: ${verify.length}`);
  verify.forEach((r: any) => {
    console.log(`  ${r.id} | mode=${r.mode} | total_msgs=${r.messageCount} | john_msgs=${r.johnMsgs} | other_msgs=${r.otherMsgs}`);
  });
}

main().catch(console.error);
