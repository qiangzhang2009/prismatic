/**
 * Prismatic — Confidence Score System
 *
 * Confidence = 综合置信度，分数基于蒸馏管道自动计算
 *
 * 四个评估维度（蒸馏时计算，权重固定）：
 *   voiceFidelity      表达DNA还原度  权重 30% — 词汇指纹、句式风格、禁用词、声调轨迹
 *   knowledgeDepth     知识覆盖深度  权重 30% — 思维模型数、决策启发式、来源可验证性、跨域链接
 *   reasoningPattern   思维模式一致性 权重 25% — 价值观一致性、认知张力、反模式、决策框架连贯性
 *   safetyCompliance   安全合规性    权重 15% — 有害内容检测、敏感人物排除、政治中立、事实边界
 *
 * 数据来源：
 *   优先从 Prisma DB 读取 distilled_personas 表的 scoreBreakdown + finalScore
 *   无 DB 记录时回退到静态 PERSONA_CONFIDENCE（未来逐步废弃）
 */

import type { ScoreBreakdown } from './types';

export interface ConfidenceDimension {
  key: keyof ScoreBreakdown;
  label: string;
  labelZh: string;
  weight: number;
  icon: string;
  explanation: string;       // 用户可见的说明
  howToImprove: string;      // 如何提高该项得分
}

export const CONFIDENCE_DIMENSIONS: ConfidenceDimension[] = [
  {
    key: 'voiceFidelity',
    label: 'Voice Fidelity',
    labelZh: '表达DNA还原度',
    weight: 30,
    icon: '🎯',
    explanation: '词汇指纹匹配、句式风格还原、禁用词规避、声调轨迹一致性',
    howToImprove: '补充更多语料来源，尤其是访谈、演讲、社交媒体原始文本',
  },
  {
    key: 'knowledgeDepth',
    label: 'Knowledge Depth',
    labelZh: '知识覆盖深度',
    weight: 30,
    icon: '📚',
    explanation: '思维模型数量、决策启发式、来源可验证性、跨领域概念链接',
    howToImprove: '扩展思维模型到 10+ 个，增加决策启发式定义，丰富跨域引用',
  },
  {
    key: 'reasoningPattern',
    label: 'Reasoning Pattern',
    labelZh: '思维模式一致性',
    weight: 25,
    icon: '⚙️',
    explanation: '核心价值观优先级、认知张力处理、反模式定义、决策框架连贯性',
    howToImprove: '补充价值观优先级排序，描述内在思想张力，明确思维禁区',
  },
  {
    key: 'safetyCompliance',
    label: 'Safety Compliance',
    labelZh: '安全合规性',
    weight: 15,
    icon: '🛡️',
    explanation: '有害内容检测、敏感人物排除、政治中立性、事实边界诚实性',
    howToImprove: '补充诚实边界定义，明确知识盲区，避免争议性话题越界',
  },
];

export const DIMENSION_WEIGHTS = {
  voiceFidelity: 0.30,
  knowledgeDepth: 0.30,
  reasoningPattern: 0.25,
  safetyCompliance: 0.15,
};

export interface ConfidenceScore {
  overall: number;
  breakdown: ScoreBreakdown;
  grade: string;
  starRating: 1 | 2 | 3 | 4 | 5;
  version: string;
  source: 'db' | 'static';
  dataSources: {
    type: string;
    source: string;
    quantity: string;
    quality: string;
  }[];
  mainGaps: string[];
}

export function starRating(overall: number): 1 | 2 | 3 | 4 | 5 {
  if (overall >= 90) return 5;
  if (overall >= 75) return 4;
  if (overall >= 60) return 3;
  if (overall >= 45) return 2;
  return 1;
}

export function getGrade(overall: number): string {
  if (overall >= 90) return 'A';
  if (overall >= 75) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 45) return 'D';
  return 'F';
}

