/**
 * Database Backup Workflow Script
 *
 * Replaces export-all-tables.ts with a production-grade version that:
 * 1. Creates a timestamped backup directory
 * 2. Exports ALL tables (including Prisma internal _prisma_migrations)
 * 3. Generates a detailed backup-report.json
 * 4. Validates critical table row counts before committing
 * 5. Reports any anomalies
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Backup dir: backups/YYYY-MM-DD_HH-MM-SS
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_DIR = path.join(process.cwd(), 'backups', timestamp);
const BACKUP_DATE_DIR = path.join(process.cwd(), 'backups', timestamp.split('_')[0]);

// Critical tables that trigger data-loss alerts
const CRITICAL_TABLES = [
  'users',
  'conversations',
  'messages',
  'distilled_personas',
  'distill_sessions',
  'guardian_duties',
  'guardian_discussions',
];

// Expected minimum row counts (data-loss detection threshold)
// If actual count < MIN_EXPECTED, flag as potential data loss
const MIN_EXPECTED = {
  users: 1,              // At least admin
  conversations: 0,      // May be empty
  messages: 0,           // May be empty
  distilled_personas: 20, // Should have 30 personas
  distill_sessions: 20,  // Should have 30 sessions
  guardian_duties: 0,
  guardian_discussions: 0,
};

async function main() {
  const startTime = Date.now();
  const meta = {
    backupId: `backup-${Date.now()}`,
    timestamp: new Date().toISOString(),
    reason: process.env.BACKUP_REASON || 'scheduled',
    githubRunId: process.env.GITHUB_RUN_ID || null,
    githubSha: process.env.GITHUB_SHA || null,
    hostname: require('os').hostname(),
    nodeVersion: process.version,
  };

  console.log('═'.repeat(60));
  console.log('📦  Prismatic 数据库备份');
  console.log('═'.repeat(60));
  console.log(`备份 ID: ${meta.backupId}`);
  console.log(`时间:   ${meta.timestamp}`);
  console.log(`原因:   ${meta.reason}`);
  console.log(`目录:   ${BACKUP_DIR}`);
  console.log('');

  // ── Step 1: Get all tables ──────────────────────────────────
  console.log('📋 步骤 1/4: 获取所有表...');
  const allTables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%%'
      AND tablename NOT LIKE 'sql_%%'
    ORDER BY tablename
  `;

  const tableNames = allTables.map((t) => t.tablename);
  console.log(`    找到 ${tableNames.length} 个表\n`);

  // ── Step 2: Export all tables ──────────────────────────────
  console.log('💾 步骤 2/4: 导出所有表数据...');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DATE_DIR, { recursive: true });

  const tableStats = {};
  const anomalies = [];
  let totalBytes = 0;

  for (const tablename of tableNames) {
    process.stdout.write(`  ${tablename.padEnd(35)} `);

    try {
      const rows = await sql`SELECT * FROM ${sql.unsafe(tablename)}`;
      const jsonPath = path.join(BACKUP_DIR, `${tablename}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf-8');

      const jsonBytes = fs.statSync(jsonPath).size;
      totalBytes += jsonBytes;

      // Generate CSV if has data
      if (rows.length > 0) {
        const csvPath = path.join(BACKUP_DIR, `${tablename}.csv`);
        generateCSV(rows, csvPath);
      }

      console.log(`✅ ${rows.length.toString().padStart(4)} 行  ${(jsonBytes / 1024).toFixed(1)} KB`);

      tableStats[tablename] = {
        rows: rows.length,
        jsonSize: jsonBytes,
        hasData: rows.length > 0,
        exportedAt: new Date().toISOString(),
      };

      // ── Step 3: Data-loss anomaly detection ──────────────────
      if (CRITICAL_TABLES.includes(tablename)) {
        const minExpected = MIN_EXPECTED[tablename] ?? 0;
        if (rows.length < minExpected) {
          anomalies.push({
            table: tablename,
            actual: rows.length,
            minimumExpected: minExpected,
            severity: 'CRITICAL',
            message: `表 ${tablename} 行数 ${rows.length} < 最低期望值 ${minExpected}，可能发生数据丢失！`,
          });
        }
      }
    } catch (e) {
      console.log(`❌ 错误: ${e.message}`);
      tableStats[tablename] = {
        rows: 0,
        hasData: false,
        error: e.message,
      };
      anomalies.push({
        table: tablename,
        actual: 0,
        minimumExpected: MIN_EXPECTED[tablename] ?? 0,
        severity: 'ERROR',
        message: `导出 ${tablename} 失败: ${e.message}`,
      });
    }
  }

  // ── Step 4: Generate report ─────────────────────────────────
  console.log('\n📊 步骤 3/4: 生成备份报告...');

  const report = {
    ...meta,
    backupDirectory: BACKUP_DIR,
    backupDateDirectory: BACKUP_DATE_DIR,
    totalTables: tableNames.length,
    tablesWithData: Object.values(tableStats).filter((s) => s.hasData).length,
    totalBytes,
    totalBytesMB: (totalBytes / 1024 / 1024).toFixed(2),
    durationMs: Date.now() - startTime,
    tableStats,
    anomalies,
    integrity: {
      passed: anomalies.filter((a) => a.severity !== 'ERROR').length === 0,
      totalAnomalies: anomalies.length,
      criticalAnomalies: anomalies.filter((a) => a.severity === 'CRITICAL').length,
    },
  };

  const reportPath = path.join(BACKUP_DIR, 'backup-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  // Also save to date dir for quick access
  fs.copyFileSync(reportPath, path.join(BACKUP_DATE_DIR, 'backup-report.json'));

  console.log('');

  // ── Step 5: Summary ────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('📦 备份完成');
  console.log('═'.repeat(60));
  console.log(`备份目录:   ${BACKUP_DIR}`);
  console.log(`总表数:     ${report.totalTables}`);
  console.log(`有数据表:   ${report.tablesWithData}`);
  console.log(`总大小:     ${report.totalBytesMB} MB`);
  console.log(`耗时:       ${(report.durationMs / 1000).toFixed(1)}s`);
  console.log('');

  if (anomalies.length > 0) {
    console.log('⚠️  数据完整性警告:');
    for (const a of anomalies) {
      const icon = a.severity === 'CRITICAL' ? '🔴' : a.severity === 'ERROR' ? '❌' : '🟡';
      console.log(`  ${icon} [${a.severity}] ${a.table}: ${a.message}`);
    }
    console.log('');
  } else {
    console.log('✅ 无数据完整性警告');
    console.log('');
  }

  console.log('有数据的表:');
  for (const [name, stats] of Object.entries(tableStats)) {
    if (stats.hasData) {
      console.log(`  ✅ ${name}: ${stats.rows} 行`);
    }
  }
  console.log('');

  // ── Step 6: Anomaly detection summary ───────────────────────
  if (report.integrity.criticalAnomalies > 0) {
    console.log('═'.repeat(60));
    console.log('🔴 严重警告: 检测到关键数据异常！');
    console.log('═'.repeat(60));
    console.log('以下表的行数低于预期，可能发生了数据丢失:');
    for (const a of anomalies.filter((x) => x.severity === 'CRITICAL')) {
      console.log(`  • ${a.table}: 实际 ${a.actual} 行，期望 >= ${a.minimumExpected} 行`);
    }
    console.log('');
    console.log('处理建议:');
    console.log('  1. 立即检查最近的 Git 提交和 CI 运行');
    console.log('  2. 检查 Neon Console 的操作日志');
    console.log('  3. 如果确认数据丢失，从最近的正常备份恢复');
    console.log('  4. 在 #incidents Slack 频道报告此问题');
    console.log('');

    // Exit with error code so CI reports failure
    process.exit(1);
  }

  console.log('✅ 备份成功，数据完整性验证通过');
}

function generateCSV(rows, csvPath) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        const str = JSON.stringify(val).replace(/"/g, '""');
        return `"${str}"`;
      }
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
}

main().catch((e) => {
  console.error('\n❌ 备份失败:', e.message);
  process.exit(1);
});
