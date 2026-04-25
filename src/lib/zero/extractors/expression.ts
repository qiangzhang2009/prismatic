/**
 * Zero 蒸馏引擎 — ExpressionDNA 双轨提取
 *
 * 改进：统计轨 + LLM 轨并行，用 LLM 精修统计结果
 * 解决 v4 L4：词频只靠 bigram、不区分语气、轻信 LLM 输出等问题
 */

import {
  ExpressionDNA, VocabularyFingerprint, SentenceStyle, ToneProfile,
  CertaintyProfile, RhetoricalHabit, QuotePattern, RhythmProfile,
  VerbalMarker, SpeakingStyle, ForbiddenWord, SupportedLanguage
} from '../types';
import { LLMMessage } from '../../llm';
import { callLLMWithJSON } from '../utils/llm';
import { ZeroLogger } from '../utils/logger';
import { LLMSession } from '../utils/llm';

// =============================================================================
// Statistic Track (pure statistical extraction)
// =============================================================================

interface StatsExtraction {
  vocabulary: VocabularyFingerprint;
  sentenceStyles: SentenceStyle[];
  tone: ToneProfile;
  certainty: CertaintyProfile;
  rhetoricalHabits: RhetoricalHabit[];
  quotePatterns: QuotePattern[];
  rhythm: RhythmProfile;
  verbalMarkers: VerbalMarker[];
}

/**
 * 统计轨：从语料中提取表达特征（不调用 LLM）
 */
export function extractExpressionStats(
  text: string,
  language: SupportedLanguage
): StatsExtraction {
  const words = tokenize(text, language);
  const wordFreq = buildWordFreq(words, language);
  const ngrams = buildNgrams(words, language);
  const sentences = splitSentences(text, language);
  const paragraphs = splitParagraphs(text);

  const topWords = extractTopWords(wordFreq, 50, language);
  const bigrams = extractTopNgrams(ngrams.bigrams, 30);
  const trigrams = extractTopNgrams(ngrams.trigrams, 20);
  const signatures = extractSignaturePhrases(text, bigrams, trigrams, language);
  const forbidden = inferForbiddenWords(wordFreq, language);
  const sentenceStyles = detectSentenceStyles(text, sentences, language);
  const tone = detectTone(text, language);
  const certainty = detectCertainty(text, language);
  const quotes = detectQuotePatterns(text, language);
  const verbalMarkers = detectVerbalMarkers(text, language);
  const rhythm = computeRhythm(sentences, paragraphs, text);

  return {
    vocabulary: {
      topWords,
      bigrams,
      trigrams,
      signaturePhrases: signatures,
      domainTerms: extractDomainTerms(topWords, language),
      confidence: 0.7,
    },
    sentenceStyles,
    tone,
    certainty,
    rhetoricalHabits: detectRhetoricalHabits(text, sentences, quotes, language),
    quotePatterns: quotes,
    rhythm,
    verbalMarkers,
  };
}

function tokenize(text: string, lang: SupportedLanguage): string[] {
  if (lang === 'zh' || (text.match(/[\u4e00-\u9fff]/g) ?? []).length > text.length * 0.1) {
    // Chinese: split into 2-4 char tokens
    const tokens: string[] = [];
    for (let i = 0; i < text.length - 1; i++) {
      const two = text[i] + text[i + 1];
      if (/[\u4e00-\u9fff]/.test(two)) {
        tokens.push(two);
        if (i + 2 < text.length && /[\u4e00-\u9fff]/.test(text[i + 2])) {
          const three = two + text[i + 2];
          if (/[\u4e00-\u9fff]/.test(three)) {
            tokens.push(three);
          }
        }
      }
    }
    return tokens;
  }
  // English/Western: split by whitespace, lowercase, filter
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.length < 30);
}

function buildWordFreq(tokens: string[], lang: SupportedLanguage): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

