/**
 * Prismatic — Base Collector
 * JARVIS 风格的统一采集器基类
 *
 * 设计原则：
 * - 统一接口：所有采集器继承 BaseCollector
 * - 自动重试：指数退避 + 最大重试次数
 * - 进度追踪：实时推送 ScrapingProgress 事件
 * - Graceful Degradation：单个源失败不影响整体
 * - 速率限制：尊重目标站点的 robots.txt
 */

import { nanoid } from 'nanoid';
import type {
  CollectorConfig,
  CollectorStatus,
  CollectedItem,
  ScrapingProgress,
  ScrapingTarget,
} from '../types';

export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  parallelLimit: 4,
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; PrismaticBot/1.0; +https://prismatic.zxqconsulting.com)',
  respectRobotsTxt: true,
};

// ─── Progress Callback Type ──────────────────────────────────────────────────

export type ProgressCallback = (progress: ScrapingProgress) => void;

// ─── Base Collector ──────────────────────────────────────────────────────────

export abstract class BaseCollector {
  abstract readonly collectorType: string;
  abstract readonly displayName: string;

  protected config: CollectorConfig;
  public progressCallback?: ProgressCallback;

  constructor(
    config: Partial<CollectorConfig> = {},
    progressCallback?: ProgressCallback
  ) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.progressCallback = progressCallback;
  }

  // ─── Abstract Methods ──────────────────────────────────────────────────────

  abstract collect(target: ScrapingTarget): Promise<CollectedItem[]>;

  // ─── Protected Helpers ──────────────────────────────────────────────────────

  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...(options.headers as Record<string, string> ?? {}),
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);

      if (attempt >= this.config.retryCount) {
        throw err;
      }

      const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);

      return this.fetchWithRetry(url, options, attempt + 1);
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected reportProgress(
    targetId: string,
    status: string,
    itemsCollected: number,
    estimatedTotal: number,
    errors: number,
    elapsedMs: number,
    currentUrl?: string
  ): void {
    const rate = elapsedMs > 0 ? (itemsCollected / (elapsedMs / 60000)) : 0;

    const progress: ScrapingProgress = {
      targetId,
      status,
      itemsCollected,
      estimatedTotal,
      rate: Math.round(rate * 10) / 10,
      errors,
      elapsedMs,
      currentUrl,
    };

    this.progressCallback?.(progress);
  }

  protected createItem(
    content: string,
    source: string,
    sourceType: CollectedItem['sourceType'],
    metadata: Partial<CollectedItem> = {}
  ): CollectedItem {
    const language = this.detectLanguage(content);

    return {
      id: nanoid(10),
      source,
      sourceType,
      content,
      author: metadata.author,
      publishedAt: metadata.publishedAt,
      url: metadata.url,
      metadata: metadata.metadata,
      wordCount: this.countWords(content),
      language,
      quality: metadata.quality ?? this.assessQuality(content),
      ...metadata,
    };
  }

  protected detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
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

  protected countWords(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const english = (text.match(/[a-zA-Z]+/g) ?? []).length;
    return chinese + english;
  }

  protected assessQuality(content: string): number {
    // 基础质量评估
    let score = 50;

    // 长度奖励
    const wordCount = this.countWords(content);
    if (wordCount > 500) score += 20;
    else if (wordCount > 200) score += 10;
    else if (wordCount < 50) score -= 20;

    // 内容丰富度
    const uniqueWords = new Set(content.toLowerCase());
    const ratio = uniqueWords.size / Math.max(1, content.length);
    if (ratio > 0.1) score += 15;
    else if (ratio < 0.03) score -= 15;

    // 去除重复内容
    const repeatedPatterns = content.match(/(.{20,})\1{2,}/g);
    if (repeatedPatterns) score -= repeatedPatterns.length * 10;

    return Math.max(0, Math.min(100, score));
  }

  protected stripHtml(html: string): string {
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

  protected extractMeta(html: string): Record<string, string> {
    const meta: Record<string, string> = {};

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) meta.title = titleMatch[1].trim();

    // Description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) meta.description = descMatch[1].trim();

    // Author
    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
    if (authorMatch) meta.author = authorMatch[1].trim();

    // Published date
    const dateMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (dateMatch) meta.publishedAt = dateMatch[1];

    return meta;
  }

  // ─── Run Method (for standalone execution) ─────────────────────────────────

  async run(target: ScrapingTarget): Promise<{
    items: CollectedItem[];
    status: CollectorStatus;
    errors: string[];
  }> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      this.reportProgress(target.id, 'running', 0, target.estimatedTotal ?? 100, 0, 0);
      const items = await this.collect(target);
      this.reportProgress(
        target.id,
        'done',
        items.length,
        items.length,
        errors.length,
        Date.now() - startTime
      );
      return { items, status: 'done', errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(errorMsg);
      this.reportProgress(
        target.id,
        'failed',
        0,
        target.estimatedTotal ?? 100,
        errors.length,
        Date.now() - startTime,
        target.url
      );
      return { items: [], status: 'failed', errors };
    }
  }
}

// ─── ScrapingCoordinator ─────────────────────────────────────────────────────

export class ScrapingCoordinator {
  private collectors: Map<string, BaseCollector> = new Map();
  private config: CollectorConfig;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
  }

  register(collectorType: string, collector: BaseCollector): void {
    this.collectors.set(collectorType, collector);
  }

  getCollector(collectorType: string): BaseCollector | undefined {
    return this.collectors.get(collectorType);
  }

  async runCollection(
    targets: ScrapingTarget[],
    onProgress?: ProgressCallback
  ): Promise<Map<string, { items: CollectedItem[]; error?: string }>> {
    const results = new Map<string, { items: CollectedItem[]; error?: string }>();
    const semaphore = new Semaphore(this.config.parallelLimit);

    const tasks = targets.map(async (target) => {
      await semaphore.acquire();

      try {
        const collector = this.collectors.get(target.collectorType);
        if (!collector) {
          return { targetId: target.id, items: [], error: `Unknown collector: ${target.collectorType}` };
        }

        collector.progressCallback = onProgress;
        const result = await collector.run(target);
        return { targetId: target.id, items: result.items, error: result.errors[0] };
      } finally {
        semaphore.release();
      }
    });

    const settled = await Promise.all(tasks);

    for (const result of settled) {
      results.set(result.targetId, {
        items: result.items,
        error: result.error,
      });
    }

    return results;
  }
}

// ─── Semaphore ──────────────────────────────────────────────────────────────

class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function mergeCollectedItems(
  results: Map<string, { items: CollectedItem[]; error?: string }>
): CollectedItem[] {
  const allItems: CollectedItem[] = [];

  for (const result of results.values()) {
    allItems.push(...result.items);
  }

  // 去重（基于内容前100字的hash）
  const seen = new Set<string>();
  return allItems.filter(item => {
    const hash = item.content.slice(0, 100).toLowerCase().trim();
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}
