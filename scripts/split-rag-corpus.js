#!/usr/bin/env node
/**
 * Split RAG corpus into per-source files for Vercel deployment.
 *
 * Reads the full vectors.json (356MB) and splits into:
 *   data/tcm-rag/sources/{sourceId}.json   — chunks for one source
 *   data/tcm-rag/chunk-meta.json          — lightweight metadata (already exists)
 *
 * This enables:
 *   1. Lazy loading — only load sources being queried
 *   2. Vercel compatible — each source is <5MB, well under serverless limits
 *   3. Fast cold starts — no 356MB file to parse
 *
 * Usage: node scripts/split-rag-corpus.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/tcm-rag');
const VECTOR_STORE = path.join(DATA_DIR, 'vectors.json');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');

function main() {
  console.log('=== RAG Corpus Splitter ===\n');

  if (!fs.existsSync(VECTOR_STORE)) {
    console.error('vectors.json not found.');
    process.exit(1);
  }

  // Create sources directory
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
    console.log('Created:', SOURCES_DIR);
  }

  // Load vectors
  console.log('Loading vectors.json...');
  const { chunks, totalChunks, totalSources, createdAt } = JSON.parse(
    fs.readFileSync(VECTOR_STORE, 'utf8')
  );
  console.log(`  Total chunks: ${totalChunks}\n`);

  // Group by sourceId
  const bySource = {};
  for (const chunk of chunks) {
    const key = chunk.sourceId;
    if (!bySource[key]) {
      bySource[key] = [];
    }
    bySource[key].push(chunk);
  }

  const sourceIds = Object.keys(bySource).sort();
  console.log(`Sources to write: ${sourceIds.length}\n`);

  // Write each source file
  let written = 0;
  let skipped = 0;
  for (const sourceId of sourceIds) {
    const sourceChunks = bySource[sourceId];
    const outPath = path.join(SOURCES_DIR, `${sourceId}.json`);

    // Skip if already exists and same count (already split)
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (existing.length === sourceChunks.length) {
        skipped++;
        continue;
      }
    }

    fs.writeFileSync(outPath, JSON.stringify(sourceChunks));
    written++;
    process.stdout.write(`\r  ${written}/${sourceIds.length} written, ${skipped} skipped`);
  }

  console.log(`\n\nDone!`);
  console.log(`  Written: ${written} source files`);
  console.log(`  Skipped: ${skipped} source files (already up-to-date)`);
  console.log(`  Total size: ${(fs.statSync(SOURCES_DIR).size / 1024 / 1024).toFixed(1)} MB`);

  // List largest sources
  const sizes = sourceIds.map(id => ({
    id,
    size: fs.statSync(path.join(SOURCES_DIR, `${id}.json`)).size
  })).sort((a, b) => b.size - a.size).slice(0, 5);
  console.log(`\nLargest sources:`);
  for (const s of sizes) {
    console.log(`  ${s.id}: ${(s.size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
