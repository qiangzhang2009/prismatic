import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 开始迁移用户数据...\n');

  // 查询旧表数据
  const { neon } = await import('@neondatabase/serverless');
  const DATABASE_URL = process.env.DATABASE_URL!;
  const sql = neon(DATABASE_URL);

  const oldUsers = await sql`
    SELECT
      id, email, password_hash, name, gender, province,
      email_verified, role, plan, credits, is_active, created_at, updated_at
    FROM prismatic_users
  `;

  console.log(`📊 找到 ${oldUsers.length} 个旧用户记录`);

  let migrated = 0;
  let updated = 0;
  let skipped = 0;

  for (const oldUser of oldUsers as any[]) {
    try {
      // 检查新表是否已存在
      const existing = await prisma.user.findUnique({
        where: { id: oldUser.id },
      });

      if (existing) {
        // 更新现有用户的 role/plan/credits
        await prisma.user.update({
          where: { id: oldUser.id },
          data: {
            role: mapRole(oldUser.role),
            plan: mapPlan(oldUser.plan),
            credits: oldUser.credits || 0,
            // 同步其他字段（如果为空）
            name: oldUser.name || existing.name,
            preferences: JSON.stringify({
              gender: oldUser.gender,
              province: oldUser.province,
              ...(existing.preferences as any) || {},
            }),
          },
        });
        console.log(`🔄 更新用户: ${oldUser.email} (${oldUser.role}/${oldUser.plan})`);
        updated++;
        continue;
      }

      // 创建全新用户
      await prisma.user.create({
        data: {
          id: oldUser.id,
          email: oldUser.email,
          passwordHash: oldUser.password_hash || null,
          name: oldUser.name || null,
          preferences: JSON.stringify({
            gender: oldUser.gender,
            province: oldUser.province,
          }),
          status: oldUser.is_active ? 'ACTIVE' : 'SUSPENDED',
          role: mapRole(oldUser.role),
          plan: mapPlan(oldUser.plan),
          credits: oldUser.credits || 0,
          createdAt: new Date(oldUser.created_at),
          updatedAt: new Date(oldUser.updated_at),
          emailVerified: oldUser.email_verified ? new Date() : null,
        },
      });

      console.log(`✅ 新建用户: ${oldUser.email} (${oldUser.role}/${oldUser.plan})`);
      migrated++;
    } catch (err: any) {
      console.error(`❌ 迁移失败 ${oldUser.email}:`, err.message);
      skipped++;
    }
  }

  console.log(`\n📈 迁移完成: ${migrated} 新建, ${updated} 更新, ${skipped} 失败`);

  // 验证结果
  const total = await prisma.user.count();
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  console.log(`\n✅ 当前 User 表: 共 ${total} 用户, ADMIN: ${admins}`);
}

function mapRole(role: string): 'ADMIN' | 'PRO' | 'FREE' {
  switch (role?.toUpperCase()) {
    case 'ADMIN': return 'ADMIN';
    case 'PRO': return 'PRO';
    default: return 'FREE';
  }
}

function mapPlan(plan: string): 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME' {
  switch (plan?.toUpperCase()) {
    case 'MONTHLY': return 'MONTHLY';
    case 'YEARLY': return 'YEARLY';
    case 'LIFETIME': return 'LIFETIME';
    default: return 'FREE';
  }
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
