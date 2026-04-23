// @ts-nocheck
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Get all conversations sorted by updatedAt - with actual message counts
  const r = await pool.query(`
    SELECT c.id, c."updatedAt", c."createdAt", c."messageCount" as mc,
           c.mode, c.archived,
           (SELECT COUNT(*) FROM messages m WHERE m."conversationId" = c.id)::int as actual,
           (SELECT m.role FROM messages m WHERE m."conversationId" = c.id ORDER BY m."createdAt" DESC LIMIT 1) as last_role,
           (SELECT m.content FROM messages m WHERE m."conversationId" = c.id ORDER BY m."createdAt" DESC LIMIT 1) as last_content,
           (SELECT m."createdAt" FROM messages m WHERE m."conversationId" = c.id ORDER BY m."createdAt" DESC LIMIT 1) as last_msg_at
    FROM conversations c
    ORDER BY c."updatedAt" DESC
  `);
  
  console.log('All conversations:');
  for (const row of r.rows) {
    const content = row.last_content ? row.last_content.slice(0, 30).replace(/\n/g, ' ') : '[empty]';
    const mc_match = row.mc === row.actual ? '✓' : `✗(${row.mc} vs ${row.actual})`;
    const diff = row.last_msg_at 
      ? `${((new Date(row.updatedAt).getTime() - new Date(row.last_msg_at).getTime()) / 1000).toFixed(1)}s after last msg`
      : 'no messages';
    console.log(`  ${row.id.slice(0,12)} | mode=${row.mode} | mc=${row.mc} actual=${row.actual} ${mc_match} | last=${row.last_role} | updatedAt=${row.updatedAt.toISOString().slice(0,19)} | last_msg=${row.last_msg_at?.toISOString().slice(11,23) || 'N/A'} | ${diff}`);
  }

  // Check xHrWvYoPXceC messages in detail (oracle mode, 102 actual msgs, 3 mc)
  console.log('\n\nOracle conv (xHrWvYoPXceC) - first 10 msgs:');
  const oracle = await pool.query(`
    SELECT m.role, m.content, m."createdAt", m.metadata
    FROM messages m
    WHERE m."conversationId" = 'xHrWvYoPXceC'
    ORDER BY m."createdAt" DESC
    LIMIT 10
  `);
  for (const m of oracle.rows) {
    const content = m.content ? m.content.slice(0, 60).replace(/\n/g, ' ') : '[empty]';
    console.log(`  ${m.role.padEnd(10)} | ${m.createdAt.toISOString().slice(11,23)} | ${content}`);
  }
  
  await pool.end();
}
main().catch(console.error);
