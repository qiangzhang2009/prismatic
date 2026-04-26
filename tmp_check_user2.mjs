import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  const userId = "d523fac4-3584-4cb3-8c41-e50fdb7ce69e";
  const userEmail = "3740977@qq.com";

  // Check user exists and its details
  const user = await sql`SELECT id, email, name, role, plan, credits, status FROM users WHERE id = ${userId}`;
  console.log('User:', JSON.stringify(user[0], null, 2));

  // Check if any messages exist for this user
  const msgs = await sql`SELECT id, "conversationId", role, content, "personaId", "createdAt" FROM messages WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 10`;
  console.log('\nMessages for this user:', msgs.length);
  for (const m of msgs) {
    console.log('  msg:', m.id, 'conv:', m.conversationId, 'role:', m.role, 'content:', (m.content || '').slice(0, 80));
  }

  // Check if any conversations exist for this user
  const convs = await sql`SELECT id, mode, "messageCount", "personaIds", "createdAt", "updatedAt" FROM conversations WHERE "userId" = ${userId}`;
  console.log('\nConversations for this user:', convs.length);
  for (const c of convs) {
    console.log('  conv:', c.id, 'mode:', c.mode, 'messages:', c.messageCount);
  }

  // Simulate buildConversationId for this user with wang-dongyue and ni-haixia
  const crypto = await import('crypto');
  function buildConversationId(uid: string, personaIds: string[]): string {
    const sorted = [...personaIds].sort().join(':');
    const payload = `u:${uid}:${sorted}`;
    const hash = crypto.createHash('sha256').update(payload).digest('base64url').slice(0, 16);
    return `conv_${hash}`;
  }
  const testId = buildConversationId(userId, ['wang-dongyue']);
  console.log('\nSimulated conversationId for wang-dongyue:', testId);

  // Check if this conversationId already exists (and who owns it)
  const existingConv = await sql`SELECT id, "userId" FROM conversations WHERE id = ${testId}`;
  console.log('Existing conv with this id:', existingConv.length > 0 ? existingConv[0] : 'NOT FOUND');

  // Check messages table columns more carefully
  const msgCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position`;
  console.log('\nMessages table columns:');
  for (const col of msgCols) {
    console.log('  ', col.column_name);
  }

  // Check total messages and their distribution
  const msgDist = await sql`SELECT "userId", COUNT(*) as cnt FROM messages GROUP BY "userId" ORDER BY cnt DESC LIMIT 10`;
  console.log('\nMessage distribution by userId:');
  for (const row of msgDist) {
    const u = await sql`SELECT email FROM users WHERE id = ${row.userId}`;
    console.log('  userId:', row.userId.slice(0,8), 'email:', u[0]?.email || 'unknown', 'messages:', row.cnt);
  }

  // Check all conversations and their message counts
  const allConvs = await sql`SELECT c.id, c."userId", c."messageCount", c."personaIds", c."createdAt",
    (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id) as actual_msg_count
    FROM conversations c ORDER BY c."createdAt" DESC`;
  console.log('\nAll conversations with actual message counts:');
  for (const c of allConvs) {
    const u = await sql`SELECT email FROM users WHERE id = ${c.userId}`;
    console.log('  conv:', c.id.slice(0, 20), 'user:', u[0]?.email || c.userId.slice(0,8), 'msgCount field:', c.messageCount, 'actual:', c.actual_msg_count, 'personas:', JSON.stringify(c.personaIds).slice(0, 60));
  }
}

main().catch(console.error);
