/**
 * Prismatic — Layer 2: Language-Aware Routing Engine
 * Decides which distillation route to use based on corpus analysis
 *
 * Routes:
 * - uni:    Single language distillation (95%+ one language)
 * - bi:     Bilingual cross-distillation (2 languages >= 15% each)
 * - multi:  Multi-lingual fusion (3+ languages >= 10% each)
 * - period: Period-aware distillation (distinct phases in persona's work)
 */

import {
  type CorpusHealthReport,
  type RouteDecision,
  type DistillationRoute,
  type SupportedLanguage,
  type OutputLanguage,
  type Period,
  ROUTE_THRESHOLDS,
  LANGUAGE_WEIGHT_PRIORITY,
} from './distillation-v4-types';

// ─── Primary Language Selection ─────────────────────────────────────────────────

function selectPrimaryLanguage(
  langDist: CorpusHealthReport['languageDistribution'],
  periods?: Period[]
): SupportedLanguage {
  if (langDist.length === 0) return 'en';

  // If periods are defined, use the period with the most content
  if (periods && periods.length > 0) {
    const primaryPeriod = periods.reduce((best, curr) =>
      curr.endYear - curr.startYear > best.endYear - best.startYear ? curr : best
    );
    if (primaryPeriod.language !== 'mixed') {
      return primaryPeriod.language;
    }
  }

  // Otherwise, select by priority (prefer original over translation)
  // Higher priority = more likely to be original language
  return langDist
    .filter(l => l.ratio >= 0.05)
    .sort((a, b) => {
      const aPriority = LANGUAGE_WEIGHT_PRIORITY[a.language] * a.ratio;
      const bPriority = LANGUAGE_WEIGHT_PRIORITY[b.language] * b.ratio;
      return bPriority - aPriority;
    })[0]?.language ?? 'en';
}

// ─── Period Partitioning Decision ───────────────────────────────────────────────

function detectPeriodNeed(
  personaId: string,
  report: CorpusHealthReport
): { needed: boolean; periods: Period[]; reasoning: string } {
  const PERFORMATIC_PERSONAS = [
    'wittgenstein', 'nietzsche', 'confucius', 'zhuang-zi',
    'seneca', 'plato', 'aristotle', 'hui-neng', 'lao-zi',
  ];

  // Check if persona has known period分化
  if (!PERFORMATIC_PERSONAS.includes(personaId)) {
    return { needed: false, periods: [], reasoning: 'Not a performatic persona' };
  }

  // If report already has detected periods, use them
  if (report.periods && report.periods.length >= 2) {
    return {
      needed: true,
      periods: report.periods,
      reasoning: `Detected ${report.periods.length} distinct periods from corpus metadata`,
    };
  }

  // Check language shift within corpus
  if (report.languageDistribution.length >= 2) {
    const primary = report.languageDistribution[0];
    const secondary = report.languageDistribution[1];

    // If there's a significant secondary language, might indicate period shift
    // e.g., Wittgenstein writing in German then dictating in English
    if (primary.ratio > 0.5 && secondary.ratio > 0.1) {
      return {
        needed: true,
        periods: report.periods ?? [],
        reasoning: `Language shift detected: ${primary.language} → ${secondary.language}`,
      };
    }
  }

  return { needed: false, periods: [], reasoning: 'No period partitioning needed' };
}

// ─── Source Quality Priority ────────────────────────────────────────────────────

const SOURCE_PRIORITY: Record<string, number> = {
  classical_text: 5,  // Primary source
  archive: 5,          // Nachlass, manuscripts
  book: 4,            // Published works
  interview: 4,       // Direct speech
  lecture: 4,          // Dictated/transcribed speech
  speech: 4,          // Direct speech
  essay: 3,           // Written for publication
  blog: 3,            // Semi-formal writing
  shareholder_letter: 3,
  podcast: 3,
  video: 2,
  tweet: 2,           // Short-form, may lack depth
  forum: 1,
  weibo: 1,
};