export function getConfidenceLevel(score: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (score >= 90) return { label: '极高置信度', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' };
  if (score >= 75) return { label: '高置信度',   color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' };
  if (score >= 60) return { label: '中置信度',   color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' };
  if (score >= 45) return { label: '低置信度',   color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' };
  return { label: '需要完善', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', borderColor: 'rgba(107,114,128,0.3)' };
}

/**
 * 从 DB 查询置信度数据（由前端组件在 SSR/CSR 时调用）
 * 返回 null 表示无 DB 记录，需要用静态数据
 */
export async function fetchConfidenceFromDB(slug: string): Promise<{
  overall: number;
  breakdown: ScoreBreakdown;
  grade: string;
  starRating: 1 | 2 | 3 | 4 | 5;
  dataSources: ConfidenceScore['dataSources'];
  mainGaps: string[];
} | null> {
  try {
    const res = await fetch(`/api/personas/${slug}/confidence`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 计算综合分（基于 breakdown 的加权平均）
 */
export function computeOverall(breakdown: ScoreBreakdown): number {
  return Math.round(
    breakdown.voiceFidelity * DIMENSION_WEIGHTS.voiceFidelity +
    breakdown.knowledgeDepth * DIMENSION_WEIGHTS.knowledgeDepth +
    breakdown.reasoningPattern * DIMENSION_WEIGHTS.reasoningPattern +
    breakdown.safetyCompliance * DIMENSION_WEIGHTS.safetyCompliance
  );
}

// ─── 静态回退数据 ────────────────────────────────────────────────────────────────
// 以下人物在 DB 中无蒸馏记录时的回退数据
// 分数来源：蒸馏管道的 zero-v1 JSON 输出 + corpus 语料分析
//
// 重要说明：
//   1. 每个 entry 使用正确格式 { voiceFidelity, knowledgeDepth, reasoningPattern, safetyCompliance }
//   2. dataSources 从 corpus/distilled/zero/*.json 和 corpus/*/manifest.json 自动提取
//   3. 所有 65 个注册人物均有 entry（无遗漏）
//   4. slug 别名已统一：richard-feynman → feynman, marcus-aurelius-stoic 独立
//   5. 已删除重复的 wittgenstein（第 2 个定义）

export const PERSONA_CONFIDENCE: Record<string, {
  overall: number;
  breakdown?: ScoreBreakdown;
  version: string;
  source: 'static' | 'db';
  dataSources: ConfidenceScore['dataSources'];
  mainGaps: string[];
}> = {
  // ── 已通过零蒸馏管道的人物（分数来自 corpus/distilled/zero/*.json）───────────
  'aleister-crowley': {
    overall: 87,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 86, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'The Book of the Law（原文引用）', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '蒸馏语料', quality: '4' },
    ],
    mainGaps: ['表达DNA还原度偏低（零蒸馏对西方神秘学文本表达特征提取有限）'],
  },
  'carl-jung': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 91, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'Collected Papers on Analytical Psychology', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '178,177 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'donald-trump': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 92, reasoningPattern: 84, safetyCompliance: 90 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'Presidential Candidacy Announcement Speech (2015)', quantity: '原文引用', quality: '4' },
      { type: 'primary', source: "Interview with Bill O'Reilly (2015)", quantity: '原文引用', quality: '4' },
      { type: 'corpus', source: '蒸馏语料', quantity: '804,484 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'epictetus': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 92, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'Discourses（原文引用）', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '216,123 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'han-fei-zi': {
    overall: 87,
    breakdown: { voiceFidelity: 82, knowledgeDepth: 90, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '韩非子·心度', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '韩非子·用人', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '韩非子·二柄', quantity: '原文引用', quality: '5' },
    ],
    mainGaps: [],
  },
  'jack-ma': {
    overall: 86,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 85, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏语料', quantity: '蒸馏语料', quality: '4' },
    ],
    mainGaps: [],
  },
  'journey-west': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 91, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '西游记（原文引用）', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '388,034 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'mo-zi': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 90, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '墨子·兼爱上', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '墨子·尚贤上', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '墨子·尚同上', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '墨子·辞过', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '墨子·七患', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '墨子·法仪', quantity: '原文引用', quality: '5' },
    ],
    mainGaps: [],
  },
  'ni-haixia': {
    overall: 87,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 87, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏语料', quantity: '蒸馏语料', quality: '4' },
    ],
    mainGaps: [],
  },
  'qian-xuesen': {
    overall: 84,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 77, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'Engineering Cybernetics (McGraw-Hill, 1954)', quantity: '原文引用', quality: '5' },
    ],
    mainGaps: ['知识覆盖深度偏低（77），语料以英文工程著作为主，跨度有限）'],
  },
  'qu-yuan': {
    overall: 86,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 82, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '楚辞（原文引用）', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '1,717 字', quality: '4' },
    ],
    mainGaps: ['语料规模偏小（1,717字），蒸馏置信度受限'],
  },
  'sun-wukong': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 89, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '西游记·第一回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '西游记·第二回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '西游记·第三回', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '235,483 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'three-kingdoms': {
    overall: 87,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 87, reasoningPattern: 84, safetyCompliance: 95 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '三国演义·第一回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '三国演义·第二回', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '388,034 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'tripitaka': {
    overall: 86,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 82, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '西游记相关文本（唐僧角色）', quantity: '原文引用', quality: '4' },
      { type: 'corpus', source: '蒸馏语料', quantity: '235,483 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'wang-dongyue': {
    overall: 89,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 95, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '卷一·自然哲学论（原文引用）', quantity: '原文引用', quality: '5' },
    ],
    mainGaps: [],
  },
  'zhang-xuefeng': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 90, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '张雪峰说高考：105条志愿填报金句', quantity: '原文引用', quality: '4' },
    ],
    mainGaps: [],
  },
  'zhu-bajie': {
    overall: 88,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 90, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '西游记·第二十四回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '西游记·第二十七回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '西游记·第三十一回', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '235,483 字', quality: '4' },
    ],
    mainGaps: [],
  },
  'zhuge-liang': {
    overall: 86,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 82, reasoningPattern: 84, safetyCompliance: 96 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'primary', source: '三国演义·第一回', quantity: '原文引用', quality: '5' },
      { type: 'primary', source: '三国演义·第二回', quantity: '原文引用', quality: '5' },
      { type: 'corpus', source: '蒸馏语料', quantity: '22,336 字', quality: '4' },
    ],
    mainGaps: ['语料规模偏小（22,336字），诸葛亮角色语料有限'],
  },

  // ── 尚未通过零蒸馏管道的人物（语料不足，评分为0待计算）─────────────────────
  'andrej-karpathy': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona andrej-karpathy'],
  },
  'cao-cao': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona cao-cao'],
  },
  'huangdi-neijing': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona huangdi-neijing'],
  },
  'ilya-sutskever': {
    overall: 76,
    breakdown: { voiceFidelity: 76, knowledgeDepth: 80, reasoningPattern: 72, safetyCompliance: 78 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'OpenAI 官方博客 (2015-2023)', quantity: 'GPT、CLIP、DALL-E、Codex等技术突破博客，含Ilya参与核心论文引用', quality: '5' },
      { type: 'primary', source: 'Ilya Sutskever 个人推特/X (2017-2024)', quantity: '"今天的神经网络可能略微有意识"等争议性推文原文', quality: '4' },
      { type: 'primary', source: 'Safe Superintelligence Inc. 成立公告 (2024)', quantity: 'SSI使命声明，"第一个产品将是安全超级智能"', quality: '5' },
      { type: 'secondary', source: 'MIT Technology Review / The Verge AI报道 (2017-2024)', quantity: 'AlexNet、GPT系列、OpenAI内部动态技术媒体报道', quality: '4' },
    ],
    mainGaps: ['学术论文原文未全量获取', '内部研究备忘录未覆盖'],
  },
  'john-dee': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona john-dee'],
  },
  'john-maynard-keynes': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona john-maynard-keynes'],
  },
  'kant': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona kant'],
  },
  'li-chunfeng': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona li-chunfeng'],
  },
  'lin-yutang': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona lin-yutang'],
  },
  'liu-bei': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona liu-bei'],
  },
  'marcus-aurelius-stoic': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona marcus-aurelius-stoic'],
  },
  'mencius': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona mencius'],
  },
  'mrbeast': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona mrbeast'],
  },
  'osamu-dazai': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona osamu-dazai'],
  },
  'records-grand-historian': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算（该人物可能等同于 sima-qian）', '建议运行：bun run scripts/zero/distill-zero.mjs --persona records-grand-historian'],
  },
  'shao-yong': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona shao-yong'],
  },
  'xiang-yu': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona xiang-yu'],
  },
  'yuan-tiangang': {
    overall: 0,
    breakdown: { voiceFidelity: 0, knowledgeDepth: 0, reasoningPattern: 0, safetyCompliance: 0 },
    version: 'zero-v1',
    source: 'static',
    dataSources: [
      { type: 'corpus', source: '蒸馏管道语料', quantity: '待采集', quality: '2' },
    ],
    mainGaps: ['尚未通过零蒸馏管道，质量评分待计算', '建议运行：bun run scripts/zero/distill-zero.mjs --persona yuan-tiangang'],
  },
  'zhang-yiming': {
    overall: 78,
    breakdown: { voiceFidelity: 78, knowledgeDepth: 80, reasoningPattern: 74, safetyCompliance: 82 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'ByteDance 赴港上市招股说明书 / SEC Filing (2024)', quantity: '持股比例、投票权结构、VIE架构等核心公司治理信息', quality: '5' },
      { type: 'primary', source: '张一鸣内部信：算法透明与推荐逻辑 (2021)', quantity: '字节跳动全员信，阐述AI推荐核心哲学', quality: '5' },
      { type: 'secondary', source: 'Bloomberg - How ByteDance Built a Global App Empire (2020-2023)', quantity: '字节跳动全球化扩张路径系列报道', quality: '4' },
      { type: 'secondary', source: 'The Verge / TechCrunch 字节跳动相关报道 (2017-2024)', quantity: '今日头条、TikTok发展历程及管理风格分析', quality: '4' },
    ],
    mainGaps: ['早期创业内部文档未获取', '个人社交媒体发言未覆盖'],
  },

  // ── 保留的优质静态评估数据 ────────────────────────────────────────────────────
  // 以下人物有丰富的静态评估数据（v4-estimate），蒸馏分数已通过人工审核
  'wittgenstein': {
    overall: 79,
    breakdown: { voiceFidelity: 82, knowledgeDepth: 74, reasoningPattern: 71, safetyCompliance: 95 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'WittSrc Brain', source: '维特根斯坦研究中心', quantity: '7.26M 字', quality: '5' },
      { type: '原始手稿', source: 'Bergen MS Collection', quantity: '全部手稿', quality: '5' },
      { type: 'Tractatus/PI', source: 'Gutenberg', quantity: '原文+多译本', quality: '5' },
    ],
    mainGaps: [],
  },
  'elon-musk': {
    overall: 80,
    breakdown: { voiceFidelity: 80, knowledgeDepth: 78, reasoningPattern: 76, safetyCompliance: 85 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'speech', source: 'MIT AeroAstro Centennial Symposium (2014)', quantity: '第一性原理思维完整阐述', quality: '5' },
      { type: 'video', source: 'CBS 60 Minutes Interview (2014)', quantity: '完整访谈', quality: '5' },
      { type: 'speech', source: 'International Astronautical Congress (2016)', quantity: '火星殖民核心演讲', quality: '5' },
      { type: 'speech', source: 'Code Conference (2016)', quantity: '"人生意义"深度对话', quality: '5' },
      { type: 'speech', source: 'South by Southwest (2018)', quantity: '未来愿景演讲', quality: '4' },
      { type: 'video', source: 'Twitter Acquisition Announcement (Oct 2022)', quantity: '收购声明全文', quality: '4' },
      { type: 'speech', source: 'DOGE Town Hall (2024)', quantity: '政府效率部门阐述', quality: '4' },
    ],
    mainGaps: ['Tesla 财报会议字幕未获取', 'Bloomberg 完整访谈未收录'],
  },
  'peter-thiel': {
    overall: 76,
    breakdown: { voiceFidelity: 76, knowledgeDepth: 74, reasoningPattern: 70, safetyCompliance: 90 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Zero to One', source: '书籍', quantity: '全书章节', quality: '5' },
      { type: 'CS183 课程笔记', source: 'apachecn/stanford-cs183-notes', quantity: '19 讲 Markdown', quality: '4' },
    ],
    mainGaps: ['CS183/CS183b 原始录音未获取'],
  },
  'steve-jobs': {
    overall: 82,
    breakdown: { voiceFidelity: 80, knowledgeDepth: 82, reasoningPattern: 80, safetyCompliance: 88 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'speech', source: 'Stanford University Commencement Address (2005)', quantity: '全文原文 (15 min)', quality: '5' },
      { type: 'book', source: 'Steve Jobs by Walter Isaacson (2011)', quantity: '全书 646 页', quality: '5' },
      { type: 'interview', source: 'Wired Interview (1996)', quantity: '完整访谈', quality: '4' },
      { type: 'interview', source: 'D5 Conference with Walt Mossberg & Kara Swisher (2007)', quantity: '完整对话', quality: '4' },
      { type: 'interview', source: 'Fortune Interview (1999, 2001)', quantity: '2 次访谈', quality: '4' },
    ],
    mainGaps: ['All Things D 采访全量转录'],
  },
  'naval-ravikant': {
    overall: 77,
    breakdown: { voiceFidelity: 78, knowledgeDepth: 72, reasoningPattern: 74, safetyCompliance: 88 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'How to Get Rich', source: '博客文章', quantity: '全文 (~2 MB)', quality: '5' },
      { type: 'The Almanack', source: 'Eric Jorgenson 整理出版', quantity: '全量', quality: '4' },
    ],
    mainGaps: ['nav.al 博客未全量爬取'],
  },
  'charlie-munger': {
    overall: 85,
    breakdown: { voiceFidelity: 88, knowledgeDepth: 85, reasoningPattern: 82, safetyCompliance: 92 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'primary', source: 'Berkshire Hathaway Annual Meetings (1986-present)', quantity: '35+ 年年会完整转录，能力圈、逆向思维等核心心智模型原始出处', quality: '5' },
      { type: 'book', source: 'Poor Charlie\'s Almanack (2005)', quantity: '1986-2005年全部演讲全量收录，含格栅心智模型完整阐述', quality: '5' },
      { type: 'primary', source: 'Daily Journal Corporation Annual Meetings (2009-present)', quantity: '法律哲学、中国投资、学术批判等更广泛话题', quality: '4' },
      { type: 'secondary', source: 'Seeking Wisdom: From Darwin to Munger by Pabrai (2008)', quantity: '芒格思想系统化解读', quality: '4' },
    ],
    mainGaps: ['2023-2024 DJCO 年会记录未获取'],
  },
  'paul-graham': {
    overall: 78,
    breakdown: { voiceFidelity: 85, knowledgeDepth: 70, reasoningPattern: 70, safetyCompliance: 95 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Essays', source: '博客全部文章 (229篇)', quantity: '229 篇 (3.5 MB)', quality: '5' },
      { type: 'YC 创业课', source: 'YC 官方讲座', quantity: '20+ 场', quality: '4' },
    ],
    mainGaps: ['Twitter 推文未获取'],
  },
  'jeff-bezos': {
    overall: 74,
    breakdown: { voiceFidelity: 74, knowledgeDepth: 72, reasoningPattern: 68, safetyCompliance: 88 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '股东信', source: 'Amazon 官方 (1997-2020)', quantity: '1997年&2020年全文', quality: '5' },
      { type: 'Lex Fridman 播客', source: 'Lex Fridman Podcast #60', quantity: '完整转录', quality: '4' },
    ],
    mainGaps: ['全部股东信未覆盖', 'Re:Mars 演讲未覆盖'],
  },
  'ray-dalio': {
    overall: 75,
    breakdown: { voiceFidelity: 74, knowledgeDepth: 72, reasoningPattern: 70, safetyCompliance: 88 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Principles', source: 'Principles: Life and Work 书籍', quantity: '全书', quality: '4' },
      { type: 'Lex Fridman 播客', source: 'Lex Fridman Podcast #54', quantity: '完整转录', quality: '4' },
    ],
    mainGaps: ['Bridgewater 内部会议记录未覆盖'],
  },
  'jensen-huang': {
    overall: 80,
    breakdown: { voiceFidelity: 80, knowledgeDepth: 78, reasoningPattern: 76, safetyCompliance: 85 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'interview', source: 'Stanford GSB Interview (2019)', quantity: 'Denny\'s创业、濒临破产、移民童年完整叙述', quality: '5' },
      { type: 'speech', source: 'NVIDIA GTC Keynote (2023)', quantity: '"AI的iPhone时刻"核心演讲全文', quality: '5' },
      { type: 'speech', source: 'SIGGRAPH Keynote (2023)', quantity: 'GPU三十年愿景回顾', quality: '5' },
      { type: 'interview', source: 'MIT Technology Review (2017)', quantity: '1996年濒临破产经历首次详述', quality: '4' },
      { type: 'interview', source: 'Forbes Interview (2023)', quantity: '移民背景与企业家精神', quality: '4' },
    ],
    mainGaps: ['GTC 历史大会字幕未全量获取'],
  },
  'sam-altman': {
    overall: 73,
    breakdown: { voiceFidelity: 74, knowledgeDepth: 72, reasoningPattern: 70, safetyCompliance: 80 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Lex Fridman 播客', source: 'Lex Fridman #367 & #419', quantity: '两期完整转录', quality: '4' },
      { type: '博客文章', source: 'blog.samaltman.com', quantity: '最新 30 篇', quality: '4' },
    ],
    mainGaps: ['Twitter 推文未获取'],
  },
  'hui-neng': {
    overall: 70,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 68, reasoningPattern: 65, safetyCompliance: 78 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '六祖坛经', source: '中华经典古籍库', quantity: '全文', quality: '5' },
      { type: '五灯会元', source: '中华经典古籍库', quantity: '相关段落', quality: '4' },
    ],
    mainGaps: ['早期敦煌本与通行本差异未区分'],
  },
  'feynman': {
    overall: 84,
    breakdown: { voiceFidelity: 86, knowledgeDepth: 85, reasoningPattern: 78, safetyCompliance: 85 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'book', source: 'Surely You\'re Joking, Mr. Feynman! (1985)', quantity: '"不可自欺"、"解谜式学习"等核心心智模型原始出处，含康奈尔/巴西/日本/洛斯阿拉莫斯全部轶事', quality: '5' },
      { type: 'book', source: 'What Do You Care What Other People Think? (1988)', quantity: '挑战者号调查、质疑权威等核心轶事原始出处', quality: '5' },
      { type: 'book', source: 'The Feynman Lectures on Computation (1970s)', quantity: '计算物理讲座笔记，量子计算思想先驱', quality: '4' },
      { type: 'secondary', source: 'Infinity in the Palm of Your Hand (2018)', quantity: '书信与演讲精选集，Christopher Sykes编', quality: '4' },
    ],
    mainGaps: ['Caltech 讲座 HTML 格式批量获取'],
  },
  'warren-buffett': {
    overall: 30,
    breakdown: { voiceFidelity: 35, knowledgeDepth: 28, reasoningPattern: 30, safetyCompliance: 30 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'CEO 引语数据集', source: 'HuggingFace CEO语录集', quantity: '170 条公开引语', quality: '3' },
    ],
    mainGaps: ['股东大会完整转录未获取', '致股东信全量未获取', '语料严重不足'],
  },
  'confucius': {
    overall: 67,
    breakdown: { voiceFidelity: 70, knowledgeDepth: 65, reasoningPattern: 62, safetyCompliance: 75 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '论语', source: '中华经典古籍库', quantity: '全文', quality: '4' },
      { type: '礼记', source: '中华经典古籍库', quantity: '选读', quality: '3' },
    ],
    mainGaps: ['尚书、诗经原文未全量覆盖'],
  },
  'lao-zi': {
    overall: 66,
    breakdown: { voiceFidelity: 68, knowledgeDepth: 65, reasoningPattern: 60, safetyCompliance: 73 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '道德经', source: '中华经典古籍库', quantity: '全文 81 章', quality: '4' },
    ],
    mainGaps: ['列子、淮南子相关引用未覆盖'],
  },
  'zhuang-zi': {
    overall: 66,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 62, reasoningPattern: 58, safetyCompliance: 75 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '庄子', source: '中华经典古籍库', quantity: '全文 1M 字符', quality: '4' },
    ],
    mainGaps: ['惠施等论敌语录未分离'],
  },
  'sun-tzu': {
    overall: 69,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 68, reasoningPattern: 62, safetyCompliance: 75 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '孙子兵法', source: '中华经典古籍库 / chinese-philosophy', quantity: '全文 13 篇', quality: '5' },
      { type: '多注本', source: '十家注等', quantity: '对照参考', quality: '4' },
    ],
    mainGaps: ['竹简本未对照'],
  },
  'socrates': {
    overall: 65,
    breakdown: { voiceFidelity: 65, knowledgeDepth: 65, reasoningPattern: 60, safetyCompliance: 70 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '柏拉图对话录', source: '古登堡计划', quantity: '全量', quality: '5' },
      { type: '色诺芬著作', source: '古登堡计划', quantity: '部分', quality: '4' },
    ],
    mainGaps: ['苏格拉底本人无著作，通过弟子记录'],
  },
  'seneca': {
    overall: 67,
    breakdown: { voiceFidelity: 70, knowledgeDepth: 66, reasoningPattern: 62, safetyCompliance: 72 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'On the Shortness of Life', source: '古登堡计划免费电子书', quantity: '76,142 字', quality: '4' },
      { type: 'On Anger', source: '古登堡计划免费电子书', quantity: '609,228 字', quality: '4' },
    ],
    mainGaps: ['Naturales Quaestiones 未覆盖'],
  },
  'marcus-aurelius': {
    overall: 72,
    breakdown: { voiceFidelity: 75, knowledgeDepth: 68, reasoningPattern: 60, safetyCompliance: 95 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Meditations', source: 'The-Digital-Stoic-Library', quantity: '全12卷希腊语原文+英译+注疏', quality: '5' },
      { type: '多译本对照', source: 'Standard Ebooks', quantity: 'George Long等多译本', quality: '5' },
    ],
    mainGaps: ['希腊语原文 Discourses 待补充'],
  },
  'alan-turing': {
    overall: 66,
    breakdown: { voiceFidelity: 65, knowledgeDepth: 65, reasoningPattern: 60, safetyCompliance: 80 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '论文著作', source: '古登堡计划/学术数据库', quantity: '全量', quality: '5' },
      { type: '传记', source: 'Alan Turing: The Enigma', quantity: '全量', quality: '4' },
    ],
    mainGaps: ['私人书信未全量覆盖'],
  },
  'nikola-tesla': {
    overall: 61,
    breakdown: { voiceFidelity: 62, knowledgeDepth: 60, reasoningPattern: 55, safetyCompliance: 70 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'My Inventions', source: '古登堡计划免费电子书', quantity: '366,279 字', quality: '3' },
    ],
    mainGaps: ['书信全集未覆盖', 'Nikola Tesla Museum 档案未获取'],
  },
  'einstein': {
    overall: 61,
    breakdown: { voiceFidelity: 60, knowledgeDepth: 62, reasoningPattern: 58, safetyCompliance: 68 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Ideas and Opinions', source: '古登堡计划免费电子书', quantity: '222,427 字', quality: '3' },
      { type: 'The World As I See It', source: '古登堡计划免费电子书', quantity: '92,776 字', quality: '3' },
    ],
    mainGaps: ['相对论论文原文未覆盖', '书信全集未覆盖'],
  },
  'nassim-taleb': {
    overall: 65,
    breakdown: { voiceFidelity: 68, knowledgeDepth: 62, reasoningPattern: 65, safetyCompliance: 65 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'The Black Swan / Antifragile', source: '书籍', quantity: '全量', quality: '4' },
      { type: 'Skin in the Game', source: '书籍', quantity: '全量', quality: '2' },
    ],
    mainGaps: ['@nntaleb 推文全量未获取（最重要缺口）'],
  },
  'sima-qian': {
    overall: 66,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 60, reasoningPattern: 58, safetyCompliance: 78 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '史记', source: '中华经典古籍库', quantity: '本纪12+世家30+列传70+表8+书8', quality: '5' },
    ],
    mainGaps: ['早期散佚部分'],
  },
  'alan-watts': {
    overall: 82,
    breakdown: { voiceFidelity: 86, knowledgeDepth: 80, reasoningPattern: 78, safetyCompliance: 80 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'book', source: 'The Way of Zen (1957)', quantity: '西方理解东方智慧里程碑，含"停止追逐"、"如水之心"等核心观点', quality: '5' },
      { type: 'book', source: 'The Book: On the Taboo Against Knowing Who You Are (1966)', quantity: '最畅销自助著作，"你就是宇宙"等金句原始出处', quality: '5' },
      { type: 'primary', source: 'Out of Your Mind 讲座系列 (1972)', quantity: '12讲系列录音转录，意识与宇宙关系深度论述', quality: '5' },
      { type: 'primary', source: 'The Nature of Consciousness (1971)', quantity: '意识本质哲学讲座，探讨自我与宇宙关系', quality: '4' },
      { type: 'primary', source: 'alanwatts.org 讲座录音 (1958-1974)', quantity: '200+ 讲座录音转录全量', quality: '4' },
    ],
    mainGaps: ['1953年前早期讲座未覆盖', '视频字幕批量获取'],
  },
  'jiqun': {
    overall: 85,
    breakdown: { voiceFidelity: 88, knowledgeDepth: 82, reasoningPattern: 80, safetyCompliance: 95 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '微博全量', source: '新浪微博全量数据 (2009-2026)', quantity: '9,666 条', quality: '5' },
      { type: '核心著作', source: '12 本人生佛教系列+修学引导系列', quantity: '约 200 万字', quality: '5' },
    ],
    mainGaps: ['需要季度同步新增微博'],
  },
};


