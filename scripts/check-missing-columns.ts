import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const SCHEMA_COLS = [
  'id', 'createdAt', 'updatedAt', 'email', 'emailVerified',
  'phone', 'phoneVerified', 'passwordHash', 'wechatOpenid', 'wechatUnionid',
  'wechatNickname', 'wechatAvatar', 'githubId', 'githubUsername', 'githubAvatar',
  'googleId', 'googleEmail', 'googleAvatar', 'name', 'avatar', 'preferences',
  'status', 'bannedAt', 'banReason', 'tokenCount', 'tokenUpdatedAt', 'credits',
  'plan', 'role', 'apiKeyEncrypted'
];

async function main() {
  const dbCols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `;

  const dbColNames = new Set((dbCols as any[]).map(r => r.column_name));
  const schemaColSet = new Set(SCHEMA_COLS);

  console.log('=== DB columns ===');
  console.log([...dbColNames].sort().join(', '));
  console.log('\n=== Missing in DB (in schema) ===');
  const missing = SCHEMA_COLS.filter(c => !dbColNames.has(c));
  if (missing.length === 0) {
    console.log('None!');
  } else {
    missing.forEach(c => console.log('  MISSING:', c));
  }
}

main().catch(console.error);
