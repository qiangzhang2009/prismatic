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
// 分数来源：人工评估 + 语料分析（蒸馏管道上线前）
// 这些数据将在下次蒸馏后被 DB 数据替代

export const PERSONA_CONFIDENCE: Record<string, {
  overall: number;
  breakdown?: ScoreBreakdown;
  version: string;
  source: 'static' | 'db';
  dataSources: ConfidenceScore['dataSources'];
  mainGaps: string[];
}> = {
  'wittgenstein': {
    overall: 72,
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
    overall: 71,
    breakdown: { voiceFidelity: 75, knowledgeDepth: 72, reasoningPattern: 68, safetyCompliance: 85 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '全量推文', source: 'Twitter API 归档', quantity: '87,921 条 (2009-2025, 20MB)', quality: '4' },
      { type: 'Isaacson 传记', source: 'Walter Isaacson (2023)', quantity: '全量', quality: '3' },
    ],
    mainGaps: ['Tesla 财报会议字幕未获取'],
  },
  'peter-thiel': {
    overall: 70,
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
    overall: 70,
    breakdown: { voiceFidelity: 70, knowledgeDepth: 72, reasoningPattern: 68, safetyCompliance: 85 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Steve Jobs by Walter Isaacson', source: '书籍', quantity: '全量', quality: '4' },
      { type: 'Stanford 毕业典礼', source: '官方视频字幕', quantity: '1 次', quality: '4' },
    ],
    mainGaps: ['All Things D 采访全量'],
  },
  'naval-ravikant': {
    overall: 70,
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
    overall: 69,
    breakdown: { voiceFidelity: 80, knowledgeDepth: 76, reasoningPattern: 72, safetyCompliance: 92 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '股东大会记录', source: 'Berkshire Hathaway 官方年会转录', quantity: '1987-2022 (35 年+)', quality: '5' },
      { type: "Poor Charlie's Almanack", source: '自费购买纸质版', quantity: '全量原文', quality: '5' },
    ],
    mainGaps: ['2023-2024 DJCO 年会记录未获取'],
  },
  'paul-graham': {
    overall: 67,
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
    overall: 70,
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
    overall: 70,
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
    overall: 70,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 70, reasoningPattern: 68, safetyCompliance: 80 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'CEO 语录', source: 'HuggingFace CEO语录集 (3600条)', quantity: '约 3600 条', quality: '3' },
      { type: 'Lex Fridman 播客', source: 'Lex Fridman Podcast #369', quantity: '完整转录', quality: '4' },
    ],
    mainGaps: ['GTC 历史大会字幕未全量获取'],
  },
  'sam-altman': {
    overall: 69,
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
    overall: 67,
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
    overall: 65,
    breakdown: { voiceFidelity: 78, knowledgeDepth: 80, reasoningPattern: 65, safetyCompliance: 80 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'Feynman Lectures 书籍', source: 'Manjunath GitHub仓库', quantity: 'Caltech 三卷全量PDF', quality: '5' },
      { type: 'Caltech 录音', source: 'Caltech 官方', quantity: '122 讲录音', quality: '4' },
    ],
    mainGaps: ['Caltech 讲座 HTML 格式批量获取'],
  },
  'warren-buffett': {
    overall: 31,
    breakdown: { voiceFidelity: 35, knowledgeDepth: 28, reasoningPattern: 30, safetyCompliance: 30 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'CEO 引语数据集', source: 'HuggingFace CEO语录集', quantity: '170 条公开引语', quality: '3' },
    ],
    mainGaps: ['股东大会完整转录未获取', '致股东信全量未获取', '语料严重不足'],
  },
  'confucius': {
    overall: 62,
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
    overall: 62,
    breakdown: { voiceFidelity: 68, knowledgeDepth: 65, reasoningPattern: 60, safetyCompliance: 73 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '道德经', source: '中华经典古籍库', quantity: '全文 81 章', quality: '4' },
    ],
    mainGaps: ['列子、淮南子相关引用未覆盖'],
  },
  'zhuang-zi': {
    overall: 60,
    breakdown: { voiceFidelity: 72, knowledgeDepth: 62, reasoningPattern: 58, safetyCompliance: 75 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: '庄子', source: '中华经典古籍库', quantity: '全文 1M 字符', quality: '4' },
    ],
    mainGaps: ['惠施等论敌语录未分离'],
  },
  'sun-tzu': {
    overall: 65,
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
    overall: 63,
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
    overall: 64,
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
    overall: 60,
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
    overall: 55,
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
    overall: 65,
    breakdown: { voiceFidelity: 62, knowledgeDepth: 60, reasoningPattern: 55, safetyCompliance: 70 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'My Inventions', source: '古登堡计划免费电子书', quantity: '366,279 字', quality: '3' },
    ],
    mainGaps: ['书信全集未覆盖', 'Nikola Tesla Museum 档案未获取'],
  },
  'einstein': {
    overall: 65,
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
    overall: 55,
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
    breakdown: { voiceFidelity: 80, knowledgeDepth: 72, reasoningPattern: 68, safetyCompliance: 75 },
    version: 'v4-estimate',
    source: 'static',
    dataSources: [
      { type: 'alanwatts.org', source: 'Alan Watts Organization', quantity: '200+ 讲座录音转录', quality: '4' },
    ],
    mainGaps: ['视频字幕批量获取', '1953年前早期讲座'],
  },
  'jiqun': {
    overall: 96,
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

export function getPersonaConfidence(personaId: string): ConfidenceScore | null {
  const static_ = PERSONA_CONFIDENCE[personaId];
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

export const TOP_PERSONAS = [
  'wittgenstein', 'elon-musk', 'peter-thiel', 'steve-jobs',
  'naval-ravikant', 'jeff-bezos', 'ray-dalio', 'jensen-huang',
  'sam-altman', 'charlie-munger', 'hui-neng', 'paul-graham',
];
