/**
 * Sync script: delete old restored accounts + insert new restored accounts.
 *
 * Run with:  npx tsx scripts/sync-restored-accounts.ts
 */
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var not set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const TO_DELETE = [
  'dengyihao@163.com',
  'm13560256090@163.com',
  'xiaoyao_lzx@163.com',
  'liuyuxin2002@163.com',
  'fengerzhi@163.com',
];

const TO_INSERT = [
  { email: '164539079@qq.com',      name: 'Rinkon' },
  { email: 'wuxiang@163.com',       name: 'shondianyuan' },
  { email: 'rachelhou_yt@163.com',  name: 'Rachel' },
  { email: '50043741@aq.com',       name: 'coolnetboy' },
  { email: '0309@163.com',           name: 'Leoaibo' },
  { email: '505883403@qq.com',      name: '格格' },
  { email: '84003180@qq.com',       name: '童文思' },
];

async function main() {
  console.log('--- Deleting old accounts ---');
  for (const email of TO_DELETE) {
    const result = await sql`DELETE FROM users WHERE email = ${email.toLowerCase()}`;
    console.log(`[DELETE] ${email} — rows affected: ${result.length}`);
  }

  console.log('\n--- Inserting new accounts ---');
  for (const acct of TO_INSERT) {
    const normalized = acct.email.toLowerCase();
    const existing = await sql`SELECT id FROM users WHERE email = ${normalized} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`[SKIP] ${normalized} — already exists`);
      continue;
    }
    const userId = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, email, "passwordHash", name, preferences, status, role, plan, credits, "emailVerified", "createdAt", "updatedAt")
      VALUES (
        ${userId},
        ${normalized},
        NULL,
        ${acct.name},
        '{}',
        'ACTIVE',
        'FREE',
        'FREE',
        10,
        NOW(),
        NOW(),
        NOW()
      )
    `;
    console.log(`[INSERT] ${normalized} — created (id=${userId}, name=${acct.name})`);
  }

  console.log('\n--- Verifying final user list ---');
  const rows = await sql`SELECT id, email, name, status, "passwordHash" IS NOT NULL as has_pw FROM users WHERE email LIKE '%@%' ORDER BY "createdAt" DESC`;
  rows.forEach((r: any) => console.log(r.email, '|', r.name, '|', r.status, '| pw:', r.has_pw));
  console.log(`\nTotal users: ${rows.length}`);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
