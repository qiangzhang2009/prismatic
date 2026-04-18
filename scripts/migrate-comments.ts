import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

async function migrateComments() {
  console.log('\n=== 迁移评论数据 ===');

  // 1. 检查旧评论表结构
  console.log('\n1. prismatic_comments 表结构:');
  const oldColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'prismatic_comments'
    ORDER BY ordinal_position
  `;
  for (const col of oldColumns as any[]) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  // 2. 检查新评论表结构
  console.log('\n2. comments 表结构:');
  const newColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'comments'
    ORDER BY ordinal_position
  `;
  for (const col of newColumns as any[]) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  // 3. 读取旧评论数据
  console.log('\n3. 读取 prismatic_comments 数据:');
  const oldComments = await sql`SELECT * FROM prismatic_comments ORDER BY created_at LIMIT 5`;
  console.log(`   找到 ${oldComments.length} 条评论（旧表）`);

  if (oldComments.length > 0) {
    console.log('   前 5 条示例:');
    for (const c of oldComments as any[]) {
      console.log(`   - ID: ${c.id}, 用户: ${c.user_id}, 内容: ${c.content?.substring(0, 50)}...`);
    }

    // 4. 迁移到新表
    console.log('\n4. 开始迁移到 comments 表...');
    for (const oldComment of oldComments as any[]) {
      try {
        // 插入新表（字段映射需要根据实际结构调整）
        await sql`
          INSERT INTO comments (
            id, user_id, persona_id, parent_id, content,
            created_at, updated_at
          ) VALUES (
            ${oldComment.id},
            ${oldComment.user_id},
            ${oldComment.persona_id || null},
            ${oldComment.parent_id || null},
            ${oldComment.content},
            ${oldComment.created_at},
            ${oldComment.updated_at || oldComment.created_at}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        console.log(`   ✅ 已迁移评论 ${oldComment.id}`);
      } catch (err: any) {
        console.error(`   ❌ 迁移失败 ${oldComment.id}: ${err.message}`);
      }
    }
    console.log('   迁移完成！');
  } else {
    console.log('   旧表无评论数据，无需迁移');
  }

  // 5. 验证迁移结果
  console.log('\n5. 验证新表数据:');
  const newCount = await sql`SELECT COUNT(*) as cnt FROM comments`;
  console.log(`   comments 表总行数: ${newCount[0].cnt}`);
}

migrateComments().catch(console.error);
