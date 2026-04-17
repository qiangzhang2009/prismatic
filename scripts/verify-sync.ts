import { PrismaClient } from '@prisma/client';
import { neon } from '@neondatabase/serverless';

const prisma = new PrismaClient();
const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

async function testSync() {
  console.log('🔍 检查数据同步状态...\n');

  // 1. 检查新表 User
  const newUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true, plan: true, credits: true, status: true },
  });
  console.log('📋 Prisma User 表:');
  for (const u of newUsers) {
    console.log(`  ${u.email} → role=${u.role}, plan=${u.plan}, credits=${u.credits}, status=${u.status}`);
  }

  // 2. 检查旧表 prismatic_users
  const oldUsers = await sql`SELECT id, email, role, plan, credits, is_active FROM prismatic_users`;
  console.log('\n📋 prismatic_users 表:');
  for (const u of oldUsers as any[]) {
    console.log(`  ${u.email} → role=${u.role}, plan=${u.plan}, credits=${u.credits}, is_active=${u.is_active}`);
  }

  // 3. 验证管理员
  const adminNew = newUsers.find(u => u.email === 'zxq@zxqconsulting.com');
  const adminOld = (oldUsers as any[]).find(u => u.email === 'zxq@zxqconsulting.com');

  console.log('\n✅ 管理员同步检查:');
  console.log(`  新表: ${adminNew ? '✅ 存在' : '❌ 缺失'} (role=${adminNew?.role}, plan=${adminNew?.plan})`);
  console.log(`  旧表: ${adminOld ? '✅ 存在' : '❌ 缺失'} (role=${adminOld?.role}, plan=${adminOld?.plan}, active=${adminOld?.is_active})`);

  if (adminNew && adminOld && adminNew.role === adminOld.role && adminNew.plan === adminOld.plan) {
    console.log('\n🎉 两表数据完全同步！');
  } else {
    console.log('\n⚠️  两表数据不一致，需要修复');
  }
}

testSync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
