import 'dotenv/config';
import { jwtVerify } from 'jose';

const AUTH_SECRET = process.env.AUTH_SECRET || 'prismatic-dev-secret-2024';

async function checkToken() {
  console.log('\n=== 调试步骤 ===');
  console.log('1. 在浏览器控制台运行:');
  console.log('   console.log(document.cookie)');
  console.log('');
  console.log('2. 查找名为 "prismatic_token" 的 cookie 值');
  console.log('');
  console.log('3. 将 token 粘贴到下方进行验证:');
  console.log('');

  const token = process.argv[2];
  if (!token) {
    console.log('❌ 请提供 token 作为参数:');
    console.log('   npx tsx scripts/verify-token.ts <your_token_here>');
    console.log('');
    console.log('或者手动解码 JWT (不含签名验证):');
    console.log('   1. 访问 https://jwt.io');
    console.log('   2. 粘贴 token');
    console.log('   3. 查看 payload 中的 userId');
    process.exit(1);
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(AUTH_SECRET));
    console.log('✅ Token 验证成功!');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('');
    console.log('用户 ID:', payload.userId);
    console.log('邮箱:', payload.email);
    if (payload.exp) console.log('过期时间:', new Date(payload.exp * 1000));
    if (payload.iat) console.log('签发时间:', new Date(payload.iat * 1000));
  } catch (err: any) {
    console.error('❌ Token 验证失败:', err.message);
    console.log('可能原因: token 已过期或签名不匹配');
  }
}

checkToken().catch(console.error);
