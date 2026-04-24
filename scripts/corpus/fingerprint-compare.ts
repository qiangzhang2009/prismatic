#!/usr/bin/env bun
/**
 * corpus/fingerprint-compare.ts — 蒸馏前后 ExpressionDNA 指纹对比
 *
 * 比较语料库指纹（蒸馏前）与蒸馏输出（蒸馏后）的 vocabulary 重叠度，
 * 用于检测语义漂移和污染。
 *
 * 算法:
 *   重叠度 = (蒸馏后 vocabulary ∩ 语料高频词) / 蒸馏后 vocabulary 数
 *   重叠度 < 30% → 语义漂移信号
 *   重叠度 < 15% → 严重漂移 / 污染信号
 *
 * Usage:
 *   bun run scripts/corpus/fingerprint-compare.ts --persona wittgenstein
 *   bun run scripts/corpus/fingerprint-compare.ts --persona wittgenstain --verbose
 *   bun run scripts/corpus/fingerprint-compare.ts --persona einstein --verbose
 *   bun run scripts/corpus/fingerprint-compare.ts --persona warren-buffett --verbose
 *   bun run scripts/corpus/fingerprint-compare.ts --all               # 全部 v4/v5 persona
 *   bun run scripts/corpus/fingerprint-compare.ts --list              # 列出所有可用 persona
 */

import * as fs from 'fs';
import * as path from 'path';

const CORPUS_DIR = path.join(__dirname, '..', '..', 'corpus');
const DISTILLED_DIR = path.join(__dirname, '..', '..', 'corpus', 'distilled');

// ─── Text Directory Resolution ───────────────────────────────────────────────

function findTextsDir(personaId: string): string | null {
  const textsDir = path.join(CORPUS_DIR, personaId, 'texts');
  if (fs.existsSync(textsDir) && fs.statSync(textsDir).isDirectory()) {
    return textsDir;
  }
  const wittsrgDir = path.join(CORPUS_DIR, personaId, 'wittsrg');
  if (fs.existsSync(wittsrgDir) && fs.statSync(wittsrgDir).isDirectory()) {
    return wittsrgDir;
  }
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Fingerprint {
  personaId: string;
  topWords: string[];
  bigrams: string[];
  trigrams: string[];
  signaturePhrases: string[];
  tone: string;
  avgSentenceLength: number;
  dominantLang: string;
  totalTokens: number;
  uniqueTokenCount: number;
  uniqueWordRatio: number;
}

interface CompareResult {
  persona: string;
  corpusVersion: string; // 'v4' or 'v5'
  corpusFingerprint: Fingerprint;
  distilledVocabulary: string[];
  distilledMentalModels: string[];
  vocabularyOverlap: number;      // 0-100
  mentalModelOverlap: number;    // 0-100
  conceptDriftScore: number;     // 0-100, higher = more drift
  driftSeverity: 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
  driftSignals: string[];
  recommendations: string[];
  score?: number;      // distillation score if available
  grade?: string;      // distillation grade if available
}

// ─── Helpers (mirroring wiki-builder.ts) ───────────────────────────────────

const CJK_RANGES = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const ZH_STOPWORDS = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '这', '那', '他', '她', '它', '们', '什么', '怎么', '可以', '因为', '所以', '但是', '非常', '最', '与', '而', '之', '于', '以', '其', '自己', '这个', '那个', '没有', '已经', '可能', '必须']);
const EN_STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'and', 'but', 'or', 'if', 'then', 'so', 'not', 'no', 'all', 'any', 'also', 'only', 'more', 'very', 'just', 'than', 'into', 'such', 'even', 'then', 'now', 'here', 'there', 'what', 'where', 'when']);

function detectLanguage(text: string): string {
  const cjkCount = (text.match(CJK_RANGES) ?? []).length;
  return cjkCount / text.length > 0.05 ? 'zh' : 'en';
}

function tokenizeEN(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ' ').split(/\s+/).filter(t => t.length > 2 && !EN_STOP.has(t));
}

