/**
 * Prismatic — Layer 2: Knowledge Gap Detector
 *
 * Analyzes a user's question to determine whether it falls outside
 * the corpus coverage window — critical for personas who are still alive.
 *
 * Detection signals:
 * 1. Temporal markers: "最近", "2025", "今年", "latest", "recent"
 * 2. Future events: "will", "going to", "未来", "将", "计划"
 * 3. Unknown entities: proper nouns not in corpus
 * 4. Specific date patterns: YYYY-MM-DD, "last month", "上个月"
 * 5. Ongoing process references: "正在", "currently", "now developing"
 *
 * Strategy:
 * - HIGH CONFIDENCE (>= 0.8): Clear temporal markers + specific facts
 * - MEDIUM CONFIDENCE (0.5-0.8): Temporal markers only, or unknown entities
 * - LOW CONFIDENCE (< 0.5): Ambiguous markers, not enough signal
 */

import type {
  KnowledgeGapDetectionResult,
  GapSeverity,
  GapSignal,
} from './distillation-v4-types';

// Re-export for consumers
export type { KnowledgeGapDetectionResult, GapSeverity, GapSignal } from './distillation-v4-types';

// ─── Temporal Signal Patterns ─────────────────────────────────────────────────────

interface TemporalPattern {
  /** 正则或关键词模式 */
  pattern: RegExp | string[];
  /** 信号类型 */
  signalType: GapSignal['type'];
  /** 权重（影响置信度） */
  weight: number;
  /** 是否暗示未来 */
  impliesFuture?: boolean;
  /** 是否暗示最近 */
  impliesRecent?: boolean;
}

const TEMPORAL_PATTERNS: TemporalPattern[] = [
  // ── Recent time markers (强信号) ──────────────────────────────────────
  {
    pattern: [
      '最近', '最近在', '最近做了', '最近说了',
      '最近怎么样', '最近有什么', '最近发生',
      '最近在忙', ' lately', ' recently', ' these days',
      'in recent', 'in the past few',
    ],
    signalType: 'recent_event',
    weight: 0.7,
    impliesRecent: true,
  },
  // ── Current year/quarter ───────────────────────────────────────────────
  {
    pattern: /\b(202[4-9]|203[0-5])\b/,
    signalType: 'temporal_marker',
    weight: 0.6,
    impliesRecent: true,
  },
  // ── This year ───────────────────────────────────────────────────────────
  {
    pattern: [
      '今年', '今年初', '今年底', '今年在',
      'this year', 'year to date',
    ],
    signalType: 'temporal_marker',
    weight: 0.7,
    impliesRecent: true,
  },
  // ── This month / recent months ──────────────────────────────────────────
  {
    pattern: [
      '本月', '这个月', '上个月', '近月',
      'this month', 'last month',
      '过去几个月', '最近几个月', '几个月前',
    ],
    signalType: 'temporal_marker',
    weight: 0.6,
    impliesRecent: true,
  },
  // ── Future predictions ───────────────────────────────────────────────────
  {
    pattern: [
      '未来', '将要', '将会', '计划在',
      'will happen', 'going to',
      'will release', 'will announce', 'will launch',
      '预计', '预期', '将推出', '将发布',
    ],
    signalType: 'future_prediction',
    weight: 0.8,
    impliesFuture: true,
  },
  // ── Currently / now developing ──────────────────────────────────────────
  {
    pattern: [
      '现在正在', '目前在', '当前在',
      'is currently working on', 'is now developing',
      '正在开发', '正在研发', '正在进行',
      '正在做', '现在在做',
    ],
    signalType: 'ongoing_process',
    weight: 0.5,
    impliesRecent: true,
  },
  // ── Latest / newest ─────────────────────────────────────────────────────
  {
    pattern: [
      '最新', '最新消息', '最新动态',
      'latest', 'newest', 'most recent',
      '最近的', '最近的发言', '最近的言论',
      '最新推文', '最新微博',
    ],
    signalType: 'recent_event',
    weight: 0.6,
    impliesRecent: true,
  },
  // ── Specific recent dates ────────────────────────────────────────────────
  {
    pattern: /\b(202[4-9])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/,
    signalType: 'specific_date',
    weight: 0.9,
    impliesRecent: true,
  },
  // ── Last N days / weeks ─────────────────────────────────────────────────
  {
    pattern: [
      '昨天', '前天', '上周', '这几周',
      'yesterday', 'last week',
      '上周', '上个月', '近期',
      'last few weeks', 'last few months',
    ],
    signalType: 'temporal_marker',
    weight: 0.5,
    impliesRecent: true,
  },
];

