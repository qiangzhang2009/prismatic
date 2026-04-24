#!/usr/bin/env bun
/**
 * corpus/wiki-lint.ts — 语料库污染检测脚本
 *
 * 对指定 persona 的语料库运行 Lint 检查，检测污染信号。
 * 结果写入 corpus/{persona}/wiki/contamination-log.md
 *
 * Usage:
 *   bun run scripts/corpus/wiki-lint.ts --persona wittgenstein
 *   bun run scripts/corpus/wiki-lint.ts --persona einstein --verbose
 *   bun run scripts/corpus/wiki-lint.ts --persona wittgenstein --write   # 写入 contamination-log.md
 *   bun run scripts/corpus/wiki-lint.ts --all                          # 扫描所有 persona
 */

import * as fs from 'fs';
import * as path from 'path';

const CORPUS_DIR = path.join(__dirname, '..', '..', 'corpus');
const WIKI_SUBDIR = 'wiki';

const MAX_FILE_SIZE = 500 * 1024; // 500KB per file max
const MAX_TOTAL_CHARS = 2 * 1024 * 1024; // 2MB total sample

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

// ─── Semantic Keywords Registry (same as wiki-builder.ts) ─────────────────────

const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  philosophy: ['philosophy', 'philosophical', 'thought', 'thinking', 'reason', 'logic', 'meaning', 'language', 'truth', 'knowledge', 'ethics', 'morality', 'virtue', 'soul', 'mind', 'idea', 'concept', 'proposition', 'rule', 'grammar', 'metaphysics', 'epistemology', 'ontology', 'socrates', 'plato', 'aristotle'],
  business: ['business', 'investment', 'market', 'company', 'capital', 'profit', 'risk', 'strategy', 'management', 'entrepreneur', 'competition', 'economy', 'growth', 'value', 'shareholder', 'earnings', 'buffett', 'munger'],
  science: ['experiment', 'theory', 'hypothesis', 'observation', 'physics', 'mathematics', 'biology', 'quantum', 'relativity', 'particle', 'energy', 'matter', 'equation', 'law', 'principle', 'discovery', 'scientific', 'turing', 'einstein', 'tesla', 'feynman'],
  spirituality: ['spirit', 'soul', 'enlightenment', 'dharma', 'zen', 'meditation', 'buddha', 'tao', 'wu wei', 'emptiness', 'impermanence', 'suffering', 'nirvana', 'wisdom', 'compassion', 'karma', 'rebirth', 'confucian'],
  literature: ['story', 'character', 'narrative', 'plot', 'theme', 'metaphor', 'symbol', 'poetry', 'verse', 'rhetoric', 'tragedy', 'hero', 'journey', 'quest', 'transformation', 'monkey', 'pilgrim', 'sun wukong'],
  military: ['war', 'strategy', 'tactics', 'enemy', 'terrain', 'formation', 'command', 'victory', 'defeat', 'army', 'soldier', 'battle', 'conflict', 'attack', 'defense', 'intelligence', 'sun tzu', 'art of war'],
  history: ['dynasty', 'emperor', 'reign', 'historian', 'chronicle', 'empire', 'civilization', 'ancient', 'kingdom', 'conquest', 'rebellion', 'reform', 'records', 'grand historian', 'sima qian'],
};

const DOMAIN_PERSONA_MAP: Record<string, string> = {
  'socrates': 'philosophy', 'plato': 'philosophy', 'aristotle': 'philosophy',
  'confucius': 'philosophy', 'lao-zi': 'spirituality', 'zhuang-zi': 'philosophy',
  'hui-neng': 'spirituality', 'epictetus': 'philosophy', 'seneca': 'philosophy',
  'marcus-aurelius': 'philosophy', 'wittgenstein': 'philosophy',
  'sima-qian': 'history', 'qu-yuan': 'literature', 'sun-tzu': 'military',
  'zhuge-liang': 'military', 'elon-musk': 'business', 'warren-buffett': 'business',
  'charlie-munger': 'business', 'jeff-bezos': 'business', 'peter-thiel': 'business',
  'jack-ma': 'business', 'nassim-taleb': 'business', 'paul-graham': 'business',
  'sam-altman': 'business', 'alan-turing': 'science', 'nikola-tesla': 'science',
  'einstein': 'science', 'qian-xuesen': 'science', 'richard-feynman': 'science',
  'jensen-huang': 'business', 'sun-wukong': 'literature', 'journey-west': 'literature',
  'zhu-bajie': 'literature', 'tripitaka': 'literature', 'three-kingdoms': 'literature',
  'liu-bei': 'military', 'xiang-yu': 'military', 'cao-cao': 'military',
  'han-fei-zi': 'philosophy', 'mo-zi': 'philosophy', 'mencius': 'philosophy',
  'shao-yong': 'philosophy', 'carl-jung': 'philosophy',
  'john-maynard-keynes': 'business', 'ray-dalio': 'business',
  'huangdi-neijing': 'spirituality', 'aleister-crowley': 'spirituality',
};

