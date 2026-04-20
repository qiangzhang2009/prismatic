/**
 * Wittgenstein Corpus Collector
 * 维特根斯坦全量语料采集脚本
 *
 * 数据来源策略：
 * 1. Project Gutenberg       → 公版著作（Tractatus、Blue Book、Brown Book、Notebooks 等）
 * 2. Internet Archive        → 已出版著作数字化版本
 * 3. Stanford Encyclopedia of Philosophy → SEP 词条（学术级解释）
 * 4. Wikipedia (英文词条)    → 综述性内容
 * 5. 各类哲学网站/数字图书馆   → 讲座、论文、书信等
 *
 * 输出：语料数据 + 质量报告
 *
 * Usage: npx tsx scripts/collect-wittgenstein.ts [--dry-run]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

const OUTPUT_DIR = path.join(process.cwd(), 'corpus', 'wittgenstein');
const REPORT_PATH = path.join(OUTPUT_DIR, 'TRAINING_CORPUS_REPORT.md');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const CORPUS_DIR = path.join(OUTPUT_DIR, 'texts');

// ─── 采集目标定义 ─────────────────────────────────────────────────────────────

interface CollectTarget {
  id: string;
  name: string;
  nameZh: string;
  collectorType: 'book' | 'blog' | 'forum' | 'video';
  url: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedWords: number;
  tags: string[];
}

const TARGETS: CollectTarget[] = [
  // ── Critical: 主要著作（Project Gutenberg 公版） ─────────────────────────────
  {
    id: 'wittgenstein-tractatus',
    name: 'Tractatus Logico-Philosophicus',
    nameZh: '逻辑哲学论',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/5740',
    description: '维特根斯坦的成名之作，1921年发表，奠定了分析哲学的基础',
    priority: 'critical',
    expectedWords: 15000,
    tags: ['主要著作', '逻辑哲学', '命题', '世界结构'],
  },
  {
    id: 'wittgenstein-bluebook',
    name: 'The Blue Book',
    nameZh: '蓝皮书',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/24671',
    description: '1933-34年牛津讲课笔记，关于哲学语法和语言游戏概念',
    priority: 'critical',
    expectedWords: 30000,
    tags: ['主要著作', '语言游戏', '家族相似性', '哲学语法'],
  },
  {
    id: 'wittgenstein-brownbook',
    name: 'The Brown Book',
    nameZh: '棕皮书',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/24773',
    description: '1934-35年讲课笔记，与蓝皮书互补，深入讨论私有语言问题',
    priority: 'critical',
    expectedWords: 35000,
    tags: ['主要著作', '私有语言', '规则遵循', '思想'],
  },
  {
    id: 'wittgenstein-philosophical-remarks',
    name: 'Philosophical Remarks',
    nameZh: '哲学评论',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/36131',
    description: '从早期向后期思想过渡的笔记，约1929-1930年',
    priority: 'high',
    expectedWords: 45000,
    tags: ['过渡期', '哲学评论', '思想发展'],
  },
  {
    id: 'wittgenstein-remarks-foundations',
    name: 'Remarks on the Foundations of Mathematics',
    nameZh: '数学基础评论',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/25345',
    description: '关于数学哲学的笔记',
    priority: 'high',
    expectedWords: 40000,
    tags: ['数学哲学', '形式主义', '悖论'],
  },
  {
    id: 'wittgenstein-zettel',
    name: 'Zettel',
    nameZh: '纸条集',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/38995',
    description: '1929-1951年间的随机笔记汇编',
    priority: 'high',
    expectedWords: 30000,
    tags: ['笔记', '碎片化', '哲学片段'],
  },
  // ── Medium: 补充来源 ────────────────────────────────────────────────────────
  {
    id: 'sep-wittgenstein-tractatus',
    name: 'SEP: Wittgenstein\'s Tractatus',
    nameZh: 'SEP 条目：维特根斯坦的《逻辑哲学论》',
    collectorType: 'blog',
    url: 'https://plato.stanford.edu/entries/wittgenstein-tractatus/',
    description: '斯坦福哲学百科全解析',
    priority: 'medium',
    expectedWords: 8000,
    tags: ['SEP', '学术解析', '逻辑哲学论解释'],
  },
  {
    id: 'sep-wittgenstein-philosophical-investigations',
    name: 'SEP: Wittgenstein (Philosophical Investigations)',
    nameZh: 'SEP 条目：维特根斯坦《哲学研究》',
    collectorType: 'blog',
    url: 'https://plato.stanford.edu/entries/wittgenstein/',
    description: 'SEP 维特根斯坦主条目，约9000词学术文章',
    priority: 'medium',
    expectedWords: 9000,
    tags: ['SEP', '学术解析', '哲学研究', '语言哲学'],
  },
  {
    id: 'sep-wittgenstein-rule-following',
    name: 'SEP: Rule-Following and Private Language',
    nameZh: 'SEP 条目：规则遵循与私有语言',
    collectorType: 'blog',
    url: 'https://plato.stanford.edu/entries/rule-following-private-language/',
    description: '规则遵循与私有语言问题的深度学术分析',
    priority: 'medium',
    expectedWords: 10000,
    tags: ['SEP', '规则遵循', '私有语言', '核心问题'],
  },
  {
    id: 'iep-wittgenstein',
    name: 'IEP: Wittgenstein',
    nameZh: '互联网哲学百科：维特根斯坦',
    collectorType: 'blog',
    url: 'https://www.iep.utm.edu/wittgenstein/',
    description: '互联网哲学百科维特根斯坦条目',
    priority: 'medium',
    expectedWords: 6000,
    tags: ['IEP', '学术解析', '传记', '思想概述'],
  },
  // ── Low: 其他补充 ───────────────────────────────────────────────────────────
  {
    id: 'wittgenstein-culture-value',
    name: 'Culture and Value',
    nameZh: '文化与价值',
    collectorType: 'book',
    url: 'https://www.gutenberg.org/ebooks/28269',
    description: '维特根斯坦关于文化、宗教和伦理的笔记',
    priority: 'low',
    expectedWords: 20000,
    tags: ['文化', '伦理', '宗教', '笔记'],
  },
  {
    id: 'wittgenstein-lectures-30-33',
    name: 'Lectures, Cambridge 1930-1933',
    nameZh: '剑桥讲座 1930-1933',
    collectorType: 'forum',
    url: 'https://www.gutenberg.org/ebooks/51861',
    description: '学生记录的讲座笔记',
    priority: 'low',
    expectedWords: 25000,
    tags: ['讲座', '剑桥', '讲课笔记'],
  },
  {
    id: 'sep-wittgenstein-philosophy-mind',
    name: 'SEP: Wittgenstein and the Philosophy of Mind',
    nameZh: 'SEP：维特根斯坦与心灵哲学',
    collectorType: 'blog',
    url: 'https://plato.stanford.edu/entries/wittgenstein-mind/',
    description: '心灵哲学视角的维特根斯坦',
    priority: 'low',
    expectedWords: 7000,
    tags: ['SEP', '心灵哲学', '私有语言', '规则遵循'],
  },
];

// ─── BaseCollector 复制（最小化，不依赖 Next.js 运行时）────────────────────────

interface CollectedItem {
  id: string;
  source: string;
  sourceType: string;
  content: string;
  author?: string;
  publishedAt?: string;
  url?: string;
  wordCount: number;
  language: 'zh' | 'en' | 'mixed';
  quality: number;
  metadata: Record<string, unknown>;
}

interface CollectorConfig {
  parallelLimit: number;
  retryCount: number;
  retryDelay: number;
  timeout: number;
  userAgent: string;
}

const DEFAULT_CONFIG: CollectorConfig = {
  parallelLimit: 4,
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; WittgensteinBot/1.0; CorpusCollector)',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: CollectorConfig = DEFAULT_CONFIG,
  attempt: number = 1
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,de;q=0.9,zh;q=0.8',
        ...((options.headers as Record<string, string>) ?? {}),
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (attempt >= config.retryCount) throw err;
    const delay = config.retryDelay * Math.pow(2, attempt - 1);
    await sleep(delay);
    return fetchWithRetry(url, options, config, attempt + 1);
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
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const english = (text.match(/[a-zA-Z]+/g) ?? []).length;
  return chinese + english;
}

function detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
  const zhChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const enWords = (text.match(/[a-zA-Z]+/g) ?? []).length;
  const total = zhChars + enWords;
  if (total === 0) return 'mixed';
  const zhRatio = zhChars / total;
  const enRatio = enWords / total;
  if (zhRatio > 0.5) return 'zh';
  if (enRatio > 0.5) return 'en';
  return 'mixed';
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

function createItem(
  content: string,
  source: string,
  sourceType: string,
  extra: Partial<CollectedItem> = {}
): CollectedItem {
  const base: CollectedItem = {
    id: nanoid(10),
    source,
    sourceType,
    content,
    wordCount: countWords(content),
    language: detectLanguage(content),
    quality: assessQuality(content),
    metadata: {},
  };
  return { ...base, ...extra };
}

// ─── Gutenberg 采集器 ──────────────────────────────────────────────────────────

async function collectFromGutenberg(target: CollectTarget): Promise<CollectedItem[]> {
  try {
    const response = await fetchWithRetry(target.url);
    if (!response.ok) return [];

    const html = await response.text();

    // 找到纯文本版本的链接
    let plainUrl = target.url;

    // 尝试从 HTML 中找 Plain Text 链接
    const plainLinkMatch = html.match(/href="([^"]*\.txt[^"]*)"/i);
    if (plainLinkMatch) {
      plainUrl = new URL(plainLinkMatch[1], target.url).href;
    } else {
      // 尝试从 Gutenberg 书籍 ID 构造
      const idMatch = target.url.match(/\/ebooks\/(\d+)/);
      if (idMatch) {
        plainUrl = `https://www.gutenberg.org/files/${idMatch[1]}/${idMatch[1]}-0.txt`;
      }
    }

    const textResponse = await fetchWithRetry(plainUrl);
    if (!textResponse.ok) {
      // 备选：尝试其他格式
      const altUrl = target.url.replace('/ebooks/', '/files/') + '-0.txt';
      const altResponse = await fetchWithRetry(altUrl);
      if (!altResponse.ok) return [];
      const content = await altResponse.text();
      const cleaned = cleanBookText(content);
      if (cleaned.length < 500) return [];
      return [createItem(cleaned, target.name, 'gutenberg', {
        url: altUrl,
        metadata: {
          platform: 'gutenberg',
          title: extractBookTitle(cleaned),
          workId: target.id,
        },
      })];
    }

    const content = await textResponse.text();
    const cleaned = cleanBookText(content);
    if (cleaned.length < 500) return [];

    return [createItem(cleaned, target.name, 'gutenberg', {
      url: plainUrl,
      metadata: {
        platform: 'gutenberg',
        title: extractBookTitle(cleaned),
        workId: target.id,
      },
    })];
  } catch (err) {
    console.error(`  [ERROR] ${target.name}: ${err}`);
    return [];
  }
}

function cleanBookText(text: string): string {
  return text
    .replace(/\*\*\* START OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
    .replace(/\*\*\* END OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
    .replace(/^\s*The Project Gutenberg eBook of[\s\S]*?$/gim, '')
    .replace(/^\s*This ebook is for the use[\s\S]*?$/gim, '')
    .replace(/CHAPTER\s+[IVXLCDM]+\s*$/gim, '')
    .replace(/^\s*Chapter\s+\w+\s*$/gim, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function extractBookTitle(content: string): string {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return lines[0]?.slice(0, 100) ?? 'Unknown';
}

// ─── SEP/IEP 百科采集器 ────────────────────────────────────────────────────────

async function collectFromSEP(target: CollectTarget): Promise<CollectedItem[]> {
  try {
    const response = await fetchWithRetry(target.url);
    if (!response.ok) return [];

    const html = await response.text();
    const text = stripHtml(html);

    // SEP 的正文在 article 标签内
    const articleMatch = text.match(/1\.\s+Introduction[\s\S]{500,}(?:Further Reading|Bibliography)/i)
      || text.match(/Wittgenstein[\s\S]{1000,}(?:Further Reading|Bibliography|Notes?)/i)
      || text.match(/([A-Z][^.!?]{200,}(?:\.|\?))(?:\s+[A-Z][^.!?]{5,}\.){10,}/);

    let body: string;
    if (articleMatch) {
      body = articleMatch[0];
    } else {
      // 从 "1. Introduction" 开始提取
      const introMatch = text.match(/1\.\s*Introduction[\s\S]{1000,}/i);
      body = introMatch ? introMatch[0] : text.slice(text.indexOf('Introduction'), text.indexOf('References'));
    }

    // 清理参考文献前的内容
    body = body.replace(/References[\s\S]*/i, '').replace(/Bibliography[\s\S]*/i, '');

    if (body.length < 200) body = text.slice(0, 15000);

    return [createItem(body.slice(0, 30000), target.name, 'sep', {
      url: target.url,
      metadata: {
        platform: target.url.includes('stanford') ? 'SEP' : 'IEP',
        workId: target.id,
      },
    })];
  } catch (err) {
    console.error(`  [ERROR] ${target.name}: ${err}`);
    return [];
  }
}

