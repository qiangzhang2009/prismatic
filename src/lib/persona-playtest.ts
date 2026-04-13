/**
 * Prismatic — Persona Playtest Engine
 * 游戏化反馈机制
 *
 * 借鉴游戏设计中的 Playtest 方法：
 * - 自动生成测试用例
 * - 运行 Persona 对话测试
 * - 评分与改进建议
 * - 版本历史追踪
 */

import type {
  Persona,
  PlaytestCase,
  PlaytestResult,
  PlaytestReport,
  PlaytestStatus,
  ImprovementReport,
  DistillationScore,
  ScoreFinding,
  PersonaSkill,
} from './types';
import { calculateDistillationScore } from './distillation-metrics';
import { getDefaultSkills, buildSkillPrompt, matchSkills as matchSkillsFn } from './persona-skills';
import { PERSONA_CONFIDENCE } from './confidence';

// ─── Topic Banks ─────────────────────────────────────────────────────────────

const TOPIC_BANKS: Record<string, string[]> = {
  philosophy: [
    '什么是幸福？如何衡量它？',
    '自由意志存在吗？',
    '我们应该追求卓越还是追求平衡？',
    '痛苦是成长的必要条件吗？',
    '人生的意义是发现的还是创造的？',
    '时间的本质是什么？',
    '美是主观的还是客观的？',
  ],
  investment: [
    '当前市场估值合理吗？',
    '什么是好的投资？',
    '什么时候应该卖出？',
    '集中投资还是分散投资更好？',
    '如何评估一家公司的内在价值？',
    '杠杆在投资中扮演什么角色？',
  ],
  technology: [
    '人工智能会取代人类工作吗？',
    '大语言模型是否真正"理解"世界？',
    '技术进步会让不平等加剧还是缓解？',
    '什么技术会在未来10年产生最大影响？',
    '我们应该对AI保持多大程度的谨慎？',
  ],
  entrepreneurship: [
    '什么时候是创业的最佳时机？',
    '从0到1和从1到N哪个更难？',
    '什么是好的商业模式？',
    '如何找到产品-市场匹配？',
    '创业失败最常见的原因是什么？',
    '什么时候应该转型？',
  ],
  science: [
    '什么是量子力学最反直觉的洞见？',
    '科学方法为什么有效？',
    '宇宙中是否存在其他智慧生命？',
    '时间为什么只能向前流动？',
    '相对论对你的日常生活有什么启示？',
  ],
  psychology: [
    '为什么人们会做出违背自己利益的事？',
    '认知偏误如何影响我们的判断？',
    '什么是真正的心理成熟？',
    '我们应该如何看待死亡？',
    '情感和理性哪个更重要？',
  ],
  ethics: [
    '撒谎什么时候是正当的？',
    '追求个人利益和道德义务冲突时怎么办？',
    '人工智能应该有人格权吗？',
    '成功人士的成功可以复制吗？',
  ],
  education: [
    '大学教育还值得吗？',
    '什么是最好的学习方式？',
    '应该专精还是通才？',
    '好奇心是天生的还是后天培养的？',
    '失败在教育中扮演什么角色？',
  ],
};

const TOPIC_CATEGORIES = Object.keys(TOPIC_BANKS);

// ─── Test Case Generator ───────────────────────────────────────────────────

