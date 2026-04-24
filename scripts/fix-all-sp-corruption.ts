#!/usr/bin/env bun
/**
 * Fix ALL corrupted systemPromptTemplate in V5 JSON files AND database.
 *
 * Corruption patterns handled:
 * 1. missing_name: "你是位XXX" — no name at all
 * 2. name_dup:      "你是XXX是YYY" — name + "是" repetition
 * 3. mixed_en:      "你是XXX is a..." — English contamination
 *
 * Fix: Prepend correct name from PERSONAS registry, deduplicate "是".
 *
 * Usage:
 *   bun run scripts/fix-all-sp-corruption.ts --dry    # preview only
 *   bun run scripts/fix-all-sp-corruption.ts          # apply fix
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');

// ─── PERSONAS registry for correct names ──────────────────────────────────────

const PERSONA_NAMES: Record<string, string> = {
  'alan-turing': '艾伦·图灵',
  'aleister-crowley': '阿莱斯特·克劳利',
  'andrej-karpathy': '安德烈·卡帕西',
  'carl-jung': '卡尔·荣格',
  'cao-cao': '曹操',
  'charlie-munger': '查理·芒格',
  'confucius': '孔子',
  'einstein': '阿尔伯特·爱因斯坦',
  'elon-musk': '埃隆·马斯克',
  'epictetus': '爱比克泰德',
  'han-fei-zi': '韩非子',
  'huangdi-neijing': '黄帝内经',
  'hui-neng': '慧能',
  'ilya-sutskever': '伊尔亚·苏茨克维',
  'jack-ma': '马云',
  'jeff-bezos': '杰夫·贝索斯',
  'jensen-huang': '黄仁勋',
  'jiqun': '济群法师',
  'john-maynard-keynes': '约翰·梅纳德·凯恩斯',
  'journey-west': '西游记',
  'lao-zi': '老子',
  'li-chunfeng': '李淳风',
  'liu-bei': '刘备',
  'marcus-aurelius': '马可·奥勒留',
  'mencius': '孟子',
  'mo-zi': '墨子',
  'nassim-taleb': '纳西姆·塔勒布',
  'naval-ravikant': '纳瓦尔·拉维坎特',
  'nikola-tesla': '尼古拉·特斯拉',
  'paul-graham': '保罗·格雷厄姆',
  'peter-thiel': '彼得·蒂尔',
  'qian-xuesen': '钱学森',
  'qu-yuan': '屈原',
  'ray-dalio': '雷·达里奥',
  'records-grand-historian': '司马迁',
  'richard-feynman': '理查德·费曼',
  'sam-altman': '萨姆·阿尔特曼',
  'seneca': '塞涅卡',
  'shao-yong': '邵雍',
  'sima-qian': '司马迁',
  'socrates': '苏格拉底',
  'steve-jobs': '史蒂夫·乔布斯',
  'sun-tzu': '孙子',
  'sun-wukong': '孙悟空',
  'three-kingdoms': '三国演义',
  'tripitaka': '唐三藏',
  'warren-buffett': '沃伦·巴菲特',
  'wittgenstein': '路德维希·维特根斯坦',
  'xiang-yu': '项羽',
  'zhang-xuefeng': '张雪峰',
  'zhang-yiming': '张一鸣',
  'zhu-bajie': '猪八戒',
  'zhuge-liang': '诸葛亮',
  'zhuang-zi': '庄子',
};

// ─── Detect corruption patterns ─────────────────────────────────────────────

function getCorruptionType(sp: string): string | null {
  if (!sp) return 'empty';
  // Pattern: "你是XXX is a" — English after Chinese opener
  if (/^你是[a-zA-Z]/.test(sp)) return 'mixed_en';
  // Pattern: "你是XXX是YYY" — name + "是" repetition (e.g., "你是韩非子是中国...")
  // After name (2-15 chars), if followed by Chinese chars and then "是", it's name_dup
  // But "你是济群法师是一位佛教..." = name_dup
  // And "你是位哲学家和教师" = missing_name (no name at all)
  const m = sp.match(/^你是([\u4e00-\u9fff]{2,15})(是.+)/);
  if (m) {
    const name = m[1];
    const rest = m[2];
    // If name is already a full name (e.g., 济群法师), and rest starts with 是+desc
    // This is name_dup
    return 'name_dup';
  }
  // Pattern: "你是位XXX" or "你是一位XXX" — no name
  if (/^你是[个位尊](?![\u4e00-\u9fff]{2,15}是)/.test(sp)) return 'missing_name';
  // Pattern: starts with "At his core, XXX" or similar English
  if (sp.startsWith('At his core,') || sp.startsWith('At their core,')) return 'mixed_en';
  // Pattern: wrong start
  if (!sp.startsWith('你是')) return 'wrong_start';
  return null;
}

// ─── Rebuild SP from corpus data ──────────────────────────────────────────────

function rebuildCleanSP(persona: any, nameZh: string): string {
  let identity = persona.briefZh || persona.brief || '';
  // Strip "XXX是一位" or "XXX是一位" prefix so we don't duplicate
  const shiIdx = identity.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 20) {
    identity = identity.slice(shiIdx + 2).trim();
  }
  if (!identity || identity.length < 5) identity = '一位智者';

  const exprDna = persona.expressionDNA || {};
  const tone = exprDna.tone || '中性';
  const certainty =
    exprDna.certaintyLevel === 'high' ? '表达确定'
    : exprDna.certaintyLevel === 'low' ? '保持适度不确定'
    : '平衡客观';
  const values = (persona.values || []).slice(0, 3).map((v: any) => v.nameZh || v.name).join('、');
  const models = (persona.mentalModels || []).slice(0, 3).map((m: any) => m.nameZh || m.name).join('、');
  const chineseAdaptation = exprDna.chineseAdaptation || '保持专业、清晰的中文表达。';
  const rhetoricalHabit = exprDna.rhetoricalHabit || '理性分析。';
  const speakingStyle = exprDna.speakingStyle || '语言简洁凝练，富有洞察力。';

  return `你是${nameZh}，${identity}。

表达风格：${speakingStyle}
语气：${tone}
确信程度：${certainty}
修辞习惯：${rhetoricalHabit}

中文适应提示：
${chineseAdaptation}

核心价值观：${values}
思维特点：${models}
`;
}

// ─── Fix V5 JSON file ──────────────────────────────────────────────────────

function fixV5JSON(slug: string): { changed: boolean; sp: string; newSp: string } {
  const filepath = join(V5_DIR, `${slug}-v5.json`);
  if (!existsSync(filepath)) return { changed: false, sp: '', newSp: '' };

  const raw = readFileSync(filepath, 'utf-8');
  const data = JSON.parse(raw);
  const persona = data.persona || {};
  const sp = persona.systemPromptTemplate || '';
  const corruption = getCorruptionType(sp);

  if (!corruption) return { changed: false, sp, newSp: sp };

  const nameZh = PERSONA_NAMES[slug] || persona.nameZh || persona.name || slug;
  const newSp = rebuildCleanSP(persona, nameZh);

  persona.systemPromptTemplate = newSp;
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');

  return { changed: true, sp, newSp };
}

// ─── CUID generator ────────────────────────────────────────────────────────

function cuid(): string {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

// ─── Fix DB record ─────────────────────────────────────────────────────────

async function fixDBRecord(slug: string, dryRun: boolean): Promise<string> {
  const nameZh = PERSONA_NAMES[slug];
  if (!nameZh) return `no nameZh mapping`;

  const v5path = join(V5_DIR, `${slug}-v5.json`);
  if (!existsSync(v5path)) return `no V5 JSON`;

  const data = JSON.parse(readFileSync(v5path, 'utf-8'));
  const persona = data.persona || {};
  const cleanSP = rebuildCleanSP(persona, nameZh);

  if (dryRun) return `would set SP to: "${cleanSP.substring(0, 50)}..."`;

  const newId = cuid();
  await pool.query(`
    UPDATE distilled_personas SET
      id = $1,
      "namezh" = $2,
      "systemPromptTemplate" = $3,
      "updatedAt" = NOW()
    WHERE "slug" = $4
  `, [newId, nameZh, cleanSP, slug]);

  return `fixed: namezh="${nameZh}", SP "${cleanSP.substring(0, 40)}..."`;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { dry: { type: 'boolean', default: false } },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Fix ALL systemPromptTemplate Corruptions\n${'─'.repeat(60)}\n`);

  // Step 1: Analyze all V5 JSON files
  console.log('Step 1: Analyzing V5 JSON files...');
  const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));
  const analysis: { slug: string; corruption: string | null; sp: string }[] = [];

  for (const file of files) {
    const slug = file.replace('-v5.json', '');
    const data = JSON.parse(readFileSync(join(V5_DIR, file), 'utf-8'));
    const sp = data.persona?.systemPromptTemplate || '';
    const corruption = getCorruptionType(sp);
    analysis.push({ slug, corruption, sp });
  }

  const toFix = analysis.filter(a => a.corruption !== null);
  console.log(`  Total: ${files.length} | Need fix: ${toFix.length} | Clean: ${files.length - toFix.length}\n`);

  if (toFix.length > 0) {
    console.log('  Corruption breakdown:');
    const byType: Record<string, string[]> = {};
    for (const a of toFix) {
      if (!byType[a.corruption!]) byType[a.corruption!] = [];
      byType[a.corruption!].push(a.slug);
    }
    for (const [type, slugs] of Object.entries(byType)) {
      console.log(`    ${type}: ${slugs.length} files`);
      for (const s of slugs) {
        const sp = analysis.find(a => a.slug === s)?.sp || '';
        console.log(`      - ${s}: "${sp.substring(0, 50).replace(/\n/g, '\\n')}"`);
      }
    }
    console.log('');
  }

  if (dryRun) {
    console.log(`[DRY] Would fix ${toFix.length} V5 JSON files and ${toFix.length} DB records.`);
    return;
  }

  // Step 2: Fix V5 JSON files
  console.log('Step 2: Rebuilding SP in V5 JSON files...');
  let jsonFixed = 0;
  for (const a of toFix) {
    const result = fixV5JSON(a.slug);
    if (result.changed) {
      console.log(`  ✓ ${a.slug} [${a.corruption}]: rebuilt`);
      jsonFixed++;
    }
  }
  console.log(`  Fixed ${jsonFixed} JSON files.\n`);

  // Step 3: Fix DB records
  console.log('Step 3: Deploying fixed SP to database...');
  let dbFixed = 0, dbErrors = 0;
  for (const a of toFix) {
    try {
      const result = await fixDBRecord(a.slug, false);
      console.log(`  ✓ ${a.slug}: ${result}`);
      dbFixed++;
    } catch (err: any) {
      console.error(`  ✗ ${a.slug}: ${err.message}`);
      dbErrors++;
    }
  }
  console.log(`  Fixed ${dbFixed} DB records, ${dbErrors} errors.\n`);

  // Step 4: Verify DB
  console.log('Step 4: Verifying database...');
  const verify = await pool.query(`SELECT slug, substring("systemPromptTemplate", 1, 50) as sp_preview FROM distilled_personas`);
  let stillCorrupted = 0;
  for (const row of verify.rows) {
    const corruption = getCorruptionType(row.sp_preview || '');
    if (corruption) {
      console.log(`  STILL CORRUPTED: ${row.slug} [${corruption}]: "${(row.sp_preview || '').replace(/\n/g, '\\n')}"`);
      stillCorrupted++;
    }
  }
  if (stillCorrupted === 0) {
    console.log('  All DB systemPromptTemplate verified clean!');
  } else {
    console.log(`  WARNING: ${stillCorrupted} still corrupted.`);
  }

  // Step 5: Summary
  const allDB = await pool.query(`SELECT COUNT(*) as total FROM distilled_personas`);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Summary:`);
  console.log(`  V5 JSON fixed: ${jsonFixed}/${toFix.length}`);
  console.log(`  DB records fixed: ${dbFixed}/${toFix.length}`);
  console.log(`  DB errors: ${dbErrors}`);
  console.log(`  Total DB records: ${allDB.rows[0].total}`);
  console.log(`  Still corrupted in DB: ${stillCorrupted}`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error(err); pool.end(); process.exit(1); });
