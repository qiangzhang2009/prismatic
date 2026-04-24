#!/usr/bin/env bun
/**
 * Fix corrupted systemPromptTemplate in the database directly.
 *
 * Corrupted pattern: "你是Sam Altman is a techno-optim..."
 * (mixing Chinese "你是" with English "is a")
 *
 * Fix: Rebuild clean SP from persona JSON + update DB.
 *
 * Usage:
 *   bun run scripts/fix-db-sp-corruption.ts --dry    # preview only
 *   bun run scripts/fix-db-sp-corruption.ts         # apply fix
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Build clean SP (same logic as fix-corrupted-json.ts) ─────────────────

function buildCleanSystemPrompt(persona: any): string {
  let identity = persona.briefZh || persona.brief || '一位智者';
  const shiIdx = identity.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 15) {
    identity = identity.slice(shiIdx + 2).trim();
  }
  if (!identity || identity.length < 5) identity = persona.brief || '一位智者';

  const tone = persona.expressionDNA?.tone || '中性';
  const certainty =
    persona.expressionDNA?.certaintyLevel === 'high' ? '表达确定'
    : persona.expressionDNA?.certaintyLevel === 'low' ? '保持适度不确定'
    : '平衡客观';
  const values = (persona.values || [])
    .slice(0, 3)
    .map((v: any) => v.nameZh || v.name)
    .join('、');
  const models = (persona.mentalModels || [])
    .slice(0, 3)
    .map((m: any) => m.nameZh || m.name)
    .join('、');
  const chineseAdaptation =
    persona.expressionDNA?.chineseAdaptation || '保持专业、清晰的中文表达。';
  const rhetoricalHabit =
    persona.expressionDNA?.rhetoricalHabit || '理性分析。';
  const speakingStyle =
    persona.expressionDNA?.speakingStyle || '语言简洁凝练，富有洞察力。';

  return `你是${identity}。

表达风格：${speakingStyle}
语气：${tone}
确信程度：${certainty}
修辞习惯：${rhetoricalHabit}

中文适应提示：
${chineseAdaptation}

核心价值观：${values}
思维特点：${models}
`;
}

// ─── CUID generator ────────────────────────────────────────────────────────

function cuid(): string {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

// ─── Detect corruption patterns ─────────────────────────────────────────────

function isCorrupted(sp: string): boolean {
  if (!sp) return false;
  // Pattern: "你是XXX is a" — Chinese opener + English continuation
  // e.g., "你是Sam Altman is a", "你是Naval Ravikant is a"
  if (/^你是[a-zA-Z]/.test(sp)) return true;
  // Pattern: starts with "你是XXX是一位" (name + "是一位" duplication)
  if (/^你是[\u4e00-\u9fff]{2,15}是一位/.test(sp)) return true;
  // Pattern: mixed English like "is a Buddhist monk"
  if (/\bis a\b/i.test(sp)) return true;
  return false;
}

// ─── Load V5 JSON for a given slug ────────────────────────────────────────

function loadV5Data(slug: string): any | null {
  const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');
  const filepath = join(V5_DIR, `${slug}-v5.json`);
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Fix one persona's SP in DB ─────────────────────────────────────────────

async function fixPersonaInDB(slug: string, dryRun: boolean): Promise<{ slug: string; status: string; detail: string }> {
  // 1. Get current DB record
  const row = await pool.query(`SELECT "slug", "name", "namezh", "systemPromptTemplate", "distillVersion" FROM distilled_personas WHERE "slug" = $1`, [slug]);
  if (row.rows.length === 0) {
    return { slug, status: 'not_found', detail: 'No record in DB' };
  }

  const currentSP = row.rows[0].systemPromptTemplate || '';
  if (!isCorrupted(currentSP)) {
    return { slug, status: 'clean', detail: 'SP already clean' };
  }

  // 2. Load V5 JSON to get persona data
  const v5Data = loadV5Data(slug);
  if (!v5Data) {
    return { slug, status: 'no_json', detail: 'No V5 JSON found' };
  }

  // 3. Build clean SP from JSON persona data
  const persona = v5Data.persona || {};
  const cleanSP = buildCleanSystemPrompt(persona);

  if (dryRun) {
    return {
      slug,
      status: 'would_fix',
      detail: `Current: "${currentSP.substring(0, 40)}..." -> Clean: "${cleanSP.substring(0, 40)}..."`
    };
  }

  // 4. Update DB
  const newId = cuid();
  const query = `
    UPDATE distilled_personas SET
      id = $1,
      "systemPromptTemplate" = $2,
      "updatedAt" = NOW()
    WHERE "slug" = $3
    RETURNING "slug", "name", "namezh"
  `;
  await pool.query(query, [newId, cleanSP, slug]);
  return { slug, status: 'fixed', detail: `SP rebuilt (${cleanSP.length} chars)` };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { dry: { type: 'boolean', default: false } },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Fix DB systemPromptTemplate Corruptions\n${'─'.repeat(60)}\n`);

  // Step 1: Find all corrupted SP in DB
  const all = await pool.query(`SELECT slug, "systemPromptTemplate" FROM distilled_personas ORDER BY slug`);
  const corrupted: string[] = [];
  const clean: string[] = [];

  for (const row of all.rows) {
    if (isCorrupted(row.systemPromptTemplate || '')) {
      corrupted.push(row.slug);
      console.log(`  ✗ ${row.slug}: "${(row.systemPromptTemplate || '').substring(0, 50).replace(/\n/g, '\\n')}"`);
    } else {
      clean.push(row.slug);
    }
  }

  console.log(`\n  Total: ${all.rows.length} | Corrupted: ${corrupted.length} | Clean: ${clean.length}\n`);

  if (dryRun) {
    console.log(`[DRY] Would fix ${corrupted.length} corrupted SP in database.`);
    return;
  }

  if (corrupted.length === 0) {
    console.log('No corruption found. Nothing to fix.');
    return;
  }

  // Step 2: Fix each corrupted SP
  console.log(`Fixing ${corrupted.length} corrupted SP...\n`);
  let fixed = 0;
  let errors = 0;
  let skipped = 0;

  for (const slug of corrupted) {
    const result = await fixPersonaInDB(slug, false);
    if (result.status === 'fixed') {
      console.log(`  ✓ ${slug}: ${result.detail}`);
      fixed++;
    } else if (result.status === 'not_found' || result.status === 'no_json') {
      console.log(`  ⊘ ${slug}: ${result.detail}`);
      skipped++;
    } else {
      console.error(`  ✗ ${slug}: ${result.detail}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Fixed: ${fixed} | Skipped: ${skipped} | Errors: ${errors}`);

  // Step 3: Verify
  console.log('\nVerification...\n');
  const verify = await pool.query(`SELECT slug, substring("systemPromptTemplate", 1, 30) as sp_preview FROM distilled_personas`);
  let stillCorrupted = 0;
  for (const row of verify.rows) {
    if (isCorrupted(row.sp_preview || '')) {
      console.log(`  STILL CORRUPTED: ${row.slug}: "${(row.sp_preview || '').replace(/\n/g, '\\n')}"`);
      stillCorrupted++;
    }
  }
  if (stillCorrupted === 0) {
    console.log('  All DB SP verified clean!');
  } else {
    console.log(`\n  WARNING: ${stillCorrupted} still corrupted (see above)`);
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error(err); pool.end(); process.exit(1); });
