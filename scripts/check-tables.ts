import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

async function checkTables() {
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'prismatic_%'
    ORDER BY tablename
  `;

  console.log('📋 所有 prismatic_ 开头的表:');
  for (const t of tables as any[]) {
    const count = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(t.tablename)}`;
    console.log(`  ${t.tablename}: ${count[0].cnt} 行`);
  }
}

checkTables().catch(console.error);