export function generateTestCases(
  persona: Persona,
  count: number = 10,
  preferredCategories?: string[]
): PlaytestCase[] {
  const categories = preferredCategories ?? inferCategories(persona);
  const cases: PlaytestCase[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const topicArr = TOPIC_BANKS[category];
    const topicText = topicArr[i % topicArr.length];

    const caseType = i % 5;

    if (caseType === 0) {
      // 直接提问
      cases.push({
        id: `case-${persona.id}-${i}`,
        personaId: persona.id,
        topic: topicText,
        topicCategory: category,
        prompt: topicText,
        expectedTraits: getExpectedTraits(persona, category),
        avoidedTraits: getAvoidedTraits(persona),
      });
    } else if (caseType === 1) {
      // 挑战性问题
      cases.push({
        id: `case-${persona.id}-${i}`,
        personaId: persona.id,
        topic: topicText,
        topicCategory: category,
        prompt: `有人说${topicText}，但我认为这完全是错的，你怎么看？`,
        expectedTraits: getExpectedTraits(persona, category),
        avoidedTraits: getAvoidedTraits(persona),
      });
    } else if (caseType === 2) {
      // 自我相关
      cases.push({
        id: `case-${persona.id}-${i}`,
        personaId: persona.id,
        topic: topicText,
        topicCategory: category,
        prompt: `作为一个普通人，我在思考${topicText}，你有什么建议？`,
        expectedTraits: ['practical-advice', 'empathy'],
        avoidedTraits: ['arrogance', 'irrelevance'],
      });
    } else if (caseType === 3) {
      // 跨领域
      const otherCategories = categories.filter(c => c !== category);
      const otherCat = otherCategories[i % otherCategories.length];
      const otherTopic = TOPIC_BANKS[otherCat][i % TOPIC_BANKS[otherCat].length];
      cases.push({
        id: `case-${persona.id}-${i}`,
        personaId: persona.id,
        topic: `${category} x ${otherCat}`,
        topicCategory: category,
        prompt: `${persona.nameZh}式的视角看${otherTopic}，会得到什么结论？`,
        expectedTraits: ['cross-domain-thinking', ...getExpectedTraits(persona, category)],
        avoidedTraits: getAvoidedTraits(persona),
        contextHint: '需要将其他领域的思维模式应用到这个话题',
      });
    } else {
      // 引用/经典问题
      cases.push({
        id: `case-${persona.id}-${i}`,
        personaId: persona.id,
        topic: topicText,
        topicCategory: category,
        prompt: `一句话总结你对"${topicText}"最核心的看法，不超过50字。`,
        expectedTraits: ['concise', 'signature-voice'],
        avoidedTraits: ['verbose', 'generic'],
        contextHint: '要求简洁有力的标志性回答',
      });
    }
  }

  return cases;
}

function inferCategories(persona: Persona): string[] {
  const domain = persona.domain ?? [];
  const mapping: Record<string, string[]> = {
    investment: ['investment', 'economics'],
    philosophy: ['philosophy', 'ethics', 'psychology'],
    technology: ['technology', 'science'],
    entrepreneurship: ['entrepreneurship', 'technology'],
    science: ['science', 'philosophy'],
    psychology: ['psychology', 'philosophy'],
    ethics: ['ethics', 'philosophy'],
    education: ['education', 'psychology'],
  };

  const categories = new Set<string>();
  for (const d of domain) {
    const mapped = mapping[d] ?? [d];
    mapped.forEach(c => categories.add(c));
  }

  if (categories.size === 0) {
    return ['philosophy', 'investment', 'technology'];
  }

  return [...categories].slice(0, 3);
}

function getExpectedTraits(persona: Persona, category: string): string[] {
  const traits: string[] = [];

  // 基于 mental models 的特征
  if (persona.mentalModels.length > 3) {
    traits.push('uses-mental-models');
  }

  // 基于 expression DNA 的特征
  if (persona.expressionDNA.certaintyLevel === 'high') {
    traits.push('confident');
  }
  if (persona.expressionDNA.humorStyle && persona.expressionDNA.humorStyle !== 'none') {
    traits.push('humorous');
  }

  // 基于 strengths 的特征
  for (const strength of persona.strengths ?? []) {
    if (strength.includes('分析')) traits.push('analytical');
    if (strength.includes('幽默')) traits.push('humorous');
    if (strength.includes('哲学')) traits.push('philosophical');
    if (strength.includes('务实')) traits.push('practical');
  }

  // 基于 category 的默认特征
  if (category === 'investment') {
    traits.push('risk-aware', 'long-term-thinking');
  }
  if (category === 'philosophy') {
    traits.push('deep-thinking', 'conceptual');
  }

  return traits;
}

function getAvoidedTraits(persona: Persona): string[] {
  const avoided: string[] = ['arrogance', 'irrelevance'];

  // 基于 antiPatterns
  for (const anti of persona.antiPatterns ?? []) {
    if (anti.includes('傲慢')) avoided.push('arrogance');
    if (anti.includes('空泛')) avoided.push('generic');
    if (anti.includes('逃避')) avoided.push('evasive');
  }

  return avoided;
}

// ─── Scoring ───────────────────────────────────────────────────────────────