function extractZhWords(text: string): string[] {
  const chars = text.split('').filter(c => CJK_RANGES.test(c));
  const words: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const w = chars[i] + chars[i + 1];
    if (!ZH_STOPWORDS.has(w[0]) && !ZH_STOPWORDS.has(w[1])) words.push(w);
  }
  return words;
}

function tokenizeZH(text: string): string[] {
  return text.split('').filter(c => CJK_RANGES.test(c) && !ZH_STOPWORDS.has(c));
}

function extractNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const key = tokens.slice(i, i + n).join('_');
    ngrams.set(key, (ngrams.get(key) ?? 0) + 1);
  }
  return ngrams;
}

function extractSignaturePhrases(text: string): string[] {
  // Find phrases that repeat 3+ times
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 10);
  const phraseFreq = new Map<string, number>();
  for (const sentence of sentences) {
    const trimmed = sentence.trim().slice(0, 80);
    if (trimmed.length > 20) {
      phraseFreq.set(trimmed, (phraseFreq.get(trimmed) ?? 0) + 1);
    }
  }
  return [...phraseFreq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

// ─── Fingerprint Extraction ─────────────────────────────────────────────────

const MAX_FILE_SIZE = 500 * 1024; // 500KB per file max
const MAX_TOTAL_TOKENS = 200_000; // cap total tokens to prevent OOM

function extractCorpusFingerprint(personaId: string): Fingerprint {
  const textsDir = findTextsDir(personaId);
  if (!textsDir) {
    throw new Error(`No texts directory found for ${personaId} (tried texts/, wittsrg/)`);
  }

  const entries = fs.readdirSync(textsDir).filter(e => e.endsWith('.txt'));
  let allTokens: string[] = [];
  let allContent = '';
  let lang = 'en';
  let totalChars = 0;

  for (const entry of entries) {
    const filepath = path.join(textsDir, entry);
    const stat = fs.statSync(filepath);
    // Read full content for language detection; cap at 500KB for tokenization
    let content = fs.readFileSync(filepath, 'utf-8');
    if (content.length > MAX_FILE_SIZE) {
      content = content.slice(0, MAX_FILE_SIZE);
    }
    lang = detectLanguage(content);
    const tokens = lang === 'zh' ? extractZhWords(content) : tokenizeEN(content);
    allTokens.push(...tokens);
    allContent += content + '\n';
    totalChars += content.length;
    // Cap total tokens to prevent stack overflow and OOM on large corpora
    if (allTokens.length > MAX_TOTAL_TOKENS) break;
  }

  const wordFreq = new Map<string, number>();
  for (const token of allTokens) {
    wordFreq.set(token, (wordFreq.get(token) ?? 0) + 1);
  }

  const sortedWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);
  const topWords = sortedWords.slice(0, 50).map(([w]) => w);
  const uniqueWordRatio = allTokens.length > 0 ? new Set(allTokens).size / allTokens.length : 0;

  // Bigrams
  const bigrams = extractNgrams(allTokens, 2);
  const topBigrams = [...bigrams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([b]) => b.replace(/_/g, ' '));

  // Trigrams
  const trigrams = extractNgrams(allTokens, 3);
  const topTrigrams = [...trigrams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([b]) => b.replace(/_/g, ' '));

  // Sentences — limit to first 500K chars
  const sentences = allContent.slice(0, 500000).split(/[。！？.!?]+/).filter(s => s.trim().length > 10);
  const avgSentenceLength = sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length : 0;

  // Signature phrases
  const signaturePhrases = extractSignaturePhrases(allContent);

  return {
    personaId,
    topWords,
    bigrams: topBigrams,
    trigrams: topTrigrams,
    signaturePhrases,
    tone: 'N/A',
    avgSentenceLength,
    dominantLang: lang,
    totalTokens: allTokens.length,
    uniqueTokenCount: new Set(allTokens).size,
    uniqueWordRatio,
  };
}

