#!/usr/bin/env node
/**
 * TCM Keyword Extraction — resumes from where ingest-tcm-corpus.js left off
 * Reads vectors.json (without keywords), calls DeepSeek for each chunk,
 * and writes updated vectors.json + chunk-meta.json
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/extract-keywords.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/tcm-rag');
const VECTOR_STORE = path.join(DATA_DIR, 'vectors.json');
const CHUNK_META = path.join(DATA_DIR, 'chunk-meta.json');
const CHECKPOINT = path.join(DATA_DIR, 'kw-checkpoint.json');

const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function callDeepSeek(messages, maxTokens = 150) {
  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages,
    temperature: 0.3,
    max_tokens: maxTokens,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json.choices[0].message.content.trim());
        } catch { reject(new Error(`Parse: ${body.slice(0, 100)}`)); }
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
    const result = await callDeepSeek([
      {
        role: 'system',
        content: '你是中医古籍文本分析助手。请为此文本生成3-5个简短中文关键词（逗号分隔），聚焦于：病名、药名、治法原则、经典名称、中医概念。只返回关键词，不要其他内容。',
      },
      { role: 'user', content: text.slice(0, 300) },
    ]);
    return { keywords: result, preview: text.slice(0, 80) };
  } catch (e) {
    return { keywords: '', preview: text.slice(0, 80) };
  }
}

async function main() {
  console.log('=== TCM Keyword Extraction ===');

  if (!fs.existsSync(VECTOR_STORE)) {
    console.error('vectors.json not found. Run ingest-tcm-corpus.js first.');
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(VECTOR_STORE, 'utf8'));
  const total = store.chunks.length;

  // Load checkpoint — resume from last saved position
  let checkpoint = {};
  if (fs.existsSync(CHECKPOINT)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  }

  const done = store.chunks.filter(c => c.keywords && c.keywords.length > 0).length;
  const toProcess = store.chunks.filter(c => !c.keywords || c.keywords.length === 0);

  console.log(`Total chunks: ${total}`);
  console.log(`Already done: ${done}`);
  console.log(`Remaining: ${toProcess.length}`);
  console.log(`Checkpoint entries: ${Object.keys(checkpoint).length}`);
  console.log('');

  if (toProcess.length === 0) {
    console.log('All keywords extracted!');
    return;
  }

  let count = 0;
  let lastCheckpointWrite = 0;
  const CHECKPOINT_EVERY = 500;
  const META_UPDATE_EVERY = 2000;

  for (let i = 0; i < store.chunks.length; i++) {
    const chunk = store.chunks[i];
    const chunkKey = `chunk_${i}`;
    if (chunk.keywords && chunk.keywords.length > 0) continue;
    if (checkpoint[chunkKey]) {
      chunk.keywords = checkpoint[chunkKey];
      chunk.preview = chunk.text.slice(0, 80);
      continue;
    }

    const result = await extractKeywords(chunk.text);
    chunk.keywords = result.keywords;
    chunk.preview = result.preview;
    checkpoint[chunkKey] = result.keywords;
    count++;

    if (count % 100 === 0 || count === toProcess.length) {
      const pct = ((done + count) / total * 100).toFixed(1);
      process.stdout.write(`\r  Progress: ${done + count}/${total} (${pct}%) — ${count} new keywords`);
    }

    // Checkpoint to disk every N chunks (fast, just JSON object)
    if (count - lastCheckpointWrite >= CHECKPOINT_EVERY) {
      fs.writeFileSync(CHECKPOINT, JSON.stringify(checkpoint));
      lastCheckpointWrite = count;
    }

    // Update chunk-meta.json every M chunks (slower, but keeps preview data fresh)
    if (count % META_UPDATE_EVERY === 0) {
      const meta = store.chunks.map(({ text: _t, ...c }) => c);
      fs.writeFileSync(CHUNK_META, JSON.stringify(meta, null, 2));
      const metaMB = (fs.statSync(CHUNK_META).size / 1024 / 1024).toFixed(1);
      process.stdout.write(` [meta saved: ${metaMB} MB]`);
    }

    if (i < store.chunks.length - 1) await sleep(250);
  }

  // Final saves
  fs.writeFileSync(CHECKPOINT, JSON.stringify(checkpoint));
  const meta = store.chunks.map(({ text: _t, ...c }) => c);
  fs.writeFileSync(CHUNK_META, JSON.stringify(meta, null, 2));

  console.log(`\n\n=== Complete ===`);
  console.log(`  Total processed: ${count}`);
  console.log(`  vectors.json: ${(fs.statSync(VECTOR_STORE).size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  chunk-meta.json: ${(fs.statSync(CHUNK_META).size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  checkpoint: ${(fs.statSync(CHECKPOINT).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
