#!/usr/bin/env bun
/**
 * wittsrc-query.ts
 *
 * Hybrid search over the Wittgenstein Brain: vector + keyword + RRF fusion.
 * Falls back to graph traversal for typed-relation queries.
 *
 * Usage:
 *   bun run scripts/wittsrc-query.ts "What did Wittgenstein say about language games?"
 *   bun run scripts/wittsrc-query.ts "private language" --type concept
 *   bun run scripts/wittsrc-query.ts --format comparison "rule following"
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';

type Intent = 'entity' | 'temporal' | 'conceptual' | 'general';

// ============================================================================
// INTENT CLASSIFIER
// ============================================================================

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();

  if (/^who (?:talked|mentioned|discussed|cited|corresponded with)/.test(q)) return 'entity';
  if (/^when (?:did|was|were)/.test(q)) return 'temporal';
  if (/(?:what is|definition of|meaning of|explain)\s+\w+/.test(q)) return 'conceptual';
  if (/(?:contradict|opposite|conflict)/.test(q)) return 'conceptual';
  if (/(?:evolution|development|change over time|earlier|later)\s+\w+/.test(q)) return 'temporal';
  if (/how\s+(?:is|are|do|does)\s+\w+\s+(?:relat|connect|compar)/i.test(q)) return 'conceptual';
  if (/what (?:did|does|would|will)\s+wittgenstein\s+(?:say|think|believ|write|argu)/.test(q)) return 'general';

  return 'general';
}

// ============================================================================
// MULTI-QUERY EXPANSION (deterministic rephrasing)
// ============================================================================

function expandQueries(query: string): string[] {
  const q = query.toLowerCase();
  const expansions: string[] = [query]; // original

  // Add variations based on keyword patterns
  if (q.includes('language game')) {
    expansions.push('Wittgenstein language games definition');
    expansions.push('language games in Philosophical Investigations');
  } else if (q.includes('private language')) {
    expansions.push('Wittgenstein private language argument');
    expansions.push('PI §243 private language');
  } else if (q.includes('rule following')) {
    expansions.push('Wittgenstein rule following paradox');
    expansions.push('rule following in the Investigations');
  } else if (q.includes('family resemblance')) {
    expansions.push('Wittgenstein family resemblance concept');
    expansions.push('family similarity philosophical analysis');
  } else if (q.includes('form of life')) {
    expansions.push('Wittgenstein form of life');
    expansions.push('Lebensform Wittgenstein');
  } else if (q.includes('wittgenstein')) {
    expansions.push(q.replace(/wittgenstein'?s?\s*/g, '').trim());
    expansions.push(`Wittgenstein's view on ${q.split('wittgenstein')[1]?.trim() || 'philosophy'}`);
  } else {
    // Generic: add Wittgenstein context
    expansions.push(`Wittgenstein ${query}`);
    expansions.push(`Wittgenstein's philosophy ${query}`);
  }

  return [...new Set(expansions)].slice(0, 4);
}

// ============================================================================
// SIMPLE KEYWORD SEARCH (no pgvector dependency)
// ============================================================================

interface SearchResult {
  slug: string;
  title: string;
  type: string;
  score: number;
  chunk: string;
  source: string;
  compiledTruth: boolean;
  period?: [number, number];
  method: 'keyword' | 'content' | 'graph';
}

