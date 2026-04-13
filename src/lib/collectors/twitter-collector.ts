/**
 * Prismatic — Twitter/X Collector
 * 支持 Nitter 镜像（无需 API Key）
 * 回退：解析 Twitter Archive（如果有）
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://xcancel.com',
];

export class TwitterCollector extends BaseCollector {
  readonly collectorType = 'twitter';
  readonly displayName = 'Twitter/X 采集器';

  private activeInstance: string | null = null;

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    // 如果提供了 Twitter Handle
    const handle = this.extractHandle(target.source);
    if (!handle) return [];

    // 先探测可用实例
    await this.detectInstance();

    if (!this.activeInstance) {
      console.warn('[TwitterCollector] No Nitter instance available');
      return [];
    }

    return this.collectFromNitter(handle);
  }

  private extractHandle(source: string): string | null {
    // 从 source 中提取 Twitter handle
    const match = source.match(/@?([a-zA-Z0-9_]{1,15})/i);
    return match ? match[1] : null;
  }

  private async detectInstance(): Promise<void> {
    for (const instance of NITTER_INSTANCES) {
      try {
        const response = await this.fetchWithRetry(`${instance}/`, {
          method: 'HEAD',
        });
        if (response.ok) {
          this.activeInstance = instance;
          return;
        }
      } catch {
        // 继续尝试下一个实例
      }
    }
    this.activeInstance = null;
  }

  private async collectFromNitter(handle: string): Promise<CollectedItem[]> {
    const items: CollectedItem[] = [];
    const maxPages = 5;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const url = page === 1
          ? `${this.activeInstance}/${handle}`
          : `${this.activeInstance}/${handle}?cursor=page${page}`;

        const response = await this.fetchWithRetry(url);
        if (!response.ok) break;

        const html = await response.text();
        const tweets = this.parseTweets(html);

        if (tweets.length === 0) break;

        for (const tweet of tweets) {
          items.push(this.createItem(
            tweet.text,
            `Twitter/@${handle}`,
            'twitter',
            {
              url: tweet.url,
              publishedAt: tweet.date,
              metadata: {
                likes: tweet.likes,
                retweets: tweet.retweets,
                isRetweet: tweet.isRetweet,
              },
            }
          ));
        }

        // 限速：每页间隔
        if (page < maxPages) {
          await this.sleep(2000);
        }
      } catch (err) {
        console.error(`[TwitterCollector] Page ${page} failed:`, err);
        break;
      }
    }

    return items;
  }

  private parseTweets(html: string): {
    text: string;
    date: string;
    likes: string;
    retweets: string;
    url: string;
    isRetweet: string;
  }[] {
    const tweets: {
      text: string;
      date: string;
      likes: string;
      retweets: string;
      url: string;
      isRetweet: string;
    }[] = [];

    // 匹配推文容器
    const tweetRegex = /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    const matches = [...html.matchAll(tweetRegex)];

    for (const match of matches) {
      const tweetHtml = match[1];

      // 提取推文文本
      const textMatch = tweetHtml.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (!textMatch) continue;

      const rawText = this.stripHtml(textMatch[1]).trim();
      if (rawText.length < 5) continue;

      // 提取时间
      const dateMatch = tweetHtml.match(/<span class="tweet-date[^"]*"[^>]*>.*?title=["']([^"']+)["']/i);
      const date = dateMatch ? dateMatch[1].trim() : '';

      // 提取互动数据 (avoid 's' flag for es2017 compat, use [\s\S])
      const likesMatch = tweetHtml.match(/<span class="tweet-stat[^>]*>[\s\S]*?<div class="tweet-stat-count[^>]*>([^<]+)<\/div>[\s\S]*?likes[\s\S]*?<\/span>/i);
      const retweetsMatch = tweetHtml.match(/<span class="tweet-stat[^>]*>[\s\S]*?<div class="tweet-stat-count[^>]*>([^<]+)<\/div>[\s\S]*?retweets[\s\S]*?<\/span>/i);

      const likes = likesMatch ? likesMatch[1].trim() : '0';
      const retweets = retweetsMatch ? retweetsMatch[1].trim() : '0';

      // 提取链接
      const linkMatch = tweetHtml.match(/<a class="tweet-link[^"]*"[^>]*href=["']([^"']+)["']/i);
      const url = linkMatch ? linkMatch[1] : '';

      // 是否为转推
      const isRetweet = (tweetHtml.includes('retweet-icon') || tweetHtml.includes('fa-retweet')) ? 'true' : 'false';

      tweets.push({ text: rawText, date, likes, retweets, url, isRetweet });
    }

    return tweets;
  }

  // ─── 备用：解析 Twitter Archive JSON ───────────────────────────────────────

  async collectFromArchive(archivePath: string): Promise<CollectedItem[]> {
    // 如果有 Twitter 数据存档，直接读取 JSON
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(archivePath, 'utf-8');
      const tweets = JSON.parse(data);

      return (Array.isArray(tweets) ? tweets : []).map((t: any) =>
        this.createItem(
          t.text ?? t.full_text ?? '',
          'Twitter Archive',
          'twitter',
          {
            publishedAt: t.created_at ?? t.date ?? '',
            metadata: {
              likes: String(t.favorite_count ?? 0),
              retweets: String(t.retweet_count ?? 0),
              id: t.id_str ?? String(t.id ?? ''),
            },
          }
        )
      );
    } catch (err) {
      console.error(`[TwitterCollector] Archive read failed:`, err);
      return [];
    }
  }
}
