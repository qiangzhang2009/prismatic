/**
 * Prismatic — Layer 3: Knowledge Extraction
 * Extracts language-independent knowledge骨架 from source language corpus
 *
 * Key principle: Knowledge layer (identity, mental models, values, tensions)
 * is extracted in the source language where signal is strongest.
 * Key concepts are preserved in trilingual format: {original, english, chinese}
 */

import { nanoid } from 'nanoid';
import type {
  KnowledgeLayer,
  ExtractedMentalModel,
  ExtractedDecisionHeuristic,
  ExtractedValue,
  ExtractedTension,
  ExtractedHonestBoundary,
  TrilingualConcept,
  ExtractionPromptContext,
  ExtractionResult,
  SupportedLanguage,
  Period,
} from './distillation-v4-types';
import { autoGenerateExpressionDNA } from './expression-calibrator';

// ─── Prompt Templates ─────────────────────────────────────────────────────────────

// ─── Proper Noun Translation Reference ─────────────────────────────────────────────────

const PROPER_NOUN_GUIDE: Record<string, Record<string, string>> = {
  philosophy: {
    'Stoicism': '斯多葛主义',
    'Plato': '柏拉图',
    'Aristotle': '亚里士多德',
    'Epictetus': '爱比克泰德',
    'Marcus Aurelius': '马可·奥勒留',
    'Seneca': '塞涅卡',
    'Dharma': '法/佛法',
    'Zen': '禅',
    'wu wei': '无为',
    'Dao': '道',
    'Nagarjuna': '龙树',
    'Hegel': '黑格尔',
    'Kant': '康德',
    'Nietzsche': '尼采',
  },
  religion: {
    'Buddha': '佛陀/悉达多',
    'Dharma': '法',
    'Sangha': '僧伽',
    'Nirvana': '涅槃',
    'Samsara': '轮回',
    'Bodhi': '菩提',
    'Sunyata': '空性',
  },
};

const LANG_NAMES: Record<string, string> = {
  zh: '中文', en: '英文', la: '拉丁文', el: '古希腊文', pi: '巴利文', sa: '梵文', de: '德文', fr: '法文', ja: '日文', ko: '韩文', mixed: '混合语言',
};

function buildProperNounNote(personaId: string): string {
  const guide = PROPER_NOUN_GUIDE.philosophy; // use philosophy as default reference
  const entries = Object.entries(guide).map(([en, zh]) => `${en} -> ${zh}`).join(', ');
  return `\n【Term Translation Reference】 ${entries}\n`;
}

function buildIdentityPrompt(ctx: ExtractionPromptContext): string {
  const { corpusSample, personaId, primaryLanguage, periodContext } = ctx;

  const periodNote = periodContext
    ? `\n【Important】This corpus covers the "${periodContext.label}" period (${periodContext.startYear}-${periodContext.endYear}). ` +
      `Adapt your analysis to this specific phase of the person's thinking.\n`
    : '';

  return `You are a world-class persona distillation expert. Extract the core identity of this persona from their own writings.

${periodNote}
**Corpus Language**: ${primaryLanguage.toUpperCase()}
**Persona**: ${personaId}

${primaryLanguage === 'zh' ? '使用中文输出，同时必须填写中文版本字段。' : `使用 ${LANG_NAMES[primaryLanguage] || primaryLanguage} 输出，同时必须填写中文版本字段。`}

1. **Identity Prompt** (50-200 words): Who is this person at their core? What is their unique perspective, mission, and life purpose?

2. **Core Tension**: What is their fundamental inner conflict or contradiction that drives their thinking?

3. **Domain Tags**: What are their primary expertise areas? Choose from: philosophy, technology, investment, science, history, spirituality, business, strategy, etc.

Return as JSON:
{
  "identityPrompt": "Source-language identity description (REQUIRED)",
  "identityPromptZh": "Chinese identity description (REQUIRED — do not leave empty)",
  "coreTension": "Source-language core tension",
  "coreTensionZh": "Chinese core tension (REQUIRED — do not leave empty)",
  "domains": ["domain1", "domain2"]
}

${buildProperNounNote(personaId)}
=== CORPUS SAMPLE ===
${corpusSample.slice(0, 8000)}
=== END CORPUS ===`;
}

