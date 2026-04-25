/**
 * Zero 蒸馏引擎 — 语料分析器
 * 语言分布、来源类型分布、N-gram 分析、质量评分、时期检测
 */

import {
  CorpusFile, CorpusReport, SupportedLanguage, SourceType,
  CorpusWarning, PeriodPartition, FileHealthSummary
} from '../types';

// =============================================================================
// Interface
// =============================================================================

export interface AnalyzeOptions {
  detectPeriods?: boolean;
  sampleSize?: number;
  periodAwarePersonas?: string[];
}

// =============================================================================
// Period Detection
// =============================================================================

const PERIOD_PATTERNS: Array<{
  persona: string;
  periods: Array<{ name: string; startYear: number; endYear: number; markers: string[] }>;
}> = [
  {
    persona: 'wittgenstein',
    periods: [
      { name: '早期逻辑原子主义', startYear: 1912, endYear: 1918, markers: ['逻辑', '原子', '事实', '图式'] },
      { name: '中期过渡', startYear: 1919, endYear: 1929, markers: ['私人语言', '规则', '怀疑'] },
      { name: '晚期日常语言', startYear: 1930, endYear: 1951, markers: ['语言游戏', '生活形式', '家族相似'] },
    ],
  },
  {
    persona: 'confucius',
    periods: [
      { name: '早年求学', startYear: -551, endYear: -532, markers: ['学', '问', '礼'] },
      { name: '从政时期', startYear: -532, endYear: -517, markers: ['治', '政', '官'] },
      { name: '周游列国', startYear: -517, endYear: -484, markers: ['游', '道', '仁'] },
      { name: '晚年整理', startYear: -484, endYear: -479, markers: ['删定', '诗书', '六艺'] },
    ],
  },
  {
    persona: 'nietzsche',
    periods: [
      { name: '早期古典学', startYear: 1869, endYear: 1876, markers: ['悲剧', '狄俄尼索斯', '阿波罗'] },
      { name: '中期实证', startYear: 1876, endYear: 1882, markers: ['知识', '真理', '怀疑'] },
      { name: '晚期权力意志', startYear: 1883, endYear: 1889, markers: ['权力意志', '超人', '永恒回归'] },
    ],
  },
  {
    persona: 'jiqun',
    periods: [
      { name: '早期微博', startYear: 2010, endYear: 2015, markers: ['微博', '佛法', '修行'] },
      { name: '中期讲经', startYear: 2016, endYear: 2020, markers: ['讲经', '般若', '唯识'] },
      { name: '晚期圆融', startYear: 2021, endYear: 2025, markers: ['圆融', '整合', '新时代'] },
    ],
  },
];

function detectPeriods(
  files: CorpusFile[],
  personaId: string
): PeriodPartition[] | undefined {
  const config = PERIOD_PATTERNS.find((p) => p.persona === personaId);
  if (!config) return undefined;

  const partitions: PeriodPartition[] = [];

  for (const period of config.periods) {
    const periodFiles = files.filter((f) => {
      // Heuristic: try to detect period from filename or content
      const searchText = (f.filename + ' ' + f.rawText.slice(0, 500)).toLowerCase();
      return period.markers.some((m) => searchText.includes(m.toLowerCase()));
    });

    if (periodFiles.length > 0) {
      const sample = periodFiles
        .slice(0, 3)
        .map((f) => f.rawText.slice(0, 2000))
        .join('\n\n');

      partitions.push({
        name: period.name,
        startYear: period.startYear,
        endYear: period.endYear,
        language: detectDominantLanguage(periodFiles),
        sourceTypes: [...new Set(periodFiles.map((f) => f.sourceType))] as SourceType[],
        wordCount: periodFiles.reduce((s, f) => s + f.wordCount, 0),
        dominantTopics: period.markers.slice(0, 3),
        sample,
      });
    }
  }

  return partitions.length >= 2 ? partitions : undefined;
}

// =============================================================================
// Language Helpers
// =============================================================================

function detectDominantLanguage(files: CorpusFile[]): SupportedLanguage {
  if (files.length === 0) return 'mixed';

  const langCounts: Partial<Record<SupportedLanguage, number>> = {};
  for (const f of files) {
    langCounts[f.language] = (langCounts[f.language] ?? 0) + 1;
  }

  let maxLang: SupportedLanguage = 'mixed';
  let maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxLang = lang as SupportedLanguage;
    }
  }
  return maxLang;
}

