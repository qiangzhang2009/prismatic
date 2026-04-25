/**
 * Zero 蒸馏引擎 — 知识层蒸馏
 * 提取 identity, mentalModels, values, heuristics, tensions
 * 每个提取任务用不同的 token 限制，不再统一用 4000
 */

import { nanoid } from 'nanoid';
import { LLMMessage } from '../../llm';
import {
  KnowledgeLayer, IdentityLayer, MentalModel, CoreValue,
  DecisionHeuristic, Tension, AntiPattern, HonestBoundary, Source,
  ExtractionMetadata, SupportedLanguage
} from '../types';
import { validateKnowledgeLayer, validateArray, MentalModelSchema, CoreValueSchema, DecisionHeuristicSchema, HonestBoundarySchema, TensionSchema } from '../schema';
import { callLLMWithJSON } from '../utils/llm';
import { ZeroLogger } from '../utils/logger';
import { LLMSession } from '../utils/llm';

// =============================================================================
// Extraction Config
// =============================================================================

interface ExtractConfig {
  maxMentalModels: number;
  maxValues: number;
  maxTensions: number;
  maxHeuristics: number;
  maxSources: number;
  minEvidencePerModel: number;
  targetLanguage: SupportedLanguage;
  includeEvidence: boolean;
}

const DEFAULT_EXTRACT_CONFIG: ExtractConfig = {
  maxMentalModels: 8,
  maxValues: 6,
  maxTensions: 4,
  maxHeuristics: 5,
  maxSources: 10,
  minEvidencePerModel: 1,
  targetLanguage: 'zh',
  includeEvidence: true,
};

// =============================================================================
// Main Extractor
// =============================================================================

/**
 * 从语料中提取完整知识层
 */
export async function extractKnowledgeLayer(
  corpusSample: string,
  personaName: string,
  personaContext: string,
  config: Partial<ExtractConfig> = {},
  session?: LLMSession,
  logger?: ZeroLogger,
  phase = 'knowledge'
): Promise<{ knowledge: KnowledgeLayer; metadata: ExtractionMetadata }> {
  const cfg = { ...DEFAULT_EXTRACT_CONFIG, ...config };
  const startTime = Date.now();
  let llmCalls = 0;

  if (logger) logger.info(`Extracting knowledge layer for ${personaName}`, { cfg });

  // Build system prompt
  const systemPrompt = buildKnowledgeSystemPrompt(personaName, personaContext, cfg);

  // Run all extractions in parallel (each with appropriate token limits)
  const [
    identityResult,
    mentalModelResult,
    valuesResult,
    heuristicsResult,
    boundariesResult,
    tensionsResult,
  ] = await Promise.allSettled([
    extractIdentity(corpusSample, personaName, systemPrompt, phase, session, logger),
    extractMentalModels(corpusSample, personaName, systemPrompt, cfg, phase, session, logger),
    extractValues(corpusSample, personaName, systemPrompt, cfg, phase, session, logger),
    extractHeuristics(corpusSample, personaName, systemPrompt, cfg, phase, session, logger),
    extractBoundaries(corpusSample, personaName, systemPrompt, phase, session, logger),
    extractTensions(corpusSample, personaName, systemPrompt, cfg, phase, session, logger),
  ]);

  // Collect results
  const identity = identityResult.status === 'fulfilled' ? identityResult.value : makeEmptyIdentity(personaName);
  const mentalModels = mentalModelResult.status === 'fulfilled' ? mentalModelResult.value : [];
  const values = valuesResult.status === 'fulfilled' ? valuesResult.value : [];
  const heuristics = heuristicsResult.status === 'fulfilled' ? heuristicsResult.value : [];
  const boundaries = boundariesResult.status === 'fulfilled' ? boundariesResult.value : [];
  const explicitTensions = tensionsResult.status === 'fulfilled' ? tensionsResult.value : [];

  // Debug: log individual extraction outcomes
  if (logger) {
    for (const [name, result] of [
      ['identity', identityResult],
      ['mentalModels', mentalModelResult],
      ['values', valuesResult],
      ['heuristics', heuristicsResult],
      ['boundaries', boundariesResult],
      ['tensions', tensionsResult],
    ] as const) {
      if (result.status === 'rejected') {
        logger.warn(`[extract] ${name} extraction failed: ${result.reason}`);
      } else {
        logger.info(`[extract] ${name} OK (${Array.isArray(result.value) ? result.value.length : 'object'})`);
      }
    }
  }

  // Combine explicit LLM extraction with inference
  const inferredTensions = extractTensionsFromModels(mentalModels, values);
  let tensions = explicitTensions;
  if (tensions.length < 2) {
    tensions = mergeTensions(tensions, inferredTensions);
  }

  // Extract anti-patterns
  const antiPatterns = extractAntiPatternsFromModels(mentalModels, values, heuristics);

  // Infer strengths and blindspots
  const strengths = inferStrengths(mentalModels);
  const blindspots = inferBlindspots(boundaries, mentalModels);

  // Extract sources
  const sources = extractSources(mentalModels, cfg.maxSources);

  // Calculate overall confidence
  const confidence = calculateKnowledgeConfidence(identity, mentalModels, values, heuristics, boundaries, tensions);

  llmCalls = 5; // 5 parallel calls

  const knowledge: KnowledgeLayer = {
    identity,
    mentalModels,
    values,
    decisionHeuristics: heuristics,
    tensions,
    antiPatterns,
    honestBoundaries: boundaries,
    strengths,
    blindspots,
    sources,
    confidence,
    extractionMetadata: {
      corpusWordCount: corpusSample.length,
      sampleWordCount: Math.min(corpusSample.length, 50000),
      extractionDate: new Date().toISOString(),
      extractionDurationMs: Date.now() - startTime,
      llmCalls,
      costUSD: 0, // filled by session
      tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      version: 'zero-v1',
    },
  };

  // Validate output
  const validation = validateKnowledgeLayer(knowledge);
  if (!validation.success) {
    if (logger) logger.warn(`KnowledgeLayer validation issues: ${validation.error}`);
  }

  if (logger) logger.info(`Extracted knowledge: ${mentalModels.length} models, ${values.length} values`);

  return { knowledge, metadata: knowledge.extractionMetadata };
}

