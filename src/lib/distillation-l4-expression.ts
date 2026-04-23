/**
 * Prismatic — Layer 4: Expression Extraction
 * Extracts expression DNA from TARGET OUTPUT language corpus
 *
 * Key principle: Vocabulary and sentence style MUST be extracted from the
 * target output language (e.g., Chinese). Cross-language fields (tone,
 * certainty, rhetoric) can be inferred from source language.
 * This is the layer that most directly determines whether the persona
 * "sounds right" in conversation.
 */

import {
  type ExpressionLayer,
  type ExtractionPromptContext,
  type SupportedLanguage,
  type Period,
} from './distillation-v4-types';
import {
  autoGenerateExpressionDNA,
  assessCorpusQuality,
} from './expression-calibrator';

// ─── Chinese-Specific Expression Analysis ─────────────────────────────────────────

const ZH_EXPRESSION_MARKERS = {
  formal: ['因此', '然而', '综上所述', '由此可见', '此外', '与此同时', '换言之', '概而言之', '即', '亦即'],
  casual: ['我觉得', '其实', '比如说', '大概', '可能吧', '你知道', '说实话', '这么说吧', '那什么', '你懂的'],
  passionate: ['！', '简直', '绝对', '一定', '太棒了', '太糟糕了', '毫无疑问', '无可置疑', '毫无疑问地', '毫无疑问地', '毫无疑问地'],
  humorous: ['哈哈', '开玩笑', '笑死', '有意思', '有趣', '逗', '乐', '妙', '绝了'],
  therapeutic: ['不急', '慢慢来', '其实也没那么严重', '换个角度看', '放宽心', '接纳', '放下'],
  selfAware: ['我承认', '我错了', '我承认我', '可能是我', '我也不确定', '说错了', '这一点我'],
};

const EN_EXPRESSION_MARKERS = {
  formal: ['therefore', 'however', 'moreover', 'furthermore', 'thus', 'hence', 'consequently', 'accordingly'],
  casual: ['you know', 'i guess', 'kind of', 'sort of', 'maybe', 'actually', 'basically', 'pretty much'],
  passionate: ['!', 'absolutely', 'definitely', 'incredibly', 'amazing', 'no doubt', 'certainly', 'undoubtedly'],
  humorous: ['haha', 'lol', 'funny', 'joke', 'laugh', 'ridiculous', 'absurd'],
  therapeutic: ['take your time', 'slow down', "it's okay", "that's fine", 'let go', 'accept'],
  selfAware: ['i admit', 'i was wrong', 'i may be', 'perhaps i', 'i\'m not sure', 'if i\'m wrong'],
};

const CERTAINTY_HIGH = {
  zh: ['一定', '绝对', '毫无疑问', '无可置疑', '必然', '必定', '肯定', '确定'],
  en: ['definitely', 'absolutely', 'certainly', 'no doubt', 'undoubtedly', 'must', 'will', 'always'],
};

const CERTAINTY_LOW = {
  zh: ['可能', '也许', '大概', '不确定', '不清楚', '我不确定', '可能吧', '也许吧', '或许'],
  en: ['maybe', 'perhaps', 'probably', 'possibly', 'might', 'could be', 'i think', 'i guess', 'not sure'],
};

interface ExpressionMarkers {
  formal: string[];
  casual: string[];
  passionate: string[];
  humorous: string[];
  therapeutic: string[];
  selfAware: string[];
}

function getMarkers(lang: SupportedLanguage): ExpressionMarkers {
  return lang === 'zh' ? ZH_EXPRESSION_MARKERS : EN_EXPRESSION_MARKERS;
}

// ─── Tone Analysis ─────────────────────────────────────────────────────────────

