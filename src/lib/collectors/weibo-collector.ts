/**
 * Prismatic — Weibo Collector
 * 微博数据采集器
 *
 * 支持从微博用户的关注页/搜索结果中提取微博内容
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

export class WeiboCollector extends BaseCollector {
  readonly collectorType = 'weibo';
  readonly displayName = '微博采集器';

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url && !target.source) {
      return [];
    }

    // 如果提供了 URL（微博搜索结果页/用户主页）
    if (target.url) {
      return this.collectFromPage(target);
    }

    // 如果只提供了 handle
    const handle = this.extractHandle(target.source);
    if (!handle) return [];

    return this.collectFromUserPage(handle, target);
  }

  private extractHandle(source: string): string | null {
    const match = source.match(/@?([\w\u4e00-\u9fa5]{2,20})/i);
    return match ? match[1] : null;
  }

  private async collectFromPage(target: ScrapingTarget): Promise<CollectedItem[]> {
    try {
      const response = await this.fetchWithRetry(target.url!, {
        method: 'GET',
      });

      if (!response.ok) return [];

      const html = await response.text();
      return this.parseWeiboPage(html, target);
    } catch (err) {
      console.error(`[WeiboCollector] Failed to collect ${target.url}:`, err);
      return [];
    }
  }

  private async collectFromUserPage(handle: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    // 构造微博用户主页 URL
    const userUrl = `https://m.weibo.cn/u/${encodeURIComponent(handle)}`;

    try {
      const response = await this.fetchWithRetry(userUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://m.weibo.cn/',
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return this.parseUserData(data, handle, target);
    } catch (err) {
      console.error(`[WeiboCollector] User page failed for ${handle}:`, err);
      return [];
    }
  }

  private parseWeiboPage(html: string, target: ScrapingTarget): CollectedItem[] {
    const items: CollectedItem[] = [];

    // 尝试提取微博 JSON 数据
    const jsonMatches = html.match(/"text":\s*"([^"]{10,})"/g) ?? [];
    const retweetMatches = html.match(/"retweeted_status":\s*\{[^}]+\}/g) ?? [];

    // 提取正文
    for (const match of jsonMatches) {
      const textMatch = match.match(/"text":\s*"([^"]+)"/);
      if (textMatch && textMatch[1]) {
        const content = this.decodeWeiboText(textMatch[1]);
        if (content.length < 5) continue;

        items.push(this.createItem(
          content,
          target.source,
          'weibo',
          {
            url: target.url,
            metadata: { platform: 'weibo' },
          }
        ));
      }
    }

    // 提取转发内容
    for (const match of retweetMatches) {
      const textMatch = match.match(/"text":\s*"([^"]+)"/);
      if (textMatch && textMatch[1]) {
        const content = this.decodeWeiboText(textMatch[1]);
        if (content.length < 5) continue;

        items.push(this.createItem(
          content,
          `${target.source} (转发)`,
          'weibo',
          {
            metadata: { platform: 'weibo', isRetweet: 'true' },
          }
        ));
      }
    }

    return items;
  }

  private parseUserData(data: any, handle: string, target: ScrapingTarget): CollectedItem[] {
    const items: CollectedItem[] = [];

    if (!data?.data?.statuses) return [];

    for (const status of data.data.statuses.slice(0, 50)) {
      const content = this.decodeWeiboText(status.text ?? '');
      if (content.length < 5) continue;

      const createdAt = status.created_at
        ? new Date(status.created_at).toISOString()
        : undefined;

      items.push(this.createItem(
        content,
        `微博/@${handle}`,
        'weibo',
        {
          url: `https://weibo.com/${status.user?.idstr ?? handle}/status/${status.idstr}`,
          publishedAt: createdAt,
          metadata: {
            platform: 'weibo',
            likes: String(status.attitudes_count ?? 0),
            comments: String(status.comments_count ?? 0),
            reposts: String(status.reposts_count ?? 0),
            isRetweet: String(status.retweeted_status ? 'true' : 'false'),
          },
        }
      ));
    }

    return items;
  }

  private decodeWeiboText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .trim();
  }
}
