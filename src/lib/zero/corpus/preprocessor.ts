/**
 * Zero 蒸馏引擎 — 语料预处理器
 * 清洗语料：OCR纠错、古文标点修复、临床医案规范化、重复段落去重
 */

import { CorpusFile } from '../types';

// =============================================================================
// Interface
// =============================================================================

export interface PreprocessorOptions {
  fixOcrErrors?: boolean | ((text: string) => string);
  fixAncientChinesePunctuation?: boolean | ((text: string) => string);
  normalizeClinicalText?: boolean | ((text: string) => string);
  deduplicateParagraphs?: boolean;
  minParagraphLength?: number;
  maxParagraphLength?: number;
}

// =============================================================================
// Ancient Chinese Punctuation Fixer
// =============================================================================

const ANCIENT_PUNCTUATION_MAP: Array<[string, string]> = [
  ['、', '，'],
  ['。', '。'],
  ['；', '；'],
  ['：', '：'],
  ['！', '！'],
  ['？', '？'],
  ['（', '（'],
  ['）', '）'],
  ['《', '《'],
  ['》', '》'],
  ['『', '"'],
  ['』', '"'],
  ['【', '【'],
  ['】', '】'],
  ['—', '—'],
  ['……', '……'],
  ['·', '·'],
  ['〈', '〈'],
  ['〉', '〉'],
];

const ANCIENT_CHINESE_QUOTE_PAIRS: Array<[string, string]> = [
  ['『', '』'],
  ['「', '」'],
  ['『', '』'],
];

function fixAncientChinesePunctuation(text: string): string {
  let result = text;

  // Fix unbalanced brackets
  const openCount = (result.match(/〔/g) ?? []).length;
  const closeCount = (result.match(/〕/g) ?? []).length;
  if (openCount !== closeCount) {
    const diff = openCount - closeCount;
    if (diff > 0) result = result.replace(/〔/g, (m, offset) => {
      const remaining = openCount - (offset > 0 ? (result.slice(0, offset).match(/〔/g) ?? []).length : 0);
      return remaining > Math.abs(diff) / 2 + 1 ? '〔' : '';
    });
  }

  // Normalize dashes
  result = result.replace(/—{2,}/g, '—');
  result = result.replace(/—/g, '—');

  // Fix ellipsis variants
  result = result.replace(/\.{3,}/g, '……');
  result = result.replace(/。{2,}/g, '……');
  result = result.replace(/[,，]{3,}/g, '……');

  // Add missing sentence-ending punctuation for classical Chinese
  // If a line/paragraph ends with non-punctuation Chinese char followed by newline, add 。
  result = result.replace(/([\u4e00-\u9fff])(?=\n{1,2}[^「『【])/g, '$1。');

  return result;
}

// =============================================================================
// OCR Error Corrector
// =============================================================================

const OCR_FIXES: Array<[string, RegExp | string, string | ((m: string) => string)]> = [
  // Common OCR confusions (Chinese)
  ['l→了', /丨/g, '了'],
  ['|→| (keep)', /[丨|](?=[\u4e00-\u9fff])/g, '।'], // ideographic comma
  ['一→一 (dedupe)', /—{2,}/g, '—'],
  ['口→日 (fix)', /罒/g, '日'],
  ['日→曰 (fix)', /日(?=[\u4e00-\u9fff]{2,})/g, '曰'],
  ['己→已 (fix)', /巳/g, '已'],
  ['b→6 (fix)', /b(?=\d)/g, '6'],
  ['O→0 (fix)', /O(?=\d)/g, '0'],
  // Whitespace normalization
  ['fix double space', / +/g, ' '],
  // Chinese-English mixing
  ['fix FULLWIDTH → ASCII', /[Ａ-Ｚａ-ｚ]/g, (m: string) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)],
  ['fix FULLWIDTH numbers', /[０-９]/g, (m: string) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0)],
  // Common structural fixes
  ['fix tab', /\t/g, '    '],
  ['fix BOM', /\ufeff/g, ''],
];

function fixOcrErrors(text: string): string {
  let result = text;

  // Character-level fixes for common OCR confusions
  result = result
    .replace(/罒/g, '日')     // 罒 → 日 (confusion in scanned text)
    .replace(/丨(?=[\u4e00-\u9fff])/g, '1')  // | → 1 before Chinese
    .replace(/l(?=[\u4e00-\u9fff])/g, '1')   // l → 1 before Chinese
    .replace(/rn(?=[\u4e00-\u9fff])/g, 'm')  // rn → m
    .replace(/vv/g, 'w')                      // vv → w
    .replace(/ll/g, 'll')                    // ll → ll (keep)

    // Common Chinese OCR errors
    .replace(/日(?=[不有大中小])/g, '曰')  // 日 → 曰 before certain chars

    // Fix garbled sequences
    .replace(/\u0000/g, '')  // null bytes
    .replace(/\r\n/g, '\n')  // Windows line endings
    .replace(/\r/g, '\n');   // old Mac line endings

  // Structural fixes
  for (const [, pattern, replacement] of OCR_FIXES) {
    if (typeof pattern === 'string') continue; // skip already handled
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    }
  }

  return result;
}

// =============================================================================
// Clinical Text Normalizer
// =============================================================================

const CLINICAL_DATE_PATTERNS: Array<[RegExp, string]> = [
  [/\u5e74\d{1,2}\u6708\d{1,2}\u65e5/g, 'DATE'],
  [/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, 'DATE'],
  [/\u300e.*?\u300f/g, 'QUOTE'],  // clinical quotes
];

