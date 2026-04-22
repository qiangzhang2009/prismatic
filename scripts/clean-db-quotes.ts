/**
 * Clean up errant double-quotes wrapping DB string fields in distilled_personas.
 * Symptom: API returns strings like `""hello""` instead of `"hello"`.
 * Fix: Strip leading/trailing double-quotes from all relevant text fields.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const TEXT_FIELDS = [
  'name',
  'namezh',
  'nameen',
  'tagline',
  'taglineZh',
  'brief',
  'briefZh',
  'avatar',
  'accentColor',
  'gradientFrom',
  'gradientTo',
  'systemPromptTemplate',
  'identityPrompt',
];

async function cleanField(field: string): Promise<number> {
  // Only update rows where the field actually starts with a quote
  const result = await sql`
    UPDATE distilled_personas
    SET "${sql.unsafe(field)}" = TRIM(BOTH '"' FROM "${sql.unsafe(field)}")
    WHERE "${sql.unsafe(field)}" LIKE '"%'
    RETURNING slug, "${sql.unsafe(field)}" as cleaned
  `;
  return (result as unknown[]).length;
}

async function main() {
  console.log('Cleaning errant quotes from distilled_personas...\n');

  for (const field of TEXT_FIELDS) {
    try {
      const count = await cleanField(field);
      console.log(`  ${field}: cleaned ${count} rows`);
    } catch (e: any) {
      console.error(`  ${field}: ERROR — ${e?.message}`);
    }
  }

  // Verify
  const sample = await sql`
    SELECT slug, tagline, "taglineZh", brief, "briefZh"
    FROM distilled_personas
    WHERE "isActive" = true
    LIMIT 5
  `;
  console.log('\n--- Verification (first 5 rows) ---');
  for (const row of sample as any[]) {
    console.log(`${row.slug}:`);
    console.log(`  tagline:   ${JSON.stringify(row.tagline).slice(0, 60)}`);
    console.log(`  taglineZh: ${JSON.stringify(row.taglineZh).slice(0, 60)}`);
    console.log(`  brief:     ${JSON.stringify(row.brief).slice(0, 60)}`);
    console.log(`  briefZh:   ${JSON.stringify(row.briefZh).slice(0, 60)}`);
  }
}

main().catch(console.error);