// ─── Recent Event Patterns ──────────────────────────────────────────────────────

const RECENT_EVENT_INDICATORS: Array<{
  keywords: string[];
  weight: number;
}> = [
  {
    keywords: [
      '新书', '新书发布', '出版', '新专辑', '新电影',
      '新发布', '新推出', '新公司', '新收购', '新投资',
      'new book', 'new album', 'new movie', 'launched',
      'announced', 'released', 'acquired', 'invested',
      '融资', '上市', 'IPO', 'new product',
    ],
    weight: 0.8,
  },
  {
    keywords: [
      '获奖', '获奖感言',
      'won', 'awarded', 'received', 'honored',
      'prize', 'award', 'recognition',
    ],
    weight: 0.7,
  },
  {
    keywords: [
      '去世', '逝世', '离世', '病逝',
      'passed away', 'died', 'deceased',
    ],
    weight: 0.9, // 生死大事
  },
];

// ─── Sensitive Topic Patterns ─────────────────────────────────────────────────────

const SENSITIVE_KEYWORD_SETS: Array<{
  category: string;
  keywords: string[];
  weight: number;
}> = [
  {
    category: 'health_privacy',
    keywords: [
      '健康状况', '病情', '治疗方案', '私人医疗',
      'personal health', 'medical condition', 'health update',
    ],
    weight: 0.9,
  },
  {
    category: 'unconfirmed_rumors',
    keywords: [
      '谣言', '传闻', '据说', '据报道',
      'rumor', 'allegedly', 'unconfirmed',
    ],
    weight: 0.6,
  },
  {
    category: 'future_plans',
    keywords: [
      '秘密计划', '内幕', '未公开',
      'secret plan', 'classified', 'undisclosed',
    ],
    weight: 0.8,
  },
];

// ─── Year Extraction ─────────────────────────────────────────────────────────────

function extractYearReferences(text: string): number[] {
  const years: number[] = [];

  // Arabic numerals: 2024, 2025, 2026
  const yearMatches = text.match(/\b(19[789]\d|20[23456]\d)\b/g);
  if (yearMatches) {
    for (const y of yearMatches) {
      years.push(parseInt(y));
    }
  }

  return Array.from(new Set(years)).sort((a, b) => a - b);
}

// ─── Main Detection Function ───────────────────────────────────────────────────────

export interface DetectKnowledgeGapOptions {
  /** 用户问题 */
  question: string;
  /** 人物 ID */
  personaId: string;
  /** 语料库截止日期（ISO 格式，如 "2024-12-31"） */
  corpusCutoffDate?: string;
  /** 人物是否还在世 */
  isAlive?: boolean;
  /** 敏感话题列表 */
  sensitiveTopics?: string[];
}

/**
 * 检测用户问题是否可能落在语料库覆盖范围之外。
 */