function extractDistilledFingerprint(jsonPath: string): {
  vocabulary: string[];
  mentalModelNames: string[];
  score: number | undefined;
  grade: string | undefined;
} {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Distilled JSON not found: ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  // Handle both v4 and v5 format (v5 has distillationVersion field)
  const vocabulary = data.expression?.vocabulary ?? [];
  const mentalModelNames = (data.knowledge?.mentalModels ?? []).map((m: any) =>
    m.nameZh || m.name || ''
  ).filter(Boolean);

  return {
    vocabulary,
    mentalModelNames,
    score: data.score?.overall,
    grade: data.grade,
  };
}

// ─── Comparison Core ────────────────────────────────────────────────────────

// Detect if a vocabulary entry contains Chinese characters
function hasChineseChars(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

// Extract semantic keywords from mental model names (removes common stopwords)
const MM_STOP = new Set(['的', 'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'by']);
function extractMMKeywords(names: string[]): string[] {
  return names.flatMap(name =>
    name.toLowerCase().split(/[\s\-_，。、]+/).filter(w => w.length > 1 && !MM_STOP.has(w))
  );
}

// Normalize bigram/trigram strings for comparison (remove underscores, lowercase)
function normalizePhrase(phrase: string): string {
  return phrase.replace(/_/g, ' ').toLowerCase().trim();
}

// Compute Jaccard similarity between two sets
function jaccardOverlap(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function compareFingerprints(
  corpusFp: Fingerprint,
  distilled: {
    vocabulary: string[];
    mentalModelNames: string[];
    score?: number;
    grade?: string;
  },
  corpusVersion: string
): CompareResult {
  const vocab = distilled.vocabulary;
  const mmNames = distilled.mentalModelNames;
  const hasVocabulary = vocab.length > 0;

  // Step 1: Language detection
  const corpusLang = corpusFp.dominantLang;
  const vocabIsChinese = hasVocabulary && hasChineseChars(vocab[0]);
  const distillationLang = vocabIsChinese ? 'zh' : 'en';
  const langMismatch = corpusLang !== distillationLang && hasVocabulary;

  // Step 2: Build lookup sets
  const corpusWordSet = new Set(corpusFp.topWords.map(w => w.toLowerCase()));
  const corpusBigramSet = new Set(corpusFp.bigrams.map(b => normalizePhrase(b)));
  const corpusTrigramSet = new Set(corpusFp.trigrams.map(t => normalizePhrase(t)));
  const mmKeywordSet = new Set(extractMMKeywords(mmNames));

  // Build distillation vocabulary sets
  const vocabBigramSet = new Set<string>();
  const vocabWordSet = new Set<string>();
  for (const v of vocab) {
    const words = v.toLowerCase().split(/[\s\-_，。、]+/).filter(w => w.length > 1);
    for (let i = 0; i < words.length - 1; i++) {
      vocabBigramSet.add(words[i] + ' ' + words[i + 1]);
    }
    for (const w of words) vocabWordSet.add(w);
  }

  // Step 3: Compute overlaps
  let vocabularyOverlap: number;
  let mentalModelOverlap: number;

  if (!hasVocabulary) {
    vocabularyOverlap = 0;
    mentalModelOverlap = 0;
  } else if (langMismatch) {
    // Cross-language: bigram/word Jaccard — language-agnostic phrase structure
    const bigramJaccard = jaccardOverlap(vocabBigramSet, corpusBigramSet);
    const wordJaccard = jaccardOverlap(vocabWordSet, corpusWordSet);
    vocabularyOverlap = Math.round(Math.max(bigramJaccard, wordJaccard) * 100);
    mentalModelOverlap = Math.round(jaccardOverlap(mmKeywordSet, corpusWordSet) * 100);
  } else {
    // Same language: direct token overlap
    const vocabLower = new Set(vocab.map(v => v.toLowerCase()));
    const wordOverlap = [...vocabLower].filter(w => corpusWordSet.has(w)).length;
    vocabularyOverlap = Math.round((wordOverlap / Math.max(vocabLower.size, 1)) * 100);
    mentalModelOverlap = Math.round(jaccardOverlap(mmKeywordSet, corpusWordSet) * 100);
  }

  // Step 4: Drift signals
  const driftSignals: string[] = [];

  if (!hasVocabulary) {
    driftSignals.push('蒸馏 vocabulary 为空 — L4 Expression 层失败');
  }
  if (hasVocabulary && vocab.length < 5) {
    driftSignals.push(`蒸馏 vocabulary 过少: ${vocab.length} 个词（正常应为 15-20）`);
  }
  if (langMismatch) {
    const direction = `${corpusLang} → ${distillationLang}`;
    driftSignals.push(`语言方向: ${direction}（预期跨语言蒸馏）`);
  }
  if (mentalModelOverlap < 15 && mmNames.length > 0) {
    driftSignals.push(`思维模型关键词与语料关键词缺乏语义关联: 重叠 ${mentalModelOverlap}%`);
  }
  if (corpusFp.uniqueWordRatio < 0.10) {
    driftSignals.push(`语料词汇多样性极低: ${(corpusFp.uniqueWordRatio * 100).toFixed(1)}%，可能污染`);
  }

  // HTML tag contamination (Jeff Bezos case)
  const hasHtmlSignal = corpusFp.topWords.some(w =>
    ['div', 'class', 'module', 'span', 'href', 'script', 'src'].includes(w.toLowerCase())
  );
  if (hasHtmlSignal) {
    driftSignals.push('🚨 检测到 HTML 标签残留 (div, class, script...) — 语料为网页源码');
  }

  // Step 5: Compute drift score
  let vocabularyDrift: number;
  if (!hasVocabulary) {
    vocabularyDrift = 100;
  } else if (langMismatch) {
    vocabularyDrift = Math.max(0, 50 - vocabularyOverlap);
  } else {
    vocabularyDrift = Math.max(0, 100 - vocabularyOverlap * 2);
  }

  const mentalModelDrift = Math.max(0, 100 - mentalModelOverlap * 3);
  const pollutionPenalty = hasHtmlSignal ? 50 : 0;
  const conceptDriftScore = Math.min(100, Math.round(
    vocabularyDrift * 0.4 + mentalModelDrift * 0.3 + pollutionPenalty
  ));

  // Step 6: Severity
  let driftSeverity: CompareResult['driftSeverity'];
  if (hasHtmlSignal || !hasVocabulary) {
    driftSeverity = 'critical';
  } else if (conceptDriftScore >= 75) {
    driftSeverity = 'severe';
  } else if (conceptDriftScore >= 50) {
    driftSeverity = 'moderate';
  } else if (conceptDriftScore >= 25) {
    driftSeverity = 'mild';
  } else {
    driftSeverity = 'none';
  }

  const recommendations: string[] = [];
  if (!hasVocabulary) {
    recommendations.push('检查 L4 Expression 层是否正常工作');
  }
  if (hasHtmlSignal) {
    recommendations.push('🚨 立即停止使用该语料，需重新采集原始文本');
    recommendations.push('检查采集脚本的 HTML 解析器配置');
  }
  if (conceptDriftScore >= 75 && !hasHtmlSignal) {
    recommendations.push('概念漂移严重，建议审查语料来源和蒸馏配置');
  }
  if (corpusFp.uniqueWordRatio < 0.10) {
    recommendations.push(`语料多样性 ${(corpusFp.uniqueWordRatio * 100).toFixed(1)}% < 10%，需补充高质量语料`);
  }

  return {
    persona: corpusFp.personaId,
    corpusVersion,
    corpusFingerprint: corpusFp,
    distilledVocabulary: vocab,
    distilledMentalModels: mmNames,
    vocabularyOverlap: Math.round(vocabularyOverlap),
    mentalModelOverlap: Math.round(mentalModelOverlap),
    conceptDriftScore,
    driftSeverity,
    driftSignals,
    recommendations,
    score: distilled.score,
    grade: distilled.grade,
  };
}

// ─── Report Rendering ────────────────────────────────────────────────────────

function renderReport(result: CompareResult): string {
  const sev = {
    none: '✅',
    mild: '⚠️',
    moderate: '⚠️',
    severe: '🚨',
    critical: '🚨',
  }[result.driftSeverity];

  const driftColor = {
    none: 'green',
    mild: 'yellow',
    moderate: 'orange',
    severe: 'red',
    critical: 'darkred',
  }[result.driftSeverity];

  return `
════════════════════════════════════════════════════
  ${sev} ${result.persona} — Fingerprint Comparison (${result.corpusVersion})
════════════════════════════════════════════════════

## Corpus Fingerprint
  Files analyzed:          ${result.corpusFingerprint.totalTokens > 0 ? '—' : '—'}
  Dominant language:        ${result.corpusFingerprint.dominantLang}
  Total tokens:             ${result.corpusFingerprint.totalTokens.toLocaleString()}
  Unique tokens:           ${result.corpusFingerprint.uniqueTokenCount.toLocaleString()}
  Unique word ratio:       ${(result.corpusFingerprint.uniqueWordRatio * 100).toFixed(1)}%
  Avg sentence length:      ${result.corpusFingerprint.avgSentenceLength.toFixed(1)} chars

## Top 20 Corpus Keywords
  ${result.corpusFingerprint.topWords.slice(0, 20).join(', ')}

## Distillation Fingerprint
  Vocabulary size:          ${result.distilledVocabulary.length}
  Mental models:            ${result.distilledMentalModels.length}
  ${result.score !== undefined ? `Distillation score:       ${result.score} (${result.grade})` : ''}

## Distillation Vocabulary
  ${result.distilledVocabulary.slice(0, 20).join(', ')}

## Overlap Analysis
  Vocabulary overlap:        ${result.vocabularyOverlap}%  ${result.vocabularyOverlap < 30 ? '⚠️' : result.vocabularyOverlap < 50 ? '⚠️' : '✅'}
  Mental model overlap:       ${result.mentalModelOverlap}%
  Concept drift score:        ${result.conceptDriftScore}/100  [${result.driftSeverity}]

## Drift Severity: ${result.driftSeverity.toUpperCase()}
${result.driftSignals.length > 0 ? '\n## Drift Signals\n' + result.driftSignals.map(s => `  ⚠ ${s}`).join('\n') : ''}
${result.recommendations.length > 0 ? '\n## Recommendations\n' + result.recommendations.map(r => `  → ${r}`).join('\n') : ''}
════════════════════════════════════════════════════
`;
}

function renderTable(results: CompareResult[]): string {
  const header = '| Persona | Version | Vocab Overlap | Drift Score | Severity | Score | Grade | Signals |';
  const sep = '|----------|---------|--------------|-------------|----------|-------|-------|---------|';

  const rows = results.map(r => {
    const sig = r.driftSignals.length > 0 ? `${r.driftSignals.length}` : '—';
    return `| ${r.persona.padEnd(20)} | ${(r.corpusVersion || '—').padEnd(7)} | ${r.vocabularyOverlap.toString().padStart(12)}% | ${r.conceptDriftScore.toString().padStart(12)}/100 | ${r.driftSeverity.padEnd(8)} | ${(r.score ?? '—').toString().padStart(5)} | ${(r.grade ?? '—').padEnd(5)} | ${sig.padStart(7)} |`;
  });

  return `
════════════════════════════════════════════════════════════════════════════════════════
  Fingerprint Comparison — All Personas
════════════════════════════════════════════════════════════════════════════════════════

${header}
${sep}
${rows.join('\n')}

════════════════════════════════════════════════════════════════════════════════════════
  Severity: none < mild < moderate < severe < critical
  Vocab Overlap: lower = more drift; <30% = concern, <15% = critical
════════════════════════════════════════════════════════════════════════════════════════
`;
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  persona: args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null,
  all: args.includes('--all'),
  list: args.includes('--list'),
  verbose: args.includes('--verbose'),
};

function findDistilledJson(personaId: string): { path: string; version: string } | null {
  // Try v5 first (more recent), then v4
  for (const version of ['v5', 'v4']) {
    const jsonPath = path.join(DISTILLED_DIR, version, `${personaId}-${version}.json`);
    if (fs.existsSync(jsonPath)) {
      return { path: jsonPath, version };
    }
  }
  return null;
}

function listAvailablePersonas(): string[] {
  const personas: string[] = [];
  if (!fs.existsSync(CORPUS_DIR)) return personas;
  for (const name of fs.readdirSync(CORPUS_DIR)) {
    if (findTextsDir(name) !== null) {
      personas.push(name);
    }
  }
  return personas.sort();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Fingerprint Compare ===\n');

  if (flags.list) {
    const personas = listAvailablePersonas();
    console.log(`Found ${personas.length} personas with texts/:\n`);
    for (const p of personas) {
      const distInfo = findDistilledJson(p);
      const distStatus = distInfo
        ? `${distInfo.version.padEnd(3)} (score: ${(() => {
          try {
            const d = JSON.parse(fs.readFileSync(distInfo.path, 'utf-8'));
            return d.score?.overall ?? '—';
          } catch { return '—'; }
        })()})`
        : 'no distilled JSON';
      console.log(`  ${p.padEnd(25)} ${distStatus}`);
    }
    return;
  }

  let personas: string[];
  if (flags.persona) {
    personas = [flags.persona];
  } else if (flags.all) {
    personas = listAvailablePersonas();
  } else {
    console.error('Error: --persona <id> or --all or --list required');
    console.log('\nUsage:');
    console.log('  bun run scripts/corpus/fingerprint-compare.ts --persona wittgenstain --verbose');
    console.log('  bun run scripts/corpus/fingerprint-compare.ts --persona einstein --verbose');
    console.log('  bun run scripts/corpus/fingerprint-compare.ts --all');
    console.log('  bun run scripts/corpus/fingerprint-compare.ts --list');
    process.exit(1);
  }

  console.log(`Comparing ${personas.length} persona(s)...\n`);
  const results: CompareResult[] = [];

  for (const personaId of personas) {
    try {
      const fp = extractCorpusFingerprint(personaId);
      const distInfo = findDistilledJson(personaId);

      if (!distInfo) {
        console.log(`⚠ ${personaId}: no distilled JSON found (v4/v5)`);
        continue;
      }

      const distilled = extractDistilledFingerprint(distInfo.path);
      const result = compareFingerprints(fp, distilled, distInfo.version);
      results.push(result);

      if (flags.verbose) {
        console.log(renderReport(result));
      } else {
        const sev = { none: '✅', mild: '⚠️', moderate: '⚠️', severe: '🚨', critical: '🚨' }[result.driftSeverity];
        const sig = result.driftSignals.length > 0 ? ` [${result.driftSignals.length} signal(s)]` : '';
        console.log(`${sev} ${personaId}: vocab overlap ${result.vocabularyOverlap}%, drift ${result.conceptDriftScore}/100 (${result.driftSeverity})${sig}`);
      }
    } catch (e: any) {
      console.log(`⚠ ${personaId}: ${e.message}`);
    }
  }

  if (personas.length > 1) {
    console.log(renderTable(results));

    // Summary
    const critical = results.filter(r => r.driftSeverity === 'critical' || r.driftSeverity === 'severe').length;
    const moderate = results.filter(r => r.driftSeverity === 'moderate').length;
    console.log(`\nSummary: ${critical} severe/critical | ${moderate} moderate | ${results.length - critical - moderate} mild/none`);

    if (critical > 0) {
      console.log('\n🚨 需要关注的 persona:');
      for (const r of results.filter(r => r.driftSeverity === 'critical' || r.driftSeverity === 'severe')) {
        console.log(`  ${r.persona}: ${r.driftSignals[0]}`);
      }
    }
  }
}

main().catch(console.error);
