/**
 * Prismatic — Blog/Article Collector
 * 支持 RSS + 直接网页抓取，自动提取正文
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

export class BlogCollector extends BaseCollector {
  readonly collectorType = 'blog';
  readonly displayName = '博客/文章采集器';

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    const items: CollectedItem[] = [];

    if (target.url) {
      const article = await this.collectArticle(target);
      if (article) items.push(article);
    }

    return items;
  }

  private async collectArticle(target: ScrapingTarget): Promise<CollectedItem | null> {
    try {
      const response = await this.fetchWithRetry(target.url!, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const text = this.stripHtml(html);
      const meta = this.extractMeta(html);

      return this.createItem(text, target.source, 'blog', {
        url: target.url,
        author: meta.author ?? target.source,
        publishedAt: meta.publishedAt,
        metadata: {
          title: meta.title,
          description: meta.description,
        },
      });
    } catch (err) {
      console.error(`[BlogCollector] Failed to collect ${target.url}:`, err);
      return null;
    }
  }

  async collectRSS(feedUrl: string): Promise<CollectedItem[]> {
    const items: CollectedItem[] = [];

    try {
      const response = await this.fetchWithRetry(feedUrl);
      if (!response.ok) return items;

      const xml = await response.text();
      const entries = this.parseRSS(xml);

      for (const entry of entries.slice(0, 20)) {
        const article = await this.collectArticle({
          ...{} as ScrapingTarget,
          url: entry.link,
          source: feedUrl,
          collectorType: 'blog',
          type: 'blog',
          status: 'pending',
          itemsCollected: 0,
          retryCount: 0,
          createdAt: new Date(),
        });

        if (article) {
          article.publishedAt = entry.pubDate;
          article.metadata = { title: entry.title };
          items.push(article);
        }
      }
    } catch (err) {
      console.error(`[BlogCollector] RSS failed:`, err);
    }

    return items;
  }

  private parseRSS(xml: string): Array<{ title: string; link: string; pubDate: string }> {
    const entries: Array<{ title: string; link: string; pubDate: string }> = [];

    const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];
    for (const item of itemMatches) {
      const title = item.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/i)?.[1]
        ?? item.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
        ?? '';
      const link = item.match(/<link[^>]*><!\[CDATA\[([^\]]+)\]\]><\/link>/i)?.[1]
        ?? item.match(/<link>([^<]+)<\/link>/i)?.[1]
        ?? '';
      const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]
        ?? item.match(/<dc:date>([^<]+)<\/dc:date>/i)?.[1]
        ?? '';

      if (title && link) {
        entries.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim() });
      }
    }

    return entries;
  }
}