const CLINICAL_NORMALIZATIONS: Array<[RegExp | string, string]> = [
  [/初[\u3000\s]?诊/g, '初诊'],
  [/复[\u3000\s]?诊/g, '复诊'],
  [/来[\u3000\s]?诊/g, '来诊'],
  [/处[\u3000\s]?方/g, '处方'],
  [/口[\u3000\s]?服/g, '口服'],
  [/剂[\u3000\s]?水/g, '剂水'],
  [/剂[\u3000\s]?煎/g, '剂煎'],
  [/\u3000{2,}/g, '，'], // double ideographic space → comma
  [/\u3000/g, ''],      // single ideographic space → remove
  [/[○◎◯]/g, ''],      // circled characters (often OCR noise)
];

function normalizeClinicalText(text: string): string {
  let result = text;

  // Date normalization
  for (const [pattern, replacement] of CLINICAL_DATE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Common clinical text fixes
  for (const [pattern, replacement] of CLINICAL_NORMALIZATIONS) {
    if (typeof pattern === 'string') {
      result = result.split(pattern).join(replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }

  // Normalize prescription format
  // "桂枝 三錢" → "桂枝三錢"
  result = result.replace(/([\u4e00-\u9fff])\s+([一二三四五六七八九十零壹贰叁肆伍陆柒捌玖拾]+)[\u3000\s]?[錢兩]/g, '$1$2錢');

  // Normalize measurement units
  result = result.replace(/([一二三四五六七八九十零\d]+)[\u3000\s]?g/g, '$1克');
  result = result.replace(/([一二三四五六七八九十零\d]+)[\u3000\s]?ml/g, '$1毫升');

  return result;
}

// =============================================================================
// Paragraph Deduplication
// =============================================================================

function deduplicateParagraphs(text: string, minLen = 20): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= minLen);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const p of paragraphs) {
    // Normalize for comparison
    const normalized = p.replace(/\s+/g, '').slice(0, 200);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(p);
    }
  }

  return unique.join('\n\n');
}

// =============================================================================
// Sentence Chunking
// =============================================================================

function splitIntoSentences(text: string): string[] {
  return text
    .split(/([。！？；\n]+)/)
    .reduce<string[]>((acc, part, i) => {
      if (i % 2 === 0) {
        if (part.trim()) acc.push(part.trim());
      } else {
        if (acc.length > 0 && part.trim()) {
          acc[acc.length - 1] += part;
        } else if (part.trim()) {
          acc.push(part.trim());
        }
      }
      return acc;
    }, [])
    .filter((s) => s.length > 10);
}

// =============================================================================
// Main Preprocessor
// =============================================================================

export async function preprocessCorpus(
  files: CorpusFile[],
  options: PreprocessorOptions = {}
): Promise<CorpusFile[]> {
  const {
    fixOcrErrors = true,
    fixAncientChinesePunctuation = false,
    normalizeClinicalText = false,
    deduplicateParagraphs: dedup = false,
    minParagraphLength = 20,
    maxParagraphLength = 50_000,
  } = options;

  const processed: CorpusFile[] = [];

  for (const file of files) {
    let text = file.rawText;

    // Apply fixes in order
    if (typeof fixOcrErrors === 'function') {
      text = fixOcrErrors(text);
    }

    if (typeof fixAncientChinesePunctuation === 'function') {
      text = fixAncientChinesePunctuation(text);
    }

    if (typeof normalizeClinicalText === 'function') {
      text = normalizeClinicalText(text);
    }

    if (dedup) {
      text = deduplicateParagraphs(text, minParagraphLength);
    }

    // Chunk the text
    const sentences = splitIntoSentences(text);
    const chunks: Array<{
      id: string;
      text: string;
      wordCount: number;
      startOffset: number;
      endOffset: number;
      language: typeof file.language;
      isComplete: boolean;
    }> = [];

    let offset = 0;
    let chunkIndex = 0;
    const CHUNK_SIZE = 50_000;

    for (const sentence of sentences) {
      const sentenceOffset = text.indexOf(sentence, offset);
      if (sentenceOffset === -1) continue;

      if (chunks.length > 0 && chunks[chunkIndex].text.length + sentence.length > CHUNK_SIZE) {
        chunkIndex++;
      }

      if (!chunks[chunkIndex]) {
        chunks[chunkIndex] = {
          id: `${file.id}-chunk-${chunkIndex}`,
          text: '',
          wordCount: 0,
          startOffset: sentenceOffset,
          endOffset: sentenceOffset,
          language: file.language,
          isComplete: true,
        };
      }

      chunks[chunkIndex].text += (chunks[chunkIndex].text ? '。' : '') + sentence;
      chunks[chunkIndex].wordCount = Math.round(chunks[chunkIndex].text.replace(/\s+/g, '').length * 0.4);
      chunks[chunkIndex].endOffset = sentenceOffset + sentence.length;
      offset = sentenceOffset + sentence.length;
    }

    processed.push({
      ...file,
      rawText: text.slice(0, maxParagraphLength),
      cleanedText: text.slice(0, maxParagraphLength),
      chunks: chunks.length > 0 ? chunks : file.chunks,
      wordCount: Math.round(text.slice(0, maxParagraphLength).replace(/\s+/g, '').length * 0.4),
    });
  }

  return processed;
}

/**
 * Quick synchronous preprocessing (no async needed for most operations)
 */
export function preprocessCorpusSync(
  files: CorpusFile[],
  options: PreprocessorOptions = {}
): CorpusFile[] {
  return preprocessCorpus(files, options) as unknown as CorpusFile[];
}
