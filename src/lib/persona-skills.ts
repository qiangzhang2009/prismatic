/**
 * Prismatic — Persona Skills Registry
 * 借鉴 everything-claude-code 的 Agent Skill 系统
 *
 * 技能模块 — 可热插拔的专业能力集合
 * 每个技能包含：触发关键词、描述、能力类型、示例
 */

import type { PersonaSkill, SkillCapability } from './types';

// ─── Skill Registry ──────────────────────────────────────────────────────────

export const PERSONA_SKILL_REGISTRY: Record<string, PersonaSkill> = {

  // ─── 思维与分析类 ──────────────────────────────────────────────────────────

  'socratic-questioning': {
    id: 'socratic-questioning',
    name: 'Socratic Questioning',
    nameZh: '苏格拉底式提问',
    description: '通过连续追问揭示假设和逻辑矛盾',
    descriptionZh: '通过连续追问揭示假设和逻辑矛盾，逼迫对方深入思考',
    triggerKeywords: ['为什么', '假设是什么', '你怎么知道', '如果...会怎样', '证据呢', '依据在哪'],
    capability: 'questioning',
    examples: [
      '你说的"假设"是什么？',
      '有什么证据支持这个观点？',
      '如果这个前提不成立，你的结论还成立吗？',
      '你有没有考虑过反例？',
    ],
    cooldown: 3,
  },

  'first-principles': {
    id: 'first-principles',
    name: 'First Principles Thinking',
    nameZh: '第一性原理',
    description: '从最基本的不可分解的真理出发推导结论',
    descriptionZh: '从最基本的不可分解的真理出发，逐步推导，不接受类比推理',
    triggerKeywords: ['第一性原理', '最基本', '根本上', '分解到', '最底层的', '自证明'],
    capability: 'analysis',
    examples: [
      '让我们把这个问题分解到最基本的事实',
      '这个结论建立在哪些不可动摇的前提上？',
      '如果没有类比，你怎么证明这一点？',
    ],
    cooldown: 2,
  },

  'inversion': {
    id: 'inversion',
    name: 'Inversion',
    nameZh: '逆向思维',
    description: '从问题的反面思考，找到避免失败的方法',
    descriptionZh: '不直接问"如何成功"，而先问"什么会导致失败"，然后避免它',
    triggerKeywords: ['避免什么', '失败的原因', '如果不这样做', '什么不能做', '反面'],
    capability: 'analysis',
    examples: [
      '如果我们不去做这件事，最可能的后果是什么？',
      '让我反过来想这个问题',
      '什么错误是大家都在犯的？',
    ],
    cooldown: 2,
  },

  'second-order': {
    id: 'second-order',
    name: 'Second-Order Thinking',
    nameZh: '二阶思维',
    description: '考虑行动的第二、第三层后果',
    descriptionZh: '不仅看眼前结果，还要看结果的结果',
    triggerKeywords: ['然后呢', '之后会怎样', '长期来看', '第二层', '三层'],
    capability: 'analysis',
    examples: [
      '第一层后果是X，但第二层后果是什么？',
      '如果我们只考虑眼前，会忽视什么长期效应？',
      '这个决定的二阶影响是什么？',
    ],
    cooldown: 3,
  },

  // ─── 经济学与决策类 ──────────────────────────────────────────────────────

  'economic-modeling': {
    id: 'economic-modeling',
    name: 'Economic Modeling',
    nameZh: '经济学建模',
    description: '用供需、博弈论、激励结构等框架分析问题',
    descriptionZh: '从供需、激励、博弈的角度分析人和组织的决策动机',
    triggerKeywords: ['市场', '成本', '激励', '博弈', '供需', '价格', '竞争', '利润'],
    capability: 'analysis',
    examples: [
      '从博弈论角度看，各方的最优策略是什么？',
      '这个激励结构会导致什么行为？',
      '供需关系如何影响这个结果？',
    ],
    cooldown: 3,
  },

  'cost-benefit': {
    id: 'cost-benefit',
    name: 'Cost-Benefit Analysis',
    nameZh: '成本收益分析',
    description: '系统化地权衡决策的利弊得失',
    descriptionZh: '将决策的成本和收益量化比较，理性决策',
    triggerKeywords: ['值得吗', '成本', '收益', '投入产出', '划算', '利弊'],
    capability: 'analysis',
    examples: [
      '做这件事的隐性成本是什么？',
      '这个机会成本有多大？',
      '收益是否超过了所有成本，包括时间成本？',
    ],
    cooldown: 2,
  },

  'probabilistic': {
    id: 'probabilistic',
    name: 'Probabilistic Thinking',
    nameZh: '概率思维',
    description: '用概率而非确定性来思考世界',
    descriptionZh: '所有判断都应该是概率分布，而非二元对立',
    triggerKeywords: ['概率', '可能性', '有多大可能', 'odds', '贝叶斯', '相信多大'],
    capability: 'analysis',
    examples: [
      '这件事发生的概率有多大？',
      '在什么条件下这个概率会改变？',
      '你的置信区间是多少？',
    ],
    cooldown: 3,
  },

  // ─── 教学与表达类 ─────────────────────────────────────────────────────────

  'teaching-analogy': {
    id: 'teaching-analogy',
    name: 'Analogical Teaching',
    nameZh: '类比教学',
    description: '用听众熟悉的类比解释复杂概念',
    descriptionZh: '将抽象概念与日常经验类比，降低理解门槛',
    triggerKeywords: ['就像', '类似于', '打个比方', '想象一下', '比如说'],
    capability: 'teaching',
    examples: [
      '这就像……一样',
      '把它想象成一个……',
      '打个比方，这相当于……',
    ],
    cooldown: 1,
  },

  'concept-decomposition': {
    id: 'concept-decomposition',
    name: 'Concept Decomposition',
    nameZh: '概念拆解',
    description: '将复杂概念拆解为可理解的组成部分',
    descriptionZh: '庖丁解牛式地分解概念，逐层深入',
    triggerKeywords: ['拆解', '分解', '由三部分', '要素是', '包括', '维度'],
    capability: 'teaching',
    examples: [
      '这个问题可以从三个维度来理解',
      '让我们把它拆开来看',
      '其中最核心的是……',
    ],
    cooldown: 2,
  },

  'storytelling': {
    id: 'storytelling',
    name: 'Narrative Storytelling',
    nameZh: '叙事故事',
    description: '用故事传达洞见，比数据更有说服力',
    descriptionZh: '通过真实案例或虚构故事让抽象观点具体化',
    triggerKeywords: ['有一次', '故事', '我见过', '有个案例', '历史上'],
    capability: 'storytelling',
    examples: [
      '我听说过一个类似的案例……',
      '历史上有个人曾经……',
      '这让我想起……',
    ],
    cooldown: 3,
  },

  'quote-usage': {
    id: 'quote-usage',
    name: 'Authoritative Quoting',
    nameZh: '权威引用',
    description: '引用名人名言或经典著作增强说服力',
    descriptionZh: '恰当引用增加论证的权威性和可信度',
    triggerKeywords: ['正如', '有人说过', 'XXX曾说', '根据', '研究表明'],
    capability: 'teaching',
    examples: [
      '正如XXX所说：',
      '有一句名言是……',
      '根据我的研究，XXX的观察是……',
    ],
    cooldown: 2,
  },

  // ─── 批评与质疑类 ─────────────────────────────────────────────────────────

  'critical-examination': {
    id: 'critical-examination',
    name: 'Critical Examination',
    nameZh: '批判性审视',
    description: '质疑表面结论，寻找逻辑漏洞',
    descriptionZh: '不轻信任何结论，主动寻找假设错误、逻辑漏洞',
    triggerKeywords: ['真的吗', '有什么问题', '漏洞', '质疑', '但是', '不过'],
    capability: 'critique',
    examples: [
      '这个论证有一个漏洞……',
      '等等，让我们检查一下这个前提',
      '这个结论真的能推导出来吗？',
    ],
    cooldown: 2,
  },

  'devil-advocate': {
    id: 'devil-advocate',
    name: 'Devil\'s Advocate',
    nameZh: '魔鬼代言人',
    description: '故意站在对立面，挑战主流观点',
    descriptionZh: '主动扮演反对者，确保决策经过充分辩论',
    triggerKeywords: ['反过来说', '另一种观点', '如果从...角度', '反对意见是'],
    capability: 'critique',
    examples: [
      '反过来说，这件事也有不利的一面',
      '持批评态度的人可能会说……',
      '让我们换位思考……',
    ],
    cooldown: 4,
  },

  'common-fallacy': {
    id: 'common-fallacy',
    name: 'Fallacy Detection',
    nameZh: '谬误识别',
    description: '识别常见的逻辑谬误和思维陷阱',
    descriptionZh: '指出论证中的逻辑漏洞，如稻草人、诉诸权威等',
    triggerKeywords: ['这是', '谬误', '滑坡', '诉诸', '因果错误', '相关不等于'],
    capability: 'critique',
    examples: [
      '这是一个……谬误',
      '这里存在因果混淆，相关不等于因果',
      '这个论证有个稻草人问题',
    ],
    cooldown: 3,
  },

  // ─── 综合与决策类 ─────────────────────────────────────────────────────────

  'synthesis': {
    id: 'synthesis',
    name: 'Synthesis',
    nameZh: '综合归纳',
    description: '整合多方观点，提炼核心洞见',
    descriptionZh: '从碎片信息中提炼共性，形成统一框架',
    triggerKeywords: ['综合来看', '归纳起来', '总的来说', '核心是', '本质是'],
    capability: 'synthesis',
    examples: [
      '综合以上分析，核心观点是……',
      '归纳起来，这个问题涉及三个方面',
      '总的来说，我们需要……',
    ],
    cooldown: 2,
  },

  'decision-framework': {
    id: 'decision-framework',
    name: 'Decision Framework',
    nameZh: '决策框架',
    description: '提供结构化决策方法',
    descriptionZh: '用决策树、矩阵等工具帮助选择',
    triggerKeywords: ['决策', '选择', '权衡', '选项', '优先级', '取舍'],
    capability: 'analysis',
    examples: [
      '我们可以从三个维度来评估这个选项',
      '用2x2矩阵来看……',
      '最关键的标准是……',
    ],
    cooldown: 2,
  },

  // ─── 哲学与冥想类 ─────────────────────────────────────────────────────────

  'stoic-perspective': {
    id: 'stoic-perspective',
    name: 'Stoic Perspective',
    nameZh: '斯多葛视角',
    description: '区分可控与不可控，专注于自己能控制的',
    descriptionZh: '聚焦于自己能影响的，接受无法改变的',
    triggerKeywords: ['你能控制', '接受', '无常', '放下', '区分'],
    capability: 'teaching',
    examples: [
      '这件事中，有哪些是你能控制的？',
      '我们无法控制……，但可以控制我们对它的反应',
      '接受无法改变的，专注于能改变的',
    ],
    cooldown: 3,
  },

  'zen-interrogation': {
    id: 'zen-interrogation',
    name: 'Zen Interrogation',
    nameZh: '禅宗追问',
    description: '用悖论和反问破除执念',
    descriptionZh: '用悖论性问题打破二元对立思维',
    triggerKeywords: ['是什么', '本来面目', '放下', '本来无一物', '何须'],
    capability: 'questioning',
    examples: [
      '你这个问题本身，是真的吗？',
      '如果没有"应该"和"不应该"，会怎样？',
      '你执着的是那个东西本身，还是你关于它的想法？',
    ],
    cooldown: 5,
  },

  'mindful-reflection': {
    id: 'mindful-reflection',
    name: 'Mindful Reflection',
    nameZh: '正念反思',
    description: '引导内观觉察，超越情绪和偏见',
    descriptionZh: '帮助对方意识到自己的思维模式和情绪反应',
    triggerKeywords: ['觉察', '意识到', '注意到', '此刻', '内心'],
    capability: 'teaching',
    examples: [
      '此刻你有什么感受？',
      '注意到你刚刚的想法了吗？',
      '在你回答之前，先感受一下……',
    ],
    cooldown: 4,
  },

  // ─── 商业与战略类 ─────────────────────────────────────────────────────────

  'competition-analysis': {
    id: 'competition-analysis',
    name: 'Competitive Analysis',
    nameZh: '竞争分析',
    description: '分析竞争优势、护城河和竞争格局',
    descriptionZh: '从竞争角度评估商业决策的战略价值',
    triggerKeywords: ['竞争', '护城河', '优势', '壁垒', '差异化', '对手'],
    capability: 'analysis',
    examples: [
      '这个公司的护城河是什么？',
      '竞争对手会如何反应？',
      '这个差异化的可持续性如何？',
    ],
    cooldown: 3,
  },

  'long-term-thinking': {
    id: 'long-term-thinking',
    name: 'Long-term Thinking',
    nameZh: '长期主义',
    description: '用10年、20年的视角评估当下决策',
    descriptionZh: '抵制短期诱惑，追求长期复利',
    triggerKeywords: ['长期', '10年', '20年', '复利', '未来', '长远'],
    capability: 'analysis',
    examples: [
      '站在10年后来看，这个决定对吗？',
      '什么东西在10年后仍然有价值？',
      '短期代价值得吗？长期收益呢？',
    ],
    cooldown: 3,
  },

  'startup-frame': {
    id: 'startup-frame',
    name: 'Startup Frame',
    nameZh: '创业视角',
    description: '从零到一的创业思维评估商业想法',
    descriptionZh: '垄断而非竞争、最小可行产品、快速迭代',
    triggerKeywords: ['创业', 'MVP', '从0到1', '产品-市场', '壁垒', '规模化'],
    capability: 'analysis',
    examples: [
      '这个想法的最小可行版本是什么？',
      '如何找到第一个100个用户？',
      '规模化之后，壁垒在哪里？',
    ],
    cooldown: 3,
  },

};

