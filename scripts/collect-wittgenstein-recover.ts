/**
 * Wittgenstein Recovery Script
 * 修复采集失败的目标，补采缺失数据
 *
 * Usage: npx tsx scripts/collect-wittgenstein-recover.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

const CORPUS_DIR = path.join(process.cwd(), 'corpus', 'wittgenstein', 'texts');
const MANIFEST_PATH = path.join(process.cwd(), 'corpus', 'wittgenstein', 'manifest.json');
const REPORT_PATH = path.join(process.cwd(), 'corpus', 'wittgenstein', 'TRAINING_CORPUS_REPORT.md');

const config = {
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), config.timeout);
  try {
    const resp = await globalThis.fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en,de;q=0.9',
        ...((options.headers as Record<string, string>) ?? {}),
      },
    });
    clearTimeout(t);
    return resp;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) ?? []).length + (text.match(/[a-zA-Z]+/g) ?? []).length;
}

function assessQuality(content: string): number {
  let score = 50;
  const wc = countWords(content);
  if (wc > 500) score += 20;
  else if (wc > 200) score += 10;
  else if (wc < 50) score -= 20;
  const uniqueWords = new Set(content.toLowerCase());
  const ratio = uniqueWords.size / Math.max(1, content.length);
  if (ratio > 0.1) score += 15;
  else if (ratio < 0.03) score -= 15;
  const repeated = content.match(/(.{20,})\1{2,}/g);
  if (repeated) score -= repeated.length * 10;
  return Math.max(0, Math.min(100, score));
}

function cleanBookText(text: string): string {
  return text
    .replace(/\*\*\* START OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
    .replace(/\*\*\* END OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
    .replace(/^\s*The Project Gutenberg eBook[\s\S]*?$/gim, '')
    .replace(/CHAPTER\s+[IVXLCDM]+\s*$/gim, '')
    .replace(/^\s*Chapter\s+\w+\s*$/gim, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ─── Gutenberg 智能采集 ───────────────────────────────────────────────────────

async function collectGutenberg(id: number, workId: string, name: string): Promise<string | null> {
  // 尝试多种可能的文本 URL
  const candidates = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-8.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}-0.txt`,
    `https://www.gutenberg.org/ebooks/${id}`,
  ];

  for (const url of candidates) {
    try {
      if (url.endsWith('/ebooks/')) {
        // 解析 HTML 找文本链接
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const html = await resp.text();
        const links = [...html.matchAll(/href="([^"]*\.txt[^"]*)"/gi)];
        for (const m of links) {
          const txtUrl = new URL(m[1], url).href;
          const txtResp = await fetch(txtUrl);
          if (txtResp.ok) {
            const text = cleanBookText(await txtResp.text());
            if (text.length > 500) return text;
          }
        }
      } else {
        const resp = await fetch(url);
        if (resp.ok) {
          const ct = resp.headers.get('content-type') ?? '';
          if (ct.includes('text') || url.includes('.txt')) {
            const text = cleanBookText(await resp.text());
            if (text.length > 500) return text;
          }
        }
      }
    } catch { /* continue */ }
  }
  return null;
}

// ─── SEP 智能采集 ────────────────────────────────────────────────────────────

async function collectSEP(entry: string, name: string, workId: string): Promise<string | null> {
  // 尝试不带尾部斜杠、带尾部斜杠、以及各种可能的 URL 变体
  const candidates = [
    `https://plato.stanford.edu/entries/${entry}/`,
    `https://plato.stanford.edu/entries/${entry}`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;

      const html = await resp.text();
      if (html.includes('Document Not Found') || html.includes('<title>404')) continue;

      const text = stripHtml(html);

      // 提取正文：找主要段落内容
      const bodyMatch = text.match(/(?:Introduction|1\.\s)[A-Z][^.!?]{200,}/i)
        || text.match(/[A-Z][^.!?]{500,}(?:References|Bibliography)/i)
        || text.match(/[A-Z][^.!?]{1000,}/i);

      const body = bodyMatch ? bodyMatch[0].replace(/References[\s\S]*/i, '').replace(/Bibliography[\s\S]*/i, '') : text;

      if (body.length > 500) return body.slice(0, 30000);
    } catch { /* continue */ }
  }
  return null;
}

// ─── IEP 采集 ────────────────────────────────────────────────────────────────

async function collectIEP(name: string, workId: string): Promise<string | null> {
  // 尝试不带尾部斜杠和带尾部斜杠
  const slug = 'wittgen';
  const candidates = [
    `https://www.iep.utm.edu/${slug}/`,
    `https://www.iep.utm.edu/${slug}`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, { redirect: 'follow' });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.includes('Page not found')) continue;
      const text = stripHtml(html);
      if (text.length > 500) return text.slice(0, 20000);
    } catch { /* continue */ }
  }
  return null;
}

// ─── 补采任务定义 ───────────────────────────────────────────────────────────

interface RecoverTarget {
  workId: string;
  name: string;
  strategy: 'gutenberg' | 'sep' | 'iep';
  // Gutenberg
  gutenbergId?: number;
  // SEP
  sepEntry?: string;
  // IEP
  useIEP?: boolean;
}

