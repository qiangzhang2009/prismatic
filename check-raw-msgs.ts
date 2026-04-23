// @ts-nocheck
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Check xHrWvYoPXceC messages directly
  const oracle = await pool.query(`
    SELECT id, role, content, "createdAt", "conversationId", "userId"
    FROM messages
    WHERE "conversationId" = 'xHrWvYoPXceC'
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  console.log('Oracle conv messages by convId direct:', oracle.rows.length);
  for (const m of oracle.rows) {
    const content = m.content ? m.content.slice(0, 50).replace(/\n/g, ' ') : '[empty]';
    console.log(`  ${m.role} | ${m.createdAt?.toISOString().slice(11,23)} | ${content}`);
  }
  
  // Also check if there's a user conversation (different ID) for oracle
  const oracles = await pool.query(`
    SELECT id, "userId", mode, "messageCount", "updatedAt"
    FROM conversations 
    WHERE id LIKE '%xHrWv%' OR id LIKE '%oracle%'
    ORDER BY "updatedAt" DESC
  `);
  console.log('\nConversations matching oracle pattern:', oracles.rows.length);
  for (const c of oracles.rows) {
    console.log(`  ${c.id} | userId=${c.userId} | mode=${c.mode} | mc=${c.messageCount}`);
  }
  
  // Check user ID of the admin
  const adminUser = await pool.query(`
    SELECT id, name, email FROM users WHERE email = 'admin@prismatic.ai' LIMIT 1
  `);
  console.log('\nAdmin user:', adminUser.rows[0]);
  
  // Get all unique userIds with conversations
  const userIds = await pool.query(`
    SELECT DISTINCT c."userId", u.name, u.email,
           (SELECT COUNT(*) FROM conversations WHERE "userId" = c."userId") as conv_count,
           (SELECT MAX(c2."updatedAt") FROM conversations c2 WHERE c2."userId" = c."userId") as latest_conv
    FROM conversations c
    LEFT JOIN users u ON u.id = c."userId"
  `);
  console.log('\nUsers with conversations:');
  for (const r of userIds.rows) {
    console.log(`  userId=${r.userId} | name=${r.name} | email=${r.email} | convs=${r.conv_count} | latest=${r.latest_conv?.toISOString().slice(0,19)}`);
  }
  
  await pool.end();
}
main().catch(console.error);
