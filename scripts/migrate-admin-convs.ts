/**
 * Plan A: Migrate xHrWvYoPXceCtZqX2UzW2 conversation ownership to admin.
 *
 * Current state:
 *   - conversations.userId = johnzhangfuture (559a89d2)
 *   - messages: mixed from 3 users:
 *       - d523fac4 (朴素贝叶斯) — original owner, majority
 *       - 559a89d2 (johnzhangfuture) — contributed later
 *       - admin (admin_1776672652233_htt4pahm) — iPad session
 *
 * Decision: migrate to admin since admin is the most recent active user
 * and johnzhangfuture's account has been deleted.
 *
 * Also: fix the duplicate cross-contamination where d523fac4's messages
 * live in a conversation that was reassigned to johnzhangfuture.
 */
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const convId = 'xHrWvYoPXceCtZqX2UzW2';
  const adminId = 'admin_1776672652233_htt4pahm';
  const johnId = '559a89d2-888c-4e5c-9e39-6459a9794b61';
  const puhuaId = 'd523fac4-3584-4cb3-8c41-e50fdb7ce69e';

  // Step 1: Check current state
  const conv = await sql`SELECT id, "userId", mode, "messageCount", "updatedAt" FROM conversations WHERE id = ${convId} LIMIT 1`;
  console.log('Before migration:', conv[0]);

  const msgCount = await sql`SELECT COUNT(*) as cnt FROM messages WHERE "conversationId" = ${convId}`;
  console.log('Actual message count:', msgCount[0].cnt);

  const byUser = await sql`
    SELECT "userId", COUNT(*) as cnt
    FROM messages
    WHERE "conversationId" = ${convId}
    GROUP BY "userId"
    ORDER BY cnt DESC
  `;
  console.log('Messages by user:');
  byUser.forEach((r: any) => console.log(`  ${r.userId} | ${r.cnt}`));

  // Step 2: Migrate ownership to admin
  console.log(`\nMigrating conversation ${convId} to admin (${adminId})...`);
  await sql`UPDATE conversations SET "userId" = ${adminId}, "messageCount" = ${msgCount[0].cnt}, "updatedAt" = NOW() WHERE id = ${convId}`;

  // Step 3: Update all messages to have consistent userId (admin)
  console.log('Updating all messages to admin userId...');
  await sql`UPDATE messages SET "userId" = ${adminId} WHERE "conversationId" = ${convId}`;

  // Step 4: Verify
  const after = await sql`SELECT id, "userId", mode, "messageCount", "updatedAt" FROM conversations WHERE id = ${convId} LIMIT 1`;
  console.log('\nAfter migration:', after[0]);

  const byUserAfter = await sql`
    SELECT "userId", COUNT(*) as cnt
    FROM messages
    WHERE "conversationId" = ${convId}
    GROUP BY "userId"
    ORDER BY cnt DESC
  `;
  console.log('Messages by user after:');
  byUserAfter.forEach((r: any) => console.log(`  ${r.userId} | ${r.cnt}`));

  // Also: migrate johnzhangfuture's other conversation kZlfgvit3J_-z7wN9pqL_
  const conv2Id = 'kZlfgvit3J_-z7wN9pqL_';
  const conv2 = await sql`SELECT id, "userId", mode, "messageCount" FROM conversations WHERE id = ${conv2Id} LIMIT 1`;
  console.log(`\nAlso checking ${conv2Id}:`, conv2[0]);
  if (conv2.length > 0) {
    await sql`UPDATE conversations SET "userId" = ${adminId}, "updatedAt" = NOW() WHERE id = ${conv2Id}`;
    await sql`UPDATE messages SET "userId" = ${adminId} WHERE "conversationId" = ${conv2Id}`;
    console.log(`Migrated ${conv2Id} to admin`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
