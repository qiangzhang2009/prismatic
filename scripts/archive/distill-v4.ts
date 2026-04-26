#!/usr/bin/env node
/**
 * Prismatic — Distillation v4 CLI
 * Universal multi-route persona distillation command-line tool
 *
 * Usage:
 *   bun run scripts/distill-v4.ts <persona-id> [--config <json>] [--output <path>] [--verbose]
 *   bun run scripts/distill-v4.ts --list                    # List all personas
 *   bun run scripts/distill-v4.ts --all                    # Distill all personas with corpus
 *   bun run scripts/distill-v4.ts --corpus <persona-id>    # Analyze corpus only
 *
 * Examples:
 *   bun run scripts/distill-v4.ts wittgenstein --verbose
 *   bun run scripts/distill-v4.ts charlie-munger --route bi --max-iterations 5
 *   bun run scripts/distill-v4.ts --all --parallel 4
 */

import * as fs from 'fs';
import * as path from 'path';

const CORPUS_ROOT = path.join(process.cwd(), 'corpus');
const OUTPUT_ROOT = path.join(process.cwd(), 'corpus', 'distilled', 'v4');
const CORPUS_MANIFEST = path.join(CORPUS_ROOT, 'corpus-manifest.json');

// ─── CLI Argument Parser ─────────────────────────────────────────────────────────

interface CliArgs {
  command: 'distill' | 'list' | 'corpus' | 'all';
  personaId?: string;
  config?: {
    outputLanguage?: string;
    maxIterations?: number;
    adaptiveThreshold?: boolean;
    verbose?: boolean;
    route?: string;
    parallel?: number;
  };
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { command: 'distill' };
  const config: CliArgs['config'] = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') { args.command = 'list'; }
    else if (arg === '--help' || arg === '-h') { args.command = 'help'; }
    else if (arg === '--corpus') { args.command = 'corpus'; args.personaId = argv[++i]; }
    else if (arg === '--all') { args.command = 'all'; }
    else if (arg === '--verbose' || arg === '-v') { config.verbose = true; }
    else if (arg === '--parallel' || arg === '-p') { config.parallel = parseInt(argv[++i]); }
    else if (arg === '--max-iterations') { config.maxIterations = parseInt(argv[++i]); }
    else if (arg === '--route') { config.route = argv[++i]; }
    else if (arg === '--output' || arg === '-o') { /* handled separately */ }
    else if (!arg.startsWith('--')) { args.personaId = arg; }
  }

  args.config = config;
  return args;
}

// ─── Corpus Analysis ────────────────────────────────────────────────────────────

async function analyzeCorpusOnly(personaId: string) {
  const { analyzeCorpus } = await import('../src/lib/distillation-l1-intelligence');
  const { decideRoute, summarizeRoute } = await import('../src/lib/distillation-l2-routing');

  const corpusDir = path.join(CORPUS_ROOT, personaId, 'texts');
  console.log(`\n=== Corpus Intelligence: ${personaId} ===\n`);

  const report = await analyzeCorpus(personaId, corpusDir);

  console.log(`Files: ${report.totalFiles}`);
  console.log(`Total Words: ${report.totalWords.toLocaleString()}`);
  console.log(`Total Chars: ${report.totalChars.toLocaleString()}`);
  console.log(`Unique Word Ratio: ${(report.uniqueWordRatio * 100).toFixed(1)}%`);
  console.log(`Avg Sentence Length: ${report.avgSentenceLength.toFixed(1)}`);
  console.log(`Signal Strength: ${report.signalStrength}`);

  console.log(`\n--- Language Distribution ---`);
  for (const ld of report.languageDistribution) {
    console.log(`  ${ld.language}: ${(ld.ratio * 100).toFixed(1)}% (${ld.wordCount.toLocaleString()} words) in ${ld.files.length} files`);
  }

  console.log(`\n--- Source Type Distribution ---`);
  for (const st of report.sourceTypeDistribution) {
    console.log(`  ${st.type}: ${st.count} files, ${st.wordCount.toLocaleString()} words`);
  }

  console.log(`\n--- Warnings ---`);
  if (report.warnings.length === 0) {
    console.log('  None');
  } else {
    for (const w of report.warnings) console.log(`  - ${w}`);
  }

  const route = decideRoute(personaId, report, 'zh-CN');
  console.log(`\n--- Route Decision ---`);
  console.log(summarizeRoute(route));
}

// ─── List Personas ───────────────────────────────────────────────────────────────

