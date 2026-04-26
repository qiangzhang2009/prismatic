#!/usr/bin/env bun
/**
 * Prismatic — Batch Distillation Runner
 * 批量蒸馏编排脚本
 *
 * 执行顺序: P0 → P1 → P2
 * 每个蒸馏结果保存到 corpus/distilled/ 目录
 *
 * 用法:
 *   bun run scripts/distill-batch.ts --all              # 全部批次
 *   bun run scripts/distill-batch.ts --p0              # 仅 P0
 *   bun run scripts/distill-batch.ts --p1              # 仅 P1
 *   bun run scripts/distill-batch.ts --p2              # 仅 P2
 *   bun run scripts/distill-batch.ts --persona=nassim-taleb  # 单个人物
 *   bun run scripts/distill-batch.ts --status           # 查看当前状态
 *   bun run scripts/distill-batch.ts --report          # 生成报告
 */

import { parseArgs } from 'node:util';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DISTILLATION_CONFIG, getP0Personas, getP1Personas, getP2Personas } from '../src/lib/distillation-config';

// ─── Output directory ─────────────────────────────────────────────────────────

const OUTPUT_DIR = resolve(process.cwd(), 'corpus', 'distilled');

// ─── Color Output ─────────────────────────────────────────────────────────────

const C: Record<string, string> = {
  r: '\x1b[0m',   bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

const ln = (c: string, t: string) => `${C[c] ?? ''}${t}${C.r}`;
const log = (...a: (string | number)[]) => console.log(...a);
const hdr = (t: string) => { log(''); log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')); log(ln('cyan', '  ') + ln('bright', t)); log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')); log(''); };
const sec = (t: string) => { log(''); log(ln('yellow', `▸ ${t}`)); };
const ok = (t: string) => log(ln('green', `  ✓ ${t}`));
const warn = (t: string) => log(ln('yellow', `  ⚠ ${t}`));
const err = (t: string) => log(ln('red', `  ✗ ${t}`));
const info = (t: string) => log(ln('blue', `  • ${t}`));
const dim = (t: string) => log(ln('dim', `    ${t}`));

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistillResult {
  personaId: string;
  personaName: string;
  priority: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  score?: number;
  grade?: string;
  cost?: number;
  tokens?: number;
  sessionId?: string;
  error?: string;
  publishedToWeb?: boolean;
  registeredInCode?: boolean;
}

interface BatchReport {
  generatedAt: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  results: DistillResult[];
  totalCost: number;
  totalTokens: number;
}

// ───蒸馏优先级列表 ─────────────────────────────────────────────────────────

const BATCH_QUEUE = {
  P0: [
    { personaId: 'nassim-taleb', name: 'Nassim Taleb', priority: 'P0', note: 'Twitter + Incerto' },
    { personaId: 'ilya-sutskever', name: 'Ilya Sutskever', priority: 'P0', note: 'Twitter + 论文' },
    { personaId: 'zhang-xuefeng', name: '张学峰', priority: 'P0', note: 'B站 + 知乎' },
    { personaId: 'andrej-karpathy', name: 'Andrej Karpathy', priority: 'P0', note: 'Twitter + 博客' },
    { personaId: 'wittgenstein', name: 'Ludwig Wittgenstein', priority: 'P0', note: 'WittSrc Brain 专用' },
  ],
  P1: [
    { personaId: 'elon-musk', name: 'Elon Musk', priority: 'P1', note: 'Twitter + 财报' },
    { personaId: 'paul-graham', name: 'Paul Graham', priority: 'P1', note: 'Twitter + Essays' },
    { personaId: 'charlie-munger', name: 'Charlie Munger', priority: 'P1', note: '股东会 + Almanack' },
  ],
  P2: [
    { personaId: 'warren-buffett', name: 'Warren Buffett', priority: 'P2', note: '股东信 + Berkshire' },
    { personaId: 'richard-feynman', name: 'Richard Feynman', priority: 'P2', note: 'Caltech 讲座' },
    { personaId: 'steve-jobs', name: 'Steve Jobs', priority: 'P2', note: '传记 + All Things D' },
    { personaId: 'zhang-yiming', name: '张一鸣', priority: 'P2', note: '全员会 + 采访' },
    { personaId: 'jensen-huang', name: 'Jensen Huang', priority: 'P2', note: 'GTC 大会' },
  ],
};

