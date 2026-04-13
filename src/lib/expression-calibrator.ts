/**
 * Prismatic — Expression DNA Calibrator
 * 从语料库中自动提取表达DNA特征
 *
 * 三个核心分析维度：
 * 1. Vocabulary Fingerprint — 词汇指纹
 * 2. Syntactic Patterns — 句法模式
 * 3. Tone Trajectory — 语调轨迹
 */

import type {
  ExpressionDNA,
  ExpressionDNAProfile,
  VocabularyFingerprint,
  SyntacticPattern,
  ToneTrajectory,
} from './types';

// ─── Stopwords ────────────────────────────────────────────────────────────────

const ZH_STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
  '为什么', '如果', '因为', '所以', '但是', '虽然', '而且', '或者', '还是',
  '可以', '能够', '应该', '必须', '需要', '可能', '已经', '正在', '将',
  '非常', '特别', '比较', '更加', '最', '太', '更', '还', '又', '再', '才',
]);

const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
  'as', 'until', 'while', 'about', 'against', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
  'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who',
  'whom', 'when', 'where', 'why', 'how',
]);

// ─── Tokenization ────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function tokenizeByLang(text: string): string[] {
  if (isChinese(text)) {
    // Chinese: split by characters but filter stopwords
    const chars = text.split('').filter(c => /[\u4e00-\u9fff]/.test(c));
    return chars;
  }
  return tokenize(text);
}

// ─── N-gram Extraction ───────────────────────────────────────────────────────

function extractNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join('_');
    ngrams.set(ngram, (ngrams.get(ngram) ?? 0) + 1);
  }
  return ngrams;
}

// ─── Vocabulary Fingerprint ──────────────────────────────────────────────────

function extractVocabularyFingerprint(
  corpus: string,
  topN: number = 50
): VocabularyFingerprint {
  const tokens = tokenizeByLang(corpus);
  const stopwords = isChinese(corpus) ? ZH_STOPWORDS : EN_STOPWORDS;

  // Filter stopwords and count
  const wordFreq = new Map<string, number>();
  for (const token of tokens) {
    if (!stopwords.has(token) && token.length > 1) {
      wordFreq.set(token, (wordFreq.get(token) ?? 0) + 1);
    }
  }

  // Top words
  const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);
  const topWords = sorted.slice(0, topN).map(([w]) => w);

  // Bigrams and trigrams
  const cleanTokens = tokens.filter(t => !stopwords.has(t) && t.length > 1);
  const bigramsMap = extractNgrams(cleanTokens, 2);
  const trigramsMap = extractNgrams(cleanTokens, 3);

  const sortByFreq = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]);

  const bigrams = sortByFreq(bigramsMap).slice(0, 30).map(([n]) => n);
  const trigrams = sortByFreq(trigramsMap).slice(0, 20).map(([n]) => n);

  // Signature phrases (repeated bigrams/trigrams with high frequency)
  const signatureSet = new Set<string>();
  for (const [ngram, freq] of [...bigramsMap.entries(), ...trigramsMap.entries()]) {
    if (freq >= 3) signatureSet.add(ngram.replace(/_/g, ''));
  }
  const signaturePhrases = [...signatureSet].slice(0, 20);

  // Forbidden words (low frequency + high distinctiveness)
  const totalTokens = tokens.length;
  const forbiddenCandidate: string[] = [];
  for (const [word, freq] of wordFreq.entries()) {
    const ratio = freq / totalTokens;
    if (ratio < 0.0001 && freq <= 2) {
      forbiddenCandidate.push(word);
    }
  }

  return {
    topWords,
    bigrams,
    trigrams,
    signaturePhrases,
    forbiddenWords: forbiddenCandidate.slice(0, 10),
  };
}

// ─── Syntactic Patterns ──────────────────────────────────────────────────────

