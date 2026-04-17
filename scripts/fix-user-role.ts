import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserRole() {
  // 查找用户
  const user = await prisma.user.findFirst({
    where: { email: 'zxq@zxqconsulting.com' },
  });

  if (!user) {
    console.log('用户不存在');
    return;
  }

  console.log('当前用户:', { id: user.id, email: user.email, role: user.role });

  // 更新为 ADMIN 角色
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' as any },
  });

  console.log('已更新为 ADMIN:', { id: updated.id, email: updated.email, role: updated.role });
}

fixUserRole()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