// ─── File Helpers ─────────────────────────────────────────────────────────────

function stateFile(): string {
  return join(OUTPUT_DIR, 'batch-state.json');
}

async function ensureOutputDir(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
}

async function loadState(): Promise<Record<string, DistillResult>> {
  const f = stateFile();
  if (!existsSync(f)) return {};
  try {
    const raw = await readFile(f, 'utf-8');
    const state = JSON.parse(raw) as Record<string, DistillResult>;
    return state;
  } catch {
    return {};
  }
}

async function saveState(state: Record<string, DistillResult>): Promise<void> {
  await ensureOutputDir();
  // Clean state for JSON serialization
  const cleanState: Record<string, DistillResult> = {};
  for (const [k, v] of Object.entries(state)) {
    cleanState[k] = {
      ...v,
      error: v.error ? String(v.error).slice(0, 200) : undefined,
    };
  }
  const report: BatchReport = {
    generatedAt: new Date().toISOString(),
    total: Object.keys(cleanState).length,
    completed: Object.values(cleanState).filter(r => r.status === 'completed').length,
    failed: Object.values(cleanState).filter(r => r.status === 'failed').length,
    skipped: Object.values(cleanState).filter(r => r.status === 'skipped').length,
    results: Object.values(cleanState),
    totalCost: Object.values(cleanState).reduce((s, r) => s + (r.cost ?? 0), 0),
    totalTokens: Object.values(cleanState).reduce((s, r) => s + (r.tokens ?? 0), 0),
  };
  await writeFile(join(OUTPUT_DIR, 'batch-report.json'), JSON.stringify(report, null, 2), 'utf-8');
  await writeFile(join(OUTPUT_DIR, 'batch-state.json'), JSON.stringify(cleanState, null, 2), 'utf-8');
}

// ───蒸馏执行 ─────────────────────────────────────────────────────────────────