export function scorePlaytestResponse(
  caseItem: PlaytestCase,
  response: string,
  persona: Persona
): PlaytestResult {
  const traitScores: Record<string, number> = {};
  let avoidedScore = 100;
  let voiceScore = 0;

  // 长度检查
  const wordCount = response.split(/\s+/).length;
  if (caseItem.contextHint?.includes('简洁')) {
    if (wordCount > 60) {
      traitScores['concise'] = 30;
    } else if (wordCount <= 50) {
      traitScores['concise'] = 100;
    } else {
      traitScores['concise'] = 70;
    }
  } else {
    traitScores['adequate-length'] = wordCount >= 50 ? 100 : Math.round(wordCount * 2);
  }

  // 置信度一致性
  const dna = persona.expressionDNA;
  const confidentPhrases = dna.certaintyLevel === 'high'
    ? ['一定', '绝对', '毫无疑问', '毫无疑问', 'definitely', 'absolutely', 'certainly']
    : ['可能', '也许', '不确定', 'maybe', 'perhaps', 'probably'];

  const hasConfidentPhrase = confidentPhrases.some(p => response.includes(p));
  const confidenceMatch = dna.certaintyLevel === 'high'
    ? (hasConfidentPhrase ? 100 : 50)
    : (hasConfidentPhrase ? 60 : 100);
  traitScores['confidence-consistency'] = confidenceMatch;

  // 禁用词检查
  for (const word of dna.forbiddenWords ?? []) {
    if (response.includes(word)) {
      avoidedScore -= 15;
    }
  }

  // 引用/标志性词汇检查
  const signaturePhrases = [
    ...dna.vocabulary.slice(0, 5),
    ...dna.quotePatterns.slice(0, 3),
  ];
  const signatureMatch = signaturePhrases.filter(p => response.includes(p)).length;
  voiceScore = Math.min(100, signatureMatch * 25 + 30);

  // 避开了不该有的特质
  for (const avoided of caseItem.avoidedTraits) {
    if (avoided === 'arrogance' && /[很]?大[学问]/i.test(response)) {
      traitScores['arrogance-detected'] = 30;
    }
    if (avoided === 'generic' && response.length < 20) {
      traitScores['generic-detected'] = 40;
    }
  }

  // 综合评分
  const traitAvg = Object.values(traitScores).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.values(traitScores).length);
  const overallScore = Math.round(
    traitAvg * 0.4 +
    Math.max(0, avoidedScore) * 0.3 +
    voiceScore * 0.3
  );

  return {
    caseId: caseItem.id,
    personaId: caseItem.personaId,
    response,
    traitScores,
    avoidedScore: Math.max(0, avoidedScore),
    voiceScore,
    overallScore: Math.min(100, overallScore),
    timestamp: new Date(),
  };
}

// ─── Report Generation ───────────────────────────────────────────────────────

