#!/usr/bin/env node
/**
 * TCM Ancient Texts — RAG Ingestion Pipeline
 *
 * Stage 1: Convert 701 GB18030 files → UTF-8 chunks
 * Stage 2: Generate lightweight semantic keywords via DeepSeek
 * Stage 3: Persist to JSON BM25-style vector store
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/ingest-tcm-corpus.js
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/ingest-tcm-corpus.js --skip-embed  (skip API calls, just chunk)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, '../corpus/tcm-external/TCM-Ancient-Books');
const OUTPUT_DIR = path.join(__dirname, '../data/tcm-rag');
const VECTOR_STORE = path.join(OUTPUT_DIR, 'vectors.json');
const CHUNK_META = path.join(OUTPUT_DIR, 'chunk-meta.json');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 100;

const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function callDeepSeekSync(messages, temperature = 0.3, maxTokens = 150) {
  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Parse error: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function extractKeywords(text) {
  if (!API_KEY) return { keywords: '', preview: text.slice(0, 80) };
  try {
    const response = await callDeepSeekSync([
      {
        role: 'system',
        content: '你是中医古籍文本分析助手。请为此文本生成3-5个简短中文关键词（逗号分隔），聚焦于：病名、药名、治法原则、经典名称、中医概念。只返回关键词，不要其他内容。',
      },
      { role: 'user', content: text.slice(0, 300) },
    ]);
    return {
      keywords: response.choices[0].message.content.trim(),
      preview: text.slice(0, 80),
    };
  } catch {
    return { keywords: '', preview: text.slice(0, 80) };
  }
}

function chunkText(text, source, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (para.trim().length < 10) continue;
    if (buffer.length + para.length > chunkSize) {
      if (buffer.trim()) {
        chunks.push({ source, text: buffer.trim(), charCount: buffer.trim().length });
      }
      buffer = buffer.slice(-overlap) + '\n' + para;
    } else {
      buffer += '\n' + para;
    }
  }
  if (buffer.trim()) {
    chunks.push({ source, text: buffer.trim(), charCount: buffer.trim().length });
  }
  return chunks;
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────────

async function main() {
  const skipEmbed = process.argv.includes('--skip-embed');

  console.log('=== TCM Ancient Texts RAG Ingestion Pipeline ===');
  console.log(`API Key: ${API_KEY ? '✓ set' : '✗ MISSING (skipping embed)'}`);
  console.log(`Corpus:  ${CORPUS_DIR}`);
  console.log(`Output:  ${OUTPUT_DIR}`);
  console.log('');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Stage 1: Discover files ─────────────────────────────────────────────────
  console.log('[1/4] Scanning files...');
  const files = fs.readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ name: f, path: path.join(CORPUS_DIR, f) }))
    .filter((f) => {
      try {
        return fs.statSync(f.path).size > 100;
      } catch {
        return false;
      }
    });

  console.log(`  Found ${files.length} text files`);
  console.log('');

  // ── Stage 2: Convert + Chunk ───────────────────────────────────────────────
  console.log('[2/4] Converting GB18030 → UTF-8 and chunking...');
  const allChunks = [];
  const manifest = [];
  let fileCount = 0;

  for (const file of files) {
    try {
      const rawBuf = execSync(`iconv -f GB18030 -t UTF-8 "${file.path}" 2>/dev/null`, {
        encoding: null,
        maxBuffer: 100 * 1024 * 1024,
        timeout: 30000,
      });
      const content = Buffer.isBuffer(rawBuf) ? rawBuf.toString('utf8') : rawBuf;
      const baseName = file.name.replace(/\.txt$/, '');
      const chunks = chunkText(content, baseName);
      const startIdx = allChunks.length;

      chunks.forEach((chunk, i) => {
        allChunks.push({
          ...chunk,
          chunkId: `chunk_${startIdx + i}`,
          sourceId: baseName,
        });
      });

      manifest.push({
        sourceId: baseName,
        fileName: file.name,
        originalSize: fs.statSync(file.path).size,
        chunkCount: chunks.length,
        totalChars: chunks.reduce((s, c) => s + c.charCount, 0),
        status: 'chunked',
      });

      fileCount++;
      if (fileCount % 100 === 0) {
        process.stdout.write(`  Processed ${fileCount}/${files.length} files → ${allChunks.length} chunks\n`);
      }
    } catch (e) {
      manifest.push({
        sourceId: file.name.replace(/\.txt$/, ''),
        fileName: file.name,
        status: 'error',
        error: String(e.message).slice(0, 120),
      });
    }
  }

  console.log(`  ✓ ${fileCount} files → ${allChunks.length} chunks`);
  console.log('');

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  // ── Stage 3: Keyword extraction ──────────────────────────────────────────────
  if (!skipEmbed && API_KEY) {
    console.log('[3/4] Generating semantic keywords via DeepSeek...');
    const BATCH = 20;
    for (let i = 0; i < allChunks.length; i += BATCH) {
      const batch = allChunks.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (chunk) => {
          const result = await extractKeywords(chunk.text);
          chunk.keywords = result.keywords;
          chunk.preview = result.preview;
        })
      );
      process.stdout.write(`  Keywords: ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}\n`);
      if (i + BATCH < allChunks.length) await sleep(300);
    }
    console.log(`  ✓ Keywords generated for ${allChunks.length} chunks`);
  } else {
    console.log('[3/4] Skipping keyword extraction (--skip-embed or no API key)');
    allChunks.forEach((c) => {
      c.keywords = '';
      c.preview = c.text.slice(0, 80);
    });
  }
  console.log('');

  // ── Stage 4: Persist ────────────────────────────────────────────────────────
  console.log('[4/4] Persisting vector store...');

  const vectorStore = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    totalChunks: allChunks.length,
    totalSources: manifest.filter((m) => m.status === 'chunked').length,
    chunks: allChunks,
  };

  fs.writeFileSync(VECTOR_STORE, JSON.stringify(vectorStore, null, 2));

  const chunkMeta = allChunks.map(({ text: _t, ...meta }) => meta);
  fs.writeFileSync(CHUNK_META, JSON.stringify(chunkMeta, null, 2));

  const storeMB = (fs.statSync(VECTOR_STORE).size / 1024 / 1024).toFixed(1);
  const metaMB = (fs.statSync(CHUNK_META).size / 1024 / 1024).toFixed(1);

  console.log('');
  console.log('=== Pipeline Complete ===');
  console.log(`  Sources:  ${manifest.filter((m) => m.status === 'chunked').length} / ${files.length}`);
  console.log(`  Chunks:   ${allChunks.length}`);
  console.log(`  vectors.json:   ${storeMB} MB`);
  console.log(`  chunk-meta.json: ${metaMB} MB`);
  console.log(`  manifest.json:   ready`);
  console.log('');
  console.log('Ready for RAG retrieval!');
}

main().catch((e) => {
  console.error('Pipeline failed:', e);
  process.exit(1);
});
