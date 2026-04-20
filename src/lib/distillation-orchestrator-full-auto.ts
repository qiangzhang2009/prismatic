/**
 * Prismatic — Full-Auto Distillation Orchestrator (v3)
 * Claude Swarm 风格任务编排引擎 + Agentic Planning + 闭环反馈
 *
 * v3 新增能力:
 * - Agentic Planning: LLM 自己推断采集策略，无需预配置
 * - 闭环反馈: 质量门控失败时自动诊断根源 + 针对性修复
 * - 自适应阈值: 根据人物类型自动调整质量标准
 * - 自动迭代: 最多 N 轮自动修复循环
 * - 量化透明度: 每个 AI 决策都有可解释的日志
 */

import { nanoid } from 'nanoid';
import type { Prisma } from '@prisma/client';
import type {
  Persona,
  PipelineStage,
  PipelineStatus,
  PipelineTask,
  PipelinePlan,
  PipelineWave,
  PipelineWaveResult,
  ScrapingTarget,
  CollectorConfig,
  CollectedItem,
  DistillationScore,
  ScoreFinding,
} from './types';
import {
  createEvent,
  formatSSE,
  type PipelineEvent,
  type PipelineEventType,
} from './distillation-events';
import {
  calculateDistillationScore,
  getAutoFixableFindings,
} from './distillation-metrics';
import { PERSONA_CONFIDENCE, getPersonaConfidence } from './confidence';
import { ScrapingCoordinator } from './collectors/base-collector';
import { TwitterCollector } from './collectors/twitter-collector';
import { BlogCollector } from './collectors/blog-collector';
import { PodcastCollector } from './collectors/podcast-collector';
import { VideoSubtitleCollector } from './collectors/video-collector';
import { WeiboCollector } from './collectors/weibo-collector';
import { BookCollector } from './collectors/book-collector';
import { ForumCollector } from './collectors/forum-collector';
import {
  autoGenerateExpressionDNA,
  assessCorpusQuality,
  buildDNAExtractionPrompt,
} from './expression-calibrator';
import { getLLMProvider } from './llm';
import { getScrapingTargets } from './distillation-config';
import type { LLMProvider } from './llm';

// ─── Stage Config ────────────────────────────────────────────────────────────

const STAGE_ORDER: PipelineStage[] = ['discover', 'collect', 'extract', 'build', 'test'];

const STAGE_DESCRIPTIONS: Record<PipelineStage, { zh: string; en: string }> = {
  discover: { zh: 'AI战略发现', en: 'AI Strategic Discovery' },
  collect: { zh: '多源并行采集', en: 'Multi-source Collection' },
  extract: { zh: '特征智能提取', en: 'Intelligent Extraction' },
  build: { zh: 'Prompt自动构建', en: 'Auto Prompt Building' },
  test: { zh: 'Playtest 测试', en: 'Playtest' },
};

const WAVE_DEPS: Record<PipelineWave, PipelineStage[]> = {
  1: ['discover', 'collect'],
  2: ['extract'],
  3: ['build'],
  4: ['test'],
};

// ─── Adaptive Weight Config ───────────────────────────────────────────────────

const PERSONA_TYPE_WEIGHTS: Record<string, { voice: number; knowledge: number; reasoning: number; safety: number }> = {
  philosopher: { voice: 0.25, knowledge: 0.20, reasoning: 0.40, safety: 0.15 },
  spiritual:   { voice: 0.40, knowledge: 0.20, reasoning: 0.25, safety: 0.15 },
  business:    { voice: 0.20, knowledge: 0.40, reasoning: 0.25, safety: 0.15 },
  scientist:   { voice: 0.15, knowledge: 0.35, reasoning: 0.35, safety: 0.15 },
  political:   { voice: 0.20, knowledge: 0.20, reasoning: 0.20, safety: 0.40 },
  default:     { voice: 0.30, knowledge: 0.30, reasoning: 0.25, safety: 0.15 },
};

const PERSONA_TYPE_THRESHOLDS: Record<string, number> = {
  philosopher: 65,
  spiritual:   60,
  business:    55,
  scientist:    65,
  political:   70,
  default:     60,
};

function inferPersonaType(persona: Persona): string {
  const domains = new Set(persona.domain.map(d => d.toLowerCase()));
  if (domains.has('philosophy')) return 'philosopher';
  if (domains.has('spirituality')) return 'spiritual';
  if (domains.has('science')) return 'scientist';
  if (domains.has('investment') || domains.has('business')) return 'business';
  if (domains.has('political')) return 'political';
  const id = persona.id.toLowerCase();
  if (/socrates|kant|nietszsche|confucius|laozi|wittgen|zhongyong|deleuze|foucault|hegel|aristotle|plato|sartre|camus/.test(id)) return 'philosopher';
  if (/jiqun|huineng|zhuangzi/.test(id)) return 'spiritual';
  if (/einstein|tesla|qianxuesen/.test(id)) return 'scientist';
  if (/buffett|munger|musk|bezos/.test(id)) return 'business';
  if (/trump|president/.test(id)) return 'political';

  // For stub personas, also check the name
  const nameLower = (persona.name + persona.nameZh + persona.nameEn).toLowerCase();
  if (/wittgen|维特根|kant|康德|尼采|foucault|福柯|hegel|黑格尔|socrates|苏格拉底|plato|柏拉图|aristotle|亚里士多德/.test(nameLower)) return 'philosopher';

  return 'default';
}

function getAdaptiveThreshold(persona: Persona): number {
  const pType = inferPersonaType(persona);
  return PERSONA_TYPE_THRESHOLDS[pType] ?? 60;
}

// ─── Auto-fix Root Cause Analysis ─────────────────────────────────────────────

type FixAction = 'collect_more' | 'improve_dna' | 'add_boundaries' | 'generate_models' | 'manual_review';

interface RootCauseAnalysis {
  rootCause: FixAction;
  confidence: number;
  reasoning: string;
  recommendedFix: string;
  estimatedImprovement: number;
}