async function listPersonas() {
  const corpusManifest = JSON.parse(
    fs.readFileSync(CORPUS_MANIFEST, 'utf-8')
  );

  console.log('\n=== Prismatic Personas ===\n');
  console.log(`Total tracked: ${corpusManifest.totalPersonas}`);
  console.log(`Total words: ${corpusManifest.totalWords.toLocaleString()}`);
  console.log('\n--- With Corpus ---');

  const withCorpus = corpusManifest.personas.filter((p: any) => p.totalWords > 0);
  const withoutCorpus = corpusManifest.personas.filter((p: any) => p.totalWords === 0);

  for (const p of withCorpus) {
    console.log(`  ${p.personaId.padEnd(25)} ${p.totalWords.toLocaleString().padStart(8)} words  ${p.files} files`);
  }

  console.log(`\n--- Without Corpus (${withoutCorpus.length}) ---`);
  for (const p of withoutCorpus) {
    console.log(`  ${p.personaId}`);
  }
}

// ─── Single Distillation ────────────────────────────────────────────────────────

async function distillPersona(personaId: string, config: any) {
  console.log(`\n=== Distillation v4: ${personaId} ===\n`);

  const corpusDir = path.join(CORPUS_ROOT, personaId, 'texts');

  if (!fs.existsSync(corpusDir)) {
    console.error(`Error: Corpus directory not found: ${corpusDir}`);
    console.error('Run with --corpus first to analyze, or ensure corpus exists.');
    process.exit(1);
  }

  // Import the v4 orchestrator
  const { distillPersonaV4, DEFAULT_CONFIG } = await import('../src/lib/distillation-v4');
  const { getLLMProvider } = await import('../src/lib/llm');

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const llm = getLLMProvider();
  console.log(`[Distill v4] Using LLM provider: ${process.env.LLM_PROVIDER ?? 'deepseek'}`);

  const result = await distillPersonaV4({
    personaId,
    corpusDir,
    config: mergedConfig,
    onProgress: (stage, progress) => {
      if (config.verbose) {
        console.log(`  [${stage}] ${progress}%`);
      } else {
        process.stdout.write(`\r  [${stage}] ${progress}%`);
      }
    },
  });
  console.log(''); // newline after progress

  // Save output
  const outputPath = path.join(OUTPUT_ROOT, `${personaId}-v4.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result.persona, null, 2), 'utf-8');

  console.log(`\n=== Result ===\n`);
  console.log(`Score: ${result.persona.score.overall}/100 (${result.persona.grade})`);
  console.log(`Route: ${result.persona.meta.route}`);
  console.log(`Confidence: ${result.persona.meta.confidence}`);
  console.log(`Iterations: ${result.persona.iterationHistory.length}`);
  console.log(`Output: ${outputPath}`);

  if (result.pipelineResult.status === 'success') {
    console.log(`\nPipeline: SUCCESS`);
  } else if (result.pipelineResult.status === 'degraded') {
    console.log(`\nPipeline: DEGRADED — ${(result.pipelineResult as any).reason}`);
  } else {
    console.log(`\nPipeline: FAILED — ${(result.pipelineResult as any).reason}`);
  }
}

// ─── Batch Distillation ─────────────────────────────────────────────────────────

async function distillAll(config: any) {
  const corpusManifest = JSON.parse(
    fs.readFileSync(CORPUS_MANIFEST, 'utf-8')
  );

  const withCorpus = corpusManifest.personas.filter((p: any) => p.totalWords > 0);
  console.log(`\n=== Batch Distillation v4: ${withCorpus.length} personas ===\n`);

  const parallel = config.parallel ?? 1;
  const results: { personaId: string; status: string; score: number }[] = [];

  for (let i = 0; i < withCorpus.length; i += parallel) {
    const batch = withCorpus.slice(i, i + parallel);
    const promises = batch.map(async (p: any) => {
      try {
        await distillPersona(p.personaId, config);
        return { personaId: p.personaId, status: 'ok', score: 0 };
      } catch (e) {
        console.error(`Error distilling ${p.personaId}:`, (e as Error).message);
        return { personaId: p.personaId, status: 'error', score: 0 };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    console.log(`\nProgress: ${Math.min(i + parallel, withCorpus.length)}/${withCorpus.length}`);
  }

  console.log(`\n=== Batch Complete ===\n`);
  const succeeded = results.filter(r => r.status === 'ok').length;
  console.log(`Succeeded: ${succeeded}/${results.length}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'help':
    case 'list':
      await listPersonas();
      break;
    case 'corpus':
      await analyzeCorpusOnly(args.personaId!);
      break;
    case 'distill':
      await distillPersona(args.personaId!, args.config ?? {});
      break;
    case 'all':
      await distillAll(args.config ?? {});
      break;
    default:
      console.log('Usage:');
      console.log('  bun run scripts/distill-v4.ts --list                    # List all personas');
      console.log('  bun run scripts/distill-v4.ts --corpus <id>            # Analyze corpus only');
      console.log('  bun run scripts/distill-v4.ts <id>                     # Distill single persona');
      console.log('  bun run scripts/distill-v4.ts --all [--parallel N]     # Distill all');
      break;
  }
}

main().catch(console.error);