function buildMentalModelPrompt(ctx: ExtractionPromptContext): string {
  const { corpusSample, personaId, primaryLanguage, periodContext } = ctx;

  const periodNote = periodContext
    ? `\n【Important】Focus on mental models from the "${periodContext.label}" period (${periodContext.startYear}-${periodContext.endYear}).\n`
    : '';

  const langInstruction = primaryLanguage === 'zh'
    ? '使用中文输出'
    : `使用 ${LANG_NAMES[primaryLanguage] || primaryLanguage} 输出，同时必须填写中文版本字段。`;

  return `You are extracting the core thinking models from this persona's corpus.

${periodNote}
Extract 5-10 core mental models. Return as JSON object with key "mentalModels":

{
  "mentalModels": [
    {
      "id": "slug-id",
      "name": "Model name in source language",
      "nameZh": "中文名（如有）",
      "oneLiner": "One sentence in source language (REQUIRED)",
      "oneLinerZh": "中文单句描述（REQUIRED — 必须填写，不要为空）",
      "evidence": [{"quote": "...", "source": "..."}],
      "crossDomain": ["domain1", "domain2"],
      "application": "Application in source language",
      "applicationZh": "中文应用场景（REQUIRED — 必须填写，不要为空）",
      "limitation": "Limitation in source language",
      "limitationZh": "中文局限性（如有）",
      "keyConcepts": [{"original": "...", "english": "...", "chinese": "..."}]
    }
  ]
}

${langInstruction}
${buildProperNounNote(personaId)}
=== CORPUS SAMPLE ===
${corpusSample.slice(0, 12000)}
=== END CORPUS ===`;
}

function buildValuesPrompt(ctx: ExtractionPromptContext): string {
  const { corpusSample, primaryLanguage } = ctx;

  const langInstruction = primaryLanguage === 'zh'
    ? '使用中文输出'
    : `使用 ${LANG_NAMES[primaryLanguage] || primaryLanguage} 输出，同时必须填写中文版本字段。`;

  return `${langInstruction}

Extract the core VALUES that drive this persona's decisions and worldview.

Return JSON array with:
{
  "values": [{
    "name": "value name in source language",
    "nameZh": "中文名（REQUIRED）",
    "priority": 1-5 (1=highest priority),
    "description": "What this value means to this person",
    "descriptionZh": "中文描述（REQUIRED）"
  }],
  "tensions": [{
    "dimension": "e.g., Freedom vs Security",
    "dimensionZh": "中文维度（REQUIRED）",
    "positivePole": "e.g., Absolute freedom",
    "negativePole": "e.g., Order and safety",
    "tension": "How they navigate this tension",
    "tensionZh": "中文表述（REQUIRED）",
    "description": "Detailed description",
    "descriptionZh": "中文详细描述"
  }],
  "antiPatterns": ["Pattern this person explicitly rejects or warns against"],
  "antiPatternsZh": ["中文版（REQUIRED — 必须填写）"]
}

=== CORPUS SAMPLE ===
${corpusSample.slice(0, 6000)}
=== END CORPUS ===`;
}

function buildBoundariesPrompt(ctx: ExtractionPromptContext): string {
  const { corpusSample, personaId, primaryLanguage } = ctx;

  const langInstruction = primaryLanguage === 'zh'
    ? '使用中文输出'
    : `使用 ${LANG_NAMES[primaryLanguage] || primaryLanguage} 输出，同时必须填写中文版本字段。`;

  return `${langInstruction}

Extract this persona's intellectual boundaries - what they openly admit to NOT knowing.

Return JSON:
{
  "strengths": ["Source-language areas of deep expertise (REQUIRED)"],
  "strengthsZh": ["中文优势点列表（REQUIRED — 必须填写，不要为空）"],
  "blindspots": ["Source-language areas this person admits ignorance (REQUIRED)"],
  "blindspotsZh": ["中文盲点列表（REQUIRED — 必须填写，不要为空）"],
  "honestBoundaries": [{
    "text": "What they openly don't know or won't speculate about",
    "textZh": "中文版（REQUIRED）",
    "reason": "Why they draw this boundary",
    "reasonZh": "中文原因"
  }],
  "sources": [{
    "type": "book|interview|lecture|classical_text|...",
    "title": "Source title",
    "description": "Brief description"
  }]
}

${buildProperNounNote(personaId)}
=== CORPUS SAMPLE ===
${corpusSample.slice(0, 5000)}
=== END CORPUS ===`;
}

