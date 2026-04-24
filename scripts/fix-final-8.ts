#!/usr/bin/env bun
/**
 * Final targeted fix for 8 remaining corrupted SP.
 *
 * Strategy: The briefZh already contains the name at the start.
 * We need to:
 * 1. Strip the name from the beginning of briefZh to avoid duplication
 * 2. Then prepend "你是NAME，"
 *
 * Usage:
 *   bun run scripts/fix-final-8.ts --dry    # preview
 *   bun run scripts/fix-final-8.ts          # apply
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');

const PERSONA_NAMES: Record<string, string> = {
  'mo-zi': '墨子', 'aleister-crowley': '阿莱斯特·克劳利',
  'einstein': '阿尔伯特·爱因斯坦', 'alan-turing': '艾伦·图灵',
  'richard-feynman': '理查德·费曼', 'sun-wukong': '孙悟空',
  'wittgenstein': '路德维希·维特根斯坦', 'journey-west': '西游记',
};

function cuid(): string {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

function stripNameFromBrief(briefZh: string, nameZh: string): string {
  // briefZh starts with the name — strip it and return just the description
  if (briefZh.startsWith(nameZh)) {
    let rest = briefZh.slice(nameZh.length);
    // Remove leading comma, punctuation
    rest = rest.replace(/^，?^，?/, '');
    rest = rest.trim();
    return rest;
  }
  // If nameZh not at start, try simple strip
  let result = briefZh;
  // Remove "XXX是一位" prefix (name + "是一位")
  const shiIdx = result.indexOf('是一位');
  if (shiIdx > 1 && shiIdx < 20) {
    result = result.slice(shiIdx + 2).trim();
  }
  // Remove "XXX的核心" prefix
  const coreIdx = result.indexOf('的核心');
  if (coreIdx > 1 && coreIdx < 20) {
    result = result.slice(coreIdx + 3).trim();
  }
  return result;
}

function buildCleanSP(persona: any, nameZh: string): string {
  let identity = persona.briefZh || persona.brief || '';

  // Special case: SP starts with "你是在其核心" → skip to after that
  if (identity.startsWith('在其核心，')) {
    identity = identity.replace(/^在其核心，/, '');
  }
  // Remove "XXX是一位" prefix
  identity = identity.replace(/^[\u4e00-\u9fff·]+是一位/, '');
  // Remove "XXX的核心" prefix
  identity = identity.replace(/^[\u4e00-\u9fff·]+的核心/, '');
  // Strip the name itself if it appears at start of remaining text
  identity = stripNameFromBrief(identity, nameZh);

  if (!identity || identity.length < 5) identity = '一位智者';

  const exprDna = persona.expressionDNA || {};
  const tone = exprDna.tone || '中性';
  const certainty = exprDna.certaintyLevel === 'high' ? '表达确定' : exprDna.certaintyLevel === 'low' ? '保持适度不确定' : '平衡客观';
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

async function fixPersona(slug: string, dryRun: boolean): Promise<string> {
  const nameZh = PERSONA_NAMES[slug];
  if (!nameZh) return `no mapping`;

  const filepath = join(V5_DIR, `${slug}-v5.json`);
  const data = JSON.parse(readFileSync(filepath, 'utf-8'));
  const persona = data.persona || {};
  const oldSP = persona.systemPromptTemplate || '';
  const cleanSP = buildCleanSP(persona, nameZh);

  if (dryRun) {
    return `OLD: "${oldSP.substring(0, 70).replace(/\n/g, '\\n')}"\nNEW: "${cleanSP.substring(0, 70).replace(/\n/g, '\\n')}"`;
  }

  persona.systemPromptTemplate = cleanSP;
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');

  const newId = cuid();
  await pool.query(`
    UPDATE distilled_personas SET id = $1, "namezh" = $2, "systemPromptTemplate" = $3, "updatedAt" = NOW()
    WHERE "slug" = $4
  `, [newId, nameZh, cleanSP, slug]);

  return `OK: "${cleanSP.substring(0, 60).replace(/\n/g, '\\n')}..."`;
}

async function main() {
  const { values } = parseArgs({
    options: { dry: { type: 'boolean', default: false } },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  console.log(`\n${dryRun ? '[DRY] ' : ''}Fix Final 8 SP\n${'─'.repeat(60)}\n`);

  const slugs = Object.keys(PERSONA_NAMES);
  for (const slug of slugs) {
    const result = await fixPersona(slug, dryRun);
    if (dryRun) {
      console.log(`${slug}:`);
      for (const line of result.split('\n')) {
        console.log(`  ${line}`);
      }
      console.log('');
    } else {
      console.log(`  ✓ ${slug}: ${result}`);
    }
  }

  if (!dryRun) {
    console.log(`\n${'─'.repeat(60)}\nVerification:`);
    const verify = await pool.query(`SELECT slug, substring("systemPromptTemplate", 1, 60) as sp FROM distilled_personas WHERE slug = ANY($1)`, [slugs]);
    let bad = 0;
    for (const row of verify.rows) {
      const sp = row.sp || '';
      const hasBad = /你是[\u4e00-\u9fff]{2,15}是一种/.test(sp) || /^你是一位/.test(sp) || /^你是在/.test(sp) || sp.includes(' is a');
      const label = hasBad ? 'STILL BAD' : 'CLEAN';
      console.log(`  ${label}: ${row.slug}: "${sp.replace(/\n/g, '\\n')}"`);
      if (hasBad) bad++;
    }
    if (bad === 0) console.log('\n  All 8 fixed and verified clean!');
    else console.log(`\n  ${bad} still bad.`);
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error(err); pool.end(); process.exit(1); });
