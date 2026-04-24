#!/usr/bin/env node
/** Additional corpus collection for steve-jobs, jensen-huang, zhang-xuefeng */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = join(process.cwd());
const C = { r: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
const ok = t => console.log(`${C.green}✓${C.r} ${t}`);
const warn = t => console.log(`${C.yellow}⚠${C.r} ${t}`);
const err = t => console.log(`${C.red}✗${C.r} ${t}`);

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<meta[^>]*>/gi, ' ')
    .replace(/<link[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
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
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return stripHtml(await resp.text());
  } catch (_e) {
    clearTimeout(timer);
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const TARGETS = [
  // Steve Jobs - try multiple sources
  { slug: 'steve-jobs', url: 'https://en.wikipedia.org/wiki/Steve_Jobs', name: 'Steve Jobs Wikipedia' },
  { slug: 'steve-jobs', url: 'https://www.britannica.com/biography/Steve-Jobs', name: 'Steve Jobs Britannica' },
  // Jensen Huang
  { slug: 'jensen-huang', url: 'https://en.wikipedia.org/wiki/Jensen_Huang', name: 'Jensen Huang Wikipedia' },
  { slug: 'jensen-huang', url: 'https://blogs.nvidia.com/blog/category/jensen-huang/', name: 'Nvidia Jensen Blog' },
  // Zhang Xuefeng
  { slug: 'zhang-xuefeng', url: 'https://www.zhihu.com/topic/19552897/hot', name: 'Zhang Xuefeng Zhihu' },
  { slug: 'zhang-xuefeng', url: 'https://en.wikipedia.org/wiki/Zhang_Xuefeng_(educator)', name: 'Zhang Xuefeng Wikipedia' },
];

async function main() {
  const results = new Map();
  for (const target of TARGETS) {
    process.stdout.write(`Fetching ${target.name}... `);
    const text = await fetchText(target.url);
    if (text) {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 100) {
        const textsDir = join(__dirname, 'corpus', target.slug, 'texts');
        mkdirSync(textsDir, { recursive: true });
        const filename = target.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 60) + '.txt';
        writeFileSync(join(textsDir, filename), text, 'utf-8');
        process.stdout.write(`${C.green}${words.length} words${C.r}\n`);
        results.set(target.slug, (results.get(target.slug) || 0) + words.length);
      } else {
        process.stdout.write(`${C.yellow}too short${C.r}\n`);
      }
    } else {
      process.stdout.write(`${C.red}failed${C.r}\n`);
    }
    await sleep(1000);
  }

  console.log(`\n${C.bright}=== Additional Collection ===${C.r}`);
  for (const [slug, words] of results) {
    ok(`${slug}: ${words.toLocaleString()} total words`);
  }
  if (results.size === 0) {
    warn('No additional corpus collected');
  }
}

main().catch(console.error);
