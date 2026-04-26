import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Check 3740977@qq.com user password hash
  const user = await sql`SELECT id, email, "passwordHash", "createdAt" FROM users WHERE email = '3740977@qq.com'`;
  console.log('User:', JSON.stringify(user[0], null, 2));

  // Also check what other users with @qq.com domain exist
  const qqUsers = await sql`SELECT id, email, "createdAt" FROM users WHERE email LIKE '%@qq.com%' ORDER BY "createdAt" DESC`;
  console.log('\nAll QQ users:');
  for (const u of qqUsers) {
    console.log('  email:', u.email, 'id:', u.id.slice(0, 8), 'created:', u.createdAt);
  }

  // Check the latest deployment and its URL
  // The zxqconsulting.com might be pointing to a different deployment
  console.log('\nNote: prismatic.zxqconsulting.com resolves to 198.18.0.67 (Vercel internal)');
  console.log('The Vercel logs only show 3 entries in 24h, which means very few requests are hitting the serverless functions');
  console.log('This could mean the app is running purely client-side (SSR is not happening)');
}

main().catch(console.error);
