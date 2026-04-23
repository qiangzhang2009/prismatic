// @ts-nocheck
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Admin's user ID
  const adminId = 'admin_1776672652233_htt4pahm';
  
  // Simulate the exact admin API query
  const r = await pool.query(`
    SELECT c.id, c."userId", c.mode, c."messageCount", c."updatedAt",
           msgs.data as messages
    FROM conversations c
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'id', m.id, 'role', m.role, 'content', m.content,
        'personaId', m."personaId", 'tokensInput', m."tokensInput",
        'tokensOutput', m."tokensOutput", 'apiCost', m."apiCost",
        'modelUsed', m."modelUsed", 'createdAt', m."createdAt",
        'metadata', m.metadata
      ) ORDER BY m."createdAt" DESC) as data
      FROM messages m WHERE m."conversationId" = c.id
    ) msgs ON true
    WHERE c."userId" = $1
    ORDER BY c."updatedAt" DESC
    LIMIT 20
  `, [adminId]);

  console.log(`Admin sees ${r.rows.length} conversations:`);
  for (let i = 0; i < r.rows.length; i++) {
    const c = r.rows[i];
    const msgs = c.messages || [];
    const roles: Record<string, number> = {};
    for (const m of msgs) roles[m.role] = (roles[m.role] || 0) + 1;
    const last3 = msgs.slice(0, 3).map((m: any) => {
      const content = m.content ? m.content.slice(0, 30).replace(/\n/g, ' ').padEnd(32) : '[empty]'.padEnd(32);
      return `${m.role.padEnd(10)} ${content}`;
    }).join(' | ');
    console.log(`\n[${i}] ${c.id.slice(0,12)} mode=${c.mode} returned_msgs=${msgs.length} db_mc=${c.messageCount} roles=${JSON.stringify(roles)}`);
    console.log(`    updatedAt=${c.updatedAt.toISOString().slice(0,19)}`);
    console.log(`    last3: ${last3}`);
  }

  await pool.end();
}
main().catch(console.error);
