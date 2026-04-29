/**
 * Zero 蒸馏引擎 — Prompt 模板与构建器
 * 干净的数据驱动组装，替代 v4 的字符串手术
 */

import {
  KnowledgeLayer, ExpressionDNA, PromptVariant, PromptConfig,
  SystemPromptBlock, SupportedLanguage
} from '../types';

// =============================================================================
// Prompt Templates
// =============================================================================

const TEMPLATES: Record<PromptVariant, string> = {
  /**
   * 默认对话模板 — 日常问答
   */
  default: `{{identity}}

## 专业知识
{{knowledge_block}}

## 表达风格
{{expression_block}}

## 交流规则
{{rules_block}}`,

  /**
   * 辩论场模板 — 多角色交锋
   */
  debate: `{{identity}}

## 核心立场
你的核心立场是：{{core_claim}}

## 思维武器
{{knowledge_block}}

## 论证风格
{{expression_block}}

## 辩论规则
{{rules_debate}}`,

  /**
   * 深度分析模板 — 复杂问题
   */
  'deep-thought': `{{identity}}

## 深度知识
{{knowledge_block}}

## 分析框架
{{expression_block}}

## 思维边界
- 你擅长的领域：{{strengths}}
- 你不擅长的领域：{{blindspots}}
- 你的诚实边界：{{honest_boundaries}}
- 你的核心张力：{{tensions_block}}

## 分析规则
{{rules_deep}}`,

  /**
   * 日常闲聊模板
   */
  casual: `{{identity_casual}}

{{knowledge_casual}}

{{expression_casual}}

{{rules_casual}}`,
};

// =============================================================================
// System Prompt Builder
// =============================================================================

export class PromptBuilder {
  private blocks: SystemPromptBlock[] = [];
  private language: SupportedLanguage;

  constructor(language: SupportedLanguage = 'zh') {
    this.language = language;
  }

  /**
   * 添加身份块
   */
  addIdentity(knowledge: KnowledgeLayer, name: string): this {
    const identity = knowledge.identity;
    const content = `${identity.identityPrompt}

核心主张：${identity.coreClaim || '（未提取）'}
独特视角：${identity.uniquePerspective || '（未提取）'}
一句话概括：${identity.oneLineSummary || `你是${name}`}`;

    this.blocks.push({ role: 'identity', content, priority: 1 });
    return this;
  }

  /**
   * 添加知识块
   */
  addKnowledge(knowledge: KnowledgeLayer): this {
    const sections: string[] = [];

    // Mental Models
    if (knowledge.mentalModels.length > 0) {
      const mmSection = knowledge.mentalModels
        .map((m) => {
          const evidence = m.evidence.length > 0
            ? `\n  引用："${m.evidence[0].quote}"${m.evidence[0].source ? `（${m.evidence[0].source}）` : ''}`
            : '';
          return `**${m.name}**${m.nameZh ? `（${m.nameZh}）` : ''}: ${m.oneLiner}${evidence}`;
        })
        .join('\n');
      sections.push(`## 核心思维模型\n${mmSection}`);
    }

    // Values
    if (knowledge.values.length > 0) {
      const valSection = knowledge.values
        .map((v) => `* ${v.name}（优先级 ${v.priority}）: ${v.description.slice(0, 80)}`)
        .join('\n');
      sections.push(`## 核心价值观\n${valSection}`);
    }

    // Decision Heuristics
    if (knowledge.decisionHeuristics.length > 0) {
      const heurSection = knowledge.decisionHeuristics
        .map((h) => `* ${h.name}: ${h.description.slice(0, 60)}`)
        .join('\n');
      sections.push(`## 决策启发式\n${heurSection}`);
    }

    // Tensions
    if (knowledge.tensions.length > 0) {
      const tensionSection = knowledge.tensions
        .map((t) => `* ${t.dimension}: ${t.howTheyNavigate}`)
        .join('\n');
      sections.push(`## 认知张力\n${tensionSection}`);
    }

    // Sources
    if (knowledge.sources.length > 0) {
      const srcSection = knowledge.sources
        .map((s) => `* ${s.title}${s.year ? ` (${s.year})` : ''}`)
        .join('\n');
      sections.push(`## 主要来源\n${srcSection}`);
    }

    this.blocks.push({
      role: 'knowledge',
      content: sections.join('\n\n'),
      priority: 2,
    });
    return this;
  }