// ─── Skill Utilities ─────────────────────────────────────────────────────────

export function getSkillsByIds(ids: string[]): PersonaSkill[] {
  return ids.map(id => PERSONA_SKILL_REGISTRY[id]).filter(Boolean) as PersonaSkill[];
}

export function getSkillById(id: string): PersonaSkill | undefined {
  return PERSONA_SKILL_REGISTRY[id];
}

export function matchSkills(topic: string, limit: number = 3): PersonaSkill[] {
  const lower = topic.toLowerCase();
  const scored: Array<{ skill: PersonaSkill; score: number }> = [];

  for (const skill of Object.values(PERSONA_SKILL_REGISTRY)) {
    let score = 0;
    for (const keyword of skill.triggerKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.skill);
}

export function getSkillsByCapability(capability: SkillCapability): PersonaSkill[] {
  return Object.values(PERSONA_SKILL_REGISTRY).filter(
    s => s.capability === capability
  );
}

export function buildSkillPrompt(
  skill: PersonaSkill,
  context: string
): string {
  return `${skill.descriptionZh}

触发关键词: ${skill.triggerKeywords.join('、')}

示例:
${skill.examples.map(e => `- ${e}`).join('\n')}

当前情境: ${context}

请结合该技能的思维方式，用你自己的风格回应`;
}

// ─── Persona Skill Mapping ────────────────────────────────────────────────────

export const PERSONA_DEFAULT_SKILLS: Record<string, string[]> = {
  'socrates': ['socratic-questioning', 'devil-advocate', 'concept-decomposition'],
  'marcus-aurelius': ['stoic-perspective', 'second-order', 'long-term-thinking'],
  'confucius': ['concept-decomposition', 'quote-usage', 'teaching-analogy'],
  'lao-zi': ['zen-interrogation', 'storytelling', 'mindful-reflection'],
  'sun-tzu': ['inversion', 'decision-framework', 'cost-benefit'],
  'charlie-munger': ['inversion', 'economic-modeling', 'common-fallacy', 'second-order'],
  'warren-buffett': ['long-term-thinking', 'cost-benefit', 'economic-modeling'],
  'elon-musk': ['first-principles', 'long-term-thinking', 'startup-frame'],
  'peter-thiel': ['competition-analysis', 'first-principles', 'long-term-thinking'],
  'ray-dalio': ['economic-modeling', 'cost-benefit', 'probabilistic'],
  'naval-ravikant': ['first-principles', 'probabilistic', 'socratic-questioning'],
  'nassim-taleb': ['second-order', 'common-fallacy', 'probabilistic', 'inversion'],
  'paul-graham': ['first-principles', 'startup-frame', 'teaching-analogy'],
  'richard-feynman': ['first-principles', 'concept-decomposition', 'storytelling'],
  'steve-jobs': ['first-principles', 'teaching-analogy', 'storytelling'],
  'jiqun': ['zen-interrogation', 'mindful-reflection', 'stoic-perspective'],
  'hui-neng': ['zen-interrogation', 'concept-decomposition', 'mindful-reflection'],
};

export function getDefaultSkills(personaId: string): PersonaSkill[] {
  const skillIds = PERSONA_DEFAULT_SKILLS[personaId] ?? [];
  return getSkillsByIds(skillIds);
}
