#!/usr/bin/env bun
/**
 * Rebuild all V5 systemPromptTemplate from JSON data,
 * then deploy all to database.
 *
 * Usage:
 *   bun run scripts/rebuild-sp-and-deploy.ts          # rebuild JSON + deploy
 *   bun run scripts/rebuild-sp-and-deploy.ts --dry    # dry-run preview
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'node:util';
import { Pool } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const V5_DIR = join(process.cwd(), 'corpus', 'distilled', 'v5');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Rebuild SP ─────────────────────────────────────────────────────────────

function buildCleanSystemPrompt(persona: any): string {
  let identity = persona.briefZh || persona.brief || '一位智者';
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

function hasEnglishCorruption(sp: string): boolean {
  return sp.includes('is a') || sp.includes('is an ');
}

function hasNameDuplication(sp: string): boolean {
  return /^你是[\u4e00-\u9fff]{2,15}是一位/.test(sp);
}

function isClean(sp: string): boolean {
  return sp.startsWith('你是') && !hasEnglishCorruption(sp) && !hasNameDuplication(sp);
}

// ─── CUID generator ────────────────────────────────────────────────────────

function cuid(): string {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

// ─── DB Upsert ─────────────────────────────────────────────────────────────

async function upsertPersona(slug: string, data: any): Promise<any> {
  const knowledge = data.knowledge || {};
  const persona = data.persona || {};
  const expr = data.expression || {};
  const score = data.score || {};
  const stats = data.meta?.corpusStats || {};

  const cleanSP = buildCleanSystemPrompt(persona);

  const mentalModels = JSON.stringify(
    ((knowledge.mentalModels || persona.mentalModels || [])).map((m: any) => ({
      id: m.id || '',
      name: m.name || '',
      nameZh: m.nameZh || m.name || '',
      oneLiner: m.oneLiner || '',
      oneLinerZh: m.oneLinerZh || m.oneLiner || '',
      evidence: m.evidence || [],
      crossDomain: m.crossDomain || [],
      application: m.application || '',
      applicationZh: m.applicationZh || m.application || '',
      limitation: m.limitation || '',
      limitationZh: m.limitationZh || m.limitation || '',
    }))
  );

  const decisionHeuristics = JSON.stringify(
    ((knowledge.decisionHeuristics || persona.decisionHeuristics || [])).map((h: any) => ({
      id: h.id || '',
      name: h.name || '',
      nameZh: h.nameZh || h.name || '',
      description: h.description || '',
      descriptionZh: h.descriptionZh || h.description || '',
      application: h.application || '',
      applicationZh: h.applicationZh || h.application || '',
      example: h.example || '',
      exampleZh: h.exampleZh || h.example || '',
    }))
  );

  const exprDna = {
    sentenceStyle: Array.isArray(expr.sentenceStyle) ? expr.sentenceStyle : [],
    vocabulary: Array.isArray(expr.vocabulary) ? expr.vocabulary : [],
    forbiddenWords: Array.isArray(expr.forbiddenWords) ? expr.forbiddenWords : [],
    rhythm: expr.rhythm || '',
    humorStyle: expr.humorStyle || '',
    certaintyLevel: expr.certaintyLevel || 'medium',
    rhetoricalHabit: expr.rhetoricalHabit || '',
    quotePatterns: Array.isArray(expr.quotePatterns) ? expr.quotePatterns : [],
    chineseAdaptation: expr.chineseAdaptation || '',
    verbalMarkers: expr.verbalMarkers || [],
    speakingStyle: expr.speakingStyle || '',
    tone: expr.tone || 'formal',
  };

  const values = JSON.stringify(
    ((knowledge.values || persona.values || [])).map((v: any) => ({
      name: v.name || '',
      nameZh: v.nameZh || v.name || '',
      priority: v.priority || 0,
      description: v.description || '',
      descriptionZh: v.descriptionZh || v.description || '',
    }))
  );

  const antiPatterns = JSON.stringify(
    Array.isArray(persona.antiPatterns || knowledge.antiPatterns)
      ? (persona.antiPatterns || knowledge.antiPatterns) : []);

  const tensions = JSON.stringify(
    ((knowledge.tensions || persona.tensions || [])).map((t: any) => ({
      dimension: t.dimension || '',
      dimensionZh: t.dimensionZh || '',
      tension: t.tension || t.tensionZh || '',
      tensionZh: t.tensionZh || t.tension || '',
      positivePole: t.positivePole || '',
      negativePole: t.negativePole || '',
      description: t.description || '',
      descriptionZh: t.descriptionZh || '',
    }))
  );

  const honestBoundaries = JSON.stringify(
    (persona.honestBoundaries || knowledge.honestBoundaries || []).map((h: any) => ({
      text: h.text || '',
      textZh: h.textZh || '',
      reason: h.reason || '',
      reasonZh: h.reasonZh || '',
    }))
  );

  const strengths = JSON.stringify(
    Array.isArray(persona.strengths || knowledge.strengths)
      ? (persona.strengths || knowledge.strengths) : []);

  const blindspots = JSON.stringify(
    Array.isArray(persona.blindspots || knowledge.blindspots)
      ? (persona.blindspots || knowledge.blindspots) : []);

  const id = cuid();
  const sessionId = `v5-${slug}`;

  // Get display data from personas.ts registry
  const { PERSONAS } = await import('../src/lib/personas');
  const registry = PERSONAS[slug] || {};

  const display = {
    name: registry.name || slug,
    nameZh: registry.nameZh || '',
    nameEn: registry.nameEn || '',
    domain: Array.isArray(registry.domain) ? registry.domain.join(',') : (registry.domain || 'philosophy'),
    tagline: registry.tagline || '',
    taglineZh: registry.taglineZh || '',
    avatar: registry.avatar || null,
    accentColor: registry.accentColor || '#6366f1',
    gradientFrom: registry.gradientFrom || '#6366f1',
    gradientTo: registry.gradientTo || '#8b5cf6',
    brief: registry.brief || '',
    briefZh: registry.briefZh || '',
  };

  const query = `
    INSERT INTO distilled_personas (
      id, "sessionId", "slug", "name", "namezh", "nameen", "domain",
      "tagline", "taglineZh", "avatar", "accentColor", "gradientFrom", "gradientTo",
      "brief", "briefZh",
      "mentalModels", "decisionHeuristics", "expressionDNA", "values",
      "antiPatterns", "tensions", "honestBoundaries", "strengths", "blindspots",
      "systemPromptTemplate", "identityPrompt",
      "reasoningStyle", "decisionFramework", "keyQuotes", "lifePhilosophy",
      "finalScore", "qualityGrade", "thresholdPassed", "qualityGateSkipped",
      "scoreBreakdown", "scoreFindings",
      "corpusItemCount", "corpusTotalWords", "corpusSources",
      "distillVersion", "distillDate", "isActive", "isPublished",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22, $23, $24,
      $25, $26,
      $27, $28, $29, $30,
      $31, $32, $33, $34,
      $35, $36,
      $37, $38, $39,
      $40, $41, $42, $43,
      NOW(), NOW()
    )
    ON CONFLICT ("slug") DO UPDATE SET
      id = EXCLUDED.id,
      "sessionId" = EXCLUDED."sessionId",
      "name" = EXCLUDED."name",
      "namezh" = EXCLUDED."namezh",
      "nameen" = EXCLUDED."nameen",
      "domain" = EXCLUDED."domain",
      "tagline" = EXCLUDED."tagline",
      "taglineZh" = EXCLUDED."taglineZh",
      "avatar" = EXCLUDED."avatar",
      "accentColor" = EXCLUDED."accentColor",
      "gradientFrom" = EXCLUDED."gradientFrom",
      "gradientTo" = EXCLUDED."gradientTo",
      "brief" = EXCLUDED."brief",
      "briefZh" = EXCLUDED."briefZh",
      "mentalModels" = EXCLUDED."mentalModels",
      "decisionHeuristics" = EXCLUDED."decisionHeuristics",
      "expressionDNA" = EXCLUDED."expressionDNA",
      "values" = EXCLUDED."values",
      "antiPatterns" = EXCLUDED."antiPatterns",
      "tensions" = EXCLUDED."tensions",
      "honestBoundaries" = EXCLUDED."honestBoundaries",
      "strengths" = EXCLUDED."strengths",
      "blindspots" = EXCLUDED."blindspots",
      "systemPromptTemplate" = EXCLUDED."systemPromptTemplate",
      "identityPrompt" = EXCLUDED."identityPrompt",
      "finalScore" = EXCLUDED."finalScore",
      "qualityGrade" = EXCLUDED."qualityGrade",
      "thresholdPassed" = EXCLUDED."thresholdPassed",
      "qualityGateSkipped" = EXCLUDED."qualityGateSkipped",
      "scoreBreakdown" = EXCLUDED."scoreBreakdown",
      "scoreFindings" = EXCLUDED."scoreFindings",
      "corpusItemCount" = EXCLUDED."corpusItemCount",
      "corpusTotalWords" = EXCLUDED."corpusTotalWords",
      "corpusSources" = EXCLUDED."corpusSources",
      "distillVersion" = EXCLUDED."distillVersion",
      "distillDate" = EXCLUDED."distillDate",
      "isPublished" = EXCLUDED."isPublished",
      "updatedAt" = NOW()
    RETURNING "slug", "name", "namezh", "finalScore", "qualityGrade", "thresholdPassed", "distillVersion"
  `;

  const params = [
    id, sessionId, slug,
    display.name, display.nameZh, display.nameEn, display.domain,
    display.tagline, display.taglineZh, display.avatar,
    display.accentColor, display.gradientFrom, display.gradientTo,
    (persona.identityPrompt || knowledge.identityPrompt || '').substring(0, 1000),
    knowledge.identityPromptZh || display.briefZh || '',
    mentalModels, decisionHeuristics, JSON.stringify(exprDna), values,
    antiPatterns, tensions, honestBoundaries, strengths, blindspots,
    cleanSP,
    persona.identityPrompt || knowledge.identityPrompt || '',
    null, null, null, null,
    score.overall || 0,
    score.grade || 'F',
    score.thresholdPassed || false,
    false,
    JSON.stringify(score.breakdown || {}),
    JSON.stringify(score.findings || []),
    stats.files || 0,
    stats.words || 0,
    JSON.stringify([]),
    data.meta?.distillationVersion || 'v5',
    data.meta?.createdAt || new Date().toISOString(),
    true, true,
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      dry: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const dryRun = values.dry ?? false;
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Rebuild SP + Deploy V5 Personas\n${'─'.repeat(60)}\n`);

  if (!existsSync(V5_DIR)) {
    console.error(`V5 directory not found: ${V5_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));

  // Step 1: Analyze all files
  const analysis = [];
  for (const file of files) {
    const filepath = join(V5_DIR, file);
    const raw = readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw);
    const sp = data.persona?.systemPromptTemplate || '';
    const slug = data.meta?.personaId || file.replace('-v5.json', '');
    const needsRebuild = !isClean(sp);

    analysis.push({ file, slug, sp, needsRebuild, data });
  }

  const toRebuild = analysis.filter(a => a.needsRebuild);
  console.log(`Found ${files.length} V5 files:`);
  console.log(`  ${analysis.length} total`);
  console.log(`  ${analysis.length - toRebuild.length} already clean`);
  console.log(`  ${toRebuild.length} need SP rebuild\n`);

  if (toRebuild.length > 0) {
    console.log('Will rebuild:');
    for (const a of toRebuild) {
      const first20 = a.sp.substring(0, 40).replace(/\n/g, '\\n');
      console.log(`  ${a.slug}: "${first20}..."`);
    }
    console.log('');
  }

  if (dryRun) {
    console.log('[DRY] Would rebuild ' + toRebuild.length + ' files and deploy all ' + files.length + ' to DB');
    return;
  }

  // Step 2: Rebuild corrupted SP in JSON files
  console.log('Step 1: Rebuilding corrupted SP in JSON files...');
  for (const a of toRebuild) {
    const cleanSP = buildCleanSystemPrompt(a.data.persona);
    a.data.persona.systemPromptTemplate = cleanSP;
    const filepath = join(V5_DIR, a.file);
    writeFileSync(filepath, JSON.stringify(a.data, null, 2), 'utf-8');
    console.log(`  ✓ ${a.slug}: SP rebuilt`);
  }
  console.log(`  Done. Rebuilt ${toRebuild.length} files.\n`);

  // Step 3: Deploy all to DB
  console.log('Step 2: Deploying all V5 personas to database...');
  let success = 0;
  let errors = 0;

  for (const a of analysis) {
    // Ensure session exists
    try {
      await pool.query(`
        INSERT INTO distill_sessions (id, "personaId", "personaName", "personaDomain", status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [`v5-${a.slug}`, a.slug, a.data.persona?.name || a.slug, 'philosophy']);
    } catch {}

    try {
      const result = await upsertPersona(a.slug, a.data);
      const passed = result.thresholdPassed ? '✓' : '✗';
      console.log(`  ${passed} ${a.slug}: score=${result.finalScore} grade=${result.qualityGrade} v=${result.distillVersion} name="${result.name}" namezh="${result.namezh || ''}"`);
      success++;
    } catch (err: any) {
      console.error(`  ✗ ERROR ${a.slug}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Deploy complete: ${success} success, ${errors} errors`);

  // Step 4: Verify SP in DB
  console.log('\nStep 3: Verifying SP in database...');
  const verify = await pool.query(`SELECT slug, substring("systemPromptTemplate", 1, 30) as sp_preview FROM distilled_personas`);
  let dbCorrupted = 0;
  for (const row of verify.rows) {
    const sp = row.sp_preview || '';
    if (hasEnglishCorruption(sp) || hasNameDuplication(sp)) {
      console.log(`  DB CORRUPTED: ${row.slug}: "${sp.replace(/\n/g, '\\n')}"`);
      dbCorrupted++;
    }
  }
  if (dbCorrupted === 0) {
    console.log('  All DB systemPromptTemplate are clean!');
  } else {
    console.log(`  WARNING: ${dbCorrupted} corrupted SP in DB (see above)`);
  }
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error(err); pool.end(); process.exit(1); });