// =============================================================================
// Quality Scoring
// =============================================================================

function computeFileHealth(file: CorpusFile): FileHealthSummary {
  const issues: string[] = [];
  let quality: FileHealthSummary['quality'] = 'good';

  if (file.wordCount < 100) {
    issues.push('词数过少');
    quality = 'poor';
  }

  if (file.wordCount < 20) {
    issues.push('文件几乎为空');
    quality = 'corrupt';
  }

  // Check for excessive repetition (possible OCR/encoding issues)
  const sample = file.rawText.slice(0, 5000);
  const uniqueChars = new Set(sample).size;
  if (uniqueChars < 20) {
    issues.push('字符多样性极低，可能编码损坏');
    quality = 'corrupt';
  }

  // Check for garbage characters
  const garbageRatio = (sample.match(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g) ?? []).length / Math.max(sample.length, 1);
  if (garbageRatio > 0.05) {
    issues.push('包含非文本控制字符');
    quality = quality === 'good' ? 'poor' : quality;
  }

  // Check for common encoding artifacts
  const artifactCount =
    (sample.match(/ï|Ã|Â¨|Â©|Âª/g) ?? []).length +
    (sample.match(/\uFFFD/g) ?? []).length;
  if (artifactCount > 5) {
    issues.push(`检测到 ${artifactCount} 个编码伪影，可能需要 OCR 修复`);
    quality = quality === 'good' ? 'poor' : quality;
  }

  if (issues.length === 0) quality = 'excellent';

  return {
    filename: file.filename,
    wordCount: file.wordCount,
    language: file.language,
    quality,
    issues,
  };
}

function computeQualityScore(files: CorpusFile[]): number {
  if (files.length === 0) return 0;

  const excellentCount = files.filter((f) => computeFileHealth(f).quality === 'excellent').length;
  const goodCount = files.filter((f) => computeFileHealth(f).quality === 'good').length;
  const poorCount = files.filter((f) => computeFileHealth(f).quality === 'poor').length;
  const corruptCount = files.filter((f) => computeFileHealth(f).quality === 'corrupt').length;

  const total = files.length;
  const score =
    (excellentCount / total) * 100 +
    (goodCount / total) * 80 +
    (poorCount / total) * 40 +
    (corruptCount / total) * 0;

  return Math.round(score);
}

// =============================================================================
// Word Statistics
// =============================================================================

function computeWordStats(files: CorpusFile[]) {
  let totalWords = 0;
  let totalChars = 0;
  let totalUniqueWords = 0;

  const allText = files.map((f) => f.rawText).join(' ');

  if (files.length > 0 && files[0].language === 'zh') {
    const chineseChars = allText.match(/[\u4e00-\u9fff]/g) ?? [];
    totalChars = chineseChars.length;
    totalWords = Math.round(totalChars * 0.4);
    totalUniqueWords = new Set(chineseChars).size;
  } else {
    const words = allText.split(/\s+/).filter((w) => w.length > 0);
    totalWords = words.length;
    totalChars = allText.length;
    totalUniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  }

  return { totalWords, totalChars, totalUniqueWords };
}

function computeSentenceStats(text: string, lang: SupportedLanguage): number {
  const sentences = lang === 'zh'
    ? text.split(/[。！？；]/).filter((s) => s.trim().length > 0)
    : text.split(/[.!?;]/).filter((s) => s.trim().length > 0);

  if (sentences.length === 0) return 0;
  return Math.round(sentences.reduce((s, sen) => s + sen.length, 0) / sentences.length);
}

// =============================================================================
// Distribution Analysis
// =============================================================================

function computeLanguageDistribution(files: CorpusFile[]): Record<SupportedLanguage, number> {
  const dist: Partial<Record<SupportedLanguage, number>> = {};
  for (const f of files) {
    dist[f.language] = (dist[f.language] ?? 0) + f.wordCount;
  }
  return dist as Record<SupportedLanguage, number>;
}

function computeLanguageDistributionRatio(
  dist: Record<SupportedLanguage, number>
): Record<SupportedLanguage, number> | undefined {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return undefined;

  const ratio: Partial<Record<SupportedLanguage, number>> = {};
  for (const [lang, count] of Object.entries(dist)) {
    ratio[lang as SupportedLanguage] = Math.round((count / total) * 1000) / 1000;
  }
  return ratio as Record<SupportedLanguage, number>;
}

