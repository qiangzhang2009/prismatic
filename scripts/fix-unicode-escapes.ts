/**
 * scripts/fix-unicode-escapes.ts
 *
 * Decodes all \uXXXX Unicode escape sequences stored as TEXT in the database.
 * The distillation process stored escaped strings like "\\u552f\\u4e00" as literal text.
 * This script decodes them to actual Chinese/Unicode characters in-place.
 */
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

function decodeDbUnicode(text: string): string {
  if (typeof text !== 'string') return text;
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
}

async function fixField(field: string): Promise<number> {
  // Read all rows
  const rows = await sql`SELECT id, slug, "${sql.unsafe(field)}" as val FROM distilled_personas WHERE "isActive" = true`;
  let fixed = 0;

  for (const row of rows as any[]) {
    const raw = row.val;
    if (typeof raw !== 'string') continue;
    if (!raw.includes('\\u')) continue;

    const decoded = decodeDbUnicode(raw);
    if (decoded !== raw) {
      await sql`UPDATE distilled_personas SET "${sql.unsafe(field)}" = ${decoded} WHERE id = ${row.id}`;
      fixed++;
    }
  }
  return fixed;
}

async function main() {
  console.log('Fixing Unicode escape sequences in distilled_personas...\n');

  const TEXT_FIELDS = [
    'name', 'namezh', 'nameen',
    'tagline', 'taglineZh',
    'brief', 'briefZh',
    'avatar', 'accentColor',
    'gradientFrom', 'gradientTo',
    'systemPromptTemplate', 'identityPrompt',
  ];

  for (const field of TEXT_FIELDS) {
    try {
      const count = await fixField(field);
      if (count > 0) {
        console.log(`  ✓ ${field}: fixed ${count} rows`);
      }
    } catch (e: unknown) {
      console.error(`  ✗ ${field}: ERROR — ${(e as Error)?.message}`);
    }
  }

  // Verify
  const sample = await sql`
    SELECT slug, "taglineZh", "briefZh"
    FROM distilled_personas
    WHERE "isActive" = true
    ORDER BY "finalScore" DESC
    LIMIT 5
  `;
  console.log('\n--- Verification ---');
  for (const row of sample as any[]) {
    console.log(`  ${row.slug}:`);
    console.log(`    taglineZh: ${(row.taglineZh || '').slice(0, 40)}`);
    console.log(`    briefZh:   ${(row.briefZh || '').slice(0, 60)}`);
  }

  // Count remaining escaped sequences
  const remaining = await sql`
    SELECT COUNT(*) as cnt FROM distilled_personas
    WHERE "isActive" = true
    AND ("taglineZh" LIKE '%\\u%' OR "briefZh" LIKE '%\\u%')
  `;
  console.log(`\nRemaining rows with \\u escapes: ${remaining[0]?.cnt ?? '?'}`);
  console.log('\nDone.');
}

main().catch(console.error);
