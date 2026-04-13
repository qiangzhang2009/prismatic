/**
 * Prismatic — Collectors Index
 * 统一导出所有采集器
 */

export { BaseCollector, ScrapingCoordinator, mergeCollectedItems } from './base-collector';
export type { ProgressCallback } from './base-collector';

export { BlogCollector } from './blog-collector';
export { TwitterCollector } from './twitter-collector';
export { VideoSubtitleCollector } from './video-collector';
export { PodcastCollector } from './podcast-collector';

import { BlogCollector } from './blog-collector';
import { TwitterCollector } from './twitter-collector';
import { VideoSubtitleCollector } from './video-collector';
import { PodcastCollector } from './podcast-collector';
import { ScrapingCoordinator } from './base-collector';
import type { CollectorConfig, ScrapingTarget } from '../types';

/**
 * 创建并配置采集协调器
 */
export function createCoordinator(config?: Partial<CollectorConfig>): ScrapingCoordinator {
  const coordinator = new ScrapingCoordinator(config);

  coordinator.register('blog', new BlogCollector(config));
  coordinator.register('twitter', new TwitterCollector(config));
  coordinator.register('video', new VideoSubtitleCollector(config));
  coordinator.register('podcast', new PodcastCollector(config));
  coordinator.register('book', new BlogCollector(config));
  coordinator.register('interview', new PodcastCollector(config));
  coordinator.register('weibo', new BlogCollector(config));

  return coordinator;
}

/**
 * 快速采集指定目标
 */
export async function quickCollect(
  target: ScrapingTarget,
  config?: Partial<CollectorConfig>
): Promise<import('../types').CollectedItem[]> {
  const coordinator = createCoordinator(config);
  const collector = coordinator.getCollector(target.collectorType);

  if (!collector) {
    throw new Error(`Unknown collector type: ${target.collectorType}`);
  }

  const result = await collector.run(target);
  return result.items;
}
