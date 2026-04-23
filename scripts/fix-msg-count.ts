import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const convId = 'xHrWvYoPXceCtZqX2UzW2';

  const cnt = await sql`SELECT COUNT(*) as cnt FROM messages WHERE "conversationId" = ${convId}`;
  console.log('Actual message count:', cnt[0].cnt);

  await sql`UPDATE conversations SET "messageCount" = ${cnt[0].cnt}, "updatedAt" = NOW() WHERE id = ${convId}`;
  console.log('messageCount updated to', cnt[0].cnt);

  const v = await sql`SELECT id, "userId", mode, "messageCount" FROM conversations WHERE id = ${convId}`;
  console.log('Verified:', v[0]);
}

main().catch(console.error);
