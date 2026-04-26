/**
 * Prismatic — Layer 3: Knowledge Gap Handler
 *
 * Executes the graceful degradation decision from Layer 2.
 * Three main modes:
 *
 * 1. extrapolate_identity:
 *    Given a living persona's identity + decision heuristics, synthesize a response
 *    to a question that falls outside the corpus coverage window.
 *    Uses Identity Prompt as the anchor; only extrapolates through core values/heuristics.
 *
 * 2. honest_boundary:
 *    Generates a clear, honest statement about what the persona knows vs doesn't know.
 *    Never fabricates facts. Directly acknowledges the gap.
 *
 * 3. hybrid:
 *    Combines known facts from the distilled corpus with honest boundary statements.
 *    The response starts with known information, then honestly admits limitations.
 *
 * 4. refer_sources:
 *    Attempts to cite specific sources from the distilled knowledge layer.
 *
 * Safety constraints:
 * - NEVER fabricate specific events, dates, quotes, or statements
 * - NEVER provide health/medical advice about real individuals
 * - ALWAYS be transparent when extrapolating
 * - ALWAYS respect the extrapolationBoundaries from persona metadata
 */

import type {
  KnowledgeLayer,
  ExpressionLayer,
  CorpusMetadata,
  DegradationMode,
  GracefulDegradationResult,
  ExtrapolationResult,
  GracefulDegradationConfig,
} from './distillation-v4-types';

// ─── Types ────────────────────────────────────────────────────────────────────────

interface HandlerContext {
  personaId: string;
  personaNameZh: string;
  personaNameEn: string;
  question: string;
  knowledge: KnowledgeLayer;
  expression: ExpressionLayer;
  metadata: CorpusMetadata;
  topicHint?: string;
  llm?: any; // Optional LLM for complex extrapolation
}

// ─── Boundary Statement Templates ──────────────────────────────────────────────────

function buildBoundaryStatement(ctx: HandlerContext): string {
  const { personaNameZh, metadata } = ctx;
  const cutoffNote = metadata.corpusLastUpdated
    ? `我的训练语料最近更新于 ${metadata.corpusLastUpdated}，之后发生的事情我可能不了解。`
    : metadata.cutoffDate
    ? `我的知识截止到 ${metadata.cutoffDate}，可能无法回答之后的事情。`
    : '';

  const aliveNote = metadata.isAlive
    ? `作为还在世的 ${personaNameZh}，我一直在学习和成长，有些新想法可能还没有被整理进我的知识库。`
    : '';

  const boundaries = (metadata.extrapolationBoundaries ?? []).length > 0
    ? `我不会讨论：${metadata.extrapolationBoundaries!.join('、')}。`
    : '';

  const parts = [cutoffNote, aliveNote, boundaries].filter(Boolean);
  return parts.join(' ');
}

// ─── Handler 1: Honest Boundary ─────────────────────────────────────────────────

function handleHonestBoundary(ctx: HandlerContext): GracefulDegradationResult {
  const { personaNameZh, question, metadata } = ctx;
  const boundaryStatement = buildBoundaryStatement(ctx);

  // Generate a graceful "I don't know" response
  let content: string;

  if (metadata.isAlive) {
    content = `关于"${question.slice(0, 50)}${question.length > 50 ? '...' : ''}"这个问题——

${boundaryStatement}

作为 ${personaNameZh}，我会坦诚地说：我对 ${metadata.cutoffDate ?? '近期'} 以后发生的事情没有第一手的了解，无法给你准确的信息。

不过，如果你的问题涉及的是某种价值观或人生选择的困惑，我很乐意从我的经验和思考出发，和你一起探讨。`;
  } else {
    content = `关于"${question.slice(0, 50)}${question.length > 50 ? '...' : ''}"——

${boundaryStatement}

我的人生和思想有明确的边界。我的主要著作和言论集中在 ${metadata.coverageSpan?.startYear ?? '早年'} 至 ${metadata.coverageSpan?.endYear ?? '晚年'} 期间。对于这个时间段之前或之后的具体事件，我无法提供准确回答。

如果你对我在已知范围内的思想感兴趣，我很乐意继续探讨。`;
  }

  return {
    mode: 'honest_boundary',
    needsLLM: false, // Template-based, no LLM needed
    boundaryStatement,
    meta: {
      isAlive: metadata.isAlive ?? false,
      corpusCutoffDate: metadata.cutoffDate,
      isExtrapolation: false,
      confidence: 0.95,
    },
  };
}

