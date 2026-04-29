/**
 * Prismatic — Rebuild Mozi persona from correct zero-v1 source
 *
 * Run with:
 *   bun run scripts/rebuild-mozi.ts --dry-run     # preview only
 *   bun run scripts/rebuild-mozi.ts               # write to DB
 *   bun run scripts/rebuild-mozi.ts --to-code     # write to personas.ts
 *   bun run scripts/rebuild-mozi.ts --to-db --to-code  # write to both
 *
 * The mo-zi entry in personas.ts was accidentally contaminated with ctext.org
 * digital humanities mental models. This script rebuilds from the correct source:
 *   corpus/distilled/zero/mo-zi-zero.json
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZERO_JSON = join(process.cwd(), 'corpus/distilled/zero/mo-zi-zero.json');
const PERSONAS_TS = join(process.cwd(), 'src/lib/personas.ts');

const IS_DRY_RUN = process.argv.includes('--dry-run');
const TO_DB = !process.argv.includes('--to-code') || process.argv.includes('--to-db');
const TO_CODE = process.argv.includes('--to-code');

// ─── Load source data ───────────────────────────────────────────────────

const raw = readFileSync(ZERO_JSON, 'utf8');
const zeroData = JSON.parse(raw);
const k = zeroData.knowledge;
const m = zeroData.meta;

// ─── Transform mentalModels ───────────────────────────────────────────────

const mentalModels = (k.mentalModels || []).map((mm: any) => {
  const evidence = (mm.evidence || []).map((e: any) => {
    const out: any = { quote: e.quote, source: e.source || e.context || '' };
    if (e.year) out.year = e.year;
    return out;
  });
  return {
    id: mm.id,
    name: mm.nameEn || mm.name || mm.nameZh,
    nameZh: mm.nameZh || mm.name,
    oneLiner: mm.oneLinerZh || mm.oneLiner || '',
    evidence,
    crossDomain: mm.crossDomain || [],
    application: mm.applicationZh || mm.application || '',
    limitation: mm.limitationZh || mm.limitation || '',
  };
});

// ─── Transform decisionHeuristics ──────────────────────────────────────

const decisionHeuristics = (k.decisionHeuristics || []).map((dh: any) => ({
  id: dh.id,
  name: dh.nameEn || dh.name || dh.nameZh,
  nameZh: dh.nameZh || dh.name,
  description: dh.descriptionZh || dh.description || '',
  application: dh.applicationScenarioZh || dh.applicationScenario || '',
  example: dh.exampleZh || dh.example || '',
}));

// ─── Transform antiPatterns ────────────────────────────────────────────

const antiPatterns = (k.antiPatterns || []).map((ap: any) =>
  typeof ap === 'string' ? ap : (ap.nameZh || ap.name || ap.description || JSON.stringify(ap))
);

// ─── Transform tensions ────────────────────────────────────────────────

const tensions = (k.tensions || []).map((t: any) =>
  typeof t === 'string' ? t : {
    dimension: t.dimension || t.name || '',
    tensionZh: t.tensionZh || t.nameZh || '',
    left: t.left || '',
    right: t.right || '',
    description: t.description || t.descriptionZh || '',
  }
);

// ─── Transform honestBoundaries ──────────────────────────────────────

const honestBoundaries = (k.honestBoundaries || []).map((hb: any) =>
  typeof hb === 'string' ? hb : (hb.textZh || hb.text || hb.description || JSON.stringify(hb))
);

// ─── Transform strengths / blindspots ─────────────────────────────────

const strengths = (k.strengths || []).map((s: any) =>
  typeof s === 'string' ? s : (s.nameZh || s.name || s.description || JSON.stringify(s))
);

const blindspots = (k.blindspots || []).map((b: any) =>
  typeof b === 'string' ? b : (b.nameZh || b.name || b.description || JSON.stringify(b))
);

// ─── Identity fields ─────────────────────────────────────────────────

const tagline = (k.identity?.oneLineSummary || m.tagline || m.taglineZh || '兼爱')
  .replace(/^墨子[：:]\s*/, '');

const systemPrompt = k.identity?.identityPrompt || k.identityPrompt || '';
const identityPrompt = k.identity?.identityPromptZh || k.identity?.identityPrompt || '';

// ─── Score calculation ──────────────────────────────────────────────

const scoreData = zeroData.score || {};
const voiceScore = scoreData.voice?.overall ?? 0;
const knowledgeScore = scoreData.knowledge?.overall ?? 0;
const reasoningScore = scoreData.reasoning?.overall ?? 0;
const safetyScore = scoreData.safety?.overall ?? 0;
const overallRaw = scoreData.overall ?? 0;
const grade = zeroData.grade || 'B';

const finalScore = overallRaw > 0 ? overallRaw : Math.round(
  voiceScore * 0.30 + knowledgeScore * 0.30 + reasoningScore * 0.25 + safetyScore * 0.15
);

const scoreBreakdown = {
  voice: voiceScore,
  knowledge: knowledgeScore,
  reasoning: reasoningScore,
  safety: safetyScore,
  overall: overallRaw > 0 ? overallRaw : finalScore,
};

console.log('  Scores: voice=' + voiceScore + ' knowledge=' + knowledgeScore + ' reasoning=' + reasoningScore + ' safety=' + safetyScore);

// ─── Build personas.ts entry ─────────────────────────────────────────

const mmJson = JSON.stringify(mentalModels, null, 2);
const dhJson = JSON.stringify(decisionHeuristics, null, 2);
const valsJson = JSON.stringify(k.values || [], null, 2);
const tensJson = JSON.stringify(tensions, null, 2);

const briefText200 = ((m.briefZh || m.brief || '') as string).slice(0, 200);