// ─── Domain Mismatch Keywords (signals wrong-domain content) ─────────────────

const MISMATCH_SIGNALS: Record<string, string[]> = {
  philosophy: ['garden', 'bulb', 'perennial', 'soil', 'flower', 'plant', 'harvest', 'vegetable', 'yard', 'landscape', 'farming', 'agriculture'],
  science: ['garden', 'bulb', 'perennial', 'soil', 'flower'],
  business: ['philosophy', 'ethics', 'virtue', 'metaphysics'],
  spirituality: ['investment', 'market', 'capital', 'profit'],
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContaminationSignal {
  type: 'vocabulary_anomaly' | 'domain_mismatch' | 'duplicate_content' | 'low_diversity' | 'weak_signal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
  description: string;
  metric: string;
  value: string;
  threshold: string;
}

interface FileLintResult {
  filename: string;
  size: number;
  wordCount: number;
  uniqueWordRatio: number;
  lang: string;
  title: string;
  source: string;
  signals: string[];
  anomalyKeywords: string[];
}

interface LintResult {
  persona: string;
  timestamp: string;
  overallStatus: 'clean' | 'suspicious' | 'contaminated';
  summary: {
    totalFiles: number;
    cleanFiles: number;
    suspiciousFiles: number;
    contaminatedFiles: number;
  };
  signals: ContaminationSignal[];
  fileResults: FileLintResult[];
  topWords: Array<[string, number]>;
  globalKeywordHitRate: number;
  recommendations: string[];
}

// ─── Helpers (mirroring wiki-builder.ts) ────────────────────────────────────

const CJK_RANGES = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const ZH_STOPWORDS = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '这', '那', '他', '她', '它', '们', '什么', '怎么', '可以', '因为', '所以', '但是', '非常', '最', '与', '而', '之', '于', '以', '其']);
const EN_STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'this', 'that', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'and', 'but', 'or', 'if', 'then', 'so', 'not', 'no', 'all', 'any']);

function detectLanguage(text: string): string {
  const cjkCount = (text.match(CJK_RANGES) ?? []).length;
  return cjkCount / text.length > 0.05 ? 'zh' : 'en';
}

function estimateWordCount(text: string, lang: string): number {
  if (lang === 'zh') {
    return Math.round((text.match(CJK_RANGES) ?? []).length * 0.4);
  }
  return text.split(/\s+/).filter(t => t.length > 0).length;
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

function extractMetadata(content: string): { title: string; source: string } {
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  const authorMatch = content.match(/^Author:\s*(.+)$/m);
  if (titleMatch) {
    return { title: titleMatch[1].trim(), source: authorMatch?.[1]?.trim() ?? 'Unknown' };
  }
  return { title: 'Unknown', source: 'Unknown' };
}

function computeSimilarity(contentA: string, contentB: string): number {
  // Only use first 50K chars to avoid stack overflow
  const a = contentA.slice(0, 50000);
  const b = contentB.slice(0, 50000);
  const toNgrams = (text: string, n: number): Set<string> => {
    const tokens = text.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ' ').split(/\s+/).filter(t => t.length > 2 && !EN_STOP.has(t));
    const ngrams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join('_'));
    }
    return ngrams;
  };
  const gramsA = toNgrams(a, 3);
  const gramsB = toNgrams(b, 3);
  let intersection = 0;
  for (const g of gramsA) { if (gramsB.has(g)) intersection++; }
  const union = gramsA.size + gramsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ─── Lint Core ───────────────────────────────────────────────────────────────