function buildNgrams(tokens: string[], lang: SupportedLanguage): { bigrams: Map<string, number>; trigrams: Map<string, number> } {
  const bigrams = new Map<string, number>();
  const trigrams = new Map<string, number>();

  for (let i = 0; i < tokens.length - 1; i++) {
    const bi = tokens[i] + '_' + tokens[i + 1];
    bigrams.set(bi, (bigrams.get(bi) ?? 0) + 1);
  }

  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = tokens[i] + '_' + tokens[i + 1] + '_' + tokens[i + 2];
    trigrams.set(tri, (trigrams.get(tri) ?? 0) + 1);
  }

  return { bigrams, trigrams };
}

function splitSentences(text: string, lang: SupportedLanguage): string[] {
  if (lang === 'zh') {
    return text.split(/[。！？；]/).map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
}

function extractTopWords(freq: Map<string, number>, topN: number, lang: SupportedLanguage): VocabularyFingerprint['topWords'] {
  const stopwords = lang === 'zh'
    ? new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么', '可以', '但', '因为', '所以', '如果', '虽然', '还是'])
    : new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'or', 'and', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'then']);

  const total = Array.from(freq.values()).reduce((a, b) => a + b, 0);
  const maxFreq = Math.max(...Array.from(freq.values()));

  return Array.from(freq.entries())
    .filter(([w]) => !stopwords.has(w) && w.length >= (lang === 'zh' ? 2 : 3))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, frequency]) => ({
      word,
      frequency,
      normalizedFreq: maxFreq > 0 ? Math.round((frequency / maxFreq) * 100) / 100 : 0,
      isDomainSpecific: frequency / total > 0.001,
      isSignature: false,
    }));
}

function extractTopNgrams(ngramMap: Map<string, number>, topN: number): VocabularyFingerprint['bigrams'] {
  const vals = Array.from(ngramMap.values());
  const maxFreq = vals.length > 0 ? Math.max(...vals, 1) : 1;
  return Array.from(ngramMap.entries())
    .filter(([, freq]) => freq >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([ngram, frequency]) => ({
      ngram: ngram.replace(/_/g, ''),
      frequency,
      normalizedFreq: Math.round((frequency / maxFreq) * 100) / 100,
      isSignature: frequency >= 5,
    }));
}

function extractSignaturePhrases(
  text: string,
  bigrams: VocabularyFingerprint['bigrams'],
  trigrams: VocabularyFingerprint['trigrams'],
  lang: SupportedLanguage
): VocabularyFingerprint['signaturePhrases'] {
  const phraseMap = new Map<string, number>();
  const patterns = [...bigrams, ...trigrams].filter((n) => n.isSignature);

  for (const p of patterns) {
    phraseMap.set(p.ngram, (phraseMap.get(p.ngram) ?? 0) + p.frequency);
  }

  return Array.from(phraseMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase, frequency]) => ({
      phrase,
      frequency,
      context: 'repeated_usage',
    }));
}

function inferForbiddenWords(freq: Map<string, number>, lang: SupportedLanguage): ForbiddenWord[] {
  const vals = Array.from(freq.values());
  const total = vals.reduce((a, b) => a + b, 0);
  const entries = Array.from(freq.entries())
    .filter(([, f]) => f <= 2 && f / total < 0.0002)
    .slice(0, 10);

  return entries.map(([word]) => ({
    word,
    reason: `该词在语料中出现频率极低（${freq.get(word) ?? 0}次），可能与此人物的表达风格不符`,
  }));
}