// ─── Handler 2: Extrapolate Identity ──────────────────────────────────────────────

async function handleExtrapolate(ctx: HandlerContext): Promise<GracefulDegradationResult> {
  const { personaId, personaNameZh, personaNameEn, question, knowledge, expression, metadata, llm } = ctx;

  // Safety: check extrapolation boundaries
  const violatedBoundary = metadata.extrapolationBoundaries?.find(b =>
    question.includes(b)
  );
  if (violatedBoundary) {
    const result = handleHonestBoundary(ctx);
    result.extrapolationResult = {
      content: '',
      isExtrapolation: false,
      extrapolatedFrom: [],
      honestBoundaryStatement: buildBoundaryStatement(ctx),
      confidence: 0,
      safetyLevel: 'unsafe',
      unsafeReason: `问题涉及禁区话题: "${violatedBoundary}"`,
    };
    return result;
  }

  // If LLM is available, use it for sophisticated extrapolation
  if (llm) {
    const extrapolation = await handleExtrapolateWithLLM(ctx);
    return {
      mode: 'extrapolate',
      needsLLM: true,
      extrapolationResult: extrapolation,
      meta: {
        isAlive: metadata.isAlive ?? false,
        corpusCutoffDate: metadata.cutoffDate,
        isExtrapolation: true,
        confidence: extrapolation.confidence,
      },
    };
  }

  // Fallback: template-based extrapolation (no LLM)
  const extrapolation = await handleExtrapolateTemplate(ctx);
  return {
    mode: 'extrapolate',
    needsLLM: false,
    extrapolationResult: extrapolation,
    meta: {
      isAlive: metadata.isAlive ?? false,
      corpusCutoffDate: metadata.cutoffDate,
      isExtrapolation: true,
      confidence: extrapolation.confidence,
    },
  };
}