function extractSyntacticPatterns(corpus: string): SyntacticPattern[] {
  const patterns: SyntacticPattern[] = [];

  // Sentence length distribution
  const sentences = corpus.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => s.trim().length);

  if (lengths.length > 0) {
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    patterns.push({
      pattern: 'avg_sentence_length',
      frequency: Math.round(avgLen),
      example: sentences[Math.floor(sentences.length / 2)]?.trim().slice(0, 50) ?? '',
    });
  }

  // Question patterns
  const questions = corpus.match(/[^.!?]*[？?][^.!?]*/g) ?? [];
  if (questions.length > 0) {
    patterns.push({
      pattern: 'question_frequency',
      frequency: questions.length,
      example: questions[0]?.trim().slice(0, 50) ?? '',
    });
  }

  // Exclamation patterns
  const exclamations = corpus.match(/[^.!?]*[！!][^.!?]*/g) ?? [];
  if (exclamations.length > 0) {
    patterns.push({
      pattern: 'exclamation_frequency',
      frequency: exclamations.length,
      example: exclamations[0]?.trim().slice(0, 50) ?? '',
    });
  }

  // Quote patterns
  const quotes = corpus.match(/["""''「」『』【】\[\(].{5,100}["""''「」『』【】\[\)]/g) ?? [];
  if (quotes.length > 0) {
    patterns.push({
      pattern: 'quote_usage',
      frequency: quotes.length,
      example: quotes[0]?.trim().slice(0, 60) ?? '',
    });
  }

  // Personal pronoun patterns
  const pronouns = isChinese(corpus)
    ? corpus.match(/我|我们|我认为|我觉得|我相信/g)?.length ?? 0
    : corpus.match(/\bI\b|\bwe\b|\bI think\b|\bI believe\b/gi)?.length ?? 0;

  patterns.push({
    pattern: isChinese(corpus) ? 'personal_pronoun_chinese' : 'personal_pronoun_english',
    frequency: pronouns,
    example: isChinese(corpus) ? '我' : 'I think',
  });

  // List patterns (enumeration)
  const listPatterns = corpus.match(/第一[、，]?|第二[、，]?|首先[、，]?|其次[、，]?/g)
    ?? corpus.match(/first(ly)?[,\s]|second(ly)?[,\s]|third(ly)?[,\s]/gi) ?? [];
  if (listPatterns.length > 0) {
    patterns.push({
      pattern: 'enumeration_pattern',
      frequency: listPatterns.length,
      example: listPatterns[0] ?? '',
    });
  }

  return patterns;
}

// ─── Tone Trajectory ────────────────────────────────────────────────────────

function extractToneTrajectory(corpus: string): ToneTrajectory {
  const formalMarkers = isChinese(corpus)
    ? ['因此', '然而', '综上所述', '由此可见', '然而', '不过', '此外', '与此同时']
    : ['therefore', 'however', 'moreover', 'furthermore', 'thus', 'hence', 'consequently'];

  const casualMarkers = isChinese(corpus)
    ? ['我觉得', '其实', '比如说', '大概', '可能吧', '你知道']
    : ['you know', 'i guess', 'kind of', 'sort of', 'maybe', 'pretty much'];

  const passionateMarkers = isChinese(corpus)
    ? ['！', '简直', '绝对', '一定', '太', '太棒了', '太糟糕了']
    : ['!', 'absolutely', 'definitely', 'incredibly', 'amazing', 'terrible'];

  const humorousMarkers = isChinese(corpus)
    ? ['哈哈', '开玩笑', '笑死', '有意思', '有趣']
    : ['haha', 'lol', 'funny', 'joke', 'laugh', 'hilarious'];

  const formalCount = formalMarkers.reduce((acc, m) => acc + (corpus.includes(m) ? 1 : 0), 0);
  const casualCount = casualMarkers.reduce((acc, m) => acc + (corpus.includes(m) ? 1 : 0), 0);
  const passionateCount = passionateMarkers.reduce((acc, m) => acc + (corpus.match(new RegExp(m, 'g'))?.length ?? 0), 0);
  const humorousCount = humorousMarkers.reduce((acc, m) => acc + (corpus.match(new RegExp(m, 'gi'))?.length ?? 0), 0);

  // Determine dominant tone
  const tones = [
    { tone: 'formal' as const, count: formalCount },
    { tone: 'casual' as const, count: casualCount },
    { tone: 'passionate' as const, count: passionateCount },
    { tone: 'humorous' as const, count: humorousCount },
  ];
  const dominantTone = tones.sort((a, b) => b.count - a.count)[0].tone;

  // Certainty level
  const highCertainty = isChinese(corpus)
    ? corpus.match(/一定|绝对|毫无疑问|毫无疑问地|毫无疑问/g)?.length ?? 0
    : corpus.match(/\bdefinitely\b|\babsolutely\b|\bcertainly\b|\bno doubt\b/gi)?.length ?? 0;

  const lowCertainty = isChinese(corpus)
    ? corpus.match(/可能|也许|大概|不确定|不清楚/g)?.length ?? 0
    : corpus.match(/\bmaybe\b|\bperhaps\b|\bprobably\b|\bpossibly\b|\bi think\b/gi)?.length ?? 0;

  const certaintyLevel = highCertainty > lowCertainty * 2
    ? ('high' as const)
    : lowCertainty > highCertainty * 2
    ? ('low' as const)
    : ('medium' as const);

  const sentences = corpus.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
  const dominantRatio = tones.find(t => t.tone === dominantTone)?.count ?? 0 /
    Math.max(1, formalCount + casualCount + passionateCount + humorousCount);

  return {
    trajectory: dominantTone === 'formal'
      ? ['formal']
      : dominantTone === 'casual'
      ? ['casual']
      : dominantTone === 'passionate'
      ? ['passionate']
      : ['humorous'],
    dominantTone,
    toneShifts: dominantRatio > 0.7 ? 0 : dominantRatio > 0.4 ? 1 : 2,
    humorFrequency: Math.round((humorousCount / Math.max(1, sentences.length / 100)) * 100) / 100,
    certaintyLevel,
  };
}

