/**
 * test-login.ts — 测试 verifyCredentials 逻辑
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const ADMIN_EMAIL = 'zxq@zxqconsulting.com';
const TEST_PASSWORDS = ['zxq2026', 'Prismatic2026!', 'AsiaBridge2026!'];

async function testLogin() {
  console.log('\n=== 测试登录逻辑 ===\n');

  const users = await sql`SELECT * FROM users WHERE email = ${ADMIN_EMAIL.toLowerCase()} LIMIT 1`;
  if (users.length === 0) {
    console.error('❌ 用户不存在');
    return;
  }
  const user: any = users[0];
  console.log(`✅ 找到用户:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Plan: ${user.plan}`);
  console.log(`   Status: ${user.status}`);
  console.log(`   passwordHash: ${user.password_hash ? `"${user.password_hash}"` : 'NULL'}`);

  // Test bcrypt comparisons
  console.log('\n--- 密码校验测试 ---');
  for (const pwd of TEST_PASSWORDS) {
    try {
      const valid = await bcrypt.compare(pwd, user.password_hash);
      console.log(`  "${pwd}" ${valid ? '✅ 匹配!' : '❌ 不匹配'}`);
    } catch (e) {
      console.log(`  "${pwd}" ❌ 校验出错: ${(e as Error).message}`);
    }
  }

  // What does the hash start with?
  if (user.password_hash) {
    console.log(`\n  Hash 前5字符: "${user.password_hash.substring(0, 5)}"`);
    console.log(`  Hash 长度: ${user.password_hash.length}`);
  }
}

testLogin().catch(console.error);