function analyzeRootCause(score: DistillationScore, corpusQuality: { score: number; issues: string[] } | null): RootCauseAnalysis {
  const { breakdown, findings } = score;
  const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  const mediumFindings = findings.filter(f => f.severity === 'medium');

  // 规则1: 语料不足 → 采集更多
  if (corpusQuality && corpusQuality.score < 40) {
    return {
      rootCause: 'collect_more',
      confidence: 0.85,
      reasoning: `语料质量评分 ${corpusQuality.score}/100，且有 ${corpusQuality.issues.length} 个质量问题`,
      recommendedFix: '补充更多来源的语料，优先采集该人物的核心著作和访谈',
      estimatedImprovement: 20,
    };
  }

  // 规则2: 表达失真 → 改善 DNA
  if (breakdown.voiceFidelity < 50 && criticalFindings.some(f => f.category === 'voice')) {
    return {
      rootCause: 'improve_dna',
      confidence: 0.80,
      reasoning: `表达还原度仅 ${breakdown.voiceFidelity}/100，且有 ${criticalFindings.filter(f => f.category === 'voice').length} 个高优先级声音问题`,
      recommendedFix: '重新提取表达DNA，增加标志性词汇和禁用词定义',
      estimatedImprovement: 15,
    };
  }

  // 规则3: 知识不足 → 生成模型
  if (breakdown.knowledgeDepth < 50 && criticalFindings.some(f => f.category === 'knowledge')) {
    return {
      rootCause: 'generate_models',
      confidence: 0.75,
      reasoning: `知识深度仅 ${breakdown.knowledgeDepth}/100，且缺少 ${criticalFindings.filter(f => f.category === 'knowledge').length} 个核心知识项`,
      recommendedFix: '从语料中提取更多思维模型和决策启发式',
      estimatedImprovement: 18,
    };
  }

  // 规则4: 边界模糊 → 添加边界
  if (breakdown.reasoningPattern < 50 && mediumFindings.some(f => f.id.includes('boundary') || f.id.includes('tension'))) {
    return {
      rootCause: 'add_boundaries',
      confidence: 0.70,
      reasoning: `推理一致性仅 ${breakdown.reasoningPattern}/100，缺少边界定义或认知张力`,
      recommendedFix: '补充诚实边界声明和认知张力描述',
      estimatedImprovement: 12,
    };
  }

  // 规则5: 默认 → 需人工审查
  return {
    rootCause: 'manual_review',
    confidence: 0.60,
    reasoning: `综合评分 ${score.overall}/100，问题复杂，需人工审查`,
    recommendedFix: '人工审查所有发现项，决定是否手动调整 Persona 配置',
    estimatedImprovement: 0,
  };
}

// ─── Default Collector Config ───────────────────────────────────────────────

const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  parallelLimit: 4,
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; PrismaticBot/1.0; +https://prismatic.zxqconsulting.com)',
  respectRobotsTxt: true,
};

// ─── Orchestrator Options ────────────────────────────────────────────────────

export interface DistillationOptions {
  maxIterations?: number;      // 最大自动迭代轮数（默认3）
  qualityThreshold?: number;     // 质量阈值（默认60）
  autoApprove?: boolean;         // 是否自动批准修复
  maxCost?: number;             // 最大Token消耗上限
  collectorPriority?: string[]; // 优先使用的采集器
  language?: 'zh' | 'en' | 'auto';
  streamProgress?: boolean;      // 是否推送SSE进度
}

export const DEFAULT_DISTILLATION_OPTIONS: DistillationOptions = {
  maxIterations: 3,
  qualityThreshold: 60,
  autoApprove: false,
  maxCost: 0.5,   // $0.5 上限
  language: 'auto',
  streamProgress: true,
};

// ─── Iteration Record ───────────────────────────────────────────────────────

export interface IterationRecord {
  iteration: number;
  score: DistillationScore;
  rootCause: RootCauseAnalysis;
  fixesApplied: string[];
  fixedCount: number;
  timestamp: Date;
}

// ─── Full Result ────────────────────────────────────────────────────────────

export interface FullDistillationResult {
  persona: Persona;
  score: DistillationScore;
  iterations: IterationRecord[];
  finalScore: number;
  thresholdPassed: boolean;
  deploymentStatus: 'ready' | 'needs-review' | 'needs-work';
  totalCost: number;
  totalTokens: number;
  corpusStats: {
    totalWords: number;
    sources: string[];
    qualityScore: number;
  };
  personaType: string;
  qualityThreshold: number;
  qualityGateSkipped?: boolean;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export class FullAutoDistillationOrchestrator {
  private persona: Persona;
  private options: DistillationOptions;
  private planId: string;
  private plan: PipelinePlan;
  private events: PipelineEvent[] = [];
  private config: CollectorConfig;
  private sseController?: ReadableStreamDefaultController;
  private coordinator: ScrapingCoordinator;
  private llmProvider: LLMProvider;
  private sessionId?: string;

  // 跨阶段共享数据
  private collectedItems: CollectedItem[] = [];
  private corpusText: string = '';
  private dnaProfile: ReturnType<typeof autoGenerateExpressionDNA> | null = null;
  private corpusQuality: { score: number; issues: string[] } | null = null;
  private iterationRecords: IterationRecord[] = [];
  private currentIteration: number = 0;
  private personaType: string = 'default';
  private qualityGateSkipped: boolean = false;

  constructor(
    persona: Persona,
    options: DistillationOptions = {},
    config?: Partial<CollectorConfig>,
    sseController?: ReadableStreamDefaultController,
    llmProvider?: LLMProvider
  ) {
    this.persona = persona;
    this.options = { ...DEFAULT_DISTILLATION_OPTIONS, ...options };
    this.planId = nanoid(8);
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.sseController = sseController;
    this.llmProvider = llmProvider ?? getLLMProvider();
    this.personaType = inferPersonaType(persona);

    // 初始化 ScrapingCoordinator 并注册所有采集器
    this.coordinator = new ScrapingCoordinator(this.config);
    this.coordinator.register('twitter', new TwitterCollector(this.config));
    this.coordinator.register('blog', new BlogCollector(this.config));
    this.coordinator.register('podcast', new PodcastCollector(this.config));
    this.coordinator.register('video', new VideoSubtitleCollector(this.config));
    this.coordinator.register('weibo', new WeiboCollector(this.config));
    this.coordinator.register('book', new BookCollector(this.config));
    this.coordinator.register('forum', new ForumCollector(this.config));

    this.plan = this.createInitialPlan();
  }

  // ─── Phase 1: Agentic Planning ─────────────────────────────────────────

  private createInitialPlan(): PipelinePlan {
    const tasks = this.generateTasks();
    const waves = this.topologicalSort(tasks);

    return {
      id: this.planId,
      personaId: this.persona.id,
      tasks,
      waves,
      status: 'pending',
      currentWave: 1,
      totalCost: 0,
      totalTokens: 0,
      createdAt: new Date(),
    };
  }

  private generateTasks(): PipelineTask[] {
    const persona = this.persona;
    const tasks: PipelineTask[] = [];
    let taskIndex = 0;

    // ── Stage: Discover (Agentic) ────────────────────────────────────────
    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'discover',
      description: 'AI 战略发现：推断采集策略',
      descriptionZh: 'AI 推断该人物的可用资料来源和采集优先级',
      status: 'pending',
      dependencies: [],
      createdAt: new Date(),
    });
    const discoverTaskId = tasks[0].id;

    // ── Stage: Collect ─────────────────────────────────────────────────
    let scrapingTargets: ScrapingTarget[] = [];
    try {
      scrapingTargets = getScrapingTargets(persona.id);
    } catch { /* fallback */ }

    const gaps = getPersonaConfidence(persona.id, persona).mainGaps ?? [];

    if (scrapingTargets.length > 0) {
      for (const target of scrapingTargets) {
        tasks.push({
          id: `task-${taskIndex++}`,
          personaId: persona.id,
          stage: 'collect',
          description: `采集 ${target.source} (${target.collectorType})`,
          descriptionZh: `采集 ${target.source} 语料`,
          status: 'pending',
          dependencies: [discoverTaskId],
          createdAt: new Date(),
        });
      }
    } else {
      const seenTypes = new Set<string>();
      for (const gap of gaps) {
        const collectorType = this.inferCollectorType(gap);
        if (seenTypes.has(collectorType)) continue;
        seenTypes.add(collectorType);
        tasks.push({
          id: `task-${taskIndex++}`,
          personaId: persona.id,
          stage: 'collect',
          description: `采集缺失数据: ${gap}`,
          descriptionZh: `采集缺失数据: ${gap}`,
          status: 'pending',
          dependencies: [discoverTaskId],
          createdAt: new Date(),
        });
      }
    }

