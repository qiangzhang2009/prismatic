#!/usr/bin/env node
/**
 * Zero 蒸馏引擎 — 批量蒸馏脚本
 *
 * Usage:
 *   node scripts/zero/batch-zero.mjs                              # 蒸馏所有有语料的人物
 *   node scripts/zero/batch-zero.mjs --personas confucius,wittgenstein  # 指定人物
 *   node scripts/zero/batch-zero.mjs --parallel 3 --budget 5           # 3并行，$5/人
 *   node scripts/zero/batch-zero.mjs --dry-run                         # 干跑
 */

import * as dotenv from 'dotenv';
import { readdirSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), '.env.local'), override: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// Parse CLI args
const args = process.argv.slice(2);
const options = {
  personas: [],
  parallel: 2,
  budget: 5,
  dryRun: false,
  outputRoot: join(PROJECT_ROOT, 'corpus/distilled/zero'),
  corpusRoot: join(PROJECT_ROOT, 'corpus'),
  verbose: false,
  overwrite: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--personas' && args[i + 1]) {
    options.personas = args[++i].split(',').map((s) => s.trim());
  } else if (args[i] === '--parallel' && args[i + 1]) {
    options.parallel = parseInt(args[++i], 10);
  } else if (args[i] === '--budget' && args[i + 1]) {
    options.budget = parseFloat(args[++i]);
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--output' && args[i + 1]) {
    options.outputRoot = args[++i];
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--overwrite') {
    options.overwrite = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    printUsage();
    process.exit(0);
  }
}