// =============================================================================
// Identity Extraction
// =============================================================================

async function extractIdentity(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<IdentityLayer> {
  const userPrompt = `从以下语料中提取${personaName}的核心身份信息。

语料样本（前${Math.min(corpusSample.length, 8000)}字）：
${corpusSample.slice(0, 8000)}

请以JSON格式输出，包含以下字段：
{
  "identityPrompt": "一段50-150字的身份描述，用第二人称'你是...'开头，描述此人的核心身份、专业领域、独特视角和交流风格",
  "oneLineSummary": "一句话概括此人的核心身份（15-30字）",
  "threeLineBio": "三行传记：第一行出生/背景，第二行主要成就，第三行核心贡献",
  "coreClaim": "此人最核心的主张或观点是什么？用一句话表述",
  "uniquePerspective": "此人与同类人物相比，最独特的视角或立场是什么？",
  "confidence": 对提取质量的信心，0-1之间
}

注意：identityPrompt 必须以"你是"或"You are"开头，用于作为AI的身份设定。`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const result = await callLLMWithJSON<Partial<IdentityLayer>>(messages, {
    temperature: 0.3,
    maxTokens: 2000,
  }, session ?? undefined, `${phase}-identity`);

  return {
    identityPrompt: result.data.identityPrompt ?? `${personaName}是一位重要思想人物。`,
    oneLineSummary: result.data.oneLineSummary ?? `关于${personaName}的一句话描述。`,
    threeLineBio: result.data.threeLineBio ?? '',
    coreClaim: result.data.coreClaim ?? '',
    uniquePerspective: result.data.uniquePerspective ?? '',
    originStory: result.data.originStory,
    confidence: result.data.confidence ?? 0.5,
  };
}

// =============================================================================
// Corpus Type Detection (adapt extraction strategy)
// =============================================================================

export type CorpusType = 'clinical' | 'theoretical' | 'mixed' | 'unknown';

/**
 * 检测语料类型，自动适配提取策略
 * - clinical: 医案记录、诊疗日志、临床案例
 * - theoretical: 哲学著作、理论教材、论文
 * - mixed: 混合类型
 */
export function detectCorpusType(text: string): CorpusType {
  const sample = text.slice(0, 5000);

  // Clinical markers (using string match instead of regex to avoid ] issues in char classes)
  const clinicalScore =
    (sample.match(/来|诊|因|脉|舌|诊|诊|断|方|药|处|复诊/g) ?? []).length +
    (sample.match(/倪|医|师|病|人|初诊|复诊/g) ?? []).length +
    (sample.match(/桂枝汤|麻黄汤|小柴胡|四逆汤/g) ?? []).length +
    (sample.match(/脉浮|脉沉|舌红|苔黄/g) ?? []).length;

  // Theoretical markers
  const theoreticalScore =
    (sample.match(/理|论|原|理|论|证|论|述|观|点/g) ?? []).length +
    (sample.match(/哲|学|思|想|方|法|论|认|识|论/g) ?? []).length +
    (sample.match(/概|念|定|义|范|畴|体|系/g) ?? []).length +
    (sample.match(/\btherefore\b|\bthus\b|\bhence\b|\bconsequently\b/gi)?.length ?? 0);

  // Mixed indicators
  const mixedScore =
    (sample.match(/案|例|说|明|讲|解/g) ?? []).length +
    (sample.match(/比|如|说|例|如|可|见/g) ?? []).length;

  // Source type indicators
  const isClinicalDoc =
    text.includes('病案紀錄') ||
    text.includes('倪醫師') ||
    text.includes('初診日期') ||
    text.includes('來診原因') ||
    text.includes('處方') ||
    text.includes('复诊日期');

  const isTheoreticalDoc =
    text.includes('第') && text.includes('篇') && text.includes('论') ||
    text.includes('第一章') ||
    text.includes('第二节') ||
    /^\d+\./.test(text);

  if (isClinicalDoc || clinicalScore >= 8) return 'clinical';
  if (isTheoreticalDoc && theoreticalScore >= 3) return 'theoretical';
  if (clinicalScore >= 5 || mixedScore >= 5) return 'mixed';
  return 'unknown';
}

// =============================================================================
// Mental Model Extraction (corpus-adaptive)
// =============================================================================

async function extractMentalModels(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  cfg: ExtractConfig,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<MentalModel[]> {
  const corpusType = detectCorpusType(corpusSample);
  if (logger) logger.info(`Detected corpus type: ${corpusType} for mental model extraction`);

  // Build corpus-adaptive prompt
  const promptByType = buildMentalModelPrompt(corpusSample, personaName, cfg, corpusType);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: promptByType },
  ];

  const MAX_RETRIES = 3;
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await callLLMWithJSON<Partial<{ mentalModels: MentalModel[]; models: MentalModel[]; items: MentalModel[] }>>(messages, {
        temperature: 0.2 + attempt * 0.15,
        maxTokens: 8000,
      }, session ?? undefined, `${phase}-mental-models`);

      // Accept multiple response shapes (LLM may return bare array, {mentalModels}, {models}, {items}, etc.)
      // normalizeKeys preserves arrays as arrays, so result.data could be a bare array directly
      const rawData = result.data as unknown;
      let rawModels: unknown[] | undefined;

      // Direct array check (most common when LLM returns just [...])
      if (Array.isArray(rawData)) {
        rawModels = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        // Check named keys
        rawModels =
          (rawData as { mentalModels?: unknown[] }).mentalModels ??
          (rawData as { models?: unknown[] }).models ??
          (rawData as { items?: unknown[] }).items ??
          undefined;
      }

      if (!Array.isArray(rawModels)) {
        if (logger) logger.warn(`mentalModels: LLM returned non-array (attempt ${attempt + 1}): keys=${typeof rawData === 'object' && rawData !== null ? Object.keys(rawData as object).slice(0, 5).join(',') : typeof rawData}`);
        if (attempt < MAX_RETRIES - 1) continue;
        return [];
      }

      if (rawModels.length === 0 && attempt < MAX_RETRIES - 1) {
        if (logger) logger.warn(`mentalModels: 0 items (attempt ${attempt + 1}), retrying`);
        continue;
      }

      // Normalize and validate
      const normalized = normalizeMentalModels(rawModels);
      const { valid, invalid } = validateArray(normalized, MentalModelSchema, 'mentalModel');

      if (logger) logger.info(`mentalModels: ${valid.length} valid, ${invalid.length} invalid of ${rawModels.length} returned`);

      if (valid.length === 0 && attempt < MAX_RETRIES - 1) continue;

      return valid.map((m, i) => ({
        ...m,
        id: m.id ?? `mm-${i + 1}`,
        name: m.name ?? `思维模型 ${i + 1}`,
        oneLiner: m.oneLiner ?? '从语料中提取的思维模型',
        description: m.description ?? m.oneLiner ?? '此模型的具体内容待完善',
        application: m.application ?? '',
        crossDomain: Array.isArray(m.crossDomain) ? m.crossDomain : [],
        evidence: Array.isArray(m.evidence) ? m.evidence : [],
        sourceReferences: Array.isArray(m.sourceReferences) ? m.sourceReferences : [],
        confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
      } as MentalModel));
    } catch (err) {
      lastError = String(err).slice(0, 300);
      if (logger) logger.warn(`mentalModels: attempt ${attempt + 1} failed: ${lastError}`);
    }
  }

  if (logger) logger.warn(`mentalModels: all ${MAX_RETRIES} attempts failed. Last error: ${lastError}`);
  return [];
}

