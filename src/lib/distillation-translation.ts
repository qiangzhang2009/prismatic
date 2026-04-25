/**
 * Prismatic — Translation Layer
 * High-quality translation for distillation output
 *
 * Handles translation of:
 * - Knowledge layer (identityPrompt, mentalModels, values, etc.)
 * - Trilingual concept mapping
 * - Translation quality assessment
 * - Backfill of missing Chinese fields for existing personas
 */

import type {
  TrilingualConcept,
  SupportedLanguage,
  KnowledgeLayer,
  ExpressionLayer,
  ExtractedMentalModel,
  ExtractedDecisionHeuristic,
  ExtractedValue,
  ExtractedTension,
  ExtractedHonestBoundary,
} from './distillation-v4-types';
import type { LLMProvider } from './llm';

// ─── Known Concept Dictionaries ─────────────────────────────────────────────

const CONCEPT_DICTIONARY: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  'language-game': { de: 'Sprachspiel', en: 'language game', zh: '语言游戏' },
  'family-resemblance': { de: 'Familienähnlichkeit', en: 'family resemblance', zh: '家族相似性' },
  'form-of-life': { de: 'Lebensform', en: 'form of life', zh: '生活形式' },
  'private-language': { de: 'private Sprache', en: 'private language', zh: '私人语言' },
  'rule-following': { de: 'Regelbefolgung', en: 'rule-following', zh: '遵守规则' },
  'picture-theory': { de: 'Bildtheorie', en: 'picture theory', zh: '图像理论' },
  'logical-space': { de: 'logischer Raum', en: 'logical space', zh: '逻辑空间' },
  'tautology': { de: 'Tautologie', en: 'tautology', zh: '重言式' },
  'world-as-fact': { de: 'Welt als Tatsache', en: 'world as fact', zh: '世界是事实的总和' },
  'first-principles': { en: 'first principles', zh: '第一性原理' },
  'second-order-thinking': { en: 'second-order thinking', zh: '二阶思维' },
  'inversion': { en: 'inversion', zh: '反转思维' },
  'circle-of-competence': { en: 'circle of competence', zh: '能力圈' },
  'moi': { en: 'the self', zh: '小我' },
  'wu-wei': { en: 'non-action', zh: '无为' },
  'tao': { en: 'the Way', zh: '道' },
  'te': { en: 'virtue/power', zh: '德' },
  'mindfulness': { en: 'mindfulness', zh: '正念' },
  'impermanence': { en: 'impermanence', zh: '无常' },
  'attachment': { en: 'attachment', zh: '执着' },
};

// ─── Translation Utilities ────────────────────────────────────────────────────

export function translateText(
  text: string,
  from: SupportedLanguage,
  to: SupportedLanguage
): string {
  // For now, this is a placeholder.
  // In production, integrate with DeepL, Google Translate, or Claude translation.
  // The key insight is that for distillation, we need:
  // 1. Contextual translation (not word-by-word)
  // 2. Domain-aware (philosophical terms need precise equivalents)
  // 3. Trilingual alignment (preserve concept correspondence)
  return text; // Placeholder
}

export function translateWithDictionary(
  text: string,
  from: SupportedLanguage,
  to: SupportedLanguage
): string {
  let result = text;

  for (const [conceptKey, translations] of Object.entries(CONCEPT_DICTIONARY)) {
    const fromText = translations[from];
    const toText = translations[to];

    if (fromText && toText && fromText !== toText) {
      // Replace all occurrences
      const escaped = fromText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), toText);
    }
  }

  return result;
}

// ─── Trilingual Concept Builder ───────────────────────────────────────────────

export function buildTrilingualConcept(
  term: string,
  knownDialect: SupportedLanguage
): TrilingualConcept {
  const dict = CONCEPT_DICTIONARY[term.toLowerCase().replace(/\s+/g, '-')];

  if (dict) {
    return {
      original: dict[knownDialect] || dict.en || term,
      english: dict.en || term,
      chinese: dict.zh || term,
    };
  }

  // Unknown term — return as-is for all languages
  return {
    original: term,
    english: term,
    chinese: term,
  };
}