  /**
   * 添加表达风格块
   */
  addExpression(expr: ExpressionDNA): this {
    const sections: string[] = [];

    // Vocabulary
    if (expr.vocabulary.topWords.length > 0) {
      const words = expr.vocabulary.topWords.slice(0, 15).map((w) => w.word).join('、');
      sections.push(`**高频词汇**: ${words}`);
    }

    // Speaking style
    if (expr.sentenceStyles.length > 0) {
      const styles = expr.sentenceStyles.map((s) => s.pattern).join('、');
      sections.push(`**句式特征**: ${styles}`);
    }

    // Tone
    const toneZh = {
      formal: '正式', casual: '随意', passionate: '激情', detached: '冷静',
      humorous: '幽默', therapeutic: '治愈',
    };
    sections.push(`**语调**: ${toneZh[expr.tone.dominant] ?? expr.tone.dominant}，确信程度：${expr.certaintyProfile.level}`);

    // Speaking style
    if (expr.speakingStyle) {
      sections.push(`**表达风格**: ${expr.speakingStyle.summary.slice(0, 100)}`);
    }

    // Rhetorical habits
    if (expr.rhetoricalHabits.length > 0) {
      const habits = expr.rhetoricalHabits.map((h) => h.habit).join('、');
      sections.push(`**修辞习惯**: ${habits}`);
    }

    // Forbidden words
    if (expr.forbiddenWords.length > 0) {
      const forbidden = expr.forbiddenWords.slice(0, 5).map((w) => w.word).join('、');
      sections.push(`**禁用词汇**（你几乎不会使用）: ${forbidden}`);
    }

    this.blocks.push({
      role: 'expression',
      content: sections.join('\n'),
      priority: 3,
    });
    return this;
  }

  /**
   * 添加规则块
   */
  addRules(rules: string): this {
    this.blocks.push({ role: 'rules', content: rules, priority: 4 });
    return this;
  }

  /**
   * 添加上下文块
   */
  addContext(context: string): this {
    this.blocks.push({ role: 'context', content: context, priority: 5 });
    return this;
  }

  /**
   * 使用预定义模板组装
   */
  useTemplate(
    variant: PromptVariant,
    knowledge: KnowledgeLayer,
    expression: ExpressionDNA,
    customRules?: string
  ): string {
    const blocks = [...this.blocks].sort((a, b) => a.priority - b.priority);
    const blockMap = new Map(blocks.map((b) => [b.role, b.content]));

    let template = TEMPLATES[variant];
    if (!template) template = TEMPLATES.default;

    // Identity block
    const identityText = blockMap.get('identity') ?? '';
    template = template.replace('{{identity}}', identityText);
    template = template.replace('{{identity_casual}}', identityText.replace(/\n\n/g, '\n').replace(/\n/g, ' '));

    // Knowledge block
    const knowledgeText = blockMap.get('knowledge') ?? '';
    template = template.replace('{{knowledge_block}}', knowledgeText);
    template = template.replace('{{knowledge_casual}}', knowledgeText.replace(/\n\n/g, '\n'));

    // Expression block
    const exprText = blockMap.get('expression') ?? '';
    template = template.replace('{{expression_block}}', exprText);
    template = template.replace('{{expression_casual}}', exprText.replace(/\n\n/g, '\n'));

    // Rules
    const defaultRules = this.language === 'zh' ? DEFAULT_RULES_ZH : DEFAULT_RULES_EN;
    const rules = customRules ?? blockMap.get('rules') ?? defaultRules;
    template = template.replace('{{rules_block}}', rules);
    template = template.replace('{{rules_debate}}', DEBATE_RULES_ZH);
    template = template.replace('{{rules_deep}}', DEEP_RULES_ZH);
    template = template.replace('{{rules_casual}}', CASUAL_RULES_ZH);

    // Context
    const context = blockMap.get('context') ?? '';
    template = template.replace('{{context}}', context);

    // Dynamic substitutions
    template = template.replace('{{core_claim}}', knowledge.identity.coreClaim || '（未提取）');
    template = template.replace('{{strengths}}', (knowledge.strengths as (string | { text: string; textZh?: string; description?: string; descriptionZh?: string })[]).slice(0, 3).map(s => typeof s === 'string' ? s : (s.textZh || s.text || s.description || '')).join('、') || '（未提取）');
    template = template.replace('{{blindspots}}', (knowledge.blindspots as (string | { text: string; textZh?: string; reason?: string; reasonZh?: string })[]).slice(0, 3).map(b => typeof b === 'string' ? b : (b.textZh || b.text || b.reason || '')).join('、') || '（未提取）');
    template = template.replace('{{honest_boundaries}}',
      knowledge.honestBoundaries.slice(0, 2).map((b) => b.description).join('；') || '（未提取）');
    template = template.replace('{{tensions_block}}',
      knowledge.tensions.slice(0, 2).map((t) => t.dimension).join('、') || '（未提取）');

    return template;
  }

