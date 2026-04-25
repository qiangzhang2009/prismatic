/**
 * Zero 蒸馏引擎 — 语料加载器
 * 支持多格式加载（txt/json/csv/xml/html），自动检测语言和来源类型
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import {
  CorpusFile, TextChunk, SupportedLanguage, SourceType,
  CorpusWarning, CorpusWarningCode
} from '../types';

// =============================================================================
// Interfaces
// =============================================================================

export interface LoadOptions {
  maxFiles?: number;
  maxTotalBytes?: number;
  recursive?: boolean;
  skipHidden?: boolean;
  allowedExtensions?: string[];
}

export interface LoadResult {
  files: CorpusFile[];
  totalSizeBytes: number;
  skippedFiles: number;
  warnings: CorpusWarning[];
}

// =============================================================================
// Language Detection
// =============================================================================

function detectLanguage(text: string): SupportedLanguage {
  const zhChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const enChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  const deChars = (text.match(/[äöüßÄÖÜ]/g) ?? []).length;
  const jaChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) ?? []).length;
  const frChars = (text.match(/[àâçéèêëîïôûùüÿœæ]/gi) ?? []).length;
  const laChars = (text.match(/[āēīōūȳĀĒĪŌŪȲ]/g) ?? []).length;
  const elChars = (text.match(/[\u0370-\u03ff\u1f00-\u1fff]/g) ?? []).length;
  const koChars = (text.match(/[\uac00-\ud7af]/g) ?? []).length;

  const total = Math.max(zhChars + enChars + deChars + jaChars + frChars + laChars + elChars + koChars, 1);
  const zhRatio = zhChars / total;
  const enRatio = enChars / total;
  const jaRatio = jaChars / total;
  const frRatio = frChars / total;
  const deRatio = deChars / total;
  const laRatio = laChars / total;
  const elRatio = elChars / total;
  const koRatio = koChars / total;

  if (zhRatio > 0.3) return 'zh';
  if (enRatio > 0.3) return 'en';
  if (jaRatio > 0.2) return 'ja';
  if (deRatio > 0.2) return 'de';
  if (frRatio > 0.2) return 'fr';
  if (laRatio > 0.2) return 'la';
  if (elRatio > 0.2) return 'el';
  if (koRatio > 0.2) return 'ko';

  // Default: fall back to content-based detection
  if (zhChars > 5) return 'zh';
  if (enChars > 5) return 'en';
  return 'mixed';
}

// =============================================================================
// Source Type Detection
// =============================================================================

function detectSourceType(filepath: string, text: string, filename: string): SourceType {
  const lower = (filename + ' ' + filepath).toLowerCase();
  const textLower = text.slice(0, 1000).toLowerCase();

  if (/tweet|twitter|truth.?social|weibo/.test(lower)) return 'social_media';
  if (/podcast|transcript|speech|lecture|interview|对话|采访|演讲/.test(lower)) return 'podcast';
  if (/article|essay|blog|post|随笔|散文|杂文/.test(lower)) return 'essay';
  if (/book|ebook|novel|小说|书籍|电子书/.test(lower)) return 'book';
  if (/paper|thesis|journal|论文|学术/.test(lower)) return 'academic_paper';
  if (/clinical|diagnosis|patient|医案|诊疗|处方|诊脉/.test(textLower)) return 'archive';
  if (/classical|经|子|史|集|古典/.test(textLower) && text.length > 10000) return 'classical_text';
  if (/ancient|古典|古文/.test(textLower)) return 'classical_text';
  if (/archive|letter|weibo|微博/.test(lower)) return 'archive';
  if (text.match(/^[「『""''【]?.{10,50}[」』""''】]?$/m)?.length > 5) return 'essay';

  // Heuristics from content
  const hasChapterMarkers = text.match(/第[一二三四五六七八九十]+[章节篇]/);
  const hasFootnotes = text.match(/\[\d+\]|\(\d+\)/)?.length > 3;
  if (hasChapterMarkers && hasFootnotes) return 'academic_paper';
  if (hasChapterMarkers && text.length > 50000) return 'book';

  return 'primary';
}

// =============================================================================
// Content Extraction by Format
// =============================================================================

function extractTextFromFile(filepath: string, ext: string, raw: Buffer): string {
  switch (ext.toLowerCase()) {
    case '.txt':
    case '.text':
    case '.orig':
    case '.clean':
      return raw.toString('utf-8');

    case '.json': {
      try {
        const parsed = JSON.parse(raw.toString('utf-8'));
        return extractTextFromJSON(parsed);
      } catch {
        return raw.toString('utf-8');
      }
    }

    case '.csv': {
      const lines = raw.toString('utf-8').split('\n');
      // Try to find text columns (skip headers)
      const textCols: string[] = [];
      for (const line of lines.slice(1, Math.min(lines.length, 100))) {
        const parts = line.split(',');
        for (const part of parts) {
          const cleaned = part.trim().replace(/^["']|["']$/g, '');
          if (cleaned.length > 20) textCols.push(cleaned);
        }
      }
      return textCols.join(' ');
    }

    case '.xml': {
      return raw.toString('utf-8')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    }

    case '.html':
    case '.htm': {
      return raw.toString('utf-8')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    }

    default:
      return raw.toString('utf-8', 0, Math.min(raw.length, 100_000));
  }
}

function extractTextFromJSON(node: unknown, depth = 0): string {
  if (depth > 20) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map((item) => extractTextFromJSON(item, depth + 1)).join(' ');
  }
  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const textFields = ['text', 'content', 'body', 'transcript', 'html', 'raw', 'value', 'source'];
    for (const field of textFields) {
      if (obj[field] !== undefined) {
        return extractTextFromJSON(obj[field], depth + 1);
      }
    }
    return Object.values(obj).map((v) => extractTextFromJSON(v, depth + 1)).join(' ');
  }
  return '';
}

// =============================================================================
// Text Cleaning
// =============================================================================

function cleanText(text: string): string {
  return text
    // Normalize unicode
    .replace(/\u200b/g, '') // zero-width space
    .replace(/\u3000/g, ' ') // ideographic space
    .replace(/\u00a0/g, ' ') // non-breaking space
    // Fix common OCR artifacts
    .replace(/[|_\\/]/g, (m) => m === '|' ? '।' : m === '_' ? '—' : m === '\\' ? '' : '|')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[「」『』]/g, '"')
    .replace(/【】/g, '')
    // Fix obvious errors
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t+/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

// =============================================================================
// Word Count
// =============================================================================

function estimateWordCount(text: string, lang: SupportedLanguage): number {
  if (lang === 'zh') {
    return Math.round(text.replace(/\s+/g, '').length * 0.4);
  }
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// =============================================================================
// File Loading
// =============================================================================

function loadFile(filepath: string, fileId: string): { text: string; lang: SupportedLanguage; sourceType: SourceType } | null {
  try {
    const stat = statSync(filepath);
    if (stat.isDirectory()) return null;

    const raw = readFileSync(filepath);
    const ext = extname(filepath);
    const filename = basename(filepath);
    const text = cleanText(extractTextFromFile(filepath, ext, raw));

    if (text.length < 50) return null;

    // Content contamination check: reject files that look like wrong corpus
    if (isContaminatedContent(text, filepath)) return null;

    const lang = detectLanguage(text);
    const sourceType = detectSourceType(filepath, text, filename);

    return { text, lang, sourceType };
  } catch {
    return null;
  }
}

/**
 * Detect contaminating content (wrong corpus mixed in)
 * Returns true if the file should be skipped
 */
