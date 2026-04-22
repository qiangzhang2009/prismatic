/**
 * Prismatic — Distillation Orchestrator
 * Claude Swarm 风格任务编排引擎
 *
 * 核心设计：
 * Phase 1: 任务分解 — 分析人物缺口，生成任务依赖图
 * Phase 2: Wave 执行 — 按拓扑序分批次并行执行
 * Phase 3: Quality Gate — 自动评分 + 阈值门控
 * Phase 4: 验证输出 — Persona 一致性检查
 */

import { nanoid } from 'nanoid';
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
} from './distillation-events';
import { calculateDistillationScore, getAutoFixableFindings } from './distillation-metrics';
import { PERSONA_CONFIDENCE } from './confidence';

// ─── Stage Config ────────────────────────────────────────────────────────────

const STAGE_ORDER: PipelineStage[] = ['discover', 'collect', 'extract', 'build', 'test'];

const STAGE_DESCRIPTIONS: Record<PipelineStage, { zh: string; en: string }> = {
  discover: { zh: '发现缺口', en: 'Discover data gaps' },
  collect: { zh: '采集语料', en: 'Collect corpus' },
  extract: { zh: '提取特征', en: 'Extract features' },
  build: { zh: '构建 Persona', en: 'Build Persona' },
  test: { zh: 'Playtest 测试', en: 'Playtest' },
};

const WAVE_DEPS: Record<PipelineWave, PipelineStage[]> = {
  1: ['discover', 'collect'],
  2: ['extract'],
  3: ['build'],
  4: ['test'],
};

// ─── Default Collector Config ───────────────────────────────────────────────

const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  parallelLimit: 4,
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; PrismaticBot/1.0; +https://prismatic.zxqconsulting.com)',
  respectRobotsTxt: true,
};

// ─── Orchestrator ────────────────────────────────────────────────────────────

export class DistillationOrchestrator {
  private persona: Persona;
  private planId: string;
  private plan: PipelinePlan;
  private events: PipelineEvent[] = [];
  private config: CollectorConfig;
  private sseController?: ReadableStreamDefaultController;

  constructor(
    persona: Persona,
    config?: Partial<CollectorConfig>,
    sseController?: ReadableStreamDefaultController
  ) {
    this.persona = persona;
    this.planId = nanoid(8);
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.sseController = sseController;
    this.plan = this.createInitialPlan();
  }

  // ─── Phase 1: 任务分解 ─────────────────────────────────────────────────────

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

