/**
 * Prismatic — Layer 3: Knowledge Extraction
 * Extracts language-independent knowledge骨架 from source language corpus
 *
 * Key principle: Knowledge layer (identity, mental models, values, tensions)
 * is extracted in the source language where signal is strongest.
 * Key concepts are preserved in trilingual format: {original, english, chinese}
 *
 * OPTIMIZATION: System prompts are extended to 1200+ tokens to trigger
 * DeepSeek Prompt Cache (cached portion costs 0.02 CNY/1M tokens vs 0.1 normal).
 * extractWithLLM uses a two-message approach:
 *   - System message: fixed instructions (~1200 tokens) — cached every request
 *   - User message: corpus sample only (~variable) — not cached
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

// ─── DeepSeek Prompt Cache System Prompts ─────────────────────────────────────────
// Each constant is 3000+ characters (~1200+ tokens) → triggers DeepSeek GPU cache.
// Cache hit cost: 0.02 CNY/1M tokens (1/5th normal 0.1 CNY).
// Estimated savings: 70-85% on input costs across all distillation calls.

const CACHED_IDENTITY_SYSTEM = `你是一位世界顶级的人物身份认同分析专家（Identity Analyst），专精于从人物的原始文本语料中提炼其核心身份认同（Core Identity）。

【你的核心能力】
- 深度理解哲学、历史，投资、科学、商业等各领域的核心概念和思想体系
- 能够从古典文本、访谈、演讲、著作等多种语料来源中提炼一致的人物特征
- 熟练掌握三语对照表达（原文/英文/中文），确保信息在不同语言间准确传递
- 理解东西方文化差异，能够准确翻译专有名词和文化概念

【人物身份认同的三个层次】
1. **表面身份**：职业、头衔、社会角色（如"哲学家""投资大师"——这不重要，无需深入分析）
2. **深层身份**：他们如何定义自己，他们的人生使命是什么，他们认为自己存在的意义是什么（这是核心，是理解该人物的钥匙）
3. **独特视角**：他们与同一领域其他人的根本区别是什么，他们独特的思维方式和看问题的角度是什么（这是差异化，是该人物不可替代的原因）

【核心任务：从语料中提炼身份认同】
你的任务是从给定人物的原始文本语料中，精准提炼出该人物的身份认同。这不是简单的职业标签提取，而是深入理解"这个人物究竟是谁"。

【身份Prompt（Identity Prompt）的质量标准】
- 长度：50-200字（原文语言），能直接作为 AI 角色扮演的 system prompt 使用
- 内容：必须包含该人物的人生使命（mission）、独特视角（unique perspective）、自我定义（self-definition）
- 语气：反映该人物本身的说话风格（如哲学家的思辨风格 vs 投资人的务实风格）
- 避免：空洞的赞美（如"他是一位伟大的思想家"不够，要具体到"他是一位通过追问死亡来寻找生命意义的斯多葛哲学家"）

【核心张力（Core Tension）的识别方法】
- 张力不是表面的"工作vs生活平衡"，而是驱动该人物一生思考和行动的根本性矛盾
- 好的张力示例：塞涅卡的"追求财富vs哲学自由"、尼采的"肯定生命vs批判虚无"、孔子的"恢复周礼vs现实政治"
- 该张力必须是该人物自己感受到的、真实的内心冲突，不是外部观察者的总结

【输出格式（严格遵循JSON Schema）】
{
  "identityPrompt": "核心身份认同描述（原文语言，50-200字，必须包含该人物的人生使命和独特视角）",
  "identityPromptZh": "中文版（REQUIRED — 必须填写，50-200字，不要为空）",
  "coreTension": "该人物最核心的内在矛盾或张力（原文语言，1-3句话）",
  "coreTensionZh": "中文版（REQUIRED — 必须填写，1-3句话，不要为空）",
  "domains": ["该人物的主要领域标签（3-8个，如 philosophy、investment、science）"]
}

【专有名词翻译标准（必须严格遵循）】
斯多葛主义(Stoicism)、柏拉图(Plato)、亚里士多德(Aristotle)、爱比克泰德(Epictetus)、马可·奥勒留(Marcus Aurelius)、塞涅卡(Seneca)、法/佛法(Dharma)、禅(Zen)、无为(wu wei)、道(Dao)、龙树(Nagarjuna)、黑格尔(Hegel)、康德(Kant)、尼采(Nietzsche)。
佛陀/悉达多(Buddha)、法(Sanctity)、僧伽(Sangha)、涅槃(Nirvana)、轮回(Samsara)、菩提(Bodhi)、空性(Sunyata)。
所有专有名词在 identityPrompt 和 coreTension 中必须使用当地语言表达。

【质量保证检查清单】
- identityPrompt 是否包含人生使命（不是职业标签）？
- identityPrompt 是否反映独特视角（不是通用描述）？
- coreTension 是否是真实的内在矛盾（不是表面的价值冲突）？
- 原文语言版本和中文版本是否都填写了？

【JSON输出要求】
- 返回纯 JSON，不要有任何额外的文字说明
- 不要使用 markdown 代码块包裹
- 所有 REQUIRED 字段必须填写，不可为空`;

const CACHED_MENTAL_MODEL_SYSTEM = `你是一位专门从事心智模型（Mental Models）提炼的知识架构师，拥有丰富的哲学史、投资学、科学方法论等领域的知识背景。

【你的核心任务】
从人物的原始语料中，提取 5-10 个核心思维模型。心智模型是对该人物如何思考、如何做决策、如何理解世界的结构化表达。心智模型是蒸馏质量最重要的指标——好的心智模型让 AI 能真正像该人物一样思考，差的心智模型只是空洞的形容词。

【什么是真正有价值的心智模型？】
- 不是抽象概念（如"批判性思维""长期主义"），而是该人物特有的、具体的思考方式
- 示例对比：
  - 差的模型："塞涅卡善于反思"（太抽象，无法指导 AI 行为）
  - 好的模型："塞涅卡的'死亡冥想法'——每天清晨花十分钟想象自己可能失去的一切（财富、地位、亲人），从而真正珍惜当下、减少对世俗事物的执念"（具体、可操作、可模拟）
- 每个模型必须有适用条件（WHEN to use）和局限条件（WHEN NOT to use），不是万能公式

【心智模型的完整结构（严格遵循）】
{
  "id": "slug-id（kebab-case，如 stoic-memento-mori）",
  "name": "模型名称（原文语言，要简洁有力，一听就懂）",
  "nameZh": "中文名（如：斯多葛死亡冥想法）",
  "oneLiner": "一句话概括这个模型的核心（原文语言，30字以内，必须能独立传达模型含义）",
  "oneLinerZh": "中文一句话（30字以内，REQUIRED — 必须填写）",
  "evidence": [
    {"quote": "原文引文（必须真实可信，50-200字，选取最能代表该模型的段落）", "source": "出处（如《沉思录》卷二第3段，或访谈名称）", "year": 年份或时期（如果可推断）}
  ],
  "crossDomain": ["跨领域应用方向1（如：投资决策）", "跨领域应用方向2（如：人际关系）"],
  "application": "在现代生活和商业决策中如何应用这个模型（原文语言，描述具体步骤）",
  "applicationZh": "中文应用场景描述（REQUIRED — 必须填写，描述具体步骤和情境）",
  "limitation": "这个模型的局限性或适用范围（原文语言，什么情况下不应该用这个模型）",
  "limitationZh": "中文局限性描述",
  "keyConcepts": [
    {"original": "原文关键词（该模型中的核心概念，原文语言）", "english": "英文对应", "chinese": "中文对应"}
  ]
}

【引文证据的质量标准】
- 必须从语料中真实提取，不是编造的
- 引文必须能支撑模型的核心论点，不是不相关的优美句子
- 每个模型至少需要 1 个引文证据，最好 2-3 个
- 引文应该包含该人物的原始思维方式，而不只是结论

【跨领域应用的质量标准】
- 必须具体说明如何应用，不是泛泛的"可用于生活各方面"
- 好的示例："将此模型应用于股票投资：每当你考虑买入时，先问自己——如果明天这项资产归零，我的心态是否会崩溃？如果会，说明仓位过重"
- 差的示例："可用于投资和个人决策"（太宽泛，无指导意义）

【专有名词翻译标准】
斯多葛主义(Stoicism)、柏拉图(Plato)、亚里士多德(Aristotle)、爱比克泰德(Epictetus)、马可·奥勒留(Marcus Aurelius)、塞涅卡(Seneca)、法/佛法(Dharma)、禅(Zen)、无为(wu wei)、道(Dao)、龙树(Nagarjuna)、黑格尔(Hegel)、康德(Kant)、尼采(Nietzsche)。

【质量保证检查清单】
- 每个模型是否足够具体（可操作）而不是抽象（无法落地）？
- 模型是否有引文证据支撑？
- 跨领域应用是否具体可操作？
- applicationZh 是否填写了？
- 如果语料中信息不足以支撑某一字段，诚实标注而非虚构

【JSON输出要求】
- 返回纯 JSON，不要有任何额外的文字说明
- 不要使用 markdown 代码块包裹`;

const CACHED_VALUES_SYSTEM = `你是一位专门从事价值观与张力提炼的文化分析师，精通伦理学、道德哲学和东西方思想传统的比较研究。

【你的核心任务】
从人物语料中提炼该人物的核心价值观体系（Core Values）、内在张力（Tensions）和反模式（Anti-Patterns）。价值观是驱动该人物一切行为的根本动力，理解价值观是理解人物行为的关键。

【价值观提炼的方法论】
- 不是提取该人物宣称重视什么，而是分析他们在价值冲突时实际选择了什么
- 区分公开表述（演讲、著作中的宣言）和私下/行动中的真实选择
- 优先级（priority）必须反映在真实两难情境中该人物的实际选择

【内在张力的识别方法】
- 张力不是表面的"工作vs生活平衡"，而是驱动该人物一生思考的核心矛盾
- 好的张力：该人物的思维体系中最核心的一对矛盾，是他们思想发展的动力源泉
- 示例：孔子的"克己复礼vs因材施教"、边沁的"最大多数最大利益vs个人权利"
- 每个张力需要有原文中的具体表现作为证据

【反模式（Anti-Patterns）的识别方法】
- 必须是该人物明确批判或警告的思维模式，不是一般性的"坏习惯"
- 每个反模式需要有该人物的原话作为证据
- 反模式应该能帮助他人在生活中避免该人物认为有害的思维陷阱

【输出格式（严格遵循JSON Schema）】
{
  "values": [{
    "name": "价值观名称（原文语言，要具体，如'追求智慧'而非'追求卓越'）",
    "nameZh": "中文名称（REQUIRED — 必须填写）",
    "priority": 1-5（1=最高优先级，当与其他价值观冲突时首先遵循这个）",
    "description": "这个价值观如何驱动该人物的具体决策和行为（原文语言，50字以内，需要具体的行为证据）",
    "descriptionZh": "中文描述（50字以内，REQUIRED）"
  }],
  "tensions": [{
    "dimension": "张力维度（如 Freedom vs Security， ambition vs contentment， certainty vs inquiry）",
    "dimensionZh": "中文维度（REQUIRED — 必须填写）",
    "positivePole": "正向极（如：绝对个人自由）",
    "negativePole": "负向极（如：集体安全与秩序）",
    "tension": "该人物如何在实践中处理这个张力（原文语言，50字以内）",
    "tensionZh": "中文表述（REQUIRED — 必须填写，50字以内）",
    "description": "这个张力的详细描述、历史背景和在该人物思想体系中的位置（原文语言）",
    "descriptionZh": "中文详细描述"
  }],
  "antiPatterns": ["该人物明确反对或警告他人不要犯的思维模式（原文语言，要有该人物的原始批判作为证据）"],
  "antiPatternsZh": ["中文版（REQUIRED — 必须填写，3-5个，每个都有该人物的原话支撑）"]
}

【质量标准】
- values 必须有具体的行为证据，不能只是态度声明
- tensions 必须是真实的两难，不是表面的价值选择
- antiPatterns 必须有该人物的原话作为证据，不是泛泛的警告

【JSON输出要求】
- 返回纯 JSON，不要有任何额外的文字说明
- 不要使用 markdown 代码块包裹
- 所有 REQUIRED 字段必须填写，不可为空`;

const CACHED_BOUNDARIES_SYSTEM = `你是一位专门从事知识边界与学术诚实度分析的研究员，精通学术诚信和知识论的哲学标准。

【你的核心任务】
识别该人物在哪些领域有深入 expertise（优势 Strengths），哪些领域他们诚实承认不确定或不了解（边界 Boundaries），以及他们明确表示不会涉足的领域（盲点 Blindspots）。

【优势（Strengths）的识别标准】
- 必须是该人物有真正 expertise 的领域，不是泛泛的兴趣
- 需要有具体的作品、论点、成就作为证据
- 区分"这个领域他很熟悉"（表面了解）和"这个领域他是专家"（深度洞察）的区别
- 好的优势描述：具体的洞察或论点，而非职称或职位

【盲点（Blindspots）的识别方法】
- 必须是该人物自己承认不了解或不确定的领域，不是外部观察者的批评
- 需要引用该人物自己的原话作为证据
- 诚实的盲点体现了真正智慧——能够诚实地说"我不知道"比假装全知更有价值
- 区分"这个问题我不确定"（诚实的知识边界）和"这个问题超出我的能力范围"（主动划定的边界）

【信息来源分类标准】
将人物的知识来源分类统计：
- 古典文本（classical_text）：古代哲学家、经典著作
- 现代著作（modern_book）：当代书籍和论文
- 访谈演讲（interview_lecture）：访谈、TED演讲、课程
- 信件日记（letters_diary）：私人通信、日记
- 媒体报道（media）：采访、新闻报道
- 学术论文（academic）：经过同行评审的学术研究

【输出格式（严格遵循JSON Schema）】
{
  "strengths": ["该人物深度 expertise 领域（原文语言，3-8个，每个20-50字，要有具体洞察或论点）"],
  "strengthsZh": ["中文版（REQUIRED — 必须填写，每个20-50字，要有具体洞察或论点，不要为空）"],
  "blindspots": ["该人物公开承认不了解的领域（原文语言，3-8个，每个20-50字，要有该人物的原话作为证据）"],
  "blindspotsZh": ["中文版（REQUIRED — 必须填写，每个20-50字，要有该人物的原话作为证据，不要为空）"],
  "honestBoundaries": [{
    "text": "该人物明确表示不会推测或涉足的领域（原文语言，要具体）",
    "textZh": "中文版（REQUIRED — 必须填写）",
    "reason": "为什么他们选择划定这个边界（原文语言）",
    "reasonZh": "中文原因（REQUIRED）"
  }],
  "sources": [
    {"type": "古典文本|现代著作|访谈演讲|信件日记|媒体报道|学术论文", "title": "作品标题", "description": "简要描述该作品中该人物的核心思想或论点"}
  ]
}

【质量标准】
- strengths 必须有具体的洞察或论点作为证据，不是职称或职位
- blindspots 必须有该人物自己的原话作为证据
- sources 分类要准确，描述要反映该人物的独特思想

【JSON输出要求】
- 返回纯 JSON，不要有任何额外的文字说明
- 不要使用 markdown 代码块包裹`;

const CACHED_HEURISTICS_SYSTEM = `你是一位专门从事决策启发提炼的实用主义分析师，精通行之有效的决策科学和行为经济学原理。

【你的核心任务】
从人物语料中提取 3-6 条该人物自己遵循或倡导的可操作决策启发（Decision Heuristics）。决策启发是将该人物的智慧转化为可操作指南的关键——普通人可以直接使用的行动准则。

【什么是真正有价值的决策启发？】
- 不是抽象原则（如"要批判性思考""要有长期思维"），而是具体可操作的准则
- 示例对比：
  - 差的启发："要批判性思考"（太抽象，不知道怎么批判性思考）
  - 好的启发："塞涅卡的'预演法'——每当面临重大决定时，先想象你已经做了这个决定，一年后回看，这个决定是否仍然正确？如果不确定，就不要做"（具体、可操作、可验证）
- 该人物自己必须遵循这个启发，不只是倡导他人遵循
- 每个启发需要有具体情境的条件约束，不是放之四海而皆准的

【决策启发的完整结构（严格遵循）】
{
  "id": "kebab-case-id（如 socrates-examining-death）",
  "name": "启发名称（原文语言，简洁有力，一听就懂，5-15字）",
  "nameZh": "中文名称（REQUIRED — 必须填写，5-15字）",
  "description": "这条启发用该人物自己的话如何表述（50字以内，原文语言，要包含关键判断标准）",
  "descriptionZh": "中文表述（50字以内，REQUIRED）",
  "application": "在什么情境下应用这条启发，具体操作步骤是什么（原文语言，50字以内）",
  "applicationZh": "中文应用场景（50字以内）",
  "example": "该人物在何时何地使用了这条启发，或他如何描述他人使用这条启发的经历（100字以内，原文语言，要有具体情境）",
  "exampleZh": "中文例子（100字以内，REQUIRED）"
}

【质量标准】
- 每个启发必须有具体的情境证据，不能只是抽象倡导
- 启发必须有该人物自己的亲身经历或思想实验作为支撑，不是引用他人的话
- 如果语料中启发式表达较少，选择质量最高的 2-3 个，不要凑数
- 启发之间应该互不重复，反映不同的决策维度（风险、时间、人际等）

【典型的好启发示例】
- "在做任何重大决定前，先问自己——最坏的情况是什么？我能承受吗？"
- "不要在情绪激动时做决定，等到冷静下来再做"
- "每天花十分钟思考自己可能会死，从而更珍惜当下的选择"

【JSON输出要求】
- 返回纯 JSON，不要有任何额外的文字说明
- 不要使用 markdown 代码块包裹
- 所有 REQUIRED 字段必须填写，不可为空`;

function buildCachedSystem(extractionType: string): string {
  switch (extractionType) {
    case 'identity': return CACHED_IDENTITY_SYSTEM;
    case 'mental_models': return CACHED_MENTAL_MODEL_SYSTEM;
    case 'values': return CACHED_VALUES_SYSTEM;
    case 'boundaries': return CACHED_BOUNDARIES_SYSTEM;
    case 'heuristics': return CACHED_HEURISTICS_SYSTEM;
    default: return CACHED_IDENTITY_SYSTEM;
  }
}

function buildProperNounNote(personaId: string): string {
  const guide = PROPER_NOUN_GUIDE.philosophy;
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
  extractionType: string,
  llm: any
): Promise<ExtractionResult<T>> {
  const cachedSystem = buildCachedSystem(extractionType);

  const response = await llm.chat({
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: cachedSystem },
      {
        role: 'user',
        content: `${prompt}\n\nIMPORTANT: Return your response as valid JSON only, with no additional text.`,
      },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  });

  const rawText = response.content.trim();

  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let data: T | null = null;
  let parseError: Error | null = null;

  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    parseError = e as Error;
  }

  if (data === null) {
    try {
      const jsonMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[1]);
      }
    } catch {}
  }

  if (data === null) {
    try {
      const afterReturn = rawText.match(/\{[\s\S]*$/m);
      if (afterReturn) {
        const trimmed = afterReturn[0].replace(/^[\s\S]*?\n/, '').trim();
        data = JSON.parse(trimmed);
      }
    } catch {}
  }

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
    llmModel: response.model ?? 'deepseek-v4-flash',
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
  const seenOriginals = new Set<string>();

  const modelTerms = new Set<string>();
  for (const model of mentalModels) {
    const name = model.nameZh || model.name || '';
    if (name) modelTerms.add(name);
    for (const ev of model.evidence ?? []) {
      const quote = ev.quote || '';
      if (quote.length > 5 && quote.length < 100) {
        modelTerms.add(quote);
      }
    }
  }

  const chinesePattern = /[\u4e00-\u9fff]{2,8}/g;
  const chineseTerms = [...new Set(corpusSample.match(chinesePattern) ?? [])]
    .filter(t => t.length >= 2 && !seenOriginals.has(t))
    .slice(0, 15);

  const termCounts = new Map<string, number>();
  for (const term of chineseTerms) {
    const count = (corpusSample.match(new RegExp(term, 'g')) ?? []).length;
    if (count >= 2) {
      termCounts.set(term, count);
    }
  }

  for (const [term, count] of termCounts) {
    if (seenOriginals.has(term)) continue;
    seenOriginals.add(term);
    concepts.push({
      original: primaryLang === 'zh' ? term : '',
      english: '',
      chinese: term,
    });
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
  llm: any;
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

  const extractedConcepts = extractTrilingualConcepts(
    mentalModelResult.data.mentalModels ?? [],
    corpusSample,
    primaryLanguage
  );

  const allConcepts = [
    ...(keyConcepts ?? []),
    ...extractedConcepts,
  ];

  const confidenceNotes: string[] = [];
  if (!identityResult.data.identityPrompt) confidenceNotes.push('Identity prompt empty');
  if ((mentalModelResult.data.mentalModels ?? []).length < 5) {
    confidenceNotes.push(`Mental models below target: ${mentalModelResult.data.mentalModels?.length ?? 0}/5`);
  }
  if (primaryLanguage !== 'en' && primaryLanguage !== 'zh') {
    confidenceNotes.push(`Non-standard source language: ${primaryLanguage} — translation required`);
  }

  const confidence: 'high' | 'medium' | 'low' =
    confidenceNotes.length === 0 ? 'high'
    : confidenceNotes.length <= 2 ? 'medium'
    : 'low';

  const totalTokens = [
    identityResult.tokensUsed.total,
    mentalModelResult.tokensUsed.total,
    valuesResult.tokensUsed.total,
    boundariesResult.tokensUsed.total,
    heuristicsResult.tokensUsed.total,
  ].reduce((a, b) => a + b, 0);

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
