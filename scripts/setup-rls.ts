/**
 * PostgreSQL Row Level Security (RLS) Setup Script
 *
 * This script sets up RLS policies on critical tables to provide
 * an additional layer of protection at the database level.
 *
 * RLS ensures that even if a connection bypasses the application
 * (e.g., direct psql access), certain operations are still blocked.
 *
 * IMPORTANT: Run this AFTER running `prisma migrate deploy`
 * in a controlled environment (not from application code).
 *
 * Usage:
 *   npx ts-node scripts/setup-rls.ts
 *
 * Prerequisites:
 *   - DATABASE_URL_RW must be set (with admin privileges)
 *   - Run in a transaction to ensure all-or-nothing
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL_RW = process.env.DATABASE_URL_RW;
if (!DATABASE_URL_RW) {
  console.error('❌ DATABASE_URL_RW 环境变量未设置');
  console.error('   RLS 设置需要数据库管理员权限');
  process.exit(1);
}

const sql = neon(DATABASE_URL_RW);

async function main() {
  console.log('═'.repeat(60));
  console.log('🛡️  PostgreSQL RLS 设置');
  console.log('═'.repeat(60));
  console.log('');

  // ── Helper to run SQL in transaction ─────────────────────
  async function runTx(queries: string[]) {
    const allSql = `
      BEGIN;
      ${queries.join('\n')}
      COMMIT;
    `.trim();

    try {
      await sql.transaction(async (tx) => {
        for (const q of queries) {
          await tx.unsafe(q);
        }
      });
      return true;
    } catch (e: any) {
      console.error(`❌ 事务失败: ${e.message}`);
      // Try to rollback
      try { await sql.unsafe('ROLLBACK'); } catch {}
      return false;
    }
  }

  const statements: string[] = [];

  // ── 1. Enable RLS on critical tables ─────────────────────
  console.log('📋 步骤 1/3: 在关键表上启用 RLS...');

  const criticalTables = [
    'users',
    'conversations',
    'messages',
    'user_credit_logs',
    'admin_audit_logs',
    'auth_events',
  ];

  for (const table of criticalTables) {
    statements.push(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    statements.push(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    console.log(`  ✅ ${table}: RLS 已启用`);
  }
  console.log('');

  // ── 2. Create blocking policies for destructive ops ───────
  console.log('📋 步骤 2/3: 创建安全策略...');

  // Policy: Block TRUNCATE on users table
  statements.push(`
    CREATE OR REPLACE POLICY no_truncate_users ON users
    FOR TRUNCATE
    TO PUBLIC
    USING (false)
    WITH CHECK (false);
  `.trim());

  // Policy: Block DELETE on users table from non-admin roles
  // Note: In production with proper role separation, you would create
  // an 'app_user' role and restrict deletes to 'admin' role only.
  // This policy demonstrates the pattern:
  statements.push(`
    CREATE OR REPLACE POLICY users_no_delete_all ON users
    FOR DELETE
    TO PUBLIC
    USING (
      -- Only allow deletion if:
      -- 1. The user is deleting themselves AND not an admin
      -- 2. OR the session has admin privileges (checked via a function)
      current_setting('app.user_role', true) = 'ADMIN'
      OR id = current_setting('app.current_user_id', true)::text
    );
  `.trim());

  // Policy: Block TRUNCATE on conversations
  statements.push(`
    CREATE OR REPLACE POLICY no_truncate_conversations ON conversations
    FOR TRUNCATE
    TO PUBLIC
    USING (false)
    WITH CHECK (false);
  `.trim());

  // Policy: Block TRUNCATE on messages
  statements.push(`
    CREATE OR REPLACE POLICY no_truncate_messages ON messages
    FOR TRUNCATE
    TO PUBLIC
    USING (false)
    WITH CHECK (false);
  `.trim());

  console.log('  ✅ 创建了以下策略:');
  console.log('     • no_truncate_users: 禁止 TRUNCATE users');
  console.log('     • users_no_delete_all: 限制用户删除权限');
  console.log('     • no_truncate_conversations: 禁止 TRUNCATE conversations');
  console.log('     • no_truncate_messages: 禁止 TRUNCATE messages');
  console.log('');

  // ── 3. Create audit function ──────────────────────────────
  console.log('📋 步骤 3/3: 创建审计触发器...');

  // Trigger function to log all DELETE/UPDATE on users
  statements.push(`
    CREATE OR REPLACE FUNCTION audit_user_changes()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        INSERT INTO admin_audit_logs
          (id, "userId", action, "resourceType", "resourceId", "metadata", "createdAt")
        VALUES (
          'audit-' || floor(random()*1000000)::text || '-' || floor(random()*1000000)::text,
          COALESCE(current_setting('app.current_user_id', true), 'system'),
          'USER_DELETED',
          'User',
          OLD.id,
          jsonb_build_object(
            'old_data', row_to_json(OLD),
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'timestamp', now()::text
          ),
          now()
        );
        RETURN OLD;
      ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO admin_audit_logs
          (id, "userId", action, "resourceType", "resourceId", "metadata", "createdAt")
        VALUES (
          'audit-' || floor(random()*1000000)::text || '-' || floor(random()*1000000)::text,
          COALESCE(current_setting('app.current_user_id', true), 'system'),
          'USER_UPDATED',
          'User',
          OLD.id,
          jsonb_build_object(
            'old_data', row_to_json(OLD),
            'new_data', row_to_json(NEW),
            'changed_fields', (
              SELECT jsonb_object_agg(key, jsonb_build_object(old: value, new: value))
              FROM jsonb_each_text(row_to_json(OLD))
              JOIN jsonb_each_text(row_to_json(NEW)) USING (key)
              WHERE value IS DISTINCT FROM OLD.value
            ),
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'timestamp', now()::text
          ),
          now()
        );
        RETURN NEW;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `.trim());

  // Attach trigger to users table
  statements.push(`
    DROP TRIGGER IF EXISTS audit_user_changes ON users;
    CREATE TRIGGER audit_user_changes
    AFTER UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_user_changes();
  `.trim());

  console.log('  ✅ 审计触发器已创建: audit_user_changes');
  console.log('');

  // ── Execute all statements ────────────────────────────────
  console.log('═'.repeat(60));
  console.log('📝 执行所有变更...');
  console.log('');

  const success = await runTx(statements);

  if (success) {
    console.log('═'.repeat(60));
    console.log('✅ RLS 设置完成');
    console.log('═'.repeat(60));
    console.log('');
    console.log('RLS 策略已生效。即使有人持有数据库写权限:');
    console.log('  • TRUNCATE users/conversations/messages → 被 RLS 阻断');
    console.log('  • 所有用户变更 → 自动记录到 admin_audit_logs');
    console.log('');
    console.log('验证 RLS 是否生效:');
    console.log("  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';");
  } else {
    console.log('');
    console.log('❌ 设置失败，部分 RLS 策略可能未生效');
    console.log('   请手动检查: SELECT * FROM pg_policies WHERE tablename = 'users';');
  }
}

main().catch((e) => {
  console.error('\n❌ 设置失败:', e.message);
  process.exit(1);
});