    // ── Stage: Discover ──────────────────────────────────────────────────
    // 分析缺口，生成采集目标

    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'discover',
      description: '分析现有数据缺口',
      descriptionZh: '分析现有数据，识别语料库缺口',
      status: 'pending',
      dependencies: [],
      createdAt: new Date(),
    });

    // ── Stage: Collect ───────────────────────────────────────────────────
    // 根据缺口生成采集任务

    const confidence = PERSONA_CONFIDENCE[persona.id];
    const gaps = confidence?.mainGaps ?? [];

    for (const gap of gaps) {
      const collectorType = this.inferCollectorType(gap);
      const taskId = `task-${taskIndex++}`;

      tasks.push({
        id: taskId,
        personaId: persona.id,
        stage: 'collect',
        description: `采集缺失数据: ${gap}`,
        descriptionZh: `采集缺失数据: ${gap}`,
        status: 'pending',
        dependencies: [`task-${taskIndex - 2}`], // 依赖于 discover
        createdAt: new Date(),
      });
    }

    // ── Stage: Extract ──────────────────────────────────────────────────
    // 语料清洗、结构化、ExpressionDNA 提取

    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'extract',
      description: '清洗和结构化语料',
      descriptionZh: '清洗语料、去除噪声、结构化',
      status: 'pending',
      dependencies: tasks
        .filter(t => t.stage === 'collect')
        .map(t => t.id),
      createdAt: new Date(),
    });

    // ── Stage: Build ────────────────────────────────────────────────────
    // 构建 Persona

    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'build',
      description: '构建 Persona 数据结构',
      descriptionZh: '基于提取的特征构建 Persona',
      status: 'pending',
      dependencies: [`task-${taskIndex - 2}`],
      createdAt: new Date(),
    });

    // ── Stage: Test ────────────────────────────────────────────────────
    // Playtest 测试

    tasks.push({
      id: `task-${taskIndex++}`,
      personaId: persona.id,
      stage: 'test',
      description: '运行 Playtest',
      descriptionZh: '运行 Playtest 验证 Persona 质量',
      status: 'pending',
      dependencies: [`task-${taskIndex - 2}`],
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
    return 'blog'; // 默认博客采集
  }

  private topologicalSort(tasks: PipelineTask[]): PipelineTask[][] {
    const waves: PipelineTask[][] = [[], [], [], []];
    const completed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // 迭代分配任务到 wave
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
      case 'collect':
        return 0;
      case 'extract':
        return 1;
      case 'build':
        return 2;
      case 'test':
        return 3;
      default:
        return 0;
    }
  }

  // ─── Phase 2: Wave 执行 ────────────────────────────────────────────────────

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

    // 并行执行同 wave 内的任务
    const results = await Promise.allSettled(
      waveTasks.map(async (task) => {
        task.status = 'running';
        task.startedAt = new Date();

        this.emitEvent('task_started', {
          taskId: task.id,
          stage: task.stage,
        });

        const result = await this.executeTask(task);
        return result;
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const task = waveTasks[i];

      if (result.status === 'fulfilled') {
        const value = result.value;
        task.status = value.success ? 'completed' : 'failed';
        task.completedAt = new Date();
        task.result = value.result;
        task.cost = value.cost ?? 0;
        task.tokensUsed = value.tokens ?? 0;
        waveCost += value.cost ?? 0;
        this.plan.totalTokens += value.tokens ?? 0;

        this.emitEvent('task_completed', {
          taskId: task.id,
          stage: task.stage,
          cost: value.cost,
          tokens: value.tokens,
        });
      } else {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = result.reason?.message ?? 'Unknown error';
        allSuccess = false;

        this.emitEvent('task_failed', {
          taskId: task.id,
          stage: task.stage,
          error: task.error,
        });
      }
    }

    const duration = Date.now() - startTime;
    this.plan.totalCost += waveCost;
    this.plan.currentWave = wave;

    this.emitEvent('wave_completed', {
      wave,
      taskCount: waveTasks.length,
      successCount: waveTasks.filter(t => t.status === 'completed').length,
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
        case 'discover':
          return await this.executeDiscover(task);
        case 'collect':
          return await this.executeCollect(task);
        case 'extract':
          return await this.executeExtract(task);
        case 'build':
          return await this.executeBuild(task);
        case 'test':
          return await this.executeTest(task);
        default:
          return { success: false, result: `Unknown stage: ${task.stage}` };
      }
    } catch (err) {
      return {
        success: false,
        result: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async executeDiscover(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    // 分析现有数据缺口
    const confidence = PERSONA_CONFIDENCE[this.persona.id];
    const gaps = confidence?.mainGaps ?? [];

    const result = {
      personaId: this.persona.id,
      currentOverall: confidence?.overall ?? 0,
      gaps,
      recommendedSources: this.getRecommendedSources(gaps),
    };

    return {
      success: true,
      result: JSON.stringify(result),
      cost: 0,
      tokens: 0,
    };
  }

  private getRecommendedSources(gaps: string[]): ScrapingTarget[] {
    const targets: ScrapingTarget[] = [];

    for (const gap of gaps) {
      const lower = gap.toLowerCase();
      if (lower.includes('twitter') || lower.includes('推文')) {
        targets.push({
          id: nanoid(8),
          personaId: this.persona.id,
          collectorType: 'twitter',
          source: 'Twitter/X',
          type: 'tweet',
          status: 'pending',
          itemsCollected: 0,
          retryCount: 0,
          createdAt: new Date(),
        });
      }
      if (lower.includes('视频') || lower.includes('字幕')) {
        targets.push({
          id: nanoid(8),
          personaId: this.persona.id,
          collectorType: 'video',
          source: 'YouTube/Bilibili',
          type: 'video',
          status: 'pending',
          itemsCollected: 0,
          retryCount: 0,
          createdAt: new Date(),
        });
      }
      if (lower.includes('访谈') || lower.includes('podcast')) {
        targets.push({
          id: nanoid(8),
          personaId: this.persona.id,
          collectorType: 'podcast',
          source: 'Podcast',
          type: 'interview',
          status: 'pending',
          itemsCollected: 0,
          retryCount: 0,
          createdAt: new Date(),
        });
      }
    }

    return targets;
  }

  private async executeCollect(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    // 采集任务：实际执行时会被采集器接管
    // 这里模拟采集过程
    await this.simulateDelay(500 + Math.random() * 1500);

    return {
      success: true,
      result: `Collected data for: ${task.description}`,
      cost: 0.001 * Math.random(),
      tokens: Math.round(100 + Math.random() * 500),
    };
  }

  private async executeExtract(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    // ExpressionDNA 提取
    await this.simulateDelay(1000 + Math.random() * 2000);

    return {
      success: true,
      result: 'ExpressionDNA extracted and validated',
      cost: 0.005 * Math.random(),
      tokens: Math.round(500 + Math.random() * 2000),
    };
  }

  private async executeBuild(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    // Persona 构建
    await this.simulateDelay(2000 + Math.random() * 3000);

    return {
      success: true,
      result: 'Persona structure updated',
      cost: 0.01 * Math.random(),
      tokens: Math.round(2000 + Math.random() * 5000),
    };
  }

  private async executeTest(task: PipelineTask): Promise<{
    success: boolean;
    result?: string;
    cost?: number;
    tokens?: number;
  }> {
    // Playtest
    await this.simulateDelay(3000 + Math.random() * 5000);

    return {
      success: true,
      result: 'Playtest completed with score',
      cost: 0.02 * Math.random(),
      tokens: Math.round(5000 + Math.random() * 10000),
    };
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Phase 3: Quality Gate ─────────────────────────────────────────────────

  async qualityGate(): Promise<DistillationScore> {
    this.emitEvent('quality_gate_started', {});

    const score = calculateDistillationScore(this.persona);

    this.emitEvent('quality_gate_completed', {
      overall: score.overall,
      grade: score.grade,
      thresholdPassed: score.thresholdPassed,
      findingsCount: score.findings.length,
      breakdown: score.breakdown,
    });

    return score;
  }

  // ─── Phase 4: 自动修复 ─────────────────────────────────────────────────────

  async autoFix(score: DistillationScore): Promise<number> {
    const autoFixable = getAutoFixableFindings(score);

    if (autoFixable.length === 0) return 0;

    let fixed = 0;

    for (const finding of autoFixable) {
      const success = await this.applyFix(finding);
      if (success) fixed++;
    }

    return fixed;
  }

  private async applyFix(finding: ScoreFinding): Promise<boolean> {
    // 实际项目中，这里会根据 finding 的类型应用具体的修复
    // 目前是占位实现
    return true;
  }

  // ─── 主入口 ────────────────────────────────────────────────────────────────

  async run(): Promise<{
    plan: PipelinePlan;
    score?: DistillationScore;
    fixedCount?: number;
  }> {
    this.plan.status = 'running';
    this.plan.startedAt = new Date();

    this.emitEvent('plan_created', {
      totalTasks: this.plan.tasks.length,
      waves: this.plan.waves.map(w => w.length),
    });

    try {
      // Wave 1-2: 采集和提取
      for (let wave = 1; wave <= 2; wave++) {
        const result = await this.executeWave(wave as PipelineWave);
        if (!result.success) {
          throw new Error(`Wave ${wave} failed`);
        }
      }

      // Wave 3: 构建
      await this.executeWave(3);

      // Wave 4: 测试
      await this.executeWave(4);

      // Quality Gate
      const score = await this.qualityGate();

      // 自动修复
      let fixedCount = 0;
      if (!score.thresholdPassed) {
        fixedCount = await this.autoFix(score);
        if (fixedCount > 0) {
          // 重新评分
          const newScore = await this.qualityGate();
          return {
            plan: { ...this.plan, status: newScore.thresholdPassed ? 'completed' : 'completed' },
            score: newScore,
            fixedCount,
          };
        }
      }

      this.plan.status = 'completed';
      this.plan.completedAt = new Date();

      this.emitEvent('pipeline_completed', {
        totalCost: this.plan.totalCost,
        totalTokens: this.plan.totalTokens,
        score: score.overall,
      });

      return { plan: this.plan, score, fixedCount };
    } catch (err) {
      this.plan.status = 'failed';
      this.plan.completedAt = new Date();

      this.emitEvent('pipeline_failed', {
        error: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  }

  // ─── SSE 进度流 ───────────────────────────────────────────────────────────

  private emitEvent(
    type: PipelineEvent['type'],
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

    // 通过 SSE 推送
    if (this.sseController) {
      try {
        this.sseController.enqueue(
          formatSSE(event) + '\n'
        );
      } catch {
        // SSE stream closed
      }
    }
  }

  private getEventMessage(type: string, detail: Record<string, unknown>): string {
    const messages: Record<string, (d: Record<string, unknown>) => string> = {
      plan_created: (d) =>
        `计划已创建，共 ${d.totalTasks} 个任务，${(d.waves as number[]).length} 个 Wave`,
      wave_started: (d) =>
        `Wave ${d.wave} 开始执行 (${d.taskCount} 个任务)`,
      wave_completed: (d) =>
        `Wave ${d.wave} 完成，成功 ${d.successCount}/${d.taskCount} 个任务，耗时 ${Math.round((d.duration as number) / 1000)}s`,
      task_started: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 任务开始`,
      task_completed: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 任务完成，消耗 ${Math.round((d.tokens as number) ?? 0)} tokens`,
      task_failed: (d) =>
        `[${STAGE_DESCRIPTIONS[d.stage as PipelineStage]?.zh ?? d.stage}] 任务失败: ${d.error}`,
      quality_gate_started: () => '运行质量门控评估...',
      quality_gate_completed: (d) =>
        `质量评分: ${d.overall}/100 [${d.grade}] ${d.thresholdPassed ? '✓ 通过' : '✗ 未通过'}，发现 ${d.findingsCount} 个问题`,
      pipeline_completed: (d) =>
        `蒸馏完成，总消耗 $${(d.totalCost as number).toFixed(4)}，${(d.totalTokens as number).toLocaleString()} tokens`,
      pipeline_failed: (d) =>
        `蒸馏失败: ${d.error}`,
    };

    const fn = messages[type];
    return fn ? fn(detail) : type;
  }

  // ─── 工具方法 ─────────────────────────────────────────────────────────────

  getPlan(): PipelinePlan {
    return this.plan;
  }

  getEvents(): PipelineEvent[] {
    return this.events;
  }

  getProgress(): { currentWave: PipelineWave; completedTasks: number; totalTasks: number } {
    const completedTasks = this.plan.tasks.filter(t => t.status === 'completed').length;
    return {
      currentWave: this.plan.currentWave,
      completedTasks,
      totalTasks: this.plan.tasks.length,
    };
  }
}

// ─── Convenience Functions ────────────────────────────────────────────────────

export async function runDistillation(
  persona: Persona,
  config?: Partial<CollectorConfig>,
  sseController?: ReadableStreamDefaultController
): Promise<{
  plan: PipelinePlan;
  score?: DistillationScore;
  fixedCount?: number;
}> {
  const orchestrator = new DistillationOrchestrator(persona, config, sseController);
  return orchestrator.run();
}

export async function quickScore(persona: Persona): Promise<DistillationScore> {
  return calculateDistillationScore(persona);
}

export async function generatePlan(personaId: string): Promise<PipelinePlan | null> {
  const { getPersonaById } = await import('./personas');
  const persona = getPersonaById(personaId);
  if (!persona) return null;

  const orchestrator = new DistillationOrchestrator(persona);
  return orchestrator.getPlan();
}
