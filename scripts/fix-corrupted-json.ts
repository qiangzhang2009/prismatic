#!/usr/bin/env bun
/**
 * Prismatic — Batch Fix Corrupted蒸馏 JSON
 *
 * 修复 distillation-v4.ts 的 bug 对已生成的 JSON 文件的影响:
 * 1. nameZh 全为空 → 从 personas.ts registry 回填（最安全）
 * 2. keyConcepts 被维特根斯坦 7 个词污染 → 清空 keyConcepts
 * 3. systemPromptTemplate 中英文拼接错误 → 重建 SP
 *
 * 用法:
 *   bun run scripts/fix-corrupted-json.ts          # 修复全部
 *   bun run scripts/fix-corrupted-json.ts --dry   # 预览不写入
 *   bun run scripts/fix-corrupted-json.ts --persona=jiqun  # 只修复一个
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'node:util';
import { PERSONAS } from '../src/lib/personas';

const V4_DIR = join(process.cwd(), 'corpus', 'distilled', 'v4');
const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');

const POLLUTED_TERMS = new Set([
  '语言游戏',
  '家族相似性',
  '生活形式',
  '私人语言',
  '遵守规则',
  '第一性原理',
  '小我',
]);

// ─── Registry fallback for nameZh (hardcoded overrides for edge cases) ────────
// Key: personaId → correct nameZh
const NAMEZH_OVERRIDES: Record<string, string> = {
  // Use correct Chinese names from registry (not slugs)
  'jiqun': '济群法师',
  'zhang-yiming': '张一鸣',
  'elon-musk': '埃隆·马斯克',
  'jack-ma': '马云',
  'jensen-huang': '黄仁勋',
  'zhang-xuefeng': '张雪峰',
  'peter-thiel': '彼得·蒂尔',
  'jeff-bezos': '杰夫·贝索斯',
  'warren-buffett': '沃伦·巴菲特',
  'charlie-munger': '查理·芒格',
  'paul-graham': '保罗·格雷厄姆',
  'ilya-sutskever': '伊利亚·苏茨克沃',
  'sam-altman': '萨姆·阿尔特曼',
  'nassim-taleb': '纳西姆·塔勒布',
  'richard-feynman': '理查德·费曼',
  'naval-ravikant': '纳瓦尔·拉维坎特',
  'andrej-karpathy': '安德烈·卡帕西',
  'aleister-crowley': '阿莱斯特·克劳利',
  'john-maynard-keynes': '约翰·梅纳德·凯恩斯',
  'ray-dalio': '雷·达里奥',
  'tripitaka': '唐三藏',
  'three-kingdoms': '三国演义',
  'huangdi-neijing': '黄帝内经',
  'journey-west': '西游记',
  'records-grand-historian': '司马迁',
  'steve-jobs': '史蒂夫·乔布斯',
  'marcus-aurelius': '马可·奥勒留',
};

// ─── Build corrected system prompt ─────────────────────────────────────────

function buildCleanSystemPrompt(persona: any): string {
  // Strip the name from briefZh to avoid duplication like "你是济群法师是一位..."
  let identity = persona.briefZh || persona.brief || '一位智者';
  // If briefZh starts with "XXX是一位" (≤15 chars before), remove that prefix
  // so we don't get "你是XXX是一位..." but rather just the description
  const shiIdx = identity.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 15) {
    identity = identity.slice(shiIdx + 2).trim();
  }
  if (!identity || identity.length < 5) identity = persona.brief || '一位智者';

  const tone = persona.expressionDNA?.tone || '中性';
  const certainty =
    persona.expressionDNA?.certaintyLevel === 'high' ? '表达确定'
    : persona.expressionDNA?.certaintyLevel === 'low' ? '保持适度不确定'
    : '平衡客观';
  const values = (persona.values || [])
    .slice(0, 3)
    .map((v: any) => v.nameZh || v.name)
    .join('、');
  const models = (persona.mentalModels || [])
    .slice(0, 3)
    .map((m: any) => m.nameZh || m.name)
    .join('、');
  const chineseAdaptation =
    persona.expressionDNA?.chineseAdaptation || '保持专业、清晰的中文表达。';
  const rhetoricalHabit =
    persona.expressionDNA?.rhetoricalHabit || '理性分析。';
  const speakingStyle =
    persona.expressionDNA?.speakingStyle || '语言简洁凝练，富有洞察力。';

  return `你是${identity}。

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

// ─── Fix a single JSON file ────────────────────────────────────────────────

function fixPersonaJSON(filepath: string, dryRun: boolean): {
  personaId: string;
  fixes: string[];
  wasChanged: boolean;
} {
  const raw = readFileSync(filepath, 'utf-8');
  const d = JSON.parse(raw);

  const fileBasename = basename(filepath, '.json');
  const personaId = d.persona?.id || fileBasename.replace(/-v[45]$/, '');
  const registry = PERSONAS[personaId];

  const fixes: string[] = [];
  let changed = false;

  // Fix 1: nameZh — use override map, then registry, then skip
  const currentNameZh = d.persona?.nameZh || '';
  const isBroken = !currentNameZh.trim() || currentNameZh === 'PLACEHOLDER' ||
    currentNameZh.toLowerCase() === personaId.toLowerCase();

  if (isBroken) {
    let targetNameZh = '';

    // Source 1: Hardcoded override (most reliable for edge cases)
    if (NAMEZH_OVERRIDES[personaId]) {
      targetNameZh = NAMEZH_OVERRIDES[personaId];
    }
    // Source 2: Registry (only if not a slug)
    else if (registry?.nameZh && !registry.nameZh.includes('-') && !registry.nameZh.includes('/')) {
      targetNameZh = registry.nameZh;
    }

    if (targetNameZh && d.persona) {
      d.persona.nameZh = targetNameZh;
      fixes.push(`nameZh → "${targetNameZh}"`);
      changed = true;
    }
  }

  // Fix 2: Clear polluted keyConcepts
  const kcs = d.knowledge?.keyConcepts || [];
  const pollutedKCs = kcs.filter((c: any) =>
    POLLUTED_TERMS.has(c.chinese)
  );
  if (pollutedKCs.length > 0) {
    d.knowledge.keyConcepts = [];
    fixes.push(`cleared ${pollutedKCs.length} polluted keyConcepts`);
    changed = true;
  }

  // Fix 3: Rebuild systemPromptTemplate if corrupted:
  // 1. Has mixed English/Chinese (old corruption)
  // 2. Starts with "你是XXX是一位" (name duplication in identity)
  // 3. Doesn't start with "你是" at all
  const sp = d.persona?.systemPromptTemplate || '';
  const hasOldCorruption = sp.includes('is a') || sp.includes('is a Buddhist monk');
  const hasNameDup = sp.match(/^你是[\u4e00-\u9fff]{2,15}是一位/) !== null;
  const hasCorruption = hasOldCorruption || hasNameDup || (!sp.startsWith('你是') && sp.length > 0);
  if (hasCorruption && (registry || d.persona?.briefZh)) {
    const cleanSP = buildCleanSystemPrompt({
      ...d.persona,
      briefZh: d.persona?.briefZh || registry?.briefZh || '',
    });
    if (d.persona) {
      d.persona.systemPromptTemplate = cleanSP;
      fixes.push('rebuilt systemPromptTemplate');
      changed = true;
    }
  }

  // Fix 4: Clean up empty domain array
  if (Array.isArray(d.persona?.domain) && d.persona.domain.length === 0 && registry?.domain?.length > 0) {
    d.persona.domain = registry.domain;
    fixes.push('domain restored from registry');
    changed = true;
  }

  if (changed && !dryRun) {
    writeFileSync(filepath, JSON.stringify(d, null, 2), 'utf-8');
  }

  return { personaId, fixes, wasChanged: changed };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      dry: { type: 'boolean', default: false },
      persona: { type: 'string' },
    },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  const targetPersona = values.persona as string | undefined;

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Prismatic JSON 修复工具`);
  console.log('─'.repeat(60));

  const dirs = [
    { dir: V4_DIR, label: 'v4' },
    { dir: V5_DIR, label: 'v5' },
  ];

  let totalFixed = 0;
  let totalClean = 0;

  for (const { dir, label } of dirs) {
    if (!existsSync(dir)) {
      console.log(`\n📁 ${label}/ (目录不存在，跳过)`);
      continue;
    }

    console.log(`\n📁 ${label}/`);

    const files = readdirSync(dir).filter(f => f.endsWith(`-${label}.json`));
    let dirClean = 0;

    for (const file of files) {
      const filepath = join(dir, file);
      const { personaId, fixes, wasChanged } = fixPersonaJSON(filepath, dryRun);

      if (targetPersona && personaId !== targetPersona) continue;

      if (fixes.length === 0) {
        console.log(`  ○ ${personaId}`);
        totalClean++;
        dirClean++;
      } else {
        const icon = wasChanged ? (dryRun ? '▸' : '✓') : '○';
        console.log(`  ${icon} ${personaId}: ${fixes.join(', ')}`);
        if (wasChanged) totalFixed++;
      }
    }

    if (dirClean > 0) console.log(`  (${dirClean} 个无需修复)`);
  }

  console.log('\n' + '─'.repeat(60));
  if (dryRun) {
    console.log(`[DRY] 将修复: ${totalFixed} 个文件`);
  } else {
    console.log(`✓ 修复完成: ${totalFixed} 个文件`);
  }
  console.log(`  无需修复: ${totalClean} 个`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