export function detectKnowledgeGap(options: DetectKnowledgeGapOptions): KnowledgeGapDetectionResult {
  const {
    question,
    personaId: _personaId,
    corpusCutoffDate,
    isAlive,
    sensitiveTopics = [],
  } = options;

  const signals: GapSignal[] = [];
  const questionLower = question.toLowerCase();
  const now = new Date();
  const currentYear = now.getFullYear();

  // ── Step 1: Temporal Signal Detection ────────────────────────────────────
  for (const pattern of TEMPORAL_PATTERNS) {
    let matched = false;
    let matchedText = '';

    if (pattern.pattern instanceof RegExp) {
      const match = question.match(pattern.pattern);
      if (match) {
        matched = true;
        matchedText = match[0];
      }
    } else if (Array.isArray(pattern.pattern)) {
      for (const kw of pattern.pattern) {
        if (question.includes(kw) || questionLower.includes(kw.toLowerCase())) {
          matched = true;
          matchedText = kw;
          break;
        }
      }
    }

    if (matched) {
      signals.push({
        type: pattern.signalType,
        description: `检测到时间标记: "${matchedText}"`,
        raw: matchedText,
        confidence: pattern.weight,
      });
    }
  }

  // ── Step 2: Recent Event Indicators ──────────────────────────────────────
  for (const indicator of RECENT_EVENT_INDICATORS) {
    for (const kw of indicator.keywords) {
      if (question.includes(kw) || questionLower.includes(kw.toLowerCase())) {
        signals.push({
          type: 'recent_event',
          description: `检测到近期事件标记: "${kw}"`,
          raw: kw,
          confidence: indicator.weight,
        });
        break;
      }
    }
  }

  // ── Step 3: Year Reference Analysis ─────────────────────────────────────
  const yearRefs = extractYearReferences(question);
  const questionTimeRange: KnowledgeGapDetectionResult['questionTimeRange'] = {
    earliestYear: yearRefs[0],
    latestYear: yearRefs[yearRefs.length - 1],
    containsFuture: false,
    containsPresent: false,
  };

  if (yearRefs.length > 0) {
    const maxYear = Math.max(...yearRefs);
    const cutoffYear = corpusCutoffDate ? parseInt(corpusCutoffDate.slice(0, 4)) : undefined;

    if (maxYear > currentYear) {
      questionTimeRange.containsFuture = true;
      signals.push({
        type: 'future_prediction',
        description: `问题涉及未来年份: ${maxYear}`,
        raw: maxYear.toString(),
        confidence: 0.9,
      });
    }

    if (maxYear >= currentYear - 1) {
      questionTimeRange.containsPresent = true;
    }

    // 检查年份是否在语料库截止日期之后
    if (cutoffYear && maxYear > cutoffYear) {
      signals.push({
        type: 'specific_date',
        description: `问题年份 ${maxYear} 超出语料库截止日期 ${cutoffYear}`,
        raw: maxYear.toString(),
        confidence: 0.85,
      });
    }
  }

  // ── Step 4: Sensitive Topic Detection ─────────────────────────────────────
  let isSensitive = false;
  for (const sensitiveSet of SENSITIVE_KEYWORD_SETS) {
    for (const kw of sensitiveSet.keywords) {
      if (question.includes(kw) || questionLower.includes(kw.toLowerCase())) {
        signals.push({
          type: 'unknown_entity',
          description: `检测到敏感话题标记: "${kw}"`,
          raw: kw,
          confidence: sensitiveSet.weight,
        });
        isSensitive = true;
        break;
      }
    }
  }

  // ── Step 5: Persona-specific sensitive topics ───────────────────────────────
  for (const topic of sensitiveTopics) {
    if (question.includes(topic) || questionLower.includes(topic.toLowerCase())) {
      signals.push({
        type: 'unknown_entity',
        description: `问题涉及敏感话题: "${topic}"`,
        raw: topic,
        confidence: 0.7,
      });
      isSensitive = true;
    }
  }

  // ── Step 6: Compute Severity and Confidence ───────────────────────────────
  const signalWeights = signals.map(s => s.confidence * (s.type === 'specific_date' ? 1.2 : 1.0));
  const totalWeight = signalWeights.reduce((a, b) => a + b, 0);
  const avgConfidence = signals.length > 0
    ? totalWeight / signals.length
    : 0;

  const confidence = Math.min(1.0, (signals.length * avgConfidence * 0.4) + (avgConfidence * 0.6));

  // ── Step 7: Severity Determination ─────────────────────────────────────────
  let severity: GapSeverity = 'none';

  if (signals.length > 0 && avgConfidence >= 0.5) {
    const hasFuture = signals.some(s => s.type === 'future_prediction');
    const hasSpecificDate = signals.some(s => s.type === 'specific_date');
    const hasRecentEvent = signals.some(s => s.type === 'recent_event');

    if (hasFuture || (hasSpecificDate && avgConfidence >= 0.85)) {
      severity = 'severe';
    } else if (hasRecentEvent || (hasSpecificDate && avgConfidence >= 0.6)) {
      severity = 'significant';
    } else if (signals.length >= 2) {
      severity = 'significant';
    } else if (signals.length >= 1) {
      severity = 'minor';
    }
  }

  // 如果人物已故，严重程度降低（其生平已完整记录）
  if (!isAlive && severity !== 'none') {
    if (severity === 'severe') severity = 'significant';
    if (severity === 'significant') severity = 'minor';
  }

  // 敏感话题检测 → 直接升级为 severe
  if (isSensitive && signals.length > 0) {
    severity = signals.some(s => s.confidence >= 0.8) ? 'severe' : 'significant';
  }

  return {
    isOutsideCorpus: signals.length > 0 && avgConfidence >= 0.5,
    severity,
    signals,
    questionTimeRange,
    topicHint: extractTopicHint(question),
    isSensitive,
    confidence,
  };
}

