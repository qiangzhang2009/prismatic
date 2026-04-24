#!/usr/bin/env bun
/**
 * Fix remaining corrupted SP in V5 JSON files and DB.
 * These are cases where SP starts with "你是XXX" but then has
 * a redundant "是" (e.g., "你是萨姆·奥尔特曼是一位" or "你是在其核心，...")
 *
 * Usage:
 *   bun run scripts/fix-remaining-sp.ts --dry    # preview only
 *   bun run scripts/fix-remaining-sp.ts          # apply fix
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');

const PERSONA_NAMES: Record<string, string> = {
  'alan-turing': '艾伦·图灵', 'aleister-crowley': '阿莱斯特·克劳利',
  'andrej-karpathy': '安德烈·卡帕西', 'carl-jung': '卡尔·荣格',
  'cao-cao': '曹操', 'charlie-munger': '查理·芒格',
  'confucius': '孔子', 'einstein': '阿尔伯特·爱因斯坦',
  'elon-musk': '埃隆·马斯克', 'epictetus': '爱比克泰德',
  'han-fei-zi': '韩非子', 'huangdi-neijing': '黄帝内经',
  'hui-neng': '慧能', 'ilya-sutskever': '伊尔亚·苏茨克维',
  'jack-ma': '马云', 'jeff-bezos': '杰夫·贝索斯',
  'jensen-huang': '黄仁勋', 'jiqun': '济群法师',
  'john-maynard-keynes': '约翰·梅纳德·凯恩斯',
  'journey-west': '西游记', 'lao-zi': '老子',
  'li-chunfeng': '李淳风', 'liu-bei': '刘备',
  'marcus-aurelius': '马可·奥勒留', 'mencius': '孟子',
  'mo-zi': '墨子', 'nassim-taleb': '纳西姆·塔勒布',
  'naval-ravikant': '纳瓦尔·拉维坎特', 'nikola-tesla': '尼古拉·特斯拉',
  'paul-graham': '保罗·格雷厄姆', 'peter-thiel': '彼得·蒂尔',
  'qian-xuesen': '钱学森', 'qu-yuan': '屈原',
  'ray-dalio': '雷·达里奥', 'records-grand-historian': '司马迁',
  'richard-feynman': '理查德·费曼', 'sam-altman': '萨姆·阿尔特曼',
  'seneca': '塞涅卡', 'shao-yong': '邵雍', 'sima-qian': '司马迁',
  'socrates': '苏格拉底', 'steve-jobs': '史蒂夫·乔布斯',
  'sun-tzu': '孙子', 'sun-wukong': '孙悟空',
  'three-kingdoms': '三国演义', 'tripitaka': '唐三藏',
  'warren-buffett': '沃伦·巴菲特', 'wittgenstein': '路德维希·维特根斯坦',
  'xiang-yu': '项羽', 'zhang-xuefeng': '张雪峰',
  'zhang-yiming': '张一鸣', 'zhu-bajie': '猪八戒',
  'zhuge-liang': '诸葛亮', 'zhuang-zi': '庄子',
};

function cuid(): string {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

function getCorruptionType(sp: string): string | null {
  if (!sp) return 'empty';
  // Pattern 1: "你是XXX是一位" — name followed by "是一位" (redundant "是")
  if (/^你是[\u4e00-\u9fff]{2,20}是一位/.test(sp)) return 'name_is_a';
  // Pattern 2: "你是在其核心，..." or similar English opener after 你
  if (/^你是在[A-Z]/.test(sp)) return 'wrong_en_opener';
  // Pattern 3: "你是XXX is a..." — mixed English
  if (/^你是[a-zA-Z]/.test(sp)) return 'mixed_en';
  // Pattern 4: starts with "你是[个位尊]" without Chinese name — missing name
  if (/^你是[个位尊](?![\u4e00-\u9fff]{2,15}是)/.test(sp)) return 'missing_name';
  // Pattern 5: "你是XXX是YYY" — name + "是" + more description (redundant)
  // Match: "你是" + 2-15 chars (could be Chinese or Pinyin) + "是" + Chinese chars
  const dupMatch = sp.match(/^你是([\u4e00-\u9fff·a-zA-Z]{2,20})(是.+)/);
  if (dupMatch) {
    const rest = dupMatch[2];
    // If rest starts with "是一位", "的核心...", or just "是一位..."
    if (/^是一|^的核心/.test(rest)) return 'name_is_a';
  }
  // Pattern 6: wrong start
  if (!sp.startsWith('你是')) return 'wrong_start';
  return null;
}

function rebuildCleanSP(persona: any, nameZh: string): string {
  let identity = persona.briefZh || persona.brief || '';
  // Strip "XXX是一位" or "XXX的核心..." prefix
  const shiIdx = identity.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 20) {
    identity = identity.slice(shiIdx + 2).trim();
  }
  const coreIdx = identity.indexOf('的核心');
  if (coreIdx > 1 && coreIdx < 20) {
    identity = identity.slice(coreIdx + 3).trim();
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

async function fixPersona(slug: string, dryRun: boolean): Promise<{ status: string; detail: string }> {
  const nameZh = PERSONA_NAMES[slug] || slug;
  const v5path = join(V5_DIR, `${slug}-v5.json`);
  if (!existsSync(v5path)) return { status: 'no_json', detail: 'No V5 JSON' };

  const data = JSON.parse(readFileSync(v5path, 'utf-8'));
  const persona = data.persona || {};
  const sp = persona.systemPromptTemplate || '';
  const corruption = getCorruptionType(sp);

  if (!corruption) return { status: 'clean', detail: 'Already clean' };

  const cleanSP = rebuildCleanSP(persona, nameZh);

  if (dryRun) {
    return { status: corruption, detail: `Current: "${sp.substring(0, 50)}" -> Clean: "${cleanSP.substring(0, 50)}"` };
  }

  // Fix JSON
  persona.systemPromptTemplate = cleanSP;
  writeFileSync(v5path, JSON.stringify(data, null, 2), 'utf-8');

  // Fix DB
  const newId = cuid();
  await pool.query(`
    UPDATE distilled_personas SET id = $1, "namezh" = $2, "systemPromptTemplate" = $3, "updatedAt" = NOW()
    WHERE "slug" = $4
  `, [newId, nameZh, cleanSP, slug]);

  return { status: 'fixed', detail: `namezh="${nameZh}" SP "${cleanSP.substring(0, 40)}..."` };
}

async function main() {
  const { values } = parseArgs({
    options: { dry: { type: 'boolean', default: false } },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Fix Remaining SP Corruptions\n${'─'.repeat(60)}\n`);

  // Get all V5 files
  const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));
  const analysis: { slug: string; sp: string; corruption: string | null }[] = [];

  for (const file of files) {
    const slug = file.replace('-v5.json', '');
    const data = JSON.parse(readFileSync(join(V5_DIR, file), 'utf-8'));
    const sp = data.persona?.systemPromptTemplate || '';
    const corruption = getCorruptionType(sp);
    analysis.push({ slug, sp, corruption });
  }

  const toFix = analysis.filter(a => a.corruption !== null);
  console.log(`Total: ${files.length} | Need fix: ${toFix.length} | Clean: ${files.length - toFix.length}\n`);

  if (toFix.length > 0) {
    console.log('Breakdown:');
    const byType: Record<string, string[]> = {};
    for (const a of toFix) {
      if (!byType[a.corruption!]) byType[a.corruption!] = [];
      byType[a.corruption!].push(a.slug);
    }
    for (const [type, slugs] of Object.entries(byType)) {
      console.log(`  ${type}: ${slugs.length}`);
      for (const s of slugs) {
        const a = analysis.find(x => x.slug === s)!;
        console.log(`    - ${s}: "${a.sp.substring(0, 50).replace(/\n/g, '\\n')}"`);
      }
    }
    console.log('');
  }

  if (dryRun) {
    console.log(`[DRY] Would fix ${toFix.length} personas.`);
    return;
  }

  let fixed = 0, errors = 0;
  for (const a of toFix) {
    const result = await fixPersona(a.slug, false);
    if (result.status === 'fixed') {
      console.log(`  ✓ ${a.slug}: ${result.detail}`);
      fixed++;
    } else if (result.status === 'clean') {
      console.log(`  ○ ${a.slug}: already clean`);
    } else {
      console.error(`  ✗ ${a.slug}: ${result.detail}`);
      errors++;
    }
  }

  // Verify
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Fixed: ${fixed} | Errors: ${errors}\n`);

  const verify = await pool.query(`SELECT slug, substring("systemPromptTemplate", 1, 50) as sp_preview FROM distilled_personas`);
  let stillCorrupted = 0;
  for (const row of verify.rows) {
    if (getCorruptionType(row.sp_preview || '')) {
      console.log(`  STILL: ${row.slug}: "${(row.sp_preview || '').replace(/\n/g, '\\n')}"`);
      stillCorrupted++;
    }
  }
  if (stillCorrupted === 0) {
    console.log('All DB SP verified clean!');
  } else {
    console.log(`${stillCorrupted} still corrupted (see above).`);
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error(err); pool.end(); process.exit(1); });