// ─── Batch Translation ───────────────────────────────────────────────────────

export interface TranslatedField {
  original: string;
  translated: string;
  quality: 'high' | 'medium' | 'low';
  method: 'dictionary' | 'llm' | 'placeholder';
}

export function translateMentalModel(
  model: ExtractedMentalModel,
  targetLang: SupportedLanguage
): ExtractedMentalModel {
  if (targetLang === 'en') {
    return model; // Already in English
  }

  return {
    ...model,
    // These fields already have Zh versions from the extraction prompt
    oneLiner: model.oneLinerZh || model.oneLiner,
    application: model.applicationZh || model.application,
    limitation: model.limitationZh || model.limitation,
  };
}

// ─── Quality Assessment ───────────────────────────────────────────────────────

export interface TranslationQuality {
  score: number;        // 0-100
  issues: string[];
  recommendations: string[];
}

export function assessTranslationQuality(
  original: string,
  translated: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage
): TranslationQuality {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Length check
  const ratio = translated.length / Math.max(1, original.length);
  if (ratio < 0.3 || ratio > 3.0) {
    issues.push('翻译长度异常，可能存在漏译或过度发挥');
    score -= 20;
    recommendations.push('检查关键术语是否完整翻译');
  }

  // Placeholder check
  if (translated.includes('[Translation needed]') || translated.includes('待翻译')) {
    issues.push('存在未翻译占位符');
    score -= 30;
  }

  // Source language leakage
  if (sourceLang === 'en' && targetLang === 'zh') {
    const enWordCount = (translated.match(/\b[a-zA-Z]{4,}\b/g) ?? []).length;
    if (enWordCount > translated.length / 20) {
      issues.push('中文译文中混入过多英文词汇');
      score -= 15;
      recommendations.push('将专有名词替换为标准中文译法');
    }
  }

  // Terminology consistency
  const zhTerms = ['第一性原理', '思维模型', '语言游戏', '家族相似性'];
  const zhCount = zhTerms.filter(t => translated.includes(t)).length;
  if (zhCount === 0 && targetLang === 'zh' && translated.length > 100) {
    issues.push('可能存在术语翻译不一致');
    score -= 10;
    recommendations.push('确保核心术语使用标准中文译法');
  }

  return {
    score: Math.max(0, score),
    issues,
    recommendations,
  };
}

// ─── LLM-Assisted Translation ─────────────────────────────────────────────────

export interface TranslationContext {
  personaId: string;
  domain: string[];
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  keyConcepts: TrilingualConcept[];
}

export function buildTranslationPrompt(
  text: string,
  context: TranslationContext
): string {
  const { personaId, domain, sourceLanguage, targetLanguage, keyConcepts } = context;

  const sourceLabel = sourceLanguage === 'en' ? '英文' : sourceLanguage === 'de' ? '德文' : '源语言';
  const targetLabel = targetLanguage === 'zh' ? '中文' : targetLanguage === 'en' ? '英文' : '目标语言';

  const conceptNote = keyConcepts.length > 0
    ? `\n重要术语必须使用以下标准译法:\n${keyConcepts.map(c => `  ${c.english} = ${c.chinese}`).join('\n')}`
    : '';

  return `Translate the following text from ${sourceLabel} to ${targetLabel} for a Persona distillation system.

Persona: ${personaId}
Domain: ${domain.join(', ')}
${conceptNote}

Rules:
- Maintain the philosophical/conceptual precision
- Use the standardized Chinese translations for technical terms
- Preserve the tone and rhetorical style
- Keep proper nouns in their original form unless a standard translation exists
- Output only the translation, nothing else

=== TEXT TO TRANSLATE ===
${text}
=== END TEXT ===`;
}

// ─── Multi-Layer Translation ─────────────────────────────────────────────────

