/**
 * Deploy V4 Distilled Personas to Neon Database
 *
 * Strategy: Merge from two sources:
 *   1. Existing personas.ts code — for nameZh, nameEn, accentColor, gradientFrom, gradientTo, domain
 *   2. corpus/distilled/v4/*-v4.json — for all cognitive data, scores, system prompts
 *
 * Why: v4 JSON files lack nameZh and have generic colors; personas.ts has the full display data.
 *
 * Schema note:
 *   - Prisma schema: camelCase (nameZh, nameEn, briefZh, finalScore, etc.) — OUT OF SYNC with actual DB
 *   - DB actual:     snake_case (namezh, nameen, briefzh, finalscore, etc.)
 *   - Solution: use @neondatabase/serverless Pool with raw SQL
 *
 * Run: node scripts/deploy-v4-to-db.mjs
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V4_DIR = join(__dirname, '../corpus/distilled/v4');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

// Load env
try {
  const { config } = await import('dotenv');
  config({ path: join(__dirname, '../.env') });
} catch (e) {
  // dotenv may not be available
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Generate cuid ───────────────────────────────────────────────────────────

function cuid() {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

// ─── Step 1: Load display data from personas.ts code registry ──────────────────

function loadDisplayData() {
  const content = readFileSync(PERSONAS_FILE, 'utf8');
  const result = {};

  const blockRegex = /PERSONAS\['([^']+)'\]\s*=\s*\{/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    const slug = match[1];
    const start = match.index + match[0].length;
    const rest = content.slice(start);

    let depth = 1;
    let pos = 0;
    while (pos < rest.length && depth > 0) {
      if (rest[pos] === '{') depth++;
      else if (rest[pos] === '}') depth--;
      pos++;
    }
    const block = rest.slice(0, pos - 1);

    const extract = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*(?:\\[([^\\]]*)\\]|'([^']*)'|"([^"]*)")`));
      if (!m) return null;
      if (m[1] !== undefined) {
        return (m[1].match(/'([^']+)'/g) || []).map(s => s.replace(/'/g, ''));
      }
      return m[2] || m[3] || null;
    };

    const domains = extract('domain');
    result[slug] = {
      name: extract('name'),
      nameZh: extract('nameZh'),
      nameEn: extract('nameEn'),
      domain: Array.isArray(domains) ? domains.join(',') : 'philosophy',
      tagline: extract('tagline'),
      taglineZh: extract('taglineZh'),
      avatar: extract('avatar'),
      accentColor: extract('accentColor') || '#6366f1',
      gradientFrom: extract('gradientFrom') || '#6366f1',
      gradientTo: extract('gradientTo') || '#8b5cf6',
      brief: extract('brief'),
      briefZh: extract('briefZh'),
    };
  }

  return result;
}

// ─── Step 2: Load v4 JSON files ───────────────────────────────────────────────

function loadV4Files() {
  const files = readdirSync(V4_DIR).filter(f => f.endsWith('-v4.json'));
  const personas = [];
  for (const file of files) {
    const slug = file.replace('-v4.json', '');
    const raw = readFileSync(join(V4_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    personas.push({ slug, data });
  }
  return personas;
}

// ─── Step 3: Extract from v4 JSON ──────────────────────────────────────────────

function extractV4Data(slug, data) {
  const knowledge = data.knowledge || {};
  const persona = data.persona || {};

  const mentalModels = JSON.stringify(
    (persona.mentalModels || knowledge.mentalModels || []).map(m => ({
      id: m.id || '',
      name: m.name || '',
      nameZh: m.nameZh || '',
      oneLiner: m.oneLiner || '',
      evidence: m.evidence || [],
      crossDomain: m.crossDomain || [],
      application: m.application || '',
      limitation: m.limitation || '',
    }))
  );

  const decisionHeuristics = JSON.stringify(
    (persona.decisionHeuristics || knowledge.decisionHeuristics || []).map(h => ({
      id: h.id || '',
      name: h.name || '',
      nameZh: h.nameZh || '',
      description: h.description || '',
      descriptionZh: h.descriptionZh || '',
      application: h.application || '',
      example: h.example || '',
      exampleZh: h.exampleZh || '',
    }))
  );

  const expr = data.expression || {};
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
    (persona.values || knowledge.values || []).map(v => ({
      name: v.name || '',
      nameZh: v.nameZh || '',
      priority: v.priority || 0,
      description: v.description || '',
      descriptionZh: v.descriptionZh || '',
    }))
  );

  const antiPatterns = JSON.stringify(
    Array.isArray(persona.antiPatterns || knowledge.antiPatterns)
      ? (persona.antiPatterns || knowledge.antiPatterns) : []);

  const tensions = JSON.stringify(
    (persona.tensions || knowledge.tensions || []).map(t => ({
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
    (persona.honestBoundaries || knowledge.honestBoundaries || []).map(h => ({
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

  const score = data.score || {};
  const stats = data.meta?.corpusStats || {};

  return {
    mentalModels,
    decisionHeuristics,
    expressionDNA: JSON.stringify(exprDna),
    values,
    antiPatterns,
    tensions,
    honestBoundaries,
    strengths,
    blindspots,
    identityPrompt: persona.identityPrompt || knowledge.identityPrompt || '',
    systemPromptTemplate: persona.systemPromptTemplate || '',
    briefZh: persona.briefZh || knowledge.briefZh || '',
    finalScore: score.overall || 0,
    qualityGrade: score.grade || 'F',
    thresholdPassed: score.thresholdPassed || false,
    scoreBreakdown: JSON.stringify(score.breakdown || {}),
    scoreFindings: JSON.stringify(score.findings || []),
    corpusItemCount: stats.files || 0,
    corpusTotalWords: stats.words || 0,
    distillVersion: data.meta?.distillationVersion || 'v4',
    distillDate: data.meta?.createdAt || new Date().toISOString(),
  };
}

// ─── Step 4: Upsert to DB ────────────────────────────────────────────────────

async function upsertPersona(slug, display, v4) {
  const id = cuid();
  const sessionId = `v4-${slug}`;

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
      "reasoningStyle" = EXCLUDED."reasoningStyle",
      "decisionFramework" = EXCLUDED."decisionFramework",
      "keyQuotes" = EXCLUDED."keyQuotes",
      "lifePhilosophy" = EXCLUDED."lifePhilosophy",
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
    display.name || slug,
    display.nameZh || '',
    display.nameEn || display.name || '',
    display.domain || 'philosophy',
    display.tagline || display.name || '',
    display.taglineZh || '',
    display.avatar || null,
    display.accentColor || '#6366f1',
    display.gradientFrom || '#6366f1',
    display.gradientTo || '#8b5cf6',
    (v4.identityPrompt || '').substring(0, 1000),
    v4.briefZh || '',
    v4.mentalModels,
    v4.decisionHeuristics,
    v4.expressionDNA,
    v4.values,
    v4.antiPatterns,
    v4.tensions,
    v4.honestBoundaries,
    v4.strengths,
    v4.blindspots,
    v4.systemPromptTemplate,
    v4.identityPrompt,
    null, null, null, null,
    v4.finalScore,
    v4.qualityGrade,
    v4.thresholdPassed,
    false,
    v4.scoreBreakdown,
    v4.scoreFindings,
    v4.corpusItemCount,
    v4.corpusTotalWords,
    JSON.stringify([]),
    v4.distillVersion,
    v4.distillDate,
    true,
    true,
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
}

// ─── Step 5: Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== V4 Persona Database Deployment ===\n');

  console.log('Step 1: Loading display data from personas.ts...');
  const displayData = loadDisplayData();
  console.log(`  Loaded display data for ${Object.keys(displayData).length} personas\n`);

  console.log('Step 2: Loading v4 JSON files...');
  const v4Files = loadV4Files();
  console.log(`  Found ${v4Files.length} v4 files\n`);

  console.log('Step 3: Ensuring distill_sessions entries...');
  for (const { slug, data } of v4Files) {
    const sessionId = `v4-${slug}`;
    const name = data.persona?.name || displayData[slug]?.name || slugToName(slug);
    await pool.query(`
      INSERT INTO distill_sessions (id, "personaId", "personaName", "personaDomain", status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [sessionId, slug, name, displayData[slug]?.domain || 'philosophy']);
  }
  console.log('  Sessions ensured.\n');

  console.log('Step 4: Upserting personas...\n');
  const results = [];

  for (const { slug, data } of v4Files) {
    const display = displayData[slug] || {};
    const v4 = extractV4Data(slug, data);

    try {
      const result = await upsertPersona(slug, display, v4);
      const passed = result.thresholdpassed ? '✓' : '✗';
      console.log(
        `  ${passed} ${slug}: score=${result.finalscore} grade=${result.qualitygrade} ` +
        `version=${result.distillversion} name="${result.name}" namezh="${result.namezh || ''}"`
      );
      results.push({ slug, status: 'ok', score: result.finalscore, grade: result.qualitygrade });
    } catch (err) {
      console.error(`  ✗ ERROR ${slug}: ${err.message}`);
      results.push({ slug, status: 'error', error: err.message });
    }
  }

  console.log('\n=== Summary ===');
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status === 'error');
  console.log(`  Total: ${results.length}`);
  console.log(`  Success: ${ok.length}`);
  console.log(`  Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n  Failed personas:');
    errors.forEach(e => console.log(`    - ${e.slug}: ${e.error}`));
  }

  // Verification
  console.log('\n=== Verification (sample) ===');
  const verify = await pool.query(`
    SELECT "slug", "name", "namezh", "finalScore", "qualityGrade",
           "thresholdPassed", "distillVersion", "corpusTotalWords"
    FROM distilled_personas
    WHERE "slug" IN ('confucius', 'wittgenstein', 'jeff-bezos', 'sun-tzu', 'zhuang-zi', 'alan-turing')
    ORDER BY "finalScore" DESC
  `);
  verify.rows.forEach(r => {
    console.log(
      `  ${r.slug}: name="${r.name}" namezh="${r.namezh}" score=${r.finalscore} ` +
      `grade=${r.qualitygrade} v=${r.distillversion} words=${r.corpuswords}`
    );
  });

  // Grade distribution
  const grades = await pool.query(`
    SELECT "qualityGrade", COUNT(*) as count, AVG("finalScore") as avg
    FROM distilled_personas
    WHERE "distillVersion" = 'v4'
    GROUP BY "qualityGrade"
    ORDER BY avg DESC
  `);
  console.log('\n=== V4 Grade Distribution ===');
  grades.rows.forEach(r => {
    console.log(`  Grade ${r.qualitygrade}: ${r.count} personas, avg score ${Number(r.avg).toFixed(1)}`);
  });
}

function slugToName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error(err); pool.end(); process.exit(1); });