const RECOVER_TARGETS: RecoverTarget[] = [
  {
    workId: 'wittgenstein-tractatus',
    name: 'Tractatus Logico-Philosophicus',
    strategy: 'gutenberg',
    gutenbergId: 5740,
  },
  {
    workId: 'sep-wittgenstein-tractatus',
    name: 'SEP: Wittgenstein Tractatus',
    strategy: 'sep',
    sepEntry: 'wittgenstein-tractatus',
  },
  {
    workId: 'sep-wittgenstein-rule-following',
    name: 'SEP: Rule-Following and Private Language',
    strategy: 'sep',
    sepEntry: 'rule-following-private-language',
  },
  {
    workId: 'sep-wittgenstein-philosophy-mind',
    name: 'SEP: Wittgenstein and Philosophy of Mind',
    strategy: 'sep',
    sepEntry: 'wittgenstein-mind',
  },
  {
    workId: 'iep-wittgenstein',
    name: 'IEP: Wittgenstein',
    strategy: 'iep',
  },
];

// ─── 主流程 ─────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('\n🔧 Wittgenstein Recovery Script');
  console.log('='.repeat(50));

  const results: Array<{ workId: string; name: string; success: boolean; words: number; error?: string }> = [];

  for (const target of RECOVER_TARGETS) {
    process.stdout.write(`  [RECOVER] ${target.name}... `);

    let content: string | null = null;
    let error: string | undefined;

    try {
      if (target.strategy === 'gutenberg') {
        if (!target.gutenbergId) throw new Error('No Gutenberg ID');
        content = await collectGutenberg(target.gutenbergId, target.workId, target.name);
      } else if (target.strategy === 'sep') {
        if (!target.sepEntry) throw new Error('No SEP entry');
        content = await collectSEP(target.sepEntry, target.name, target.workId);
      } else if (target.strategy === 'iep') {
        content = await collectIEP(target.name, target.workId);
      }
    } catch (e) {
      error = String(e);
    }

    if (content && content.length > 500) {
      const wc = countWords(content);
      const quality = assessQuality(content);
      const filePath = path.join(CORPUS_DIR, `${target.workId}.txt`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ ${wc.toLocaleString()} words, quality=${quality}`);
      results.push({ workId: target.workId, name: target.name, success: true, words: wc });

      // 也尝试多补一个 Internet Archive 版本（作为备份）
      if (target.workId === 'wittgenstein-tractatus') {
        process.stdout.write('  [BACKUP] Internet Archive... ');
        const iaContent = await collectInternetArchive('tractatus-logico-philosophicus-wittgenstein');
        if (iaContent) {
          const iaPath = path.join(CORPUS_DIR, `${target.workId}-archive.txt`);
          await fs.writeFile(iaPath, iaContent, 'utf-8');
          console.log(`✅ archive backup saved`);
        } else {
          console.log(`❌ no archive data`);
        }
      }
    } else {
      console.log(`❌ no data recovered${error ? ` (${error})` : ''}`);
      results.push({ workId: target.workId, name: target.name, success: false, words: 0, error });
    }

    await sleep(1000);
  }

  const elapsedMs = Date.now() - startTime;

  // 更新 manifest
  try {
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8'));
    for (const r of results) {
      const src = manifest.sources.find((s: any) => s.id === r.workId);
      if (src) {
        src.success = r.success;
        src.words = r.words;
      }
    }
    manifest.totalFiles = manifest.sources.filter((s: any) => s.success).length;
    manifest.totalWords = manifest.sources.reduce((s: number, x: any) => s + (x.words || 0), 0);
    manifest.totalChars = manifest.sources
      .filter((s: any) => s.success)
      .reduce(async (s: Promise<number>, x: any) => {
        const fpath = path.join(CORPUS_DIR, `${x.id}.txt`);
        try {
          const c = await fs.readFile(fpath, 'utf-8');
          return (await s) + c.length;
        } catch { return (await s); }
      }, Promise.resolve(0));
    manifest.averageQuality = manifest.sources.filter((s: any) => s.success).length > 0
      ? Math.round(manifest.sources.filter((s: any) => s.success).reduce((s: number, x: any) => s + (x.quality || 55), 0) / manifest.sources.filter((s: any) => s.success).length * 10) / 10
      : 0;
    manifest.recoveredAt = new Date().toISOString();
    manifest.recoveryElapsedMs = elapsedMs;
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n✅ manifest.json updated`);
  } catch (e) {
    console.error(`\n❌ Failed to update manifest: ${e}`);
  }

  console.log(`\n⏱  Recovery took ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log('='.repeat(50));
}

// ─── Internet Archive 备份采集 ───────────────────────────────────────────────

async function collectInternetArchive(identifier: string): Promise<string | null> {
  try {
    const metaUrl = `https://archive.org/metadata/${identifier}`;
    const resp = await fetch(metaUrl);
    if (!resp.ok) return null;
    const meta = await resp.json();
    const files: Array<{ name: string }> = meta?.files ?? [];
    const txtFile = files.find(f => f.name?.endsWith('.txt') || f.name?.includes('_text'));
    if (!txtFile) return null;
    const textUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(txtFile.name)}`;
    const textResp = await fetch(textUrl);
    if (!textResp.ok) return null;
    const text = cleanBookText(await textResp.text());
    return text.length > 500 ? text : null;
  } catch {
    return null;
  }
}

main().catch(console.error);