/**
 * Build mental model prompt based on corpus type
 */
function buildMentalModelPrompt(
  corpusSample: string,
  personaName: string,
  cfg: ExtractConfig,
  corpusType: CorpusType
): string {
  const sample = corpusSample.slice(0, 20000);
  const count = cfg.maxMentalModels;

  if (corpusType === 'clinical') {
    return `从以下临床医案语料中提取${personaName}的核心诊疗思维模式（Mental Models）。

这是临床医案记录，包含患者主诉、症状、诊断、处方等信息。
请从中提取${personaName}的诊疗思维模式——即在面对具体病例时，他/她的诊断逻辑、处方思路和治疗原则。

语料样本：
${sample}

请提取 ${count} 个核心诊疗思维模式，每个包含：
{
  "id": "mm-序号",
  "name": "思维模式名称（如：六经辨证思维、经方优先思维）",
  "nameZh": "中文名称",
  "nameEn": "英文名称（如有）",
  "oneLiner": "一句话描述（15-30字）",
  "description": "详细描述：此思维模式的核心逻辑、适用范围、如何应用（100-200字）",
  "application": "在临床中如何应用此思维模式",
  "crossDomain": ["跨领域应用或相关经典理论（如：伤寒论、金匮要略）"],
  "evidence": [
    {"quote": "来自语料的引用（原文片段，30字以上）", "source": "来源（病案号/教材名）", "context": "上下文（可选）"}
  ],
  "confidence": 置信度0-1
}

要求：
- 从真实语料中提取，不要编造
- evidence 的 quote 必须是语料中的原文
- 如果语料是临床医案，重点关注：辨证思路、处方原则、用药规律、预后判断`;
  }

  if (corpusType === 'theoretical') {
    return `从以下理论著作中提取${personaName}的核心思维模型（Mental Models）。

语料样本：
${sample}

请提取 ${count} 个核心思维模型，每个包含：
{
  "id": "mm-序号",
  "name": "模型名称",
  "nameZh": "中文名称（如有）",
  "nameEn": "英文名称（如有）",
  "oneLiner": "一句话描述（15-30字）",
  "description": "100-200字详细描述：此模型的核心思想、为什么重要、如何应用",
  "application": "描述此模型在实际场景中如何应用",
  "crossDomain": ["跨领域应用1", "跨领域应用2"],
  "evidence": [
    {"quote": "来自语料的引用（30字以上）", "source": "来源名称", "context": "引用上下文（可选）"}
  ],
  "limitations": "此模型的局限性或边界条件（可选）",
  "confidence": 置信度0-1
}

要求：
- 从语料中提取真实引用，不要编造
- crossDomain 至少 2 个
- 重点提取原创性思想、核心论点、分析框架`;
  }

  // Default / mixed: try both approaches
  return `从以下语料中提取${personaName}的核心思想或诊疗思维（Mental Models）。

这是${personaName}的著作或记录，可以是理论著作、临床医案、教学讲解等不同类型。

语料样本：
${sample}

请提取 ${count} 个核心思想/思维模式，每个包含：
{
  "id": "mm-序号",
  "name": "名称",
  "nameZh": "中文名称（如有）",
  "nameEn": "英文名称（如有）",
  "oneLiner": "一句话描述（15-30字）",
  "description": "详细描述（100-200字）",
  "application": "应用场景",
  "crossDomain": ["跨领域1", "跨领域2"],
  "evidence": [
    {"quote": "原文引用（30字以上）", "source": "来源", "context": "上下文（可选）"}
  ],
  "confidence": 置信度0-1
}

要求：从真实语料中提取，不要编造`;
}