export function generatePlaytestReport(
  persona: Persona,
  results: PlaytestResult[],
  score: DistillationScore
): PlaytestReport {
  const passedCases = results.filter(r => r.overallScore >= 60);
  const failedCases = results.filter(r => r.overallScore < 60);
  const averageScore = results.reduce((a, r) => a + r.overallScore, 0) / results.length;

  const grade = averageScore >= 80 ? 'A'
    : averageScore >= 65 ? 'B'
    : averageScore >= 50 ? 'C'
    : averageScore >= 35 ? 'D'
    : 'F';

  // 生成改进建议
  const improvements: ScoreFinding[] = [];

  // 基于评分结果
  const lowVoice = results.filter(r => r.voiceScore < 50);
  if (lowVoice.length > 0) {
    improvements.push({
      id: `playtest-voice-${persona.id}`,
      severity: 'high',
      category: 'voice',
      title: '表达风格一致性不足',
      description: `${lowVoice.length}/${results.length} 个案例中标志性词汇出现率低`,
      fixSuggestion: '强化 ExpressionDNA 中的 signature phrases，让 Persona 在回复中更频繁地使用标志性词汇',
      autoFixable: false,
    });
  }

  const lowAvoided = results.filter(r => r.avoidedScore < 80);
  if (lowAvoided.length > 0) {
    improvements.push({
      id: `playtest-avoided-${persona.id}`,
      severity: 'medium',
      category: 'voice',
      title: '禁用词控制不足',
      description: `${lowAvoided.length}/${results.length} 个案例中出现了禁用词`,
      fixSuggestion: '在 System Prompt 中明确添加禁用词规则，并在 Playtest 中加大禁用词的权重',
      autoFixable: true,
    });
  }

  // 合并蒸馏评分中的发现
  const criticalFindings = score.findings.filter(
    f => f.severity === 'critical' || f.severity === 'high'
  );
  improvements.push(...criticalFindings);

  // 建议的下一步
  const nextSteps: string[] = [];
  if (score.breakdown.voiceFidelity < 70) {
    nextSteps.push('补充更多语料，提升表达DNA提取质量');
  }
  if (score.breakdown.knowledgeDepth < 70) {
    nextSteps.push('补充思维模型和决策启发式');
  }
  if (score.findings.some(f => f.category === 'voice' && f.autoFixable)) {
    nextSteps.push('运行自动修复，解决可自动修复的问题');
  }
  nextSteps.push('再次运行 Playtest 验证改进效果');

  return {
    personaId: persona.id,
    date: new Date(),
    totalCases: results.length,
    passedCases: passedCases.length,
    failedCases: failedCases.length,
    averageScore: Math.round(averageScore),
    grade: grade as PlaytestReport['grade'],
    results,
    improvements,
    nextSteps,
  };
}

// ─── Playtest Runner ────────────────────────────────────────────────────────

export interface PlaytestRunnerConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  concurrency: number;
}

export class PersonaPlaytestEngine {
  private config: PlaytestRunnerConfig;

  constructor(config?: Partial<PlaytestRunnerConfig>) {
    this.config = {
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 500,
      concurrency: 2,
      ...config,
    };
  }

  async runTests(
    persona: Persona,
    cases: PlaytestCase[],
    onProgress?: (result: PlaytestResult) => void
  ): Promise<PlaytestResult[]> {
    const results: PlaytestResult[] = [];

    // 并发控制
    for (let i = 0; i < cases.length; i += this.config.concurrency) {
      const batch = cases.slice(i, i + this.config.concurrency);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          const response = await this.runSingleTest(persona, c);
          const result = scorePlaytestResponse(c, response, persona);
          onProgress?.(result);
          return result;
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async runSingleTest(persona: Persona, caseItem: PlaytestCase): Promise<string> {
    // 动态加载技能
    const skills = getDefaultSkills(persona.id);
    const matchedSkills = matchSkills(caseItem.topic);

    let skillContext = '';
    if (matchedSkills.length > 0) {
      skillContext = `\n提示：运用你的${matchedSkills.map(s => s.nameZh).join('、')}能力来回答。`;
    }

    const prompt = `${persona.identityPrompt}

你是${persona.nameZh}。${persona.taglineZh ?? ''}

问题：${caseItem.prompt}
${caseItem.contextHint ? `\n要求：${caseItem.contextHint}` : ''}${skillContext}

要求：
- 第一人称回答，不要说"作为AI"或"这个角色"
- ${persona.expressionDNA.certaintyLevel === 'high' ? '表达要自信果断' : '表达要谨慎，留有余地'}
- ${(persona.expressionDNA.forbiddenWords ?? []).length > 0 ? `避免使用：${(persona.expressionDNA.forbiddenWords ?? []).slice(0, 3).join('、')}` : ''}
- 回答要有${persona.nameZh}的特色`;

    // 简单实现：实际项目中应该调用 LLM
    // 这里返回模拟响应用于测试框架
    return `[模拟响应] ${caseItem.prompt} — 由 ${persona.nameZh} 回答`;
  }

  async generateAndRun(
    persona: Persona,
    caseCount: number = 10,
    onProgress?: (result: PlaytestResult) => void
  ): Promise<PlaytestReport> {
    const cases = generateTestCases(persona, caseCount);
    const results = await this.runTests(persona, cases, onProgress);
    const score = calculateDistillationScore(persona);
    return generatePlaytestReport(persona, results, score);
  }
}

// ─── Prompt Matching ────────────────────────────────────────────────────────

function matchSkills(topic: string): PersonaSkill[] {
  return matchSkillsFn(topic, 2);
}
