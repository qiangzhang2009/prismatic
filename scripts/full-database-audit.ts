import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(DATABASE_URL);

async function main() {
  console.log('🔍 彻查所有数据库表\n');

  // 1. 列出所有表
  console.log('=== 1. 所有 public schema 表 ===');
  const allTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  console.log(`共 ${allTables.length} 张表:`);
  for (const t of allTables as any[]) {
    console.log(`  - ${t.tablename}`);
  }

  // 2. 查找可能相关的表（评论、用户相关）
  console.log('\n=== 2. 查找评论/用户相关表 ===');
  const relatedTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND (
      tablename LIKE '%comment%'
      OR tablename LIKE '%user%'
      OR tablename LIKE '%message%'
      OR tablename LIKE '%prismatic%'
      OR tablename LIKE '%chat%'
      OR tablename LIKE '%feedback%'
    )
    ORDER BY tablename
  `;
  for (const t of relatedTables as any[]) {
    console.log(`  - ${t.tablename}`);
  }

  // 3. 检查每张表的数据量和样本
  console.log('\n=== 3. 所有表数据量统计 ===');
  for (const t of allTables as any[]) {
    const tablename = t.tablename;
    try {
      const count = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(tablename)}`;
      const sample = await sql`SELECT * FROM ${sql.unsafe(tablename)} LIMIT 1`;
      console.log(`\n📊 ${tablename}: ${count[0].cnt} 行`);
      if (sample.length > 0) {
        console.log('  列:', Object.keys(sample[0]).join(', '));
      }
    } catch (e: any) {
      console.log(`\n📊 ${tablename}: 错误 - ${e.message}`);
    }
  }

  // 4. 特别检查 comment 相关表
  console.log('\n\n=== 4. 评论相关表详细检查 ===');
  const commentTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND (
      tablename LIKE '%comment%'
      OR tablename LIKE '%message%'
    )
    ORDER BY tablename
  `;

  for (const t of commentTables as any[]) {
    const name = t.tablename;
    console.log(`\n--- ${name} ---`);

    // 表结构
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${name}
      ORDER BY ordinal_position
    `;
    for (const c of cols as any[]) {
      console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}) default: ${c.column_default || 'none'}`);
    }

    // 数据量
    const count = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(name)}`;
    console.log(`  总行数: ${count[0].cnt}`);

    // 样本数据
    if (count[0].cnt > 0) {
      const sample = await sql`SELECT * FROM ${sql.unsafe(name)} LIMIT 3`;
      console.log('  样本数据:');
      for (const row of sample) {
        console.log('   ', JSON.stringify(row).substring(0, 300));
      }
    }
  }

  // 5. 检查 prismatic_ 前缀表
  console.log('\n\n=== 5. prismatic_ 前缀表详细检查 ===');
  const prismTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'prismatic_%'
    ORDER BY tablename
  `;

  for (const t of prismTables as any[]) {
    const name = t.tablename;
    const count = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(name)}`;
    console.log(`  ${name}: ${count[0].cnt} 行`);

    const sample = await sql`SELECT * FROM ${sql.unsafe(name)} LIMIT 2`;
    if (sample.length > 0) {
      console.log('    列:', Object.keys(sample[0]).join(', '));
    }
  }

  console.log('\n✅ 检查完成');
}

main().catch(console.error);
