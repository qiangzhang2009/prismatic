#!/usr/bin/env node
/**
 * Prismatic — Corpus Collection Script
 * 为缺失语料的 persona 采集文本语料。
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = join(process.cwd());
const CORPUS_ROOT = join(__dirname, 'corpus');

const C = {
  r: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};
const ok = t => console.log(`${C.green}✓${C.r} ${t}`);
const warn = t => console.log(`${C.yellow}⚠${C.r} ${t}`);
const err = t => console.log(`${C.red}✗${C.r} ${t}`);

function stripHtml(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<meta[^>]*>/gi, ' ')
    .replace(/<link[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text;
}

async function fetchText(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh;q=0.8',
        'Connection': 'keep-alive',
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    return stripHtml(html);
  } catch (_e) {
    clearTimeout(timer);
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function collectPersona(slug, config) {
  console.log(`\n${C.bright}── ${config.name} ──${C.r}`);
  const textsDir = join(CORPUS_ROOT, slug, 'texts');
  mkdirSync(textsDir, { recursive: true });

  let totalChars = 0;
  let collected = 0;

  for (const source of config.sources) {
    process.stdout.write(`  Fetching ${source.name}... `);
    const text = await fetchText(source.url);
    if (text) {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 100) {
        const filename = source.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 60) + '.txt';
        writeFileSync(join(textsDir, filename), text, 'utf-8');
        totalChars += text.length;
        collected++;
        process.stdout.write(`${C.green}${words.length} words${C.r}\n`);
      } else {
        process.stdout.write(`${C.yellow}too short (${words.length} words)${C.r}\n`);
      }
    } else {
      process.stdout.write(`${C.red}failed${C.r}\n`);
    }
    await sleep(800);
  }

  if (collected > 0) {
    ok(`${config.name}: ${collected} files, ${totalChars.toLocaleString()} chars`);
    return { slug, files: collected, chars: totalChars };
  } else {
    warn(`${config.name}: no files collected`);
    return { slug, files: 0, chars: 0 };
  }
}

const PERSONAS = {
  'warren-buffett': {
    name: 'Warren Buffett',
    sources: [
      { url: 'https://fs.blog/buffett/', name: 'Buffett Farnam Street' },
      { url: 'https://fs.blog/2019/01/the-wealth-building-secret-most-people-miss/', name: 'Buffett Wealth Building' },
    ],
  },
  'steve-jobs': {
    name: 'Steve Jobs',
    sources: [
      { url: 'https://fs.blog/steve-jobs-book-quotes/', name: 'Steve Jobs Book Quotes' },
      { url: 'https://fs.blog/steve-jobs-speech/', name: 'Stanford Speech Transcript' },
    ],
  },
  'ilya-sutskever': {
    name: 'Ilya Sutskever',
    sources: [
      { url: 'https://en.wikipedia.org/wiki/Ilya_Sutskever', name: 'Wikipedia' },
    ],
  },
  'jensen-huang': {
    name: 'Jensen Huang',
    sources: [
      { url: 'https://blogs.nvidia.com/blog/author/jensen-huang/', name: 'Nvidia Blog Posts' },
    ],
  },
  'zhang-yiming': {
    name: 'Zhang Yiming',
    sources: [
      { url: 'https://en.wikipedia.org/wiki/Zhang_Yiming', name: 'Wikipedia' },
    ],
  },
  'zhang-xuefeng': {
    name: 'Zhang Xuefeng',
    sources: [
      { url: 'https://xueqiu.com/1496133441', name: 'Xueqiu' },
    ],
  },
};

async function main() {
  const slugs = Object.keys(PERSONAS);
  const results = [];

  for (const slug of slugs) {
    const result = await collectPersona(slug, PERSONAS[slug]);
    results.push(result);
  }

  console.log(`\n${C.bright}=== Summary ===${C.r}`);
  const success = results.filter(r => r.files > 0);
  const failed = results.filter(r => r.files === 0);
  for (const r of success) {
    console.log(`  ${C.green}✓${C.r} ${r.slug}: ${r.files} files, ${r.chars.toLocaleString()} chars`);
  }
  for (const r of failed) {
    console.log(`  ${C.red}✗${C.r} ${r.slug}: no corpus`);
  }
  console.log(`\n  Collected: ${success.length}/${slugs.length}`);
}

main().catch(console.error);