function detectSentenceStyles(text: string, sentences: string[], lang: SupportedLanguage): SentenceStyle[] {
  const styles: SentenceStyle[] = [];

  // Question frequency
  const questionCount = (text.match(/[？？?]/g) ?? []).length;
  if (questionCount > 3) {
    styles.push({
      pattern: 'frequent_questions',
      description: '善于提问，引导思考',
      frequency: questionCount,
      examples: (text.match(/[？？?][^？？?]{10,50}/g) ?? []).slice(0, 3),
      confidence: 0.8,
    });
  }

  // Exclamation frequency
  const exclamCount = (text.match(/[！！!]/g) ?? []).length;
  if (exclamCount > 2) {
    styles.push({
      pattern: 'exclamatory',
      description: '语气强烈，表达果断',
      frequency: exclamCount,
      examples: (text.match(/[！！!][^！！!]{5,30}/g) ?? []).slice(0, 3),
      confidence: 0.7,
    });
  }

  // Enumeration patterns
  const enumPatterns = lang === 'zh'
    ? (text.match(/第一[、，]?|第二[、，]?|第三[、，]?|首先[、，]?|其次[、，]?|最后[、，]?/g) ?? [])
    : (text.match(/first(ly)?[,\s]|second(ly)?[,\s]|third(ly)?[,\s]|finally[,\s]|lastly[,\s]/gi) ?? []);
  if (enumPatterns.length > 2) {
    styles.push({
      pattern: 'enumeration',
      description: '善用列举，条理清晰',
      frequency: enumPatterns.length,
      examples: enumPatterns.slice(0, 3),
      confidence: 0.7,
    });
  }

  // Long/short sentence contrast
  const avgLen = sentences.length > 0
    ? sentences.reduce((s, sen) => s + sen.length, 0) / sentences.length
    : 0;
  if (avgLen > 50) {
    styles.push({
      pattern: 'long_sentences',
      description: '擅长使用复杂长句，论证严密',
      frequency: Math.round(sentences.filter((s) => s.length > 50).length / Math.max(sentences.length, 1) * 100),
      examples: sentences.filter((s) => s.length > 80).slice(0, 3),
      confidence: 0.6,
    });
  }

  return styles;
}

function detectTone(text: string, lang: SupportedLanguage): ToneProfile {
  const formalMarkers = lang === 'zh'
    ? ['因此', '然而', '综上所述', '由此可见', '此外', '与此同时', '综上所述', '必须指出', '应当', '理应']
    : ['therefore', 'however', 'moreover', 'furthermore', 'thus', 'consequently', 'hence', 'nevertheless', 'whereas'];

  const casualMarkers = lang === 'zh'
    ? ['我觉得', '其实', '比如说', '大概', '可能吧', '你知道', '说实话', '坦白说', '一般来说', '通常来说']
    : ['you know', 'i guess', 'kind of', 'sort of', 'maybe', 'probably', 'i think', 'i believe', 'in general', 'usually'];

  const passionateMarkers = lang === 'zh'
    ? ['！', '简直', '绝对', '一定', '太棒了', '太糟糕了', '毫无疑问', '毫无悬念']
    : ['!', 'absolutely', 'definitely', 'incredibly', 'remarkable', 'extraordinary'];

  const countMarkers = (markers: string[]) =>
    markers.reduce((sum, m) => sum + (text.match(new RegExp(m, 'gi')) ?? []).length, 0);

  const formal = countMarkers(formalMarkers);
  const casual = countMarkers(casualMarkers);
  const passionate = countMarkers(passionateMarkers);

  let dominant: ToneProfile['dominant'] = 'formal';
  let maxCount = formal;
  if (casual > maxCount) { dominant = 'casual'; maxCount = casual; }
  if (passionate > maxCount) { dominant = 'passionate'; maxCount = passionate; }

  const totalMarkers = formal + casual + passionate;
  const shifts = Math.min(Math.abs(formal - casual) / Math.max(totalMarkers, 1), 2);

  return {
    dominant,
    shifts: Math.round(shifts),
    description: `语料呈现${dominant === 'formal' ? '正式' : dominant === 'casual' ? '随意' : '激情'}的语调特征`,
    markers: [],
  };
}

