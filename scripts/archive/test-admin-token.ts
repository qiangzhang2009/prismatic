import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const DATABASE_URL = process.env.DATABASE_URL!;
const AUTH_SECRET = process.env.AUTH_SECRET || 'prismatic-dev-secret-2024';
const sql = neon(DATABASE_URL);

async function testAdminTokenAndCookie() {
  console.log('\n=== 测试 Admin Token 和 Cookie 问题 ===\n');

  // 1. 获取 admin 用户
  const adminUsers = await sql`
    SELECT id, email, name, role, status, plan, credits
    FROM users
    WHERE role = 'ADMIN'
    LIMIT 1
  `;

  if (adminUsers.length === 0) {
    console.log('❌ 没有找到 ADMIN 用户');
    return;
  }

  const admin = adminUsers[0];
  console.log('Admin 用户:', admin);

  // 2. 生成 token（模拟登录）
  const payload = { userId: admin.id, email: admin.email };
  const token = jwt.sign(payload, AUTH_SECRET, { expiresIn: '30d' });

  console.log('\n2. 生成的 Token:');
  console.log('   Token:', token.substring(0, 80) + '...');
  console.log('   Payload:', JSON.stringify(jwt.decode(token), null, 2));

  // 3. 验证 token 并提取 userId
  const decoded = jwt.verify(token, AUTH_SECRET) as any;
  const userId = decoded.userId;
  console.log('\n3. Token 解码后的 userId:', userId);

  // 4. 模拟 middleware 的完整流程
  console.log('\n4. 模拟 middleware 流程:');

  // 步骤 1: verifyToken
  const verifyResult = jwt.verify(token, AUTH_SECRET);
  console.log('   ✓ Token 验证: OK');

  // 步骤 2: getUserRoleFromDB
  try {
    const roleRows = await sql`
      SELECT role::text as role, status::text as status
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (roleRows.length === 0) {
      console.log('   ❌ 数据库中找不到该用户');
      return;
    }

    const role = String(roleRows[0].role);
    const status = String(roleRows[0].status);

    console.log(`   ✓ 查询用户: role="${role}", status="${status}"`);

    if (role !== 'ADMIN') {
      console.log(`   ❌ 角色不是 ADMIN (实际是: ${role})`);
      return;
    }

    if (status !== 'ACTIVE') {
      console.log(`   ❌ 用户状态不是 ACTIVE (实际是: ${status})`);
      return;
    }

    console.log('   ✓ 用户是 ADMIN 且状态为 ACTIVE');
    console.log('   → Middleware 应该放行此请求');

  } catch (err: any) {
    console.error('   ❌ 查询出错:', err.message);
  }

  // 5. 测试 API 调用
  console.log('\n5. 测试 API 调用 (模拟 fetch):');

  try {
    // 模拟 /api/admin/users 请求
    const headers = {
      'Content-Type': 'application/json',
      Cookie: `prismatic_token=${token}`
    };

    // 直接调用 authenticateAdminRequest 的逻辑
    const authResult = await sql`
      SELECT role::text as role, status::text as status
      FROM users
      WHERE id = ${userId}
    `;

    if (authResult.length > 0 && authResult[0].role === 'ADMIN' && authResult[0].status === 'ACTIVE') {
      console.log('   ✓ /api/admin/users 鉴权: 通过');
    } else {
      console.log('   ❌ /api/admin/users 鉴权: 失败');
    }

  } catch (err: any) {
    console.error('   ❌ API 调用失败:', err.message);
  }

  console.log('\n✅ 测试完成\n');
  console.log('可能的问题:');
  console.log('1. 浏览器 cookie 中的 token 已过期或与 admin 用户不匹配');
  console.log('2. Middleware 配置未正确匹配 /admin 路由');
  console.log('3. Next.js 构建/部署问题导致 middleware 未生效');
  console.log('4. 用户实际登录的不是 admin 账户');
}

testAdminTokenAndCookie().catch(console.error);
