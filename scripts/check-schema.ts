import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
  // 检查 users 表是否有新字段
  try {
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        role: true,
        plan: true,
        credits: true,
      },
    });
    console.log('✅ User 表支持新字段:', user);
  } catch (err: any) {
    console.error('❌ User 表缺少新字段:', err.message);
  }
}

checkSchema().finally(() => prisma.$disconnect());
