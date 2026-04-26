import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Count messages by conversationId
  const msgByConv = await sql`
    SELECT "conversationId", COUNT(*) as cnt
    FROM messages
    GROUP BY "conversationId"
    ORDER BY cnt DESC
    LIMIT 20
  `;
  console.log('Messages by conversationId:');
  for (const row of msgByConv) {
    const conv = await sql`SELECT id, "userId" FROM conversations WHERE id = ${row.conversationId}`;
    const convInfo = conv.length > 0 ? `userId=${conv[0].userId.slice(0,8)}` : 'NO CONVERSATION ROW';
    console.log('  convId:', row.conversationId, 'count:', row.cnt, convInfo);
  }

  // Get sample messages to understand structure
  const sampleMsgs = await sql`SELECT id, "conversationId", "userId", role, "personaId", "createdAt" FROM messages ORDER BY "createdAt" DESC LIMIT 5`;
  console.log('\nSample messages:');
  for (const m of sampleMsgs) {
    console.log('  id:', m.id, 'conv:', m.conversationId, 'userId:', m.userId.slice(0,8), 'role:', m.role);
  }

  // Check all users
  const users = await sql`SELECT id, email, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 10`;
  console.log('\nAll users:');
  for (const u of users) {
    console.log('  id:', u.id.slice(0,8), 'email:', u.email, 'created:', u.createdAt);
  }
}

main().catch(console.error);