function computeSourceTypeDistribution(
  files: CorpusFile[]
): Record<SourceType, number> {
  const dist: Partial<Record<SourceType, number>> = {};
  for (const f of files) {
    dist[f.sourceType] = (dist[f.sourceType] ?? 0) + 1;
  }
  return dist as Record<SourceType, number>;
}

function computeSourceTypeRatio(
  dist: Record<SourceType, number>
): Record<SourceType, number> | undefined {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return undefined;

  const ratio: Partial<Record<SourceType, number>> = {};
  for (const [type, count] of Object.entries(dist)) {
    ratio[type as SourceType] = Math.round((count / total) * 1000) / 1000;
  }
  return ratio as Record<SourceType, number>;
}

// =============================================================================
// Warnings
// =============================================================================

function generateWarnings(
  files: CorpusFile[],
  qualityScore: number,
  totalWordCount: number,
  langDist: Record<SupportedLanguage, number>
): CorpusWarning[] {
  const warnings: CorpusWarning[] = [];

  if (files.length === 0) {
    warnings.push({ code: 'no_files', message: '没有找到任何语料文件', severity: 'error' });
    return warnings;
  }

  if (totalWordCount < 5000) {
    warnings.push({
      code: 'low_word_count',
      message: `词数不足: ${totalWordCount.toLocaleString()} < 5000`,
      severity: 'warn',
    });
  }

  if (Object.keys(langDist).length > 3) {
    warnings.push({
      code: 'mixed_language',
      message: `检测到 ${Object.keys(langDist).length} 种语言，混合语言可能会影响提取质量`,
      severity: 'warn',
    });
  }

  const sourceTypes = new Set(files.map((f) => f.sourceType));
  if (sourceTypes.size === 1 && files.length > 10) {
    warnings.push({
      code: 'single_source_type',
      message: `所有文件来源类型相同（${[...sourceTypes][0]}），多样性可能不足`,
      severity: 'warn',
    });
  }

  const corruptFiles = files.filter((f) => computeFileHealth(f).quality === 'corrupt');
  if (corruptFiles.length > 0) {
    warnings.push({
      code: 'corrupt_file',
      message: `检测到 ${corruptFiles.length} 个可能损坏的文件`,
      affectedFiles: corruptFiles.map((f) => f.filename).slice(0, 5),
      severity: 'error',
    });
  }

  const poorFiles = files.filter((f) => computeFileHealth(f).quality === 'poor');
  if (poorFiles.length > files.length * 0.3) {
    warnings.push({
      code: 'low_diversity',
      message: `超过 30% 的文件质量较差（${poorFiles.length}/${files.length}）`,
      severity: 'warn',
    });
  }

  return warnings;
}

// =============================================================================
// Sample Building
// =============================================================================

function buildSample(files: CorpusFile[], targetSize: number): string {
  // Sort files by quality (best first), then by size
  const sortedFiles = [...files]
    .map((f) => ({ file: f, health: computeFileHealth(f) }))
    .sort((a, b) => {
      const qualityOrder = { excellent: 0, good: 1, poor: 2, corrupt: 3 };
      const qDiff = qualityOrder[a.health.quality] - qualityOrder[b.health.quality];
      if (qDiff !== 0) return qDiff;
      return b.file.wordCount - a.file.wordCount;
    })
    .map((item) => item.file);

  const parts: string[] = [];
  let currentSize = 0;

  for (const file of sortedFiles) {
    if (currentSize >= targetSize) break;

    const text = file.rawText;
    const available = targetSize - currentSize;

    if (text.length <= available) {
      parts.push(text);
      currentSize += text.length;
    } else {
      // Take proportional sample from each file when we need to stop early
      const ratio = available / (sortedFiles.length * text.length / parts.length + 1 || 1);
      const sampleText = text.slice(0, Math.min(available, text.length));
      parts.push(sampleText);
      currentSize += sampleText.length;
    }
  }

  return parts.join('\n\n').slice(0, targetSize);
}

// =============================================================================
// N-gram Analysis
// =============================================================================