// ─── ExpressionDNA Auto-generation ───────────────────────────────────────────

export function autoGenerateExpressionDNA(corpus: string): ExpressionDNAProfile {
  const vocabulary = extractVocabularyFingerprint(corpus);
  const syntacticPatterns = extractSyntacticPatterns(corpus);
  const toneTrajectory = extractToneTrajectory(corpus);

  // Extract rhetorical habits from patterns
  const rhetoricalHabits: string[] = [];
  if (syntacticPatterns.find(p => p.pattern === 'question_frequency' && p.frequency > 5)) {
    rhetoricalHabits.push('善于提问');
  }
  if (syntacticPatterns.find(p => p.pattern === 'quote_usage' && p.frequency > 3)) {
    rhetoricalHabits.push('善用引证');
  }
  if (syntacticPatterns.find(p => p.pattern === 'enumeration_pattern' && p.frequency > 2)) {
    rhetoricalHabits.push('善用列举');
  }
  if (syntacticPatterns.find(p => p.pattern === 'exclamation_frequency' && p.frequency > 3)) {
    rhetoricalHabits.push('语气强烈');
  }

  // Extract quote patterns
  const quotePatterns = vocabulary.bigrams.filter(b =>
    corpus.includes(`"${b.replace(/_/g, '')}"`) ||
    corpus.includes(`"${b.replace(/_/g, '')}`)
  ).map(b => b.replace(/_/g, ''));

  return {
    vocabularyFingerprint: vocabulary,
    syntacticPatterns,
    toneTrajectory,
    rhetoricalHabits,
    quotePatterns,
  };
}

// ─── Comparison ─────────────────────────────────────────────────────────────

