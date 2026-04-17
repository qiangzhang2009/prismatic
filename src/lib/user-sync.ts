/**
 * User Sync Service
 *
 * 确保 Prisma User 表和旧 prismatic_users 表数据同步。
 * 策略：双写 + 定时同步，逐步迁移。
 */

import { PrismaClient } from '@prisma/client';
import { neon } from '@neondatabase/serverless';

const prisma = new PrismaClient();
const DATABASE_URL = process.env.DATABASE_URL!;

/**
 * 将 User 同步到 prismatic_users（供中间件鉴权）
 */
export async function syncUserToOldTable(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const sql = neon(DATABASE_URL);

    // 提取 gender 和 province
    let gender: string | null = null;
    let province: string | null = null;
    if (user.preferences) {
      try {
        const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        gender = prefs.gender || null;
        province = prefs.province || null;
      } catch { /* ignore */ }
    }

    // UPSERT 到旧表
    await sql`
      INSERT INTO prismatic_users
        (id, email, name, gender, province, email_verified, role, plan, credits, is_active, created_at, updated_at)
      VALUES (
        ${user.id},
        ${user.email},
        ${user.name},
        ${gender},
        ${province},
        ${user.emailVerified ? true : false},
        ${user.role || 'FREE'},
        ${user.plan || 'FREE'},
        ${user.credits || 0},
        ${user.status === 'ACTIVE'},
        ${user.createdAt},
        ${user.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        gender = EXCLUDED.gender,
        province = EXCLUDED.province,
        email_verified = EXCLUDED.email_verified,
        role = EXCLUDED.role,
        plan = EXCLUDED.plan,
        credits = EXCLUDED.credits,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `;

    console.log(`[Sync] User ${user.email} synced to prismatic_users`);
  } catch (error) {
    console.error('[Sync] Error:', error);
  }
}

/**
 * 批量同步所有 User 到旧表
 */
export async function syncAllUsersToOldTable(): Promise<number> {
  console.log('[Sync] Starting full sync...');
  let count = 0;

  const users = await prisma.user.findMany();
  for (const user of users) {
    await syncUserToOldTable(user.id);
    count++;
  }

  console.log(`[Sync] Completed: ${count} users synced`);
  return count;
}

/**
 * 创建触发器：当 User 表更新时自动同步
 * 注意：这需要在数据库中创建 PostgreSQL 触发器函数
 */
export async function createSyncTrigger(): Promise<void> {
  const sql = neon(DATABASE_URL);

  // 创建触发器函数
  await sql`
    CREATE OR REPLACE FUNCTION sync_user_to_old()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO prismatic_users
        (id, email, name, gender, province, email_verified, role, plan, credits, is_active, created_at, updated_at)
      VALUES (
        NEW.id,
        NEW.email,
        NEW.name,
        (NEW.preferences->>'gender')::text,
        (NEW.preferences->>'province')::text,
        CASE WHEN NEW.email_verified IS NOT NULL THEN true ELSE false END,
        COALESCE(NEW.role, 'FREE'),
        COALESCE(NEW.plan, 'FREE'),
        COALESCE(NEW.credits, 0),
        NEW.status = 'ACTIVE',
        NEW.createdAt,
        NEW.updatedAt
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        gender = EXCLUDED.gender,
        province = EXCLUDED.province,
        email_verified = EXCLUDED.email_verified,
        role = EXCLUDED.role,
        plan = EXCLUDED.plan,
        credits = EXCLUDED.credits,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // 创建触发器
  await sql`
    DROP TRIGGER IF EXISTS trigger_sync_user_to_old ON users;
    CREATE TRIGGER trigger_sync_user_to_old
      AFTER INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION sync_user_to_old();
  `;

  console.log('[Sync] Trigger created');
}
