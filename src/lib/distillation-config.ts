/**
 * Prismatic — Distillation Configuration
 * 每个 Persona 的蒸馏配置：采集计划、优先级、技能映射
 */

import { nanoid } from 'nanoid';
import type { ScrapingTarget } from './types';
import type { CollectorType } from './types';

// ─── Per-Persona Distillation Config ─────────────────────────────────────────

export interface PersonaDistillationConfig {
  personaId: string;
  priority: 'P0' | 'P1' | 'P2';
  collectorTargets: CollectorTarget[];
  skillSet: string[];
  defaultTestCategories: string[];
  playtestCaseCount: number;
  minCorpusSize: number; // bytes
  notes?: string;
}

export interface CollectorTarget {
  collectorType: string;
  source: string;
  url?: string;
  priority: number;
  estimatedItems: number;
  notes?: string;
}

// ─── 人物配置表 ───────────────────────────────────────────────────────────────

export const DISTILLATION_CONFIG: Record<string, PersonaDistillationConfig> = {

  // ─── P0: 最高优先级 ──────────────────────────────────────────────────────

  'nassim-taleb': {
    personaId: 'nassim-taleb',
    priority: 'P0',
    collectorTargets: [
      { collectorType: 'twitter', source: '@nntaleb', priority: 1, estimatedItems: 50000, notes: '最重要缺口 — Twitter 全量' },
      { collectorType: 'book', source: '书籍', url: '', priority: 2, estimatedItems: 5, notes: 'Incerto 系列其他书籍' },
      { collectorType: 'blog', source: 'Medium/Fooled By Randomness', url: 'https://medium.com/@nntaleb', priority: 3, estimatedItems: 500, notes: 'Medium 博客' },
    ],
    skillSet: ['second-order', 'common-fallacy', 'probabilistic', 'inversion'],
    defaultTestCategories: ['philosophy', 'probability', 'ethics', 'risk'],
    playtestCaseCount: 15,
    minCorpusSize: 500000,
    notes: 'Twitter 数据是最重要的语料来源',
  },

  'ilya-sutskever': {
    personaId: 'ilya-sutskever',
    priority: 'P0',
    collectorTargets: [
      { collectorType: 'twitter', source: '@ilyasut', priority: 1, estimatedItems: 5000, notes: '推文数据' },
      { collectorType: 'video', source: 'YouTube', priority: 2, estimatedItems: 20, notes: '学术演讲、访谈视频' },
      { collectorType: 'blog', source: 'OpenAI Blog / Academic Papers', url: '', priority: 3, estimatedItems: 30, notes: '论文和博客' },
    ],
    skillSet: ['first-principles', 'concept-decomposition'],
    defaultTestCategories: ['technology', 'science', 'philosophy'],
    playtestCaseCount: 10,
    minCorpusSize: 200000,
  },

  'zhang-xuefeng': {
    personaId: 'zhang-xuefeng',
    priority: 'P0',
    collectorTargets: [
      { collectorType: 'video', source: 'Bilibili', priority: 1, estimatedItems: 200, notes: 'B站/抖音视频字幕 — 核心缺口' },
      { collectorType: 'blog', source: '知乎', priority: 2, estimatedItems: 100, notes: '知乎回答' },
      { collectorType: 'weibo', source: '微博', priority: 3, estimatedItems: 500, notes: '微博语录' },
    ],
    skillSet: ['teaching-analogy', 'concept-decomposition', 'quote-usage'],
    defaultTestCategories: ['education', 'philosophy', 'psychology'],
    playtestCaseCount: 15,
    minCorpusSize: 300000,
    notes: 'B站视频字幕是最重要的语料来源',
  },

  'andrej-karpathy': {
    personaId: 'andrej-karpathy',
    priority: 'P0',
    collectorTargets: [
      { collectorType: 'twitter', source: '@karpathy', priority: 1, estimatedItems: 5000, notes: '推文' },
      { collectorType: 'video', source: 'YouTube', priority: 2, estimatedItems: 50, notes: '视频字幕（Stanford课程等）' },
      { collectorType: 'blog', source: '博客', url: 'https://karpathy.github.io', priority: 3, estimatedItems: 20, notes: '博客文章' },
    ],
    skillSet: ['first-principles', 'concept-decomposition', 'teaching-analogy'],
    defaultTestCategories: ['technology', 'science', 'education'],
    playtestCaseCount: 10,
    minCorpusSize: 300000,
  },

  // ─── P1: 高优先级 ──────────────────────────────────────────────────────

  'elon-musk': {
    personaId: 'elon-musk',
    priority: 'P1',
    collectorTargets: [
      { collectorType: 'twitter', source: '@elonmusk', priority: 1, estimatedItems: 20000, notes: '已有 87,921 条' },
      { collectorType: 'video', source: 'GTC / Tesla 财报会议', priority: 2, estimatedItems: 100, notes: 'GTC 大会字幕 — 重要缺口' },
      { collectorType: 'podcast', source: 'Joe Rogan / Lex Fridman', priority: 3, estimatedItems: 5, notes: '深度访谈' },
    ],
    skillSet: ['first-principles', 'long-term-thinking', 'startup-frame'],
    defaultTestCategories: ['technology', 'entrepreneurship', 'philosophy'],
    playtestCaseCount: 12,
    minCorpusSize: 500000,
  },

  'paul-graham': {
    personaId: 'paul-graham',
    priority: 'P1',
    collectorTargets: [
      { collectorType: 'twitter', source: '@paulg', priority: 1, estimatedItems: 3000, notes: '推文 — 重要缺口' },
      { collectorType: 'blog', source: 'Paul Graham Essays', url: 'http://paulgraham.com', priority: 2, estimatedItems: 229, notes: '已有 229 篇' },
      { collectorType: 'video', source: 'YC Startup Class', priority: 3, estimatedItems: 20, notes: 'YC 创业课' },
    ],
    skillSet: ['first-principles', 'startup-frame', 'teaching-analogy'],
    defaultTestCategories: ['entrepreneurship', 'technology', 'philosophy'],
    playtestCaseCount: 10,
    minCorpusSize: 400000,
  },

  'charlie-munger': {
    personaId: 'charlie-munger',
    priority: 'P1',
    collectorTargets: [
      { collectorType: 'video', source: 'Berkshire Hathaway 年会', priority: 1, estimatedItems: 5000, notes: '2023-2024 最新股东会 — 重要缺口' },
      { collectorType: 'podcast', source: 'Daily Journal 年会', priority: 2, estimatedItems: 100, notes: 'Daily Journal 会议' },
      { collectorType: 'book', source: "Poor Charlie's Almanack", priority: 3, estimatedItems: 1, notes: '已有' },
    ],
    skillSet: ['inversion', 'economic-modeling', 'common-fallacy', 'second-order'],
    defaultTestCategories: ['investment', 'philosophy', 'psychology'],
    playtestCaseCount: 12,
    minCorpusSize: 400000,
  },

  // ─── P2: 中优先级 ──────────────────────────────────────────────────────

  'warren-buffett': {
    personaId: 'warren-buffett',
    priority: 'P2',
    collectorTargets: [
      { collectorType: 'video', source: 'Berkshire Hathaway 年会', priority: 1, estimatedItems: 10000, notes: '股东大会完整转录 — 核心缺口' },
      { collectorType: 'book', source: '致股东信', priority: 2, estimatedItems: 50, notes: '历年股东信' },
      { collectorType: 'podcast', source: 'Lex Fridman', priority: 3, estimatedItems: 2, notes: '已有部分' },
    ],
    skillSet: ['long-term-thinking', 'cost-benefit', 'economic-modeling'],
    defaultTestCategories: ['investment', 'philosophy'],
    playtestCaseCount: 10,
    minCorpusSize: 500000,
  },

  'richard-feynman': {
    personaId: 'richard-feynman',
    priority: 'P2',
    collectorTargets: [
      { collectorType: 'video', source: 'Caltech 讲座', priority: 1, estimatedItems: 122, notes: 'Caltech 讲座 HTML — 重要缺口' },
      { collectorType: 'book', source: 'Feynman Lectures', priority: 2, estimatedItems: 3, notes: '已有' },
    ],
    skillSet: ['first-principles', 'concept-decomposition', 'storytelling'],
    defaultTestCategories: ['science', 'philosophy', 'education'],
    playtestCaseCount: 8,
    minCorpusSize: 300000,
  },

  'steve-jobs': {
    personaId: 'steve-jobs',
    priority: 'P2',
    collectorTargets: [
      { collectorType: 'video', source: 'All Things D / Stanford', priority: 1, estimatedItems: 50, notes: 'All Things D 采访 — 核心缺口' },
      { collectorType: 'video', source: 'Macworld 主题演讲', priority: 2, estimatedItems: 100, notes: '产品发布会' },
      { collectorType: 'book', source: 'Walter Isaacson 传记', priority: 3, estimatedItems: 1, notes: '已有' },
    ],
    skillSet: ['first-principles', 'teaching-analogy', 'storytelling'],
    defaultTestCategories: ['technology', 'entrepreneurship', 'philosophy'],
    playtestCaseCount: 10,
    minCorpusSize: 400000,
  },

  'zhang-yiming': {
    personaId: 'zhang-yiming',
    priority: 'P2',
    collectorTargets: [
      { collectorType: 'video', source: '字节跳动全员会', priority: 1, estimatedItems: 50, notes: '全员会转录 — 核心缺口' },
      { collectorType: 'blog', source: '知乎/采访', priority: 2, estimatedItems: 50, notes: '采访记录' },
    ],
    skillSet: ['first-principles', 'long-term-thinking', 'economic-modeling'],
    defaultTestCategories: ['technology', 'entrepreneurship', 'philosophy'],
    playtestCaseCount: 8,
    minCorpusSize: 200000,
  },

  'jensen-huang': {
    personaId: 'jensen-huang',
    priority: 'P2',
    collectorTargets: [
      { collectorType: 'video', source: 'GTC 大会历史', priority: 1, estimatedItems: 200, notes: 'GTC 历史大会字幕 — 核心缺口' },
      { collectorType: 'podcast', source: 'Lex Fridman', priority: 2, estimatedItems: 2, notes: '已有' },
    ],
    skillSet: ['first-principles', 'long-term-thinking', 'startup-frame'],
    defaultTestCategories: ['technology', 'entrepreneurship', 'science'],
    playtestCaseCount: 8,
    minCorpusSize: 300000,
  },

};

