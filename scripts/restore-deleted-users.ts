/**
 * Seed script: restore 6 deleted user accounts in the database.
 *
 * These users have no password set initially (passwordHash = null).
 * The login route is configured to auto-save the password the user enters
 * on first login for RESTORED_ACCOUNTS — giving them a seamless recovery UX
 * without them knowing their account was deleted.
 *
 * Run with:  npx ts-node scripts/restore-deleted-users.ts
 * Or:        npx tsx          scripts/restore-deleted-users.ts
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const RESTORED_ACCOUNTS = [
  { email: 'dengyihao@163.com',        name: 'DYH' },
  { email: 'm13560256090@163.com',     name: '陈俊豪' },
  { email: 'xiaoyao_lzx@163.com',      name: '逍遥' },
  { email: 'liuyuxin2002@163.com',     name: '刘宇欣' },
  { email: 'fengerzhi@163.com',        name: '冯二狗' },
  { email: 'johnzhangfuture@gmail.com', name: 'John' },
];

async function main() {
  console.log('Starting user restore seed...\n');

  for (const acct of RESTORED_ACCOUNTS) {
    const normalized = acct.email.toLowerCase();
    const userId = crypto.randomUUID();

    // Check if already exists
    const existing = await sql`
      SELECT id, email FROM users WHERE email = ${normalized} LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`[SKIP] ${normalized} — already exists (id=${existing[0].id})`);
      continue;
    }

    // Insert with null passwordHash — the login route will save the real hash
    // on the user's first login attempt.
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

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
