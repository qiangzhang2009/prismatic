/**
 * Prismatic — Podcast/Interview Collector
 * 支持播客音频转录（通过 YouTube 字幕）
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';
import { VideoSubtitleCollector } from './video-collector';

export class PodcastCollector extends BaseCollector {
  readonly collectorType = 'podcast';
  readonly displayName = '播客/访谈采集器';

  private videoCollector: VideoSubtitleCollector;

  constructor(config?: Partial<import('../types').CollectorConfig>) {
    super(config);
    this.videoCollector = new VideoSubtitleCollector(config);
  }

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];

    const url = target.url;

    // 如果是 YouTube 链接（播客通常在 YouTube 上发布），使用字幕采集
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const items = await this.videoCollector.collect({
        ...target,
        type: 'podcast',
      });

      // 标记为播客类型
      return items.map(item => ({
        ...item,
        sourceType: 'podcast' as const,
      }));
    }

    // 如果是播客 RSS feed
    if (url.includes('.xml') || url.includes('feed')) {
      return this.collectFromRSS(url, target);
    }

    // 如果是播客平台链接
    if (url.includes('spotify.com') || url.includes('apple.com/podcast')) {
      return this.collectPodcastMetadata(url, target);
    }

    return [];
  }

  // ─── RSS Feed ─────────────────────────────────────────────────────────────

  private async collectFromRSS(feedUrl: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    const items: CollectedItem[] = [];

    try {
      const response = await this.fetchWithRetry(feedUrl);
      if (!response.ok) return [];

      const xml = await response.text();
      const episodes = this.parsePodcastRSS(xml);

      for (const episode of episodes.slice(0, 10)) {
        // 尝试获取转录（如果有字幕链接）
        if (episode.transcriptUrl) {
          const transcript = await this.fetchTranscript(episode.transcriptUrl);
          if (transcript) {
            items.push(this.createItem(
              transcript,
              feedUrl,
              'podcast',
              {
                publishedAt: episode.pubDate,
                metadata: {
                  title: episode.title,
                  description: episode.description,
                  duration: episode.duration,
                },
              }
            ));
          }
        }
      }
    } catch (err) {
      console.error(`[PodcastCollector] RSS failed:`, err);
    }

    return items;
  }

  private parsePodcastRSS(xml: string): Array<{
    title: string;
    description: string;
    pubDate: string;
    duration: string;
    transcriptUrl?: string;
  }> {
    const episodes: Array<{
      title: string;
      description: string;
      pubDate: string;
      duration: string;
      transcriptUrl?: string;
    }> = [];

    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];

    for (const item of itemMatches) {
      const title = item.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? '';
      const description = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? '';
      const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1]?.trim() ?? '';
      const duration = item.match(/<itunes:duration>([^<]+)<\/itunes:duration>/i)?.[1]?.trim() ?? '';

      // 寻找转录链接
      const transcriptMatch = item.match(/<transcript[^>]+url=["']([^"']+)["']/i)
        ?? item.match(/<a href=["']([^"']+transcript[^"']+)["'][^>]*>transcript<\/a>/i);

      episodes.push({
        title,
        description: this.stripHtml(description),
        pubDate,
        duration,
        transcriptUrl: transcriptMatch ? transcriptMatch[1] : undefined,
      });
    }

    return episodes;
  }

  private async fetchTranscript(url: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(url);
      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('json')) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data.map((s: any) => s.text ?? s.content ?? '').join('\n');
        }
      }

      return await response.text();
    } catch {
      return null;
    }
  }

  // ─── Metadata Only ───────────────────────────────────────────────────────

  private async collectPodcastMetadata(url: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    // 对于不支持转录的平台，返回元数据
    try {
      const response = await this.fetchWithRetry(url);
      if (!response.ok) return [];

      const html = await response.text();
      const text = this.stripHtml(html);

      return [this.createItem(
        text.slice(0, 2000),
        target.source,
        'podcast',
        {
          url,
          metadata: {
            platform: url.includes('spotify') ? 'spotify' : 'apple-podcasts',
            description: 'Podcasts from this platform require audio transcription',
          },
        }
      )];
    } catch {
      return [];
    }
  }
}