/**
 * Normalize different LLM response shapes to consistent MentalModel format
 */
function normalizeMentalModels(raw: unknown[]): Partial<MentalModel>[] {
  return raw.map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      id: typeof obj.id === 'string' ? obj.id : undefined,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      nameZh: typeof obj.nameZh === 'string' ? obj.nameZh : undefined,
      nameEn: typeof obj.nameEn === 'string' ? obj.nameEn : undefined,
      oneLiner: typeof obj.oneLiner === 'string' ? obj.oneLiner :
                 typeof obj.oneliner === 'string' ? obj.oneliner :
                 typeof obj.summary === 'string' ? obj.summary : undefined,
      description: typeof obj.description === 'string' ? obj.description :
                   typeof obj.desc === 'string' ? obj.desc : undefined,
      application: typeof obj.application === 'string' ? obj.application :
                  typeof obj.howToApply === 'string' ? obj.howToApply : undefined,
      crossDomain: Array.isArray(obj.crossDomain) ? obj.crossDomain as string[] :
                   Array.isArray(obj.domains) ? obj.domains as string[] :
                   Array.isArray(obj.applications) ? obj.applications as string[] : undefined,
      evidence: normalizeEvidence(obj.evidence),
      sourceReferences: Array.isArray(obj.sourceReferences) ? obj.sourceReferences as string[] :
                       Array.isArray(obj.sources) ? obj.sources as string[] : undefined,
      limitations: typeof obj.limitations === 'string' ? obj.limitations : undefined,
      period: typeof obj.period === 'string' ? obj.period : undefined,
      confidence: typeof obj.confidence === 'number' ? obj.confidence :
                  typeof obj.score === 'number' ? obj.score : undefined,
    };
  });
}

function normalizeEvidence(raw: unknown): MentalModel['evidence'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      const obj = e as Record<string, unknown>;
      if (typeof obj === 'object' && obj !== null) {
        return {
          quote: typeof obj.quote === 'string' ? obj.quote :
                 typeof obj.text === 'string' ? obj.text :
                 typeof obj.content === 'string' ? obj.content : String(obj),
          source: typeof obj.source === 'string' ? obj.source :
                  typeof obj.reference === 'string' ? obj.reference : '',
          year: typeof obj.year === 'number' ? obj.year :
                typeof obj.year === 'string' ? parseInt(obj.year) : undefined,
          page: typeof obj.page === 'string' ? obj.page : undefined,
          context: typeof obj.context === 'string' ? obj.context :
                   typeof obj.background === 'string' ? obj.background : undefined,
        };
      }
      return { quote: String(e), source: '', year: undefined, page: undefined, context: undefined };
    })
    .filter((e) => e.quote.length >= 5);
}