export async function translateKnowledgeLayer(
  knowledge: KnowledgeLayer,
  targetLang: SupportedLanguage,
  llm?: any
): Promise<KnowledgeLayer> {
  if (targetLang === 'en') {
    return knowledge; // Already in English
  }

  // For Chinese output, the extraction prompt already requested bilingual output
  // We just need to verify quality and fill in any missing Zh fields

  const translated: KnowledgeLayer = {
    ...knowledge,
    identityPromptZh: knowledge.identityPromptZh || await translateText(knowledge.identityPrompt, 'en', 'zh'),
    mentalModels: knowledge.mentalModels.map(mm => ({
      ...mm,
      oneLinerZh: mm.oneLinerZh || mm.oneLiner,
      applicationZh: mm.applicationZh || mm.application,
      limitationZh: mm.limitationZh || mm.limitation,
    })),
  };

  return translated;
}

// ─── Concept Translation Helper ──────────────────────────────────────────────

export function ensureTrilingualConcept(
  concept: TrilingualConcept,
  targetLanguages: SupportedLanguage[]
): TrilingualConcept {
  const result = { ...concept };

  for (const lang of targetLanguages) {
    const dict = Object.entries(CONCEPT_DICTIONARY).find(
      ([_, trans]) => trans.en?.toLowerCase() === concept.english.toLowerCase()
    );

    if (dict) {
      const translations = dict[1];
      if (lang === 'de' && !result.original && translations.de) {
        result.original = translations.de;
      }
      if (lang === 'zh' && !result.chinese && translations.zh) {
        result.chinese = translations.zh;
      }
    }
  }

  return result;
}

// ─── LLM-Assisted Translation ─────────────────────────────────────────────────

export interface TranslateOptions {
  preserveProperNouns?: string[];
  personaId?: string;
  domain?: string[];
}


export async function translateField(
  text: string,
  targetLang: 'zh-CN' | 'en-US',
  llm?: LLMProvider | null,
  options?: TranslateOptions
): Promise<string> {
  if (!text || text.trim().length === 0) return text;

  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-zA-Z]{4,}/.test(text);

  if (targetLang === 'zh-CN' && hasChinese && !hasEnglish) return text;
  if (targetLang === 'en-US' && hasEnglish && !hasChinese) return text;

  if (!llm) return text;

  const sourceLang: SupportedLanguage = hasChinese ? 'zh' : 'en';
  const prompt = buildTranslationPromptForField(text, sourceLang, 'zh', options);

  try {
    const response = await llm.chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: Math.min(text.length * 3, 2000),
    });
    return response.content.trim();
  } catch (err) {
    console.error('[translateField] LLM translation failed:', err);
    return text;
  }
}


// ─── Internal translation prompt builder (4 args) — used by translateField ─────────

function buildTranslationPromptForField(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage,
  options?: TranslateOptions
): string {
  const sourceLabel = sourceLang === 'en' ? '英文'
    : sourceLang === 'de' ? '德文'
    : sourceLang === 'la' ? '拉丁文'
    : sourceLang === 'el' ? '古希腊文'
    : sourceLang === 'zh' ? '中文'
    : sourceLang;

  const targetLabel = targetLang === 'zh' ? '中文'
    : targetLang === 'en' ? '英文'
    : targetLang;

  const nounNote = (options?.preserveProperNouns?.length ?? 0) > 0
    ? `保留以下词汇原文: ${options?.preserveProperNouns?.join(', ')}`
    : '';

  return `将以下${sourceLabel}文本翻译为${targetLabel}。

规则：
- 保持原文的哲学/概念精确性
- 保持语气和修辞风格
- 专有名词（如人名，地名、哲学术语）保留原文${nounNote}
- 只输出翻译结果，不要添加任何解释或注释

=== 待翻译文本 ===
${text}
=== 结束 ===`;
}


// ─── Batch Backfill ─────────────────────────────────────────────────────────

export interface BackfillOptions {
  preserveProperNouns?: string[];
  personaId?: string;
  domain?: string[];
}

