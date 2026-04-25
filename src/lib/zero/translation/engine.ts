/**
 * Zero 蒸馏引擎 — 翻译引擎
 * 修复 v4 的 translateText no-op 问题
 *
 * 使用已知术语字典 + LLM 翻译，真正实现双语文本对齐
 */

import { LLMMessage } from '../../llm';
import { callLLMWithJSON } from '../utils/llm';
import { KnowledgeLayer, ExpressionDNA, SupportedLanguage } from '../types';
import { LLMSession } from '../utils/llm';

// =============================================================================
// Known Concept Dictionary (reused from v4, expanded)
// =============================================================================

interface ConceptEntry {
  en: string;
  zh: string;
  de?: string;
  la?: string;
  description?: string;
}

const CONCEPT_DICTIONARY: Record<string, ConceptEntry> = {
  // Wittgenstein
  'language-game': { en: 'language-game', zh: '语言游戏', de: 'Sprachspiel', description: 'Wittgenstein核心概念' },
  'family-resemblance': { en: 'family resemblance', zh: '家族相似性', de: 'Familienähnlichkeit', description: '概念通过相似性关联' },
  'form-of-life': { en: 'form of life', zh: '生活形式', de: 'Lebensform', description: '意义的基础' },
  'private-language': { en: 'private language', zh: '私人语言', la: 'lingua privata', description: '无法私有化的语言' },
  'picture-theory': { en: 'picture theory', zh: '图像理论', description: '早期命题观' },
  'language-regime': { en: 'language regime', zh: '语言体制', description: '维特根斯坦后期概念' },
  'rule-following': { en: 'rule-following', zh: '规则遵循', de: 'Regelfolgen', description: '遵守规则的不确定性' },

  // Philosophy
  'first-principles': { en: 'first principles', zh: '第一性原理', description: '从根本推导' },
  'categorical-imperative': { en: 'categorical imperative', zh: '绝对命令', de: 'kategorischer Imperativ', description: '康德伦理学核心' },
  'metaphysics': { en: 'metaphysics', zh: '形而上学', la: 'metaphysica', description: '存在之学' },
  'epistemology': { en: 'epistemology', zh: '认识论', description: '知识论' },
  'utilitarianism': { en: 'utilitarianism', zh: '功利主义', description: '最大幸福原则' },
  'existentialism': { en: 'existentialism', zh: '存在主义', description: '存在先于本质' },
  'stoicism': { en: 'Stoicism', zh: '斯多葛主义', la: 'Stoicismus', description: '古代哲学流派' },
  'eudaimonia': { en: 'eudaimonia', zh: '幸福', la: 'eudaimonia', description: '亚里士多德的幸福概念' },

  // Business / Investment
  'margin-of-safety': { en: 'margin of safety', zh: '安全边际', description: '投资的核心原则' },
  'moat': { en: 'economic moat', zh: '护城河', description: '竞争优势' },
  'circle-of-competence': { en: 'circle of competence', zh: '能力圈', description: '知道自己知道什么' },
  'value-investing': { en: 'value investing', zh: '价值投资', description: '投资策略' },
  'second-level-thinking': { en: 'second-level thinking', zh: '第二层思维', description: '超越表面的思考' },
  'inversion': { en: 'inversion', zh: '反演', description: '从目标倒推' },

  // Chinese Medicine (倪海厦)
  '六经辨证': { en: 'Six-Channel Pattern Identification', zh: '六经辨证', description: '伤寒论核心方法' },
  '经方': { en: 'classical formula', zh: '经方', description: '经典方剂' },
  '伤寒论': { en: 'Shanghan Lun (Treatise on Cold Damage)', zh: '伤寒论', description: '张仲景著作' },
  '金匮要略': { en: 'Jingui Yaolue (Essential Prescriptions)', zh: '金匮要略', description: '张仲景著作' },
  '黄帝内经': { en: 'Huangdi Neijing (Yellow Emperor)', zh: '黄帝内经', description: '中医经典' },
  '针灸': { en: 'acupuncture and moxibustion', zh: '针灸', description: '中医治疗手段' },
  '阴阳': { en: 'Yin-Yang', zh: '阴阳', description: '中医理论基础' },
  '五行': { en: 'Five Elements', zh: '五行', description: '中医理论基础' },
  '辨证论治': { en: 'pattern identification and treatment', zh: '辨证论治', description: '中医诊疗原则' },
  '表里': { en: 'exterior-interior', zh: '表里', description: '病位分类' },
  '虚实': { en: 'deficiency-excess', zh: '虚实', description: '病性分类' },
  '寒热': { en: 'cold-heat', zh: '寒热', description: '病性分类' },
  '柴胡': { en: 'Bupleurum (Chaihu)', zh: '柴胡', description: '中药' },
  '桂枝': { en: 'Cinnamon Twig (Guizhi)', zh: '桂枝', description: '中药' },
};

// =============================================================================
// Translation Engine
// =============================================================================

export interface TranslationOptions {
  targetLang: 'zh' | 'en';
  useDictionary?: boolean;
  useLLM?: boolean;
  dictionary?: Record<string, ConceptEntry>;
}

/**
 * 翻译文本：字典优先 + LLM 兜底
 */
