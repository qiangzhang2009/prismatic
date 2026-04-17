import { getUserByEmail, updateUserCredits, updateUserRole } from '../src/lib/user-service';

async function test() {
  // 测试获取用户
  const user = await getUserByEmail('zxq@zxqconsulting.com');
  console.log('👤 用户信息:', user);

  if (user) {
    // 测试更新积分
    await updateUserCredits(user.id, 1000);
    console.log('✅ 积分已更新');

    // 测试更新角色
    await updateUserRole(user.id, 'ADMIN');
    console.log('✅ 角色已更新为 ADMIN');
  }
}

test().catch(console.error);