async function handleExtrapolateWithLLM(ctx: HandlerContext): Promise<ExtrapolationResult> {
  const { personaId, personaNameZh, personaNameEn, question, knowledge, expression, metadata, llm } = ctx;

  const heuristics = knowledge.decisionHeuristics
    .slice(0, 5)
    .map((h, i) => `${i + 1}. ${h.nameZh || h.name}: ${h.descriptionZh || h.description}`)
    .join('\n');

  const values = knowledge.values
    .slice(0, 5)
    .map(v => `- ${v.nameZh || v.name}`)
    .join('\n');

  const strengths = knowledge.strengths.slice(0, 3).join('、');

  const prompt = `你是 ${personaNameZh}（${personaNameEn}），一位真实存在的思想家/企业家/学者。

【你的核心身份】
${knowledge.identityPromptZh || knowledge.identityPrompt}

【你的核心价值观】
${values || '（未定义）'}

【你的决策启发式】
${heuristics || '（未定义）'}

【你的优势领域】
${strengths || '（未定义）'}

【你的表达风格】
${expression.speakingStyle || expression.chineseAdaptation || '严谨、有洞察力'}
语气：${expression.tone || '正式'}
确信程度：${expression.certaintyLevel === 'high' ? '表达确定果断' : expression.certaintyLevel === 'low' ? '保持适度不确定' : '平衡客观'}

【注意事项】
- 这是一个推演回答，不是基于具体事实
- 只在价值观和思维模式的框架内推演，不要虚构具体事件、数据或引语
- 绝对不要：
  * 声称知道 ${metadata.cutoffDate ? `截止到 ${metadata.cutoffDate} 之后` : '近期'} 发生的具体事件
  * 编造具体的日期、数字、引语或声明
  * 涉及健康、隐私、未公开的计划等敏感话题
- 如果推演可能导致不安全的结论，直接说"我不知道"
- 推演必须从你的价值观出发，有 ${personaNameZh} 的思维特色

【用户问题】
"${question}"

请以 ${personaNameZh} 的身份，用中文回答这个问题。
回答格式：
[推演声明] 在开头说明这是基于你价值观的推演，不是具体事实
[回答内容] 100-200字，有 ${personaNameZh} 的思维特色
[诚实边界] 在结尾诚实说明你的知识边界

输出格式：
[推演声明]: ...
[回答内容]: ...
[诚实边界]: ...`;

  try {
    const response = await llm.chat({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `You are ${personaNameZh}.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 800,
    });

    const rawContent = response.content?.trim() ?? '';

    // Parse the structured output
    const declarationMatch = rawContent.match(/\[推演声明\]:?\s*([^\n]+(?:\n(?!\[[^\]]+\]:).*)*)/);
    const contentMatch = rawContent.match(/\[回答内容\]:?\s*([^\n]+(?:\n(?!\[[^\]]+\]:).*)*)/);
    const boundaryMatch = rawContent.match(/\[诚实边界\]:?\s*([^\n]+(?:\n(?!\[[^\]]+\]:).*)*)/);

    const extrapolationDeclaration = declarationMatch?.[1]?.trim() || '';
    const mainContent = contentMatch?.[1]?.trim() || rawContent;
    const boundaryNote = boundaryMatch?.[1]?.trim() || buildBoundaryStatement(ctx);

    // Combine with extrapolation header
    const fullContent = `${extrapolationDeclaration ? `【推演声明】${extrapolationDeclaration}\n\n` : ''}${mainContent}\n\n${boundaryNote}`;

    return {
      content: fullContent,
      isExtrapolation: true,
      extrapolatedFrom: [
        'identity_prompt',
        'decision_heuristics',
        'core_values',
      ],
      honestBoundaryStatement: boundaryNote,
      confidence: 0.6, // Extrapolation is inherently uncertain
      safetyLevel: 'caution',
    };
  } catch (error) {
    // LLM call failed — fall back to template
    return handleExtrapolateTemplateSync(ctx);
  }
}

function handleExtrapolateTemplateSync(ctx: HandlerContext): ExtrapolationResult {
  const { personaNameZh, question, knowledge, expression, metadata } = ctx;

  const coreValues = knowledge.values.slice(0, 3);
  const valuesText = coreValues.length > 0
    ? coreValues.map(v => v.nameZh || v.name).join('、')
    : '（核心价值观未定义）';

  const heuristics = knowledge.decisionHeuristics
    .slice(0, 2)
    .map(h => h.nameZh || h.name)
    .join('、');

  const boundaryNote = buildBoundaryStatement(ctx);

  const content = `【推演声明】以下内容是基于 ${personaNameZh} 的价值观和思维模式的推演回答，不是具体事实。

关于"${question.slice(0, 80)}${question.length > 80 ? '...' : ''}"——

从 ${personaNameZh} 的核心价值观（${valuesText}）出发，结合 ${knowledge.identityPromptZh ? knowledge.identityPromptZh.slice(0, 60) + '...' : '我的思考框架'}，我认为：

${heuristics ? `根据我的思维习惯（${heuristics}），` : ''}这类问题需要从 ${valuesText} 的角度来思考。

${expression.speakingStyle ? `—— ${expression.speakingStyle.slice(0, 50)}` : ''}

${boundaryNote}`;

  return {
    content,
    isExtrapolation: true,
    extrapolatedFrom: ['identity_prompt', 'core_values'],
    honestBoundaryStatement: boundaryNote,
    confidence: 0.4, // Template-based is less confident
    safetyLevel: 'caution',
  };
}

async function handleExtrapolateTemplate(ctx: HandlerContext): Promise<ExtrapolationResult> {
  return handleExtrapolateTemplateSync(ctx);
}

// ─── Handler 3: Hybrid ──────────────────────────────────────────────────────────

async function handleHybrid(ctx: HandlerContext): Promise<GracefulDegradationResult> {
  const { personaId, personaNameZh, question, knowledge, llm } = ctx;

  // Try to find relevant knowledge from the corpus first
  const relevantMentalModels = findRelevantMentalModels(knowledge, question);
  const relevantValues = findRelevantValues(knowledge, question);
  const relevantHeuristics = findRelevantHeuristics(knowledge, question);

  const hasKnownKnowledge = relevantMentalModels.length > 0 || relevantValues.length > 0;

  // If we have relevant knowledge, use LLM to construct a hybrid response
  if (hasKnownKnowledge && llm) {
    const hybridContent = await constructHybridWithLLM(ctx, {
      mentalModels: relevantMentalModels,
      values: relevantValues,
      heuristics: relevantHeuristics,
    });

    return {
      mode: 'hybrid',
      needsLLM: true,
      normalResponse: hybridContent,
      meta: {
        isAlive: ctx.metadata.isAlive ?? false,
        corpusCutoffDate: ctx.metadata.cutoffDate,
        isExtrapolation: true,
        confidence: 0.55,
      },
    };
  }

  // Fall back to simple hybrid template
  const boundaryNote = buildBoundaryStatement(ctx);

  let content = '';

  if (relevantMentalModels.length > 0) {
    const mm = relevantMentalModels[0];
    content += `从我已知的思想来看，关于这个问题——

${mm.nameZh || mm.name}：${mm.oneLinerZh || mm.oneLiner}

`;
  } else if (relevantValues.length > 0) {
    const v = relevantValues[0];
    content += `从 ${personaNameZh} 的价值观来看——

${v.nameZh || v.name}：${v.descriptionZh || v.description || '（价值观定义）'}

`;
  }

  content += `以上是基于 ${personaNameZh} 已有思想的部分回答。
以下是我不确定的部分：

${boundaryNote}`;

  return {
    mode: 'hybrid',
    needsLLM: false,
    normalResponse: content,
    meta: {
      isAlive: ctx.metadata.isAlive ?? false,
      corpusCutoffDate: ctx.metadata.cutoffDate,
      isExtrapolation: true,
      confidence: 0.4,
    },
  };
}

async function constructHybridWithLLM(
  ctx: HandlerContext,
  relevant: {
    mentalModels: KnowledgeLayer['mentalModels'];
    values: KnowledgeLayer['values'];
    heuristics: KnowledgeLayer['decisionHeuristics'];
  }
): Promise<string> {
  const { personaNameZh, personaNameEn, question, knowledge, expression, metadata, llm } = ctx;

  const mmText = relevant.mentalModels
    .map(m => `- ${m.nameZh || m.name}: ${m.oneLinerZh || m.oneLiner}`)
    .join('\n');

  const valuesText = relevant.values
    .map(v => `- ${v.nameZh || v.name}`)
    .join('\n');

  const prompt = `你是 ${personaNameZh}（${personaNameEn}）。

【用户问题】
"${question}"

【来自语料库的已知思想】
${mmText || '(无直接相关思想)'}

【相关价值观】
${valuesText || '(无直接相关价值观)'}

【表达风格指引】
${expression.speakingStyle || expression.chineseAdaptation || '严谨、有洞察力'}
语气：${expression.tone || '正式'}
确信程度：${expression.certaintyLevel === 'high' ? '表达确定' : '保持适度不确定'}

【要求】
1. 分两部分回答：
   - 第一部分：基于已知思想，给出 ${personaNameZh} 在这个问题上的已有立场
   - 第二部分：坦诚说明 ${metadata.cutoffDate ? `截止到 ${metadata.cutoffDate} 之后` : '近期'} 的具体信息不确定
2. 如果问题完全不涉及已知思想，直接跳到第二部分
3. 不要虚构具体事件、日期、引语
4. 150字以内

格式：
【已知】...（如果有可说的）
【不确定】...（诚实地说明边界）`;

  try {
    const response = await llm.chat({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `You are ${personaNameZh}.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      maxTokens: 600,
    });

    return response.content?.trim() ?? buildBoundaryStatement(ctx);
  } catch {
    return buildBoundaryStatement(ctx);
  }
}

