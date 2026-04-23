import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Get johnzhangfuture user ID
  const userRows = await sql`SELECT id, email, name FROM users WHERE email = 'johnzhangfuture@gmail.com' LIMIT 1`;
  if (userRows.length === 0) {
    console.log('johnzhangfuture not found in users table!');
    return;
  }
  const user = userRows[0];
  console.log(`User: ${user.email} | id=${user.id}`);

  // Get conversations
  const convs = await sql`SELECT id, mode, "messageCount", "updatedAt", "createdAt" FROM conversations WHERE "userId" = ${user.id} ORDER BY "createdAt" DESC LIMIT 20`;
  console.log(`\nConversations (${convs.length}):`);
  if (convs.length === 0) {
    // Check if userId column exists in conversations and what it looks like
    const sample = await sql`SELECT "userId" FROM conversations LIMIT 5`;
    console.log('Sample userId values in conversations:');
    sample.forEach((r: any) => console.log(' ', r.userId));
  } else {
    convs.forEach((r: any) => console.log(`  ${r.id} | mode=${r.mode} | msgs=${r.messageCount} | ${r.createdAt}`));
  }

  // Check all users in DB
  console.log('\n=== All users ===');
  const allUsers = await sql`SELECT id, email, name FROM users WHERE status = 'ACTIVE' ORDER BY "createdAt" DESC`;
  allUsers.forEach((r: any) => console.log(`  ${r.email} | ${r.name} | id=${r.id}`));

  // Check messages table for johnzhangfuture
  const msgs = await sql`SELECT id, "conversationId", role, content FROM messages WHERE "userId" = ${user.id} ORDER BY "createdAt" DESC LIMIT 5`;
  console.log(`\nMessages for johnzhangfuture: ${msgs.length}`);
  msgs.forEach((r: any) => console.log(`  ${r.id} | conv=${r["conversationId"]} | ${r.role} | ${String(r.content).slice(0, 50)}`));
}

main().catch(console.error);
