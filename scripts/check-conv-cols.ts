import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const johnId = '559a89d2-888c-4e5c-9e39-6459a9794b61';

  // Check if conversation xHrWvYoPXceCtZqX2UzW2 exists
  const conv = await sql`SELECT * FROM conversations WHERE id = 'xHrWvYoPXceCtZqX2UzW2' LIMIT 1`;
  console.log('Conversation xHrWvYoPXceCtZqX2UzW2:');
  if (conv.length === 0) {
    console.log('  NOT FOUND in conversations table');
  } else {
    console.log('  Found:', conv[0]);
  }

  // What's the conversation table's userId column name?
  const colInfo = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' AND table_schema = 'public' ORDER BY ordinal_position`;
  console.log('\nConversations table columns:');
  colInfo.forEach((r: any) => console.log(' ', r.column_name));

  // Check messages table columns
  const msgColInfo = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND table_schema = 'public' ORDER BY ordinal_position`;
  console.log('\nMessages table columns:');
  msgColInfo.forEach((r: any) => console.log(' ', r.column_name));

  // Check the messages' userId vs conversations.userId
  // The conversation has userId as text... let me check
  console.log('\nAll conversation IDs and userIds (sample):');
  const allConvs = await sql`SELECT id, "userId", mode FROM conversations LIMIT 10`;
  allConvs.forEach((r: any) => console.log(`  id=${r.id} | userId=${r.userId} | mode=${r.mode}`));

  // Does the conversation xHrWvYoPXceCtZqX2UzW2 have a different userId?
  const convMsgs = await sql`SELECT DISTINCT "userId" FROM messages WHERE "conversationId" = 'xHrWvYoPXceCtZqX2UzW2'`;
  console.log('\nDistinct userIds in messages for conv xHrWvYoPXceCtZqX2UzW2:');
  convMsgs.forEach((r: any) => console.log(' ', r.userId));
}

main().catch(console.error);