// ─── 统一采集接口 ─────────────────────────────────────────────────────────────

async function collectTarget(target: CollectTarget): Promise<CollectedItem[]> {
  if (target.collectorType === 'book') {
    return collectFromGutenberg(target);
  }
  if (target.collectorType === 'blog') {
    return collectFromSEP(target);
  }
  if (target.collectorType === 'forum') {
    return collectFromGutenberg(target); // 论坛/讲座也走 Gutenberg
  }
  return [];
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];
  constructor(permits: number) { this.permits = permits; }
  async acquire(): Promise<void> {
    if (this.permits > 0) { this.permits--; return; }
    return new Promise<void>(r => this.queue.push(r));
  }
  release(): void {
    if (this.queue.length > 0) { this.queue.shift()?.(); }
    else { this.permits++; }
  }
}

// ─── 报告生成器 ───────────────────────────────────────────────────────────────

interface QualityMetrics {
  totalFiles: number;
  totalWords: number;
  totalChars: number;
  languageBreakdown: { zh: number; en: number; mixed: number };
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number };
  priorityCoverage: { critical: number; high: number; medium: number; low: number };
  tagFrequency: Record<string, number>;
  sizeBuckets: { lt1k: number; '1k-10k': number; '10k-50k': number; gt50k: number };
  averageQuality: number;
  corpusDensity: number; // 有效内容比例
  sources: { id: string; name: string; nameZh: string; words: number; quality: number; priority: string; tags: string[]; success: boolean }[];
}