function assessCorpusQuality(
  report: CorpusHealthReport
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Word count check
  const primaryLang = report.languageDistribution[0]?.language ?? 'en';
  const minWords = primaryLang === 'zh' ? 3000 : 5000;
  if (report.totalWords < minWords) {
    score -= 30;
    issues.push(`语料字数不足: ${report.totalWords} < ${minWords}`);
  } else if (report.totalWords < minWords * 2) {
    score -= 10;
    issues.push(`语料字数偏少: ${report.totalWords}`);
  }

  // Diversity check
  if (report.sourceTypeDistribution.length < 2) {
    score -= 15;
    issues.push('来源类型单一');
  }

  // Unique word ratio
  if (report.uniqueWordRatio < 0.1) {
    score -= 20;
    issues.push('词汇重复率过高');
  } else if (report.uniqueWordRatio < 0.15) {
    score -= 10;
  }

  // Signal strength
  if (report.signalStrength === 'weak') {
    score -= 20;
    issues.push('信号强度弱');
  } else if (report.signalStrength === 'medium') {
    score -= 5;
  }

  return { score: Math.max(0, score), issues };
}

// ─── Main Routing Decision ───────────────────────────────────────────────────────

export function decideRoute(
  personaId: string,
  report: CorpusHealthReport,
  outputLanguage: OutputLanguage = 'zh-CN'
): RouteDecision {
  const { languageDistribution, sourceTypeDistribution, periods } = report;

  if (languageDistribution.length === 0) {
    return {
      route: 'uni',
      primaryLanguage: 'en',
      secondaryLanguages: [],
      outputLanguage,
      confidence: 'low',
      reasoning: 'No corpus found, defaulting to uni-lingual route',
      priorityRules: [],
      periodAware: false,
    };
  }

  const primary = languageDistribution[0];
  const secondary = languageDistribution[1];
  const tertiary = languageDistribution[2];

  // Quality assessment
  const quality = assessCorpusQuality(report);
  const confidence: 'high' | 'medium' | 'low' =
    quality.score >= 70 ? 'high' : quality.score >= 40 ? 'medium' : 'low';

  const priorityRules: string[] = [];

  // ── Route: Period-Aware ──────────────────────────────────────────────────────
  const periodNeed = detectPeriodNeed(personaId, report);
  if (periodNeed.needed) {
    priorityRules.push(...periodNeed.reasoning.split('. '));

    return {
      route: 'period',
      primaryLanguage: selectPrimaryLanguage(languageDistribution, periodNeed.periods),
      secondaryLanguages: languageDistribution
        .slice(1)
        .filter(l => l.ratio >= 0.05)
        .map(l => l.language),
      outputLanguage,
      confidence,
      reasoning: periodNeed.reasoning,
      priorityRules,
      periodAware: true,
      periodPartitions: periodNeed.periods,
    };
  }

  // ── Route: Uni-Lingual ───────────────────────────────────────────────────────
  if (primary.ratio >= ROUTE_THRESHOLDS.UNI_LINGUAL) {
    priorityRules.push(
      `单一语言主导: ${primary.language} (${(primary.ratio * 100).toFixed(0)}%)`
    );

    return {
      route: 'uni',
      primaryLanguage: primary.language,
      secondaryLanguages: [],
      outputLanguage,
      confidence,
      reasoning: `Uni-lingual route selected: ${primary.language} at ${(primary.ratio * 100).toFixed(0)}%`,
      priorityRules,
      periodAware: false,
    };
  }

  // ── Route: Bi-Lingual ────────────────────────────────────────────────────────
  if (
    secondary &&
    secondary.ratio >= ROUTE_THRESHOLDS.BI_LINGUAL &&
    (!tertiary || tertiary.ratio < ROUTE_THRESHOLDS.MULTI_LINGUAL)
  ) {
    // Determine primary (prefer original language)
    const primaryLang = selectPrimaryLanguage(languageDistribution, periods);
    const secondaryLang = secondary.language;

    priorityRules.push(
      `双语语料检测: ${primary.language} + ${secondary.language}`,
      `${primary.language === primaryLang ? '主语言' : '副语言'} (${(primary.ratio * 100).toFixed(0)}%)`,
      `次语言 (${(secondary.ratio * 100).toFixed(0)}%)`
    );

    // Special case: Wittgenstein (DE + EN)
    if (personaId === 'wittgenstein') {
      priorityRules.push('维特根斯坦特殊情况: 德文原文优先（母语写作），英文为自译/口述');
    }

    // Special case: Zhuangzi (ZH + EN Watson)
    if (personaId === 'zhuang-zi') {
      priorityRules.push('庄子特殊情况: 中文原文 + Watson 英译');
    }

    return {
      route: 'bi',
      primaryLanguage: primaryLang,
      secondaryLanguages: [secondaryLang],
      outputLanguage,
      confidence,
      reasoning: `Bi-lingual cross route: ${primaryLang} (primary) + ${secondaryLang} (secondary)`,
      priorityRules,
      periodAware: false,
    };
  }

  // ── Route: Multi-Lingual ─────────────────────────────────────────────────────
  const significantLangs = languageDistribution.filter(l => l.ratio >= ROUTE_THRESHOLDS.MULTI_LINGUAL);
  if (significantLangs.length >= 3) {
    priorityRules.push(
      `多语言语料检测: ${significantLangs.map(l => `${l.language}(${(l.ratio * 100).toFixed(0)}%)`).join(' + ')}`
    );

    return {
      route: 'multi',
      primaryLanguage: selectPrimaryLanguage(languageDistribution, periods),
      secondaryLanguages: significantLangs.slice(1).map(l => l.language),
      outputLanguage,
      confidence,
      reasoning: `Multi-lingual fusion route: ${significantLangs.length} significant languages`,
      priorityRules,
      periodAware: false,
    };
  }

  // ── Fallback: Uni ────────────────────────────────────────────────────────────
  priorityRules.push('降级为单语蒸馏（无法确定路由）');

  return {
    route: 'uni',
    primaryLanguage: primary.language,
    secondaryLanguages: [],
    outputLanguage,
    confidence,
    reasoning: `Fallback to uni-lingual: primary=${primary.language}(${(primary.ratio * 100).toFixed(0)}%)`,
    priorityRules,
    periodAware: false,
  };
}

