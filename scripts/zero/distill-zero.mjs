#!/usr/bin/env node
/**
 * Zero 蒸馏引擎 — 单人物蒸馏 CLI
 *
 * Usage:
 *   node scripts/zero/distill-zero.mjs --persona ni-haixia
 *   node scripts/zero/distill-zero.mjs --persona wittgenstein --output /tmp/result.json
 *   node scripts/zero/distill-zero.mjs --persona confucius --budget 3 --verbose
 */

import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), '.env.local'), override: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/zero/ → ../ → scripts/ → ../../ → project root
const PROJECT_ROOT = join(__dirname, '..', '..');

// Parse args
const args = process.argv.slice(2);
const options = {
  personaId: 'ni-haixia',
  corpusDir: '',
  output: '',
  budget: 5,
  variant: 'default',
  verbose: false,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--persona' && args[i + 1]) {
    options.personaId = args[++i];
  } else if (args[i] === '--corpus' && args[i + 1]) {
    options.corpusDir = args[++i];
  } else if (args[i] === '--output' && args[i + 1]) {
    options.output = args[++i];
  } else if (args[i] === '--budget' && args[i + 1]) {
    options.budget = parseFloat(args[++i]);
  } else if (args[i] === '--variant' && args[i + 1]) {
    options.variant = args[++i];
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    printUsage();
    process.exit(0);
  }
}

function printUsage() {
  console.log(`
Zero Persona Distillation CLI

Usage:
  node scripts/zero/distill-zero.mjs [options]

Options:
  --persona <id>    Persona ID (default: ni-haixia)
  --corpus <dir>    Corpus directory override
  --output <path>   Output file path (default: corpus/distilled/zero/{personaId}-zero.json)
  --budget <usd>   Max budget in USD (default: 5)
  --variant <name> Prompt variant: default | debate | deep-thought | casual (default: default)
  --verbose, -v    Verbose logging
  --dry-run        Show config without running
  --help, -h       Show this help
`);
}

function main() {
  const corpusDir = options.corpusDir || join(PROJECT_ROOT, 'corpus', options.personaId, 'texts');
  const output = options.output || join(PROJECT_ROOT, 'corpus', 'distilled', 'zero', `${options.personaId}-zero.json`);

  console.log('='.repeat(70));
  console.log(`Zero Distillation — ${options.personaId}`);
  console.log(`Corpus: ${corpusDir}`);
  console.log(`Output: ${output}`);
  console.log(`Budget: $${options.budget} | Variant: ${options.variant}`);
  console.log('='.repeat(70));
  console.log();

  if (options.dryRun) {
    console.log('[DRY RUN] Configuration:');
    console.log(`  personaId: ${options.personaId}`);
    console.log(`  corpusDir: ${corpusDir}`);
    console.log(`  output: ${output}`);
    console.log(`  budget: $${options.budget}`);
    console.log(`  variant: ${options.variant}`);
    process.exit(0);
  }

  const args = [
    'npx', 'tsx', 'scripts/zero/entry.mjs',
    `--persona=${options.personaId}`,
    `--corpus=${corpusDir}`,
    `--budget=${options.budget}`,
    `--output=${output}`,
  ];
  if (options.variant !== 'default') args.push(`--variant=${options.variant}`);
  if (options.verbose) args.push('--verbose=1');

  const env = { ...process.env };

  console.log(`[${new Date().toISOString()}] Starting distillation...`);
  console.log();

  try {
    const output_text = execSync(`${args.join(' ')} 2>&1`, {
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf-8',
      env,
      cwd: PROJECT_ROOT,
    });
    console.log(output_text);
  } catch (err) {
    console.error('\nDistillation FAILED:');
    console.error((err instanceof Error) ? err.message : String(err));
    console.error('STDOUT:', err.stdout && err.stdout.slice(-3000));
    console.error('STDERR:', err.stderr && err.stderr.slice(-3000));
    process.exit(1);
  }
}

main();