// =============================================================================
// Values Extraction
// =============================================================================

/**
 * 从语料中提取核心价值观（Core Values）
 * 根据语料类型自动适配 prompt
 */
async function extractValues(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  cfg: ExtractConfig,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<CoreValue[]> {
  const corpusType = detectCorpusType(corpusSample);
  const sample = corpusSample.slice(0, 15000);

  let userPrompt: string;
  if (corpusType === 'clinical') {
    userPrompt = `从以下临床医案和教学语料中提取${personaName}的核心价值观和行医理念（Core Values）。

这些价值观体现在其临床实践和教学中的原则性立场。

语料样本：
${sample}

请提取 ${cfg.maxValues} 个核心价值观/理念，每个包含：
{
  "id": "val-序号",
  "name": "价值观名称（简洁，3-8字）",
  "nameZh": "中文名称",
  "nameEn": "英文名称（如有）",
  "description": "50-100字描述此价值观的含义及在临床实践中的体现",
  "priority": 优先级（1=最高）,
  "manifestedIn": ["此价值观在哪些临床案例或教学中体现"],
  "tension": "与此价值观构成张力的另一个理念（如有）",
  "confidence": 置信度0-1
}`;
  } else {
    userPrompt = `从以下语料中提取${personaName}的核心价值观（Core Values）。

语料样本（前${Math.min(corpusSample.length, 12000)}字）：
${sample}

请提取 ${cfg.maxValues} 个核心价值观，每个包含：
{
  "id": "val-序号",
  "name": "价值观名称（简洁，3-8字）",
  "nameZh": "中文名称（如有）",
  "nameEn": "英文名称（如有）",
  "description": "50-100字描述此价值观的含义及其在${personaName}思想中的地位",
  "priority": 优先级（1=最高，数字越大优先级越低）,
  "manifestedIn": ["此价值观在哪些行为或著作中体现"],
  "tension": "与此价值观构成张力的另一个价值观（如有）",
  "confidence": 对提取质量的信心，0-1之间
}`;
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await callLLMWithJSON<Partial<{ values: CoreValue[]; coreValues: CoreValue[]; items: CoreValue[] }>>(messages, {
        temperature: 0.2 + attempt * 0.15,
        maxTokens: 2500,
      }, session ?? undefined, `${phase}-values`);

      const rawResult = result.data as unknown;
      let rawValues: unknown[] | undefined;

      if (Array.isArray(rawResult)) {
        rawValues = rawResult;
      } else if (typeof rawResult === 'object' && rawResult !== null) {
        rawValues =
          (rawResult as { values?: unknown[] }).values ??
          (rawResult as { coreValues?: unknown[] }).coreValues ??
          (rawResult as { items?: unknown[] }).items ??
          undefined;
      }

      if (!Array.isArray(rawValues)) {
        if (attempt < MAX_RETRIES - 1) continue;
        return [];
      }
      if (rawValues.length === 0 && attempt < MAX_RETRIES - 1) continue;

      const { valid } = validateArray(rawValues, CoreValueSchema, 'coreValue');
      if (valid.length === 0 && attempt < MAX_RETRIES - 1) continue;

      return (valid.map((v, i) => ({
        ...v,
        id: v.id ?? `val-${i + 1}`,
        name: v.name ?? `价值观 ${i + 1}`,
        description: v.description ?? '此价值观的具体描述待完善',
        priority: typeof v.priority === 'number' ? v.priority : i + 1,
        manifestedIn: Array.isArray(v.manifestedIn) ? v.manifestedIn : [],
        confidence: typeof v.confidence === 'number' ? v.confidence : 0.5,
      } as CoreValue)));
    } catch (err) {
      if (logger) logger.warn(`values extraction failed (attempt ${attempt + 1}): ${String(err).slice(0, 200)}`);
    }
  }
  return [];
}

// =============================================================================
// Decision Heuristics Extraction
// =============================================================================