function analyzeTone(
  text: string,
  lang: SupportedLanguage
): {
  dominant: ExpressionLayer['tone'];
  certainty: ExpressionLayer['certaintyLevel'];
  rhetoricalHabit: string;
  rhythmDescription: string;
} {
  const markers = getMarkers(lang);
  const certHigh = lang === 'zh' ? CERTAINTY_HIGH.zh : CERTAINTY_HIGH.en;
  const certLow = lang === 'zh' ? CERTAINTY_LOW.zh : CERTAINTY_LOW.en;

  const counts = { formal: 0, casual: 0, passionate: 0, humorous: 0, therapeutic: 0 };
  let certaintyHigh = 0;
  let certaintyLow = 0;

  for (const [key, markerList] of Object.entries(markers)) {
    if (key === 'selfAware') continue;
    for (const marker of markerList) {
      if (text.includes(marker)) {
        (counts as any)[key]++;
      }
    }
  }

  for (const marker of certHigh) {
    if (text.toLowerCase().includes(marker.toLowerCase())) certaintyHigh++;
  }
  for (const marker of certLow) {
    if (text.toLowerCase().includes(marker.toLowerCase())) certaintyLow++;
  }

  // Determine dominant tone
  const entries = Object.entries(counts) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const dominant = (entries[0][1] > 0 ? entries[0][0] : 'formal') as ExpressionLayer['tone'];

  // Determine certainty
  const certainty: ExpressionLayer['certaintyLevel'] =
    certaintyHigh > certaintyLow * 2 ? 'high'
    : certaintyLow > certaintyHigh * 2 ? 'low'
    : 'medium';

  // Rhetorical habit
  const rhetoricalHabit = entries
    .filter(([_, count]) => count > 0)
    .map(([tone]) => {
      const map: Record<string, string> = {
        formal: '措辞严谨',
        casual: '轻松随意',
        passionate: '充满激情',
        humorous: '善用幽默',
        therapeutic: '疗愈风格',
      };
      return map[tone] ?? tone;
    })
    .join('、');

  // Rhythm description
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
  const avgLen = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
    : 0;
  const shortRatio = sentences.filter(s => s.length < 15).length / Math.max(1, sentences.length);

  let rhythmDescription = '';
  if (shortRatio > 0.4) {
    rhythmDescription = '短句为主，节奏明快';
  } else if (avgLen > 50) {
    rhythmDescription = '长句为主，论证缜密';
  } else {
    rhythmDescription = '长短句交错，节奏自然';
  }

  return { dominant, certainty, rhetoricalHabit, rhythmDescription };
}

// ─── Sentence Style Extraction ───────────────────────────────────────────────────