function lintCorpus(personaId: string): LintResult {
  const textsDir = findTextsDir(personaId);
  if (!textsDir) throw new Error(`No texts directory found for ${personaId} (tried texts/, wittsrg/)`);
  const domain = DOMAIN_PERSONA_MAP[personaId] ?? 'philosophy';
  const targetKeywords = SEMANTIC_KEYWORDS[domain] ?? SEMANTIC_KEYWORDS.philosophy;
  const mismatchSignals = MISMATCH_SIGNALS[domain] ?? [];

  if (!fs.existsSync(textsDir)) {
    throw new Error(`Texts directory not found: ${textsDir}`);
  }

  const entries = fs.readdirSync(textsDir).filter(e => e.endsWith('.txt'));
  const fileResults: FileLintResult[] = [];
  const signals: ContaminationSignal[] = [];
  let allTokens: string[] = [];
  let allContent = '';

  // First pass: per-file analysis
  // Limit total processed chars to avoid stack overflow on large corpora
  let totalProcessedChars = 0;

  for (const entry of entries) {
    const filepath = path.join(textsDir, entry);
    const stat = fs.statSync(filepath);

    // Skip files > 500KB to avoid memory issues
    let content: string;
    if (stat.size > MAX_FILE_SIZE) {
      content = fs.readFileSync(filepath, 'utf-8').slice(0, MAX_FILE_SIZE);
    } else {
      content = fs.readFileSync(filepath, 'utf-8');
    }

    const lang = detectLanguage(content);
    const wordCount = estimateWordCount(content, lang);
    const tokens = lang === 'zh' ? extractZhWords(content) : tokenizeEN(content);
    const uniqueWords = new Set(tokens);
    const uniqueWordRatio = tokens.length > 0 ? uniqueWords.size / tokens.length : 0;
    const { title, source } = extractMetadata(content);

    // Check for mismatch keywords
    const contentLower = content.toLowerCase();
    const anomalyKeywords = mismatchSignals.filter(kw =>
      contentLower.includes(kw.toLowerCase())
    );

    const fileSignals: string[] = [];
    if (uniqueWordRatio < 0.05) fileSignals.push(`critical_diversity:${uniqueWordRatio.toFixed(3)}`);
    else if (uniqueWordRatio < 0.10) fileSignals.push(`low_diversity:${uniqueWordRatio.toFixed(3)}`);
    else if (uniqueWordRatio < 0.15) fileSignals.push(`medium_diversity:${uniqueWordRatio.toFixed(3)}`);
    if (anomalyKeywords.length > 0) fileSignals.push(`domain_mismatch:${anomalyKeywords.join(',')}`);

    fileResults.push({
      filename: entry,
      size: fs.statSync(filepath).size,
      wordCount,
      uniqueWordRatio,
      lang,
      title,
      source,
      signals: fileSignals,
      anomalyKeywords,
    });

    allTokens.push(...tokens);
    allContent += content + '\n';
  }

  // Global analysis
  const wordFreq = new Map<string, number>();
  for (const token of allTokens) {
    wordFreq.set(token, (wordFreq.get(token) ?? 0) + 1);
  }
  const topWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50) as Array<[string, number]>;

  const contentLower = allContent.slice(0, MAX_TOTAL_CHARS).toLowerCase();
  const keywordHits = targetKeywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
  const globalKeywordHitRate = (keywordHits / targetKeywords.length) * 100;

  // Duplicate detection
  // Sample first 50K chars from each file to avoid stack overflow
  const sampledContent: Record<string, string> = {};
  for (const fr of fileResults) {
    const filepath = path.join(textsDir, fr.filename);
    sampledContent[fr.filename] = fs.readFileSync(filepath, 'utf-8').slice(0, 50000);
  }

  for (let i = 0; i < fileResults.length; i++) {
    for (let j = i + 1; j < fileResults.length; j++) {
      const similarity = computeSimilarity(sampledContent[fileResults[i].filename], sampledContent[fileResults[j].filename]);
      if (similarity > 0.6) {
        signals.push({
          type: 'duplicate_content',
          severity: similarity > 0.8 ? 'high' : 'medium',
          affectedFiles: [fileResults[i].filename, fileResults[j].filename],
          description: `${fileResults[i].filename} 与 ${fileResults[j].filename} 内容相似度 ${(similarity * 100).toFixed(0)}%`,
          metric: 'ngram_jaccard',
          value: `${(similarity * 100).toFixed(0)}%`,
          threshold: '60%',
        });
      }
    }
  }

  // Global diversity check
  const globalUniqueRatio = allTokens.length > 0 ? new Set(allTokens).size / allTokens.length : 0;
  if (globalUniqueRatio < 0.10) {
    signals.push({
      type: 'low_diversity',
      severity: 'critical',
      affectedFiles: entries,
      description: `整体词汇多样性为 ${(globalUniqueRatio * 100).toFixed(1)}%，低于 10% 危险阈值。整个语料库可能存在严重污染。`,
      metric: 'global_unique_word_ratio',
      value: `${(globalUniqueRatio * 100).toFixed(1)}%`,
      threshold: '10%',
    });
  } else if (globalUniqueRatio < 0.15) {
    signals.push({
      type: 'low_diversity',
      severity: 'medium',
      affectedFiles: entries,
      description: `整体词汇多样性为 ${(globalUniqueRatio * 100).toFixed(1)}%，低于 15% 警告阈值。`,
      metric: 'global_unique_word_ratio',
      value: `${(globalUniqueRatio * 100).toFixed(1)}%`,
      threshold: '15%',
    });
  }

  // Keyword hit rate check
  if (globalKeywordHitRate < 5) {
    signals.push({
      type: 'weak_signal',
      severity: 'high',
      affectedFiles: entries,
      description: `语义关键词命中率仅 ${globalKeywordHitRate.toFixed(1)}%，低于 5% 危险阈值。语料可能与 ${domain} 领域不匹配。`,
      metric: 'keyword_hit_rate',
      value: `${globalKeywordHitRate.toFixed(1)}%`,
      threshold: '5%',
    });
  } else if (globalKeywordHitRate < 10) {
    signals.push({
      type: 'weak_signal',
      severity: 'medium',
      affectedFiles: entries,
      description: `语义关键词命中率 ${globalKeywordHitRate.toFixed(1)}%，低于 10% 警告阈值。`,
      metric: 'keyword_hit_rate',
      value: `${globalKeywordHitRate.toFixed(1)}%`,
      threshold: '10%',
    });
  }

  // Per-file contamination signals
  for (const fr of fileResults) {
    if (fr.uniqueWordRatio < 0.05) {
      signals.push({
        type: 'vocabulary_anomaly',
        severity: 'high',
        affectedFiles: [fr.filename],
        description: `${fr.filename}: 词汇多样性 ${(fr.uniqueWordRatio * 100).toFixed(1)}%，严重偏低 (<5%)。可能为重复内容或污染。`,
        metric: 'unique_word_ratio',
        value: `${(fr.uniqueWordRatio * 100).toFixed(1)}%`,
        threshold: '5%',
      });
    }
    if (fr.anomalyKeywords.length > 0) {
      signals.push({
        type: 'domain_mismatch',
        severity: fr.anomalyKeywords.length >= 3 ? 'high' : 'medium',
        affectedFiles: [fr.filename],
        description: `${fr.filename}: 检测到领域不匹配关键词 (${domain} 语料中出现 ${fr.anomalyKeywords.join(', ')})`,
        metric: 'anomaly_keyword_count',
        value: fr.anomalyKeywords.join(', '),
        threshold: '0',
      });
    }
  }

  // Determine overall status
  const criticalCount = signals.filter(s => s.severity === 'critical' || s.severity === 'high').length;
  const overallStatus = criticalCount >= 2 ? 'contaminated' : criticalCount >= 1 ? 'suspicious' : 'clean';

  const recommendations: string[] = [];
  if (overallStatus !== 'clean') {
    const contaminatedFiles = [...new Set(signals.flatMap(s => s.affectedFiles))];
    recommendations.push(`建议删除/替换以下文件: ${contaminatedFiles.join(', ')}`);
  }
  if (globalUniqueRatio < 0.15) {
    recommendations.push('增加该领域的高质量语料源');
  }
  if (globalKeywordHitRate < 10) {
    recommendations.push(`检查语料采集脚本，确保下载的是 ${domain} 领域的文本`);
  }

  return {
    persona: personaId,
    timestamp: new Date().toISOString(),
    overallStatus,
    summary: {
      totalFiles: fileResults.length,
      cleanFiles: fileResults.filter(f => f.signals.length === 0).length,
      suspiciousFiles: fileResults.filter(f => f.signals.some(s => s.includes('medium'))).length,
      contaminatedFiles: fileResults.filter(f => f.signals.some(s => s.includes('critical') || s.includes('high') || s.includes('domain_mismatch'))).length,
    },
    signals,
    fileResults,
    topWords,
    globalKeywordHitRate,
    recommendations,
  };
}

