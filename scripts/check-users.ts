import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, plan: true, credits: true },
  });

  console.log('👥 当前 User 表中的用户:');
  console.log(users);
  console.log(`共 ${users.length} 个用户`);
}

checkUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
