#!/usr/bin/env bun
/**
 * corpus/wiki-builder.ts — 批量为所有 Persona 创建 Wiki 骨架
 *
 * 读取 corpus/{persona}/texts/ 目录，生成：
 *   corpus/{persona}/wiki/index.md
 *   corpus/{persona}/wiki/corpus-health.md
 *   corpus/{persona}/wiki/contamination-log.md
 *   corpus/{persona}/wiki/log.md
 *
 * Usage:
 *   bun run scripts/corpus/wiki-builder.ts                    # 全部 persona
 *   bun run scripts/corpus/wiki-builder.ts --persona wittgenstein  # 单个 persona
 *   bun run scripts/corpus/wiki-builder.ts --list            # 列出所有 persona
 *   bun run scripts/corpus/wiki-builder.ts --dry-run         # 不写入，仅预览
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const CORPUS_DIR = path.join(__dirname, '..', '..', 'corpus');

// ─── Text Directory Resolution ───────────────────────────────────────────────
//
// Some persona dirs use `texts/` as the canonical text dir.
// Others (e.g. wittgenstain) use `wittsrg/` instead.
// This helper finds whichever exists.
//
// Priority: texts/ > wittsrg/

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
const WIKI_SUBDIR = 'wiki';

// ─── Semantic Keywords Registry ─────────────────────────────────────────────────

const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  philosophy: ['philosophy', 'philosophical', 'thought', 'thinking', 'reason', 'logic', 'meaning', 'language', 'truth', 'knowledge', 'ethics', 'morality', 'virtue', 'soul', 'mind', 'idea', 'concept', 'proposition', 'rule', 'grammar', 'metaphysics', 'epistemology', 'ontology'],
  business: ['business', 'investment', 'market', 'company', 'capital', 'profit', 'risk', 'strategy', 'management', 'entrepreneur', 'competition', 'economy', 'growth', 'value', 'management', 'shareholder', 'earnings'],
  science: ['experiment', 'theory', 'hypothesis', 'observation', 'physics', 'mathematics', 'biology', 'quantum', 'relativity', 'particle', 'energy', 'matter', 'equation', 'law', 'principle', 'discovery', 'scientific'],
  spirituality: ['spirit', 'soul', 'enlightenment', 'dharma', 'zen', 'meditation', 'buddha', 'tao', 'wu wei', 'emptiness', 'impermanence', 'suffering', 'nirvana', 'wisdom', 'compassion', 'karma', 'rebirth'],
  literature: ['story', 'character', 'narrative', 'plot', 'theme', 'metaphor', 'symbol', 'poetry', 'verse', 'rhetoric', 'tragedy', 'hero', 'journey', 'quest', 'transformation'],
  military: ['war', 'strategy', 'tactics', 'enemy', 'terrain', 'formation', 'command', 'victory', 'defeat', 'army', 'soldier', 'battle', 'conflict', 'attack', 'defense', 'intelligence'],
  history: ['dynasty', 'emperor', 'reign', 'dynastic', 'historian', 'chronicle', 'empire', 'civilization', 'ancient', 'dynasty', 'kingdom', 'conquest', 'rebellion', 'reform'],
};

const DOMAIN_PERSONA_MAP: Record<string, string> = {
  'socrates': 'philosophy',
  'plato': 'philosophy',
  'aristotle': 'philosophy',
  'confucius': 'philosophy',
  'lao-zi': 'spirituality',
  'zhuang-zi': 'philosophy',
  'hui-neng': 'spirituality',
  'epictetus': 'philosophy',
  'seneca': 'philosophy',
  'marcus-aurelius': 'philosophy',
  'wittgenstein': 'philosophy',
  'sima-qian': 'history',
  'qu-yuan': 'literature',
  'sun-tzu': 'military',
  'zhuge-liang': 'military',
  'caesar': 'history',
  'napoleon': 'military',
  'elon-musk': 'business',
  'warren-buffett': 'business',
  'charlie-munger': 'business',
  'jeff-bezos': 'business',
  'peter-thiel': 'business',
  'jack-ma': 'business',
  'nassim-taleb': 'business',
  'paul-graham': 'business',
  'sam-altman': 'business',
  'alan-turing': 'science',
  'nikola-tesla': 'science',
  'einstein': 'science',
  'qian-xuesen': 'science',
  'richard-feynman': 'science',
  'jensen-huang': 'business',
  'sun-wukong': 'literature',
  'journey-west': 'literature',
  'zhu-bajie': 'literature',
  'tripitaka': 'literature',
  'sima-qian': 'history',
  'records-grand-historian': 'history',
  'three-kingdoms': 'literature',
  'liu-bei': 'military',
  'xiang-yu': 'military',
  'cao-cao': 'military',
  'han-fei-zi': 'philosophy',
  'mo-zi': 'philosophy',
  'mencius': 'philosophy',
  'shao-yong': 'philosophy',
  'carl-jung': 'philosophy',
  'john-maynard-keynes': 'business',
  'ray-dalio': 'business',
  'nietzsche': 'philosophy',
  'aleister-crowley': 'spirituality',
  'huangdi-neijing': 'spirituality',
  'socrates': 'philosophy',
  'sun-wukong': 'literature',
  'zhu-bajie': 'literature',
  'tripitaka': 'literature',
  'journey-west': 'literature',
  'three-kingdoms': 'literature',
  'liu-bei': 'military',
  'xiang-yu': 'military',
  'cao-cao': 'military',
};

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface TextFile {
  filename: string;
  filepath: string;
  content: string;
  size: number;
  preview: string;
  title: string;
  source: string;
}

interface CorpusStats {
  personaId: string;
  totalFiles: number;
  totalWords: number;
  totalChars: number;
  avgFileSize: number;
  uniqueWordRatio: number;
  domain: string;
  keywords: string[];
  keywordHitRate: number;
  files: TextFile[];
  topWords: Array<[string, number]>;
  topBigrams: Array<[string, number]>;
}

// ─── Argument Parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  persona: args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null,
  list: args.includes('--list'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
};

// ─── Language Detection (mirrors distillation-l1-intelligence.ts) ─────────────

const CJK_RANGES = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const ZH_STOPWORDS = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '这', '那', '他', '她', '它', '们', '什么', '怎么', '可以', '因为', '所以', '但是', '非常', '最', '与', '而', '之', '于', '以', '其']);

function detectLanguage(text: string): string {
  const cjkCount = (text.match(CJK_RANGES) ?? []).length;
  return cjkCount / text.length > 0.05 ? 'zh' : 'en';
}

function estimateWordCount(text: string, lang: string): number {
  if (lang === 'zh') {
    const chars = (text.match(CJK_RANGES) ?? []).length;
    return Math.round(chars * 0.4);
  }
  return text.split(/\s+/).filter(t => t.length > 0).length;
}

function extractZhWords(text: string): string[] {
  const chars = text.split('').filter(c => CJK_RANGES.test(c));
  const words: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const w = chars[i] + chars[i + 1];
    if (!ZH_STOPWORDS.has(w[0]) && !ZH_STOPWORDS.has(w[1])) {
      words.push(w);
    }
  }
  return words;
}

function tokenizeEN(text: string): string[] {
  const EN_STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'and', 'but', 'or', 'if', 'then', 'so', 'not', 'no', 'all', 'any']);
  return text.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ' ').split(/\s+/).filter(t => t.length > 2 && !EN_STOP.has(t));
}

function extractNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const key = tokens.slice(i, i + n).join('_');
    ngrams.set(key, (ngrams.get(key) ?? 0) + 1);
  }
  return ngrams;
}

// ─── Metadata Extraction ─────────────────────────────────────────────────────

function extractMetadata(filepath: string, content: string): { title: string; source: string } {
  const filename = path.basename(filepath);

  // Try to extract Title: from file content (common in curated texts)
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  const authorMatch = content.match(/^Author:\s*(.+)$/m);

  if (titleMatch) {
    const title = titleMatch[1].trim();
    const author = authorMatch?.[1]?.trim() ?? 'Unknown';
    return { title, source: author };
  }

  // Fallback: use filename as title
  const title = filename
    .replace(/\.txt$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/^wittgenstein[-_]/i, '')
    .replace(/^wittgenstain[-_]/i, '')
    .replace(/^sep[-_]/i, 'SEP: ')
    .replace(/^iep[-_]/i, 'IEP: ');

  return { title, source: 'Unknown' };
}

// ─── Corpus Analysis ───────────────────────────────────────────────────────────

function analyzeCorpus(personaId: string, textsDir: string): CorpusStats {
  if (!fs.existsSync(textsDir)) {
    throw new Error(`Text directory not found: ${textsDir}`);
  }

  const entries = fs.readdirSync(textsDir);
  const files: TextFile[] = [];
  let allTokens: string[] = [];
  let allContent = '';
  let totalChars = 0;

  for (const entry of entries) {
    const filepath = path.join(textsDir, entry);
    const stat = fs.statSync(filepath);
    if (!stat.isFile() || !entry.endsWith('.txt')) continue;

    const content = fs.readFileSync(filepath, 'utf-8');
    const lang = detectLanguage(content);
    const wordCount = estimateWordCount(content, lang);
    const preview = content.slice(0, 200).replace(/\n+/g, ' ').trim();
    const { title, source } = extractMetadata(filepath, content);

    files.push({ filename: entry, filepath, content, size: stat.size, preview, title, source });
    allContent += content + '\n';
    totalChars += content.length;

    if (lang === 'zh') {
      allTokens.push(...extractZhWords(content));
    } else {
      allTokens.push(...tokenizeEN(content));
    }
  }

  // Word frequency
  const wordFreq = new Map<string, number>();
  for (const token of allTokens) {
    wordFreq.set(token, (wordFreq.get(token) ?? 0) + 1);
  }

  const sortedWords = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);
  const topWords = sortedWords.slice(0, 30) as Array<[string, number]>;

  // Bigrams
  const bigrams = extractNgrams(allTokens, 2);
  const topBigrams = [...bigrams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) as Array<[string, number]>;

  const uniqueWords = new Set(allTokens);
  const uniqueWordRatio = allTokens.length > 0 ? uniqueWords.size / allTokens.length : 0;

  // Domain detection
  const domain = DOMAIN_PERSONA_MAP[personaId] ?? 'philosophy';
  const keywords = SEMANTIC_KEYWORDS[domain] ?? SEMANTIC_KEYWORDS.philosophy;

  // Keyword hit rate
  const contentLower = allContent.toLowerCase();
  const keywordHits = keywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
  const keywordHitRate = (keywordHits / keywords.length) * 100;

  return {
    personaId,
    totalFiles: files.length,
    totalWords: allTokens.length,
    totalChars,
    avgFileSize: files.length > 0 ? totalChars / files.length : 0,
    uniqueWordRatio,
    domain,
    keywords,
    keywordHitRate,
    files,
    topWords,
    topBigrams,
  };
}

// ─── Template Rendering ────────────────────────────────────────────────────────

function renderIndexMd(stats: CorpusStats): string {
  const today = new Date().toISOString().split('T')[0];
  const healthStatus = (ratio: number) => {
    if (ratio >= 0.15) return '✅ 正常';
    if (ratio >= 0.10) return '⚠️ 偏低';
    return '❌ 过低';
  };

  const filesTable = stats.files.map(f => {
    const lang = detectLanguage(f.content);
    const wc = estimateWordCount(f.content, lang);
    const sizeStr = f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}MB` : `${(f.size / 1024).toFixed(0)}KB`;
    return `| \`${f.filename}\` | ${f.source} | ${sizeStr} | ${wc.toLocaleString()} 字 | ${healthStatus(stats.uniqueWordRatio)} |`;
  }).join('\n');

  return `# ${stats.personaId.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')} — 语料 Wiki

> 自动生成于 ${today} | 领域: ${stats.domain}

## 基本信息

- **Persona ID**: \`${stats.personaId}\`
- **领域**: ${stats.domain}
- **语料规模**: ${stats.totalFiles} 个文件，${stats.totalWords.toLocaleString()} 词
- **字符数**: ${stats.totalChars.toLocaleString()}
- **平均文件大小**: ${(stats.avgFileSize / 1024).toFixed(0)}KB
- **词汇多样性**: ${(stats.uniqueWordRatio * 100).toFixed(1)}% (目标 >15%)
- **语义关键词命中率**: ${stats.keywordHitRate.toFixed(1)}%
- **最后更新**: ${today}

## 语料清单

| 文件名 | 来源 | 大小 | 字数 | 健康状态 |
|--------|------|------|------|----------|
${filesTable || '| — | — | — | — |'}

## 健康指标

| 指标 | 当前值 | 阈值 | 状态 |
|------|--------|------|------|
| 词汇多样性 | ${(stats.uniqueWordRatio * 100).toFixed(1)}% | >15% | ${stats.uniqueWordRatio >= 0.15 ? '✅ 正常' : stats.uniqueWordRatio >= 0.10 ? '⚠️ 偏低' : '❌ 过低'} |
| 语义关键词命中率 | ${stats.keywordHitRate.toFixed(1)}% | >10% | ${stats.keywordHitRate >= 10 ? '✅ 正常' : stats.keywordHitRate >= 5 ? '⚠️ 偏低' : '❌ 过低'} |
| 文件数 | ${stats.totalFiles} | — | ${stats.totalFiles >= 3 ? '✅' : '⚠️ 偏少'} |

## 语义关键词配置

\`\`\`yaml
domain: ${stats.domain}
keywords:
${stats.keywords.slice(0, 15).map(k => `  - ${k}`).join('\n')}
warning_threshold: 0.05
\`\`\`

## 变更历史

> 参见 log.md

---

*Wiki Schema: corpus-wiki-schema.md*
`;
}

function renderCorpusHealthMd(stats: CorpusStats): string {
  const today = new Date().toISOString().split('T')[0];

  const wordTable = stats.topWords.map(([w, c], i) =>
    `| ${i + 1} | \`${w}\` | ${c} | ${(c / stats.totalWords * 100).toFixed(2)}% |`
  ).join('\n');

  const bigramTable = stats.topBigrams.map(([b, c], i) =>
    `| ${i + 1} | \`${b.replace(/_/g, ' ')}\` | ${c} |`
  ).join('\n');

  return `# 语料健康报告 — ${stats.personaId}

> 生成时间: ${today}

## 词频统计 (Top 30)

| 排名 | 词汇 | 频次 | 占比 |
|------|------|------|------|
${wordTable || '| — | — | — |'}

## 二元组 (Top 20)

| 排名 | 二元组 | 频次 |
|------|--------|------|
${bigramTable || '| — | — | — |'}

## 语义关键词命中率

目标领域: **${stats.domain}**

| 关键词 | 命中率 |
|--------|--------|
${stats.keywords.map(kw => {
  const content = stats.files.map(f => f.content).join('\n').toLowerCase();
  const hits = (content.match(new RegExp(kw.toLowerCase(), 'g')) ?? []).length;
  const rate = stats.totalWords > 0 ? (hits / stats.totalWords * 100) : 0;
  return `| ${kw} | ${rate >= 0.1 ? '✅' : rate >= 0.01 ? '⚠️' : '❌'} ${rate.toFixed(3)}% |`;
}).join('\n')}

## 异常检测摘要

- **词汇多样性**: ${(stats.uniqueWordRatio * 100).toFixed(1)}% ${stats.uniqueWordRatio >= 0.15 ? '✅ 正常' : '⚠️ 低于阈值 15%'}
- **语义关键词命中率**: ${stats.keywordHitRate.toFixed(1)}% ${stats.keywordHitRate >= 10 ? '✅ 正常' : '⚠️ 低于阈值 10%'}
- **文件规模**: ${stats.totalFiles} 个文件，${(stats.totalChars / 1024 / 1024).toFixed(1)}MB

---

*自动生成 | 词频提取基于 corpus texts 目录*
`;
}

function renderContaminationLogMd(stats: CorpusStats): string {
  const today = new Date().toISOString().split('T')[0];

  return `# 污染检测日志 — ${stats.personaId}

> 创建时间: ${today}

## 检测历史

暂无检测记录。首次运行 wiki-builder 时生成此文件。

## 当前污染信号

${stats.uniqueWordRatio < 0.10
  ? `⚠️ **警告**: 词汇多样性为 ${(stats.uniqueWordRatio * 100).toFixed(1)}%，低于 10% 阈值。建议运行 lint 检查。`
  : stats.uniqueWordRatio < 0.15
  ? `⚠️ **注意**: 词汇多样性为 ${(stats.uniqueWordRatio * 100).toFixed(1)}%，低于推荐阈值 15%。`
  : '✅ 无活跃污染信号。'
}

## 污染阈值参考

| 指标 | 警告 | 危险 |
|------|------|------|
| 词汇多样性 (uniqueWordRatio) | <15% | <10% |
| 语义关键词命中率 | <10% | <5% |
| 文件内容匹配度 (同一领域) | — | <30% |

---

*自动生成 | 请在每次 lint 后更新此文件*
`;
}

function renderLogMd(stats: CorpusStats): string {
  const today = new Date().toISOString().split('T')[0];

  const fileEntries = stats.files.map(f => {
    const lang = detectLanguage(f.content);
    const wc = estimateWordCount(f.content, lang);
    return `## [${today}] ingest | corpus/${stats.personaId}/texts/${f.filename}\n- 来源: ${f.source}\n- 类型: 自动检测\n- 字数: ${wc.toLocaleString()}\n- 操作: 首次摄入`;
  }).join('\n\n');

  return `# 语料摄入日志 — ${stats.personaId}

> 格式: \`## [YYYY-MM-DD] {action} | {detail}\`

${fileEntries}

---

*自动生成 | 每次 wiki 更新时追加新条目*
`;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

function listPersonas(): string[] {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  return fs.readdirSync(CORPUS_DIR)
    .filter(name => findTextsDir(name) !== null)
    .sort();
}

async function buildWikiForPersona(personaId: string, dryRun: boolean): Promise<void> {
  const textsDir = findTextsDir(personaId);
  if (!textsDir) {
    console.log(`⚠ ${personaId}: no texts directory found (tried texts/, wittsrg/)`);
    return;
  }
  const wikiDir = path.join(CORPUS_DIR, personaId, WIKI_SUBDIR);

  if (flags.verbose) {
    console.log(`\n[${personaId}] Analyzing corpus (source: ${path.basename(textsDir)})...`);
  }

  let stats: CorpusStats;
  try {
    stats = analyzeCorpus(personaId, textsDir);
  } catch (e: any) {
    console.log(`⚠ ${personaId}: ${e.message}`);
    return;
  }

  const wikiFiles = {
    'index.md': renderIndexMd(stats),
    'corpus-health.md': renderCorpusHealthMd(stats),
    'contamination-log.md': renderContaminationLogMd(stats),
    'log.md': renderLogMd(stats),
  };

  if (dryRun) {
    console.log(`\n=== ${personaId} (DRY RUN) ===`);
    console.log(`  Files: ${stats.totalFiles}, Words: ${stats.totalWords.toLocaleString()}`);
    console.log(`  uniqueWordRatio: ${(stats.uniqueWordRatio * 100).toFixed(1)}%`);
    console.log(`  keywordHitRate: ${stats.keywordHitRate.toFixed(1)}%`);
    for (const [name] of Object.entries(wikiFiles)) {
      console.log(`  + wiki/${name}`);
    }
    return;
  }

  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
  }

  for (const [filename, content] of Object.entries(wikiFiles)) {
    const filepath = path.join(wikiDir, filename);
    fs.writeFileSync(filepath, content, 'utf-8');
  }

  if (flags.verbose) {
    console.log(`  ✅ ${stats.totalFiles} files → ${stats.totalWords.toLocaleString()} words`);
    console.log(`     uniqueWordRatio: ${(stats.uniqueWordRatio * 100).toFixed(1)}% | keywordHitRate: ${stats.keywordHitRate.toFixed(1)}%`);
    console.log(`     wiki/${Object.keys(wikiFiles).join(', wiki/')}`);
  } else {
    console.log(`✅ ${personaId}: ${stats.totalFiles} files, ${(stats.uniqueWordRatio * 100).toFixed(1)}% diversity, ${stats.keywordHitRate.toFixed(1)}% keyword hit`);
  }
}

async function main() {
  console.log('=== Corpus Wiki Builder ===\n');

  if (flags.list) {
    const personas = listPersonas();
    console.log(`Found ${personas.length} personas with texts/ directories:\n`);
    for (const p of personas) {
      const td = findTextsDir(p);
      const files = td ? fs.readdirSync(td).filter(f => f.endsWith('.txt')).length : 0;
      const src = td ? ` (${path.basename(td)})` : '';
      console.log(`  ${files.toString().padStart(2)} files  ${p}${src}`);
    }
    return;
  }

  if (flags.dryRun) {
    console.log('DRY RUN — no files will be written\n');
  }

  let personas: string[];
  if (flags.persona) {
    personas = [flags.persona];
  } else {
    personas = listPersonas();
  }

  console.log(`Building wiki for ${personas.length} persona(s)...\n`);

  for (const personaId of personas) {
    await buildWikiForPersona(personaId, flags.dryRun);
  }

  if (!flags.dryRun) {
    console.log(`\nDone. Wiki files created in corpus/{persona}/wiki/`);
    console.log(`Schema reference: corpus-wiki-schema.md`);
  }
}

main().catch(console.error);
