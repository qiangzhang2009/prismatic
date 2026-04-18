/**
 * reset-admin-password.ts — Reset admin password hash in database using raw SQL
 */
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const ADMIN_EMAIL = 'zxq@zxqconsulting.com';
const NEW_PASSWORD = 'zxq2026';

async function main() {
  const bcrypt = await import('bcryptjs');

  const users = await sql`SELECT id, email, role, status, "passwordHash" FROM users WHERE email = ${ADMIN_EMAIL.toLowerCase()} LIMIT 1`;
  if (users.length === 0) {
    console.error(`❌ Admin user not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }
  const admin = users[0] as any;
  console.log(`✅ Found admin: ${admin.email} (id: ${admin.id}, role: ${admin.role}, status: ${admin.status})`);
  console.log(`   Current passwordHash: ${admin.passwordHash ? `"${String(admin.passwordHash).substring(0, 20)}..."` : 'NULL'}`);

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  console.log(`\n🔐 New hash generated: "${hash.substring(0, 20)}..."`);

  await sql`UPDATE users SET "passwordHash" = ${hash}, "updatedAt" = NOW() WHERE id = ${admin.id}`;
  console.log('✅ Updated users."passwordHash"');

  const updated = await sql`SELECT id, email, role FROM users WHERE id = ${admin.id} LIMIT 1`;
  console.log(`\n✅ Password reset complete!`);
  console.log(`   Email: ${(updated[0] as any).email}`);
  console.log(`   New password: "${NEW_PASSWORD}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