function extractSentenceStyles(
  text: string,
  lang: SupportedLanguage
): { styles: string[]; forbidden: string[] } {
  const styles: string[] = [];
  const forbidden: string[] = [];

  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 5);
  const total = sentences.length;

  if (total === 0) return { styles: [], forbidden: [] };

  // Question frequency
  const questions = sentences.filter(s => /[？?]/.test(s)).length;
  if (questions / total > 0.1) {
    styles.push('善于提问，引导思考');
  }

  // Exclamation frequency
  const exclamations = sentences.filter(s => /[！！!]/.test(s)).length;
  if (exclamations / total > 0.05) {
    styles.push('善用感叹，强调观点');
  }

  // Quote usage
  const quoteMatches = text.match(/["""''「」『』【】\[\(].{5,100}["""''「」『』【】\[\)]/g);
  const quotes = quoteMatches ? quoteMatches.length : 0;
  if (quotes / total > 0.05) {
    styles.push('善用引证');
  }

  // Enumeration
  const enumeration = lang === 'zh'
    ? (text.match(/第一[、，]?|第二[、，]?|第三[、，]?|首先[、，]?/g) ?? []).length
    : (text.match(/first(ly)?[,\s]|second(ly)?[,\s]|third(ly)?[,\s]/gi) ?? []).length;
  if (enumeration / total > 0.03) {
    styles.push('善用列举，条理清晰');
  }

  // Rhetorical questions
  if (questions / total > 0.15) {
    styles.push('反问句频繁');
  }

  // Self-deprecating / doubt markers
  const doubt = lang === 'zh'
    ? (text.match(/可能|也许|不确定|不太确定|我不太/gi) ?? []).length
    : (text.match(/maybe|perhaps|i'm not sure|i wonder|not sure/gi) ?? []).length;
  if (doubt / total > 0.1) {
    styles.push('善于表达不确定性');
  }

  // Short punchy sentences
  const shortSentences = sentences.filter(s => s.length < 20).length;
  if (shortSentences / total > 0.3) {
    styles.push('善用短句，简洁有力');
  }

  // Conditional statements
  const conditionals = lang === 'zh'
    ? (text.match(/如果|假如|倘若|若是|倘若|万一/gi) ?? []).length
    : (text.match(/if|unless|supposing|what if/gi) ?? []).length;
  if (conditionals / total > 0.05) {
    styles.push('善用条件句，考虑多种可能');
  }

  // Forbidden: words that appear very rarely (< 0.01%) but are common elsewhere
  const tokens = lang === 'zh'
    ? text.split('').filter(c => /[\u4e00-\u9fff]/.test(c))
    : text.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const freqMap = new Map<string, number>();
  for (const token of tokens) {
    freqMap.set(token, (freqMap.get(token) ?? 0) + 1);
  }

  for (const [word, count] of freqMap.entries()) {
    const ratio = count / tokens.length;
    if (ratio < 0.0001 && count <= 1) {
      forbidden.push(word);
    }
  }

  return { styles: styles.slice(0, 5), forbidden: forbidden.slice(0, 10) };
}

// ─── Vocabulary Fingerprint ─────────────────────────────────────────────────────

function extractVocabulary(
  text: string,
  lang: SupportedLanguage
): string[] {
  let tokens: string[];

  if (lang === 'zh') {
    // Extract 2-4 char Chinese words based on character patterns (more effective than sliding window)
    const ZH_STOP = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '这', '那', '也', '个', '上', '下', '来', '去', '着', '过', '会', '能', '要', '可', '以', '于']);
    const words = text.match(/[\u4e00-\u9fff]{2,4}/g) ?? [];
    // Filter stopwords and count frequency
    const freq = new Map<string, number>();
    for (const w of words) {
      if (!ZH_STOP.has(w)) {
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
    tokens = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([w]) => w);
  } else {
    tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}'-]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !isStopword(t));
    // Count frequency for English too
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
    tokens = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([w]) => w);
  }

  return tokens;
}

function isStopword(word: string): boolean {
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'this', 'that', 'these', 'those', 'it', 'its', 'and', 'or', 'but', 'if',
    'not', 'no', 'all', 'any', 'so', 'than', 'too', 'very', 'just', 'can',
  ]);
  return STOPWORDS.has(word);
}

// ─── Main Expression Extraction ─────────────────────────────────────────────────

export interface ExpressionExtractionConfig {
  corpusSample: string;
  sourceCorpusSample?: string;   // In source language (for cross-validation)
  personaId: string;
  targetLanguage: 'zh-CN' | 'en-US';
  sourceLanguage: SupportedLanguage;
  period?: Period;
  llm?: any;  // Optional LLM for advanced extraction
}

