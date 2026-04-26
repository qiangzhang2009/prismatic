import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL!;
const sql = neon(url);

async function main() {
  const users = await sql`SELECT id, email, role, plan, credits FROM prismatic_users WHERE email = 'demo1@prismatic.app'`;
  console.log('CURRENT DB:', JSON.stringify(users, null, 2));
}

main().catch(console.error);