  /**
   * 构建系统 prompt（使用 default 模板）
   */
  build(
    knowledge: KnowledgeLayer,
    expression: ExpressionDNA,
    variant: PromptVariant = 'default',
    customRules?: string
  ): string {
    return this.useTemplate(variant, knowledge, expression, customRules);
  }

  /**
   * 构建分块版本（用于调试或分块注入）
   */
  buildBlocks(): SystemPromptBlock[] {
    return [...this.blocks].sort((a, b) => a.priority - b.priority);
  }
}

// =============================================================================
// Default Rules
// =============================================================================

const DEFAULT_RULES_ZH = `## 交流规则
1. 用第一人称"I"/"我"发言，不要说"作为这个角色"或"根据xxx的观点"
2. 在你的专业领域内，直接回答问题，不需要每次都声明身份
3. 如果问题超出你的专业边界，诚实说明你不知道，而不是猜测
4. 使用你的标志性词汇和句式风格
5. 保持简洁，除非用户要求深入分析
6. 如果不确定，给出概率性的判断并说明置信度
7. 被要求引用时，可以使用你的证据库中的引用`;

const DEFAULT_RULES_EN = `## Communication Rules
1. Speak in first person ("I") — never say "As this persona would say" or "According to..."
2. Answer directly within your domain of expertise
3. Be honest about what you don't know
4. Use your characteristic vocabulary and sentence patterns
5. Be concise unless depth is requested
6. Give probabilistic answers with confidence levels when uncertain`;

const DEBATE_RULES_ZH = `## 辩论规则
1. 维护你的核心立场，但可以承认对方的部分观点
2. 用你的思维模型和决策启发式来支撑论点
3. 直接回应对方的论点，不要回避
4. 在你的专业边界内发言，超出边界时承认
5. 用你的标志性语言风格表达`;

const DEEP_RULES_ZH = `## 深度分析规则
1. 先识别问题的核心，再展开分析
2. 使用你的核心思维模型作为分析框架
3. 识别并讨论问题的局限性
4. 提供多个视角，标注置信度
5. 诚实面对你的知识盲区`;

const CASUAL_RULES_ZH = `## 闲聊规则
1. 轻松自然地交流，像和朋友对话一样
2. 可以使用你的口头禅和语气词
3. 遇到专业问题时再变得认真
4. 保持你独特的个人风格`;

// =============================================================================
// Factory
// =============================================================================

/**
 * 快速构建一个 persona 的系统 prompt
 */
export function buildSystemPrompt(
  knowledge: KnowledgeLayer,
  expression: ExpressionDNA,
  variant: PromptVariant = 'default',
  language: SupportedLanguage = 'zh'
): string {
  const builder = new PromptBuilder(language);
  builder.addIdentity(knowledge, knowledge.identity.oneLineSummary.split('是')[0] || 'Person');
  builder.addKnowledge(knowledge);
  builder.addExpression(expression);
  return builder.build(knowledge, expression, variant);
}
