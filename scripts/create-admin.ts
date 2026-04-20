/**
 * create-admin.ts — Create admin user directly in the database
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const ADMIN_EMAIL = 'zxq@zxqconsulting.com';
const ADMIN_PASSWORD = 'zxq2026';
const ADMIN_NAME = 'Admin';

async function main() {
  // Check if user already exists
  const existing = await sql`SELECT id, email, role FROM users WHERE email = ${ADMIN_EMAIL.toLowerCase()} LIMIT 1`;
  if (existing.length > 0) {
    console.log(`User already exists: ${existing[0].email} (role: ${(existing[0] as any).role})`);
    // Update role to ADMIN
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await sql`UPDATE users SET role = 'ADMIN', "passwordHash" = ${hash}, "updatedAt" = NOW() WHERE email = ${ADMIN_EMAIL.toLowerCase()}`;
    console.log(`✅ Updated role to ADMIN and set password`);
    return;
  }

  // Create new admin user
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const id = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await sql`
    INSERT INTO users (id, email, "passwordHash", name, role, plan, credits, status, preferences, "createdAt", "updatedAt")
    VALUES (
      ${id},
      ${ADMIN_EMAIL.toLowerCase()},
      ${hash},
      ${ADMIN_NAME},
      'ADMIN',
      'LIFETIME',
      99999,
      'ACTIVE',
      '{}',
      NOW(),
      NOW()
    )
  `;

  console.log(`✅ Admin user created!`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role: ADMIN`);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
