/**
 * Prismatic — Book Collector
 * 书籍数据采集器
 *
 * 支持从 Project Gutenberg、互联网档案馆等公开来源采集书籍内容
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

export class BookCollector extends BaseCollector {
  readonly collectorType = 'book';
  readonly displayName = '书籍采集器';

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];

    const url = target.url;

    // Project Gutenberg
    if (url.includes('gutenberg.org') || url.includes('gutenberg.net')) {
      return this.collectFromGutenberg(target);
    }

    // Internet Archive
    if (url.includes('archive.org')) {
      return this.collectFromArchive(target);
    }

    // Direct file (txt, html, epub)
    if (url.match(/\.(txt|html?|epub)$/i)) {
      return this.collectDirectFile(target);
    }

    // Fallback: generic web scraping
    return this.collectFromPage(target);
  }

  private async collectFromGutenberg(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      // 获取纯文本版本
      let textUrl = target.url;
      if (!textUrl.includes('/files/') && !textUrl.endsWith('.txt')) {
        // 从 HTML 页面获取纯文本链接
        const response = await this.fetchWithRetry(target.url);
        if (!response.ok) return [];

        const html = await response.text();
        const plainLinkMatch = html.match(/href="([^"]*\.txt[^"]*)"/);
        if (plainLinkMatch) {
          textUrl = new URL(plainLinkMatch[1], target.url).href;
        } else {
          // 尝试直接替换
          textUrl = target.url.replace(/\/[\d]+\/$/, `/${this.extractId(target.url)}/0`) + '.txt';
        }
      }

      const textResponse = await this.fetchWithRetry(textUrl);
      if (!textResponse.ok) return [];

      const content = await textResponse.text();
      const cleaned = this.cleanBookText(content);

      if (cleaned.length < 500) return [];

      return [this.createItem(
        cleaned,
        target.source,
        'book',
        {
          url: textUrl,
          metadata: {
            platform: 'gutenberg',
            title: this.extractBookTitle(content),
          },
        }
      )];
    } catch (err) {
      console.error(`[BookCollector] Gutenberg failed:`, err);
      return [];
    }
  }

  private async collectFromArchive(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      const metadataUrl = target.url.replace('/details/', '/download/') + '/metadata.json';
      const response = await this.fetchWithRetry(metadataUrl);

      if (!response.ok) return [];

      const meta = await response.json();
      const files = meta?.files ?? [];
      const plainTextFile = files.find((f: any) =>
        f.name?.endsWith('.txt') || f.format === 'Text'
      );

      if (!plainTextFile) return [];

      const textUrl = `${target.url.replace('/details/', '/download/')}/${plainTextFile.name}`;
      const textResponse = await this.fetchWithRetry(textUrl);

      if (!textResponse.ok) return [];

      const content = await textResponse.text();
      const cleaned = this.cleanBookText(content);

      if (cleaned.length < 500) return [];

      return [this.createItem(
        cleaned,
        target.source,
        'book',
        {
          url: textUrl,
          metadata: {
            platform: 'archive.org',
            title: meta?.metadata?.title ?? target.source,
          },
        }
      )];
    } catch (err) {
      console.error(`[BookCollector] Archive failed:`, err);
      return [];
    }
  }

  private async collectDirectFile(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      const response = await this.fetchWithRetry(target.url);
      if (!response.ok) return [];

      let content = await response.text();

      if (target.url.endsWith('.html') || target.url.endsWith('.htm')) {
        content = this.stripHtml(content);
      }

      const cleaned = this.cleanBookText(content);

      if (cleaned.length < 500) return [];

      return [this.createItem(
        cleaned,
        target.source,
        'book',
        {
          url: target.url,
          metadata: {
            platform: 'direct',
            source: target.source,
          },
        }
      )];
    } catch (err) {
      console.error(`[BookCollector] Direct file failed:`, err);
      return [];
    }
  }

  private async collectFromPage(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      const response = await this.fetchWithRetry(target.url);
      if (!response.ok) return [];

      const html = await response.text();
      const text = this.stripHtml(html);

      return [this.createItem(
        text.slice(0, 50000),
        target.source,
        'book',
        {
          url: target.url,
          metadata: { platform: 'web' },
        }
      )];
    } catch (err) {
      console.error(`[BookCollector] Page failed:`, err);
      return [];
    }
  }

  private extractId(url: string): string {
    const match = url.match(/\/(\d+)\//);
    return match ? match[1] : '0';
  }

  private extractBookTitle(content: string): string {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    return lines[0]?.slice(0, 100) ?? 'Unknown';
  }

  private cleanBookText(text: string): string {
    return text
      // 移除 Project Gutenberg header/footer
      .replace(/\*\*\* START OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
      .replace(/\*\*\* END OF (?:THE |)PROJECT GUTENBERG[\s\S]*?\*\*\*/i, '')
      // 移除页眉页脚
      .replace(/^\s*Chapter\s+\w+\s*$/gim, '')
      // 规范化换行
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