const tsEntry = [
  "PERSONAS['mo-zi'] = {",
  "  id: 'mo-zi',",
  "  slug: 'mo-zi',",
  `  name: '${m.nameZh || m.name || 'Mo Zi'}',`,
  `  nameZh: '${m.nameZh || '墨子'}',`,
  `  nameEn: '${m.nameEn || 'Mo Zi'}',`,
  `  domain: ${JSON.stringify(m.domain || ['philosophy'])},`,
  `  tagline: '${tagline}',`,
  `  taglineZh: '${tagline}',`,
  `  avatar: '${m.avatar || ''}',`,
  `  accentColor: '${m.accentColor || '#0891b2'}',`,
  `  gradientFrom: '${m.gradientFrom || '#0891b2'}',`,
  `  gradientTo: '${m.gradientTo || '#22d3ee'}',`,
  `  brief: '${briefText200}...',`,
  `  briefZh: ${JSON.stringify(m.briefZh || m.brief || '')},`,
  `  mentalModels: ${mmJson},`,
  `  decisionHeuristics: ${dhJson},`,
  `  values: ${valsJson},`,
  `  antiPatterns: ${JSON.stringify(antiPatterns)},`,
  `  tensions: ${tensJson},`,
  `  honestBoundaries: ${JSON.stringify(honestBoundaries)},`,
  `  strengths: ${JSON.stringify(strengths)},`,
  `  blindspots: ${JSON.stringify(blindspots)},`,
  `  systemPromptTemplate: ${JSON.stringify(systemPrompt)},`,
  `  identityPrompt: ${JSON.stringify(identityPrompt)},`,
  '};',
].join('\n');

// ─── Report ────────────────────────────────────────────────────────

console.log('=== Mozi Rebuild Summary ===');
console.log(`Mental models: ${mentalModels.length}`);
for (const mm of mentalModels) {
  console.log(`  - ${mm.nameZh} (${mm.name})`);
}
console.log(`Decision heuristics: ${decisionHeuristics.length}`);
console.log(`Values: ${(k.values || []).length}`);
console.log(`Tensions: ${tensions.length}`);
console.log(`Final score: ${finalScore} (${grade})`);
console.log('');

// ─── Write to personas.ts ─────────────────────────────────────────

if (TO_CODE) {
  const personasContent = readFileSync(PERSONAS_TS, 'utf8');
  const marker = "PERSONAS['mo-zi']";
  const startIdx = personasContent.indexOf(marker);

  if (startIdx === -1) {
    console.error('ERROR: Could not find mo-zi entry in personas.ts');
    process.exit(1);
  }

  // Find end: next PERSONAS[ marker
  let endIdx = personasContent.indexOf("PERSONAS['", startIdx + marker.length);
  if (endIdx === -1) endIdx = personasContent.indexOf('PERSONAS["', startIdx + marker.length);
  if (endIdx === -1) endIdx = personasContent.length;

  const newContent = personasContent.slice(0, startIdx) + tsEntry + '\n\n' + personasContent.slice(endIdx);

  if (!IS_DRY_RUN) {
    writeFileSync(PERSONAS_TS, newContent, 'utf8');
    console.log('Wrote mo-zi entry to personas.ts');
  } else {
    console.log('[DRY RUN] Would write to personas.ts');
    console.log('--- Preview (first 3000 chars) ---');
    console.log(tsEntry.slice(0, 3000));
  }
}

// ─── Write to DB ─────────────────────────────────────────────────

if (TO_DB) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const briefZhText = (m.briefZh || m.brief || '') as string;
  const briefText300 = briefZhText.slice(0, 300);

  const sql = `
UPDATE distilled_personas SET
  name = $1,
  "nameZh" = $2,
  tagline = $3,
  "taglineZh" = $4,
  brief = $5,
  "briefZh" = $6,
  "mentalModels" = $7,
  "decisionHeuristics" = $8,
  "values" = $9,
  "antiPatterns" = $10,
  "tensions" = $11,
  "honestBoundaries" = $12,
  "strengths" = $13,
  "blindspots" = $14,
  "systemPromptTemplate" = $15,
  "identityPrompt" = $16,
  "finalScore" = $17,
  "qualityGrade" = $18,
  "thresholdPassed" = $19,
  "scoreBreakdown" = $20,
  "distillVersion" = $21,
  "distillDate" = NOW()
WHERE slug = 'mo-zi' AND "isActive" = true`;

  const params: any[] = [
    m.name || 'Mo Zi',
    m.nameZh || '墨子',
    tagline,
    tagline,
    briefText300,
    briefZhText,
    JSON.stringify(mentalModels),
    JSON.stringify(decisionHeuristics),
    JSON.stringify(k.values || []),
    JSON.stringify(antiPatterns),
    JSON.stringify(tensions),
    JSON.stringify(honestBoundaries),
    JSON.stringify(strengths),
    JSON.stringify(blindspots),
    systemPrompt,
    identityPrompt,
    finalScore,
    grade,
    finalScore >= 60,
    JSON.stringify(scoreBreakdown),
    'zero-v1-rebuild-' + new Date().toISOString().slice(0, 10),
  ];

  if (!IS_DRY_RUN) {
    await pool.query(sql, params);
    console.log(`Updated DB: mo-zi (finalScore=${finalScore}, grade=${grade})`);
  } else {
    console.log('[DRY RUN] Would execute DB update:');
    console.log(sql);
    params.forEach((p, i) => {
      const s = JSON.stringify(p);
      console.log(`  $${i + 1}: ${s.length > 120 ? s.slice(0, 120) + '...' : s}`);
    });
  }

  await pool.end();
}

if (IS_DRY_RUN) {
  console.log('\n[DRY RUN] No changes written.');
}
console.log('Done.');