export async function backfillChineseFields(
  knowledge: KnowledgeLayer,
  expression: import('./distillation-v4-types').ExpressionLayer,
  llm?: LLMProvider | null,
  options?: BackfillOptions
): Promise<{ knowledge: KnowledgeLayer; expression: ExpressionLayer }> {
  if (!llm) {
    console.warn('[backfillChineseFields] No LLM provided, skipping backfill');
    return { knowledge, expression };
  }

  const opts: BackfillOptions = {
    preserveProperNouns: options?.preserveProperNouns ?? [
      'Marcus Aurelius', 'Stoicism', 'Epictetus', 'Seneca',
      'Plato', 'Aristotle', 'Buddha', 'Dharma', 'Nirvana', 'Zen',
      'wu wei', 'Dao', '道', '无为', '法', '佛法', '涅槃',
    ],
    ...options,
  };

  const identityPromptZh = knowledge.identityPromptZh?.length > 30
    ? knowledge.identityPromptZh
    : await translateField(knowledge.identityPrompt, 'zh-CN', llm, opts);

  const mentalModels = await Promise.all(
    knowledge.mentalModels.map(async (mm) => ({
      ...mm,
      oneLinerZh: mm.oneLinerZh || await translateField(mm.oneLiner, 'zh-CN', llm, opts),
      applicationZh: mm.applicationZh || (mm.application ? await translateField(mm.application, 'zh-CN', llm, opts) : undefined),
      limitationZh: mm.limitationZh || (mm.limitation ? await translateField(mm.limitation, 'zh-CN', llm, opts) : undefined),
    }))
  );

  const decisionHeuristics = await Promise.all(
    knowledge.decisionHeuristics.map(async (h) => ({
      ...h,
      descriptionZh: h.descriptionZh || await translateField(h.description, 'zh-CN', llm, opts),
      applicationZh: h.applicationZh || (h.application ? await translateField(h.application, 'zh-CN', llm, opts) : undefined),
      exampleZh: h.exampleZh || (h.example ? await translateField(h.example, 'zh-CN', llm, opts) : undefined),
    }))
  );

  const values = await Promise.all(
    knowledge.values.map(async (v) => ({
      ...v,
      descriptionZh: v.descriptionZh || await translateField(v.description, 'zh-CN', llm, opts),
    }))
  );

  const tensions = await Promise.all(
    knowledge.tensions.map(async (t) => ({
      ...t,
      tensionZh: t.tensionZh || await translateField(t.tension, 'zh-CN', llm, opts),
      descriptionZh: t.descriptionZh || (t.description ? await translateField(t.description, 'zh-CN', llm, opts) : undefined),
    }))
  );

  let strengthsZh = knowledge.strengthsZh;
  let blindspotsZh = knowledge.blindspotsZh;

  if ((!strengthsZh || strengthsZh.length === 0) && knowledge.strengths.length > 0) {
    strengthsZh = await Promise.all(
      knowledge.strengths.map(s => translateField(s, 'zh-CN', llm, opts))
    );
  }

  if ((!blindspotsZh || blindspotsZh.length === 0) && knowledge.blindspots.length > 0) {
    blindspotsZh = await Promise.all(
      knowledge.blindspots.map(s => translateField(s, 'zh-CN', llm, opts))
    );
  }

  const honestBoundaries = await Promise.all(
    knowledge.honestBoundaries.map(async (hb) => ({
      ...hb,
      textZh: hb.textZh || await translateField(hb.text, 'zh-CN', llm, opts),
      reasonZh: hb.reasonZh || (hb.reason ? await translateField(hb.reason, 'zh-CN', llm, opts) : undefined),
    }))
  );

  return {
    knowledge: {
      ...knowledge,
      identityPromptZh,
      mentalModels: mentalModels as any,
      decisionHeuristics: decisionHeuristics as any,
      values: values as any,
      tensions: tensions as any,
      strengthsZh: strengthsZh ?? [],
      blindspotsZh: blindspotsZh ?? [],
      honestBoundaries: honestBoundaries as any,
    },
    expression: expression as any,
  };
}
