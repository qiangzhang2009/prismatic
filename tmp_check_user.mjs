import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  const user = await sql`SELECT id, email, name, role, plan, credits FROM users WHERE email = '3740977@qq.com'`;
  console.log('User rows:', user.length);
  if (user.length > 0) {
    console.log('User:', JSON.stringify(user[0], null, 2));
    const userId = user[0].id;
    
    const convs = await sql`SELECT id, mode, "messageCount", "personaIds", "createdAt", "updatedAt" FROM conversations WHERE "userId" = ${userId} ORDER BY "updatedAt" DESC LIMIT 20`;
    console.log('Conversations count:', convs.length);
    for (const c of convs) {
      console.log('  conv:', c.id, 'mode:', c.mode, 'messages:', c.messageCount, 'personas:', JSON.stringify(c.personaIds), 'updated:', c.updatedAt);
    }

    const msgs = await sql`SELECT id, "conversationId", role, content, "personaId", "createdAt" FROM messages WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 20`;
    console.log('Messages count:', msgs.length);
    for (const m of msgs) {
      const convId = m.conversationId;
      console.log('  msg:', m.id, 'conv:', convId, 'role:', m.role, 'persona:', m.personaId, 'content:', (m.content || '').slice(0, 60));
    }
  } else {
    console.log('User NOT found in DB');
  }
}

main().catch(console.error);
