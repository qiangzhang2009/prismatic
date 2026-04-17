import { getUserById, verifyCredentials, createUser, getAllUsers } from '../src/lib/user-management';

async function test() {
  console.log('🧪 测试 User Management (Prisma-based)\n');

  // 1. 测试获取现有管理员
  console.log('1️⃣  测试 getUserById...');
  const admin = await getUserById('admin-001');
  if (admin) {
    console.log('✅ 管理员信息:', {
      email: admin.email,
      role: admin.role,
      plan: admin.plan,
      credits: admin.credits,
    });
  } else {
    console.log('❌ 未找到管理员');
  }

  // 2. 测试验证凭据
  console.log('\n2️⃣  测试 verifyCredentials...');
  const user = await verifyCredentials('zxq@zxqconsulting.com', '');
  if (user) {
    console.log('✅ 验证成功:', { email: user.email, role: user.role });
  } else {
    console.log('⚠️  验证失败（密码为空是正常的）');
  }

  // 3. 测试获取所有用户
  console.log('\n3️⃣  测试 getAllUsers...');
  const all = await getAllUsers();
  console.log(`✅ 总用户数: ${all.length}`);

  // 4. 测试创建新用户（双写）
  console.log('\n4️⃣  测试 createUser（新用户）...');
  const newUser = await createUser({
    email: `test-${Date.now()}@example.com`,
    password: 'test123456',
    name: 'Test User',
    gender: 'male',
  });
  if (newUser) {
    console.log('✅ 新用户创建成功:', { id: newUser.id, email: newUser.email, role: newUser.role });
  } else {
    console.log('❌ 用户创建失败');
  }
}

test()
  .then(() => console.log('\n✅ 所有测试完成'))
  .catch(err => {
    console.error('❌ 测试失败:', err);
    process.exit(1);
  });