// ─── Handler 4: Refer Sources ──────────────────────────────────────────────────

function handleReferSources(ctx: HandlerContext): GracefulDegradationResult {
  const { knowledge, metadata, personaNameZh } = ctx;

  const boundaryNote = buildBoundaryStatement(ctx);

  let content: string;

  if (knowledge.sources && knowledge.sources.length > 0) {
    const topSources = knowledge.sources.slice(0, 3);
    const sourcesText = topSources
      .map((s, i) => `${i + 1}. 《${s.title}》${s.description ? ` — ${s.description}` : ''}`)
      .join('\n');

    content = `关于这个问题，我的思考主要来自以下已整理的知识来源：

${sourcesText}

${boundaryNote}`;
  } else {
    content = `目前没有找到与这个问题直接相关的已整理来源。

${boundaryNote}`;
  }

  return {
    mode: 'refer_sources',
    needsLLM: false,
    normalResponse: content,
    meta: {
      isAlive: metadata.isAlive ?? false,
      corpusCutoffDate: metadata.cutoffDate,
      isExtrapolation: false,
      confidence: 0.8,
    },
  };
}

// ─── Helper: Find Relevant Knowledge ─────────────────────────────────────────────

function findRelevantMentalModels(
  knowledge: KnowledgeLayer,
  question: string
): KnowledgeLayer['mentalModels'] {
  const qLower = question.toLowerCase();

  return knowledge.mentalModels
    .filter(mm => {
      const text = `${mm.name} ${mm.nameZh} ${mm.oneLiner} ${mm.oneLinerZh} ${mm.application} ${mm.applicationZh} ${mm.crossDomain.join(' ')}`.toLowerCase();
      // Check for keyword overlap
      const questionWords = qLower.split(/\s+/).filter(w => w.length > 2);
      const matchCount = questionWords.filter(w => text.includes(w)).length;
      return matchCount >= 1;
    })
    .slice(0, 3);
}

