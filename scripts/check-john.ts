import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const emails = [
    'johnzhangfuture@gmail.com',
    '164539079@qq.com',
    'wuxiang@163.com',
    'rachelhou_yt@163.com',
    '50043741@aq.com',
    '0309@163.com',
    '505883403@qq.com',
    '84003180@qq.com',
    '3740977@qq.com',
    'zxq@zxqconsulting.com',
  ];

  console.log('=== User Records ===');
  for (const email of emails) {
    const rows = await sql`SELECT id, email, name, status, role, plan, credits, "passwordHash" IS NOT NULL as has_pw FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
    if (rows.length === 0) {
      console.log(`${email} → NOT FOUND`);
    } else {
      const r = rows[0];
      console.log(`${r.email} | ${r.name} | ${r.status} | ${r.role} | ${r.plan} | credits=${r.credits} | pw=${r.has_pw} | id=${r.id.slice(0, 8)}`);
    }
  }

  // Check Prisma sync — compare with prisma user table
  console.log('\n=== Prisma Schema Check ===');
  try {
    const prismaRows = await sql`SELECT id, email FROM "User" LIMIT 1`;
    console.log('Prisma "User" table exists');
  } catch (e: any) {
    console.log('Prisma "User" table: ' + e.message.slice(0, 100));
  }

  // Check daily message count for johnzhangfuture
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const jhRows = await sql`SELECT id FROM users WHERE email = 'johnzhangfuture@gmail.com' LIMIT 1`;
  if (jhRows.length > 0) {
    const jhId = jhRows[0].id;
    const msgCount = await sql`SELECT COUNT(*) as cnt FROM messages WHERE "userId" = ${jhId} AND "createdAt" >= ${today} AND content != '[message-counted]'`;
    console.log(`\njohnzhangfuture today message count: ${msgCount[0].cnt}`);
  }
}

main();
