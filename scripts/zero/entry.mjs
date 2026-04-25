/**
 * Zero 蒸馏引擎 — 入口脚本
 * 直接执行 distillation，无临时文件
 */
import { join } from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), '.env.local'), override: true });

import { distillZero } from '../../src/lib/zero/engine';
import { writeFileSync, mkdirSync } from 'fs';

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const cleaned = arg.slice(2);
      if (cleaned.includes('=')) {
        const [key, value] = cleaned.split('=', 2);
        options[key] = value;
      } else {
        // --key value format
        options[cleaned] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '';
      }
    }
  }

  const personaId = options.persona ?? options.p ?? 'ni-haixia';
  const corpusDir = options.corpus ?? options.c ?? join(process.cwd(), 'corpus', personaId, 'texts');
  const budget = parseFloat(options.budget ?? options.b ?? '3');
  const output = options.output ?? options.o ?? join(process.cwd(), 'corpus', 'distilled', 'zero', `${personaId}-zero.json`);

  console.log(`Starting distillation: ${personaId}`);
  console.log(`Corpus: ${corpusDir}`);
  console.log(`Output: ${output}`);
  console.log(`Budget: $${budget}`);

  const result = await distillZero({
    personaId,
    corpusDir,
    budget,
    promptVariant: options.variant ?? 'default',
  });

  mkdirSync(join(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\nDistillation complete`);
  console.log(`Grade: ${result.grade ?? 'N/A'} | Score: ${result.score?.overall ?? 'N/A'}`);
  console.log(`MentalModels: ${result.knowledge?.mentalModels?.length ?? 0}`);
  console.log(`Values: ${result.knowledge?.values?.length ?? 0}`);
  console.log(`Heuristics: ${result.knowledge?.decisionHeuristics?.length ?? 0}`);
  console.log(`Cost: $${result.totalCost?.toFixed(4) ?? 'N/A'}`);
  console.log(`Output: ${output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
