#!/usr/bin/env node
/**
 * Prismatic — Distillation CLI
 * 人物蒸馏命令行工具
 *
 * 用法:
 *   npx ts-node scripts/distill-persona.ts <persona-id>          # 运行完整蒸馏
 *   npx ts-node scripts/distill-persona.ts <persona-id> --score  # 仅评分
 *   npx ts-node scripts/distill-persona.ts <persona-id> --gaps   # 查看缺口
 *   npx ts-node scripts/distill-persona.ts <persona-id> --plan   # 查看任务计划
 *   npx ts-node scripts/distill-persona.ts <persona-id> --collect  # 仅采集
 *   npx ts-node scripts/distill-persona.ts <persona-id> --test    # 仅测试
 *   npx ts-node scripts/distill-persona.ts <persona-id> --dry-run # 预览不执行
 *
 * 示例:
 *   npx ts-node scripts/distill-persona.ts naval-ravikant --score
 *   npx ts-node scripts/distill-persona.ts elon-musk --collect
 *   npx ts-node scripts/distill-persona.ts charlie-munger --dry-run
 */

import { parseArgs } from 'node:util';
import { PERSONA_CONFIDENCE } from '../src/lib/confidence';
import { calculateDistillationScore, formatScoreReport, getTopFindings } from '../src/lib/distillation-metrics';
import { autoGenerateExpressionDNA, assessCorpusQuality } from '../src/lib/expression-calibrator';
import { generateTestCases } from '../src/lib/persona-playtest';
import { DistillationOrchestrator, generatePlan } from '../src/lib/distillation-orchestrator';
import { getPersonaById } from '../src/lib/personas';
import type { Persona } from '../src/lib/types';

// ─── Color Output ─────────────────────────────────────────────────────────────

const colors: Record<string, string> = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function color(c: string, text: string): string {
  return `${colors[c] ?? ''}${text}${colors.reset}`;
}

function log(...args: (string | number)[]): void {
  console.log(...args);
}