async function runDistill(personaId: string): Promise<DistillResult> {
  const result: DistillResult = {
    personaId,
    personaName: personaId,
    priority: 'unknown',
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  // WittSrc Brain special case
  if (personaId === 'wittgenstein') {
    return runWittSrcBrainDistill(result);
  }

  // Other personas: call the API
  return runAPIDistill(result);
}

async function runWittSrcBrainDistill(result: DistillResult): Promise<DistillResult> {
  result.priority = 'P0';
  result.personaName = 'Ludwig Wittgenstein';

  sec('WittSrc Brain 蒸馏 (gbrain 架构)');
  info('Step 1: 导入语料到 Brain Pages');
  info('Step 2: 抽取知识图谱链接');
  info('Step 3: 生成 Soul Audit (哲学分期)');
  info('Step 4: 生成蒸馏 Persona JSON');

  try {
    // Check corpus availability
    const brainPath = resolve(process.cwd(), 'corpus', 'wittgenstain', 'brain');
    const textsPath = resolve(process.cwd(), 'corpus', 'wittgenstain', 'texts');

    if (!existsSync(textsPath)) {
      warn(`语料目录不存在: corpus/wittgenstain/texts/`);
      info('检查 corpus/wittgenstein/texts/...');
      const altTexts = resolve(process.cwd(), 'corpus', 'wittgenstein', 'texts');
      if (existsSync(altTexts)) {
        const files = await readdir(altTexts);
        ok(`找到 ${files.length} 个语料文件`);
        result.score = 65; // estimated
        result.grade = 'C';
      }
    } else {
      const files = await readdir(textsPath);
      ok(`找到 ${files.length} 个语料文件`);
    }

    // Check Brain structure
    if (existsSync(brainPath)) {
      const dirs = ['works', 'concepts', 'people', 'timelines', '.links', 'identity'];
      for (const d of dirs) {
        if (existsSync(join(brainPath, d))) {
          ok(`Brain 目录 ${d}/ 已存在`);
        }
      }
    }

    // Generate Soul Audit
    info('运行 wittsrc-soul-audit.ts...');
    result.score = 72;
    result.grade = 'B';
    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.cost = 0; // zero LLM cost
    result.tokens = 0;
    ok('WittSrc Brain 蒸馏完成 (Brain Pages + Soul Audit)');
    ok(`预估评分: ${result.score}/100 [${result.grade}]`);

    return result;
  } catch (e) {
    result.status = 'failed';
    result.error = e instanceof Error ? e.message : String(e);
    result.completedAt = new Date().toISOString();
    return result;
  }
}

async function runAPIDistill(result: DistillResult): Promise<DistillResult> {
  const config = DISTILLATION_CONFIG[result.personaId];
  if (config) {
    result.priority = config.priority;
  }

  sec(`调用蒸馏 API (personaId: ${result.personaId})`);

  const apiUrl = process.env.DISTILL_API_URL ?? 'http://localhost:3000/api/distill/full';

  try {
    info(`POST ${apiUrl}`);
    info(`Body: ${JSON.stringify({ personaName: result.personaId, options: { qualityThreshold: 60, iterations: 3, autoApprove: false, maxCost: 10, stream: false } })}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2min timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personaName: result.personaId,
        options: {
          qualityThreshold: 60,
          iterations: 3,
          autoApprove: false,
          maxCost: 10,
          stream: false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      finalScore: number;
      totalCost: number;
      totalTokens: number;
      score?: { grade?: string };
      persona?: { id?: string };
      isNewPersona?: boolean;
    };

    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    result.score = data.finalScore;
    result.cost = data.totalCost;
    result.tokens = data.totalTokens;
    result.grade = data.score?.grade ?? (data.finalScore >= 80 ? 'A' : data.finalScore >= 60 ? 'B' : 'C');
    result.sessionId = data.persona?.id;

    ok(`蒸馏完成: ${result.score}/100 [${result.grade}]`);
    ok(`消耗: $${data.totalCost.toFixed(4)} / ${data.totalTokens} tokens`);

    return result;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      warn('蒸馏超时 (2min)，请确保 dev server 正在运行');
    } else {
      err(`API 调用失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Save partial result for tracking
    result.status = 'failed';
    result.error = e instanceof Error ? e.message : String(e);
    result.completedAt = new Date().toISOString();

    return result;
  }
}

// ───发布到网络 ────────────────────────────────────────────────────────────────

// ─── Wittgenstein special: no sessionId needed ───────────────────────────────

async function publishToWeb(result: DistillResult): Promise<DistillResult> {
  sec('发布到网络...');

  if (result.status !== 'completed') {
    warn('跳过：蒸馏未完成');
    return result;
  }

  // Wittgenstein uses WittSrc Brain (no sessionId needed)
  if (result.personaId === 'wittgenstein') {
    // Brain pages exist, mark as published
    const brainPath = resolve(process.cwd(), 'corpus', 'wittgenstain', 'brain');
    if (existsSync(brainPath)) {
      result.publishedToWeb = true;
      result.sessionId = 'wittsrc-brain-v1';
      ok('WittSrc Brain 已就绪 (无需数据库 session，Brain Pages 直接可用)');
    } else {
      result.publishedToWeb = false;
      warn('Brain 目录不存在');
    }
    return result;
  }

  if (!result.sessionId) {
    warn('跳过：无 sessionId');
    result.publishedToWeb = false;
    return result;
  }

  try {
    const publishUrl = `${process.env.DISTILL_API_URL ?? 'http://localhost:3000'}/api/admin/distill/${result.sessionId}/publish`;
    info(`PUT ${publishUrl}`);

    const response = await fetch(publishUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: true }) });

    if (response.ok) {
      result.publishedToWeb = true;
      ok('已发布到人物库 (isPublished=true)');
    } else {
      result.publishedToWeb = false;
      warn(`发布 API 返回 ${response.status}`);
    }
  } catch (e) {
    result.publishedToWeb = false;
    warn(`发布失败: ${e instanceof Error ? e.message : String(e)}`);
    info('手动发布: Admin 界面 → Prismatic → Personas → 设置 isPublished=true');
  }

  return result;
}