export function compareExpressionDNA(
  profile: ExpressionDNAProfile,
  target: ExpressionDNA
): number {
  // Vocabulary overlap
  const profileVocab = new Set(profile.vocabularyFingerprint.topWords);
  const targetVocab = new Set(target.vocabulary);
  const vocabOverlap = [...profileVocab].filter(w => targetVocab.has(w)).length;
  const vocabScore = targetVocab.size > 0
    ? Math.round((vocabOverlap / targetVocab.size) * 50)
    : 25;

  // Sentence style overlap
  const profileStyles = profile.rhetoricalHabits;
  const targetStyles = target.sentenceStyle;
  const styleOverlap = profileStyles.filter(s =>
    targetStyles.some(ts => ts.includes(s) || s.includes(ts))
  ).length;
  const styleScore = targetStyles.length > 0
    ? Math.round((styleOverlap / targetStyles.length) * 30)
    : 15;

  // Tone match
  const toneMap: Record<string, string> = {
    formal: 'high',
    casual: 'low',
    passionate: 'high',
    humorous: 'low',
    detached: 'medium',
  };
  const toneScore = toneMap[profile.toneTrajectory.dominantTone] === target.certaintyLevel ? 20 : 10;

  // Forbidden word avoidance
  const forbiddenOverlap = profile.vocabularyFingerprint.forbiddenWords.filter(w =>
    target.forbiddenWords.includes(w)
  ).length;
  const forbiddenScore = Math.min(10, forbiddenOverlap * 2);

  return Math.min(100, vocabScore + styleScore + toneScore + forbiddenScore);
}

// ─── LLM-assisted DNA Refinement ────────────────────────────────────────────

export function buildDNAExtractionPrompt(corpusSample: string): string {
  return `你是一个语言风格分析专家。请分析以下语料，提取该作者的表达DNA特征。

分析维度：
1. 词汇指纹：最常用的特征词（15-20个）、口头禅、高频短语
2. 句式风格：标志性句式、段落结构、修辞手法
3. 语气特征：正式/随意、确定/不确定、激情/冷静
4. 禁用词：该作者绝对不会使用的词汇或表达
5. 引用习惯：该作者喜欢引用什么（名言、数据、故事）

输出格式（JSON）：
{
  "vocabulary": ["词1", "词2", ...],
  "sentenceStyle": ["风格1", "风格2", ...],
  "tone": "formal/casual/passionate/detached",
  "certaintyLevel": "high/medium/low",
  "forbiddenWords": ["词1", "词2", ...],
  "rhetoricalHabits": ["习惯1", "习惯2", ...],
  "quotePatterns": ["引用习惯1", ...]
}

语料样本（前2000字）：
${corpusSample.slice(0, 2000)}`;
}

// ─── Corpus Quality Assessment ──────────────────────────────────────────────

export interface CorpusQuality {
  score: number;
  wordCount: number;
  uniqueWordRatio: number;
  zhRatio: number;
  enRatio: number;
  avgSentenceLength: number;
  issues: string[];
}

export function assessCorpusQuality(corpus: string): CorpusQuality {
  const issues: string[] = [];
  const wordCount = tokenizeByLang(corpus).length;
  const uniqueWords = new Set(tokenizeByLang(corpus));
  const uniqueWordRatio = uniqueWords.size / Math.max(1, wordCount);

  const sentences = corpus.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((a, s) => a + s.length, 0) / sentences.length
    : 0;

  const zhChars = (corpus.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const enChars = (corpus.match(/[a-zA-Z]/g) ?? []).length;
  const totalChars = corpus.length;
  const zhRatio = zhChars / Math.max(1, totalChars);
  const enRatio = enChars / Math.max(1, totalChars);

  if (wordCount < 1000) issues.push('语料过少（<1000词）');
  if (uniqueWordRatio < 0.1) issues.push('词汇重复率过高');
  if (avgSentenceLength < 5) issues.push('平均句子长度异常（<5字符）');
  if (zhRatio > 0.9 && !isChinese(corpus.slice(0, 100))) {
    issues.push('中文比例异常');
  }

  const score = Math.min(100,
    (wordCount >= 5000 ? 30 : wordCount >= 2000 ? 20 : wordCount >= 1000 ? 10 : 0) +
    (uniqueWordRatio >= 0.2 ? 25 : uniqueWordRatio >= 0.15 ? 15 : 5) +
    (avgSentenceLength >= 10 ? 20 : avgSentenceLength >= 5 ? 15 : 5) +
    (zhRatio > 0 ? 15 : 0) +
    (issues.length === 0 ? 10 : 0)
  );

  return {
    score,
    wordCount,
    uniqueWordRatio: Math.round(uniqueWordRatio * 1000) / 1000,
    zhRatio: Math.round(zhRatio * 100) / 100,
    enRatio: Math.round(enRatio * 100) / 100,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    issues,
  };
}