function isContaminatedContent(text: string, filepath: string): boolean {
  // Check for novel/fiction markers in content
  const novelMarkers = [
    '麦克唐纳教授',  // C-98秘方
    '克格勃',         // C-98秘方
    'C-98秘方',       // C-98秘方
    '国际老年医学大会',
  ];

  let matchCount = 0;
  for (const marker of novelMarkers) {
    if (text.includes(marker)) matchCount++;
  }

  // If multiple markers found in the first 5000 chars, this is likely wrong corpus
  const sample = text.slice(0, 5000);
  const sampleMatches = novelMarkers.filter((m) => sample.includes(m)).length;

  if (sampleMatches >= 2) return true;
  return false;
}

const FORBIDDEN_PATTERNS = [
  /秘方/,      // C-98秘方 - 混入的小说
  /C[\-－]?98/, // 秘方小说相关文件
  /小说/,      // 小说类文件
  /fiction/,   // fiction
  /novel/,     // novel
];

function shouldSkipFile(filepath: string, options: LoadOptions): boolean {
  const filename = basename(filepath);
  const lowerFilename = filename.toLowerCase();

  if (options.skipHidden !== false && filename.startsWith('.')) return true;
  if (filename.startsWith('tmp_')) return true;
  if (filename.startsWith('_')) return true;

  // Skip known non-corpus files
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(filename) || pattern.test(filepath)) return true;
  }

  const ext = extname(filepath).toLowerCase();
  const allowed = options.allowedExtensions ?? ['.txt', '.text', '.json', '.csv', '.xml', '.html', '.htm', '.orig', '.clean'];
  if (!allowed.includes(ext)) return true;

  return false;
}