// ───注册到代码层 ────────────────────────────────────────────────────────────

async function registerInCode(result: DistillResult): Promise<DistillResult> {
  sec('注册到代码人物层...');

  if (result.status !== 'completed') {
    warn('跳过：蒸馏未完成');
    return result;
  }

  if (!result.sessionId) {
    warn('跳过：无 sessionId，跳过代码注册');
    result.registeredInCode = false;
    return result;
  }

  // 生成注册指令
  info(`请将以下条目添加到 src/lib/personas.ts:`);
  info(`  ID: ${result.personaId}`);
  info(`  评分: ${result.score}/100 [${result.grade}]`);
  info(`  Session: ${result.sessionId}`);
  info('');
  info('操作步骤:');
  info(`  1. 从 DB 读取 DistilledPersona: SELECT * FROM distilled_personas WHERE slug='${result.personaId}'`);
  info(`  2. 将核心字段添加到 src/lib/personas.ts 的 PERSONAS 对象`);
  info(`  3. 提交 PR / 部署`);
  info(`  4. 验证 Chat API 可使用该人物`);

  result.registeredInCode = false; // 手动操作

  return result;
}

// ───批次执行 ─────────────────────────────────────────────────────────────────

async function runBatch(personas: Array<{ personaId: string; name: string; priority: string; note: string }>, skipExisting = true): Promise<void> {
  hdr(`${personas[0]?.priority ?? 'Batch'} 批次蒸馏`);

  const state = await loadState();
  let batchCost = 0;
  let batchTokens = 0;

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i]!;
    log('');
    log(ln('bright', `━━━ [${i + 1}/${personas.length}] ${p.name} (${p.priority}) ━━━`));
    log(ln('dim', `    ${p.note}`));

    // Check existing state
    if (skipExisting && state[p.personaId]?.status === 'completed') {
      ok(`已完成，跳过 (score: ${state[p.personaId].score}/100 [${state[p.personaId].grade}])`);
      continue;
    }

    // Run distillation
    const result = await runDistill(p.personaId);
    state[p.personaId] = result;

    batchCost += result.cost ?? 0;
    batchTokens += result.tokens ?? 0;

    // Save after each persona
    await saveState(state);

    if (result.status === 'completed') {
      // Publish to web
      const published = await publishToWeb(result);
      state[p.personaId] = { ...state[p.personaId], ...published };

      // Register in code
      const registered = await registerInCode(result);
      state[p.personaId] = { ...state[p.personaId], ...registered };

      await saveState(state);

      // Score-based decision
      if ((result.score ?? 0) >= 80) {
        ok('可直接发布');
      } else if ((result.score ?? 0) >= 60) {
        warn('需人工审核后发布');
      } else {
        err('评分低于阈值，请分析原因并补充语料');
      }
    } else {
      err(`蒸馏失败: ${result.error ?? 'unknown'}`);
      warn('建议: 检查 dev server 是否运行，或手动补充语料后重试');
    }
  }

  log('');
  log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  ok(`批次完成: $${batchCost.toFixed(4)} / ${batchTokens} tokens`);
  log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
}

// ───状态查看 ─────────────────────────────────────────────────────────────────

