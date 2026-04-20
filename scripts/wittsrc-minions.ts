#!/usr/bin/env bun
/**
 * wittsrc-minions.ts
 *
 * Minions job definitions for WittSrc Brain automated maintenance.
 * These are deterministic Postgres-native jobs that run on schedule.
 *
 * In a full gbrain deployment, these would be registered with:
 *   gbrain jobs submit wittsrc-sync --params '{}'
 *   gbrain jobs submit wittsrc-link-extract --params '{}'
 *   gbrain jobs submit wittsrc-health-check --params '{}'
 *
 * This script provides standalone execution for testing/development.
 *
 * Usage:
 *   bun run scripts/wittsrc-minions.ts sync        # sync corpus
 *   bun run scripts/wittsrc-minions.ts link        # extract links
 *   bun run scripts/wittsrc-minions.ts health      # run health check
 *   bun run scripts/wittsrc-minions.ts enrich      # enrich entities
 *   bun run scripts/wittsrc-minions.ts all         # run all jobs
 */

const JOBS = {
  'wittsrc-sync': {
    name: 'WittSrc Corpus Sync',
    description: 'Sync WittSrc/Clarino corpus, import new files to brain pages',
    type: 'deterministic',
    schedule: '0 3 * * *', // Daily at 3 AM
    script: 'wittsrc-brain-import',
    command: (params: Record<string, string>) =>
      `bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstain/texts/ --dry-run`,
    steps: [
      '1. Check WittSrc for new/updated manuscripts',
      '2. Check CLARINO for new CC-licensed files',
      '3. Compare content hashes with existing brain pages',
      '4. Import new/updated files (idempotent)',
      '5. Run gbrain sync to index changes',
    ],
  },

  'wittsrc-link-extract': {
    name: 'WittSrc Link Extraction',
    description: 'Extract typed links from all brain pages, update knowledge graph',
    type: 'deterministic',
    schedule: '0 4 * * *', // Daily at 4 AM (after sync)
    script: 'wittsrc-auto-link',
    command: (params: Record<string, string>) =>
      `bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstain/brain/works/ --dry-run`,
    steps: [
      '1. Read all brain pages in brain/works/',
      '2. Extract manuscript references (Ms-XXX, Ts-YYY)',
      '3. Extract philosopher names (Russell, Frege, Ramsey, etc.)',
      '4. Extract philosophical concepts (language-game, private language, etc.)',
      '5. Infer link types from context (cites/evolves_to/contradicts)',
      '6. Merge into graph.json',
    ],
  },

  'wittsrc-health-check': {
    name: 'WittSrc Brain Health Check',
    description: 'Run maintenance checks, fix issues, generate report',
    type: 'deterministic',
    schedule: '0 5 * * 0', // Weekly Sunday at 5 AM
    script: 'wittsrc-maintain',
    command: (params: Record<string, string>) =>
      `bun run scripts/wittsrc-maintain.ts --check`,
    steps: [
      '1. Check orphan pages (no inbound links)',
      '2. Check dead links (target does not exist)',
      '3. Check stale pages (90+ days without update)',
      '4. Check citation URLs (WittSrc/Clarino/Gutenberg)',
      '5. Check tag consistency',
      '6. Generate health report',
    ],
  },

  'wittsrc-enrich': {
    name: 'WittSrc Entity Enrichment',
    description: 'Enrich Tier 1 entities with SEP/IEP metadata',
    type: 'deterministic',
    schedule: '0 6 1 * *', // Monthly on 1st at 6 AM
    script: 'wittsrc-enrich',
    command: (params: Record<string, string>) =>
      `bun run scripts/wittsrc-enrich.ts --tier 1 --dry-run`,
    steps: [
      '1. Identify Tier 1 entities (8+ mentions OR core philosophers/concepts)',
      '2. Extract SEP/IEP metadata for each entity',
      '3. Update person/concept pages with enrichment',
      '4. Report enrichment stats',
    ],
  },

  'wittsrc-timeline-build': {
    name: 'WittSrc Timeline Builder',
    description: 'Extract and update concept/work timelines',
    type: 'deterministic',
    schedule: '0 7 * * *', // Daily at 7 AM
    script: 'wittsrc-timeline',
    command: (params: Record<string, string>) =>
      `bun run scripts/wittsrc-timeline.ts --all --type concept`,
    steps: [
      '1. Parse timeline sections from all brain pages',
      '2. Extract dated events (YYYY-MM: event)',
      '3. Detect gaps (periods with no activity)',
      '4. Update timeline pages',
    ],
  },
} as const;

type JobName = keyof typeof JOBS;

function printJobCard(name: JobName, job: typeof JOBS[JobName]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Job: ${job.name}`);
  console.log(`ID: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Type: ${job.type}`);
  console.log(`Schedule: ${job.schedule}`);
  console.log(`\nDescription: ${job.description}`);
  console.log(`\nSteps:`);
  job.steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  console.log(`\nCommand:`);
  console.log(`  ${job.command({})}`);
}

async function runJob(name: JobName) {
  const job = JOBS[name];
  console.log(`\n>>> Running job: ${name}`);
  console.log(`    ${job.description}`);

  const { execSync } = await import('child_process');
  try {
    const cmd = job.command({});
    // Replace --dry-run for actual execution
    const actualCmd = cmd.replace(/--dry-run/g, '');
    console.log(`\nExecuting: ${actualCmd}\n`);
    execSync(actualCmd, { stdio: 'inherit' });
    console.log(`\n<<< Job ${name} completed.`);
  } catch (err) {
    console.error(`\n<<< Job ${name} failed:`, err);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jobName = args[0] as JobName;
  const list = args.includes('--list');
  const show = args.includes('--show');

  if (list) {
    console.log('\n=== WittSrc Minions Jobs ===\n');
    for (const [name, job] of Object.entries(JOBS)) {
      console.log(`  ${name.padEnd(30)} ${job.schedule.padEnd(15)} ${job.type}`);
    }
    return;
  }

  if (show && jobName) {
    if (JOBS[jobName]) {
      printJobCard(jobName, JOBS[jobName]);
    } else {
      console.error(`Unknown job: ${jobName}`);
      console.error(`Available: ${Object.keys(JOBS).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  if (!jobName || jobName === 'all') {
    console.log('\n=== Running All WittSrc Minion Jobs ===\n');
    for (const name of Object.keys(JOBS) as JobName[]) {
      await runJob(name);
    }
    console.log('\n=== All Jobs Complete ===\n');
    return;
  }

  if (!JOBS[jobName]) {
    console.error(`Unknown job: ${jobName}`);
    console.error(`\nAvailable jobs:`);
    for (const [name, job] of Object.entries(JOBS)) {
      console.error(`  ${name}: ${job.description}`);
    }
    console.error(`\nOptions:`);
    console.error(`  --list   Show all jobs`);
    console.error(`  --show    Show job details`);
    console.error(`  all      Run all jobs`);
    process.exit(1);
  }

  await runJob(jobName);
}

main().catch(console.error);