export async function extractExpression(
  config: ExpressionExtractionConfig
): Promise<ExpressionLayer> {
  const {
    corpusSample,
    sourceCorpusSample,
    targetLanguage,
    sourceLanguage,
    period,
    llm,
  } = config;

  // Determine which language the corpus is in
  const corpusLang: SupportedLanguage =
    targetLanguage === 'zh-CN' ? 'zh' : 'en';

  // Try LLM-based extraction first if LLM is available
  if (llm) {
    try {
      const llmResult = await extractExpressionWithLLM(
        corpusSample,
        corpusLang,
        targetLanguage,
        llm
      );
      // LLM extraction succeeded — use it (it always returns valid structure)
      const toneAnalysis = analyzeTone(corpusSample, corpusLang);
      const { styles: _, forbidden } = extractSentenceStyles(corpusSample, corpusLang);

      const confidenceNotes: string[] = [];
      if (llmResult.vocabulary.length < 5) confidenceNotes.push('LLM vocabulary extraction sparse');
      if (llmResult.sentenceStyle.length < 2) confidenceNotes.push('LLM sentence style extraction sparse');
      const confidence: 'high' | 'medium' | 'low' =
        llmResult.vocabulary.length >= 10 && llmResult.sentenceStyle.length >= 3 ? 'high'
        : llmResult.vocabulary.length >= 5 || llmResult.sentenceStyle.length >= 2 ? 'medium'
        : 'low';

      return {
        vocabulary: llmResult.vocabulary,
        sentenceStyle: llmResult.sentenceStyle,
        forbiddenWords: llmResult.forbiddenWords,
        tone: llmResult.tone,
        certaintyLevel: llmResult.certaintyLevel,
        rhetoricalHabit: llmResult.rhetoricalHabit,
        quotePatterns: llmResult.quotePatterns,
        rhythm: llmResult.rhetoricalHabit,
        rhythmDescription: llmResult.rhetoricalHabit,
        chineseAdaptation: llmResult.chineseAdaptation,
        verbalMarkers: llmResult.verbalMarkers,
        speakingStyle: llmResult.speakingStyle,
        confidence,
        confidenceNotes,
      };
    } catch {
      // Fall back to heuristic extraction
    }
  }

  // Fallback: heuristic-based extraction
  const toneAnalysis = analyzeTone(corpusSample, corpusLang);
  const { styles, forbidden } = extractSentenceStyles(corpusSample, corpusLang);
  const vocabulary = extractVocabulary(corpusSample, corpusLang);

  let sourceVocabulary: string[] = [];
  let sourceSentenceStyle: string[] = [];
  let sourceTone: string = '';
  let sourceRhythm: string = '';

  if (sourceCorpusSample && sourceLanguage !== corpusLang) {
    const srcTone = analyzeTone(sourceCorpusSample, sourceLanguage);
    const { styles: srcStyles } = extractSentenceStyles(sourceCorpusSample, sourceLanguage);
    sourceVocabulary = extractVocabulary(sourceCorpusSample, sourceLanguage);
    sourceSentenceStyle = srcStyles;
    sourceTone = srcTone.dominant;
    sourceRhythm = srcTone.rhythmDescription;
  }

  let chineseAdaptation = '';
  if (targetLanguage === 'zh-CN') {
    const adaptationNotes: string[] = [];
    if (toneAnalysis.dominant === 'casual' || toneAnalysis.dominant === 'humorous') {
      adaptationNotes.push('保持口语化风格，用"我觉得"而非"我认为"');
    }
    if (toneAnalysis.certainty === 'high') {
      adaptationNotes.push('表达确定时用"一定""绝对"而非"大概""可能"');
    }
    if (styles.includes('善于提问')) {
      adaptationNotes.push('以问句开场，引导用户思考');
    }
    if (styles.includes('善用短句，简洁有力')) {
      adaptationNotes.push('回复保持简短有力，避免冗长段落');
    }
    if (sourceTone && sourceTone !== toneAnalysis.dominant) {
      adaptationNotes.push(`注意：原文语调(${sourceTone})与目标语言语调(${toneAnalysis.dominant})存在差异，需在中文中找到对应表达`);
    }
    chineseAdaptation = adaptationNotes.join('\n');
  }

  const verbalMarkers = extractVerbalMarkers(corpusSample, corpusLang);
  const speakingStyle = buildSpeakingStyle(toneAnalysis, styles, vocabulary, corpusLang);

  const confidenceNotes: string[] = [];
  if (vocabulary.length < 10) confidenceNotes.push('词汇样本不足');
  if (corpusSample.length < 3000) confidenceNotes.push('语料过短，表达层提取受限');

  const confidence: 'high' | 'medium' | 'low' =
    vocabulary.length >= 10 && corpusSample.length >= 3000 ? 'high'
    : vocabulary.length >= 5 || corpusSample.length >= 2000 ? 'medium'
    : 'low';

  return {
    vocabulary: vocabulary.slice(0, 20),
    sentenceStyle: styles,
    forbiddenWords: forbidden,
    tone: toneAnalysis.dominant,
    certaintyLevel: toneAnalysis.certainty,
    rhetoricalHabit: toneAnalysis.rhythmDescription,
    quotePatterns: extractQuotePatterns(corpusSample, corpusLang),
    rhythm: toneAnalysis.rhythmDescription,
    rhythmDescription: toneAnalysis.rhythmDescription,
    chineseAdaptation,
    verbalMarkers,
    speakingStyle,
    sourceVocabulary: sourceVocabulary.length > 0 ? sourceVocabulary.slice(0, 20) : undefined,
    sourceSentenceStyle: sourceSentenceStyle.length > 0 ? sourceSentenceStyle : undefined,
    sourceTone: sourceTone || undefined,
    sourceRhythm: sourceRhythm || undefined,
    confidence,
    confidenceNotes,
  };
}