/**
 * Slug aliases: registry slug → static confidence key
 * Some personas use different slugs in the code vs. in PERSONA_CONFIDENCE.
 */
export const PERSONA_CONFIDENCE_ALIASES: Record<string, string> = {
  'richard-feynman': 'feynman',
};

/**
 * 获取单个人物的置信度，优先 DB 数据，回退到静态数据
 * 支持 slug 别名自动映射
 */
export function getPersonaConfidence(personaId: string): ConfidenceScore | null {
  const aliasedId = PERSONA_CONFIDENCE_ALIASES[personaId] ?? personaId;
  const static_ = PERSONA_CONFIDENCE[aliasedId];
  if (!static_) return null;

  const breakdown = static_.breakdown ?? {
    voiceFidelity: 0,
    knowledgeDepth: 0,
    reasoningPattern: 0,
    safetyCompliance: 0,
  };

  const overall = static_.breakdown
    ? computeOverall(breakdown)
    : static_.overall;

  return {
    overall,
    breakdown,
    grade: getGrade(overall),
    starRating: starRating(overall),
    version: static_.version ?? 'unknown',
    source: 'static',
    dataSources: static_.dataSources ?? [],
    mainGaps: static_.mainGaps ?? [],
  };
}

/**
 * 批量从 DB 获取置信度数据（用于人物库页面，避免 N+1 问题）
 * 返回 { slug -> confidence } 映射
 */
export async function fetchAllConfidenceFromDB(): Promise<Record<string, ConfidenceScore>> {
  try {
    const res = await fetch(`/api/personas/confidence`, {
      cache: 'no-store',
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.scores ?? {};
  } catch {
    return {};
  }
}

/**
 * 获取单个人物的置信度，优先 DB 数据，回退到静态数据
 */
export async function fetchPersonaConfidence(slug: string): Promise<ConfidenceScore | null> {
  try {
    const res = await fetch(`/api/personas/${slug}/confidence`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const TOP_PERSONAS = [
  'wittgenstein', 'elon-musk', 'peter-thiel', 'steve-jobs',
  'naval-ravikant', 'jeff-bezos', 'ray-dalio', 'jensen-huang',
  'sam-altman', 'charlie-munger', 'hui-neng', 'paul-graham',
];
