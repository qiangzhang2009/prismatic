import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT id, email, name, status, "passwordHash" IS NOT NULL as has_pw FROM users WHERE email LIKE '%@%' ORDER BY "createdAt" DESC LIMIT 20`;
  rows.forEach((r: any) => console.log(r.email, '|', r.name, '|', r.status, '| pw:', r.has_pw));
}

main();
