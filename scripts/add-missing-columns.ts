import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function main() {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
  `;
  const existing = new Set((cols as any[]).map((r: any) => r.column_name));

  // All ALTER TABLE statements as template literals (Neon requires tagged template syntax)
  const statements = [
    sql`ALTER TABLE users ADD COLUMN "apiKeyEncrypted" TEXT`,
    sql`ALTER TABLE users ADD COLUMN "apiKeyIv" TEXT`,
    sql`ALTER TABLE users ADD COLUMN "apiKeyHash" TEXT`,
    sql`ALTER TABLE users ADD COLUMN "apiKeySetAt" TIMESTAMP`,
    sql`ALTER TABLE users ADD COLUMN "apiKeyProvider" TEXT DEFAULT 'deepseek'`,
  ];

  const names = ['apiKeyEncrypted', 'apiKeyIv', 'apiKeyHash', 'apiKeySetAt', 'apiKeyProvider'];

  for (let i = 0; i < statements.length; i++) {
    const name = names[i];
    if (existing.has(name)) {
      console.log(`  ${name}: already exists`);
      continue;
    }
    try {
      await statements[i];
      console.log(`  ${name}: added`);
    } catch (e: any) {
      // Ignore "already exists" errors
      if (e?.message?.includes('already exists')) {
        console.log(`  ${name}: already exists (DB)`);
      } else {
        console.error(`  ${name}: FAILED — ${e?.message}`);
      }
    }
  }

  const verify = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('apiKeyEncrypted','apiKeyIv','apiKeyHash','apiKeySetAt','apiKeyProvider')
  `;
  console.log(`\nVerification — found ${verify.length}/5 new columns`);
}

main().catch(console.error);
