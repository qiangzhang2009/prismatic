/**
 * 诊断脚本：检查生产环境数据状态
 * 运行：node --loader ts-node/esm scripts/diagnose-db.ts
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('=== 1. 用户总数 ===');
  const totalUsers = await sql`SELECT COUNT(*) as cnt FROM users WHERE status != 'DELETED'`;
  console.log('总用户:', totalUsers[0].cnt);

  const activeUsers = await sql`SELECT COUNT(*) as cnt FROM users WHERE status = 'ACTIVE'`;
  console.log('活跃用户:', activeUsers[0].cnt);

  const paidUsers = await sql`SELECT COUNT(*) as cnt FROM users WHERE status = 'ACTIVE' AND plan != 'FREE' AND plan IS NOT NULL`;
  console.log('付费用户:', paidUsers[0].cnt);

  const allUsers = await sql`SELECT id, email, name, plan, status, "createdAt" FROM users WHERE status != 'DELETED' ORDER BY "createdAt" DESC LIMIT 20`;
  console.log('\n近20个用户:');
  allUsers.forEach(u => console.log(`  ${u.email} | ${u.name} | ${u.plan} | ${u.status} | ${u.createdAt?.slice(0, 10)}`));

  console.log('\n=== 2. 消息统计 ===');
  const msgStats = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE content != '[message-counted]') as total_messages,
      COUNT(DISTINCT "userId") FILTER (WHERE content != '[message-counted]') as unique_users,
      COUNT(DISTINCT "conversationId") FILTER (WHERE content != '[message-counted]') as unique_convs
    FROM messages
  `;
  console.log('总消息数:', msgStats[0].total_messages);
  console.log('独立用户数:', msgStats[0].unique_users);
  console.log('独立对话数:', msgStats[0].unique_convs);

  console.log('\n=== 3. 对话统计 ===');
  const convStats = await sql`
    SELECT 
      COUNT(*) as total_convs,
      SUM("totalCost") as sum_cost,
      SUM("totalTokens") as sum_tokens
    FROM conversations
  `;
  console.log('总对话数:', convStats[0].total_convs);
  console.log('累计API成本:', convStats[0].sum_cost, 'CNY');
  console.log('累计Tokens:', convStats[0].sum_tokens);

  // 近7天数据
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const msg7d = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE content != '[message-counted]') as messages,
      COUNT(DISTINCT "userId") FILTER (WHERE content != '[message-counted]') as mau,
      COUNT(DISTINCT "conversationId") FILTER (WHERE content != '[message-counted]') as convs
    FROM messages WHERE "createdAt" >= ${sevenDaysAgo}
  `;
  console.log('\n近7天:');
  console.log('  消息数:', msg7d[0].messages);
  console.log('  MAU:', msg7d[0].mau);
  console.log('  对话数:', msg7d[0].convs);

  const conv7d = await sql`
    SELECT SUM("totalCost") as cost, SUM("totalTokens") as tokens
    FROM conversations WHERE "updatedAt" >= ${sevenDaysAgo}
  `;
  console.log('  API成本:', conv7d[0].cost, 'CNY');
  console.log('  Tokens:', conv7d[0].tokens);

  console.log('\n=== 4. 检查重复消息 ===');
  // 检查同一对话中是否有完全重复的用户消息内容
  const dupCheck = await sql`
    SELECT 
      m1."conversationId",
      m1."userId",
      m1.content as content_preview,
      COUNT(*) as cnt
    FROM messages m1
    WHERE m1.role = 'user' AND m1.content != '[message-counted]'
    GROUP BY m1."conversationId", m1."userId", m1.content
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 15
  `;
  if (dupCheck.length === 0) {
    console.log('未发现完全重复的用户消息内容');
  } else {
    console.log('发现重复消息（同一对话+同一用户+同一内容出现多次）:');
    dupCheck.forEach(d => console.log(`  对话:${d.conversationId?.slice(0,8)} 用户:${d.userId?.slice(0,8)} 内容:${d.content_preview?.slice(0,30)} 重复:${d.cnt}次`));
  }

  console.log('\n=== 5. 检查消息表结构 ===');
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    ORDER BY ordinal_position
  `;
  console.log('messages 表字段:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

  console.log('\n=== 6. 查看部分消息样本（含内容） ===');
  const sampleMsgs = await sql`
    SELECT id, "conversationId", "userId", role, personaId, 
           LEFT(content, 80) as content_preview, 
           "tokensInput", "tokensOutput", "apiCost",
           "createdAt"
    FROM messages 
    WHERE content != '[message-counted]'
    ORDER BY "createdAt" DESC
    LIMIT 5
  `;
  sampleMsgs.forEach(m => console.log(JSON.stringify(m, null, 2)));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
