import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // 查询 3740977@qq.com 用户
  const rows = await sql`
    SELECT 
      id, 
      email, 
      name, 
      status, 
      role, 
      plan, 
      credits, 
      "dailyCredits", 
      "lastDailyResetAt"
    FROM users 
    WHERE email = '3740977@qq.com' 
    LIMIT 1
  `;
  
  if (rows.length === 0) {
    console.log('用户不存在');
    return;
  }
  
  const user = rows[0] as any;
  console.log('=== 用户数据 ===');
  console.log('ID:', user.id);
  console.log('Email:', user.email);
  console.log('Name:', user.name);
  console.log('Status:', user.status);
  console.log('Role:', user.role);
  console.log('Plan:', user.plan);
  console.log('Credits (充值积分):', user.credits);
  console.log('Daily Credits (每日积分):', user.dailyCredits);
  console.log('Last Reset At:', user.lastDailyResetAt);
  
  // 计算总积分
  const total = (user.credits || 0) + (user.dailyCredits || 0);
  console.log('总积分:', total);
}

main();