export async function translateText(
  text: string,
  options: TranslationOptions,
  session?: LLMSession,
  phase?: string
): Promise<string> {
  const { targetLang, useDictionary = true, useLLM = true } = options;
  const dict = options.dictionary ?? CONCEPT_DICTIONARY;

  // Step 1: Apply dictionary substitutions
  if (useDictionary) {
    text = applyDictionary(text, dict, targetLang);
  }

  // Step 2: If text already contains target language at sufficient ratio, skip LLM
  const targetRatio = estimateTargetLangRatio(text, targetLang);
  if (targetRatio > 0.8) {
    return text; // Already mostly in target language
  }

  // Step 3: LLM translation for remaining content
  if (useLLM && session) {
    const remaining = extractUntranslated(text, targetLang);
    if (remaining.length > 20) {
      const translated = await translateWithLLM(remaining, targetLang, session as LLMSession, phase);
      return applyTranslations(text, remaining, translated, targetLang);
    }
  }

  return text;
}

/**
 * 回填知识层的中文字段
 */
export async function backfillChineseFields(
  knowledge: KnowledgeLayer,
  expression: ExpressionDNA,
  session?: LLMSession,
  phase = 'translation'
): Promise<{ knowledge: KnowledgeLayer; expression: ExpressionDNA }> {
  // Identity
  if (!knowledge.identityPrompt_Zh && knowledge.identity.identityPrompt) {
    knowledge.identityPrompt_Zh = await translateText(
      knowledge.identity.identityPrompt,
      { targetLang: 'zh', useDictionary: true, useLLM: !!session },
      session,
      `${phase}-identity`
    );
  }

  // Mental models
  if (!knowledge.mentalModels_Zh && knowledge.mentalModels.length > 0) {
    const translations = await Promise.all(
      knowledge.mentalModels.map(async (m) => {
        const nameZh = dictLookup(m.name, 'zh') ?? await translateWithLLM(m.name, 'zh', session as LLMSession, `${phase}-mm`);
        const descZh = dictLookup(m.description, 'zh') ?? await translateWithLLM(m.description, 'zh', session as LLMSession, `${phase}-mm-desc`);
        return { ...m, nameZh, description: descZh };
      })
    );
    knowledge.mentalModels_Zh = translations;
  }

  return { knowledge, expression };
}

// =============================================================================
// Dictionary Operations
// =============================================================================

function applyDictionary(text: string, dict: Record<string, ConceptEntry>, targetLang: 'zh' | 'en'): string {
  let result = text;

  for (const [, entry] of Object.entries(dict)) {
    const target = targetLang === 'zh' ? entry.zh : entry.en;
    if (!target) continue;

    // Replace English terms with Chinese
    const enPattern = new RegExp(`\\b${escapeRegex(entry.en)}\\b`, 'gi');
    result = result.replace(enPattern, target);

    // Replace German terms
    if (entry.de) {
      const dePattern = new RegExp(`\\b${escapeRegex(entry.de)}\\b`, 'gi');
      result = result.replace(dePattern, target);
    }
  }

  return result;
}

function dictLookup(text: string, targetLang: 'zh' | 'en'): string | null {
  for (const [, entry] of Object.entries(CONCEPT_DICTIONARY)) {
    const target = targetLang === 'zh' ? entry.zh : entry.en;
    if (!target) continue;

    if (text.toLowerCase().includes(entry.en.toLowerCase())) {
      return target;
    }
    if (entry.de && text.toLowerCase().includes(entry.de.toLowerCase())) {
      return target;
    }
  }
  return null;
}

function estimateTargetLangRatio(text: string, targetLang: 'zh' | 'en'): number {
  if (targetLang === 'zh') {
    const zhChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    return zhChars / Math.max(text.length, 1);
  } else {
    const enChars = (text.match(/[a-zA-Z]/g) ?? []).length;
    return enChars / Math.max(text.length, 1);
  }
}

function extractUntranslated(text: string, targetLang: 'zh' | 'en'): string {
  // Extract segments that are NOT yet in target language
  if (targetLang === 'zh') {
    // Find English segments
    return (text.match(/[a-zA-Z]{5,}/g) ?? []).join(' ');
  } else {
    // Find Chinese segments
    return (text.match(/[\u4e00-\u9fff]{2,}/g) ?? []).join(' ');
  }
}

async function translateWithLLM(
  text: string,
  targetLang: 'zh' | 'en',
  session?: LLMSession,
  phase?: string
): Promise<string> {
  const targetLangLabel = targetLang === 'zh' ? '中文' : '英文';
  const sourceLangLabel = targetLang === 'zh' ? '英文' : '中文';

  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: `将以下${sourceLangLabel}内容翻译为${targetLangLabel}。保持专业术语的准确性，使用该领域的标准译名。

待翻译内容：
${text}

要求：
- 人名、地名、书名等专有名词保持原样或使用通用译名
- 哲学、科学、投资等领域术语使用标准译名
- 保留原文的语气和风格
- 直接输出翻译结果，不需要解释`,
    },
  ];

  try {
    const result = await callLLMWithJSON<{ translation: string }>(messages, {
      temperature: 0.2,
      maxTokens: 2000,
    }, session ?? undefined, phase ?? 'translate');

    return result.data.translation ?? text;
  } catch {
    return text; // On LLM failure, return original
  }
}

function applyTranslations(
  original: string,
  source: string,
  translated: string,
  targetLang: 'zh' | 'en'
): string {
  // Simple approach: if we got a reasonable translation, use it
  if (translated && translated !== source) {
    return translated;
  }
  return original;
}

// =============================================================================
// Utilities
// =============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
