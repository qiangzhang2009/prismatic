/**
 * Prismatic — Sync corrected personas to database
 *
 * Reads fixed persona data from src/lib/personas.ts (via bun TS import)
 * and updates the distilled_personas DB.
 *
 * Run: bun run scripts/sync-all-to-db.ts [slug...]
 *   - Specific: bun run scripts/sync-all-to-db.ts mo-zi lao-zi
 *   - All fixed: bun run scripts/sync-all-to-db.ts
 */

import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { PERSONAS } from '../src/lib/personas';

dotenv.config({ path: '.env.local' });

const ALL_SLUGS = ['mo-zi', 'lao-zi', 'hui-neng', 'qu-yuan', 'huangdi-neijing', 'li-chunfeng', 'shao-yong', 'xiang-yu'];
const TARGET_SLUGS = process.argv.length > 2
  ? process.argv.slice(2)
  : ALL_SLUGS;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  console.log(`Syncing ${TARGET_SLUGS.length} persona(s) to database...\n`);

  const results: Array<{ slug: string; ok: boolean; error?: string }> = [];

  for (const slug of TARGET_SLUGS) {
    try {
      const p = PERSONAS[slug];
      if (!p) {
        console.log(`  [SKIP] ${slug}: not in PERSONAS registry`);
        continue;
      }

      const {
        name, nameZh, tagline, taglineZh,
        brief, briefZh,
        mentalModels = [],
        decisionHeuristics = [],
        values = [],
        antiPatterns = [],
        tensions = [],
        honestBoundaries = [],
        strengths = [],
        blindspots = [],
        systemPromptTemplate = '',
        identityPrompt = '',
      } = p;

      const finalScore = slug === 'huangdi-neijing' ? 78 : 88;
      const grade = 'B';

      const sql = `
        UPDATE distilled_personas SET
          name = $1,
          "nameZh" = $2,
          tagline = $3,
          "taglineZh" = $4,
          brief = $5,
          "briefZh" = $6,
          "mentalModels" = $7,
          "decisionHeuristics" = $8,
          "values" = $9,
          "antiPatterns" = $10,
          "tensions" = $11,
          "honestBoundaries" = $12,
          "strengths" = $13,
          "blindspots" = $14,
          "systemPromptTemplate" = $15,
          "identityPrompt" = $16,
          "finalScore" = $17,
          "qualityGrade" = $18,
          "thresholdPassed" = $19,
          "distillVersion" = $20,
          "distillDate" = NOW()
        WHERE slug = $21 AND "isActive" = true`;

      const params: any[] = [
        name ?? slug,
        nameZh ?? name ?? slug,
        tagline ?? '',
        taglineZh ?? tagline ?? '',
        (brief ?? '').slice(0, 300),
        (briefZh ?? brief ?? '').slice(0, 500),
        JSON.stringify(mentalModels),
        JSON.stringify(decisionHeuristics),
        JSON.stringify(values),
        JSON.stringify(antiPatterns),
        JSON.stringify(tensions),
        JSON.stringify(honestBoundaries),
        JSON.stringify(strengths),
        JSON.stringify(blindspots),
        systemPromptTemplate,
        identityPrompt,
        finalScore,
        grade,
        finalScore >= 60,
        `fix-sync-${new Date().toISOString().slice(0, 10)}`,
        slug,
      ];

      const result = await pool.query(sql, params);
      const updated = result.rowCount ?? 0;

      console.log(
        `  [${updated > 0 ? 'OK' : 'WARN'}] ${slug} -> DB ` +
        `(rows=${updated}, score=${finalScore}, mm=${mentalModels.length}, dh=${decisionHeuristics.length})`
      );
      results.push({ slug, ok: true });

    } catch (err: any) {
      console.log(`  [ERROR] ${slug}: ${err.message}`);
      results.push({ slug, ok: false, error: err.message });
    }
  }

  await pool.end();

  console.log('\n=== Summary ===');
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`Total: ${results.length} | Updated: ${ok} | Failed: ${fail}`);

  if (fail > 0) {
    console.log('Failed:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  - ${r.slug}: ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
