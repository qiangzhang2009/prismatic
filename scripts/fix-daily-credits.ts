/**
 * 修复用户每日积分字段
 * 
 * 运行方式: bun run scripts/fix-daily-credits.ts
 * 
 * 这个脚本会:
 * 1. 将所有 dailyCredits 为 0 或 NULL 的活跃用户设置为 20
 * 2. 将 lastDailyResetAt 设置为当前时间
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('错误: DATABASE_URL 环境变量未设置');
  process.exit(1);
}

async function fixDailyCredits() {
  const sql = neon(DATABASE_URL);
  
  console.log('开始修复用户每日积分...\n');
  
  // 1. 先查看有多少用户需要修复
  const statsBefore = await sql`
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN "dailyCredits" IS NULL OR "dailyCredits" = 0 THEN 1 END)::int AS needs_fix,
      AVG("dailyCredits")::float AS avg_daily_credits
    FROM users 
    WHERE status = 'ACTIVE'
  `;
  
  console.log('修复前统计:');
  console.log(`  总活跃用户: ${statsBefore[0].total}`);
  console.log(`  需要修复的用户: ${statsBefore[0].needs_fix}`);
  console.log(`  当前平均每日积分: ${statsBefore[0].avg_daily_credits?.toFixed(2) || 'N/A'}`);
  
  if (statsBefore[0].needs_fix === 0) {
    console.log('\n没有需要修复的用户。');
    return;
  }
  
  // 2. 执行修复
  console.log('\n正在修复...');
  
  const result = await sql`
    UPDATE users
    SET 
      "dailyCredits" = 20,
      "lastDailyResetAt" = NOW()
    WHERE status = 'ACTIVE'
      AND ("dailyCredits" IS NULL OR "dailyCredits" = 0)
    RETURNING id, email, "dailyCredits"
  `;
  
  console.log(`\n已修复 ${result.length} 个用户:`);
  for (const user of result) {
    console.log(`  - ${user.email}: dailyCredits = ${user.dailyCredits}`);
  }
  
  // 3. 验证修复结果
  const statsAfter = await sql`
    SELECT 
      COUNT(*)::int AS total,
      AVG("dailyCredits")::float AS avg_daily_credits,
      MIN("dailyCredits")::int AS min_daily,
      MAX("dailyCredits")::int AS max_daily
    FROM users 
    WHERE status = 'ACTIVE'
  `;
  
  console.log('\n修复后统计:');
  console.log(`  总活跃用户: ${statsAfter[0].total}`);
  console.log(`  平均每日积分: ${statsAfter[0].avg_daily_credits?.toFixed(2) || 'N/A'}`);
  console.log(`  最小每日积分: ${statsAfter[0].min_daily}`);
  console.log(`  最大每日积分: ${statsAfter[0].max_daily}`);
  
  console.log('\n修复完成!');
}

fixDailyCredits().catch(err => {
  console.error('修复失败:', err);
  process.exit(1);
});
