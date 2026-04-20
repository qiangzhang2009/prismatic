#!/usr/bin/env bun
/**
 * wittsrc-timeline.ts
 *
 * Extract timelines from Brain Pages, generate concept/work/person timelines.
 *
 * Usage:
 *   bun run scripts/wittsrc-timeline.ts concept-language-game
 *   bun run scripts/wittsrc-timeline.ts --all --type concept
 *   bun run scripts/wittsrc-timeline.ts --periods
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

interface TimelineEntry {
  date: string;
  event: string;
  slug?: string;
  confidence: number;
}

interface Timeline {
  slug: string;
  title: string;
  type: string;
  span: [number, number] | null;
  entries: TimelineEntry[];
  gaps: Array<{ start: string; end: string; duration: string }>;
}

const TIMELINE_ENTRY = /^-\s*(\d{4}(?:-\d{2})?(?:-\d{2})?):\s*(.+)$/gm;
const PERIODS: Array<{ name: string; start: number; end: number; color: string }> = [
  { name: 'Early (Pre-Tractatus)', start: 1912, end: 1918, color: '#4A90D9' },
  { name: 'Middle (Transition)', start: 1929, end: 1936, color: '#F5A623' },
  { name: 'Late (PI Era)', start: 1937, end: 1951, color: '#D0021B' },
];

function parseTimelineEntry(text: string): TimelineEntry | null {
  const match = TIMELINE_ENTRY.exec(text);
  if (!match) return null;
  TIMELINE_ENTRY.lastIndex = 0;
  return {
    date: match[1],
    event: match[2].trim(),
    confidence: 0.95,
  };
}

function extractTimeline(content: string, slug: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const timelineSection = content.match(/##\s*Timeline\n([\s\S]*?)(?:\n##|\n---\n|$)/i);
  if (!timelineSection) return [];

  for (const line of timelineSection[1].split('\n')) {
    const entry = parseTimelineEntry(line);
    if (entry) entries.push(entry);
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function detectGaps(entries: TimelineEntry[]): Array<{ start: string; end: string; duration: string }> {
  const gaps: Array<{ start: string; end: string; duration: string }> = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const curr = entries[i].date.replace(/-/g, '').padEnd(8, '01');
    const next = entries[i + 1].date.replace(/-/g, '').padEnd(8, '01');
    const currYear = parseInt(curr.slice(0, 4));
    const nextYear = parseInt(next.slice(0, 4));
    if (nextYear - currYear >= 3) {
      gaps.push({
        start: entries[i].date,
        end: entries[i + 1].date,
        duration: `${nextYear - currYear} years`,
      });
    }
  }
  return gaps;
}

function buildTimeline(content: string, slug: string, title: string): Timeline {
  const entries = extractTimeline(content, slug);

  // Extract period from frontmatter
  const periodMatch = content.match(/^period:\s*\[(\d+),\s*(\d+)\]/m);
  const span = periodMatch
    ? [parseInt(periodMatch[1]), parseInt(periodMatch[2])]
    : null;

  // Extract type
  const typeMatch = content.match(/^type:\s*(.+)$/m);
  const type = typeMatch?.[1] || 'concept';

  return {
    slug,
    title,
    type,
    span,
    entries,
    gaps: detectGaps(entries),
  };
}

async function getAllBrainPages(brainDir: string): Promise<Map<string, string>> {
  const pages = new Map<string, string>();

  async function walk(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue;
          await walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          const slug = entry.name.replace('.md', '');
          pages.set(slug, join(dir, entry.name));
        }
      }
    } catch {
      // skip
    }
  }

  await walk(brainDir);
  return pages;
}

function formatTimeline(timeline: Timeline, format: 'text' | 'json' | 'mermaid'): string {
  if (format === 'json') return JSON.stringify(timeline, null, 2);

  if (format === 'mermaid') {
    const lines = ['gantt', '    title Timeline', '    dateFormat YYYY-MM'];
    for (const entry of timeline.entries) {
      lines.push(`    ${entry.date} :done, ${entry.slug || timeline.slug}, 0d`);
    }
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push(`\n=== ${timeline.title} ===`);
  lines.push(`Type: ${timeline.type} | Span: ${timeline.span ? `${timeline.span[0]}-${timeline.span[1]}` : 'unknown'}`);
  lines.push(`Entries: ${timeline.entries.length}`);

  if (timeline.gaps.length > 0) {
    lines.push(`\nGaps:`);
    for (const gap of timeline.gaps) {
      lines.push(`  ${gap.start} → ${gap.end} (${gap.duration})`);
    }
  }

  lines.push(`\nTimeline:`);
  for (const entry of timeline.entries) {
    lines.push(`  ${entry.date}: ${entry.event}`);
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const brainDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'corpus/wittgenstain/brain/';
  const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
  const all = args.includes('--all');
  const periods = args.includes('--periods');
  const compareSlug = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'text';

  // Try alternate paths
  let actualBrainDir = brainDir;
  try {
    const { readdir: rd } = await import('fs/promises');
    await rd(actualBrainDir);
  } catch {
    actualBrainDir = 'corpus/wittgenstein/brain/';
    try {
      await readdir(actualBrainDir);
    } catch {
      console.error(`Brain directory not found`);
      process.exit(1);
    }
  }

  if (periods) {
    console.log('\n=== Wittgenstein Philosophical Periods ===\n');
    for (const p of PERIODS) {
      console.log(`  ${p.name}: ${p.start}-${p.end}`);
    }
    console.log(`\n  Total span: 1912-1951 (39 years)`);
    console.log(`  Gaps: 1918-1929 (11 years — Wittgenstein left philosophy)\n`);
    return;
  }

  if (all) {
    const pages = await getAllBrainPages(actualBrainDir);
    const timelines: Timeline[] = [];
    let count = 0;

    for (const [slug, path] of pages) {
      const content = await readFile(path, 'utf-8');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1] || slug;
      const typeMatch = content.match(/^type:\s*(.+)$/m);
      const type = typeMatch?.[1] || 'unknown';

      if (typeFilter && type !== typeFilter) continue;

      const timeline = buildTimeline(content, slug, title);
      if (timeline.entries.length > 0) {
        timelines.push(timeline);
        count++;
      }
    }

    console.log(`\n=== All Timelines ===\n`);
    console.log(`Found ${count} pages with timelines\n`);

    if (format === 'json') {
      console.log(JSON.stringify(timelines, null, 2));
      return;
    }

    for (const tl of timelines.sort((a, b) => (a.span?.[0] || 0) - (b.span?.[0] || 0))) {
      console.log(formatTimeline(tl, 'text'));
      console.log();
    }
    return;
  }

  // Single slug
  const slug = args.find(a => !a.startsWith('--'));
  if (!slug) {
    console.error('Usage: wittsrc-timeline.ts [slug] [--type concept|work] [--all] [--periods] [--format text|json|mermaid]');
    process.exit(1);
  }

  const pages = await getAllBrainPages(actualBrainDir);
  const path = pages.get(slug);

  if (!path) {
    // Try partial match
    for (const [s, p] of pages) {
      if (s.includes(slug) || slug.includes(s)) {
        const content = await readFile(p, 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch?.[1] || s;
        const timeline = buildTimeline(content, s, title);
        console.log(formatTimeline(timeline, format as 'text' | 'json' | 'mermaid'));
        return;
      }
    }
    console.error(`Page not found: ${slug}`);
    process.exit(1);
  }

  const content = await readFile(path, 'utf-8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1] || slug;
  const timeline = buildTimeline(content, slug, title);
  console.log(formatTimeline(timeline, format as 'text' | 'json' | 'mermaid'));

  // Comparison mode
  if (compareSlug) {
    const comparePath = pages.get(compareSlug);
    if (comparePath) {
      const c2 = await readFile(comparePath, 'utf-8');
      const c2Title = c2.match(/^#\s+(.+)$/m)?.[1] || compareSlug;
      const t2 = buildTimeline(c2, compareSlug, c2Title);
      console.log('\n---\n');
      console.log(formatTimeline(t2, 'text'));
    }
  }
}

main().catch(console.error);
