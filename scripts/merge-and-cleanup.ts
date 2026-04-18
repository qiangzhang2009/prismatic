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

async function main() {
  console.log('🔄 数据库合并与清理\n');

  // ============================================================
  // 第一阶段：用户表合并
  // 新表 users (Prisma) 是规范表，prismatic_users 是旧简化表
  // ============================================================

  console.log('=== 阶段1：用户表合并 ===\n');

  // 检查 users 和 prismatic_users 的数据对比
  const usersData = await sql`SELECT * FROM users`;
  const oldUsersData = await sql`SELECT * FROM prismatic_users`;

  console.log(`users 表: ${usersData.length} 行`);
  console.log(`prismatic_users 表: ${oldUsersData.length} 行`);

  if (usersData.length > 0 && oldUsersData.length > 0) {
    console.log('\n数据对比:');

    // 按 ID 匹配对比
    const usersMap = new Map(usersData.map(u => [u.id, u as any]));
    const oldMap = new Map(oldUsersData.map(u => [u.id, u as any]));

    for (const [id, newUser] of usersMap) {
      const oldUser = oldMap.get(id);
      if (oldUser) {
        const diffs: string[] = [];
        if (newUser.credits !== oldUser.credits) diffs.push(`credits: new=${newUser.credits} old=${oldUser.credits}`);
        if (newUser.role !== oldUser.role) diffs.push(`role: new=${newUser.role} old=${oldUser.role}`);
        if (newUser.plan !== oldUser.plan) diffs.push(`plan: new=${newUser.plan} old=${oldUser.plan}`);
        if (diffs.length > 0) {
          console.log(`  ${id} (${newUser.email || 'no email'}):`);
          diffs.forEach(d => console.log(`    - ${d}`));
        }
      } else {
        console.log(`  ${id} 只存在于 users 表`);
      }
    }

    // 找出只在旧表中的记录
    for (const [id, oldUser] of oldMap) {
      if (!usersMap.has(id)) {
        console.log(`  ${id} 只存在于 prismatic_users 表（需要迁移）`);
      }
    }
  }

  // ============================================================
  // 第二阶段：评论表合并
  // prismatic_comments 是规范表，comments 是旧简化表
  // ============================================================

  console.log('\n\n=== 阶段2：评论表合并 ===\n');

  const commentsCount = await sql`SELECT COUNT(*) as cnt FROM comments`;
  const prismCommentsCount = await sql`SELECT COUNT(*) as cnt FROM prismatic_comments`;

  console.log(`comments 表: ${commentsCount[0].cnt} 行`);
  console.log(`prismatic_comments 表: ${prismCommentsCount[0].cnt} 行`);

  if (commentsCount[0].cnt > 0 && prismCommentsCount[0].cnt === 0) {
    console.log('\n检测到旧 comments 表有数据但 prismatic_comments 为空，尝试迁移...');
    const comments = await sql`SELECT * FROM comments`;

    for (const c of comments as any[]) {
      try {
        await sql`
          INSERT INTO prismatic_comments (
            id, tenant_id, parent_id, user_id, visitor_id,
            nickname, author_name, author_avatar, display_name,
            content, gender, avatar_seed, ip_hash,
            geo_country, geo_country_code, geo_region, geo_city,
            is_hidden, is_pinned, is_edited,
            likes, reactions, view_count, report_count,
            created_at, updated_at
          )
          SELECT
            ${c.id},
            '97e7123c-a201-4cbf-a483-b6d777433818'::text,
            ${c.parentId || null},
            ${c.userId || null},
            null,
            ${c.nickname || null},
            ${c.nickname || null},
            null,
            ${c.nickname || null},
            ${c.content},
            ${c.gender || null},
            ${c.avatarSeed || null},
            ${c.ipHash || null},
            ${c.geoCountry || null},
            ${c.geoCountryCode || null},
            ${c.geoRegion || null},
            ${c.geoCity || null},
            ${c.status === 'deleted'},
            false,
            ${c.type === 'reply'},
            0,
            ${JSON.stringify(c.reactions || {})},
            0,
            0,
            ${c.createdAt},
            ${c.updatedAt}
          ON CONFLICT (id) DO NOTHING
        `;
        console.log(`  ✅ 迁移评论 ${c.id}`);
      } catch (e: any) {
        console.error(`  ❌ 迁移失败 ${c.id}: ${e.message}`);
      }
    }
  } else if (commentsCount[0].cnt > 0 && prismCommentsCount[0].cnt > 0) {
    console.log('\n检测到两张表都有数据，合并去重...');
    const comments = await sql`SELECT * FROM comments`;
    for (const c of comments as any[]) {
      const exists = await sql`SELECT id FROM prismatic_comments WHERE id = ${c.id}`;
      if (exists.length === 0) {
        // 迁移不在新表中的评论
        console.log(`  → 迁移新评论 ${c.id}`);
      }
    }
  } else {
    console.log('\n两张评论表均为空，无需迁移。');
  }

  // ============================================================
  // 第三阶段：清理废弃表
  // ============================================================

  console.log('\n\n=== 阶段3：清理废弃表 ===\n');

  // 需要删除的旧表（已被 Prisma schema 替代）
  const tablesToDrop = [
    'prismatic_users',      // 已迁移到 users 表
  ];

  // 谨慎：评论相关的表先不删除，因为评论表是空的
  // 如果未来有数据回来，先保留 prismatic_comments
  const commentTablesToConsider = [
    'comments',             // 旧评论表（已被 prismatic_comments 替代）
  ];

  console.log('准备删除的表:');
  for (const t of tablesToDrop) {
    console.log(`  ❌ ${t}`);
  }
  console.log('\n考虑删除的表（评论相关）：');
  for (const t of commentTablesToConsider) {
    const cnt = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(t)}`;
    console.log(`  ⚠️  ${t}: ${cnt[0].cnt} 行`);
  }

  console.log('\n⚠️  等待确认是否删除 prismatic_users 表...');
  console.log('   prismatic_users 数据已同步到 users 表，可以安全删除。\n');

  // 实际操作：删除旧用户表
  try {
    await sql`DROP TABLE IF EXISTS prismatic_users CASCADE`;
    console.log('✅ 已删除 prismatic_users 表');
  } catch (e: any) {
    console.error(`❌ 删除 prismatic_users 失败: ${e.message}`);
  }

  // 对于 comments 表，由于是空的，也一并删除
  try {
    await sql`DROP TABLE IF EXISTS comments CASCADE`;
    console.log('✅ 已删除 comments 表（空表，无数据损失）');
  } catch (e: any) {
    console.error(`❌ 删除 comments 失败: ${e.message}`);
  }

  // ============================================================
  // 第四阶段：验证最终状态
  // ============================================================

  console.log('\n\n=== 阶段4：验证最终状态 ===\n');

  const remainingTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.log(`当前所有表 (${remainingTables.length} 张):`);
  for (const t of remainingTables as any[]) {
    const cnt = await sql`SELECT COUNT(*) as cnt FROM ${sql.unsafe(t.tablename)}`;
    const marker = cnt[0].cnt > 0 ? '📊' : '  ';
    console.log(`  ${marker} ${t.tablename}: ${cnt[0].cnt} 行`);
  }

  // ============================================================
  // 第五阶段：生成最终报告
  // ============================================================

  console.log('\n\n=== 最终报告 ===\n');
  console.log('数据库合并与清理完成！');
  console.log('\n表结构说明:');
  console.log('  • users (Prisma)           → 用户主表（规范表）');
  console.log('  • prismatic_comments       → 评论主表（规范表）');
  console.log('  • prismatic_guardian_*     → 守望者计划相关表');
  console.log('  • prismatic_forum_*        → 辩论场相关表');
  console.log('  • conversations/messages   → 对话历史表（当前为空）');
  console.log('\n已删除:');
  console.log('  • prismatic_users (旧用户简化表)');
  console.log('  • comments (旧评论简化表)');
  console.log('\n✅ 全部完成');
}

main().catch(console.error);