export function analyzeNgrams(
  files: CorpusFile[],
  lang: SupportedLanguage,
  topN = 50
): { bigrams: Map<string, number>; trigrams: Map<string, number> } {
  const bigrams = new Map<string, number>();
  const trigrams = new Map<string, number>();

  const allText = files.map((f) => f.rawText).join(' ');

  // Tokenize
  let tokens: string[];
  if (lang === 'zh') {
    tokens = [];
    for (let i = 0; i < allText.length - 1; i++) {
      const two = allText[i] + allText[i + 1];
      if (/[\u4e00-\u9fff]/.test(two)) {
        tokens.push(two);
        if (i + 2 < allText.length && /[\u4e00-\u9fff]/.test(allText[i + 2])) {
          const three = two + allText[i + 2];
          if (/[\u4e00-\u9fff]/.test(three)) {
            tokens.push(three);
          }
        }
      }
    }
  } else {
    tokens = allText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  }

  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const bi = tokens[i] + '_' + tokens[i + 1];
    bigrams.set(bi, (bigrams.get(bi) ?? 0) + 1);
  }

  // Trigrams
  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = tokens[i] + '_' + tokens[i + 1] + '_' + tokens[i + 2];
    trigrams.set(tri, (trigrams.get(tri) ?? 0) + 1);
  }

  return { bigrams, trigrams };
}

// =============================================================================
// Signal Strength
// =============================================================================

function computeSignalStrength(
  files: CorpusFile[],
  qualityScore: number
): number {
  if (files.length === 0) return 0;

  // Vocabulary richness (unique words / total words)
  const totalWords = files.reduce((s, f) => s + f.wordCount, 0);
  const uniqueWords = new Set(
    files.flatMap((f) => {
      const text = f.rawText;
      if (f.language === 'zh') {
        return [...text.match(/[\u4e00-\u9fff]/g) ?? []];
      }
      return text.toLowerCase().split(/\s+/);
    })
  ).size;

  const vocabRichness = totalWords > 0 ? uniqueWords / totalWords : 0;

  // Source diversity
  const sourceDiversity = new Set(files.map((f) => f.sourceType)).size / 10;

  // Quality bonus
  const qualityBonus = qualityScore / 100;

  const signal = Math.round(
    (vocabRichness * 0.3 + Math.min(sourceDiversity, 1) * 0.2 + qualityBonus * 0.5) * 100
  );

  return Math.min(100, signal);
}

// =============================================================================
// Main Analyzer
// =============================================================================

export function analyzeCorpus(
  files: CorpusFile[],
  personaId: string,
  options: AnalyzeOptions = {}
): CorpusReport {
  const {
    detectPeriods: shouldDetectPeriods = false,
    sampleSize = 50000,
  } = options;

  // Core stats
  const wordStats = computeWordStats(files);
  const langDist = computeLanguageDistribution(files);
  const langDistRatio = computeLanguageDistributionRatio(langDist);
  const sourceTypeDist = computeSourceTypeDistribution(files);
  const sourceTypeRatio = computeSourceTypeRatio(sourceTypeDist);

  // Quality
  const qualityScore = computeQualityScore(files);
  const fileHealth = files.map((f) => computeFileHealth(f));
  const warnings = generateWarnings(files, qualityScore, wordStats.totalWords, langDist);

  // Unique word ratio
  const uniqueWordRatio = wordStats.totalWords > 0
    ? Math.round((wordStats.totalUniqueWords / wordStats.totalWords) * 1000) / 1000
    : 0;

  // Average sentence length
  const allText = files.map((f) => f.rawText).join(' ');
  const dominantLang = detectDominantLanguage(files);
  const avgSentenceLength = computeSentenceStats(allText, dominantLang);

  // Period detection
  const periodPartitions = shouldDetectPeriods
    ? detectPeriods(files, personaId)
    : undefined;

  // Signal strength
  const signalStrength = computeSignalStrength(files, qualityScore);

  // Build sample
  const sample = buildSample(files, sampleSize);

  return {
    personaId,
    totalFiles: files.length,
    totalWordCount: wordStats.totalWords,
    totalCharCount: wordStats.totalChars,
    uniqueWordCount: wordStats.totalUniqueWords,
    uniqueWordRatio,
    avgSentenceLength,
    signalStrength,
    languageDistribution: langDist,
    languageDistributionRatio: (langDistRatio ?? {}) as Record<SupportedLanguage, number>,
    sourceTypeDistribution: sourceTypeDist,
    sourceTypeRatio: (sourceTypeRatio ?? {}) as Record<SourceType, number>,
    fileHealth,
    warnings,
    periodPartitions,
    qualityScore,
    sample,
  };
}