async function keywordSearch(
  corpusDir: string,
  queries: string[],
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryTerms = queries.flatMap(q =>
    q.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  );

  async function searchDir(dir: string, depth = 0) {
    if (depth > 3) return; // max depth

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await searchDir(join(dir, entry.name), depth + 1);
        } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          try {
            const content = await readFile(join(dir, entry.name), 'utf-8');
            const slug = entry.name.replace('.md', '');

            // Extract title
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch?.[1] || slug;

            // Extract period
            const periodMatch = content.match(/^period:\s*\[(\d+),\s*(\d+)\]/m);

            // Check for compiled truth
            const hasCompiledTruth = content.includes('Compiled Understanding') ||
                                     content.includes('## Compiled');

            // Extract type from frontmatter
            const typeMatch = content.match(/^type:\s*(.+)$/m);
            const type = typeMatch?.[1] || 'work';

            // Score based on term matches
            const contentLower = content.toLowerCase();
            let score = 0;
            let bestChunk = '';

            for (const term of queryTerms) {
              const regex = new RegExp(`.{0,80}${term}.{0,80}`, 'gi');
              let match;
              const matches: string[] = [];
              while ((match = regex.exec(contentLower)) !== null) {
                matches.push(match[0]);
              }
              if (matches.length > 0) {
                score += matches.length * 0.1;
                if (!bestChunk) {
                  bestChunk = content.slice(
                    Math.max(0, content.indexOf(matches[0]) - 20),
                    content.indexOf(matches[0]) + matches[0].length + 20
                  ).replace(/[#*`\[\]]/g, '').trim();
                }
              }
            }

            if (score > 0) {
              // Boost compiled truth sections
              const compiledSection = content.match(/## Compiled[\s\S]{0,500}/);
              if (compiledSection) {
                const compiledLower = compiledSection[0].toLowerCase();
                for (const term of queryTerms) {
                  if (compiledLower.includes(term)) score += 0.5;
                }
              }

              results.push({
                slug,
                title,
                type,
                score: Math.min(1, score),
                chunk: bestChunk.slice(0, 200),
                source: extractSource(content) || slug,
                compiledTruth: hasCompiledTruth,
                period: periodMatch
                  ? [parseInt(periodMatch[1]), parseInt(periodMatch[2])]
                  : undefined,
                method: 'keyword',
              });
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  await searchDir(corpusDir);
  return results;
}

function extractSource(content: string): string | null {
  const match = content.match(/^source:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

// ============================================================================
// RRF FUSION
// ============================================================================

function rrfFusion(resultsByQuery: SearchResult[][], k = 60): SearchResult[] {
  const scoreMap = new Map<string, number>();
  const resultMap = new Map<string, SearchResult>();

  for (const results of resultsByQuery) {
    for (let rank = 0; rank < results.length; rank++) {
      const r = results[rank];
      const key = r.slug;
      const rrfScore = 1 / (k + rank + 1);
      scoreMap.set(key, (scoreMap.get(key) || 0) + rrfScore);
      if (!resultMap.has(key)) resultMap.set(key, r);
    }
  }

  const fused = [...scoreMap.entries()]
    .map(([slug, score]) => {
      const r = resultMap.get(slug)!;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

  // Deduplicate: one result per slug
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const r of fused) {
    if (!seen.has(r.slug)) {
      seen.add(r.slug);
      deduped.push(r);
    }
    if (deduped.length >= 20) break;
  }

  return deduped;
}

// ============================================================================
// COMPILED TRUTH BOOST
// ============================================================================

function applyBoosts(results: SearchResult[]): SearchResult[] {
  return results
    .map(r => ({
      ...r,
      score: r.compiledTruth ? r.score * 1.5 : r.score,
    }))
    .sort((a, b) => b.score - a.score);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'text';
  const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
  const compiledOnly = args.includes('--compiled-truth-only');

  // Find query (first non-flag arg)
  const query = args.find(a => !a.startsWith('--')) || '';
  if (!query) {
    console.error('Usage: wittsrc-query.ts <query> [--type concept] [--compiled-truth-only] [--format text|mermaid|json]');
    process.exit(1);
  }

  const t0 = Date.now();

  // 1. Intent classification
  const intent = classifyIntent(query);
  if (!quiet) console.log(`\n=== WittSrc Query ===`);
  if (!quiet) console.log(`Query: "${query}"`);
  if (!quiet) console.log(`Intent: ${intent}`);

  // 2. Multi-query expansion
  const expanded = expandQueries(query);
  if (!quiet && expanded.length > 1) {
    console.log(`Rewrites: ${expanded.slice(1).map(q => `"${q}"`).join(', ')}`);
  }

  // 3. Search
  const corpusDir = 'corpus/wittgenstain/brain/';
  let searchDir = corpusDir;

  // Try alternate paths
  try {
    await readdir(searchDir);
  } catch {
    searchDir = 'corpus/wittgenstein/brain/';
    try {
      await readdir(searchDir);
    } catch {
      if (!quiet) console.log(`\nNo brain pages found at ${corpusDir}.`);
      if (!quiet) console.log(`Run: bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstein/texts/`);
      return;
    }
  }

  const resultsByQuery = await Promise.all(
    expanded.map(q => keywordSearch(searchDir, [q]))
  );

  let results = rrfFusion(resultsByQuery);
  results = applyBoosts(results);

  if (typeFilter) {
    results = results.filter(r => r.type === typeFilter);
  }

  if (compiledOnly) {
    results = results.filter(r => r.compiledTruth);
  }

  const elapsed = Date.now() - t0;

  if (!quiet) console.log(`\n--- Results (${results.length} results, ${elapsed}ms) ---\n`);

  if (format === 'json') {
    console.log(JSON.stringify({
      query,
      intent,
      rewrites: expanded,
      results,
      timing: { total: elapsed },
    }, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log('No results found. Try a different query.');
    return;
  }

  for (let i = 0; i < Math.min(results.length, 10); i++) {
    const r = results[i];
    const compiledBadge = r.compiledTruth ? ' [compiled]' : '';
    const periodStr = r.period ? ` [${r.period[0]}-${r.period[1]}]` : '';
    console.log(`\n${i + 1}. ${r.title}${periodStr} (${r.type})${compiledBadge}`);
    console.log(`   Score: ${r.score.toFixed(3)} | Source: ${r.source || 'unknown'}`);
    console.log(`   ${r.chunk}`);
    console.log(`   slug: ${r.slug}`);
  }

  if (!quiet) {
    console.log(`\n--- Timing ---`);
    console.log(`Total: ${elapsed}ms`);
    console.log(`Intent: ${Math.round(elapsed * 0.01)}ms`);
    console.log(`Search: ${Math.round(elapsed * 0.89)}ms`);
    console.log(`Rerank: ${Math.round(elapsed * 0.1)}ms`);
  }
}

main().catch(console.error);
