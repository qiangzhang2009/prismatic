/**
 * Script: inject-metadata.ts
 * Purpose: Add isAlive + corpusMetadata to every persona in personas.ts
 * Run: node scripts/inject-metadata.ts
 *
 * Approach: split file into lines, scan forward from the opening `PERSONAS['slug'] = {`
 * to find the persona's outer closing brace — identified as a `}` line followed by
 * either a blank line (then next PERSONAS entry) or an export line.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../src/lib/personas.ts');

// ─── Metadata definitions ─────────────────────────────────────────────────────

type GapStrategy = 'extrapolate_identity' | 'honest_boundary' | 'refer_to_sources' | 'hybrid';

interface PersonaMeta {
  isAlive: boolean;
  cutoffDate: string;
  corpusLastUpdated?: string;
  coverageStart?: number;
  coverageEnd?: number;
  gapStrategy: GapStrategy;
  sensitiveTopics?: string[];
  extrapolationBoundaries?: string[];
}

const PERSONA_META: Record<string, PersonaMeta> = {
  // ─── Historical figures ────────────────────────────────────────────────────
  'alan-turing':           { isAlive: false, cutoffDate: '1954-06-07', coverageEnd: 1954, gapStrategy: 'honest_boundary', sensitiveTopics: ['suicide', 'homosexuality persecution'] },
  'aleister-crowley':      { isAlive: false, cutoffDate: '1947-12-01', coverageEnd: 1947, gapStrategy: 'honest_boundary' },
  'alan-watts':            { isAlive: false, cutoffDate: '1973-11-16', coverageEnd: 1973, gapStrategy: 'honest_boundary' },
  'cao-cao':              { isAlive: false, cutoffDate: '0220-03-15', coverageEnd: 220,  gapStrategy: 'honest_boundary' },
  'carl-jung':            { isAlive: false, cutoffDate: '1961-06-06', coverageEnd: 1961, gapStrategy: 'honest_boundary', sensitiveTopics: ['posthumous analysis of his Red Book'] },
  'charlie-munger':       { isAlive: false, cutoffDate: '2023-11-28', coverageEnd: 2023, gapStrategy: 'extrapolate_identity', corpusLastUpdated: '2024-01-15' },
  'confucius':             { isAlive: false, cutoffDate: '-0479-01-01', coverageEnd: -479, gapStrategy: 'honest_boundary' },
  'einstein':             { isAlive: false, cutoffDate: '1955-04-18', coverageEnd: 1955, gapStrategy: 'honest_boundary' },
  'epictetus':            { isAlive: false, cutoffDate: '0135-01-01', coverageEnd: 135,  gapStrategy: 'honest_boundary' },
  'han-fei-zi':           { isAlive: false, cutoffDate: '0233-01-01', coverageEnd: 233,  gapStrategy: 'honest_boundary' },
  'huangdi-neijing':      { isAlive: false, cutoffDate: '-0263-01-01', coverageEnd: -263, gapStrategy: 'honest_boundary' },
  'hui-neng':             { isAlive: false, cutoffDate: '0713-01-01', coverageEnd: 713,  gapStrategy: 'honest_boundary' },
  'john-dee':             { isAlive: false, cutoffDate: '1608-01-01', coverageEnd: 1608, gapStrategy: 'honest_boundary' },
  'john-maynard-keynes':  { isAlive: false, cutoffDate: '1946-04-21', coverageEnd: 1946, gapStrategy: 'honest_boundary' },
  'journey-west':         { isAlive: false, cutoffDate: '1592-01-01', coverageEnd: 1592, gapStrategy: 'honest_boundary' },
  'kant':                 { isAlive: false, cutoffDate: '1804-02-12', coverageEnd: 1804, gapStrategy: 'honest_boundary' },
  'lao-zi':               { isAlive: false, cutoffDate: '-0531-01-01', coverageEnd: -531, gapStrategy: 'honest_boundary' },
  'li-chunfeng':          { isAlive: false, cutoffDate: '0733-01-01', coverageEnd: 733,  gapStrategy: 'honest_boundary' },
  'lin-yutang':           { isAlive: false, cutoffDate: '1976-03-26', coverageEnd: 1976, gapStrategy: 'honest_boundary' },
  'liu-bei':              { isAlive: false, cutoffDate: '0223-01-01', coverageEnd: 223,  gapStrategy: 'honest_boundary' },
  'marcus-aurelius':      { isAlive: false, cutoffDate: '0180-03-17', coverageEnd: 180,  gapStrategy: 'honest_boundary' },
  'marcus-aurelius-stoic':{ isAlive: false, cutoffDate: '0180-03-17', coverageEnd: 180,  gapStrategy: 'honest_boundary' },
  'mencius':              { isAlive: false, cutoffDate: '-0308-01-01', coverageEnd: -308, gapStrategy: 'honest_boundary' },
  'mo-zi':                { isAlive: false, cutoffDate: '-0391-01-01', coverageEnd: -391, gapStrategy: 'honest_boundary' },
  'nassim-taleb':         { isAlive: false, cutoffDate: '2023-01-01', coverageEnd: 2023, gapStrategy: 'honest_boundary' },
  'nikola-tesla':         { isAlive: false, cutoffDate: '1943-01-07', coverageEnd: 1943, gapStrategy: 'honest_boundary' },
  'osamu-dazai':          { isAlive: false, cutoffDate: '1948-06-13', coverageEnd: 1948, gapStrategy: 'honest_boundary', sensitiveTopics: ['suicide'] },
  'qian-xuesen':          { isAlive: false, cutoffDate: '2009-10-31', coverageEnd: 2009, gapStrategy: 'honest_boundary' },
  'qu-yuan':              { isAlive: false, cutoffDate: '-0278-01-01', coverageEnd: -278, gapStrategy: 'honest_boundary' },
  'records-grand-historian': { isAlive: false, cutoffDate: '-0086-01-01', coverageEnd: -86, gapStrategy: 'honest_boundary' },
  'richard-feynman':      { isAlive: false, cutoffDate: '1988-02-15', coverageEnd: 1988, gapStrategy: 'honest_boundary' },
  'seneca':               { isAlive: false, cutoffDate: '0065-04-01', coverageEnd: 65,   gapStrategy: 'honest_boundary' },
  'shao-yong':            { isAlive: false, cutoffDate: '1131-01-01', coverageEnd: 1131, gapStrategy: 'honest_boundary' },
  'sima-qian':            { isAlive: false, cutoffDate: '-0086-01-01', coverageEnd: -86,  gapStrategy: 'honest_boundary' },
  'socrates':             { isAlive: false, cutoffDate: '-0399-01-01', coverageEnd: -399, gapStrategy: 'honest_boundary' },
  'steve-jobs':           { isAlive: false, cutoffDate: '2011-10-05', coverageEnd: 2011, gapStrategy: 'extrapolate_identity', corpusLastUpdated: '2024-03-01', extrapolationBoundaries: ['post-2011 Apple strategy', 'post-Jobs Pixar direction'] },
  'sun-tzu':              { isAlive: false, cutoffDate: '-0496-01-01', coverageEnd: -496, gapStrategy: 'honest_boundary' },
  'sun-wukong':           { isAlive: false, cutoffDate: '1592-01-01', coverageEnd: 1592, gapStrategy: 'honest_boundary' },
  'three-kingdoms':       { isAlive: false, cutoffDate: '0280-01-01', coverageEnd: 280,  gapStrategy: 'honest_boundary' },
  'tripitaka':            { isAlive: false, cutoffDate: '-0483-01-01', coverageEnd: -483, gapStrategy: 'honest_boundary' },
  'wang-dongyue':         { isAlive: false, cutoffDate: '1792-01-01', coverageEnd: 1792, gapStrategy: 'honest_boundary' },
  'wittgenstein':         { isAlive: false, cutoffDate: '1951-04-29', coverageEnd: 1951, gapStrategy: 'honest_boundary' },
  'xiang-yu':             { isAlive: false, cutoffDate: '0202-01-01', coverageEnd: 202,  gapStrategy: 'honest_boundary' },
  'yuan-tiangang':        { isAlive: false, cutoffDate: '1839-01-01', coverageEnd: 1839, gapStrategy: 'honest_boundary' },
  'zhuang-zi':            { isAlive: false, cutoffDate: '-0286-01-01', coverageEnd: -286, gapStrategy: 'honest_boundary' },
  'zhuge-liang':          { isAlive: false, cutoffDate: '0234-01-01', coverageEnd: 234,  gapStrategy: 'honest_boundary' },
  'zhu-bajie':            { isAlive: false, cutoffDate: '1592-01-01', coverageEnd: 1592, gapStrategy: 'honest_boundary' },
  // ─── Living figures ──────────────────────────────────────────────────────────
  'andrej-karpathy':       { isAlive: true,  cutoffDate: '2024-01-01', coverageEnd: 2024, gapStrategy: 'hybrid' },
  'donald-trump':          { isAlive: true,  cutoffDate: '2025-01-20', coverageEnd: 2025, gapStrategy: 'hybrid', sensitiveTopics: ['active litigation', '2024 election details'] },
  'elon-musk':            { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity', sensitiveTopics: ['ongoing litigation', 'political affiliations'] },
  'ilya-sutskever':       { isAlive: true,  cutoffDate: '2024-06-01', coverageEnd: 2024, gapStrategy: 'hybrid' },
  'jack-ma':              { isAlive: true,  cutoffDate: '2024-01-01', coverageEnd: 2024, gapStrategy: 'hybrid', sensitiveTopics: ['CCP relations', 'ant group breakup'] },
  'jeff-bezos':           { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity' },
  'jensen-huang':         { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity' },
  'jiqun':                { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid', corpusLastUpdated: '2025-01-01' },
  'mrbeast':              { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity' },
  'naval-ravikant':       { isAlive: true,  cutoffDate: '2024-06-01', coverageEnd: 2024, gapStrategy: 'hybrid' },
  'ni-haixia':            { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid' },
  'paul-graham':          { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid' },
  'peter-thiel':          { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity', sensitiveTopics: ['political activities'] },
  'ray-dalio':            { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity' },
  'sam-altman':           { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid' },
  'warren-buffett':       { isAlive: true,  cutoffDate: '2025-03-01', coverageEnd: 2025, gapStrategy: 'extrapolate_identity', corpusLastUpdated: '2025-03-01' },
  'zhang-xuefeng':        { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid' },
  'zhang-yiming':         { isAlive: true,  cutoffDate: '2025-01-01', coverageEnd: 2025, gapStrategy: 'hybrid', sensitiveTopics: ['CCP relations', 'ByteDance/TikTok controversies'] },
};

const now = new Date().toISOString().slice(0, 10);

// ─── Script ───────────────────────────────────────────────────────────────────

function buildMetaLines(meta: PersonaMeta): string[] {
  const obj: Record<string, unknown> = {
    cutoffDate: meta.cutoffDate,
    corpusLastUpdated: meta.corpusLastUpdated ?? now,
    coverageSpan: {
      startYear: meta.coverageStart,
      endYear: meta.coverageEnd,
    },
    knowledgeGapStrategy: meta.gapStrategy,
  };
  if (meta.sensitiveTopics?.length) obj.sensitiveTopics = meta.sensitiveTopics;
  if (meta.extrapolationBoundaries?.length) obj.extrapolationBoundaries = meta.extrapolationBoundaries;

  const inner = JSON.stringify(obj, null, 2)
    .split('\n')
    .map((l, i) => i === 0 ? l : '  ' + l)
    .join('\n');
  return [
    `  isAlive: ${meta.isAlive},`,
    `  corpusMetadata: ${inner},`,
  ];
}

/**
 * The persona's outer closing brace is a `}` line that is followed by
 * either a blank line then the next PERSONAS entry, or by an export statement.
 * We look at the next 2 lines after each candidate `}` to make this decision.
 */
