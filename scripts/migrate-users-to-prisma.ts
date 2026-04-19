import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not set. Check .env.local or set DATABASE_URL env var.');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 开始迁移用户数据...\n');
  const dbg = DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  console.log(`Database: ${dbg}\n`);

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DATABASE_URL);

  // 1. 验证旧表存在
  let oldUsers: any[] = [];
  try {
    const result = await sql`
      SELECT
        id, email, password_hash, name, gender, province,
        email_verified, email_verified_at, role, plan, credits,
        is_active, created_at, updated_at
      FROM prismatic_users
      ORDER BY created_at ASC
    `;
    oldUsers = result;
    console.log(`📊 找到 ${oldUsers.length} 个旧用户记录`);
  } catch (err) {
    console.error('❌  无法查询 prismatic_users 表:', (err as Error).message);
    console.error('    该表可能已不存在（已迁移？）或数据库连接失败。');
    process.exit(1);
  }

  let migrated = 0;
  let updated = 0;
  let skipped = 0;

  for (const oldUser of oldUsers) {
    try {
      const existing = await prisma.user.findUnique({ where: { id: oldUser.id } });

      if (existing) {
        // 合并：只填充旧表中非空、且新表中为空的字段
        const existingPrefs = (() => {
          try {
            return typeof existing.preferences === 'string'
              ? JSON.parse(existing.preferences as string)
              : (existing.preferences as object) || {};
          } catch { return {}; }
        })();

        const mergedPrefs = {
          gender: existingPrefs.gender || oldUser.gender || null,
          province: existingPrefs.province || oldUser.province || null,
        };

        await prisma.user.update({
          where: { id: oldUser.id },
          data: {
            email: existing.email || oldUser.email || null,
            name: existing.name || oldUser.name || null,
            passwordHash: existing.passwordHash || oldUser.password_hash || null,
            role: existing.role || mapRole(oldUser.role),
            plan: existing.plan || mapPlan(oldUser.plan),
            credits: existing.credits || oldUser.credits || 0,
            status: existing.status || (oldUser.is_active ? 'ACTIVE' : 'SUSPENDED'),
            emailVerified: existing.emailVerified || (oldUser.email_verified_at ? new Date(oldUser.email_verified_at) : oldUser.email_verified ? new Date() : null),
            preferences: JSON.stringify(mergedPrefs),
          },
        });
        console.log(`🔄 更新用户: ${oldUser.email} (${oldUser.role}/${oldUser.plan})`);
        updated++;
      } else {
        // 插入全新用户
        await prisma.user.create({
          data: {
            id: oldUser.id,
            email: oldUser.email,
            passwordHash: oldUser.password_hash || null,
            name: oldUser.name || null,
            preferences: JSON.stringify({
              gender: oldUser.gender || null,
              province: oldUser.province || null,
            }),
            status: oldUser.is_active ? 'ACTIVE' : 'SUSPENDED',
            role: mapRole(oldUser.role),
            plan: mapPlan(oldUser.plan),
            credits: oldUser.credits || 0,
            createdAt: oldUser.created_at ? new Date(oldUser.created_at) : new Date(),
            updatedAt: oldUser.updated_at ? new Date(oldUser.updated_at) : new Date(),
            emailVerified: oldUser.email_verified_at ? new Date(oldUser.email_verified_at) : oldUser.email_verified ? new Date() : null,
          },
        });
        console.log(`✅ 新建用户: ${oldUser.email} (${oldUser.role}/${oldUser.plan})`);
        migrated++;
      }
    } catch (err) {
      console.error(`❌ 迁移失败 ${oldUser.email}:`, (err as Error).message);
      skipped++;
    }

    if ((migrated + updated) % 50 === 0 && (migrated + updated) > 0) {
      console.log(`  ...进度 ${migrated + updated}/${oldUsers.length}`);
    }
  }

  console.log(`\n📈 迁移完成: ${migrated} 新建, ${updated} 更新, ${skipped} 失败`);

  const total = await prisma.user.count();
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  console.log(`\n✅ 当前 User 表: 共 ${total} 用户, ADMIN: ${admins}`);
  console.log('\n🎉 迁移完成！建议后续操作:');
  console.log('   1. 访问 /admin/users 确认所有老账号可见');
  console.log('   2. 可选：重命名旧表');
  console.log('      ALTER TABLE prismatic_users RENAME TO prismatic_users_migrated_20260419;');
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
