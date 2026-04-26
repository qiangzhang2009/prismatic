import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Check messages table columns
  const msgCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position`;
  console.log('=== messages table columns ===');
  for (const col of msgCols) {
    console.log('  ', col.column_name, ':', col.data_type);
  }

  // Check conversations table columns
  const convCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations' ORDER BY ordinal_position`;
  console.log('\n=== conversations table columns ===');
  for (const col of convCols) {
    console.log('  ', col.column_name, ':', col.data_type);
  }

  // Check if there's a userId column issue in messages table
  // The Prisma schema uses camelCase but the SQL uses snake_case
  // Let's check what the ACTUAL column names are
  console.log('\n=== Testing snake_case vs camelCase in messages ===');

  // Try reading with snake_case (what the SQL uses)
  try {
    const snakeResult = await sql`SELECT id, "conversationId", "userId", role FROM messages LIMIT 1`;
    console.log('snake_case (conversationId, userId): SUCCESS', JSON.stringify(snakeResult[0] || 'no rows'));
  } catch (e) {
    console.log('snake_case FAILED:', e.message.slice(0, 200));
  }

  // Try reading with camelCase (what Prisma schema says)
  try {
    const camelResult = await sql`SELECT id, "conversationId", "userId", role FROM messages LIMIT 1`;
    console.log('camelCase (conversationId, userId): SUCCESS', JSON.stringify(camelResult[0] || 'no rows'));
  } catch (e) {
    console.log('camelCase FAILED:', e.message.slice(0, 200));
  }

  // Check if "personaId" or "persona_id" exists
  const personaIdCheck = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name LIKE '%persona%'`;
  console.log('\nPersona-related columns:', personaIdCheck.map(r => r.column_name));

  // Check the message inserts that ARE there - what userId do they have?
  const msgUserIds = await sql`SELECT DISTINCT "userId", COUNT(*) as cnt FROM messages GROUP BY "userId"`;
  console.log('\nMessage userId distribution:', msgUserIds);

  // Critical test: can we INSERT a message with a specific userId?
  console.log('\n=== Testing message INSERT for 3740977@qq.com user ===');
  const user = await sql`SELECT id FROM users WHERE email = '3740977@qq.com' LIMIT 1`;
  if (user.length > 0) {
    const testUserId = user[0].id;
    console.log('Test userId:', testUserId);

    // First, create a test conversation
    const testConvId = `test_debug_${Date.now()}`;
    try {
      await sql`INSERT INTO conversations (id, "userId", mode, type, "messageCount", "createdAt", "updatedAt")
                 VALUES (${testConvId}, ${testUserId}, 'solo', 'CHAT', 1, NOW(), NOW())`;
      console.log('Test conversation created');

      // Now insert a test message
      await sql`INSERT INTO messages (id, "conversationId", "userId", role, content, "createdAt")
                 VALUES (${`msg_${Date.now()}`}, ${testConvId}, ${testUserId}, 'user', 'Test content for debug', NOW())`;
      console.log('Test message inserted successfully');

      // Verify
      const verify = await sql`SELECT * FROM messages WHERE "conversationId" = ${testConvId}`;
      console.log('Verification - messages found:', verify.length);
      for (const m of verify) {
        console.log('  msg userId:', m.userId, 'matches:', m.userId === testUserId);
      }

      // Cleanup
      await sql`DELETE FROM messages WHERE "conversationId" = ${testConvId}`;
      await sql`DELETE FROM conversations WHERE id = ${testConvId}`;
      console.log('Cleanup done');
    } catch (e) {
      console.log('ERROR:', e.message.slice(0, 300));
    }
  }
}

main().catch(console.error);
