/**
 * Prismatic — Forum / Lecture Collector
 * 论坛/讲座采集器
 *
 * 支持从学术会议、公司年会、公开讲座等来源采集内容
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

export class ForumCollector extends BaseCollector {
  readonly collectorType = 'forum';
  readonly displayName = '论坛/讲座采集器';

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];

    const url = target.url;

    // YouTube 视频（年会演讲通常会发布到 YouTube）
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return this.collectFromYouTube(target);
    }

    // 伯克希尔哈撒韦等股东大会
    if (url.includes('berkshirehathaway.com') || url.includes('brk')) {
      return this.collectFromBerkshire(target);
    }

    // 直接网页采集
    return this.collectFromPage(target);
  }

  private async collectFromYouTube(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    // 复用 VideoSubtitleCollector
    const { VideoSubtitleCollector } = await import('./video-collector');
    const videoCollector = new VideoSubtitleCollector();
    const items = await videoCollector.collect({ ...target, type: 'lecture' });

    return items.map(item => ({
      ...item,
      sourceType: 'forum',
    }));
  }

  private async collectFromBerkshire(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      const response = await this.fetchWithRetry(target.url);
      if (!response.ok) return [];

      const html = await response.text();
      const text = this.stripHtml(html);

      // 提取股东信链接
      const letterLinks = this.extractLinks(html, target.url, ['annual', 'letter', 'report']);

      const items: CollectedItem[] = [];

      // 主页面内容
      if (text.trim().length > 100) {
        items.push(this.createItem(
          text.slice(0, 10000),
          target.source,
          'forum',
          {
            url: target.url,
            metadata: { platform: 'berkshire', type: 'annual-meeting' },
          }
        ));
      }

      // 采集股东信
      for (const link of letterLinks.slice(0, 5)) {
        const letterContent = await this.fetchLetterContent(link);
        if (letterContent) {
          items.push(this.createItem(
            letterContent,
            `${target.source} 股东信`,
            'forum',
            {
              url: link,
              metadata: { platform: 'berkshire', type: 'shareholder-letter' },
            }
          ));
        }
      }

      return items;
    } catch (err) {
      console.error(`[ForumCollector] Berkshire failed:`, err);
      return [];
    }
  }

  private async collectFromPage(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];
    try {
      const response = await this.fetchWithRetry(target.url);
      if (!response.ok) return [];

      const html = await response.text();
      const meta = this.extractMeta(html);

      // 尝试提取字幕/文本内容
      const subtitlePatterns = [
        /<div[^>]*class="[^"]*(?:transcript|content|text)[^"]*"[^>]*>([\s\S]{100,})/i,
        /<article>([\s\S]{500,})<\/article>/i,
      ];

      for (const pattern of subtitlePatterns) {
        const match = html.match(pattern);
        if (match) {
          const content = this.stripHtml(match[1]).trim();
          if (content.length > 200) {
            return [this.createItem(
              content,
              target.source,
              'forum',
              {
                url: target.url,
                author: meta.author,
                publishedAt: meta.publishedAt,
                metadata: { title: meta.title },
              }
            )];
          }
        }
      }

      // Fallback: 全页文本
      const text = this.stripHtml(html);
      if (text.length > 200) {
        return [this.createItem(
          text.slice(0, 30000),
          target.source,
          'forum',
          {
            url: target.url,
            author: meta.author,
            publishedAt: meta.publishedAt,
            metadata: { title: meta.title },
          }
        )];
      }

      return [];
    } catch (err) {
      console.error(`[ForumCollector] Page failed:`, err);
      return [];
    }
  }

  private extractLinks(html: string, baseUrl: string, keywords: string[]): string[] {
    const links: string[] = [];
    const hrefMatches = html.match(/href=["']([^"']+)["']/gi) ?? [];

    for (const match of hrefMatches) {
      const hrefMatch = match.match(/href=["']([^"']+)["']/);
      if (!hrefMatch) continue;

      const href = hrefMatch[1];
      const lower = href.toLowerCase();

      if (keywords.some(k => lower.includes(k))) {
        try {
          links.push(new URL(href, baseUrl).href);
        } catch {
          // ignore
        }
      }
    }

    return [...new Set(links)];
  }

  private async fetchLetterContent(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(url);
      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/html')) {
        const html = await response.text();
        return this.stripHtml(html);
      }

      if (contentType.includes('text/plain')) {
        return await response.text();
      }

      // PDF 或其他格式，尝试文本提取
      const bytes = await response.arrayBuffer();
      const text = new TextDecoder().decode(bytes);
      return this.stripHtml(text);
    } catch {
      return null;
    }
  }
}