function findRelevantValues(
  knowledge: KnowledgeLayer,
  question: string
): KnowledgeLayer['values'] {
  const qLower = question.toLowerCase();

  return knowledge.values
    .filter(v => {
      const text = `${v.name} ${v.nameZh} ${v.description} ${v.descriptionZh}`.toLowerCase();
      const questionWords = qLower.split(/\s+/).filter(w => w.length > 2);
      const matchCount = questionWords.filter(w => text.includes(w)).length;
      return matchCount >= 1;
    })
    .slice(0, 3);
}

function findRelevantHeuristics(
  knowledge: KnowledgeLayer,
  question: string
): KnowledgeLayer['decisionHeuristics'] {
  const qLower = question.toLowerCase();

  return knowledge.decisionHeuristics
    .filter(h => {
      const text = `${h.name} ${h.nameZh} ${h.description} ${h.descriptionZh}`.toLowerCase();
      return qLower.includes(h.name.toLowerCase()) ||
             qLower.includes(h.nameZh?.toLowerCase() ?? '') ||
             text.split(/\s+/).filter(w => w.length > 2).some(w => qLower.includes(w));
    })
    .slice(0, 2);
}

// ─── Main Orchestrator ─────────────────────────────────────────────────────────

export interface HandleKnowledgeGapOptions {
  /** 用户问题 */
  question: string;
  /** 人物 ID */
  personaId: string;
  /** 人物中文名 */
  personaNameZh: string;
  /** 人物英文名 */
  personaNameEn?: string;
  /** 知识层（蒸馏后的知识图谱） */
  knowledge: KnowledgeLayer;
  /** 表达层（蒸馏后的表达特征） */
  expression: ExpressionLayer;
  /** 人物元数据 */
  metadata: CorpusMetadata;
  /** 话题提示（从检测器提取） */
  topicHint?: string;
  /** LLM 实例（可选，用于复杂推演） */
  llm?: any;
}

/**
 * 知识缺口处理主入口。
 * 根据降级模式，执行对应的处理逻辑。
 *
 * @param options 处理选项
 * @param mode 降级模式（由优雅路由器决定）
 * @returns 处理结果
 */