function printUsage() {
  console.log(`
Zero Batch Distillation

Usage:
  node scripts/zero/batch-zero.mjs [options]

Options:
  --personas <ids>   Comma-separated persona IDs (default: all with corpus)
  --parallel <n>    Parallel distillations (default: 2)
  --budget <usd>     Max budget per persona in USD (default: 5)
  --output <path>    Output directory (default: corpus/distilled/zero)
  --dry-run          Show what would be distilled without running
  --overwrite        Overwrite existing results
  --verbose, -v      Verbose logging
  --help, -h         Show this help

Examples:
  node scripts/zero/batch-zero.mjs --parallel 3 --budget 3
  node scripts/zero/batch-zero.mjs --personas wittgenstein,confucius --dry-run
  node scripts/zero/batch-zero.mjs --parallel 1 --budget 10
`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('Zero Batch Distillation');
  console.log(`Parallel: ${options.parallel} | Budget: $${options.budget}/persona`);
  console.log(`Corpus root: ${options.corpusRoot}`);
  console.log(`Output root: ${options.outputRoot}`);
  console.log('='.repeat(70));
  console.log();

  if (!options.dryRun && !existsSync(options.outputRoot)) {
    mkdirSync(options.outputRoot, { recursive: true });
  }

  const availablePersonas = findAvailablePersonas();

  if (options.personas.length > 0) {
    const requested = options.personas.filter((p) => availablePersonas.includes(p));
    const missing = options.personas.filter((p) => !availablePersonas.includes(p));
    if (missing.length > 0) {
      console.log(`Note: ${missing.length} requested persona(s) have no corpus: ${missing.join(', ')}`);
    }
    if (requested.length === 0) {
      console.error('ERROR: None of the requested personas have corpus data.');
      process.exit(1);
    }
    options.personas = requested;
  } else {
    options.personas = availablePersonas;
  }

  console.log(`Total personas to distill: ${options.personas.length}`);
  console.log();

  if (options.dryRun) {
    console.log('[DRY RUN] Would distill:');
    for (const p of options.personas) {
      const corpusDir = join(options.corpusRoot, p, 'texts');
      const fileCount = countCorpusFiles(corpusDir);
      console.log(`  ${p}: ${fileCount} files`);
    }
    process.exit(0);
  }

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const totalBudget = options.budget * options.personas.length;
  const startTime = Date.now();

  for (let i = 0; i < options.personas.length; i += options.parallel) {
    const batch = options.personas.slice(i, i + options.parallel);
    console.log(`\n[Batch ${Math.floor(i / options.parallel) + 1}] Distilling: ${batch.join(', ')}`);

    const results = await Promise.allSettled(
      batch.map((personaId) => distillOne(personaId))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const personaId = batch[j];

      if (result.status === 'fulfilled' && result.value) {
        completed++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] SUCCESS: ${personaId} → Score: ${result.value.score}/100 (${result.value.grade})`);
      } else if (result.status === 'rejected') {
        failed++;
        console.log(`  FAILED: ${personaId} → ${String(result.reason?.message || result.reason || 'Unknown error').slice(0, 100)}`);
      } else {
        skipped++;
        console.log(`  SKIP: ${personaId}`);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log();
  console.log('='.repeat(70));
  console.log(`Batch complete in ${totalTime}s`);
  console.log(`Completed: ${completed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log(`Total budget used: ~$${(completed * options.budget).toFixed(2)} (of ~$${totalBudget.toFixed(2)})`);
  console.log(`Output: ${options.outputRoot}`);
  console.log('='.repeat(70));
}

// =============================================================================
// Distill Single Persona
// =============================================================================

async function distillOne(personaId) {
  const outputPath = join(options.outputRoot, `${personaId}-zero.json`);

  if (existsSync(outputPath) && !options.overwrite) {
    console.log(`  SKIP: ${personaId} already has output (use --overwrite to replace)`);
    return null;
  }

  const corpusDir = join(options.corpusRoot, personaId, 'texts');
  if (!existsSync(corpusDir)) {
    const niHaixiaDir = join(options.corpusRoot, 'ni-haixia', 'texts');
    if (existsSync(niHaixiaDir)) {
      return await runDistillation(personaId, niHaixiaDir, outputPath);
    }
    throw new Error(`No corpus directory found for ${personaId}`);
  }

  return await runDistillation(personaId, corpusDir, outputPath);
}

async function runDistillation(personaId, corpusDir, outputPath) {
  const { execSync } = await import('child_process');

  mkdirSync(join(outputPath, '..'), { recursive: true });

  const cmdArgs = [
    'npx', 'tsx', 'scripts/zero/entry.mjs',
    `--persona=${personaId}`,
    `--corpus=${corpusDir}`,
    `--budget=${options.budget}`,
    `--output=${outputPath}`,
  ];
  if (options.verbose) cmdArgs.push('--verbose=1');

  // Increase Node.js memory limit for large corpus processing
  const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' };

  try {
    const result = execSync(cmdArgs.join(' '), {
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      env,
    });

    if (options.verbose) {
      console.log(result);
    }

    if (!existsSync(outputPath)) {
      throw new Error(`Output file not written: ${outputPath}`);
    }

    const parsed = JSON.parse(readFileSync(outputPath, 'utf-8'));
    const score = parsed.score?.voice?.overall ?? 0;
    const grade = parsed.grade ?? 'F';
    return { score, grade };
  } catch (err) {
    const msg = err.stdout ? err.stdout.slice(-500) : String(err.message || err);
    throw new Error(msg);
  }
}

// =============================================================================
// Utilities
// =============================================================================

function findAvailablePersonas() {
  if (!existsSync(options.corpusRoot)) return [];

  const entries = readdirSync(options.corpusRoot, { withFileTypes: true });
  const personas = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'distilled') continue;
    const corpusDir = join(options.corpusRoot, entry.name, 'texts');
    if (existsSync(corpusDir)) {
      const files = readdirSync(corpusDir);
      if (files.length > 0) {
        personas.push(entry.name);
      }
    }
  }

  return personas.sort();
}

function countCorpusFiles(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(d) {
    try {
      const entries = readdirSync(d);
      for (const entry of entries) {
        const full = join(d, entry);
        try {
          if (statSync(full).isDirectory()) {
            walk(full);
          } else {
            count++;
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable */ }
  }
  walk(dir);
  return count;
}

// =============================================================================
// Run
// =============================================================================

main().catch((err) => {
  console.error('\nBatch distillation FAILED:', err);
  process.exit(1);
});
