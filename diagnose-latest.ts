// @ts-nocheck
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Find the 3 most recent conversations by updatedAt
  const recent = await pool.query(`
    SELECT c.id, c."updatedAt", c."messageCount", c.mode, c."createdAt",
           EXTRACT(EPOCH FROM (c."updatedAt" - (
             SELECT MAX(m."createdAt") FROM messages m WHERE m."conversationId" = c.id
           ))) as updatedAt_minus_lastmsg_sec
    FROM conversations c
    ORDER BY c."updatedAt" DESC
    LIMIT 5
  `);
  console.log('5 most recent conversations:');
  for (const r of recent.rows) {
    const diff = r.updatedAt_minus_lastmsg_sec !== null 
      ? `updatedAt diff: ${Number(r.updatedAt_minus_lastmsg_sec).toFixed(1)}s`
      : 'NO MESSAGES';
    console.log(`  ${r.id.slice(0,12)} | mode=${r.mode} | msgs=${r.messageCount} | updatedAt=${r.updatedAt.toISOString().slice(0,19)} | ${diff}`);
  }
  
  // For each of the top 3, show what the admin API would return (newest 3 messages)
  for (const row of recent.rows.slice(0, 3)) {
    const msgs = await pool.query(`
      SELECT m.role, m.content, m."createdAt"
      FROM messages m
      WHERE m."conversationId" = $1
      ORDER BY m."createdAt" DESC
      LIMIT 3
    `, [row.id]);
    console.log(`\n  Conv ${row.id.slice(0,12)} — admin preview (first 3 newest):`);
    for (const m of msgs.rows) {
      const content = m.content ? m.content.slice(0, 50).replace(/\n/g, ' ') : '[empty]';
      console.log(`    ${m.role.padEnd(10)} | ${m.createdAt.toISOString().slice(11,23)} | ${content}`);
    }
  }
  
  await pool.end();
}
main().catch(console.error);