function logHeader(text: string): void {
  log('');
  log(color('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  log(color('cyan', '  ') + color('bright', text));
  log(color('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  log('');
}

function logSection(text: string): void {
  log('');
  log(color('yellow', `▸ ${text}`));
}

function logSuccess(text: string): void {
  log(color('green', `  ✓ ${text}`));
}

function logWarn(text: string): void {
  log(color('yellow', `  ⚠ ${text}`));
}

function logError(text: string): void {
  log(color('red', `  ✗ ${text}`));
}

function logInfo(text: string): void {
  log(color('blue', `  • ${text}`));
}

function logDim(text: string): void {
  log(color('dim', `    ${text}`));
}

// ─── ASCII Progress Bar ───────────────────────────────────────────────────────

function progressBar(value: number, max: number, width: number = 30): string {
  const ratio = Math.min(1, value / Math.max(1, max));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function renderStarRating(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function cmdScore(persona: Persona): Promise<void> {
  logHeader(`蒸馏评分 — ${persona.nameZh} (${persona.id})`);

  const score = calculateDistillationScore(persona);
  const report = formatScoreReport(score, persona);

  log(report);

  if (score.findings.length > 0) {
    logSection('TOP 5 优先修复项');
    const topFindings = getTopFindings(score, 5);
    for (const finding of topFindings) {
      const icon = finding.severity === 'critical' ? '💀'
        : finding.severity === 'high' ? '🔴'
        : finding.severity === 'medium' ? '🟡'
        : finding.severity === 'low' ? '🟢' : '🔵';

      log(`  ${icon} [${finding.severity.toUpperCase()}] ${color('bright', finding.title)}`);
      log(`     ${color('dim', finding.fixSuggestion)}`);
    }
  }
}

async function cmdGaps(persona: Persona): Promise<void> {
  logHeader(`数据缺口分析 — ${persona.nameZh}`);

  const confidence = PERSONA_CONFIDENCE[persona.id];

  if (!confidence) {
    logError('未找到置信度数据');
    return;
  }

  logSection('当前状态');
  log(`  总体评分: ${confidence.overall}/100 ${renderStarRating(confidence.starRating)}`);
  log(`  版本: ${confidence.version}`);
  log(`  优先级: ${color(confidence.priority === 'high' ? 'red' : confidence.priority === 'medium' ? 'yellow' : 'green', confidence.priority.toUpperCase())}`);
  log(`  语料路径: ${confidence.corpusPath ? color('dim', confidence.corpusPath) : color('dim', '(未设置)')}`);

  logSection('数据来源');
  for (const source of confidence.dataSources) {
    log(`  ${color('cyan', `[${source.type}]`)} ${color('bright', source.source)}`);
    log(`    数量: ${source.quantity} | 质量: ${'★'.repeat(parseInt(source.quality))}${colors.reset}`);
  }

  logSection('主要缺口');
  if (confidence.mainGaps.length === 0) {
    logSuccess('暂无已知缺口');
  } else {
    for (const gap of confidence.mainGaps) {
      log(`  • ${gap}`);
    }
  }

  logSection('建议下一步');
  if (confidence.priority === 'high') {
    logInfo('优先补充高优先级数据缺口');
    logInfo('运行采集: --collect');
  } else if (confidence.priority === 'medium') {
    logInfo('定期补充中等优先级的数据缺口');
    logInfo('运行蒸馏: 直接运行即可');
  } else {
    logSuccess('人物已高度完善，可定期微调');
  }
}

async function cmdPlan(personaId: string): Promise<void> {
  logHeader(`蒸馏任务计划 — ${personaId}`);

  const plan = await generatePlan(personaId);

  if (!plan) {
    logError(`未找到人物: ${personaId}`);
    return;
  }

  logSection('任务图');
  log(`  计划 ID: ${plan.id}`);
  log(`  人物 ID: ${plan.personaId}`);
  log(`  总任务数: ${plan.tasks.length}`);
  log(`  Wave 数: ${plan.waves.length}`);
  log('');

  for (let waveIdx = 0; waveIdx < plan.waves.length; waveIdx++) {
    const wave = plan.waves[waveIdx];
    log(color('bright', `  ┌─ Wave ${waveIdx + 1} (${wave.length} 个任务)`));

    for (const task of wave) {
      const stageColor = task.stage === 'discover' ? 'blue'
        : task.stage === 'collect' ? 'green'
        : task.stage === 'extract' ? 'yellow'
        : task.stage === 'build' ? 'magenta'
        : 'cyan';

      log(`  │  [${color(stageColor, task.stage.padEnd(8))}] ${task.descriptionZh}`);
    }
    log('  └─────────────────────────────────────');
  }

  log('');
  logInfo('运行蒸馏: npx ts-node scripts/distill-persona.ts <persona-id>');
  logInfo('Dry Run:  npx ts-node scripts/distill-persona.ts <persona-id> --dry-run');
}

async function cmdCollect(persona: Persona): Promise<void> {
  logHeader(`采集阶段 — ${persona.nameZh}`);

  const confidence = PERSONA_CONFIDENCE[persona.id];
  const gaps = confidence?.mainGaps ?? [];

  if (gaps.length === 0) {
    logSuccess('暂无已知缺口，跳过采集');
    return;
  }

  logSection('将采集以下数据:');
  for (let i = 0; i < gaps.length; i++) {
    log(`  ${i + 1}. ${gaps[i]}`);
  }

  log('');
  logInfo('采集协调器初始化中...');
  logInfo('(实际采集功能需要在运行时配置 LLM 和网络访问)');
}

async function cmdTest(persona: Persona): Promise<void> {
  logHeader(`Playtest 测试 — ${persona.nameZh}`);

  const cases = generateTestCases(persona, 5);

  logSection('测试用例预览:');
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    log(`  ${i + 1}. [${color('cyan', c.topicCategory)}] ${c.prompt.slice(0, 60)}${c.prompt.length > 60 ? '...' : ''}`);
  }

  log('');
  logInfo(`共生成 ${cases.length} 个测试用例`);
  logInfo('(运行完整蒸馏时将自动执行 Playtest)');
}

async function cmdDryRun(persona: Persona): Promise<void> {
  logHeader(`Dry Run — ${persona.nameZh}`);

  logSection('将执行以下步骤:');
  log('');
  log(`  1. ${color('blue', 'Discover')}  — 分析 ${persona.nameZh} 的数据缺口`);
  log(`  2. ${color('green', 'Collect')}  — 采集缺失的语料`);
  log(`  3. ${color('yellow', 'Extract')} — 清洗语料，提取 ExpressionDNA`);
  log(`  4. ${color('magenta', 'Build')}  — 构建 Persona 数据结构`);
  log(`  5. ${color('cyan', 'Test')}     — 运行 Playtest 验证`);
  log(`  6. ${color('green', 'Quality Gate')} — 评分并生成报告`);
  log('');

  const confidence = PERSONA_CONFIDENCE[persona.id];
  logSection('人物当前状态:');
  log(`  置信度: ${confidence?.overall ?? '?'}/100 ${renderStarRating(confidence?.starRating ?? 0)}`);
  log(`  主要缺口: ${(confidence?.mainGaps ?? []).join(', ') || '暂无'}`);
  log('');
  logInfo('要执行蒸馏，请运行: npx ts-node scripts/distill-persona.ts <persona-id>');
}

async function cmdFull(persona: Persona): Promise<void> {
  logHeader(`蒸馏管道启动 — ${persona.nameZh}`);

  const startTime = Date.now();

  logSection('Phase 1: 任务分解');
  const orchestrator = new DistillationOrchestrator(persona);
  const plan = orchestrator.getPlan();
  log(`  计划 ID: ${plan.id}`);
  log(`  任务数: ${plan.tasks.length} 个`);
  log(`  Wave 数: ${plan.waves.length} 个`);
  logSuccess('分解完成');

  logSection('Phase 2: 执行 Wave');
  logInfo('正在执行蒸馏流水线...');
  logInfo('(模拟执行，完整执行需要 LLM 和网络支持)');

  logSection('Phase 3: 质量门控');
  const score = calculateDistillationScore(persona);
  log(`  评分: ${score.overall}/100 [${color(score.overall >= 75 ? 'green' : score.overall >= 60 ? 'yellow' : 'red', score.grade)}]`);
  log(`  通过阈值: ${score.thresholdPassed ? color('green', '✓') : color('red', '✗')} (${score.thresholdPassed ? '通过' : '未通过'})`);
  log(`  发现问题: ${score.findings.length} 项`);
  logSuccess('评估完成');

  const duration = Math.round((Date.now() - startTime) / 1000);
  logSection('蒸馏完成');
  log(`  耗时: ${duration}s`);
  log(`  总成本: $${plan.totalCost.toFixed(4)}`);
  log('');
  logInfo('详细报告: npx ts-node scripts/distill-persona.ts <persona-id> --score');
}

// ─── Corpus Analysis ───────────────────────────────────────────────────────────

async function cmdCorpus(corpusPath: string): Promise<void> {
  logHeader('语料质量分析');

  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(corpusPath, 'utf-8');
    const quality = assessCorpusQuality(content);
    const dna = autoGenerateExpressionDNA(content);

    logSection('质量评分');
    log(`  总分: ${quality.score}/100`);
    log(`  字数: ${quality.wordCount.toLocaleString()}`);
    log(`  独特词比例: ${(quality.uniqueWordRatio * 100).toFixed(1)}%`);
    log(`  平均句长: ${quality.avgSentenceLength} 字`);
    log(`  中文比例: ${(quality.zhRatio * 100).toFixed(1)}%`);
    log(`  英文比例: ${(quality.enRatio * 100).toFixed(1)}%`);

    if (quality.issues.length > 0) {
      logSection('问题');
      for (const issue of quality.issues) {
        logWarn(issue);
      }
    }

    logSection('词汇指纹 (Top 20)');
    for (let i = 0; i < Math.min(20, dna.vocabularyFingerprint.topWords.length); i++) {
      const w = dna.vocabularyFingerprint.topWords[i];
      if (i % 4 === 0) log('');
      log(`  ${String(i + 1).padStart(2)}. ${w}`);
    }

    logSection('语调特征');
    log(`  主语调: ${dna.toneTrajectory.dominantTone}`);
    log(`  置信度: ${dna.toneTrajectory.certaintyLevel}`);
    log(`  幽默频率: ${dna.toneTrajectory.humorFrequency}`);
    log(`  语调转变: ${dna.toneTrajectory.toneShifts} 次`);
  } catch (err) {
    logError(`无法读取语料文件: ${corpusPath}`);
    logInfo(`请确保文件路径正确，或使用绝对路径`);
  }
}

// ─── List Personas ─────────────────────────────────────────────────────────────

async function cmdList(): Promise<void> {
  logHeader('可蒸馏人物列表');

  const personas = Object.entries(PERSONA_CONFIDENCE)
    .sort((a, b) => b[1].overall - a[1].overall);

  logSection(`共 ${personas.length} 个人物`);
  log('');
  log(`  ${'人物ID'.padEnd(20)} ${'评分'.padEnd(6)} ${'优先级'.padEnd(8)} ${'主要缺口'}`);
  log(`  ${'─'.repeat(70)}`);

  for (const [id, conf] of personas) {
    const gap = conf.mainGaps[0] ?? '-';
    const priorityColor = conf.priority === 'high' ? 'red'
      : conf.priority === 'medium' ? 'yellow' : 'green';
    log(
      `  ${color('bright', id.padEnd(20))} ` +
      `${String(conf.overall).padEnd(6)} ` +
      `${color(priorityColor, conf.priority.padEnd(8))} ` +
      `${gap.length > 25 ? gap.slice(0, 25) + '...' : gap}`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      score: { type: 'boolean', short: 's' },
      gaps: { type: 'boolean', short: 'g' },
      plan: { type: 'boolean', short: 'p' },
      collect: { type: 'boolean', short: 'c' },
      test: { type: 'boolean', short: 't' },
      dryrun: { type: 'boolean', short: 'd' },
      corpus: { type: 'string', short: 'C' },
      list: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  // List
  if (values.list) {
    await cmdList();
    return;
  }

  // Help
  if (values.help || positionals.length === 0) {
    logHeader('Prismatic 蒸馏 CLI 帮助');
    log(`
${color('bright', '用法:')}
  npx ts-node scripts/distill-persona.ts <persona-id> [options]

${color('bright', '命令:')}
  --score, -s     评分并生成详细报告
  --gaps, -g      分析数据缺口
  --plan, -p      查看任务执行计划
  --collect, -c   仅运行采集阶段
  --test, -t      仅运行测试用例生成
  --dry-run, -d   预览执行计划（不执行）
  --corpus, -C    分析语料文件质量
  --list, -l      列出所有可蒸馏人物

${color('bright', '示例:')}
  npx ts-node scripts/distill-persona.ts naval-ravikant --score
  npx ts-node scripts/distill-persona.ts elon-musk --gaps
  npx ts-node scripts/distill-persona.ts charlie-munger --plan
  npx ts-node scripts/distill-persona.ts --corpus ./corpus.txt
  npx ts-node scripts/distill-persona.ts --list
    `);
    return;
  }

  const personaId = positionals[0]!;

  // Get persona
  const persona = getPersonaById(personaId);
  if (!persona) {
    logError(`未找到人物: ${personaId}`);
    logInfo(`可用人物: npx ts-node scripts/distill-persona.ts --list`);
    return;
  }

  // Dispatch commands
  if (values.score) {
    await cmdScore(persona);
  } else if (values.gaps) {
    await cmdGaps(persona);
  } else if (values.plan) {
    await cmdPlan(personaId);
  } else if (values.collect) {
    await cmdCollect(persona);
  } else if (values.test) {
    await cmdTest(persona);
  } else if (values.dryrun) {
    await cmdDryRun(persona);
  } else if (values.corpus) {
    await cmdCorpus(values.corpus);
  } else {
    await cmdFull(persona);
  }
}

main().catch((err) => {
  logError(`错误: ${err.message}`);
  process.exit(1);
});
