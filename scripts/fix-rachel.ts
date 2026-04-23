import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Re-insert rachelhou
  const email = 'rachelhou_yt@163.com';
  const normalized = email.toLowerCase();
  const existing = await sql`SELECT id FROM users WHERE email = ${normalized} LIMIT 1`;
  if (existing.length > 0) {
    console.log('rachelhou_yt already exists');
  } else {
    const { randomUUID } = await import('crypto');
    const userId = randomUUID();
    await sql`
      INSERT INTO users (id, email, "passwordHash", name, preferences, status, role, plan, credits, "emailVerified", "createdAt", "updatedAt")
      VALUES (
        ${userId},
        ${normalized},
        NULL,
        'Rachel',
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
    console.log(`INSERTED rachelhou_yt@163.com (id=${userId})`);
  }

  // Verify all new accounts
  console.log('\n=== Final User List ===');
  const newAccounts = [
    '164539079@qq.com',
    'wuxiang@163.com',
    'rachelhou_yt@163.com',
    '50043741@aq.com',
    '0309@163.com',
    '505883403@qq.com',
    '84003180@qq.com',
    'johnzhangfuture@gmail.com',
  ];
  for (const e of newAccounts) {
    const rows = await sql`SELECT id, email, name, status, "passwordHash" IS NOT NULL as has_pw FROM users WHERE email = ${e.toLowerCase()} LIMIT 1`;
    if (rows.length === 0) {
      console.log(`MISSING: ${e}`);
    } else {
      console.log(`OK: ${e} | ${rows[0].name} | pw=${rows[0].has_pw}`);
    }
  }
}

main().catch(console.error);