// =============================================================================
// Main Loader
// =============================================================================

export async function loadCorpus(
  corpusDir: string,
  options: LoadOptions = {}
): Promise<LoadResult> {
  const {
    maxFiles = 500,
    maxTotalBytes = 500 * 1024 * 1024,
    recursive = true,
    skipHidden = true,
    allowedExtensions,
  } = options;

  const opts: LoadOptions = {
    maxFiles,
    maxTotalBytes,
    recursive,
    skipHidden,
    allowedExtensions,
  };

  const files: CorpusFile[] = [];
  const warnings: CorpusWarning[] = [];
  let totalSizeBytes = 0;
  let skippedFiles = 0;
  let fileCounter = 0;

  function walkDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          if (shouldSkipFile(fullPath, opts)) {
            skippedFiles++;
            continue;
          }

          // Size check
          try {
            const stat = statSync(fullPath);
            if (totalSizeBytes + stat.size > maxTotalBytes) {
              warnings.push({
                code: 'large_file_skipped',
                message: `Total size limit (${maxTotalBytes / 1024 / 1024}MB) reached, skipping ${entry.name}`,
                affectedFiles: [fullPath],
                severity: 'warn',
              });
              continue;
            }
          } catch {
            skippedFiles++;
            continue;
          }

          const result = loadFile(fullPath, `file-${++fileCounter}`);
          if (!result) {
            skippedFiles++;
            continue;
          }

          const { text, lang, sourceType } = result;

          if (files.length >= maxFiles) {
            skippedFiles++;
            continue;
          }

          const chunk: TextChunk = {
            id: `file-${fileCounter}-chunk-0`,
            text: text.slice(0, 50_000),
            wordCount: estimateWordCount(text.slice(0, 50_000), lang),
            startOffset: 0,
            endOffset: Math.min(text.length, 50_000),
            language: lang,
            isComplete: text.length <= 50_000,
          };

          const corpusFile: CorpusFile = {
            id: `file-${fileCounter}`,
            filename: entry.name,
            filepath: fullPath,
            language: lang,
            sourceType,
            sizeBytes: text.length,
            wordCount: estimateWordCount(text, lang),
            rawText: text,
            cleanedText: cleanText(text),
            chunks: [chunk],
            detectedAt: new Date(),
          };

          files.push(corpusFile);
          totalSizeBytes += text.length;
        }
      }
    } catch (err) {
      warnings.push({
        code: 'corrupt_file',
        message: `Failed to read directory ${dir}: ${String(err).slice(0, 100)}`,
        severity: 'error',
      });
    }
  }

  walkDir(corpusDir);

  if (files.length === 0) {
    warnings.push({
      code: 'no_files',
      message: `No valid corpus files found in ${corpusDir}`,
      severity: 'error',
    });
  }

  return { files, totalSizeBytes, skippedFiles, warnings };
}