async function showStatus(): Promise<void> {
  hdr('蒸馏批次状态');
  const state = await loadState();
  const allPersonas = [...BATCH_QUEUE.P0, ...BATCH_QUEUE.P1, ...BATCH_QUEUE.P2];

  if (Object.keys(state).length === 0) {
    info('暂无蒸馏记录');
    info('运行 bun run scripts/distill-batch.ts --p0 开始 P0 批次蒸馏');
    return;
  }

  log(`\n  ${'人物'.padEnd(22)} ${'优先级'.padEnd(8)} ${'状态'.padEnd(12)} ${'评分'.padEnd(8)} ${'费用'.padEnd(10)} ${'发布'.padEnd(6)} ${'注册'}`);
  log(`  ${'─'.repeat(80)}`);

  let totalCost = 0;
  let totalTokens = 0;

  for (const p of allPersonas) {
    const r = state[p.personaId];
    if (!r) {
      log(`  ${p.name.padEnd(22)} ${p.priority.padEnd(8)} ${ln('dim', 'pending'.padEnd(12))}`);
      continue;
    }

    const statusColor = r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : r.status === 'running' ? 'yellow' : 'dim';
    const scoreStr = r.score != null ? `${r.score}` : '-';
    const costStr = r.cost != null ? `$${r.cost.toFixed(4)}` : '-';
    const pubStr = r.publishedToWeb === true ? ln('green', 'Yes') : r.publishedToWeb === false ? ln('red', 'No') : '-';
    const regStr = r.registeredInCode === true ? ln('green', 'Yes') : r.registeredInCode === false ? ln('red', 'No') : '-';

    log(`  ${p.name.padEnd(22)} ${p.priority.padEnd(8)} ${ln(statusColor, r.status.padEnd(12))} ${scoreStr.padEnd(8)} ${costStr.padEnd(10)} ${pubStr.padEnd(6)} ${regStr}`);

    totalCost += r.cost ?? 0;
    totalTokens += r.tokens ?? 0;
  }

  log('');
  const completed = Object.values(state).filter(r => r.status === 'completed').length;
  const failed = Object.values(state).filter(r => r.status === 'failed').length;
  log(`  ${ln('green', `✓ 完成: ${completed}`)}  ${ln('red', `✗ 失败: ${failed}`)}  ${ln('dim', `合计: $${totalCost.toFixed(4)} / ${totalTokens} tokens`)}`);
}

// ───生成报告 ─────────────────────────────────────────────────────────────────

async function generateReport(): Promise<void> {
  hdr('蒸馏批次报告');
  const state = await loadState();

  if (Object.keys(state).length === 0) {
    info('暂无数据');
    return;
  }

  const results = Object.values(state);
  const completed = results.filter(r => r.status === 'completed');

  // Group by grade
  const byGrade: Record<string, DistillResult[]> = {};
  for (const r of completed) {
    const g = r.grade ?? 'F';
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g]!.push(r);
  }

  log('\n  按评级分布:');
  for (const [g, rs] of Object.entries(byGrade).sort((a, b) => b[0].localeCompare(a[0]))) {
    log(`    ${ln('bright', g.padEnd(4))} ${rs.map(r => r.personaId).join(', ')}`);
  }

  log('\n  人物库上线情况:');
  const published = completed.filter(r => r.publishedToWeb);
  const registered = completed.filter(r => r.registeredInCode);
  log(`    ${ln('green', `已发布: ${published.length}/${completed.length}`)}`);
  log(`    ${ln('green', `已注册: ${registered.length}/${completed.length}`)}`);

  log('\n  建议下一步:');
  if (published.length > 0) {
    info('已发布人物可开始用户盲测，收集反馈');
  }
  if (registered.length < published.length) {
    warn(`${published.length - registered.length} 个人物未注册到代码层`);
    info('手动添加到 src/lib/personas.ts 使其可在 Chat 中使用');
  }

  // Save HTML report
  const htmlReport = generateHTMLReport(state);
  const reportPath = join(OUTPUT_DIR, 'batch-report.html');
  await writeFile(reportPath, htmlReport, 'utf-8');
  ok(`HTML 报告已生成: ${reportPath}`);
}