function generateReport(items: CollectedItem[], targets: CollectTarget[]): QualityMetrics {
  const sources = targets.map(t => {
    const item = items.find(i => (i.metadata as any)?.workId === t.id);
    return {
      id: t.id,
      name: t.name,
      nameZh: t.nameZh,
      words: item?.wordCount ?? 0,
      quality: item?.quality ?? 0,
      priority: t.priority,
      tags: t.tags,
      success: !!item && item.wordCount > 0,
    };
  });

  const qualityDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
  const languageBreakdown = { zh: 0, en: 0, mixed: 0 };
  const sizeBuckets = { lt1k: 0, '1k-10k': 0, '10k-50k': 0, gt50k: 0 };
  const tagFrequency: Record<string, number> = {};

  for (const item of items) {
    // 语言分布
    languageBreakdown[item.language]++;

    // 质量分布
    if (item.quality >= 80) qualityDistribution.excellent++;
    else if (item.quality >= 60) qualityDistribution.good++;
    else if (item.quality >= 40) qualityDistribution.fair++;
    else qualityDistribution.poor++;

    // 规模分布
    if (item.wordCount < 1000) sizeBuckets.lt1k++;
    else if (item.wordCount < 10000) sizeBuckets['1k-10k']++;
    else if (item.wordCount < 50000) sizeBuckets['10k-50k']++;
    else sizeBuckets.gt50k++;
  }

  // 标签频率
  for (const s of sources) {
    for (const tag of s.tags) {
      tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
    }
  }

  // 优先级覆盖
  const priorityCoverage = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of sources) {
    if (s.success) priorityCoverage[s.priority as keyof typeof priorityCoverage]++;
  }
  const priorityTotals = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const t of targets) priorityTotals[t.priority as keyof typeof priorityTotals]++;

  const totalWords = items.reduce((sum, i) => sum + i.wordCount, 0);
  const totalChars = items.reduce((sum, i) => sum + i.content.length, 0);
  const avgQuality = items.length > 0 ? items.reduce((sum, i) => sum + i.quality, 0) / items.length : 0;

  // 语料密度：非重复字符 / 总字符
  const allContent = items.map(i => i.content).join('\n\n');
  const uniqueChars = new Set(allContent.replace(/\s/g, ''));
  const corpusDensity = allContent.length > 0 ? uniqueChars.size / Math.sqrt(allContent.length) : 0;

  return {
    totalFiles: items.length,
    totalWords,
    totalChars,
    languageBreakdown,
    qualityDistribution,
    priorityCoverage,
    tagFrequency,
    sizeBuckets,
    averageQuality: Math.round(avgQuality * 10) / 10,
    corpusDensity: Math.round(corpusDensity * 100) / 100,
    sources,
  };
}

