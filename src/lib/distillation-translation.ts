/**
 * Prismatic — Translation Layer
 * High-quality translation for distillation output
 *
 * Handles translation of:
 * - Knowledge layer (identityPrompt, mentalModels, values, etc.)
 * - Trilingual concept mapping
 * - Translation quality assessment
 */

import type {
  TrilingualConcept,
  SupportedLanguage,
  KnowledgeLayer,
  ExtractedMentalModel,
} from './distillation-v4-types';

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
