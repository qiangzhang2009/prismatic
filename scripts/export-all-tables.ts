import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const BACKUP_DIR = path.join(process.cwd(), 'backups', new Date().toISOString().slice(0, 10));

async function main() {
  console.log(`📦 导出所有表数据到本地备份目录: ${BACKUP_DIR}\n`);

  // 创建备份目录
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 1. 获取所有表
  const allTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%%'
    AND tablename NOT LIKE 'sql_%%'
    ORDER BY tablename
  `;

  // 2. 遍历每张表，导出数据
  const tableStats: Record<string, any> = {};

  for (const t of allTables as any[]) {
    const tablename = t.tablename;
    process.stdout.write(`导出 ${tablename}... `);

    try {
      const rows = await sql`SELECT * FROM ${sql.unsafe(tablename)}`;

      // 保存 JSON 文件
      const jsonPath = path.join(BACKUP_DIR, `${tablename}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf-8');

      // 保存 CSV 文件（如果有数据）
      if (rows.length > 0) {
        const csvPath = path.join(BACKUP_DIR, `${tablename}.csv`);
        const headers = Object.keys(rows[0]);
        const csvLines = [
          headers.join(','),
          ...rows.map(row =>
            headers.map(h => {
              const val = (row as any)[h];
              if (val === null || val === undefined) return '';
              if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
              const str = String(val);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          )
        ];
        fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
      }

      console.log(`✅ ${rows.length} 行`);
      tableStats[tablename] = { rows: rows.length, hasData: rows.length > 0 };
    } catch (e: any) {
      console.log(`❌ 错误: ${e.message}`);
      tableStats[tablename] = { rows: 0, error: e.message };
    }
  }

  // 3. 生成备份报告
  const report = {
    exportDate: new Date().toISOString(),
    database: 'Neon - cold-cell-86302864',
    totalTables: allTables.length,
    tablesWithData: Object.values(tableStats).filter((s: any) => s.hasData).length,
    tableStats,
  };

  const reportPath = path.join(BACKUP_DIR, 'backup-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n\n=== 备份报告 ===');
  console.log(`数据库: Neon - cold-cell-86302864`);
  console.log(`导出时间: ${report.exportDate}`);
  console.log(`总表数: ${report.totalTables}`);
  console.log(`有数据的表: ${report.tablesWithData}`);
  console.log('\n有数据的表:');
  for (const [name, stats] of Object.entries(tableStats) as [string, any][]) {
    if (stats.hasData) {
      console.log(`  ✅ ${name}: ${stats.rows} 行`);
    }
  }
  console.log('\n无数据的表:');
  for (const [name, stats] of Object.entries(tableStats) as [string, any][]) {
    if (!stats.hasData) {
      console.log(`  ⬜ ${name}`);
    }
  }

  console.log(`\n备份文件保存在: ${BACKUP_DIR}`);
  console.log('✅ 导出完成');
}

main().catch(console.error);