function detectCertainty(text: string, lang: SupportedLanguage): CertaintyProfile {
  const highMarkers = lang === 'zh'
    ? ['一定', '绝对', '毫无疑问', '必然', '必定', '肯定', '无疑', '确信', '明确']
    : ['definitely', 'certainly', 'absolutely', 'no doubt', 'clearly', 'obviously', 'undoubtedly', 'surely'];

  const lowMarkers = lang === 'zh'
    ? ['可能', '也许', '大概', '似乎', '仿佛', '也许', '或许', '不一定', '不确定', '不清楚']
    : ['maybe', 'perhaps', 'probably', 'possibly', 'i think', 'seems', 'might', 'could be', 'not sure', 'uncertain'];

  const highCount = highMarkers.reduce((s, m) => s + (text.match(new RegExp(m, 'gi')) ?? []).length, 0);
  const lowCount = lowMarkers.reduce((s, m) => s + (text.match(new RegExp(m, 'gi')) ?? []).length, 0);

  let level: CertaintyProfile['level'] = 'medium';
  if (highCount > lowCount * 2) level = 'high';
  else if (lowCount > highCount * 2) level = 'low';

  return {
    level,
    highCertaintyMarkers: highMarkers.filter((m) => (text.match(new RegExp(m, 'gi')) ?? []).length > 0),
    lowCertaintyMarkers: lowMarkers.filter((m) => (text.match(new RegExp(m, 'gi')) ?? []).length > 0),
    neutralMarkers: [],
    description: level === 'high' ? '语气确定，态度鲜明' : level === 'low' ? '语气审慎，留有余地' : '语气平衡，折中调和',
  };
}