// ─── Priority Sorting ──────────────────────────────────────────────────────────

export function getByPriority(priority: 'P0' | 'P1' | 'P2'): PersonaDistillationConfig[] {
  return Object.values(DISTILLATION_CONFIG)
    .filter(c => c.priority === priority)
    .sort((a, b) => a.personaId.localeCompare(b.personaId));
}

export function getP0Personas(): PersonaDistillationConfig[] {
  return getByPriority('P0');
}

export function getP1Personas(): PersonaDistillationConfig[] {
  return getByPriority('P1');
}

export function getP2Personas(): PersonaDistillationConfig[] {
  return getByPriority('P2');
}

export function getConfig(personaId: string): PersonaDistillationConfig | undefined {
  return DISTILLATION_CONFIG[personaId];
}

export function getCollectorTargets(personaId: string): CollectorTarget[] {
  return DISTILLATION_CONFIG[personaId]?.collectorTargets ?? [];
}

export function getScrapingTargets(personaId: string): ScrapingTarget[] {
  const config = DISTILLATION_CONFIG[personaId];
  if (!config) return [];

  return config.collectorTargets.map((target) => ({
    id: nanoid(8),
    personaId,
    collectorType: target.collectorType as CollectorType,
    source: target.source,
    url: target.url,
    type: collectorTypeToSourceType(target.collectorType),
    status: 'pending',
    itemsCollected: 0,
    estimatedTotal: target.estimatedItems,
    retryCount: 0,
    createdAt: new Date(),
  }));
}

function collectorTypeToSourceType(ct: string): ScrapingTarget['type'] {
  const mapping: Record<string, ScrapingTarget['type']> = {
    twitter: 'tweet',
    blog: 'blog',
    video: 'video',
    podcast: 'interview',
    book: 'book',
    interview: 'interview',
    weibo: 'tweet',
    forum: 'lecture',
  };
  return (mapping[ct] ?? 'primary') as ScrapingTarget['type'];
}