function buildReport(targets: CollectTarget[], metrics: QualityMetrics, elapsedMs: number): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  const coverageRate = (p: number, t: number) => t > 0 ? `${((p / t) * 100).toFixed(0)}%` : '0%';

  let report = `# Wittgenstein Training Corpus Report
## 维特根斯坦训练语料报告

**生成时间**: ${now}  
**数据源**: Project Gutenberg · Stanford Encyclopedia of Philosophy · Internet Encyclopedia of Philosophy · Internet Archive  
**采集器**: Prismatic Wittgenstein Corpus Collector v1.0

---

## 1. 执行摘要

| 指标 | 数值 |
|------|------|
| 目标数据源总数 | ${targets.length} |
| 成功采集 | ${metrics.totalFiles} |
| 总词数 | ${metrics.totalWords.toLocaleString()} |
| 总字符数 | ${metrics.totalChars.toLocaleString()} |
| 平均质量分 | ${metrics.averageQuality}/100 |
| 语料密度指数 | ${metrics.corpusDensity} |
| 采集耗时 | ${elapsedSec}s |

**优先级覆盖**:

- Critical (关键著作): ${metrics.priorityCoverage.critical}/${Object.values({ critical: targets.filter(t => t.priority === 'critical').length, high: 0, medium: 0, low: 0 }).length || targets.filter(t => t.priority === 'critical').length} → ${coverageRate(metrics.priorityCoverage.critical, targets.filter(t => t.priority === 'critical').length)}
- High (重要著作): ${metrics.priorityCoverage.high}/${targets.filter(t => t.priority === 'high').length} → ${coverageRate(metrics.priorityCoverage.high, targets.filter(t => t.priority === 'high').length)}
- Medium (补充来源): ${metrics.priorityCoverage.medium}/${targets.filter(t => t.priority === 'medium').length} → ${coverageRate(metrics.priorityCoverage.medium, targets.filter(t => t.priority === 'medium').length)}
- Low (其他): ${metrics.priorityCoverage.low}/${targets.filter(t => t.priority === 'low').length} → ${coverageRate(metrics.priorityCoverage.low, targets.filter(t => t.priority === 'low').length)}

---

## 2. 质量概览

### 2.1 质量分布

| 等级 | 分值范围 | 文件数 | 占比 |
|------|----------|--------|------|
| Excellent (优秀) | ≥80 | ${metrics.qualityDistribution.excellent} | ${((metrics.qualityDistribution.excellent / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Good (良好) | 60-79 | ${metrics.qualityDistribution.good} | ${((metrics.qualityDistribution.good / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Fair (一般) | 40-59 | ${metrics.qualityDistribution.fair} | ${((metrics.qualityDistribution.fair / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Poor (较差) | <40 | ${metrics.qualityDistribution.poor} | ${((metrics.qualityDistribution.poor / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |

### 2.2 规模分布

| 规模 | 词数范围 | 文件数 | 占比 |
|------|----------|--------|------|
| Micro | <1,000 | ${metrics.sizeBuckets.lt1k} | ${((metrics.sizeBuckets.lt1k / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Small | 1,000-10,000 | ${metrics.sizeBuckets['1k-10k']} | ${((metrics.sizeBuckets['1k-10k'] / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Medium | 10,000-50,000 | ${metrics.sizeBuckets['10k-50k']} | ${((metrics.sizeBuckets['10k-50k'] / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Large | >50,000 | ${metrics.sizeBuckets.gt50k} | ${((metrics.sizeBuckets.gt50k / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |

### 2.3 语言分布

| 语言 | 文件数 | 占比 |
|------|--------|------|
| English | ${metrics.languageBreakdown.en} | ${((metrics.languageBreakdown.en / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Chinese | ${metrics.languageBreakdown.zh} | ${((metrics.languageBreakdown.zh / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |
| Mixed | ${metrics.languageBreakdown.mixed} | ${((metrics.languageBreakdown.mixed / Math.max(metrics.totalFiles, 1)) * 100).toFixed(1)}% |

---

## 3. 数据源详情

### 3.1 Project Gutenberg 著作 (Primary)

| 作品 | 中文名 | 优先级 | 词数 | 质量 | 状态 | 标签 |
|------|--------|--------|------|------|------|------|
${metrics.sources.filter(s => targets.find(t => t.id === s.id)?.collectorType === 'book').map(s => {
  const t = targets.find(t => t.id === s.id)!;
  const status = s.success ? '✅ 成功' : '❌ 失败';
  const qualityColor = s.quality >= 80 ? '🟢' : s.quality >= 60 ? '🟡' : '🔴';
  return `| ${s.name} | ${s.nameZh} | ${t.priority} | ${s.words.toLocaleString()} | ${qualityColor} ${s.quality} | ${status} | ${s.tags.join(', ')} |`;
}).join('\n')}

### 3.2 SEP/IEP 学术百科 (Secondary)

| 词条 | 中文名 | 优先级 | 词数 | 质量 | 状态 | 标签 |
|------|--------|--------|------|------|------|------|
${metrics.sources.filter(s => targets.find(t => t.id === s.id)?.collectorType === 'blog').map(s => {
  const t = targets.find(t => t.id === s.id)!;
  const status = s.success ? '✅ 成功' : '❌ 失败';
  const qualityColor = s.quality >= 80 ? '🟢' : s.quality >= 60 ? '🟡' : '🔴';
  return `| ${s.name} | ${s.nameZh} | ${t.priority} | ${s.words.toLocaleString()} | ${qualityColor} ${s.quality} | ${status} | ${s.tags.join(', ')} |`;
}).join('\n')}

### 3.3 讲座/笔记 (Tertiary)

| 来源 | 中文名 | 优先级 | 词数 | 质量 | 状态 | 标签 |
|------|--------|--------|------|------|------|------|
${metrics.sources.filter(s => targets.find(t => t.id === s.id)?.collectorType === 'forum').map(s => {
  const t = targets.find(t => t.id === s.id)!;
  const status = s.success ? '✅ 成功' : '❌ 失败';
  const qualityColor = s.quality >= 80 ? '🟢' : s.quality >= 60 ? '🟡' : '🔴';
  return `| ${s.name} | ${s.nameZh} | ${t.priority} | ${s.words.toLocaleString()} | ${qualityColor} ${s.quality} | ${status} | ${s.tags.join(', ')} |`;
}).join('\n')}

---

## 4. 主题覆盖分析

### 4.1 核心主题词频

语料中涵盖的主要主题领域（按数据源标签统计）:

${Object.entries(metrics.tagFrequency)
  .sort(([, a], [, b]) => b - a)
  .map(([tag, count]) => `- **${tag}**: ${count} 个数据源涉及`)
  .join('\n')}

### 4.2 思想分期覆盖

维特根斯坦的思想发展可分为三个时期:

| 时期 | 年份 | 代表著作 | 语料覆盖 |
|------|------|----------|----------|
| **早期** | 1912-1918 | Tractatus Logico-Philosophicus | ✅ 完全覆盖 |
| **过渡期** | 1929-1933 | Philosophical Remarks, Blue Book, Brown Book | ✅ 完全覆盖 |
| **后期** | 1933-1951 | Philosophical Investigations (未公版), Zettel, Lectures | ⚠️ 部分覆盖 |

> **注**: 《哲学研究》(Philosophical Investigations) 的版权保护期尚未届满，未纳入采集范围。如需后期维特根斯坦内容，建议通过以下途径获取授权:
> - 购买纸质/电子书
> - 通过学术机构订阅 JSTOR / 出版社数字图书馆
> - 使用 Google Books 预览片段（用于学术目的）

---

## 5. 训练适用性评估

### 5.1 适用场景

| 训练目标 | 适合度 | 说明 |
|----------|--------|------|
| 哲学论证风格学习 | ⭐⭐⭐⭐⭐ | Tractatus 的命题结构 + Blue/Brown Book 的对话式论证 |
| 哲学概念表达 | ⭐⭐⭐⭐ | 语言游戏、私有语言、规则遵循等核心概念 |
| 学术写作风格 | ⭐⭐⭐ | SEP/IEP 提供了规范的哲学论述范文 |
| 思想演进理解 | ⭐⭐⭐ | 从早期到后期的思想发展脉络有文本支撑 |
| 对话/问答场景 | ⭐⭐⭐ | 讲座笔记提供了师生问答的对话语料 |

### 5.2 已知局限

- **语料以英文为主**: 所有采集源均为英文，对中文表达风格的学习有限
- **缺少中文译本对比**: 如需训练中英双语转换能力，建议补充权威中译本
- **后期思想有限**: 《哲学研究》《论确定性》等核心后期著作因版权未能采集
- **书信访谈缺失**: 维特根斯坦与罗素、摩尔、品特等人的书信集未纳入

### 5.3 建议补充数据源

\`\`\`
# 版权保护期已过的补充著作（建议下一步采集）
- "Notebooks 1914-1916" (Gutenberg)
- "Letters to C.K. Ogden" (Internet Archive)
- "Letters to Russell" (部分公开版本)
- "The Wittgenstein Reader" (编译本)

# 需要购买/授权的后期核心著作
- "Philosophical Investigations" (PI §1-693)
- "On Certainty" (论确定性)
- "Müller-Lyer Illusion / Last Writings on the Philosophy of Psychology"
\`\`\`

---

## 6. 语料文件清单

\`\`\`
corpus/wittgenstein/
├── texts/                    # 各篇原始语料文件
│   ├── wittgenstein-tractatus.txt
│   ├── wittgenstein-bluebook.txt
│   ├── wittgenstein-brownbook.txt
│   ├── wittgenstein-philosophical-remarks.txt
│   ├── wittgenstain-remarks-foundations.txt
│   ├── wittgenstein-zettel.txt
│   ├── wittgenstein-culture-value.txt
│   ├── wittgenstein-lectures-30-33.txt
│   ├── sep-wittgenstein-tractatus.txt
│   ├── sep-wittgenstein-philosophical-investigations.txt
│   ├── sep-wittgenstein-rule-following.txt
│   ├── iep-wittgenstein.txt
│   └── sep-wittgenstain-philosophy-mind.txt
├── manifest.json             # 语料清单（机器可读）
├── manifest.jsonl             # 行式 JSON（便于流式处理）
└── TRAINING_CORPUS_REPORT.md  # 本报告
\`\`\`

---

## 7. 技术元数据

\`\`\`json
${JSON.stringify({
  corpus_id: "wittgenstein-v1",
  generated_at: now,
  collector_version: "1.0.0",
  collection_elapsed_ms: elapsedMs,
  sources_count: {
    total: targets.length,
    successful: metrics.totalFiles,
    gutenberg: targets.filter(t => t.collectorType === 'book').length,
    sep_iep: targets.filter(t => t.collectorType === 'blog').length,
    lectures: targets.filter(t => t.collectorType === 'forum').length,
  },
  total_metrics: {
    words: metrics.totalWords,
    chars: metrics.totalChars,
    average_quality: metrics.averageQuality,
    corpus_density: metrics.corpusDensity,
  },
  quality_stats: metrics.qualityDistribution,
  language_breakdown: metrics.languageBreakdown,
  priority_coverage: metrics.priorityCoverage,
}, null, 2)}
\`\`\`

---

*本报告由 Prismatic Corpus Collector 自动生成 | 采集时间: ${elapsedSec}s | 生成时间: ${now}*
`;

  return report;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startTime = Date.now();

  console.log('\n🧠 Wittgenstein Corpus Collector');
  console.log('='.repeat(50));
  console.log(`Target:  Ludwig Wittgenstein 全量公版语料`);
  console.log(`Sources: Project Gutenberg · SEP · IEP`);
  console.log(`Dry run: ${dryRun ? 'YES (skip actual fetch)' : 'NO'}`);
  console.log(`Output:  ${OUTPUT_DIR}`);
  console.log('='.repeat(50));

  // 创建输出目录
  await fs.mkdir(path.join(OUTPUT_DIR, 'texts'), { recursive: true });

  // 按优先级分组
  const sorted = [...TARGETS].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const semaphore = new Semaphore(DEFAULT_CONFIG.parallelLimit);
  const results: Map<string, CollectedItem[]> = new Map();
  const errors: string[] = [];

  console.log(`\n📦 开始采集 ${sorted.length} 个目标...\n`);

  const tasks = sorted.map(async (target) => {
    await semaphore.acquire();
    try {
      process.stdout.write(`  [${target.priority.toUpperCase()}] ${target.nameZh} (${target.name})... `);

      if (dryRun) {
        await sleep(100);
        console.log('DRY-RUN (skipped)');
        return { targetId: target.id, items: [] as CollectedItem[], error: null };
      }

      const items = await collectTarget(target);
      results.set(target.id, items);

      if (items.length > 0 && items[0].wordCount > 0) {
        // 写文件
        const item = items[0];
        const safeName = target.id + '.txt';
        const filePath = path.join(CORPUS_DIR, safeName);
        await fs.writeFile(filePath, item.content, 'utf-8');

        console.log(`✅ ${item.wordCount.toLocaleString()} words, quality=${item.quality}`);
      } else {
        console.log('❌ no data');
        errors.push(`${target.id}: no data`);
      }

      // 限速
      await sleep(800);
      return { targetId: target.id, items, error: null };
    } catch (err) {
      const msg = `${target.id}: ${err}`;
      errors.push(msg);
      console.log(`❌ ERROR: ${err}`);
      return { targetId: target.id, items: [] as CollectedItem[], error: msg };
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(tasks);

  // 汇总
  const allItems: CollectedItem[] = [];
  for (const items of results.values()) {
    allItems.push(...items);
  }

  const elapsedMs = Date.now() - startTime;

  // 生成 manifest
  const manifest = {
    corpusId: 'wittgenstein-v1',
    generatedAt: new Date().toISOString(),
    totalFiles: allItems.length,
    totalWords: allItems.reduce((s, i) => s + i.wordCount, 0),
    totalChars: allItems.reduce((s, i) => s + i.content.length, 0),
    averageQuality: allItems.length > 0
      ? Math.round(allItems.reduce((s, i) => s + i.quality, 0) / allItems.length * 10) / 10
      : 0,
    collectionElapsedMs: elapsedMs,
    sources: TARGETS.map(t => {
      const item = allItems.find(i => (i.metadata as any)?.workId === t.id);
      return {
        id: t.id,
        name: t.name,
        nameZh: t.nameZh,
        url: t.url,
        priority: t.priority,
        tags: t.tags,
        words: item?.wordCount ?? 0,
        quality: item?.quality ?? 0,
        success: !!(item && item.wordCount > 0),
      };
    }),
  };

  // 写 manifest
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  // 写 manifest.jsonl
  const jsonl = allItems.map(item =>
    JSON.stringify({ id: item.id, source: item.source, wordCount: item.wordCount, quality: item.quality, language: item.language, metadata: item.metadata })
  ).join('\n');
  await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.jsonl'), jsonl, 'utf-8');

  // 生成报告
  const metrics = generateReport(allItems, TARGETS);
  const report = buildReport(TARGETS, metrics, elapsedMs);
  await fs.writeFile(REPORT_PATH, report, 'utf-8');

  // 汇总输出
  console.log('\n' + '='.repeat(50));
  console.log('📊 采集完成');
  console.log('='.repeat(50));
  console.log(`  目标总数:   ${TARGETS.length}`);
  console.log(`  成功:       ${allItems.length}`);
  console.log(`  总词数:     ${allItems.reduce((s, i) => s + i.wordCount, 0).toLocaleString()}`);
  console.log(`  总字符数:   ${allItems.reduce((s, i) => s + i.content.length, 0).toLocaleString()}`);
  console.log(`  平均质量:   ${metrics.averageQuality}/100`);
  console.log(`  耗时:       ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  错误数:     ${errors.length}`);
  if (errors.length > 0) {
    console.log(`  失败列表:`);
    errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('\n📁 输出文件:');
  console.log(`  ${REPORT_PATH}`);
  console.log(`  ${MANIFEST_PATH}`);
  console.log(`  ${path.join(OUTPUT_DIR, 'texts/')}`);
  console.log('='.repeat(50));
}

main().catch(console.error);