// ─── Report Rendering ─────────────────────────────────────────────────────────

function renderLintReport(result: LintResult): string {
  const today = new Date().toISOString().split('T')[0];

  const statusIcon = {
    clean: '✅',
    suspicious: '⚠️',
    contaminated: '🚨',
  }[result.overallStatus];

  const severityColor = {
    low: 'info',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  };

  const signalTable = result.signals.length > 0
    ? result.signals.map(s => {
      const sev = s.severity === 'critical' ? '🚨 CRITICAL' : s.severity === 'high' ? '❌ HIGH' : s.severity === 'medium' ? '⚠️ MEDIUM' : 'ℹ️ LOW';
      return `| ${sev} | ${s.type} | ${s.affectedFiles.join(', ')} | ${s.description} | ${s.metric}: ${s.value} (阈值: ${s.threshold}) |`;
    }).join('\n')
    : '| — | — | — | 无污染信号 | — |';

  const fileTable = result.fileResults.map(fr => {
    const status = fr.signals.some(s => s.includes('critical') || s.includes('domain_mismatch'))
      ? '🚨'
      : fr.signals.some(s => s.includes('high'))
      ? '❌'
      : fr.signals.some(s => s.includes('medium') || s.includes('low'))
      ? '⚠️'
      : '✅';
    return `| ${status} | \`${fr.filename}\` | ${fr.wordCount.toLocaleString()} | ${(fr.uniqueWordRatio * 100).toFixed(1)}% | ${fr.anomalyKeywords.length > 0 ? fr.anomalyKeywords.join(', ') : '—'} |`;
  }).join('\n');

  const wordTable = result.topWords.slice(0, 20).map(([w, c], i) =>
    `| ${i + 1} | \`${w}\` | ${c} |`
  ).join('\n');

  return `# 污染检测报告 — ${result.persona}

> 检测时间: ${today}
> 整体状态: **${statusIcon} ${result.overallStatus.toUpperCase()}**

## 摘要

| 指标 | 值 |
|------|-----|
| 总文件数 | ${result.summary.totalFiles} |
| 清洁文件 | ${result.summary.cleanFiles} ✅ |
| 可疑文件 | ${result.summary.suspiciousFiles} ⚠️ |
| 污染文件 | ${result.summary.contaminatedFiles} 🚨 |
| 全局词汇多样性 | ${result.globalKeywordHitRate > 0 ? '—' : '—'} |
| 语义关键词命中率 | ${result.globalKeywordHitRate.toFixed(1)}% |

## 污染信号 (${result.signals.length} 条)

| 严重程度 | 类型 | 受影响文件 | 描述 | 指标 |
|----------|------|-----------|------|------|
${signalTable}

## 文件详情

| 状态 | 文件名 | 字数 | 词汇多样性 | 异常关键词 |
|------|--------|------|----------|-----------|
${fileTable}

## 全局高频词 (Top 20)

| 排名 | 词汇 | 频次 |
|------|------|------|
${wordTable}

## 建议

${result.recommendations.length > 0
  ? result.recommendations.map(r => `- ${r}`).join('\n')
  : '无建议。'
}

---

*自动生成 | wiki-lint.ts | ${today}*
`;
}

