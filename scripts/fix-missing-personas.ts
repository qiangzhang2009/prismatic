/**
 * Script: fix-missing-personas.ts
 * Purpose: Inject isAlive + corpusMetadata into the 11 personas
 *        that the main script missed due to special closing patterns.
 *
 * Strategy: for each missing persona, find its opening line and then
 * find the closing line (where the next PERSONAS entry or export begins).
 * Insert metadata right before the closing brace.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../src/lib/personas.ts');

const MISSING: Record<string, { isAlive: boolean; cutoffDate: string; coverageEnd?: number; gapStrategy: string; sensitiveTopics?: string[]; corpusLastUpdated?: string }> = {
  'alan-turing':            { isAlive: false, cutoffDate: '1954-06-07', coverageEnd: 1954, gapStrategy: 'honest_boundary', sensitiveTopics: ['suicide', 'homosexuality persecution'] },
  'alan-watts':             { isAlive: false, cutoffDate: '1973-11-16', coverageEnd: 1973, gapStrategy: 'honest_boundary' },
  'aleister-crowley':       { isAlive: false, cutoffDate: '1947-12-01', coverageEnd: 1947, gapStrategy: 'honest_boundary' },
  'andrej-karpathy':        { isAlive: true,  cutoffDate: '2024-01-01', coverageEnd: 2024, gapStrategy: 'hybrid' },
  'cao-cao':               { isAlive: false, cutoffDate: '0220-03-15', coverageEnd: 220,  gapStrategy: 'honest_boundary' },
  'carl-jung':             { isAlive: false, cutoffDate: '1961-06-06', coverageEnd: 1961, gapStrategy: 'honest_boundary', sensitiveTopics: ['posthumous analysis of his Red Book'] },
  'charlie-munger':         { isAlive: false, cutoffDate: '2023-11-28', coverageEnd: 2023, gapStrategy: 'extrapolate_identity', corpusLastUpdated: '2024-01-15' },
  'confucius':              { isAlive: false, cutoffDate: '-0479-01-01', coverageEnd: -479, gapStrategy: 'honest_boundary' },
  'donald-trump':            { isAlive: true,  cutoffDate: '2025-01-20', coverageEnd: 2025, gapStrategy: 'hybrid', sensitiveTopics: ['active litigation', '2024 election details'] },
  'einstein':              { isAlive: false, cutoffDate: '1955-04-18', coverageEnd: 1955, gapStrategy: 'honest_boundary' },
  'elon-musk':             { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity', sensitiveTopics: ['ongoing litigation', 'political affiliations'] },
};

const now = new Date().toISOString().slice(0, 10);

function buildMetaLines(meta: Record<string, unknown>): string[] {
  const inner = JSON.stringify(meta, null, 2)
    .split('\n')
    .map((l, i) => i === 0 ? l : '  ' + l)
    .join('\n');
  return [
    `  isAlive: ${(meta as { isAlive: boolean }).isAlive},`,
    `  corpusMetadata: ${inner},`,
  ];
}

function findPersonaClose(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!trimmed.endsWith('}')) continue;

    let hasOpen = false;
    for (const ch of line) { if (ch === '{') hasOpen = true; }
    if (hasOpen) continue;

    const next = (lines[i + 1] ?? '').trim();
    const nextNext = (lines[i + 2] ?? '').trim();

    if (
      next.startsWith("PERSONAS['") || next.startsWith('export ') ||
      next.startsWith('// ') ||
      (next === '' && (nextNext.startsWith("PERSONAS['") || nextNext.startsWith('export ') || nextNext.startsWith('// ')))
    ) return i;
  }
  return -1;
}

function main() {
  const content = fs.readFileSync(FILE, 'utf8');
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;
  let fixed = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const match = line.match(/^PERSONAS\['([^']+)'\]\s*=\s*\{\s*$/);

    if (!match) {
      result.push(line);
      i++;
      continue;
    }

    const slug = match[1]!;
    const meta = MISSING[slug];

    result.push(line);
    i++;

    if (!meta) {
      // Not a missing persona — scan to next persona
      const closeIdx = findPersonaClose(lines, i);
      if (closeIdx === -1) {
        // Push remaining
        while (i < lines.length) { result.push(lines[i]!); i++; }
      } else {
        for (let j = i; j <= closeIdx; j++) { result.push(lines[j]!); }
        i = closeIdx + 1;
      }
      continue;
    }

    // Check if already has isAlive (was fixed by previous run)
    let hasAlive = false;
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j]!.includes('isAlive:')) { hasAlive = true; break; }
    }

    if (hasAlive) {
      console.log(`  [SKIP] ${slug} — already has isAlive`);
      const closeIdx = findPersonaClose(lines, i);
      if (closeIdx === -1) {
        while (i < lines.length) { result.push(lines[i]!); i++; }
      } else {
        for (let j = i; j <= closeIdx; j++) { result.push(lines[j]!); }
        i = closeIdx + 1;
      }
      continue;
    }

    const closeIdx = findPersonaClose(lines, i);

    if (closeIdx === -1) {
      console.warn(`  [WARN] Could not find closing for ${slug}`);
      while (i < lines.length) { result.push(lines[i]!); i++; }
      break;
    }

    // Push lines up to (not including) the closing line
    for (let j = i; j < closeIdx; j++) result.push(lines[j]!);

    // Build and insert metadata
    const metaObj: Record<string, unknown> = {
      cutoffDate: meta.cutoffDate,
      corpusLastUpdated: meta.corpusLastUpdated ?? now,
      coverageSpan: { endYear: meta.coverageEnd },
      knowledgeGapStrategy: meta.gapStrategy,
    };
    if (meta.sensitiveTopics?.length) metaObj.sensitiveTopics = meta.sensitiveTopics;

    for (const f of buildMetaLines(metaObj)) result.push(f);
    result.push(lines[closeIdx]!);

    i = closeIdx + 1;
    fixed++;
    console.log(`  [FIXED] ${slug}`);
  }

  console.log(`\nFixed ${fixed} personas.`);
  fs.writeFileSync(FILE, result.join('\n'), 'utf8');
  console.log(`Written to ${FILE}`);
}

main();
