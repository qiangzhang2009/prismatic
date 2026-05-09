/**
 * 检查所有用户的每日积分状态，找出可能需要重置的用户
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('错误: DATABASE_URL 环境变量未设置');
  process.exit(1);
}

async function checkAllUsers() {
  const sql = neon(DATABASE_URL);
  
  console.log('=== 检查所有用户每日积分状态 ===\n');
  
  // 获取所有活跃用户
  const users = await sql`
    SELECT 
      id, email, name, status,
      credits AS paid_credits,
      "dailyCredits",
      "lastDailyResetAt",
      "createdAt"
    FROM users 
    WHERE status = 'ACTIVE'
    ORDER BY "updatedAt" DESC
    LIMIT 20
  `;
  
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  console.log(`当前时间: ${now.toISOString()}`);
  console.log(`今天开始: ${todayStart.toISOString()}`);
  console.log('');
  
  for (const u of users) {
    const lastReset = new Date(u.lastDailyResetAt);
    const isResetDue = lastReset < todayStart;
    const isLowCredits = u.dailyCredits < 20;
    
    console.log(`=== 用户: ${u.email} (${u.name || 'N/A'}) ===`);
    console.log(`  ID: ${u.id}`);
    console.log(`  充值积分: ${u.paid_credits}`);
    console.log(`  每日积分: ${u.dailyCredits}`);
    console.log(`  上次重置: ${u.lastDailyResetAt}`);
    console.log(`  上次重置(本地): ${lastReset.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`  需要重置: ${isResetDue ? '是 ⚠️' : '否'}`);
    console.log(`  积分异常: ${isLowCredits ? '是 ⚠️ (可能已使用过)' : '否'}`);
    console.log('');
  }
  
  // 统计
  const stats = await sql`
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN "dailyCredits" < 20 THEN 1 END)::int AS below_20,
      COUNT(CASE WHEN "lastDailyResetAt" < ${todayStart.toISOString()}::timestamp THEN 1 END)::int AS needs_reset,
      AVG("dailyCredits")::float AS avg_daily
    FROM users 
    WHERE status = 'ACTIVE'
  `;
  
  console.log('=== 统计 ===');
  console.log(`总活跃用户: ${stats[0].total}`);
  console.log(`每日积分 < 20: ${stats[0].below_20}`);
  console.log(`需要重置: ${stats[0].needs_reset}`);
  console.log(`平均每日积分: ${stats[0].avg_daily?.toFixed(2) || 'N/A'}`);
  
  if (stats[0].needs_reset > 0) {
    console.log('\n⚠️ 有用户需要重置！');
  }
}

checkAllUsers().catch(console.error);