// ─── Output Language Conversion ────────────────────────────────────────────────

export function determineOutputLanguage(
  corpusLanguages: SupportedLanguage[],
  primaryCorpusLang: SupportedLanguage
): OutputLanguage {
  // If corpus is primarily Chinese, output Chinese
  if (primaryCorpusLang === 'zh') return 'zh-CN';
  // Default output
  return 'zh-CN';
}

// ─── Routing Summary ───────────────────────────────────────────────────────────

export function summarizeRoute(decision: RouteDecision): string {
  const routeLabels: Record<DistillationRoute, string> = {
    uni: '单语蒸馏 (Uni-Lingual)',
    bi: '双语交叉蒸馏 (Bi-Lingual Cross)',
    multi: '多语言汇聚蒸馏 (Multi-Lingual Fusion)',
    period: '分期蒸馏 (Period-Aware)',
  };

  const parts = [
    `路由: ${routeLabels[decision.route]}`,
    `主语言: ${decision.primaryLanguage}`,
  ];

  if (decision.secondaryLanguages.length > 0) {
    parts.push(`次语言: ${decision.secondaryLanguages.join(', ')}`);
  }

  parts.push(`输出语言: ${decision.outputLanguage}`);
  parts.push(`置信度: ${decision.confidence}`);
  parts.push(`原因: ${decision.reasoning}`);

  if (decision.periodAware && decision.periodPartitions) {
    parts.push(`分期: ${decision.periodPartitions.map(p => p.label).join(' → ')}`);
  }

  return parts.join('\n');
}