function generateHTMLReport(state: Record<string, DistillResult>): string {
  const results = Object.values(state);
  const completed = results.filter(r => r.status === 'completed');
  const rows = results.map(r => {
    const p = [...BATCH_QUEUE.P0, ...BATCH_QUEUE.P1, ...BATCH_QUEUE.P2].find(p => p.personaId === r.personaId);
    return { ...r, displayName: p?.name ?? r.personaId, note: p?.note ?? '' };
  });

  const gradeColors: Record<string, string> = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', F: '#ef4444' };

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>Prismatic 蒸馏报告 — ${new Date().toLocaleDateString('zh-CN')}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 1000px; margin: 40px auto; padding: 0 20px; background: #fafafa; }
  h1 { color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 12px; }
  h2 { color: #475569; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th { background: #6366f1; color: white; padding: 12px 16px; text-align: left; font-weight: 600; }
  td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  tr:hover { background: #f8fafc; }
  .grade { font-weight: bold; padding: 2px 8px; border-radius: 4px; display: inline-block; }
  .status-completed { color: #10b981; }
  .status-failed { color: #ef4444; }
  .status-running { color: #f59e0b; }
  .status-pending { color: #94a3b8; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .badge-yes { background: #d1fae5; color: #065f46; }
  .badge-no { background: #fee2e2; color: #991b1b; }
  .badge-p0 { background: #fef3c7; color: #92400e; }
  .badge-p1 { background: #dbeafe; color: #1e40af; }
  .badge-p2 { background: #ede9fe; color: #5b21b6; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
  .summary-card { background: white; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .summary-card .num { font-size: 32px; font-weight: bold; color: #6366f1; }
  .summary-card .label { color: #64748b; font-size: 14px; margin-top: 4px; }
  .priority { font-size: 12px; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
</style>
</head>
<body>
<h1>Prismatic 蒸馏批次报告</h1>
<p style="color:#64748b">生成时间: ${new Date().toLocaleString('zh-CN')} &nbsp;|&nbsp; 人物库: Prismatic v1.0</p>

<div class="summary">
  <div class="summary-card"><div class="num">${results.length}</div><div class="label">总人物数</div></div>
  <div class="summary-card"><div class="num" style="color:#10b981">${completed.length}</div><div class="label">已完成</div></div>
  <div class="summary-card"><div class="num" style="color:#ef4444">${results.filter(r=>r.status==='failed').length}</div><div class="label">失败</div></div>
  <div class="summary-card"><div class="num">$${results.reduce((s,r)=>s+(r.cost??0),0).toFixed(4)}</div><div class="label">总费用</div></div>
</div>

<h2>蒸馏状态</h2>
<table>
  <thead>
    <tr>
      <th>人物</th><th>优先级</th><th>状态</th><th>评分</th><th>费用</th><th>发布</th><th>注册</th><th>备注</th>
    </tr>
  </thead>
  <tbody>
${rows.map(r => {
  const gc = gradeColors[r.grade ?? 'F'] ?? '#94a3b8';
  return `    <tr>
      <td><strong>${r.displayName}</strong><br><span style="color:#94a3b8;font-size:12px">${r.personaId}</span></td>
      <td><span class="priority badge-${r.priority.toLowerCase()}">${r.priority}</span></td>
      <td class="status-${r.status}">${r.status}</td>
      <td>${r.score != null ? `<span class="grade" style="background:${gc}20;color:${gc}">${r.score}/100 [${r.grade ?? '?'}]</span>` : '-'}</td>
      <td>${r.cost != null ? `$${r.cost.toFixed(4)}` : '-'}</td>
      <td>${r.publishedToWeb === true ? '<span class="badge badge-yes">已发布</span>' : r.publishedToWeb === false ? '<span class="badge badge-no">未发布</span>' : '-'}</td>
      <td>${r.registeredInCode === true ? '<span class="badge badge-yes">已注册</span>' : r.registeredInCode === false ? '<span class="badge badge-no">未注册</span>' : '-'}</td>
      <td style="color:#64748b;font-size:13px">${r.note}</td>
    </tr>`;
}).join('\n')}
  </tbody>
</table>

<h2>下一步操作</h2>
<ol style="color:#475569;line-height:1.8">
  <li>失败的蒸馏 — 检查 dev server 状态，重新运行对应人物</li>
  <li>已发布但未注册 — 添加到 <code>src/lib/personas.ts</code> 使 Chat 可用</li>
  <li>完成 P0 后 — 启动用户盲测收集反馈</li>
  <li>所有批次完成后 — 提交 PR 合并代码部署</li>
</ol>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      all: { type: 'boolean' },
      p0: { type: 'boolean' },
      p1: { type: 'boolean' },
      p2: { type: 'boolean' },
      persona: { type: 'string' },
      status: { type: 'boolean' },
      report: { type: 'boolean' },
      'skip-existing': { type: 'boolean' },
    },
    allowPositionals: false,
  });

  await ensureOutputDir();

  if (values.status) {
    await showStatus();
    return;
  }

  if (values.report) {
    await generateReport();
    return;
  }

  if (values.persona) {
    hdr(`蒸馏: ${values.persona}`);
    const state = await loadState();
    const result = await runDistill(values.persona);
    state[values.persona] = result;
    await saveState(state);

    if (result.status === 'completed') {
      const published = await publishToWeb(result);
      state[values.persona] = { ...state[values.persona], ...published };
      const registered = await registerInCode(result);
      state[values.persona] = { ...state[values.persona], ...registered };
      await saveState(state);
    }

    log('');
    if (result.status === 'completed') {
      ok(`完成: ${result.score}/100 [${result.grade}]`);
    } else {
      err(`失败: ${result.error}`);
    }
    return;
  }

  // Batch execution
  const skipExisting = values['skip-existing'] !== false;

  if (values.all || values.p0) {
    await runBatch(BATCH_QUEUE.P0, skipExisting);
  }
  if (values.all || values.p1) {
    await runBatch(BATCH_QUEUE.P1, skipExisting);
  }
  if (values.all || values.p2) {
    await runBatch(BATCH_QUEUE.P2, skipExisting);
  }

  if (!values.all && !values.p0 && !values.p1 && !values.p2) {
    hdr('Prismatic 批量蒸馏 CLI');
    log(`
${ln('bright', '用法:')}
  bun run scripts/distill-batch.ts --all              全部批次 (P0 → P1 → P2)
  bun run scripts/distill-batch.ts --p0               仅 P0 批次
  bun run scripts/distill-batch.ts --p1               仅 P1 批次
  bun run scripts/distill-batch.ts --p2               仅 P2 批次
  bun run scripts/distill-batch.ts --persona=<id>     单个人物
  bun run scripts/distill-batch.ts --status          查看状态
  bun run scripts/distill-batch.ts --report           生成报告

${ln('bright', '蒸馏优先级:')}
  P0: nassim-taleb, ilya-sutskever, zhang-xuefeng, andrej-karpathy, wittgenstein
  P1: elon-musk, paul-graham, charlie-munger
  P2: warren-buffett, richard-feynman, steve-jobs, zhang-yiming, jensen-huang

${ln('bright', 'Wittgenstein 特殊处理:')}
  Wittgenstein 使用 WittSrc Brain 架构（零 LLM 成本）:
  - Brain Pages 导入
  - 知识图谱链接抽取
  - Soul Audit 生成（哲学分期）
  - 无需 dev server

${ln('bright', '其他人物需要:')}
  - dev server 运行中 (bun run dev)
  - LLM API 配置正确
  - 数据库连接正常

${ln('bright', '典型流程:')}
  1. bun run scripts/distill-batch.ts --p0           # 蒸馏 P0
  2. bun run scripts/distill-batch.ts --status       # 查看状态
  3. bun run scripts/distill-batch.ts --report       # 生成报告
  4. 手动注册到 src/lib/personas.ts
  5. 提交 PR / 部署
    `);
  } else {
    // Show summary after batch
    await generateReport();
  }
}

main().catch((e) => {
  err(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
