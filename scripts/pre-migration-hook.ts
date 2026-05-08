/**
 * Prisma Pre-Migration Safety Hook
 *
 * This script runs BEFORE any Prisma migration to:
 * 1. Verify the migration is safe (no destructive operations)
 * 2. Ensure a fresh backup exists
 * 3. Log the migration intent to audit trail
 *
 * Usage:
 *   npm run db:migrate:safe    (instead of prisma migrate dev/deploy)
 *   npx ts-node scripts/pre-migration-hook.ts
 *
 * In CI, this is run automatically by database-migration-gate.yml
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DATABASE_URL_RW = process.env.DATABASE_URL_RW || process.env.DATABASE_URL;
if (!DATABASE_URL_RW) {
  console.error('❌ DATABASE_URL_RW 环境变量未设置');
  console.error('   迁移需要读写凭证，但请勿将读写凭证添加到 Vercel 环境变量。');
  console.error('   本地开发时，在 .env.local 中设置 DATABASE_URL_RW。');
  process.exit(1);
}

const sql = neon(DATABASE_URL_RW);

// Tables that are considered "critical" — require extra safety checks
const CRITICAL_TABLES = [
  'users', 'accounts', 'verification_tokens', 'verification_codes',
  'auth_events', 'conversations', 'messages', 'user_credit_logs',
  'admin_audit_logs', 'distilled_personas', 'distill_sessions',
];

// Operations that are NEVER allowed without explicit confirmation
const FORBIDDEN_PATTERNS = [
  { pattern: /DROP\s+TABLE/i, severity: 'CRITICAL', message: 'DROP TABLE — 会删除整张表和数据' },
  { pattern: /DROP\s+SCHEMA/i, severity: 'CRITICAL', message: 'DROP SCHEMA — 会删除整个数据库' },
  { pattern: /TRUNCATE/i, severity: 'CRITICAL', message: 'TRUNCATE — 会清空整张表' },
  { pattern: /DELETE\s+FROM\s+(users|conversations|messages)\s*;/i, severity: 'CRITICAL', message: '无 WHERE 的 DELETE — 会删除所有数据' },
  { pattern: /ALTER\s+TABLE.*DROP\s+COLUMN/i, severity: 'HIGH', message: 'DROP COLUMN — 可能丢失列数据' },
];

async function main() {
  console.log('═'.repeat(60));
  console.log('🛡️  Prisma 迁移安全检查');
  console.log('═'.repeat(60));
  console.log('');

  // ── Step 1: Check for recent backup ──────────────────────────
  console.log('📋 步骤 1/4: 检查最新备份...');
  const backupDir = path.join(process.cwd(), 'backups');
  const today = new Date().toISOString().slice(0, 10);

  // Find backup directories that start with today's date
  const todayBackups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith(today + 'T') || f === today)
    .sort()
    .reverse();

  const todayBackup = todayBackups.length > 0
    ? path.join(backupDir, todayBackups[0])
    : null;

  if (!todayBackup) {
    console.log('  ⚠️  警告: 今天 (' + today + ') 没有备份');
    console.log('');
    console.log('  建议: 先运行备份再执行迁移');
    console.log('    npm run db:backup');
    console.log('');

    const answer = await ask('是否继续执行迁移？(输入 "yes" 确认): ');
    if (answer.trim() !== 'yes') {
      console.log('迁移已取消。');
      process.exit(0);
    }
  } else {
    const reportPath = path.join(todayBackup, 'backup-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      console.log('  ✅ 今天已有备份: ' + today);
      console.log(`     备份 ID: ${report.backupId}`);
      console.log(`     包含 ${report.tablesWithData} 个有数据的表`);
    }
  }
  console.log('');

  // ── Step 2: Read pending migrations ─────────────────────────
  console.log('📋 步骤 2/4: 分析待执行的迁移...');
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('  ℹ️  无迁移目录（尚未运行过 migrate dev）');
  } else {
    const pending = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort()
      .reverse()
      .slice(0, 3);

    if (pending.length > 0) {
      console.log(`  待执行迁移 (最近 3 个):`);
      for (const m of pending) {
        console.log(`    • ${m}`);
      }
    }
  }
  console.log('');

  // ── Step 3: Scan migration files for dangerous patterns ────
  console.log('📋 步骤 3/4: 扫描迁移文件中的危险操作...');

  const migrationsFolder = path.join(process.cwd(), 'prisma', 'migrations');
  let foundDangerous = false;

  if (fs.existsSync(migrationsFolder)) {
    const migrationFiles = findAllSqlFiles(migrationsFolder);

    for (const file of migrationFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      for (const { pattern, severity, message } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          foundDangerous = true;
          const rel = path.relative(process.cwd(), file);
          console.log(`  🔴 [${severity}] ${rel}`);
          console.log(`     ${message}`);
          console.log('');
        }
      }
    }
  }

  if (foundDangerous) {
    console.log('═'.repeat(60));
    console.log('🔴 危险: 检测到禁止的迁移操作');
    console.log('═'.repeat(60));
    console.log('');
    console.log('上述迁移包含危险操作，不允许执行。');
    console.log('');
    console.log('如果这是有意的变更（如清理废弃表）:');
    console.log('  1. 确认该表的所有数据已不再需要');
    console.log('  2. 确认已有最新备份');
    console.log('  3. 手动在 Neon Console 中执行，并记录操作');
    console.log('');
    console.log('如果这是误操作，立即撤销:');
    console.log('  git checkout HEAD -- prisma/');
    console.log('');
    process.exit(1);
  } else {
    console.log('  ✅ 未检测到危险操作');
  }
  console.log('');

  // ── Step 4: Log migration intent ───────────────────────────
  console.log('📋 步骤 4/4: 记录迁移意图...');

  try {
    await sql`
      INSERT INTO admin_audit_logs (id, "userId", action, "resourceType", "resourceId", "metadata", "createdAt")
      VALUES (
        ${`mig-${Date.now()}`},
        ${process.env.USER_ID || 'system'},
        ${'MIGRATION_INTENT'},
        ${'system'},
        ${'schema'},
        ${JSON.stringify({
          timestamp: new Date().toISOString(),
          branch: process.env.GITHUB_REF_NAME || 'local',
          sha: process.env.GITHUB_SHA || 'local',
          user: process.env.USER || 'unknown',
        })},
        ${new Date()}
      )
    `;
    console.log('  ✅ 迁移意图已记录到 audit log');
  } catch {
    console.log('  ⚠️  无法写入 audit log（可能表不存在），跳过');
  }
  console.log('');

  // ── Final ─────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('✅ 安全检查通过');
  console.log('═'.repeat(60));
  console.log('');
  console.log('可以安全执行迁移:');
  console.log('  npx prisma migrate deploy');
  console.log('  或: npm run db:migrate:safe');
  console.log('');
  console.log('⚠️  重要提醒:');
  console.log('  • 始终在本地完整测试后再部署');
  console.log('  • 确保已创建最新备份');
  console.log('  • 准备好回滚方案');
  console.log('');
}

function findAllSqlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllSqlFiles(full));
    } else if (entry.name.endsWith('.sql')) {
      results.push(full);
    }
  }
  return results;
}

function ask(question: string): Promise<string> {
  process.stdout.write(question + ' ');
  return new Promise((resolve) => {
    process.stdin.once('data', (d) => resolve(d.toString()));
  });
}

main().catch((e) => {
  console.error('\n❌ 安全检查失败:', e.message);
  process.exit(1);
});