// ─── Topic Hint Extraction ────────────────────────────────────────────────────────

function extractTopicHint(question: string): string | undefined {
  // 提取引号中的内容
  const quotedMatch = question.match(/["""''「」『』](.{2,30})["""''「」『』]/);
  if (quotedMatch) return quotedMatch[1];

  // 提取以 "关于..." 开头的问题
  const aboutMatch = question.match(/关于(.{2,20})[？?。。]/);
  if (aboutMatch) return aboutMatch[1];

  // 提取问号前的名词短语
  const questionPhraseMatch = question.match(/([\u4e00-\u9fff]{2,15})[？?]?$/);
  if (questionPhraseMatch) return questionPhraseMatch[1];

  return undefined;
}

// ─── Batch Detection ──────────────────────────────────────────────────────────────

export interface BatchDetectionResult {
  personaId: string;
  isAlive: boolean;
  corpusCutoffDate?: string;
  results: KnowledgeGapDetectionResult[];
  aggregateSeverity: GapSeverity;
  aggregateConfidence: number;
}

export function detectKnowledgeGapBatch(
  question: string,
  personas: Array<{
    id: string;
    isAlive: boolean;
    corpusCutoffDate?: string;
    sensitiveTopics?: string[];
  }>
): BatchDetectionResult[] {
  return personas.map(persona => {
    const result = detectKnowledgeGap({
      question,
      personaId: persona.id,
      corpusCutoffDate: persona.corpusCutoffDate,
      isAlive: persona.isAlive,
      sensitiveTopics: persona.sensitiveTopics,
    });

    return {
      personaId: persona.id,
      isAlive: persona.isAlive,
      corpusCutoffDate: persona.corpusCutoffDate,
      results: [result],
      aggregateSeverity: result.severity,
      aggregateConfidence: result.confidence,
    };
  });
}

// ─── Quick Check (for hot path) ─────────────────────────────────────────────────

/**
 * 快速检查问题是否可能触发知识缺口路由。
 * 低开销的启发式方法，用于对话热路径。
 */
export function quickKnowledgeGapCheck(question: string): boolean {
  const q = question.toLowerCase();

  const recentMarkers = [
    '最近', ' lately', ' recently ', ' these days',
    '今年', '本月', '上周', ' newest', ' latest', '最新',
  ];

  for (const marker of recentMarkers) {
    if (q.includes(marker)) return true;
  }

  const futureYearMatch = question.match(/\b(202[6-9]|203[0-5])\b/);
  if (futureYearMatch) return true;

  const sensitiveMarkers = [
    '去世', '逝世', '病情', '健康状况',
    'passed away', 'health update', 'medical',
  ];

  for (const marker of sensitiveMarkers) {
    if (q.includes(marker.toLowerCase())) return true;
  }

  return false;
}