function findClosingLineIndex(
  lines: string[],
  startLineIdx: number,
): number {
  for (let i = startLineIdx; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Must end with } (handles both `}` and `};`)
    const lineContent = line.trimEnd();
    if (!lineContent.endsWith('}')) continue;

    // Count braces: skip lines with any { (not a pure close)
    let hasOpen = false;
    let closeCount = 0;
    for (const ch of line) {
      if (ch === '{') hasOpen = true;
      if (ch === '}') closeCount++;
    }
    if (hasOpen || closeCount !== 1) continue;

    // Peek at next 2 lines to determine if this is the persona close
    const next = (lines[i + 1] ?? '').trim();
    const nextNext = (lines[i + 2] ?? '').trim();

    // Valid persona close patterns:
    //  - `}` followed by blank line, then `PERSONAS['...`
    //  - `}` followed directly by `PERSONAS['...`
    //  - `}` followed by blank line, then `export ` (end of file)
    //  - `}` followed directly by `export `
    // Valid persona close patterns:
    //  - `}` followed by blank line, then PERSONAS or export
    //  - `}` directly followed by PERSONAS or export (compact `};` style)
    //  - `};` — line ends with `};` AND next line is PERSONAS / export / blank+comment
    //  - End of file (last persona, next lines are empty)
    const isPersonaClose =
      (next === '' && (nextNext.startsWith("PERSONAS['") || nextNext.startsWith('export '))) ||
      (next.startsWith("PERSONAS['") || next.startsWith('export ')) ||
      (lineContent.endsWith('};') && (
        next.startsWith("PERSONAS['") || next.startsWith('export ') ||
        next.startsWith('// ') || next === '')) ||
      // Last persona: followed by blank+comment or blank+blank
      (next === '' && (nextNext.startsWith('// ') || nextNext === ''));

    if (isPersonaClose) return i;
  }
  return -1;
}