function detectQuotePatterns(text: string, lang: SupportedLanguage): QuotePattern[] {
  const patterns: QuotePattern[] = [];

  const chineseQuotes = (text.match(/["""「『【]([^"」『】]{5,100})["""]/g) ?? []).length;
  const englishQuotes = (text.match(/"([^"]{5,100})"/g) ?? []).length;

  if (chineseQuotes + englishQuotes > 2) {
    patterns.push({
      pattern: 'frequent_quotes',
      description: '善于引用他人观点或名言',
      frequency: chineseQuotes + englishQuotes,
      examples: (text.match(/[""]{2}[^"]{10,50}[""]/g) ?? []).slice(0, 5),
    });
  }

  const numbers = (text.match(/\d+%|\d+倍|\d+次/g) ?? []).length;
  if (numbers > 3) {
    patterns.push({
      pattern: 'data_driven',
      description: '善于使用数据和数字支撑论点',
      frequency: numbers,
      examples: (text.match(/\d+%[^\d%]{0,20}/g) ?? []).slice(0, 3),
    });
  }

  return patterns;
}

function detectVerbalMarkers(text: string, lang: SupportedLanguage): VerbalMarker[] {
  const markers: VerbalMarker[] = [];

  const catchphrases = lang === 'zh'
    ? ['事实上', '重要的是', '关键在于', '本质上', '归根结底', '说到底', '坦白说', '说实话', '毫无疑问']
    : ['the fact is', 'the point is', 'what matters is', 'essentially', 'at the end of the day', 'frankly', 'honestly'];

  for (const phrase of catchphrases) {
    const count = (text.match(new RegExp(phrase, 'gi')) ?? []).length;
    if (count >= 2) {
      markers.push({
        marker: phrase,
        type: 'catchphrase',
        frequency: count,
        context: 'repeated_opening',
      });
    }
  }

  return markers;
}

function computeRhythm(sentences: string[], paragraphs: string[], text: string): RhythmProfile {
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((s, sen) => s + sen.length, 0) / sentences.length
    : 0;

  const avgParagraphLength = paragraphs.length > 0
    ? paragraphs.reduce((s, p) => s + p.length, 0) / paragraphs.length
    : 0;

  const shortRatio = sentences.length > 0
    ? sentences.filter((s) => s.length < 20).length / sentences.length
    : 0;

  const longRatio = sentences.length > 0
    ? sentences.filter((s) => s.length > 80).length / sentences.length
    : 0;

  return {
    avgSentenceLength: Math.round(avgSentenceLength),
    avgParagraphLength: Math.round(avgParagraphLength),
    shortSentenceRatio: Math.round(shortRatio * 100) / 100,
    longSentenceRatio: Math.round(longRatio * 100) / 100,
    punctuationDensity: {
      questionMarks: (text.match(/[？？?]/g) ?? []).length,
      exclamationMarks: (text.match(/[！！!]/g) ?? []).length,
      semicolons: (text.match(/[；;]/g) ?? []).length,
      colons: (text.match(/[：:]/g) ?? []).length,
      quotes: (text.match(/[""「」『』【】]/g) ?? []).length,
    },
    description: avgSentenceLength > 50 ? '节奏沉稳，论证绵密' : avgSentenceLength < 20 ? '节奏明快，干脆利落' : '节奏适中，张弛有度',
  };
}

function detectRhetoricalHabits(
  text: string,
  sentences: string[],
  quotes: QuotePattern[],
  lang: SupportedLanguage
): RhetoricalHabit[] {
  const habits: RhetoricalHabit[] = [];

  // Check for frequent quotes (need at least 2 quote pairs in text)
  const chineseQuotes = (text.match(/["""「『【]([^"」『】]{5,100})["""]/g) ?? []).length;
  const englishQuotes = (text.match(/"([^"]{5,100})"/g) ?? []).length;
  const totalQuotes = chineseQuotes + englishQuotes;

  if (totalQuotes >= 2) {
    habits.push({
      habit: '善用引证',
      description: '经常引用他人观点、名言或数据来支撑论点',
      frequency: totalQuotes,
      examples: (text.match(/[""]{2}[^"]{10,50}[""]/g) ?? []).slice(0, 3),
      confidence: totalQuotes >= 5 ? 0.9 : 0.7,
    });
  }

  // Detect rhetorical question patterns (very common in teaching/dharma texts)
  const questionCount = (text.match(/[？？?]/g) ?? []).length;
  if (questionCount >= 3) {
    habits.push({
      habit: '善用提问',
      description: '通过提问引导思考，而非直接给出答案',
      frequency: questionCount,
      examples: (text.match(/[？？?][^？？?]{5,50}/g) ?? []).slice(0, 3),
      confidence: questionCount >= 8 ? 0.9 : 0.7,
    });
  }

  // Detect analogy/metaphor usage
  const analogyPatterns = lang === 'zh'
    ? [/像[^，。！？]{2,30}(?:一样|的话|那样)/g, /如同[^，。！？]{2,30}/g, /犹如[^，。！？]{2,30}/g, /仿佛[^，。！？]{2,30}/g, /就好比[^，。！？]{2,30}/g]
    : [/like [^,.]{3,30}[,.]/gi, /as if [^,.]{3,30}[,.]/gi, /similar to [^,.]{3,30}[,.]/gi, /in other words[^,.]{3,30}[,.]/gi];

  let analogyCount = 0;
  const analogyExamples: string[] = [];
  for (const pattern of analogyPatterns) {
    const matches = text.match(pattern) ?? [];
    analogyCount += matches.length;
    analogyExamples.push(...matches.slice(0, 2));
  }

  if (analogyCount >= 2) {
    habits.push({
      habit: '善用类比',
      description: '通过类比和比喻将抽象概念具体化，帮助理解',
      frequency: analogyCount,
      examples: analogyExamples.slice(0, 3),
      confidence: analogyCount >= 5 ? 0.9 : 0.7,
    });
  }

  // Detect systematic/rule-based structure
  const rulePatterns = lang === 'zh'
    ? [/第[一二三四五六七八九十]+[、，]/g, /第一[、，]第二[、，]第三/g, /首先[、，]/g, /其次[、，]/g, /最后[、，]/g, /原则[一二三]?/g, /法则[一二三]?/g]
    : [/first(ly)?[,\s]/gi, /second(ly)?[,\s]/gi, /third(ly)?[,\s]/gi, /finally[,\s]/gi, /in summary[,\s]/gi];

  let ruleCount = 0;
  const ruleExamples: string[] = [];
  for (const pattern of rulePatterns) {
    const matches = text.match(pattern) ?? [];
    ruleCount += matches.length;
    ruleExamples.push(...matches.slice(0, 2));
  }

  if (ruleCount >= 3) {
    habits.push({
      habit: '系统化思维',
      description: '善于将内容组织为系统化的原则、规则或步骤',
      frequency: ruleCount,
      examples: ruleExamples.slice(0, 3),
      confidence: ruleCount >= 6 ? 0.9 : 0.7,
    });
  }

  // Detect contrast/dialectical structure
  const contrastCount = lang === 'zh'
    ? (text.match(/然而|但是|不过|然而|却|然而|另一方面/g) ?? []).length
    : (text.match(/however|but|on the other hand|nevertheless|yet|instead/gi) ?? []).length;

  if (contrastCount >= 5) {
    habits.push({
      habit: '辩证思维',
      description: '善于呈现问题的两面性，探讨对立与平衡',
      frequency: contrastCount,
      examples: [],
      confidence: 0.7,
    });
  }

  return habits;
}

function extractDomainTerms(topWords: VocabularyFingerprint['topWords'], lang: SupportedLanguage): string[] {
  // Filter out common words, keep domain-specific ones
  const common = lang === 'zh'
    ? new Set(['的', '是', '在', '有', '和', '了', '不', '人', '都', '一个', '上', '也', '很', '到', '说'])
    : new Set(['the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does', 'did']);

  return topWords
    .filter((w) => !common.has(w.word) && w.isDomainSpecific && w.frequency >= 3)
    .slice(0, 20)
    .map((w) => w.word);
}

// =============================================================================
// LLM Refinement Track
// =============================================================================

/**
 * LLM 轨：用 LLM 精修统计结果
 */
export async function refineExpressionWithLLM(
  text: string,
  stats: StatsExtraction,
  personaName: string,
  session?: LLMSession,
  logger?: ZeroLogger,
  phase = 'expression-llm'
): Promise<ExpressionDNA> {
  const systemPrompt = `你是一位语言风格分析专家。你的任务是精修从语料中提取的表达DNA特征。

请参考统计数据，用JSON格式输出精修后的结果：
{
  "vocabulary": {
    "topWords": ["最重要的特征词（15-20个）"],
    "bigrams": ["高频二元组（10个）"],
    "trigrams": ["高频三元组（5个）"],
    "signaturePhrases": ["标志性短语（5个，每个至少出现3次）"],
    "domainTerms": ["专业领域术语（5个）"],
    "confidence": 0-1的置信度
  },
  "sentenceStyles": [
    {"pattern": "风格名称", "description": "描述", "frequency": 出现次数, "examples": ["例句1"], "confidence": 置信度}
  ],
  "forbiddenWords": [
    {"word": "词", "reason": "为什么这个词与此人不符"}
  ],
  "tone": {
    "dominant": "formal/casual/passionate/detached",
    "shifts": 语调变化次数(0-2),
    "description": "语调描述",
    "markers": ["语调标记词（3-5个）"]
  },
  "certaintyProfile": {
    "level": "high/medium/low",
    "description": "确信程度描述"
  },
  "rhetoricalHabits": [
    {"habit": "习惯名称", "description": "描述", "frequency": 频率, "examples": ["例子"], "confidence": 置信度}
  ],
  "quotePatterns": [
    {"pattern": "引用模式", "description": "描述", "frequency": 频率, "examples": ["例子"]}
  ],
  "verbalMarkers": [
    {"marker": "词语", "type": "catchphrase/filler/transition/emphasis", "frequency": 频率, "context": "使用场景"}
  ],
  "speakingStyle": {
    "summary": "整体风格总结（50-100字）",
    "verboseLevel": "terse/moderate/verbose",
    "explanationDepth": "shallow/medium/deep",
    "abstractionLevel": "concrete/mixed/abstract",
    "emotionalRange": "cold/moderate/warm",
    "humorFrequency": "rare/occasional/frequent",
    "metaphorUsage": "rare/occasional/frequent",
    "analogyUsage": "rare/occasional/frequent"
  },
  "rhythm": {
    "avgSentenceLength": 平均句子长度（字数）,
    "avgParagraphLength": 平均段落长度（字数）,
    "description": "节奏特征描述"
  }
}`;

  const statsSummary = buildStatsSummary(stats);
  const userPrompt = `请参考以下统计数据，精修${personaName}的表达DNA：

统计数据摘要：
${statsSummary}

语料样本（前3000字）：
${text.slice(0, 3000)}

请输出JSON格式的精修结果。`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const result = await callLLMWithJSON<Partial<ExpressionDNA>>(messages, {
    temperature: 0.3,
    maxTokens: 3000,
  }, session ?? undefined, phase);

  return mergeExpression(stats, result.data);
}

// =============================================================================
// Full ExpressionDNA Extraction
// =============================================================================

/**
 * 提取完整 ExpressionDNA（统计轨 → LLM 轨 → 融合）
 */
export async function extractExpressionDNA(
  text: string,
  language: SupportedLanguage,
  personaName: string,
  session?: LLMSession,
  logger?: ZeroLogger,
  useLLM = true
): Promise<ExpressionDNA> {
  const startTime = Date.now();

  // Step 1: Statistical track
  const stats = extractExpressionStats(text, language);
  logger?.info('ExpressionDNA: statistical track done', {
    vocabularySize: stats.vocabulary.topWords.length,
    sentenceStyles: stats.sentenceStyles.length,
  });

  // Step 2: LLM refinement (optional)
  if (useLLM) {
    try {
      const llmResult = await refineExpressionWithLLM(text, stats, personaName, session, logger);
      return llmResult;
    } catch (err) {
      logger?.warn(`ExpressionDNA: LLM refinement failed, using stats only: ${(err as Error).message}`);
    }
  }

  // Fallback: convert stats to ExpressionDNA
  return convertStatsToExpressionDNA(stats);
}

// =============================================================================
// Helpers
// =============================================================================

function buildStatsSummary(stats: StatsExtraction): string {
  const vocab = stats.vocabulary.topWords.slice(0, 15).map((w) => w.word).join(', ');
  const bigrams = stats.vocabulary.bigrams.slice(0, 10).map((b) => b.ngram).join(', ');
  const styles = stats.sentenceStyles.map((s) => `${s.pattern}(${s.frequency})`).join(', ');
  const tone = `${stats.tone.dominant} (shifts=${stats.tone.shifts})`;
  const certainty = stats.certainty.level;

  return `
词频 Top15: ${vocab}
二元组 Top10: ${bigrams}
句式风格: ${styles || '未检测到明显风格'}
主语调: ${tone}
确信程度: ${certainty}
平均句长: ${stats.rhythm.avgSentenceLength}字
感叹句: ${stats.rhythm.punctuationDensity.exclamationMarks}次
问句: ${stats.rhythm.punctuationDensity.questionMarks}次
引用数: ${stats.quotePatterns.reduce((s, q) => s + q.frequency, 0)}次
`;
}

function mergeExpression(stats: StatsExtraction, llm: Partial<ExpressionDNA>): ExpressionDNA {
  // LLM result takes precedence; fall back to stats
  return {
    vocabulary: {
      ...stats.vocabulary,
      ...llm.vocabulary,
      confidence: Math.max(stats.vocabulary.confidence, llm.vocabulary?.confidence ?? 0),
    },
    sentenceStyles: (llm.sentenceStyles?.length ?? 0) > 0 ? llm.sentenceStyles! : stats.sentenceStyles,
    forbiddenWords: llm.forbiddenWords ?? stats.vocabulary.signaturePhrases.map((s) => ({
      word: s.phrase,
      reason: '语料中极少出现',
    })),
    tone: llm.tone ?? stats.tone,
    certaintyProfile: llm.certaintyProfile ?? stats.certainty,
    rhetoricalHabits: (llm.rhetoricalHabits?.length ?? 0) > 0 ? llm.rhetoricalHabits! : stats.rhetoricalHabits,
    quotePatterns: (llm.quotePatterns?.length ?? 0) > 0 ? llm.quotePatterns! : stats.quotePatterns,
    rhythm: llm.rhythm ?? stats.rhythm,
    verbalMarkers: (llm.verbalMarkers?.length ?? 0) > 0 ? llm.verbalMarkers! : stats.verbalMarkers,
    speakingStyle: llm.speakingStyle ?? {
      summary: stats.tone.description + '，' + stats.rhythm.description,
      verboseLevel: 'moderate',
      explanationDepth: 'medium',
      abstractionLevel: 'mixed',
      emotionalRange: 'moderate',
      humorFrequency: 'rare',
      metaphorUsage: 'occasional',
      analogyUsage: 'occasional',
    },
  };
}

function convertStatsToExpressionDNA(stats: StatsExtraction): ExpressionDNA {
  return mergeExpression(stats, {});
}
