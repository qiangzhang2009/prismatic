#!/usr/bin/env bun
/**
 * wittsrc-brain-import.ts
 *
 * Import Wittgenstein corpus files into Brain Pages.
 * Routes files by type, chunks content, generates metadata.
 *
 * Usage:
 *   bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstein/texts/
 *   bun run scripts/wittsrc-brain-import.ts --dry-run
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, basename, dirname } from 'path';
import { createHash } from 'crypto';

interface Chunk {
  slug: string;
  chunkIndex: number;
  content: string;
  wordCount: number;
  hash: string;
}

interface BrainPage {
  type: 'work' | 'concept' | 'person' | 'timeline';
  title: string;
  titleFull?: string;
  slug: string;
  source: string;
  sourceUrl?: string;
  collection?: string;
  period?: [number, number];
  wordCount: number;
  encoding: string;
  chunks: Chunk[];
  importDate: string;
}

const CHUNK_SIZE = 512; // tokens approximate
const CHUNK_OVERLAP = 64;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content.slice(0, 5000)).digest('hex').slice(0, 12);
}

function classifyFile(filename: string): { type: 'work' | 'concept' | 'person' | 'timeline'; subtype: string } {
  const lower = filename.toLowerCase();

  // Clarino CC manuscripts → work
  if (lower.includes('clarino-cc')) return { type: 'work', subtype: 'clarino' };

  // WittSrc manuscripts → work
  if (lower.includes('wittsrg') || lower.includes('wittsrc')) return { type: 'work', subtype: 'wittsrg' };

  // WAB XML → work
  if (lower.includes('wab_xml') || lower.endsWith('.xml')) return { type: 'work', subtype: 'wab' };

  // SEP articles → concept
  if (lower.startsWith('sep-')) return { type: 'concept', subtype: 'sep' };

  // IEP articles → concept
  if (lower.startsWith('iep-')) return { type: 'concept', subtype: 'iep' };

  // Public domain works → work
  if (lower.includes('tractatus')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('philosophical-investigations')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('notebooks')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('bluebook') || lower.includes('brownbook')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('zettel')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('remarks-foundations') || lower.includes('philosophical-remarks')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('culture-value') || lower.includes('culture_and_value')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('lectures')) return { type: 'work', subtype: 'gutenberg' };
  if (lower.includes('letters')) return { type: 'work', subtype: 'gutenberg' };

  // Default: concept
  return { type: 'concept', subtype: 'mixed' };
}

function extractPeriod(filename: string, content: string): [number, number] | null {
  const periodRanges: Record<string, [number, number]> = {
    'ms-101': [1908, 1911], 'ms-102': [1908, 1911], 'ms-103': [1908, 1911],
    'ms-104': [1908, 1911], 'ms-105': [1912, 1913], 'ms-106': [1912, 1913],
    'ms-107': [1912, 1913], 'ms-108': [1912, 1913], 'ms-109': [1912, 1913],
    'ms-110': [1912, 1913], 'ms-111': [1912, 1913], 'ms-112': [1913, 1914],
    'ms-113': [1913, 1914], 'ms-114': [1914, 1916], 'ms-115': [1912, 1914],
    'ms-139a': [1913, 1914],
    'ms-148': [1930, 1931], 'ms-149': [1930, 1931], 'ms-150': [1930, 1931],
    'ms-152': [1930, 1934], 'ms-153a': [1930, 1932], 'ms-153b': [1932, 1934],
    'ms-154': [1931, 1933], 'ms-155': [1931, 1933], 'ms-156a': [1931, 1933],
    'ts-207': [1929, 1931], 'ts-212': [1937, 1938], 'ts-213': [1937, 1938],
    'ts-310': [1930, 1947],
    'tractatus': [1914, 1918],
    'philosophical-investigations': [1938, 1951],
    'pr': [1929, 1930],
    'zettel': [1933, 1945],
    'oc': [1950, 1951],
    'bluebook': [1933, 1934],
    'brownbook': [1934, 1935],
    'notebooks': [1914, 1916],
  };

  const base = basename(filename, '.txt').replace(/(_WittSrc|_Clarino-CC|_Normalized)?$/i, '');
  for (const [key, range] of Object.entries(periodRanges)) {
    if (base.toLowerCase().includes(key)) return range;
  }
  return null;
}

function extractTitle(filename: string, content: string): { title: string; titleFull?: string } {
  // Try frontmatter first
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) return { title: titleMatch[1].trim() };
  }

  // Fallback to filename
  const base = basename(filename, '.txt')
    .replace(/_Clarino-CC$/i, '')
    .replace(/_WittSrc.*$/i, '')
    .replace(/_Normalized$/i, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
  return { title: base };
}

function chunkContent(content: string, chunkSize: number, overlap: number): string[] {
  // Simple word-based chunking (512 words per chunk)
  const words = content.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length > 50) { // skip very short chunks
      chunks.push(chunkWords.join(' '));
    }
    if (i + chunkSize >= words.length) break;
  }

  return chunks.length > 0 ? chunks : [content.slice(0, 5000)];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildBrainPage(filename: string, content: string, classification: { type: string; subtype: string }, chunks: Chunk[]): string {
  const { title } = extractTitle(filename, content);
  const base = basename(filename, '.txt')
    .replace(/_Clarino-CC$/i, '')
    .replace(/_WittSrc.*$/i, '')
    .replace(/_Normalized$/i, '');
  const slug = slugify(base);
  const period = extractPeriod(filename, content);
  const wordCount = countWords(content);

  let source = 'Unknown';
  let sourceUrl = '';
  let collection = '';

  if (classification.subtype === 'clarino') {
    source = 'CLARINO/WAB CC BY-NC 3.0';
    sourceUrl = 'https://repo.clarino.uib.no/xmlui/handle/11509/143';
    collection = 'WAB manuscripts';
  } else if (classification.subtype === 'wittsrg') {
    source = 'Wittgenstein Source BNE';
    sourceUrl = 'http://www.wittgensteinsource.org/';
    collection = 'Bergen Nachlass Edition';
  } else if (classification.subtype === 'sep') {
    source = 'Stanford Encyclopedia of Philosophy';
    sourceUrl = 'https://plato.stanford.edu/';
  } else if (classification.subtype === 'iep') {
    source = 'Internet Encyclopedia of Philosophy';
    sourceUrl = 'https://www.iep.utm.edu/';
  } else if (classification.subtype === 'gutenberg') {
    source = 'Project Gutenberg / Internet Archive';
    sourceUrl = 'https://www.gutenberg.org/';
  }

  const yaml = [
    '---',
    `type: ${classification.type}`,
    `title: ${title}`,
    `slug: ${classification.type === 'work' ? `work-${slug}` : classification.type === 'concept' ? `concept-${slug}` : slug}`,
    period ? `period: [${period[0]}, ${period[1]}]` : null,
    `source: ${source}`,
    sourceUrl ? `sourceUrl: "${sourceUrl}"` : null,
    collection ? `collection: ${collection}` : null,
    `wordCount: ${wordCount}`,
    `encoding: ${classification.subtype}`,
    `importedAt: ${new Date().toISOString().split('T')[0]}`,
    '---',
  ].filter(Boolean).join('\n');

  // Strip frontmatter and markdown headers for body
  let body = content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/^#.*$/gm, '')
    .replace(/^\s*[-=*]{3,}\s*$/gm, '')
    .trim();

  // Add compiled truth section
  const compiledTruthSection = `\n\n## Compiled Understanding\n\n${title}. `;

  return `${yaml}\n\n# ${title}\n\n${compiledTruthSection}\n${body}`;
}

async function getExistingHashes(outputDir: string): Promise<Set<string>> {
  const hashes = new Set<string>();
  try {
    const files = await readdir(outputDir);
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const meta = JSON.parse(await readFile(join(outputDir, file), 'utf-8'));
        if (meta.hash) hashes.add(meta.hash);
      }
    }
  } catch {
    // no existing files
  }
  return hashes;
}

async function importFiles(
  corpusDir: string,
  outputDir: string,
  dryRun: boolean,
  existingHashes: Set<string>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.txt') || entry.name.endsWith('.xml')) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const hash = hashContent(content);

          if (existingHashes.has(hash)) {
            if (!dryRun) { /* idempotent skip */ }
            results.skipped++;
            continue;
          }

          const classification = classifyFile(entry.name);
          const chunks = chunkContent(content, CHUNK_SIZE, CHUNK_OVERLAP)
            .map((text, i) => ({
              slug: slugify(basename(entry.name, '.txt')),
              chunkIndex: i,
              content: text,
              wordCount: countWords(text),
              hash,
            }));

          const baseSlug = slugify(basename(entry.name, '.txt').replace(/(_WittSrc|_Clarino-CC|_Normalized)?$/i, ''));
          const typeDir = join(outputDir, `${classification.type}s`);
          const outFile = join(typeDir, `${baseSlug}.md`);
          const metaFile = join(typeDir, `${baseSlug}.meta.json`);

          if (dryRun) {
            console.log(`  [DRY] ${relative(corpusDir, fullPath)} → ${relative(outputDir, outFile)}`);
            results.imported++;
            continue;
          }

          await mkdir(typeDir, { recursive: true });

          const pageContent = buildBrainPage(entry.name, content, classification, chunks);
          await writeFile(outFile, pageContent, 'utf-8');
          await writeFile(metaFile, JSON.stringify({
            hash,
            wordCount: countWords(content),
            chunkCount: chunks.length,
            classification,
            importedAt: new Date().toISOString(),
            originalPath: relative(corpusDir, fullPath),
          }, null, 2), 'utf-8');

          console.log(`  Imported: ${relative(corpusDir, fullPath)} (${countWords(content)} words, ${chunks.length} chunks)`);
          results.imported++;
        } catch (err) {
          results.errors.push(`${relative(corpusDir, fullPath)}: ${err}`);
        }
      }
    }
  }

  await walk(corpusDir);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const corpusDir = args[args.indexOf('--corpus') + 1] || 'corpus/wittgenstein/texts/';
  const outputDir = args[args.indexOf('--output') + 1] || 'corpus/wittgenstein/brain/';
  const dryRun = args.includes('--dry-run');
  const quiet = args.includes('--quiet');

  if (!existsSync(corpusDir)) {
    console.error(`Corpus directory does not exist: ${corpusDir}`);
    process.exit(1);
  }

  console.log(`\n=== WittSrc Brain Import ===`);
  console.log(`Source: ${corpusDir}`);
  console.log(`Output: ${outputDir}`);
  if (dryRun) console.log(`Mode: DRY RUN (no files will be written)\n`);

  const existingHashes = await getExistingHashes(outputDir);
  if (existingHashes.size > 0 && !quiet) {
    console.log(`Found ${existingHashes.size} existing files (will skip duplicates)\n`);
  }

  const results = await importFiles(corpusDir, outputDir, dryRun, existingHashes);

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${results.imported}`);
  console.log(`Skipped (duplicate): ${results.skipped}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
    for (const err of results.errors) console.log(`  ${err}`);
  }

  // Generate stats
  let totalWords = 0;
  let totalChunks = 0;
  try {
    await (async () => {
      const stats: Record<string, { files: number; words: number; chunks: number }> = {};
      for (const type of ['works', 'concepts', 'people', 'timelines']) {
        const typeDir = join(outputDir, type);
        if (existsSync(typeDir)) {
          const files = await readdir(typeDir);
          let words = 0, chunks = 0;
          for (const file of files.filter(f => f.endsWith('.meta.json'))) {
            const meta = JSON.parse(await readFile(join(typeDir, file), 'utf-8'));
            words += meta.wordCount || 0;
            chunks += meta.chunkCount || 0;
          }
          stats[type] = { files: files.filter(f => f.endsWith('.md')).length, words, chunks };
          totalWords += words;
          totalChunks += chunks;
        }
      }
      if (!quiet) {
        console.log(`\n=== Stats ===`);
        for (const [type, s] of Object.entries(stats)) {
          console.log(`  ${type}: ${s.files} pages, ${s.words.toLocaleString()} words, ${s.chunks} chunks`);
        }
        console.log(`  TOTAL: ${totalWords.toLocaleString()} words, ${totalChunks} chunks`);
      }
    })();
  } catch {
    // stats generation optional
  }
}

main().catch(console.error);