export async function handleKnowledgeGap(
  options: HandleKnowledgeGapOptions,
  mode: DegradationMode
): Promise<GracefulDegradationResult> {
  const ctx: HandlerContext = {
    personaId: options.personaId,
    personaNameZh: options.personaNameZh,
    personaNameEn: options.personaNameEn ?? options.personaNameZh,
    question: options.question,
    knowledge: options.knowledge,
    expression: options.expression,
    metadata: options.metadata,
    topicHint: options.topicHint,
    llm: options.llm,
  };

  switch (mode) {
    case 'normal':
      // Normal mode: no handling needed, the orchestrator will use the standard response
      return {
        mode: 'normal',
        needsLLM: false,
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: false,
          confidence: 1.0,
        },
      };

    case 'honest_boundary':
      return handleHonestBoundary(ctx);

    case 'extrapolate':
      const extrapolateResult = await handleExtrapolate(ctx);
      return {
        mode: 'extrapolate',
        needsLLM: extrapolateResult.extrapolationResult !== undefined ? !!options.llm : false,
        extrapolationResult: extrapolateResult.extrapolationResult,
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: true,
          confidence: extrapolateResult.extrapolationResult?.confidence ?? 0.5,
        },
      };

    case 'hybrid':
      return await handleHybrid(ctx);

    case 'refer_sources':
      return handleReferSources(ctx);

    default:
      return {
        mode: 'normal',
        needsLLM: false,
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: false,
          confidence: 1.0,
        },
      };
  }
}

/**
 * 快速处理（无 LLM）：用于热路径或 LLM 不可用时
 */
export function handleKnowledgeGapFast(
  options: HandleKnowledgeGapOptions,
  mode: DegradationMode
): GracefulDegradationResult {
  const ctx: HandlerContext = {
    personaId: options.personaId,
    personaNameZh: options.personaNameZh,
    personaNameEn: options.personaNameEn ?? options.personaNameZh,
    question: options.question,
    knowledge: options.knowledge,
    expression: options.expression,
    metadata: options.metadata,
    topicHint: options.topicHint,
    llm: undefined,
  };

  switch (mode) {
    case 'normal':
      return {
        mode: 'normal',
        needsLLM: false,
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: false,
          confidence: 1.0,
        },
      };

    case 'honest_boundary':
      return handleHonestBoundary(ctx);

    case 'extrapolate':
      return {
        mode: 'extrapolate',
        needsLLM: false,
        extrapolationResult: handleExtrapolateTemplateSync(ctx),
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: true,
          confidence: 0.4,
        },
      };

    case 'hybrid':
      return handleHybridSync(ctx);

    case 'refer_sources':
      return handleReferSources(ctx);

    default:
      return {
        mode: 'normal',
        needsLLM: false,
        meta: {
          isAlive: options.metadata.isAlive ?? false,
          corpusCutoffDate: options.metadata.cutoffDate,
          isExtrapolation: false,
          confidence: 1.0,
        },
      };
  }
}

function handleHybridSync(ctx: HandlerContext): GracefulDegradationResult {
  const { personaNameZh, question, knowledge, expression, metadata } = ctx;

  const relevantMentalModels = findRelevantMentalModels(knowledge, question);
  const relevantValues = findRelevantValues(knowledge, question);

  const hasKnownKnowledge = relevantMentalModels.length > 0 || relevantValues.length > 0;
  const boundaryNote = buildBoundaryStatement(ctx);

  let content = '';

  if (relevantMentalModels.length > 0) {
    const mm = relevantMentalModels[0];
    content += `从我已知的思想来看——\n\n`;
    content += `**${mm.nameZh || mm.name}**：${mm.oneLinerZh || mm.oneLiner}\n\n`;
  } else if (relevantValues.length > 0) {
    const v = relevantValues[0];
    content += `从 ${personaNameZh} 的价值观来看——\n\n`;
    content += `**${v.nameZh || v.name}**：${v.descriptionZh || v.description || '（价值观）'}\n\n`;
  }

  content += `**边界说明**：${boundaryNote}`;

  return {
    mode: 'hybrid',
    needsLLM: false,
    normalResponse: content,
    meta: {
      isAlive: metadata.isAlive ?? false,
      corpusCutoffDate: metadata.cutoffDate,
      isExtrapolation: relevantMentalModels.length === 0,
      confidence: hasKnownKnowledge ? 0.5 : 0.3,
    },
  };
}