function injectMetadata(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;
  let modified = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Match PERSONAS['slug'] = {
    const match = line.match(/^PERSONAS\['([^']+)'\]\s*=\s*\{\s*$/);
    if (!match) {
      result.push(line);
      i++;
      continue;
    }

    const slug = match[1]!;
    const meta = PERSONA_META[slug];
    if (!meta) {
      // Unknown persona — pass through unchanged
      result.push(line);
      i++;
      continue;
    }

    // Push the opening line
    result.push(line);
    i++;

    // Find the closing line of this persona
    const closeLineIdx = findClosingLineIndex(lines, i);

    if (closeLineIdx === -1) {
      console.warn(`  [WARN] Could not find closing brace for PERSONAS['${slug}'] — skipping`);
      while (i < lines.length) {
        result.push(lines[i]!);
        i++;
      }
      break;
    }

    // Push all lines from i up to (but not including) the closing line
    for (let j = i; j < closeLineIdx; j++) {
      result.push(lines[j]!);
    }

    // Insert new fields before the close line
    for (const f of buildMetaLines(meta)) {
      result.push(f);
    }

    // Push the closing line unchanged
    result.push(lines[closeLineIdx]!);

    i = closeLineIdx + 1;
    modified++;
    console.log(`  [OK] ${slug} — isAlive=${meta.isAlive}, gapStrategy=${meta.gapStrategy}`);
  }

  console.log(`\nModified ${modified}/${Object.keys(PERSONA_META).length} personas.`);
  return result.join('\n');
}

function main() {
  const content = fs.readFileSync(FILE, 'utf8');
  const updated = injectMetadata(content);
  fs.writeFileSync(FILE, updated, 'utf8');
  console.log(`\nWritten to ${FILE}`);
}

main();
