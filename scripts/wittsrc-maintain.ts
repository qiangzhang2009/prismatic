#!/usr/bin/env bun
/**
 * wittsrc-maintain.ts
 *
 * Brain health checks: orphans, dead links, stale pages,
 * citation audit, tag consistency.
 *
 * Usage:
 *   bun run scripts/wittsrc-maintain.ts --check
 *   bun run scripts/wittsrc-maintain.ts --check --json
 *   bun run scripts/wittsrc-maintain.ts --fix dead-links
 *   bun run scripts/wittsrc-maintain.ts --report --since 2026-04-01
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

interface HealthReport {
  checkedAt: string;
  totalPages: number;
  orphans: { count: number; pages: string[]; severity: string };
  deadLinks: { count: number; links: Array<{ from: string; target: string; type: string }>; severity: string };
  stalePages: { count: number; pages: string[]; severity: string };
  brokenCitations: { count: number; pages: string[]; severity: string };
  tagIssues: { count: number; pages: Array<{ slug: string; issues: string[] }>; severity: string };
  overall: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

async function getAllSlugs(brainDir: string): Promise<Map<string, string>> {
  const slugToPath = new Map<string, string>();

  async function walk(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue;
          await walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          const slug = entry.name.replace('.md', '');
          slugToPath.set(slug, join(dir, entry.name));
        }
      }
    } catch {
      // skip
    }
  }

  await walk(brainDir);
  return slugToPath;
}

async function loadGraph(linksDir: string): Promise<{ nodes: Array<{ slug: string }>; edges: Array<{ from: string; to: string; type: string }> }> {
  try {
    const content = await readFile(join(linksDir, 'graph.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { nodes: [], edges: [] };
  }
}

function extractWikiLinks(content: string): string[] {
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  // Also match markdown links
  const mdPattern = /\[([^\]]+)\]\([^)]+\)/g;
  while ((match = mdPattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.includes('/')) {
      links.push(text.split('/').pop() || text);
    }
  }
  return links;
}

function extractFrontmatterTags(content: string): string[] {
  const match = content.match(/^---\n([\s\S]*?)\n---/m);
  if (!match) return [];
  const fmMatch = match[1].match(/^tags:\s*\[(.*?)\]/m);
  if (!fmMatch) return [];
  return fmMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
}

function checkTagIssues(tags: string[], slug: string): string[] {
  const issues: string[] = [];
  for (const tag of tags) {
    if (tag !== tag.toLowerCase()) issues.push(`Tag not lowercase: "${tag}"`);
    if (tag.includes('_')) issues.push(`Tag uses underscore instead of hyphen: "${tag}"`);
    if (/period|year|date/i.test(tag)) issues.push(`Tag "${tag}" should be in frontmatter period field`);
  }
  // Check duplicate tags
  const seen = new Set<string>();
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) issues.push(`Duplicate tag: "${tag}"`);
    seen.add(lower);
  }
  return issues;
}

// ============================================================================
// CHECKS
// ============================================================================

async function checkOrphans(graph: { nodes: Array<{ slug: string }>; edges: Array<{ from: string; to: string }> }, slugToPath: Map<string, string>): Promise<string[]> {
  const linkedSlugs = new Set<string>();
  for (const edge of graph.edges) {
    linkedSlugs.add(edge.from);
    linkedSlugs.add(edge.to);
  }

  // Orphan = has no inbound AND no outbound edges, AND is a core type
  const orphans: string[] = [];
  for (const [slug] of slugToPath) {
    if (!linkedSlugs.has(slug)) {
      // Check if it's a SEP/IEP page (these are normally orphans)
      if (/^sep-|^iep-/.test(slug)) continue;
      orphans.push(slug);
    }
  }
  return orphans;
}

async function checkDeadLinks(slugToPath: Map<string, string>, linksDir: string): Promise<Array<{ from: string; target: string; type: string }>> {
  const deadLinks: Array<{ from: string; target: string; type: string }> = [];

  for (const [slug, path] of slugToPath) {
    try {
      const content = await readFile(path, 'utf-8');
      const links = extractWikiLinks(content);
      for (const target of links) {
        const normalizedTarget = target.replace(/^work-|^concept-|^person-/, '').toLowerCase();
        if (!slugToPath.has(target) && !slugToPath.has(normalizedTarget)) {
          // Check if it's an external reference
          if (!/^(https?:|www\.)/.test(target)) {
            deadLinks.push({ from: slug, target, type: 'wiki-link' });
          }
        }
      }
    } catch {
      // skip
    }
  }

  return deadLinks;
}

async function checkStalePages(slugToPath: Map<string, string>, days = 90): Promise<string[]> {
  const stale: string[] = [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  for (const [slug, path] of slugToPath) {
    try {
      const mtime = (await stat(path)).mtimeMs;
      if (mtime < cutoff) stale.push(slug);
    } catch {
      // skip
    }
  }

  return stale;
}

async function checkCitations(brainDir: string): Promise<string[]> {
  const broken: string[] = [];
  const validSources = new Set([
    'Wittgenstein Source BNE',
    'CLARINO/WAB',
    'Project Gutenberg',
    'Stanford Encyclopedia of Philosophy',
    'Internet Encyclopedia of Philosophy',
  ]);

  async function walk(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          const content = await readFile(join(dir, entry.name), 'utf-8');
          const match = content.match(/^source:\s*(.+)$/m);
          if (match) {
            const source = match[1].trim();
            if (!validSources.has(source) && !source.startsWith('http')) {
              broken.push(`${entry.name}: unknown source "${source}"`);
            }
          }
        }
      }
    } catch {
      // skip
    }
  }

  await walk(brainDir);
  return broken;
}

async function checkTags(brainDir: string): Promise<Array<{ slug: string; issues: string[] }>> {
  const allIssues: Array<{ slug: string; issues: string[] }> = [];

  async function walk(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          const content = await readFile(join(dir, entry.name), 'utf-8');
          const tags = extractFrontmatterTags(content);
          const issues = checkTagIssues(tags, entry.name);
          if (issues.length > 0) {
            allIssues.push({ slug: entry.name, issues });
          }
        }
      }
    } catch {
      // skip
    }
  }

  await walk(brainDir);
  return allIssues;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const brainDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'corpus/wittgenstain/brain/';
  const linksDir = join(brainDir, '.links');
  const jsonOutput = args.includes('--json');
  const fix = args.includes('--fix');
  const report = args.includes('--report');

  // Try alternate path
  let actualBrainDir = brainDir;
  if (!existsSync(actualBrainDir)) {
    actualBrainDir = 'corpus/wittgenstein/brain/';
    if (!existsSync(actualBrainDir)) {
      console.error(`Brain directory not found: ${brainDir}`);
      process.exit(1);
    }
  }

  console.log(`\n=== WittSrc Brain Maintain ===`);
  console.log(`Brain: ${actualBrainDir}`);

  const slugToPath = await getAllSlugs(actualBrainDir);
  const graph = await loadGraph(linksDir);

  console.log(`Pages: ${slugToPath.size}`);

  // Run all checks
  const [orphans, deadLinks, stalePages, brokenCitations, tagIssues] = await Promise.all([
    checkOrphans(graph, slugToPath),
    checkDeadLinks(slugToPath, linksDir),
    checkStalePages(slugToPath),
    checkCitations(actualBrainDir),
    checkTags(actualBrainDir),
  ]);

  const report_: HealthReport = {
    checkedAt: new Date().toISOString(),
    totalPages: slugToPath.size,
    orphans: { count: orphans.length, pages: orphans.slice(0, 10), severity: orphans.length > 5 ? 'warning' : 'ok' },
    deadLinks: { count: deadLinks.length, links: deadLinks.slice(0, 20), severity: deadLinks.length > 0 ? 'error' : 'ok' },
    stalePages: { count: stalePages.length, pages: stalePages.slice(0, 10), severity: stalePages.length > 0 ? 'info' : 'ok' },
    brokenCitations: { count: brokenCitations.length, pages: brokenCitations.slice(0, 10), severity: brokenCitations.length > 0 ? 'warning' : 'ok' },
    tagIssues: { count: tagIssues.length, pages: tagIssues.slice(0, 10), severity: tagIssues.length > 0 ? 'warning' : 'ok' },
    overall: 'healthy',
  };

  // Determine overall
  if (report_.deadLinks.severity === 'error') report_.overall = 'unhealthy';
  else if (report_.orphans.severity === 'warning' || report_.tagIssues.severity === 'warning') report_.overall = 'warning';
  else report_.overall = 'healthy';

  if (jsonOutput) {
    console.log(JSON.stringify(report_, null, 2));
    process.exit(report_.overall === 'unhealthy' ? 2 : report_.overall === 'warning' ? 1 : 0);
    return;
  }

  console.log(`\n--- Health Report ---\n`);
  console.log(`Overall: ${report_.overall}`);
  console.log(`Pages: ${report_.totalPages}`);

  if (report_.orphans.count > 0) {
    console.log(`\nOrphans (${report_.orphans.count}): ${report_.orphans.pages.join(', ')}${report_.orphans.count > 10 ? '...' : ''}`);
  } else {
    console.log(`\nOrphans: 0`);
  }

  if (report_.deadLinks.count > 0) {
    console.log(`\nDead Links (${report_.deadLinks.count}):`);
    for (const dl of report_.deadLinks.links.slice(0, 5)) {
      console.log(`  ${dl.from} → "${dl.target}"`);
    }
    if (report_.deadLinks.count > 5) console.log(`  ... and ${report_.deadLinks.count - 5} more`);
  } else {
    console.log(`\nDead Links: 0`);
  }

  if (report_.stalePages.count > 0) {
    console.log(`\nStale Pages (${report_.stalePages.count}): ${report_.stalePages.pages.join(', ')}${report_.stalePages.count > 10 ? '...' : ''}`);
  }

  if (report_.tagIssues.count > 0) {
    console.log(`\nTag Issues (${report_.tagIssues.count}):`);
    for (const ti of report_.tagIssues.pages.slice(0, 5)) {
      console.log(`  ${ti.slug}: ${ti.issues.join(', ')}`);
    }
  }

  console.log(`\nChecked at: ${report_.checkedAt}`);
  process.exit(report_.overall === 'unhealthy' ? 2 : report_.overall === 'warning' ? 1 : 0);
}

main().catch(console.error);
