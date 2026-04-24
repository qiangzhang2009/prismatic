#!/usr/bin/env bun
/**
 * Prismatic — V5 Batch Distillation Runner
 *
 * 蒸馏全部人物（41个）使用 V5 管道，然后替换 V4 部署到网络端。
 *
 * V5 核心改进：
 * - expressionDNA.vocabulary/sentenceStyle 中文提取（修复 V4 bug）
 * - 所有 *_Zh 字段强制必填 + 翻译回填
 * - 源语言跟随 + 中文完整性验证门
 * - distillationVersion: 'v5'
 *
 * 用法:
 *   bun run scripts/distill-v5-batch.mjs                    # 蒸馏全部
 *   bun run scripts/distill-v5-batch.mjs --list             # 仅列出人物
 *   bun run scripts/distill-v5-batch.mjs --persona confucius # 单个
 *   bun run scripts/distill-v5-batch.mjs --parallel 4        # 并行度
 *   bun run scripts/distill-v5-batch.mjs --dry-run          # 预览
 *   bun run scripts/distill-v5-batch.mjs --replace          # V5替换V4
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_ROOT = join(process.cwd(), 'corpus');
const V5_DIR = join(CORPUS_ROOT, 'distilled', 'v5');
const V4_DIR = join(CORPUS_ROOT, 'distilled', 'v4');

// ─── Color Output ─────────────────────────────────────────────────────────────

const C = {
  r: '\x1b[0m',
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

const ln = (c, t) => `${C[c] ?? ''}${t}${C.r}`;
const log = (...a) => console.log(...a);
const hdr = (t) => {
  log('');
  log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  log(ln('cyan', '  ') + ln('bright', t));
  log(ln('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  log('');
};
const sec = (t) => { log(''); log(ln('yellow', `▸ ${t}`)); };
const ok = (t) => log(ln('green', `  ✓ ${t}`));
const warn = (t) => log(ln('yellow', `  ⚠ ${t}`));
const err = (t) => log(ln('red', `  ✗ ${t}`));
const info = (t) => log(ln('blue', `  • ${t}`));
const dim = (t) => log(ln('dim', `    ${t}`));

// ─── Load display metadata from personas.ts ───────────────────────────────────

function loadPersonasMeta() {
  const content = readFileSync(join(process.cwd(), 'src/lib/personas.ts'), 'utf8');
  const result = {};
  const entryStartRegex = /PERSONAS\['([^']+)'\]\s*=\s*\{/g;
  let match;
  while ((match = entryStartRegex.exec(content)) !== null) {
    const slug = match[1];
    const searchStart = match.index + match[0].length;
    const nextEntry = content.indexOf('\nPERSONAS[', searchStart);
    const entryEnd = nextEntry === -1 ? content.length : nextEntry;
    const entryBlock = content.slice(searchStart, entryEnd);
    const extractField = (key) => {
      const re = new RegExp(`${key}:\\s*(?:\\[([^\\]]*)\\]|'([^']*)'|"([^"]*)")`);
      const m = entryBlock.match(re);
      if (!m) return null;
      if (m[1] !== undefined) return (m[1].match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, ''));
      return m[2] || m[3] || null;
    };
    result[slug] = {
      name: extractField('name') || slug,
      nameZh: extractField('nameZh') || slug,
      nameEn: extractField('nameEn') || extractField('name') || slug,
      tagline: extractField('tagline') || '',
      taglineZh: extractField('taglineZh') || '',
    };
  }
  return result;
}

const PERSONAS_META = loadPersonasMeta();

// ─── Step 1: Scan All Personas ─────────────────────────────────────────────

function scanPersonas() {
  const results = [];

  for (const dir of readdirSync(CORPUS_ROOT)) {
    const textsDir = join(CORPUS_ROOT, dir, 'texts');
    if (dir === 'distilled' || dir === 'corpus-manifest.json' || !existsSync(textsDir)) continue;

    const files = readdirSync(textsDir).filter(f => !f.startsWith('.'));
    const v4File = join(V4_DIR, `${dir}-v4.json`);
    const v5File = join(V5_DIR, `${dir}-v5.json`);

    let totalWords = 0;
    for (const file of files) {
      try {
        const content = readFileSync(join(textsDir, file), 'utf-8');
        totalWords += content.split(/\s+/).filter(Boolean).length;
      } catch {}
    }

    let v4Score = undefined;
    if (existsSync(v4File)) {
      try {
        const v4 = JSON.parse(readFileSync(v4File, 'utf-8'));
        v4Score = v4.score?.overall ?? (v4.persona?.expressionDNA ? 0 : undefined);
      } catch {}
    }

    results.push({
      personaId: dir,
      hasCorpus: files.length > 0,
      fileCount: files.length,
      totalWords,
      v4Exists: existsSync(v4File),
      v5Exists: existsSync(v5File),
      v4Score,
    });
  }

  return results.sort((a, b) => {
    if (a.hasCorpus !== b.hasCorpus) return a.hasCorpus ? -1 : 1;
    return b.totalWords - a.totalWords;
  });
}

// ─── Step 2: Run Single Distillation ─────────────────────────────────────────

async function distillSingle(personaId) {
  const corpusDir = join(CORPUS_ROOT, personaId, 'texts');
  const outputPath = join(V5_DIR, `${personaId}-v5.json`);

  const startTime = Date.now();

  try {
    const { distillPersonaV4, DEFAULT_CONFIG } = await import('../src/lib/distillation-v4');

    const result = await distillPersonaV4({
      personaId,
      corpusDir,
      config: {
        ...DEFAULT_CONFIG,
        outputLanguage: 'zh-CN',
        maxIterations: 3,
        adaptiveThreshold: true,
        strictMode: false,
      },
      onProgress: (stage, progress) => {
        process.stdout.write(`\r  [${stage}] ${progress}%  `);
      },
    });

    const durationMs = Date.now() - startTime;

    // Write output as V5 — stamp the meta with v5 version
    // Overwrite distilled display fields with authoritative data from personas.ts
    const meta = PERSONAS_META[personaId] || {};
    const v5Data = {
      ...result.persona,
      name: meta.name || result.persona.name,
      nameZh: meta.nameZh || result.persona.nameZh,
      nameEn: meta.nameEn || result.persona.nameEn,
      tagline: meta.tagline || result.persona.tagline,
      taglineZh: meta.taglineZh || result.persona.taglineZh,
      meta: {
        ...result.persona.meta,
        distillationVersion: 'v5',
        lastUpdated: new Date().toISOString(),
      },
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(v5Data, null, 2), 'utf-8');

    const score = result.persona.score?.overall ?? 0;
    const grade = result.persona.grade ?? 'F';
    const status = result.pipelineResult.status ?? 'failed';

    return {
      personaId,
      status: status,
      score,
      grade,
      durationMs,
      confidence: result.persona.meta?.confidence ?? 'unknown',
      route: result.persona.meta?.route ?? 'unknown',
      version: 'v5',
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      personaId,
      status: 'error',
      error: err?.message ?? String(err),
      durationMs,
    };
  }
}

// ─── Step 3: Batch Runner ────────────────────────────────────────────────────

async function runBatch(personaIds, parallel = 1) {
  const results = [];

  for (let i = 0; i < personaIds.length; i += parallel) {
    const batch = personaIds.slice(i, i + parallel);
    const batchNum = Math.floor(i / parallel) + 1;
    const totalBatches = Math.ceil(personaIds.length / parallel);

    log('');
    log(ln('bright', `━━━ Batch ${batchNum}/${totalBatches} ━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    for (const pid of batch) {
      log(ln('cyan', `  → ${pid}`));
    }
    log('');

    const batchResults = await Promise.all(
      batch.map(async (pid) => {
        process.stdout.write(`\r  Distilling ${pid}...`);
        const result = await distillSingle(pid);
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
        return result;
      })
    );

    results.push(...batchResults);

    for (const r of batchResults) {
      if (r.status === 'success' || r.status === 'degraded') {
        const icon = r.status === 'success' ? '✓' : '◐';
        const color = r.status === 'success' ? 'green' : 'yellow';
        log(
          `  ${ln(color, icon)} ${r.personaId.padEnd(25)} ` +
          `score=${String(r.score ?? 0).padStart(3)} ` +
          `grade=${(r.grade ?? 'F').padEnd(2)} ` +
          `route=${(r.route ?? '?').padEnd(6)} ` +
          `time=${((r.durationMs ?? 0) / 1000).toFixed(1)}s`
        );
      } else if (r.status === 'skipped') {
        warn(`  ○ ${r.personaId}: skipped (no corpus)`);
      } else {
        err(`  ✗ ${r.personaId}: ${r.error ?? r.status}`);
      }
    }

    log(ln('dim', `  Progress: ${Math.min(i + parallel, personaIds.length)}/${personaIds.length}`));
  }

  return results;
}

// ─── Step 4: Summary Report ──────────────────────────────────────────────────

function printSummary(results) {
  hdr('V5 蒸馏总结');

  const success = results.filter(r => r.status === 'success');
  const degraded = results.filter(r => r.status === 'degraded');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
  const skipped = results.filter(r => r.status === 'skipped');

  log(`  总计: ${results.length} 个人物`);
  log(`  ${ln('green', `成功: ${success.length}`)}  |  ${ln('yellow', `降级: ${degraded.length}`)}  |  ${ln('red', `失败: ${failed.length}`)}  |  跳过: ${skipped.length}`);
  log('');

  if (success.length > 0) {
    const avgScore = success.reduce((s, r) => s + (r.score ?? 0), 0) / success.length;
    const totalTime = success.reduce((s, r) => s + (r.durationMs ?? 0), 0);
    log(`  平均评分: ${avgScore.toFixed(1)}`);
    log(`  总耗时: ${(totalTime / 1000 / 60).toFixed(1)} min`);
  }

  if (failed.length > 0) {
    sec('失败的人物:');
    for (const r of failed) {
      log(`  • ${r.personaId}: ${r.error ?? r.status}`);
    }
  }

  if (degraded.length > 0) {
    sec('降级的人物:');
    for (const r of degraded) {
      log(`  • ${r.personaId}: score=${r.score} grade=${r.grade}`);
    }
  }

  const statePath = join(CORPUS_ROOT, 'distilled', 'batch-state-v5.json');
  const state = {
    timestamp: new Date().toISOString(),
    version: 'v5',
    total: results.length,
    success: success.length,
    degraded: degraded.length,
    failed: failed.length,
    skipped: skipped.length,
    results: results.map(r => ({
      personaId: r.personaId,
      status: r.status,
      score: r.score,
      grade: r.grade,
      error: r.error,
      durationMs: r.durationMs,
      confidence: r.confidence,
      route: r.route,
    })),
  };
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    info(`状态文件: ${statePath}`);
  } catch {}
}

// ─── Step 5: Replace V4 with V5 ─────────────────────────────────────────────

function replaceV4WithV5() {
  sec('替换 V4 文件为 V5...');

  let replaced = 0;
  let skipped = 0;

  for (const file of readdirSync(V5_DIR)) {
    if (!file.endsWith('-v5.json')) continue;

    const v5Path = join(V5_DIR, file);
    const v4Path = join(V4_DIR, file.replace('-v5.json', '-v4.json'));

    if (existsSync(v4Path)) {
      const backupPath = v4Path + '.v4bak';
      try {
        const v4Content = readFileSync(v4Path, 'utf-8');
        writeFileSync(backupPath, v4Content, 'utf-8');
      } catch {}
    }

    try {
      const v5Content = readFileSync(v5Path, 'utf-8');
      const v4Content = v5Content
        .replace(/"distillationVersion":\s*"v5"/g, '"distillationVersion": "v4"')
        .replace(/-v5\.json/g, '-v4.json');

      writeFileSync(v4Path, v4Content, 'utf-8');
      replaced++;
      ok(`${file.replace('-v5.json', '')}: V4 → V5`);
    } catch (e) {
      err(`${file}: ${e?.message}`);
      skipped++;
    }
  }

  log('');
  log(`  替换完成: ${replaced} 个文件`);
  if (skipped > 0) log(`  跳过: ${skipped} 个`);
}

// ─── CLI Parser ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = { command: 'batch' };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') result.command = 'list';
    else if (arg === '--dry-run') result.command = 'dry-run';
    else if (arg === '--replace') result.command = 'replace';
    else if (arg === '--parallel' || arg === '-p') result.parallel = parseInt(argv[++i]);
    else if (arg.startsWith('--persona=')) result.personaId = arg.replace('--persona=', '');
    else if (!arg.startsWith('--') && !arg.startsWith('-')) result.personaId = arg;
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  mkdirSync(V5_DIR, { recursive: true });

  if (args.command === 'list') {
    hdr('V5 蒸馏人物列表');
    const personas = scanPersonas();
    const withCorpus = personas.filter(p => p.hasCorpus);
    const withoutCorpus = personas.filter(p => !p.hasCorpus);

    log(ln('bright', `  ${'人物ID'.padEnd(25)} ${'字数'.padStart(10)} ${'V4评分'.padStart(8)} ${'V4'.padStart(5)} ${'V5'.padStart(5)}  ${'文件'}`));
    log(ln('dim', `  ${'─'.repeat(65)}`));

    for (const p of withCorpus) {
      const v4flag = p.v4Exists ? ln('green', 'V4') : ln('dim', '-');
      const v5flag = p.v5Exists ? ln('cyan', 'V5') : ln('dim', '-');
      const score = p.v4Score !== undefined ? String(p.v4Score).padStart(3) : '   -';
      log(
        `  ${ln('bright', p.personaId.padEnd(25))} ` +
        `${String(p.totalWords).padStart(10)} ` +
        `${score.padStart(8)} ` +
        `${v4flag.padStart(5)} ${v5flag.padStart(5)}  ` +
        `${p.fileCount} file(s)`
      );
    }

    log('');
    log(`  总计: ${withCorpus.length} 个有语料, ${withoutCorpus.length} 个无语料`);
    return;
  }

  if (args.command === 'replace') {
    hdr('V5 替换 V4');
    replaceV4WithV5();
    return;
  }

  if (args.command === 'dry-run') {
    hdr('Dry Run — V5 蒸馏预览');
    const personas = scanPersonas();
    const withCorpus = personas.filter(p => p.hasCorpus);

    log(`  将蒸馏 ${withCorpus.length} 个人物:`);
    for (const p of withCorpus) {
      const v5tag = p.v5Exists ? ln('yellow', ' (已存在，将覆盖)') : '';
      log(`  • ${p.personaId}${v5tag} — ${p.totalWords.toLocaleString()} words, ${p.fileCount} files`);
    }
    return;
  }

  if (args.command === 'single' && args.personaId) {
    hdr(`V5 蒸馏: ${args.personaId}`);
    const result = await distillSingle(args.personaId);

    if (result.status === 'success' || result.status === 'degraded') {
      ok(`${result.personaId}: score=${result.score} grade=${result.grade} route=${result.route}`);
    } else {
      err(`${result.personaId}: ${result.error ?? result.status}`);
    }
    return;
  }

  hdr('V5 批量蒸馏');

  const personas = scanPersonas();
  const withCorpus = personas.filter(p => p.hasCorpus);
  const parallel = args.parallel ?? 1;

  log(`  输出目录: ${V5_DIR}`);
  log(`  人物数量: ${withCorpus.length}`);
  log(`  并行度: ${parallel}`);
  log(`  模式: V5 (expressionDNA 中文提取 + 翻译回填)`);
  log('');

  const results = await runBatch(withCorpus.map(p => p.personaId), parallel);

  printSummary(results);

  sec('下一步操作:');
  log(`  1. 替换 V4:  bun run scripts/distill-v5-batch.mjs --replace`);
  log(`  2. 合并到代码: 参考 scripts/merge-v4-v2.ts 将 V5 JSON 合并到 personas.ts`);
  log(`  3. 部署到数据库: node scripts/deploy-v4-to-db.mjs`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