function updateContaminationLog(result: LintResult): string {
  const logPath = path.join(CORPUS_DIR, result.persona, WIKI_SUBDIR, 'contamination-log.md');

  let existingContent = '';
  if (fs.existsSync(logPath)) {
    existingContent = fs.readFileSync(logPath, 'utf-8');
  }

  const today = new Date().toISOString().split('T')[0];
  const statusIcon = result.overallStatus === 'clean' ? '✅' : result.overallStatus === 'suspicious' ? '⚠️' : '🚨';

  // Build the new log entry
  const newEntry = `## ${today} — Lint 检测

- **状态**: ${statusIcon} ${result.overallStatus}
- **检测文件**: ${result.summary.totalFiles} 个
- **污染信号**: ${result.signals.length} 条
  ${result.signals.map(s => `  - ${s.severity.toUpperCase()}: ${s.type} — ${s.affectedFiles.join(', ')}`).join('\n  ')}
${result.recommendations.length > 0 ? `- **建议**: ${result.recommendations.join('; ')}` : ''}`;

  // Insert before the "## 当前污染信号" section
  const currentSignalMatch = existingContent.match(/## 当前污染信号/);
  if (currentSignalMatch) {
    const insertPos = currentSignalMatch.index!;
    const before = existingContent.slice(0, insertPos);
    const after = existingContent.slice(insertPos);
    return before + newEntry + '\n\n' + after;
  }

  // Fallback: append at the end
  return existingContent + '\n\n' + newEntry;
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  persona: args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null,
  all: args.includes('--all'),
  write: args.includes('--write'),
  verbose: args.includes('--verbose'),
};

function listPersonas(): string[] {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  return fs.readdirSync(CORPUS_DIR)
    .filter(name => findTextsDir(name) !== null)
    .sort();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Corpus Wiki Lint ===\n');

  let personas: string[];
  if (flags.all) {
    personas = listPersonas();
    console.log(`Scanning all ${personas.length} personas...\n`);
  } else if (flags.persona) {
    personas = [flags.persona];
  } else {
    console.error('Error: --persona <id> or --all required');
    console.log('\nUsage:');
    console.log('  bun run scripts/corpus/wiki-lint.ts --persona wittgenstein');
    console.log('  bun run scripts/corpus/wiki-lint.ts --persona wittgenstein --write');
    console.log('  bun run scripts/corpus/wiki-lint.ts --all');
    process.exit(1);
  }

  const results: LintResult[] = [];

  for (const personaId of personas) {
    try {
      const result = lintCorpus(personaId);
      results.push(result);

      const statusIcon = { clean: '✅', suspicious: '⚠️', contaminated: '🚨' }[result.overallStatus];
      const signalCount = result.signals.length;

      if (flags.verbose) {
        console.log(`\n${statusIcon} ${personaId} — ${result.summary.totalFiles} files`);
        console.log(`   Diversity: ${result.globalKeywordHitRate > 0 ? '—' : '—'} | Signals: ${signalCount}`);
        for (const s of result.signals) {
          console.log(`   ${s.severity}: ${s.type} — ${s.affectedFiles.slice(0, 2).join(', ')}`);
        }
        for (const r of result.recommendations) {
          console.log(`   → ${r}`);
        }
      } else {
        const signalSummary = signalCount > 0 ? ` (${signalCount} signal${signalCount > 1 ? 's' : ''})` : '';
        console.log(`${statusIcon} ${personaId}: ${result.summary.totalFiles} files, ${result.summary.cleanFiles} clean${signalSummary}`);
      }

      if (flags.write) {
        const wikiDir = path.join(CORPUS_DIR, personaId, WIKI_SUBDIR);
        if (!fs.existsSync(wikiDir)) fs.mkdirSync(wikiDir, { recursive: true });

        // Update contamination log
        const updatedLog = updateContaminationLog(result);
        fs.writeFileSync(path.join(wikiDir, 'contamination-log.md'), updatedLog, 'utf-8');

        // Write lint report
        fs.writeFileSync(path.join(wikiDir, 'lint-report-latest.md'), renderLintReport(result), 'utf-8');
      }
    } catch (e: any) {
      console.log(`⚠ ${personaId}: ${e.message}`);
    }
  }

  // Summary
  if (personas.length > 1) {
    console.log('\n=== Summary ===');
    const clean = results.filter(r => r.overallStatus === 'clean').length;
    const suspicious = results.filter(r => r.overallStatus === 'suspicious').length;
    const contaminated = results.filter(r => r.overallStatus === 'contaminated').length;
    console.log(`✅ Clean: ${clean} | ⚠️ Suspicious: ${suspicious} | 🚨 Contaminated: ${contaminated}`);

    if (contaminated > 0) {
      console.log('\n🚨 需要关注的 persona:');
      for (const r of results.filter(r => r.overallStatus === 'contaminated')) {
        console.log(`  - ${r.persona}: ${r.signals.map(s => `${s.type}(${s.severity})`).join(', ')}`);
      }
    }
  }

  if (flags.write) {
    console.log('\n✅ contamination-log.md and lint-report-latest.md updated');
  }
}

main().catch(console.error);