// ─── LLM-Based Expression Extraction ──────────────────────────────────────────────

interface LLMExpressionResult {
  vocabulary: string[];
  sentenceStyle: string[];
  forbiddenWords: string[];
  tone: ExpressionLayer['tone'];
  certaintyLevel: ExpressionLayer['certaintyLevel'];
  rhetoricalHabit: string;
  quotePatterns: string[];
  verbalMarkers: string[];
  speakingStyle: string;
  chineseAdaptation: string;
}

async function extractExpressionWithLLM(
  corpusSample: string,
  corpusLang: SupportedLanguage,
  targetLang: 'zh-CN' | 'en-US',
  llm: any
): Promise<LLMExpressionResult> {
  const sample = corpusSample.slice(0, 8000);
  const lang = corpusLang === 'zh' ? 'Chinese' : 'English';

  const prompt = `你是一位风格分析专家。请从以下语料中提取这个人物的中文表达特征。
即使原语料不是中文，也要提取该人物用中文表达时会展现的特征。

请用中文返回（所有字段均使用中文）：
{
  "vocabulary": ["该人物最常用的10-15个中文特征词汇或短语（用中文，不是英文）"],
  "sentenceStyle": ["3-5个该人物特有的中文句式习惯"],
  "forbiddenWords": ["该人物绝对不会使用的3-5个词或表达"],
  "tone": "formal|casual|passionate|detached|humorous|therapeutic",
  "certaintyLevel": "high|medium|low",
  "rhetoricalHabit": "1-2句话描述该人物的中文修辞特点",
  "quotePatterns": ["该人物引用或典故使用的2-3个模式"],
  "verbalMarkers": ["该人物的口头禅或惯用语2-3个"],
  "speakingStyle": "2-3句话描述该人物的中文交流风格",
  "chineseAdaptation": "在中文输出时保持该人物风格的3个具体建议"
}

=== CORPUS SAMPLE ===
${sample}
=== END CORPUS ===`;

  const response = await llm.chat({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    maxTokens: 2000,
  });

  const rawText = response.content.trim();
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let data: any = null;
  try {
    data = JSON.parse(jsonText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try { data = JSON.parse(match[0]); } catch {}
    }
  }

  if (!data) {
    throw new Error('LLM returned non-JSON expression analysis');
  }

  return {
    vocabulary: Array.isArray(data.vocabulary) ? data.vocabulary.slice(0, 15) : [],
    sentenceStyle: Array.isArray(data.sentenceStyle) ? data.sentenceStyle.slice(0, 5) : [],
    forbiddenWords: Array.isArray(data.forbiddenWords) ? data.forbiddenWords.slice(0, 10) : [],
    tone: ['formal', 'casual', 'passionate', 'detached', 'humorous', 'therapeutic'].includes(data.tone)
      ? data.tone : 'formal',
    certaintyLevel: ['high', 'medium', 'low'].includes(data.certaintyLevel)
      ? data.certaintyLevel : 'medium',
    rhetoricalHabit: String(data.rhetoricalHabit ?? ''),
    quotePatterns: Array.isArray(data.quotePatterns) ? data.quotePatterns : [],
    verbalMarkers: Array.isArray(data.verbalMarkers) ? data.verbalMarkers.slice(0, 5) : [],
    speakingStyle: String(data.speakingStyle ?? ''),
    chineseAdaptation: String(data.chineseAdaptation ?? ''),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractVerbalMarkers(text: string, lang: SupportedLanguage): string[] {
  // Extract phrases that appear multiple times (>=2)
  const MARKER_PATTERNS = lang === 'zh'
    ? [
        /(.{2,6})[，。,、]{1,2}\1/g,          // Repeating 2-char phrases
        /(.{3,8})[，。,、]{1,2}\1/g,          // Repeating 3-4 char phrases
      ]
    : [
        /\b(\w+)\s+\1\b/gi,                  // Repeated words
        /\b(\w+\s+\w+)\s+\1\b/gi,           // Repeated bigrams
      ];

  const markers = new Set<string>();
  for (const pattern of MARKER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.replace(/[，。,、\s]/g, '').trim();
        if (cleaned.length >= 2) markers.add(cleaned);
      }
    }
  }

  return [...markers].slice(0, 5);
}