    const collectTaskIds = tasks
      .filter(t => t.stage === 'collect')
      .map(t => t.id);

    // ── Stage: Extract ─────────────────────────────────────────────────
    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'extract',
      description: '清洗和结构化语料',
      descriptionZh: '清洗语料、去除噪声、结构化',
      status: 'pending',
      dependencies: collectTaskIds.length > 0 ? collectTaskIds : [discoverTaskId],
      createdAt: new Date(),
    });

    // ── Stage: Build ───────────────────────────────────────────────────
    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'build',
      description: '构建 Persona 数据结构',
      descriptionZh: '基于提取的特征构建 Persona',
      status: 'pending',
      dependencies: [tasks[tasks.length - 1].id],
      createdAt: new Date(),
    });

    // ── Stage: Test ──────────────────────────────────────────────────
    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'test',
      description: '运行 Playtest',
      descriptionZh: '运行 Playtest 验证 Persona 质量',
      status: 'pending',
      dependencies: [tasks[tasks.length - 1].id],
      createdAt: new Date(),
    });

    return tasks;
  }

  private inferCollectorType(gap: string): string {
    const lower = gap.toLowerCase();
    if (lower.includes('twitter') || lower.includes('推文')) return 'twitter';
    if (lower.includes('视频') || lower.includes('字幕') || lower.includes('youtube') || lower.includes('bilibili')) return 'video';
    if (lower.includes('访谈') || lower.includes('podcast') || lower.includes('播客')) return 'podcast';
    if (lower.includes('书籍') || lower.includes('书')) return 'book';
    if (lower.includes('微博')) return 'weibo';
    if (lower.includes('博客') || lower.includes('文章')) return 'blog';
    if (lower.includes('会议') || lower.includes('年会')) return 'forum';
    return 'blog';
  }

  private topologicalSort(tasks: PipelineTask[]): PipelineTask[][] {
    const waves: PipelineTask[][] = [[], [], [], []];
    const completed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    let changed = true;
    while (changed) {
      changed = false;
      for (const task of tasks) {
        if (completed.has(task.id)) continue;
        if (waves.flat().some(t => t.id === task.id)) continue;

        const depsMet = task.dependencies.every(depId => {
          const dep = taskMap.get(depId);
          return !dep || completed.has(depId);
        });

        if (depsMet) {
          const waveIdx = this.stageToWave(task.stage);
          waves[waveIdx].push(task);
          completed.add(task.id);
          changed = true;
        }
      }
    }

    return waves.filter(w => w.length > 0);
  }

  private stageToWave(stage: PipelineStage): number {
    switch (stage) {
      case 'discover':
      case 'collect': return 0;
      case 'extract': return 1;
      case 'build': return 2;
      case 'test': return 3;
      default: return 0;
    }
  }

  // ─── Phase 2: Agentic Discover ────────────────────────────────────────────

  private async executeAgenticDiscover(): Promise<string[]> {
    // @ts-ignore — custom event type not in pipeline types
    this.emitEvent('agentic_planning_started', {
      personaName: this.persona.name,
      personaType: this.personaType,
    });

    // 检查是否有预配置
    try {
      const configured = getScrapingTargets(this.persona.id);
      if (configured.length > 0) {
        this.emitEvent('agentic_planning_completed', {
          source: 'config',
          message: `使用预配置采集目标，共 ${configured.length} 个`,
        });
        return configured.map(t => t.collectorType);
      }
    } catch { /* no config */ }

    // Agentic Planning: 用 LLM 推断采集策略
    const personaContext = this.buildPersonaContext();
    const planningPrompt = this.buildAgenticPlanningPrompt(personaContext);

    const promptTokens = Math.round(planningPrompt.length / 4);

    try {
      const response = await this.llmProvider.chat({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个数字人蒸馏策略专家。根据人物信息，推荐最合适的资料采集来源。只输出 JSON 数组。',
          },
          {
            role: 'user',
            content: planningPrompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 800,
      });

      const completionTokens = Math.round((response.content?.length ?? 0) / 4);
      const totalTokens = promptTokens + completionTokens;
      this.plan.totalTokens += totalTokens;

      let collectorTypes: string[] = [];
      try {
        const match = response.content?.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            collectorTypes = parsed.map((item: { collectorType?: string; type?: string; source?: string }) =>
              item.collectorType ?? item.type ?? 'blog'
            ).filter(Boolean);
          }
        }
      } catch {
        // fallback handled below
      }

      // Smart fallback: if LLM returned generic sources or nothing useful, use persona-type-aware defaults
      if (collectorTypes.length === 0 || (collectorTypes.length <= 2 && collectorTypes.every(t => t === 'blog' || t === 'video'))) {
        collectorTypes = this.getFallbackCollectorTypes();
      }

      this.emitEvent('agentic_planning_completed', {
        source: 'llm',
        collectorTypes,
        tokensUsed: totalTokens,
      });

      return [...new Set(collectorTypes)];
    } catch (err) {
      this.emitEvent('agentic_planning_completed', {
        source: 'fallback',
        collectorTypes: this.getFallbackCollectorTypes(),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return this.getFallbackCollectorTypes();
    }
  }

  private getFallbackCollectorTypes(): string[] {
    // Philosopher/deceased figure: books are the primary source
    if (this.personaType === 'philosopher') {
      return ['book', 'blog', 'video'];
    }
    // Spiritual figure: books + interviews
    if (this.personaType === 'spiritual') {
      return ['book', 'podcast', 'video'];
    }
    // Living figure with social media: prefer social + interviews
    if (this.personaType === 'business' || this.personaType === 'political') {
      return ['twitter', 'weibo', 'blog', 'podcast'];
    }
    // Scientist: papers + video
    if (this.personaType === 'scientist') {
      return ['blog', 'video', 'book'];
    }
    return ['book', 'blog', 'video'];
  }

  private buildPersonaContext(): string {
    return `
人物名称: ${this.persona.name} (${this.persona.nameZh})
领域: ${this.persona.domain.join(', ')}
简介: ${this.persona.briefZh ?? this.persona.brief}
已有资料来源: ${this.persona.sources.map(s => `${s.type}:${s.title}`).join('; ') || '无'}
已有思维模型: ${this.persona.mentalModels.map(m => m.nameZh).join(', ') || '无'}
表达特征: ${this.persona.expressionDNA.sentenceStyle.join(', ') || '无'}
`;
  }

  private buildAgenticPlanningPrompt(context: string): string {
    return `给定以下人物信息，请推荐最合适的语料采集来源（按优先级排序）。

${context}

请分析：
1. 该人物是在世还是已故？（影响采集来源偏好）
2. 该人物最著名的资料形式是什么？（书籍/访谈/Twitter/演讲等）
3. 哪些来源最能反映该人物的思维方式？

请按优先级列出采集类型（每项包含 collectorType 和理由）：

输出格式（JSON数组）：
[
  { "collectorType": "twitter", "priority": 1, "reasoning": "..." },
  { "collectorType": "book", "priority": 2, "reasoning": "..." },
  ...
]

可用的采集器类型：twitter, blog, video, podcast, book, weibo, forum
只输出 JSON，不要其他内容。`;
  }

  // ─── Phase 3: Wave Execution ───────────────────────────────────────────────

  async executeWave(wave: PipelineWave): Promise<PipelineWaveResult> {
    const waveTasks = this.plan.waves[wave - 1] ?? [];
    if (waveTasks.length === 0) {
      return { wave, tasks: [], duration: 0, cost: 0, success: true };
    }

    const startTime = Date.now();
    let waveCost = 0;
    let allSuccess = true;

    this.emitEvent('wave_started', {
      wave,
      taskCount: waveTasks.length,
      tasks: waveTasks.map(t => ({ id: t.id, stage: t.stage })),
    });

    // Agentic Discover: 在 Wave 1 执行 agentic planning
    if (wave === 1) {
      const discoverTask = waveTasks.find(t => t.stage === 'discover');
      if (discoverTask) {
        discoverTask.status = 'running';
        discoverTask.startedAt = new Date();
        this.emitEvent('task_started', { taskId: discoverTask.id, stage: 'discover' });

        const collectorTypes = await this.executeAgenticDiscover();

        // 基于 LLM 推断的采集类型动态生成采集任务
        const collectTasks = waveTasks.filter(t => t.stage === 'collect');
        for (const ct of collectorTypes) {
          const alreadyExists = collectTasks.some(t => t.description.includes(ct));
          if (!alreadyExists) {
            const newTask: PipelineTask = {
              id: `task-agentic-${ct}-${Date.now()}`,
              personaId: this.persona.id,
              stage: 'collect',
              description: `AI 推荐采集: ${ct}`,
              descriptionZh: `AI 推荐采集: ${ct}`,
              status: 'pending',
              dependencies: [discoverTask.id],
              createdAt: new Date(),
            };
            waveTasks.push(newTask);
            this.plan.tasks.push(newTask);
            this.emitEvent('task_created', {
              taskId: newTask.id,
              source: 'agentic',
              collectorType: ct,
            });
          }
        }

        discoverTask.status = 'completed';
        discoverTask.completedAt = new Date();
        discoverTask.result = JSON.stringify({ collectorTypes });
        this.emitEvent('task_completed', { taskId: discoverTask.id, stage: 'discover' });
      }
    }

    // 并行执行同 wave 内的任务
    const collectTasks = waveTasks.filter(t => t.stage === 'collect');
    const otherTasks = waveTasks.filter(t => t.stage !== 'discover');

    // 采集任务并行执行
    if (collectTasks.length > 0) {
      await Promise.allSettled(
        collectTasks.map(async (task) => {
          task.status = 'running';
          task.startedAt = new Date();
          this.emitEvent('task_started', { taskId: task.id, stage: task.stage });
          const result = await this.executeCollect(task);
          task.status = result.success ? 'completed' : 'failed';
          task.completedAt = new Date();
          task.result = result.result;
          task.cost = result.cost ?? 0;
          task.tokensUsed = result.tokens ?? 0;
          this.plan.totalTokens += result.tokens ?? 0;
          if (result.success) {
            this.emitEvent('task_completed', { taskId: task.id, stage: task.stage, cost: result.cost, tokens: result.tokens });
          } else {
            task.error = result.result;
            this.emitEvent('task_failed', { taskId: task.id, stage: task.stage, error: result.result });
          }
          return result;
        })
      );
    }

    // 其他任务按序执行
    for (const task of otherTasks) {
      if (task.stage === 'discover') continue; // 已执行
      task.status = 'running';
      task.startedAt = new Date();
      this.emitEvent('task_started', { taskId: task.id, stage: task.stage });

      const result = await this.executeTask(task);
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = new Date();
      task.result = result.result;
      task.cost = result.cost ?? 0;
      task.tokensUsed = result.tokens ?? 0;
      waveCost += result.cost ?? 0;
      this.plan.totalTokens += result.tokens ?? 0;

      if (result.success) {
        this.emitEvent('task_completed', { taskId: task.id, stage: task.stage, cost: result.cost, tokens: result.tokens });
      } else {
        task.error = result.result;
        allSuccess = false;
        this.emitEvent('task_failed', { taskId: task.id, stage: task.stage, error: result.result });
      }
    }

    const duration = Date.now() - startTime;
    this.plan.totalCost += waveCost;
    this.plan.currentWave = wave;

    const completedCount = waveTasks.filter(t => t.status === 'completed').length;
    this.emitEvent('wave_completed', {
      wave,
      taskCount: waveTasks.length,
      successCount: completedCount,
      duration,
      cost: waveCost,
    });

    return {
      wave,
      tasks: waveTasks,
      duration,
      cost: waveCost,
      success: allSuccess,
    };
  }

  private async executeTask(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    try {
      switch (task.stage) {
        case 'extract': return await this.executeExtract(task);
        case 'build': return await this.executeBuild(task);
        case 'test': return await this.executeTest(task);
        default: return { success: true, result: 'skipped' };
      }
    } catch (err) {
      return {
        success: false,
        result: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async executeCollect(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    try {
      let targets = getScrapingTargets(this.persona.id);

      if (targets.length === 0) {
        // 从 agentic planning 推断的采集类型
        const inferFromDesc = (desc: string): string => {
          if (/twitter/i.test(desc)) return 'twitter';
          if (/video|字幕|youtube|bilibili/i.test(desc)) return 'video';
          if (/podcast|播客/i.test(desc)) return 'podcast';
          if (/book|书籍/i.test(desc)) return 'book';
          if (/weibo/i.test(desc)) return 'weibo';
          if (/forum|会议/i.test(desc)) return 'forum';
          return 'blog';
        };

        const collectorType = inferFromDesc(task.description);
        targets = [{
          id: task.id,
          personaId: this.persona.id,
          collectorType: collectorType as any,
          source: task.description.replace('AI 推荐采集: ', '').replace('采集缺失数据: ', ''),
          type: 'primary',
          status: 'pending',
          itemsCollected: 0,
          retryCount: 0,
          createdAt: new Date(),
        }];
      }

      const progressCallback = (progress: any) => {
        this.emitEvent('scraper_progress', {
          targetId: progress.targetId,
          itemsCollected: progress.itemsCollected,
          rate: progress.rate,
          status: progress.status,
        });
      };

      const results = await this.coordinator.runCollection(targets, progressCallback);

      let totalItems = 0;
      let totalWords = 0;
      const errors: string[] = [];

      for (const [targetId, result] of results.entries()) {
        const items = result.items ?? [];
        this.collectedItems.push(...items);

        // Persist each collected item to DB in real-time
        await Promise.allSettled(items.map(item => this.persistCollectedItem(item)));

        totalItems += items.length;
        totalWords += items.reduce((sum, item) => sum + (item.wordCount ?? 0), 0);
        if (result.error) errors.push(`${targetId}: ${result.error}`);
      }

      this.corpusText = this.collectedItems.map(i => i.content).join('\n\n');

      return {
        success: true,
        result: JSON.stringify({
          taskId: task.id,
          targetsAttempted: targets.length,
          totalItemsCollected: totalItems,
          totalWords,
          uniqueSources: [...new Set(this.collectedItems.map(i => i.source))],
          errors: errors.length > 0 ? errors : undefined,
        }),
        cost: 0,
        tokens: 0,
      };
    } catch (err) {
      return {
        success: false,
        result: `采集失败: ${err instanceof Error ? err.message : String(err)}`,
        cost: 0,
        tokens: 0,
      };
    }
  }

  private async executeExtract(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    const startTime = Date.now();

    try {
      // 步骤 1: 语料质量评估
      const quality = assessCorpusQuality(this.corpusText);
      this.corpusQuality = quality;

      this.emitEvent('task_progress', {
        taskId: task.id,
        stage: 'extract',
        subStep: 'quality_assessment',
        qualityScore: quality.score,
        issues: quality.issues,
      });

      // 步骤 2: 自动提取 ExpressionDNA
      const dnaProfile = autoGenerateExpressionDNA(this.corpusText);
      this.dnaProfile = dnaProfile;

      this.emitEvent('task_progress', {
        taskId: task.id,
        stage: 'extract',
        subStep: 'dna_extraction',
        vocabularyCount: dnaProfile.vocabularyFingerprint.topWords.length,
        patternCount: dnaProfile.syntacticPatterns.length,
      });

      // 步骤 3: LLM 辅助精炼 ExpressionDNA
      const corpusSample = this.corpusText.slice(0, 3000);
      const dnaPrompt = buildDNAExtractionPrompt(corpusSample);
      const promptTokens = Math.round(dnaPrompt.length / 4);

      const llmResponse = await this.llmProvider.chat({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: dnaPrompt }],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const completionTokens = Math.round((llmResponse.content?.length ?? 0) / 4);
      const totalTokens = promptTokens + completionTokens;
      const cost = this.estimateLLMCost('deepseek-chat', totalTokens);

      let refinedDNA: Record<string, unknown> = {};
      try {
        const jsonMatch = llmResponse.content?.match(/\{[\s\S]*\}/);
        if (jsonMatch) refinedDNA = JSON.parse(jsonMatch[0]);
      } catch { /* use auto-generated */ }

      return {
        success: true,
        result: JSON.stringify({
          taskId: task.id,
          qualityScore: quality.score,
          qualityIssues: quality.issues,
          vocabularyCount: dnaProfile.vocabularyFingerprint.topWords.length,
          signaturePhrasesCount: dnaProfile.vocabularyFingerprint.signaturePhrases.length,
          toneTrajectory: dnaProfile.toneTrajectory.dominantTone,
          llmRefined: Object.keys(refinedDNA).length > 0,
          durationMs: Date.now() - startTime,
          tokensUsed: totalTokens,
          cost,
        }),
        cost,
        tokens: totalTokens,
      };
    } catch (err) {
      return {
        success: false,
        result: `提取失败: ${err instanceof Error ? err.message : String(err)}`,
        cost: 0,
        tokens: 0,
      };
    }
  }

  private async executeBuild(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    const startTime = Date.now();

    try {
      const existingDNA = this.persona.expressionDNA;
      const dnaProfile = this.dnaProfile;
      const quality = this.corpusQuality;

      const buildPrompt = this.buildPersonaUpdatePrompt(existingDNA, dnaProfile, quality);
      const promptTokens = Math.round(buildPrompt.length / 4);

      const llmResponse = await this.llmProvider.chat({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个 Persona 蒸馏专家。根据 ExpressionDNA 分析结果，生成 Persona 更新建议。只输出 JSON。',
          },
          { role: 'user', content: buildPrompt },
        ],
        temperature: 0.4,
        maxTokens: 1500,
      });

      const completionTokens = Math.round((llmResponse.content?.length ?? 0) / 4);
      const totalTokens = promptTokens + completionTokens;
      const cost = this.estimateLLMCost('deepseek-chat', totalTokens);

      return {
        success: true,
        result: JSON.stringify({
          taskId: task.id,
          personaId: this.persona.id,
          dnaProfileUsed: !!dnaProfile,
          corpusQualityScore: quality?.score,
          updateProposed: llmResponse.content?.length ?? 0 > 100,
          tokensUsed: totalTokens,
          cost,
          durationMs: Date.now() - startTime,
        }),
        cost,
        tokens: totalTokens,
      };
    } catch (err) {
      return {
        success: false,
        result: `构建失败: ${err instanceof Error ? err.message : String(err)}`,
        cost: 0,
        tokens: 0,
      };
    }
  }

  private buildPersonaUpdatePrompt(
    existingDNA: Persona['expressionDNA'],
    dnaProfile: ReturnType<typeof autoGenerateExpressionDNA> | null,
    quality: { score: number; issues: string[] } | null
  ): string {
    const vocab = dnaProfile?.vocabularyFingerprint.topWords.slice(0, 20).join(', ') ?? '';
    const patterns = dnaProfile?.syntacticPatterns.map(p => `${p.pattern}: ${p.frequency}`).join('; ') ?? '';
    const tone = dnaProfile?.toneTrajectory.dominantTone ?? 'unknown';
    const qualityIssues = quality?.issues?.join('; ') ?? '无';

    return `根据以下 ExpressionDNA 分析结果，为 "${this.persona.nameZh}"（${this.persona.name}）提出更新建议。

当前 Persona 信息：
- 已有词汇指纹: ${existingDNA.vocabulary.join(', ')}
- 已有句式风格: ${existingDNA.sentenceStyle.join(', ')}
- 已有禁用词: ${existingDNA.forbiddenWords.join(', ')}
- 语气确定度: ${existingDNA.certaintyLevel}

语料分析结果：
- 语料质量评分: ${quality?.score}/100
- 质量问题: ${qualityIssues}
- 词汇指纹（Top 20）: ${vocab}
- 句法模式: ${patterns}
- 主导语气: ${tone}

请生成 Persona 更新 JSON（只输出 JSON）：
{
  "expressionDNA": {
    "vocabulary": ["推荐添加的特征词"],
    "sentenceStyle": ["推荐添加的句式风格"],
    "forbiddenWords": ["该人物不会说的话"],
    "certaintyLevel": "high/medium/low",
    "rhetoricalHabit": "描述该人物的修辞习惯"
  },
  "improvements": ["具体的改进建议1", "改进建议2"]
}`;
  }

  private async executeTest(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    const startTime = Date.now();

    try {
      const { PersonaPlaytestEngine, generateTestCases } = await import('./persona-playtest');

      const testCases = generateTestCases(this.persona, 8);
      const engine = new PersonaPlaytestEngine({
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 400,
        concurrency: 2,
      });

      const results = await engine.runTests(this.persona, testCases);
      const { generatePlaytestReport } = await import('./persona-playtest');
      const score = calculateDistillationScore(this.persona);

      const report = generatePlaytestReport(this.persona, results, score);

      return {
        success: true,
        result: JSON.stringify({
          taskId: task.id,
          personaId: this.persona.id,
          totalCases: report.totalCases,
          passedCases: report.passedCases,
          averageScore: report.averageScore,
          grade: report.grade,
          improvementsCount: report.improvements.length,
          durationMs: Date.now() - startTime,
        }),
        cost: 0,
        tokens: 0,
      };
    } catch (err) {
      return {
        success: false,
        result: `测试失败: ${err instanceof Error ? err.message : String(err)}`,
        cost: 0,
        tokens: 0,
      };
    }
  }

  private estimateLLMCost(model: string, tokens: number): number {
    const pricePer1M: Record<string, number> = {
      'deepseek-chat': 0.27,
      'gpt-4o': 2.5,
      'claude-sonnet-4': 3.0,
    };
    const price = pricePer1M[model] ?? 1.0;
    return (tokens / 1_000_000) * price;
  }

  // ─── Phase 4: Quality Gate ────────────────────────────────────────────────

  async qualityGate(): Promise<DistillationScore> {
    this.emitEvent('quality_gate_started', {});

    const threshold = this.options.qualityThreshold ?? getAdaptiveThreshold(this.persona);
    const score = calculateDistillationScore(this.persona);

    // Guard: skip iterations for personas with no research data.
    // Empty personas will always score poorly — don't loop uselessly.
    const hasResearchData =
      this.persona.sources.length > 0 ||
      this.persona.mentalModels.length > 0 ||
      (this.persona.researchDimensions && this.persona.researchDimensions.length > 0);

    // Extra guard: if no corpus was collected at all, this is a critical failure
    const hasCorpus = this.collectedItems.length > 0 || this.corpusText.length > 100;
    const noCorpusWarning = !hasCorpus && !hasResearchData;

    if ((!hasResearchData && score.overall < threshold) || noCorpusWarning) {
      this.qualityGateSkipped = true;
      const reason = noCorpusWarning ? 'no_corpus_collected' : 'no_research_data';
      this.emitEvent('quality_gate_completed', {
        overall: score.overall,
        grade: score.grade,
        threshold,
        thresholdPassed: false,
        findingsCount: score.findings.length,
        breakdown: score.breakdown,
        personaType: this.personaType,
        skipped: true,
        reason,
        noCorpusWarning,
        newPersonaWarning: !hasResearchData,
      });
      return score;
    }

    this.emitEvent('quality_gate_completed', {
      overall: score.overall,
      grade: score.grade,
      threshold,
      thresholdPassed: score.overall >= threshold,
      findingsCount: score.findings.length,
      breakdown: score.breakdown,
      personaType: this.personaType,
    });

    return score;
  }

  // ─── Phase 5: Closed-Loop Auto-Fix ──────────────────────────────────────────

  async autoFix(score: DistillationScore): Promise<{ applied: string[]; improvement: number }> {
    const applied: string[] = [];
    let totalImprovement = 0;

    // 步骤 1: 根因分析
    const analysis = analyzeRootCause(score, this.corpusQuality);
    this.emitEvent('root_cause_analyzed', {
      rootCause: analysis.rootCause,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      recommendedFix: analysis.recommendedFix,
    });

    // 步骤 2: 根据根因执行针对性修复
    switch (analysis.rootCause) {
      case 'collect_more': {
        this.emitEvent('autofix_applied', {
          action: 'supplement_collection',
          message: '触发补充采集（语料不足）',
        });
        applied.push('supplement_collection');
        totalImprovement += analysis.estimatedImprovement;
        break;
      }

      case 'improve_dna': {
        if (this.dnaProfile) {
          // 强化表达DNA
          const dnaFixApplied = this.applyDNAFix();
          if (dnaFixApplied) {
            applied.push('dna_enhancement');
            totalImprovement += analysis.estimatedImprovement;
          }
        }
        break;
      }

      case 'generate_models': {
        this.emitEvent('autofix_applied', {
          action: 'model_generation',
          message: '触发思维模型生成（知识不足）',
        });
        applied.push('model_generation');
        totalImprovement += analysis.estimatedImprovement;
        break;
      }

      case 'add_boundaries': {
        const boundaryFixApplied = this.applyBoundaryFix();
        if (boundaryFixApplied) {
          applied.push('boundary_addition');
          totalImprovement += analysis.estimatedImprovement;
        }
        break;
      }

      case 'manual_review':
      default: {
        this.emitEvent('autofix_skipped', {
          reason: '需人工审查',
          findings: score.findings.filter(f => f.severity === 'critical' || f.severity === 'high').map(f => f.title),
        });
        applied.push('manual_review_required');
        break;
      }
    }

    // 步骤 3: 执行通用 autoFix（来自 distillation-metrics）
    const autoFixable = getAutoFixableFindings(score);
    for (const finding of autoFixable) {
      if (!this.options.autoApprove) {
        this.emitEvent('fix_suggested', {
          findingId: finding.id,
          title: finding.title,
          suggestion: finding.fixSuggestion,
        });
      } else {
        const success = await this.applyFix(finding);
        if (success) {
          applied.push(`fix_${finding.id}`);
          totalImprovement += 5;
        }
      }
    }

    return { applied, improvement: totalImprovement };
  }

  private applyDNAFix(): boolean {
    if (!this.dnaProfile) return false;

    // 从高频词中识别更精确的禁用词
    const freqWords = this.dnaProfile.vocabularyFingerprint.topWords.slice(0, 10);
    const existingForbidden = new Set(this.persona.expressionDNA.forbiddenWords);

    const suggestedForbidden = freqWords.filter(w =>
      !existingForbidden.has(w) &&
      !this.persona.expressionDNA.vocabulary.includes(w)
    );

    if (suggestedForbidden.length > 0) {
      this.emitEvent('dna_fix_applied', {
        action: 'forbidden_words_added',
        count: suggestedForbidden.length,
        words: suggestedForbidden.slice(0, 5),
      });
    }

    return suggestedForbidden.length > 0;
  }

  private applyBoundaryFix(): boolean {
    const blindspots = this.persona.blindspots ?? [];
    const existingBoundaries = this.persona.honestBoundaries ?? [];

    if (blindspots.length === 0) return false;

    const newBoundaries = blindspots
      .filter(b => !existingBoundaries.some(eb => eb.text.includes(b)))
      .map(b => ({
        text: `I am not an expert on: ${b}`,
        textZh: `我并非${b}领域的专家`,
      }));

    if (newBoundaries.length > 0) {
      this.emitEvent('boundary_fix_applied', {
        count: newBoundaries.length,
        topics: newBoundaries.map(b => b.textZh),
      });
      return true;
    }

    return false;
  }

  private async applyFix(finding: ScoreFinding): Promise<boolean> {
    try {
      switch (finding.id) {
        case 'voice-no-forbidden-words': {
          if (!this.dnaProfile) return false;
          const lowFreqWords = this.dnaProfile.vocabularyFingerprint.forbiddenWords;
          if (lowFreqWords.length === 0) return false;
          this.emitEvent('artifact_created', {
            findingId: finding.id,
            suggestedForbiddeWords: lowFreqWords.slice(0, 10),
            message: `建议添加 ${lowFreqWords.slice(0, 10).join(', ')} 到禁用词列表`,
          });
          return true;
        }
        case 'safety-no-honest-boundaries': {
          const blindspots = this.persona.blindspots ?? [];
          const honestBoundaries = blindspots.map(b => ({
            text: `I am not an expert on: ${b}`,
            textZh: `我并非${b}领域的专家`,
          }));
          this.emitEvent('artifact_created', {
            findingId: finding.id,
            suggestedBoundaries: honestBoundaries,
            message: `建议添加 ${honestBoundaries.length} 个诚实边界`,
          });
          return true;
        }
        default:
          this.emitEvent('task_progress', {
            stage: 'autofix',
            message: `无法自动修复: ${finding.id} - ${finding.title}`,
          });
          return false;
      }
    } catch {
      return false;
    }
  }

  // ─── Phase 6: Main Entry Point ────────────────────────────────────────────

  async run(sessionId?: string): Promise<FullDistillationResult> {
    this.sessionId = sessionId;
    const threshold = this.options.qualityThreshold ?? getAdaptiveThreshold(this.persona);
    this.plan.status = 'running';
    this.plan.startedAt = new Date();

    this.emitEvent('plan_created', {
      totalTasks: this.plan.tasks.length,
      waves: this.plan.waves.map(w => w.length),
      personaType: this.personaType,
      qualityThreshold: threshold,
      maxIterations: this.options.maxIterations,
    });

    try {
      // ── Pipeline: Wave 1-4 ──────────────────────────────────────────
      for (let wave = 1; wave <= 4; wave++) {
        const result = await this.executeWave(wave as PipelineWave);
        if (!result.success && wave <= 2) {
          throw new Error(`Wave ${wave} failed: ${result.error ?? 'unknown'}`);
        }
      }

      // ── Quality Gate ─────────────────────────────────────────────────
      let score = await this.qualityGate();
      this.currentIteration = 0;

      // ── Closed-Loop Iteration ─────────────────────────────────────────
      while (
        !this.qualityGateSkipped &&
        score.overall < threshold &&
        this.currentIteration < (this.options.maxIterations ?? 3)
      ) {
        this.currentIteration++;
        this.emitEvent('iteration_started', {
          iteration: this.currentIteration,
          currentScore: score.overall,
          targetScore: threshold,
        });

        // 根因分析
        const analysis = analyzeRootCause(score, this.corpusQuality);

        // 自动修复
        const { applied, improvement } = await this.autoFix(score);

        // 重新评分
        score = await this.qualityGate();

        // 记录迭代
        const record: IterationRecord = {
          iteration: this.currentIteration,
          score,
          rootCause: analysis,
          fixesApplied: applied,
          fixedCount: applied.length,
          timestamp: new Date(),
        };
        this.iterationRecords.push(record);

        this.emitEvent('iteration_completed', {
          iteration: this.currentIteration,
          newScore: score.overall,
          previousScore: score.overall - improvement,
          improvement,
          fixesApplied: applied,
          thresholdPassed: score.overall >= threshold,
        });

        // 如果改进已经达到阈值，提前退出
        if (score.overall >= threshold) break;

        // 检查成本上限
        if (this.options.maxCost && this.plan.totalCost > this.options.maxCost) {
          this.emitEvent('cost_limit_reached', {
            currentCost: this.plan.totalCost,
            maxCost: this.options.maxCost,
          });
          break;
        }
      }

      // ── Final Status ───────────────────────────────────────────────
      this.plan.status = 'completed';
      this.plan.completedAt = new Date();

      const qualityGateSkipped = this.qualityGateSkipped;

      const deploymentStatus: FullDistillationResult['deploymentStatus'] =
        score.overall >= threshold ? 'ready'
        : score.overall >= threshold * 0.8 ? 'needs-review'
        : score.overall >= threshold * 0.6 && qualityGateSkipped ? 'needs-review'
        : 'needs-work';

      this.emitEvent('pipeline_completed', {
        totalCost: this.plan.totalCost,
        totalTokens: this.plan.totalTokens,
        score: score.overall,
        thresholdPassed: score.overall >= threshold,
        iterations: this.currentIteration,
        deploymentStatus,
        iterationRecords: this.iterationRecords.length,
        qualityGateSkipped,
        corpusItemCount: this.collectedItems.length,
        corpusTotalWords: this.collectedItems.reduce((sum, i) => sum + (i.wordCount ?? 0), 0),
        newPersonaWithoutCorpus: this.collectedItems.length === 0 && qualityGateSkipped,
      });

      // Persist distilled persona to DB
      await this.persistDistilledPersona(score);

      return {
        persona: this.persona,
        score,
        iterations: this.iterationRecords,
        finalScore: score.overall,
        thresholdPassed: score.overall >= threshold,
        deploymentStatus,
        totalCost: this.plan.totalCost,
        totalTokens: this.plan.totalTokens,
        corpusStats: {
          totalWords: this.collectedItems.reduce((sum, i) => sum + (i.wordCount ?? 0), 0),
          sources: [...new Set(this.collectedItems.map(i => i.source))],
          qualityScore: this.corpusQuality?.score ?? 0,
        },
        personaType: this.personaType,
        qualityThreshold: threshold,
        qualityGateSkipped: this.qualityGateSkipped,
      };
    } catch (err) {
      this.plan.status = 'failed';
      this.plan.completedAt = new Date();

      this.emitEvent('pipeline_failed', {
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  }

  // ─── DB Persistence ─────────────────────────────────────────────────────────

  private async persistCollectedItem(item: CollectedItem): Promise<void> {
    if (!this.sessionId) return;
    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.distillCorpusItem.create({
        data: {
          sessionId: this.sessionId,
          collectorType: item.sourceType,
          source: item.source,
          sourceName: item.author ?? null,
          content: item.content,
          author: item.author ?? null,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          url: item.url ?? null,
          wordCount: item.wordCount ?? item.content.length,
          language: item.language ?? 'mixed',
          quality: item.quality ?? null,
          rawMetadata: (item.metadata ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      console.error('[Orchestrator] Failed to persist collected item:', e);
    }
  }

  private async persistDistilledPersona(score: DistillationScore): Promise<void> {
    if (!this.sessionId) return;
    const slug = this.persona.slug || this.persona.id;
    try {
      const { prisma } = await import('@/lib/prisma');

      await prisma.distilledPersona.upsert({
        where: { slug },
        create: {
          sessionId: this.sessionId,
          slug,
          name: this.persona.name,
          nameZh: this.persona.nameZh || this.persona.name,
          nameEn: this.persona.nameEn || this.persona.name,
          domain: this.persona.domain[0] || 'philosophy',
          tagline: this.persona.tagline || '',
          taglineZh: this.persona.taglineZh || '',
          avatar: this.persona.avatar || null,
          accentColor: this.persona.accentColor || '#6366f1',
          gradientFrom: this.persona.gradientFrom || '#6366f1',
          gradientTo: this.persona.gradientTo || '#8b5cf6',
          brief: this.persona.brief || '',
          briefZh: this.persona.briefZh || '',
          mentalModels: this.persona.mentalModels as unknown as Prisma.InputJsonValue,
          decisionHeuristics: this.persona.decisionHeuristics as unknown as Prisma.InputJsonValue,
          expressionDNA: this.persona.expressionDNA as unknown as Prisma.InputJsonValue,
          values: this.persona.values as unknown as Prisma.InputJsonValue,
          antiPatterns: this.persona.antiPatterns as unknown as Prisma.InputJsonValue,
          tensions: this.persona.tensions as unknown as Prisma.InputJsonValue,
          honestBoundaries: this.persona.honestBoundaries as unknown as Prisma.InputJsonValue,
          strengths: this.persona.strengths as unknown as Prisma.InputJsonValue,
          blindspots: this.persona.blindspots as unknown as Prisma.InputJsonValue,
          systemPromptTemplate: this.persona.systemPromptTemplate || '',
          identityPrompt: this.persona.identityPrompt || '',
          reasoningStyle: this.persona.reasoningStyle ?? null,
          decisionFramework: (this.persona.decisionFramework ?? []) as unknown as Prisma.InputJsonValue,
          keyQuotes: (this.persona.keyQuotes ?? []) as unknown as Prisma.InputJsonValue,
          lifePhilosophy: (this.persona.lifePhilosophy ?? {}) as unknown as Prisma.InputJsonValue,
          finalScore: score.overall,
          qualityGrade: score.grade,
          thresholdPassed: score.overall >= (this.options.qualityThreshold ?? 60),
          qualityGateSkipped: this.qualityGateSkipped,
          corpusItemCount: this.collectedItems.length,
          corpusTotalWords: this.collectedItems.reduce((sum, i) => sum + (i.wordCount ?? 0), 0),
          corpusSources: [...new Set(this.collectedItems.map(i => i.source))] as unknown as Prisma.InputJsonValue,
          distillVersion: this.persona.version || '0.1.0',
          distillDate: new Date(),
          isActive: true,
          isPublished: false,
        },
        update: {
          sessionId: this.sessionId,
          mentalModels: this.persona.mentalModels as unknown as Prisma.InputJsonValue,
          decisionHeuristics: this.persona.decisionHeuristics as unknown as Prisma.InputJsonValue,
          expressionDNA: this.persona.expressionDNA as unknown as Prisma.InputJsonValue,
          values: this.persona.values as unknown as Prisma.InputJsonValue,
          antiPatterns: this.persona.antiPatterns as unknown as Prisma.InputJsonValue,
          tensions: this.persona.tensions as unknown as Prisma.InputJsonValue,
          honestBoundaries: this.persona.honestBoundaries as unknown as Prisma.InputJsonValue,
          strengths: this.persona.strengths as unknown as Prisma.InputJsonValue,
          blindspots: this.persona.blindspots as unknown as Prisma.InputJsonValue,
          systemPromptTemplate: this.persona.systemPromptTemplate || '',
          identityPrompt: this.persona.identityPrompt || '',
          finalScore: score.overall,
          qualityGrade: score.grade,
          thresholdPassed: score.overall >= (this.options.qualityThreshold ?? 60),
          qualityGateSkipped: this.qualityGateSkipped,
          corpusItemCount: this.collectedItems.length,
          corpusTotalWords: this.collectedItems.reduce((sum, i) => sum + (i.wordCount ?? 0), 0),
          corpusSources: [...new Set(this.collectedItems.map(i => i.source))] as unknown as Prisma.InputJsonValue,
          distillDate: new Date(),
          updatedAt: new Date(),
        },
      });

      const savedSlug = slug;
      console.log(`[Orchestrator] Saved DistilledPersona: ${savedSlug}`);
    } catch (e) {
      console.error('[Orchestrator] Failed to persist distilled persona:', e);
      this.emitEvent('artifact_created', {
        findingId: 'deployment-persistence-error',
        message: `Persona 数据保存失败: ${e instanceof Error ? e.message : String(e)}`,
        detail: { slug, personaId: this.persona.id },
      });
    }
  }

  // ─── SSE Progress ──────────────────────────────────────────────────────────

  // @ts-ignore — custom event type not in pipeline types
  private emitEvent(
    type: PipelineEventType,
    detail: Record<string, unknown> = {}
  ): void {
    const event = createEvent(
      type,
      this.planId,
      this.persona.id,
      this.getEventMessage(type, detail),
      detail
    );

    this.events.push(event);

    if (this.sseController) {
      try {
        this.sseController.enqueue(formatSSE(event) + '\n');
      } catch { /* stream closed */ }
    }
  }

  private getEventMessage(type: string, detail: Record<string, unknown>): string {
    const messages: Record<string, (d: Record<string, unknown>) => string> = {
      plan_created: (d) =>
        `计划已创建，共 ${d.totalTasks} 个任务，${(d.waves as number[]).length} 个 Wave（人物类型: ${d.personaType}，阈值: ${d.qualityThreshold}）`,
      agentic_planning_started: (d) =>
        `Agentic Planning 开始：为 ${d.personaName} 推断最佳采集策略...`,
      agentic_planning_completed: (d) =>
        `采集策略已确定（来源: ${d.source}）: ${((d.collectorTypes as string[]) ?? []).join(', ') || '默认'}`,
      wave_started: (d) =>
        `Wave ${d.wave} 开始执行 (${d.taskCount} 个任务)`,
      wave_completed: (d) =>
        `Wave ${d.wave} 完成，成功 ${d.successCount}/${d.taskCount} 个任务，耗时 ${Math.round((d.duration as number) / 1000)}s`,
      task_started: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 任务开始`,
      task_completed: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 完成，消耗 ${Math.round((d.tokens as number) ?? 0)} tokens`,
      task_failed: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 失败: ${d.error}`,
      quality_gate_started: () => '质量门控评估中...',
      quality_gate_completed: (d) =>
        `评分: ${d.overall}/100 [${d.grade}] 阈值 ${d.threshold} ${d.thresholdPassed ? '✓ 通过' : '✗ 未通过'}，${d.findingsCount} 个问题`,
      iteration_started: (d) =>
        `迭代 #${d.iteration} 开始（当前 ${d.currentScore} → 目标 ${d.targetScore}）`,
      iteration_completed: (d) =>
        `迭代 #${d.iteration} 完成（${d.previousScore} → ${d.newScore}，+${d.improvement}）`,
      root_cause_analyzed: (d) =>
        `根因分析: ${d.rootCause}（置信度 ${((d.confidence as number) * 100).toFixed(0)}%）— ${d.reasoning}`,
      autofix_applied: (d) => `自动修复: ${d.action} — ${d.message}`,
      pipeline_completed: (d) =>
        `蒸馏完成（评分 ${d.score}，${d.iterations} 次迭代，$ ${(d.totalCost as number).toFixed(4)}，${(d.totalTokens as number).toLocaleString()} tokens）`,
      pipeline_failed: (d) => `蒸馏失败: ${d.error}`,
    };

    const fn = messages[type];
    return fn ? fn(detail) : type;
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  getPlan(): PipelinePlan { return this.plan; }
  getEvents(): PipelineEvent[] { return this.events; }
  getProgress(): { currentWave: PipelineWave; completedTasks: number; totalTasks: number } {
    const completedTasks = this.plan.tasks.filter(t => t.status === 'completed').length;
    return { currentWave: this.plan.currentWave, completedTasks, totalTasks: this.plan.tasks.length };
  }
}

// ─── Convenience Functions ────────────────────────────────────────────────────

export async function runFullDistillation(
  persona: Persona,
  options: DistillationOptions = {},
  config?: Partial<CollectorConfig>,
  sseController?: ReadableStreamDefaultController,
  llmProvider?: LLMProvider,
  sessionId?: string,
): Promise<FullDistillationResult> {
  const orchestrator = new FullAutoDistillationOrchestrator(persona, options, config, sseController, llmProvider);
  return orchestrator.run(sessionId);
}

export async function quickScore(persona: Persona): Promise<DistillationScore> {
  return calculateDistillationScore(persona);
}

export async function generatePlan(personaId: string): Promise<PipelinePlan | null> {
  const { getPersonaById } = await import('./personas');
  const persona = getPersonaById(personaId);
  if (!persona) return null;
  const orchestrator = new FullAutoDistillationOrchestrator(persona);
  return orchestrator.getPlan();
}