async function extractHeuristics(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  cfg: ExtractConfig,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<DecisionHeuristic[]> {
  const userPrompt = `从以下语料中提取${personaName}的决策启发式（Decision Heuristics）。

这些是${personaName}在面对决策时常用的心理模型或思维捷径。

语料样本（前${Math.min(corpusSample.length, 12000)}字）：
${corpusSample.slice(0, 12000)}

请提取 ${cfg.maxHeuristics} 个决策启发式，每个包含：
{
  "id": "heur-序号",
  "name": "启发式名称（简洁）",
  "nameZh": "中文名称（如有）",
  "nameEn": "英文名称（如有）",
  "description": "50-100字描述此启发式的核心逻辑",
  "applicationScenario": "在什么场景下${personaName}会使用此启发式",
  "example": "一个具体的使用例子（可选）",
  "sourceReferences": ["参考来源1", "来源2"],
  "confidence": 对提取质量的信心，0-1之间
}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await callLLMWithJSON<Partial<{ decisionHeuristics: DecisionHeuristic[] }>>(messages, {
        temperature: 0.3 + attempt * 0.2,
        maxTokens: 3000,
      }, session ?? undefined, `${phase}-heuristics`);

      // Accept multiple response shapes
      const rawData = result.data as unknown;
      let rawHeuristics: unknown[] | undefined;
      if (Array.isArray(rawData)) {
        rawHeuristics = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        rawHeuristics =
          (rawData as { decisionHeuristics?: unknown[] }).decisionHeuristics ??
          (rawData as { heuristics?: unknown[] }).heuristics ??
          (rawData as { items?: unknown[] }).items ??
          undefined;
      }
      if (!Array.isArray(rawHeuristics)) {
        if (logger) logger.warn(`heuristics: LLM returned non-array (attempt ${attempt + 1})`);
        if (attempt < MAX_RETRIES - 1) continue;
        return [];
      }
      if (rawHeuristics.length === 0 && attempt < MAX_RETRIES - 1) continue;

      // Heuristics must have name, nameZh, or nameEn
      const filtered = rawHeuristics.filter((h: unknown) => {
        const hObj = h as Record<string, unknown>;
        return !!(hObj && (hObj.name || hObj.nameZh || hObj.nameEn || hObj.description));
      });

      const { valid } = validateArray(filtered, DecisionHeuristicSchema, 'decisionHeuristic');
      if (valid.length === 0 && attempt < MAX_RETRIES - 1) continue;

      return (valid.map((h, i) => ({
        ...h,
        id: h.id ?? `heur-${i + 1}`,
        name: h.name ?? `决策启发式 ${i + 1}`,
        description: h.description ?? '此启发式的具体描述待完善',
        applicationScenario: String(h.applicationScenario ?? '在决策场景中应用'),
        sourceReferences: h.sourceReferences ?? [],
        confidence: h.confidence ?? 0.5,
      } as DecisionHeuristic)));
    } catch (err) {
      if (logger) logger.warn(`heuristics extraction failed (attempt ${attempt + 1}): ${String(err).slice(0, 200)}`);
    }
  }
  return [];
}

// =============================================================================
// Honest Boundaries Extraction
// =============================================================================

async function extractBoundaries(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<HonestBoundary[]> {
  const userPrompt = `从以下语料中提取${personaName}的诚实边界（Honest Boundaries）。

这些是${personaName}明确表示"我不知道"、"这超出我的专业范围"或"我不愿猜测"的领域。

语料样本（前${Math.min(corpusSample.length, 8000)}字）：
${corpusSample.slice(0, 8000)}

请提取 2-4 个诚实边界，每个包含：
{
  "id": "boundary-序号",
  "description": "描述这个边界：这个领域的问题${personaName}会如何回应",
  "reason": "为什么这是${personaName}的边界：是因为知识不足、价值观选择、还是其他原因",
  "confidence": 对提取质量的信心，0-1之间
}`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await callLLMWithJSON<Partial<{ honestBoundaries: HonestBoundary[] }>>(messages, {
        temperature: 0.3 + attempt * 0.15,
        maxTokens: 2000,
      }, session ?? undefined, `${phase}-boundaries`);

      const rawData = result.data as unknown;
      let rawBoundaries: unknown[] | undefined;
      if (Array.isArray(rawData)) {
        rawBoundaries = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        rawBoundaries =
          (rawData as { honestBoundaries?: unknown[] }).honestBoundaries ??
          (rawData as { boundaries?: unknown[] }).boundaries ??
          (rawData as { items?: unknown[] }).items ??
          undefined;
      }
      if (!Array.isArray(rawBoundaries)) {
        if (logger) logger.warn(`boundaries: LLM returned non-array (attempt ${attempt + 1})`);
        if (attempt < MAX_RETRIES - 1) continue;
        return [];
      }

      const { valid } = validateArray(rawBoundaries, HonestBoundarySchema, 'honestBoundary');
      if (valid.length === 0 && attempt < MAX_RETRIES - 1) continue;

      return (valid.map((b, i) => ({
        ...b,
        id: b.id ?? `boundary-${i + 1}`,
        description: b.description ?? '此边界的具体描述待完善',
        reason: b.reason ? String(b.reason) : '此边界的原因待完善',
        confidence: b.confidence ?? 0.5,
      } as HonestBoundary)));
    } catch (err) {
      if (logger) logger.warn(`boundaries extraction failed (attempt ${attempt + 1}): ${String(err).slice(0, 200)}`);
    }
  }
  return [];
}

// =============================================================================
// Dedicated Tension Extraction
// =============================================================================

async function extractTensions(
  corpusSample: string,
  personaName: string,
  systemPrompt: string,
  cfg: ExtractConfig,
  phase: string,
  session?: LLMSession,
  logger?: ZeroLogger
): Promise<Tension[]> {
  const sample = corpusSample.slice(0, 12000);

  const userPrompt = `从以下语料中识别${personaName}思想中最核心的内在张力（Internal Tensions）。

内在张力是指同一个人思想中存在的两个相互矛盾但都真实的原则、价值观或优先级。
${personaName}的思想中一定存在这样的张力——找到它们。

语料样本：
${sample}

请提取 ${cfg.maxTensions} 个核心张力，每个包含：
{
  "id": "tension-序号",
  "dimension": "张力维度名称（如：理论 vs 实践）",
  "positivePole": "正极：这一端的核心主张",
  "negativePole": "负极：与正极矛盾的另一端主张",
  "description": "详细描述这个张力的具体表现，以及为什么两者之间存在矛盾（100-150字）",
  "howTheyNavigate": "面对这个张力时，${personaName} 如何做出选择或平衡？是否有所偏重？",
  "confidence": 对提取质量的信心，0-1之间
}

注意：张力必须是真实的内在矛盾，不是与外部的对立。`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await callLLMWithJSON<Partial<{ tensions: Tension[]; items: Tension[] }>>(messages, {
        temperature: 0.3 + attempt * 0.15,
        maxTokens: 3000,
      }, session ?? undefined, `${phase}-tensions`);

      const rawData = result.data as unknown;
      let rawTensions: unknown[] | undefined;

      if (Array.isArray(rawData)) {
        rawTensions = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        rawTensions =
          (rawData as { tensions?: unknown[] }).tensions ??
          (rawData as { items?: unknown[] }).items ??
          undefined;
      }

      if (!Array.isArray(rawTensions)) {
        if (logger) logger.warn(`tensions: LLM returned non-array (attempt ${attempt + 1})`);
        if (attempt < MAX_RETRIES - 1) continue;
        return [];
      }

      const valid = rawTensions
        .map((t, i) => {
          const obj = t as Record<string, unknown>;
          return {
            id: typeof obj.id === 'string' ? obj.id : `tension-${i + 1}`,
            dimension: String(obj.dimension ?? `张力 ${i + 1}`),
            positivePole: String(obj.positivePole ?? obj.positive ?? '待提取'),
            negativePole: String(obj.negativePole ?? obj.negative ?? '待提取'),
            description: String(obj.description ?? ''),
            howTheyNavigate: String(obj.howTheyNavigate ?? '待提取'),
            confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
          } as Tension;
        })
        .filter((t) => t.dimension && t.description.length > 10);
    } catch (err) {
      if (logger) logger.warn(`tensions extraction failed (attempt ${attempt + 1}): ${String(err).slice(0, 200)}`);
    }
  }
  return [];
}

function mergeTensions(explicit: Tension[], inferred: Tension[]): Tension[] {
  // Deduplicate by dimension similarity
  const seen = new Set<string>();
  const merged: Tension[] = [...explicit];

  for (const t of inferred) {
    const dimKey = t.dimension.toLowerCase();
    const isDupe = merged.some(
      (m) =>
        m.dimension.toLowerCase().includes(dimKey) ||
        dimKey.includes(m.dimension.toLowerCase())
    );
    if (!isDupe && !seen.has(dimKey)) {
      merged.push(t);
      seen.add(dimKey);
    }
  }

  return merged.slice(0, 4);
}

// =============================================================================
// Helpers
// =============================================================================

function buildKnowledgeSystemPrompt(personaName: string, context: string, cfg: ExtractConfig): string {
  return `你是一位知识蒸馏专家，负责从文本语料中提取人物的核心知识结构。

你的任务是提取 ${personaName} 的知识层数据。

背景信息：${context || '无'}

重要原则：
1. 只从语料中提取真实存在的内容，不要编造
2. 所有引用必须有具体的语料来源
3. 思维模型必须有关键引用证据
4. 优先提取高质量、有代表性的内容
5. 输出必须是合法的 JSON 格式
6. 所有文本字段使用 ${cfg.targetLanguage === 'zh' ? '中文' : '英文'} 输出`;
}

function extractTensionsFromModels(mentalModels: MentalModel[], values: CoreValue[]): Tension[] {
  // Infer tensions from values
  const tensions: Tension[] = [];
  for (const value of values) {
    if (value.tension) {
      tensions.push({
        id: `tension-${tensions.length + 1}`,
        dimension: `${value.name} vs ${value.tension}`,
        positivePole: value.name,
        negativePole: value.tension,
        description: `${value.name}与${value.tension}之间的张力是${value.name}思想中的核心矛盾。`,
        howTheyNavigate: `${value.name}是${value.name}的首选，但${value.tension}也需要在特定场景下考虑。`,
        confidence: value.confidence * 0.8,
      });
    }
  }
  return tensions.slice(0, 4);
}

function extractAntiPatternsFromModels(
  mentalModels: MentalModel[],
  values: CoreValue[],
  heuristics: DecisionHeuristic[]
): AntiPattern[] {
  const patterns: AntiPattern[] = [];

  // From mental model limitations
  for (const m of mentalModels) {
    if (m.limitations) {
      patterns.push({
        id: `anti-mm-${patterns.length + 1}`,
        description: `过度依赖${m.name}而忽视其局限性`,
        examples: [`在${m.limitations}的场景中机械套用${m.name}`],
        whyTheyAvoid: `${m.name}模型有其适用边界。过度依赖会导致在边界之外产生误判。`,
        confidence: (m.confidence ?? 0.5) * 0.7,
      });
    }
  }

  // From value tensions (what happens when one value overpowers the other)
  for (const v of values) {
    if (v.tension) {
      patterns.push({
        id: `anti-val-${patterns.length + 1}`,
        description: `在${v.name}上走极端而忽视${v.tension}的风险`,
        examples: [`过度强调${v.name}而完全否定${v.tension}的合理性`],
        whyTheyAvoid: `${v.name}与${v.tension}之间需要平衡。走极端会导致失衡。`,
        confidence: (v.confidence ?? 0.5) * 0.6,
      });
    }
  }

  // From heuristics (common misapplications)
  for (const h of heuristics) {
    if (h.example) {
      patterns.push({
        id: `anti-heur-${patterns.length + 1}`,
        description: `机械套用${h.name}启发式而忽视具体情境`,
        examples: [h.example],
        whyTheyAvoid: `启发式是对复杂决策的简化。机械套用会忽视具体情境中的重要差异。`,
        confidence: (h.confidence ?? 0.5) * 0.5,
      });
    }
  }

  // General anti-patterns (from common knowledge)
  const generalAnti = [
    {
      description: '不假思索地套用现成答案而跳过独立思考',
      examples: ['直接引用权威而不加验证', '把别人的观点当作自己的'],
      whyTheyAvoid: '跳过独立思考等于放弃了智慧成长的机会',
    },
    {
      description: '将局部经验泛化为普适真理',
      examples: ['把特定情境下的结论应用到所有场景', '以偏概全'],
      whyTheyAvoid: '没有考虑到情境的差异会导致误判',
    },
  ];

  if (patterns.length < 2) {
    for (const anti of generalAnti) {
      patterns.push({
        id: `anti-gen-${patterns.length + 1}`,
        ...anti,
        confidence: 0.5,
      });
    }
  }

  return patterns.slice(0, 5);
}

function inferStrengths(mentalModels: MentalModel[]): string[] {
  return mentalModels.slice(0, 5).map((m) => `${m.name}：${m.oneLiner}`);
}

function inferBlindspots(boundaries: HonestBoundary[], mentalModels: MentalModel[]): string[] {
  const blindspots = boundaries.map((b) => b.description);
  // Add inferred blindspots from models
  for (const m of mentalModels.slice(0, 3)) {
    if (m.limitations) {
      blindspots.push(`过度依赖${m.name}的风险`);
    }
  }
  return Array.from(new Set(blindspots)).slice(0, 5);
}

function extractSources(mentalModels: MentalModel[], max: number): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];

  for (const m of mentalModels) {
    for (const ev of m.evidence) {
      if (ev.source && !seen.has(ev.source)) {
        seen.add(ev.source);
        sources.push({
          id: `src-${sources.length + 1}`,
          title: ev.source,
          type: 'primary',
          year: ev.year,
          confidence: 0.8,
        });
        if (sources.length >= max) return sources;
      }
    }
  }

  return sources;
}

function calculateKnowledgeConfidence(
  identity: IdentityLayer,
  mentalModels: MentalModel[],
  values: CoreValue[],
  heuristics: DecisionHeuristic[],
  boundaries: HonestBoundary[],
  tensions: Tension[]
): number {
  const weights = {
    identity: identity.confidence * 2,
    mentalModels: (mentalModels.reduce((s, m) => s + m.confidence, 0) / Math.max(mentalModels.length, 1)) * 3,
    values: (values.reduce((s, v) => s + v.confidence, 0) / Math.max(values.length, 1)) * 2,
    heuristics: (heuristics.reduce((s, h) => s + h.confidence, 0) / Math.max(heuristics.length, 1)) * 1.5,
    boundaries: (boundaries.reduce((s, b) => s + b.confidence, 0) / Math.max(boundaries.length, 1)) * 1,
    tensions: (tensions.reduce((s, t) => s + t.confidence, 0) / Math.max(tensions.length, 1)) * 1,
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.round((total / 10.5) * 100) / 100; // normalize to 0-1
}

function makeEmptyIdentity(personaName: string): IdentityLayer {
  return {
    identityPrompt: `${personaName}是一位重要思想人物。`,
    oneLineSummary: `关于${personaName}的一句话描述。`,
    threeLineBio: '',
    coreClaim: '',
    uniquePerspective: '',
    confidence: 0,
  };
}