function extractQuotePatterns(text: string, lang: SupportedLanguage): string[] {
  const patterns: string[] = [];

  const quoteRegex = lang === 'zh'
    ? /["""''「」『』【】\[\(](.{5,80})["""''「」『』【】\[\)]/g
    : /"([^"]{5,80})"|'([^']{5,80})'|\(([^)]{5,80})\)/g;

  const matches = text.match(quoteRegex) ?? [];
  if (matches.length > 0) {
    patterns.push(`平均引用长度: ${Math.round(matches.reduce((s, m) => s + m.length, 0) / matches.length)} 字符`);
  }

  // Check quote sources
  const cites = lang === 'zh'
    ? (text.match(/出自|语出|引用|典故|经云|子曰|书云/g) ?? []).length
    : (text.match(/according to|from the|as.*said|cites?|quotes?/gi) ?? []).length;

  if (cites > 2) {
    patterns.push('经常引用权威来源');
  }

  return patterns;
}

function buildSpeakingStyle(
  tone: {
    dominant: ExpressionLayer['tone'];
    certainty: ExpressionLayer['certaintyLevel'];
    rhetoricalHabit: string;
    rhythmDescription: string;
  },
  styles: string[],
  vocabulary: string[],
  lang: SupportedLanguage
): string {
  const parts: string[] = [];

  const toneDesc: Record<string, string> = {
    formal: '措辞严谨、正式',
    casual: '轻松自然、口语化',
    passionate: '充满热情、感染力强',
    detached: '冷静克制、抽离旁观',
    humorous: '幽默风趣、善用调侃',
    therapeutic: '温和疗愈、引导接纳',
  };

  parts.push(toneDesc[tone.dominant] ?? tone.dominant);
  parts.push(tone.rhythmDescription);

  if (tone.certainty === 'high') {
    parts.push('表达确定果断');
  } else if (tone.certainty === 'low') {
    parts.push('保持适度不确定性');
  }

  if (tone.rhetoricalHabit) {
    parts.push(tone.rhetoricalHabit);
  }

  return parts.join('；') + '。';
}

// ─── Expression DNA Profile → Expression Layer ─────────────────────────────────

export function profileToExpressionLayer(
  profile: import('./types').ExpressionDNAProfile,
  targetLang: 'zh-CN' | 'en-US'
): Partial<ExpressionLayer> {
  return {
    vocabulary: profile.vocabularyFingerprint.topWords.slice(0, 20),
    sentenceStyle: profile.rhetoricalHabits,
    forbiddenWords: profile.vocabularyFingerprint.forbiddenWords.slice(0, 10),
    tone: profile.toneTrajectory.dominantTone as ExpressionLayer['tone'],
    certaintyLevel: profile.toneTrajectory.certaintyLevel,
    rhetoricalHabit: profile.rhetoricalHabits.join('、'),
    quotePatterns: profile.quotePatterns,
    rhythm: profile.toneTrajectory.trajectory.join('→'),
    confidence: 'medium',
    confidenceNotes: ['Converted from ExpressionDNAProfile — may need manual verification'],
  };
}
