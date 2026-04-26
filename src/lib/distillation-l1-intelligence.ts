/**
 * Prismatic — Layer 1: Corpus Intelligence
 * Language detection, density scoring, corpus health assessment
 *
 * Analyzes raw corpus files to produce:
 * 1. Language distribution matrix
 * 2. Source type distribution
 * 3. Expression density scoring
 * 4. Corpus health report
 * 5. Period detection (for period-aware route)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  type LanguageDistribution,
  type SourceTypeDistribution,
  type CorpusHealthReport,
  type SupportedLanguage,
  type Period,
  CORPUS_HEALTH_THRESHOLDS,
  type PeriodPattern,
} from './distillation-v4-types';
import { nanoid } from 'nanoid';
import type { Source } from './types';

// ─── Language Detection ─────────────────────────────────────────────────────────

const CJK_RANGES = /[\u4e00-\u9fff\u3400-\u4dbf\u{10000}-\u{1ffff}]/u;
const GERMAN_CHARS = /[äöüßÄÖÜ]/;
const LATIN_CHARS = /[àâçéèêëïîôùûüÿæœÀÂÇÉÈÊËÏÎÔÙÛÜŸÆŒ]/;
const GREEK_CHARS = /[\u0370-\u03ff\u1f00-\u1fff]/;
const JAPANESE_HIRA = /[\u3040-\u309f]/;
const JAPANESE_KATA = /[\u30a0-\u30ff]/;

export function detectLanguage(text: string): SupportedLanguage {
  const total = text.length;
  if (total === 0) return 'en';

  const cjkCount = (text.match(CJK_RANGES) ?? []).length;
  const germanCount = (text.match(GERMAN_CHARS) ?? []).length;
  const latinCount = (text.match(LATIN_CHARS) ?? []).length;
  const greekCount = (text.match(GREEK_CHARS) ?? []).length;
  const hiraCount = (text.match(JAPANESE_HIRA) ?? []).length;
  const kataCount = (text.match(JAPANESE_KATA) ?? []).length;

  const cjkRatio = cjkCount / total;
  const germanRatio = germanCount / total;
  const latinRatio = latinCount / total;
  const greekRatio = greekCount / total;
  const japaneseRatio = (hiraCount + kataCount) / total;

  // CJK: Chinese (Simplified/Traditional) or Japanese
  if (cjkRatio > 0.05) {
    // Distinguish Chinese from Japanese
    if (japaneseRatio > 0.01) return 'ja';
    return 'zh';
  }
  // German
  if (germanRatio > 0.002) return 'de';
  // Greek
  if (greekRatio > 0.05) return 'el';
  // Latin/French/Spanish
  if (latinRatio > 0.01) return 'la'; // Treat as Latin family
  // Default to English
  return 'en';
}

export function estimateWordCount(text: string, lang: SupportedLanguage): number {
  if (lang === 'zh') {
    // Chinese: count CJK characters as words (approximate)
    const chars = (text.match(CJK_RANGES) ?? []).length;
    return Math.round(chars * 0.4); // ~40% are meaningful words
  }
  // Western languages: split by whitespace
  return text.split(/\s+/).filter(t => t.length > 0).length;
}

// ─── Source Type Detection ─────────────────────────────────────────────────────

interface SourceTypePattern {
  type: string;
  patterns: RegExp[];
  keywords: string[];
}

const SOURCE_TYPE_PATTERNS: SourceTypePattern[] = [
  {
    type: 'classical_text',
    patterns: [
      /wittsrg_normalized/i,
      /tractatus/i,
      /investigations/i,
      /philosophical[-_]investigations/i,
      /zettel/i,
      /brown[-_]?book/i,
      /blue[-_]?book/i,
      /philosophical[-_]grammar/i,
      /remarks[-_]foundations/i,
      /remarks[-_]culture/i,
      /remarks[-_]logic/i,
      /culture[-_]value/i,
      /notebooks[-_]/i,
    ],
    keywords: ['MS-', 'Ts-', 'Nachlass', 'Ms-', 'Ts-'],
  },
  {
    type: 'primary',
    patterns: [
      /Ms-\d+_Clarino/i,
      /Ts-\d+_Clarino/i,
      /klement/i,
      /ogden/i,
    ],
    keywords: [],
  },
  {
    type: 'secondary',
    patterns: [
      /^sep-/i,
      /^iep-/i,
      / SEP /i,
      / IEP /i,
      /encyclopedia/i,
      /correspondance/i,
      /lectures[-_]30[-_]33/i,
      /lectures[-_]conversations/i,
    ],
    keywords: [],
  },
  {
    type: 'tweet',
    patterns: [/twitter/i, /x\.com/i, /tweet/i],
    keywords: ['RT ', '@', '#'],
  },
  {
    type: 'interview',
    patterns: [/interview/i, /podcast/i, /lex fridman/i, /joe rogan/i],
    keywords: ['Q:', 'A:', 'Question:', 'Answer:'],
  },
  {
    type: 'lecture',
    patterns: [/lecture/i, /speech/i, /talk/i, /gtc/i, /keynote/i, /aesthetics/i],
    keywords: ['Ladies and gentlemen', 'Thank you for', 'Today I want to'],
  },
  {
    type: 'book',
    patterns: [/gutenberg/i, /chapter/i, /\bI\.\b.*\bII\.\b/i],
    keywords: [],
  },
  {
    type: 'classical_text',
    patterns: [/ctext/i, /古籍/i, /经典/i, /tao te ching/i, /analects/i],
    keywords: ['子曰', '道可道', '论语'],
  },
  {
    type: 'blog',
    patterns: [/blog/i, /essay/i, /article/i, /medium/i, /\.md$/i],
    keywords: [],
  },
  {
    type: 'shareholder-letter',
    patterns: [/shareholder/i, /annual report/i, /letter to.*shareholders/i],
    keywords: [],
  },
  {
    type: 'archive',
    patterns: [/archive/i, /internet archive/i, /berg.? collection/i],
    keywords: [],
  },
];

export function detectSourceType(filename: string, content: string): string {
  for (const stp of SOURCE_TYPE_PATTERNS) {
    for (const pattern of stp.patterns) {
      if (pattern.test(filename)) return stp.type;
    }
    for (const keyword of stp.keywords) {
      if (content.includes(keyword)) return stp.type;
    }
  }
  return 'document';
}

// ─── Vocabulary Analysis ─────────────────────────────────────────────────────────

const ZH_STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没', '有', '看', '好',
  '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
  '为什么', '如果', '因为', '所以', '但是', '虽然', '而且', '或者', '还是',
  '可以', '能够', '应该', '必须', '需要', '可能', '已经', '正在', '将',
  '非常', '特别', '比较', '更加', '最', '太', '更', '还', '又', '再', '才',
  '与', '而', '为', '之', '于', '以', '其', '所', '则', '即', '非', '此',
]);

const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'and', 'but', 'or', 'if', 'then', 'so', 'not', 'no', 'all', 'any',
]);

function tokenizeEN(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !EN_STOPWORDS.has(t));
}

function tokenizeZH(text: string): string[] {
  return text
    .split('')
    .filter(c => CJK_RANGES.test(c) && !ZH_STOPWORDS.has(c))
    .filter((c, i, arr) => {
      // Extract 2-char and 3-char n-grams for Chinese
      return true;
    });
}

function extractZHWords(text: string): string[] {
  const chars = text.split('').filter(c => CJK_RANGES.test(c));
  const words: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    words.push(chars[i] + chars[i + 1]);
  }
  return words.filter(w => {
    const first = w[0];
    const second = w[1];
    return !ZH_STOPWORDS.has(first) && !ZH_STOPWORDS.has(second) && first !== second;
  });
}

function extractNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join('_');
    ngrams.set(ngram, (ngrams.get(ngram) ?? 0) + 1);
  }
  return ngrams;
}

export function analyzeCorpusHealth(
  text: string,
  lang: SupportedLanguage
): {
  totalWords: number;
  uniqueWordRatio: number;
  avgSentenceLength: number;
  signalStrength: 'strong' | 'medium' | 'weak';
  issues: string[];
} {
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 10);
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
    : 0;

  let totalWords: number;
  let tokens: string[];

  if (lang === 'zh') {
    tokens = extractZHWords(text);
    totalWords = tokens.length;
  } else {
    tokens = tokenizeEN(text);
    totalWords = tokens.length;
  }

  const uniqueWords = new Set(tokens);
  const uniqueWordRatio = totalWords > 0 ? uniqueWords.size / totalWords : 0;

  const issues: string[] = [];
  let signalStrength: 'strong' | 'medium' | 'weak' = 'medium';

  if (totalWords < CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_EN) {
    issues.push(`语料字数过少 (${totalWords} < ${CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_EN})`);
    signalStrength = 'weak';
  }
  if (uniqueWordRatio < CORPUS_HEALTH_THRESHOLDS.MIN_UNIQUE_WORD_RATIO) {
    issues.push(`词汇重复率过高 (${(uniqueWordRatio * 100).toFixed(1)}% < 15%)`);
    signalStrength = 'weak';
  }
  if (avgSentenceLength < 5) {
    issues.push(`平均句子长度异常 (${avgSentenceLength.toFixed(1)} < 5)`);
  }
  if (signalStrength !== 'weak' && uniqueWordRatio >= 0.2 && totalWords >= 10000) {
    signalStrength = 'strong';
  }

  return { totalWords, uniqueWordRatio, avgSentenceLength, signalStrength, issues };
}

// ─── Period Detection ───────────────────────────────────────────────────────────

const KNOWN_PERIOD_PATTERNS: PeriodPattern[] = [
  {
    name: 'Wittgenstein Early',
    startYear: 1912,
    endYear: 1918,
    languageShift: 'de',
    keyIndicators: ['logic', 'tautology', 'picture theory', 'Sachverhalt', 'Tractatus'],
    personaIds: ['wittgenstein'],
  },
  {
    name: 'Wittgenstein Middle',
    startYear: 1929,
    endYear: 1936,
    languageShift: 'en',
    keyIndicators: ['rule-following', 'private language', 'philosophy of psychology'],
    personaIds: ['wittgenstein'],
  },
  {
    name: 'Wittgenstein Late',
    startYear: 1937,
    endYear: 1951,
    languageShift: 'en',
    keyIndicators: ['language game', 'family resemblance', 'PI', 'Investigations'],
    personaIds: ['wittgenstein'],
  },
  {
    name: 'Nietzsche Early',
    startYear: 1870,
    endYear: 1876,
    languageShift: 'de',
    keyIndicators: ['birth of tragedy', 'wagner', 'dionysian', 'apollo'],
    personaIds: ['nietzsche'],
  },
  {
    name: 'Nietzsche Late',
    startYear: 1877,
    endYear: 1889,
    languageShift: 'de',
    keyIndicators: ['beyond good evil', 'zarathustra', 'will to power', 'eternal return'],
    personaIds: ['nietzsche'],
  },
];

export function detectPeriods(
  personaId: string,
  files: Array<{ filename: string; content: string; date?: string }>,
  filenameMap?: Record<string, number>
): Period[] {
  const applicable = KNOWN_PERIOD_PATTERNS.filter(p => p.personaIds.includes(personaId));
  if (applicable.length === 0) return [];

  // Build a year map from filenames (e.g. "Ms-114" → ~1912, "Ts-212" → ~1937)
  const yearFromFilename = (filename: string): number | null => {
    const msMatch = filename.match(/^Ms[-_](\d+)/i);
    if (msMatch) {
      const num = parseInt(msMatch[1]);
      // Ms-100 → 1912, Ms-110 → 1917, Ms-120 → 1922, etc.
      return 1912 + (num - 100) * 1.5;
    }
    const tsMatch = filename.match(/^Ts[-_](\d+)/i);
    if (tsMatch) {
      const num = parseInt(tsMatch[1]);
      // Ts-200 → 1929, Ts-210 → 1931, Ts-220 → 1933, Ts-230 → 1935, Ts-240 → 1937
      return 1929 + (num - 200) * 1.2;
    }
    return null;
  };

  const periods: Period[] = [];
  const seenLabels = new Set<string>();

  for (const pattern of applicable) {
    // Check if any file matches this period's year range
    let hasFilesInPeriod = false;
    for (const file of files) {
      const year = yearFromFilename(file.filename);
      if (year && year >= pattern.startYear && year <= pattern.endYear) {
        hasFilesInPeriod = true;
        break;
      }
    }

    // Only add the period once, not once per file
    if (hasFilesInPeriod && !seenLabels.has(pattern.name)) {
      seenLabels.add(pattern.name);
      periods.push({
        id: nanoid(8),
        label: pattern.name,
        labelZh: pattern.name,
        startYear: pattern.startYear,
        endYear: pattern.endYear,
        description: `Works from ${pattern.startYear} to ${pattern.endYear}`,
        descriptionZh: `${pattern.startYear}年至${pattern.endYear}年期间作品`,
        language: pattern.languageShift ?? 'en',
        dominantSourceTypes: ['book', 'archive'],
      });
    }
  }

  return periods;
}

// ─── Main Intelligence Function ─────────────────────────────────────────────────

export interface CorpusFile {
  filename: string;
  filepath: string;
  content: string;
  size: number;
  lastModified?: string;
}

export async function analyzeCorpus(
  personaId: string,
  corpusDir: string
): Promise<CorpusHealthReport> {
  // Read all files recursively
  const files: CorpusFile[] = [];

  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const filepath = path.join(dir, entry);
      const stat = fs.statSync(filepath);
      if (stat.isFile()) {
        const content = fs.readFileSync(filepath, 'utf-8');
        files.push({
          filename: entry,
          filepath,
          content,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
        });
      } else if (stat.isDirectory()) {
        walkDir(filepath);
      }
    }
  }

  walkDir(corpusDir);

  if (files.length === 0) {
    return {
      totalWords: 0,
      totalChars: 0,
      totalFiles: 0,
      uniqueWordRatio: 0,
      avgSentenceLength: 0,
      languageDistribution: [],
      sourceTypeDistribution: [],
      signalStrength: 'weak',
      wordCountThreshold: { en: 0, zh: 0, de: 0 },
      warnings: ['No corpus files found'],
      passes: false,
    };
  }

  // Language distribution
  const langDistMap = new Map<SupportedLanguage, { chars: number; words: number; files: string[] }>();
  const sourceTypeMap = new Map<string, { count: number; words: number; files: string[] }>();

  let totalChars = 0;
  let totalWords = 0;
  const filenameToYear: Record<string, number> = {};

  for (const file of files) {
    const lang = detectLanguage(file.content);
    const words = estimateWordCount(file.content, lang);

    totalChars += file.content.length;
    totalWords += words;

    if (!langDistMap.has(lang)) {
      langDistMap.set(lang, { chars: 0, words: 0, files: [] });
    }
    const ld = langDistMap.get(lang)!;
    ld.chars += file.content.length;
    ld.words += words;
    ld.files.push(file.filename);

    // Source type
    const sourceType = detectSourceType(file.filename, file.content);
    if (!sourceTypeMap.has(sourceType)) {
      sourceTypeMap.set(sourceType, { count: 0, words: 0, files: [] });
    }
    const st = sourceTypeMap.get(sourceType)!;
    st.count++;
    st.words += words;
    st.files.push(file.filename);

    // Year detection from filename (for WittSrc style: Ms-114, Ts-207)
    const msMatch = file.filename.match(/^Ms[-_](\d+)/i);
    const tsMatch = file.filename.match(/^Ts[-_](\d+)/i);
    if (msMatch || tsMatch) {
      const num = parseInt(msMatch?.[1] ?? tsMatch?.[1] ?? '0');
      // Bergen numbering roughly maps to dates
      // Ms-100 ~ 1912, Ms-180 ~ 1948, each MS ~ 1.5 years
      const estimatedYear = msMatch
        ? 1912 + (num - 100) * 1.5
        : 1929 + (num - 200) * 1.2;
      filenameToYear[file.filename] = Math.round(estimatedYear);
    }
  }

  // Build language distribution
  const languageDistribution: LanguageDistribution[] = [];
  for (const [lang, data] of langDistMap.entries()) {
    languageDistribution.push({
      language: lang,
      charCount: data.chars,
      wordCount: data.words,
      ratio: totalChars > 0 ? data.chars / totalChars : 0,
      files: data.files,
    });
  }
  languageDistribution.sort((a, b) => b.ratio - a.ratio);

  // Build source type distribution
  const sourceTypeDistribution: SourceTypeDistribution[] = [];
  for (const [type, data] of sourceTypeMap.entries()) {
    sourceTypeDistribution.push({
      type: type as Source['type'],
      count: data.count,
      wordCount: data.words,
      ratio: files.length > 0 ? data.count / files.length : 0,
      files: data.files,
    });
  }

  // Primary language health
  const primaryLang = languageDistribution[0]?.language ?? 'en';
  const primaryContent = files
    .filter(f => detectLanguage(f.content) === primaryLang)
    .map(f => f.content)
    .join('\n');
  const health = analyzeCorpusHealth(primaryContent, primaryLang);

  // Periods
  const periods = detectPeriods(
    personaId,
    files.map(f => ({
      filename: f.filename,
      content: f.content,
      date: filenameToYear[f.filename]?.toString(),
    })),
    filenameToYear
  );

  // Warnings
  const warnings: string[] = [...health.issues];

  if (languageDistribution.length > 1) {
    const primary = languageDistribution[0];
    const secondary = languageDistribution[1];
    if (secondary && secondary.ratio >= 0.15) {
      warnings.push(`检测到双语语料: ${primary.language}(${(primary.ratio * 100).toFixed(0)}%) + ${secondary.language}(${(secondary.ratio * 100).toFixed(0)}%)`);
    }
  }

  if (sourceTypeDistribution.length < 2) {
    warnings.push('语料来源类型单一，建议增加不同类型的语料');
  }

  if (!health.signalStrength) {
    warnings.push(`信号强度: ${health.signalStrength}`);
  }

  // Pass/fail
  const passes = health.totalWords >= (primaryLang === 'zh'
    ? CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_ZH
    : CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_EN);

  return {
    totalWords,
    totalChars,
    totalFiles: files.length,
    uniqueWordRatio: health.uniqueWordRatio,
    avgSentenceLength: health.avgSentenceLength,
    languageDistribution,
    sourceTypeDistribution,
    periods,
    signalStrength: health.signalStrength,
    wordCountThreshold: {
      en: CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_EN,
      zh: CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_ZH,
      de: CORPUS_HEALTH_THRESHOLDS.MIN_WORDS_DE,
    },
    warnings,
    passes,
  };
}

// ─── HTML Stripper ─────────────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  // Remove script and style elements completely
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<meta[^>]*>/gi, ' ')
    .replace(/<link[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Decode HTML numeric entities (&#123; or &#x1F4A9;)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)));

  return text;
}

// ─── Corpus Sample Builder ───────────────────────────────────────────────────────

export function buildCorpusSample(
  files: CorpusFile[],
  maxChars: number = 50000
): string {
  let result = '';

  for (const file of files) {
    const remaining = maxChars - result.length;
    if (remaining <= 0) break;

    let content = file.content;

    // Strip HTML if the file looks like HTML
    if (file.filename.endsWith('.html') || file.filename.endsWith('.htm') ||
        content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      content = stripHtml(content);
    }

    if (content.length <= remaining) {
      result += `\n\n=== ${file.filename} ===\n\n` + content;
    } else {
      result += `\n\n=== ${file.filename} (truncated) ===\n\n` + content.slice(0, remaining);
    }
  }

  return result;
}

export function getFileByLanguage(
  files: CorpusFile[],
  language: SupportedLanguage
): CorpusFile[] {
  return files.filter(f => detectLanguage(f.content) === language);
}