function buildHeuristicsPrompt(ctx: ExtractionPromptContext): string {
  const { corpusSample, personaId, primaryLanguage } = ctx;

  const langInstruction = primaryLanguage === 'zh'
    ? '使用中文输出'
    : `使用 ${LANG_NAMES[primaryLanguage] || primaryLanguage} 输出，同时必须填写中文版本字段。`;

  return `${langInstruction}

Extract 3-6 core decision heuristics - this person's rules for making decisions.

Each heuristic should be a short, actionable rule they live by.

Return JSON array:
{
  "heuristics": [{
    "id": "slug-id",
    "name": "Name in source language",
    "nameZh": "中文名（REQUIRED）",
    "description": "The rule in their own words",
    "descriptionZh": "中文描述（REQUIRED — 必须填写）",
    "application": "When and how to apply this heuristic",
    "applicationZh": "中文应用场景",
    "example": "A specific example from their life or work",
    "exampleZh": "中文例子"
  }]
}

${buildProperNounNote(personaId)}
=== CORPUS SAMPLE ===
${corpusSample.slice(0, 6000)}
=== END CORPUS ===`;
}

// ─── Extraction Functions ─────────────────────────────────────────────────────────

interface LLMCallResult {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

async function extractWithLLM<T>(
  prompt: string,
  _responseSchema: string,
  llm: any
): Promise<ExtractionResult<T>> {
  const response = await llm.chat({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nIMPORTANT: Return your response as valid JSON only, with no additional text.`,
      },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  });

  const rawText = response.content.trim();

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let data: T | null = null;
  let parseError: Error | null = null;

  // Strategy 1: Direct parse
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    parseError = e as Error;
  }

  // Strategy 2: Extract first JSON array or object
  if (data === null) {
    try {
      const jsonMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[1]);
      }
    } catch {}
  }

  // Strategy 3: Find and extract JSON after common prefixes
  if (data === null) {
    try {
      const afterReturn = rawText.match(/\{[\s\S]*$/m);
      if (afterReturn) {
        const trimmed = afterReturn[0].replace(/^[\s\S]*?\n/, '').trim();
        data = JSON.parse(trimmed);
      }
    } catch {}
  }

  // Strategy 4: Extract array of objects
  if (data === null) {
    try {
      const arrMatch = rawText.match(/\[[\s\S]*\]$/);
      if (arrMatch) {
        data = JSON.parse(arrMatch[0]);
      }
    } catch {}
  }

  if (data === null) {
    throw new Error(
      `Failed to parse JSON from LLM response after 4 fallback strategies. ` +
      `First 300 chars: ${rawText.slice(0, 300)}\nLast error: ${parseError?.message}`
    );
  }

  return {
    data,
    confidence: 0.8,
    autoFixable: true,
    warnings: [],
    llmModel: response.model ?? 'deepseek-chat',
    tokensUsed: {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
      total: response.usage?.total_tokens ?? 0,
    },
  };
}

// ─── Trilingual Concept Extraction ──────────────────────────────────────────────

function extractTrilingualConcepts(
  mentalModels: ExtractedMentalModel[],
  corpusSample: string,
  primaryLang: SupportedLanguage
): TrilingualConcept[] {
  const concepts: TrilingualConcept[] = [];
  const conceptTerms = new Set<string>();

  // Known concept terms to look for — each concept maps languages to {en, zh, de?} values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownConcepts: Record<string, any> = {
    'language-game': {
      de: 'Sprachspiel',
      en: 'language game',
      zh: '语言游戏',
    },
    'family-resemblance': {
      de: 'Familienähnlichkeit',
      en: 'family resemblance',
      zh: '家族相似性',
    },
    'form-of-life': {
      de: 'Lebensform',
      en: 'form of life',
      zh: '生活形式',
    },
    'private-language': {
      de: 'private Sprache',
      en: 'private language',
      zh: '私人语言',
    },
    'rule-following': {
      de: 'Regelbefolgung',
      en: 'rule-following',
      zh: '遵守规则',
    },
    'first-principles': {
      en: 'first principles',
      zh: '第一性原理',
    },
    'moi': {
      en: 'moi',
      zh: '小我',
    },
  };

  for (const [key, trans] of Object.entries(knownConcepts)) {
    const en = trans.en?.en?.toLowerCase() ?? '';
    const zh = trans.zh ?? '';
    const de = trans.de ?? '';

    if (
      corpusSample.toLowerCase().includes(en) ||
      corpusSample.includes(zh) ||
      (de && corpusSample.toLowerCase().includes(de))
    ) {
      concepts.push({
        original: primaryLang === 'de' ? de : en,
        english: trans.en?.en ?? en,
        chinese: trans.zh ?? zh,
      });
    }
  }

  return concepts;
}

// ─── Main Knowledge Extraction ────────────────────────────────────────────────────

export interface KnowledgeExtractionConfig {
  corpusSample: string;
  corpusSampleZh?: string;
  personaId: string;
  primaryLanguage: SupportedLanguage;
  outputLanguage: 'zh-CN' | 'en-US';
  period?: Period;
  keyConcepts?: TrilingualConcept[];
  llm: any; // LLM provider
}

export async function extractKnowledge(
  config: KnowledgeExtractionConfig
): Promise<KnowledgeLayer> {
  const {
    corpusSample,
    corpusSampleZh,
    personaId,
    primaryLanguage,
    outputLanguage,
    period,
    keyConcepts,
    llm,
  } = config;

  const ctx: ExtractionPromptContext = {
    personaId,
    route: 'uni',
    primaryLanguage,
    outputLanguage,
    corpusSample,
    corpusSampleZh: corpusSampleZh,
    keyConcepts,
    periodContext: period,
    confidenceLevel: 'balanced',
  };

  // Extract all layers in parallel
  const [identityResult, mentalModelResult, valuesResult, boundariesResult, heuristicsResult] =
    await Promise.all([
      extractWithLLM<{
        identityPrompt: string;
        identityPromptZh: string;
        coreTension: string;
        coreTensionZh: string;
        domains: string[];
      }>(buildIdentityPrompt(ctx), 'identity', llm),

      extractWithLLM<{ mentalModels: ExtractedMentalModel[] }>(
        buildMentalModelPrompt(ctx),
        'mental_models',
        llm
      ),

      extractWithLLM<{
        values: ExtractedValue[];
        tensions: ExtractedTension[];
        antiPatterns: string[];
        antiPatternsZh: string[];
      }>(buildValuesPrompt(ctx), 'values', llm),

      extractWithLLM<{
        strengths: string[];
        strengthsZh: string[];
        blindspots: string[];
        blindspotsZh: string[];
        honestBoundaries: ExtractedHonestBoundary[];
        sources: { type: string; title: string; description?: string }[];
      }>(buildBoundariesPrompt(ctx), 'boundaries', llm),

      extractWithLLM<{ heuristics: ExtractedDecisionHeuristic[] }>(
        buildHeuristicsPrompt(ctx),
        'heuristics',
        llm
      ),
    ]);

  // Extract key concepts from corpus
  const extractedConcepts = extractTrilingualConcepts(
    mentalModelResult.data.mentalModels ?? [],
    corpusSample,
    primaryLanguage
  );

  // Merge concepts
  const allConcepts = [
    ...(keyConcepts ?? []),
    ...extractedConcepts,
  ];

  // Build confidence notes
  const confidenceNotes: string[] = [];
  if (!identityResult.data.identityPrompt) confidenceNotes.push('Identity prompt empty');
  if ((mentalModelResult.data.mentalModels ?? []).length < 5) {
    confidenceNotes.push(`Mental models below target: ${mentalModelResult.data.mentalModels?.length ?? 0}/5`);
  }
  if (primaryLanguage !== 'en' && primaryLanguage !== 'zh') {
    confidenceNotes.push(`Non-standard source language: ${primaryLanguage} — translation required`);
  }

  // Determine confidence level
  const confidence: 'high' | 'medium' | 'low' =
    confidenceNotes.length === 0 ? 'high'
    : confidenceNotes.length <= 2 ? 'medium'
    : 'low';

  // Total tokens
  const totalTokens = [
    identityResult.tokensUsed.total,
    mentalModelResult.tokensUsed.total,
    valuesResult.tokensUsed.total,
    boundariesResult.tokensUsed.total,
    heuristicsResult.tokensUsed.total,
  ].reduce((a, b) => a + b, 0);

  // Defensively handle: LLM might return {mentalModels: [...]} or just [...]
  const rawMentalModels = mentalModelResult.data.mentalModels;
  const mentalModels: ExtractedMentalModel[] = Array.isArray(rawMentalModels)
    ? rawMentalModels
    : [];

  return {
    identityPrompt: identityResult.data.identityPrompt ?? '',
    identityPromptZh: identityResult.data.identityPromptZh ?? '',
    mentalModels,
    decisionHeuristics: heuristicsResult.data.heuristics ?? [],
    values: valuesResult.data.values ?? [],
    tensions: valuesResult.data.tensions ?? [],
    antiPatterns: valuesResult.data.antiPatterns ?? [],
    antiPatternsZh: valuesResult.data.antiPatternsZh ?? [],
    honestBoundaries: boundariesResult.data.honestBoundaries ?? [],
    strengths: boundariesResult.data.strengths ?? [],
    strengthsZh: boundariesResult.data.strengthsZh ?? [],
    blindspots: boundariesResult.data.blindspots ?? [],
    blindspotsZh: boundariesResult.data.blindspotsZh ?? [],
    sources: (boundariesResult.data.sources ?? []).map(s => ({
      type: s.type as any,
      title: s.title,
      description: s.description,
    })),
    keyConcepts: allConcepts,
    confidence,
    confidenceNotes,
  };
}

// ─── Knowledge-to-Persona Conversion ───────────────────────────────────────────

export function knowledgeToPersona(
  knowledge: KnowledgeLayer,
  personaId: string,
  name: string,
  nameZh: string
): Partial<import('./types').Persona> {
  return {
    id: personaId,
    slug: personaId,
    name,
    nameZh,
    nameEn: name,
    domain: [],
    tagline: knowledge.values[0]?.name ?? '',
    taglineZh: knowledge.values[0]?.nameZh ?? '',
    brief: knowledge.identityPrompt.slice(0, 200),
    briefZh: knowledge.identityPromptZh.slice(0, 200),
    mentalModels: knowledge.mentalModels.map(mm => ({
      id: mm.id || nanoid(8),
      name: mm.name,
      nameZh: mm.nameZh,
      oneLiner: mm.oneLiner,
      evidence: mm.evidence.map(e => ({
        quote: e.quote,
        source: e.source,
        year: e.year,
      })),
      crossDomain: mm.crossDomain,
      application: mm.application,
      limitation: mm.limitation,
    })),
    decisionHeuristics: knowledge.decisionHeuristics.map(dh => ({
      id: dh.id || nanoid(8),
      name: dh.name,
      nameZh: dh.nameZh,
      description: dh.description,
      application: dh.application,
      example: dh.example,
    })),
    values: knowledge.values.map(v => ({
      name: v.name,
      nameZh: v.nameZh,
      priority: v.priority,
      description: v.description,
    })),
    tensions: knowledge.tensions.map(t => ({
      dimension: t.dimension,
      tensionZh: t.tensionZh,
      description: t.description,
      descriptionZh: t.descriptionZh,
    })),
    antiPatterns: knowledge.antiPatterns,
    honestBoundaries: knowledge.honestBoundaries.map(hb => ({
      text: hb.text,
      textZh: hb.textZh,
    })),
    strengths: knowledge.strengths,
    blindspots: knowledge.blindspots,
    sources: knowledge.sources,
    researchDate: new Date().toISOString(),
    version: 'v4',
    systemPromptTemplate: '',
    identityPrompt: knowledge.identityPrompt,
  };
}
