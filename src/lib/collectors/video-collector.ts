/**
 * Prismatic — Video Subtitle Collector
 * 支持 YouTube 和 Bilibili 字幕采集
 */

import { BaseCollector } from './base-collector';
import type { CollectedItem, ScrapingTarget } from '../types';

export class VideoSubtitleCollector extends BaseCollector {
  readonly collectorType = 'video';
  readonly displayName = '视频字幕采集器';

  async collect(target: ScrapingTarget): Promise<CollectedItem[]> {
    if (!target.url) return [];

    const url = target.url;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return this.collectYouTube(url, target);
    }

    if (url.includes('bilibili.com')) {
      return this.collectBilibili(url, target);
    }

    return [];
  }

  // ─── YouTube ───────────────────────────────────────────────────────────────

  private async collectYouTube(videoUrl: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    const videoId = this.extractYouTubeId(videoUrl);
    if (!videoId) return [];

    // 方法1：尝试 YouTube Transcript API（无需 API Key）
    const captions = await this.fetchYouTubeCaptions(videoId);
    if (captions.length > 0) {
      return [this.createItem(
        captions.join('\n'),
        `YouTube/${videoId}`,
        'video',
        {
          url: videoUrl,
          metadata: {
            platform: 'youtube',
            videoId,
            captionType: 'auto-generated',
          },
        }
      )];
    }

    // 方法2：直接从网页提取字幕（作为备选）
    return this.fetchYouTubeFromPage(videoId, target);
  }

  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private async fetchYouTubeCaptions(videoId: string): Promise<string[]> {
    // 使用非官方 API 获取字幕
    try {
      // Amethystic 的字幕 API
      const apiUrl = `https://youtubetranscript.com/?v=${videoId}`;
      const response = await this.fetchWithRetry(apiUrl, { method: 'GET' });

      if (!response.ok) return [];

      const xml = await response.text();
      return this.parseYouTubeXML(xml);
    } catch {
      return [];
    }
  }

  private parseYouTubeXML(xml: string): string[] {
    const captions: string[] = [];
    const textMatches = xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/gi);

    for (const match of textMatches) {
      const text = this.stripHtml(match[2]).trim();
      if (text) captions.push(text);
    }

    return captions;
  }

  private async fetchYouTubeFromPage(videoId: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await this.fetchWithRetry(url);
      if (!response.ok) return [];

      const html = await response.text();

      // 尝试从页面中提取字幕 JSON
      const captionDataMatch = html.match(/"captionTracks":\s*\[(\{[^}]+\})\]\s*,/);
      if (!captionDataMatch) return [];

      const captionJson = captionDataMatch[1];
      const baseUrlMatch = captionJson.match(/"baseUrl"\s*:\s*"([^"]+)"/);
      if (!baseUrlMatch) return [];

      const captionUrl = decodeURIComponent(baseUrlMatch[1]);
      const captionResponse = await this.fetchWithRetry(captionUrl);
      if (!captionResponse.ok) return [];

      const xml = await captionResponse.text();
      const captions = this.parseYouTubeXML(xml);

      if (captions.length > 0) {
        return [this.createItem(
          captions.join('\n'),
          `YouTube/${videoId}`,
          'video',
          {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            metadata: { platform: 'youtube', videoId },
          }
        )];
      }
    } catch (err) {
      console.error(`[VideoCollector] YouTube page fetch failed:`, err);
    }

    return [];
  }

  // ─── Bilibili ─────────────────────────────────────────────────────────────

  private async collectBilibili(videoUrl: string, target: ScrapingTarget): Promise<CollectedItem[]> {
    const bvid = this.extractBilibiliId(videoUrl);
    if (!bvid) return [];

    try {
      // Bilibili 字幕 API
      const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
      const response = await this.fetchWithRetry(apiUrl);

      if (!response.ok) return [];

      const data = await response.json();
      if (data.code !== 0) return [];

      const cid = data.data?.cid;
      if (!cid) return [];

      // 获取字幕
      const subtitleUrl = `https://api.bilibili.com/x/web-interface/subtitle?sid=${cid}`;
      const subResponse = await this.fetchWithRetry(subtitleUrl);

      if (!subResponse.ok) return [];

      const subData = await subResponse.json();
      const subtitles: string[] = [];

      for (const item of subData.data?.subtitle?.subtitles ?? []) {
        const subContentUrl = item?.subtitle_url;
        if (subContentUrl) {
          const contentResponse = await this.fetchWithRetry(
            `https:${subContentUrl}`
          );
          if (contentResponse.ok) {
            const content = await contentResponse.json();
            for (const line of content?.body ?? []) {
              if (line?.content) {
                subtitles.push(line.content);
              }
            }
          }
        }
      }

      if (subtitles.length > 0) {
        return [this.createItem(
          subtitles.join('\n'),
          `Bilibili/${bvid}`,
          'video',
          {
            url: videoUrl,
            metadata: {
              platform: 'bilibili',
              bvid,
              cid: String(cid),
              title: data.data?.title ?? '',
            },
          }
        )];
      }
    } catch (err) {
      console.error(`[VideoCollector] Bilibili failed:`, err);
    }

    return [];
  }

  private extractBilibiliId(url: string): string | null {
    const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+|av\d+)/i);
    return match ? match[1] : null;
  }
}
