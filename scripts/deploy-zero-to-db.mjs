/**
 * Deploy Zero Distilled Personas to Neon Database
 *
 * Strategy: Merge from two sources:
 *   1. Existing personas.ts code — for nameZh, nameEn, accentColor, gradientFrom, gradientTo, domain
 *   2. corpus/distilled/zero/*-zero.json — for all cognitive data, scores, system prompts
 *
 * Version: zero
 *
 * Run: node scripts/deploy-zero-to-db.mjs
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZERO_DIR = join(__dirname, '../corpus/distilled/zero');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

// Slugs that are collections, literary works, or non-human entities — skip deployment
const NON_PERSONA_SLUGS = new Set([
  'greek-classics', 'chinese-classics', 'quantangshi',
  'three-kingdoms', 'journey-west', 'tripitaka',
  'sun-wukong', 'zhu-bajie',
]);

try {
  const { config } = await import('dotenv');
  config({ path: join(__dirname, '../.env') });
} catch (e) {}

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
      if (m[1] !== undefined) {
        return (m[1].match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, ''));
      }
      return m[2] || m[3] || null;
    };

    const domains = extractField('domain');
    result[slug] = {
      name: extractField('name'),
      nameZh: extractField('nameZh'),
      nameEn: extractField('nameEn'),
      domain: Array.isArray(domains) ? domains.join(',') : 'philosophy',
      tagline: extractField('tagline'),
      taglineZh: extractField('taglineZh'),
      avatar: extractField('avatar'),
      accentColor: extractField('accentColor') || '#6366f1',
      gradientFrom: extractField('gradientFrom') || '#6366f1',
      gradientTo: extractField('gradientTo') || '#8b5cf6',
      brief: extractField('brief'),
      briefZh: extractField('briefZh'),
    };
  }

  return result;
}

const SLUG_MAP = { laozi: 'lao-zi', zhuangzi: 'zhuang-zi' };

function resolveSlug(s) { return SLUG_MAP[s] ?? s; }

// ─── Step 2: Load zero JSON files ─────────────────────────────────────────────

function loadZeroFiles() {
  const files = readdirSync(ZERO_DIR).filter(f => f.endsWith('-zero.json'));
  const personas = [];
  for (const file of files) {
    const zeroSlug = file.replace('-zero.json', '');
    // Skip non-persona slugs (collections, literary works)
    if (NON_PERSONA_SLUGS.has(zeroSlug)) {
      console.log(`  [SKIP] ${zeroSlug} — collection/non-persona`);
      continue;
    }
    const slug = resolveSlug(zeroSlug);
    const raw = readFileSync(join(ZERO_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    personas.push({ slug, data });
  }
  return personas;
}

// ─── Step 3: Extract from zero JSON ───────────────────────────────────────────

function extractZeroData(slug, data) {
  const knowledge = data.knowledge || {};
  const meta = data.meta || {};
  const expr = data.expression || {};
  const score = data.score || {};

  // ── Persona Identity ──
  // Priority: meta.nameZh > meta.name > slug
  // These are used by upsertPersona as authoritative name sources
  const personaName = meta.nameZh || meta.name || slug;
  const personaNameEn = meta.name || slug;

  // Helper: only set a _Zh field if the value actually contains Chinese characters.
  // Prevents English content from being copied into Chinese fields.
  const zh = (v) => (typeof v === 'string' && /[\u4e00-\u9fa5]/.test(v)) ? v : '';

  // ── Mental Models ──
  const mentalModels = JSON.stringify(
    ((knowledge.mentalModels || [])).map(m => ({
      id: m.id || '',
      name: m.name || m.nameZh || '',
      nameZh: zh(m.nameZh) || '',
      oneLiner: m.oneLiner || '',
      oneLinerZh: zh(m.oneLinerZh),
      evidence: (m.evidence || []).map(e => ({
        quote: e.quote || '',
        source: e.source || '',
        year: e.year || null,
        context: e.context || '',
      })),
      crossDomain: m.crossDomain || [],
      application: m.application || '',
      applicationZh: zh(m.applicationZh),
      limitation: m.limitations || m.limitations || '',
      limitationZh: zh(m.limitations),
    }))
  );

  // ── Decision Heuristics ──
  const decisionHeuristics = JSON.stringify(
    ((knowledge.decisionHeuristics || [])).map(h => ({
      id: h.id || '',
      name: h.name || h.nameZh || '',
      nameZh: zh(h.nameZh) || '',
      description: h.description || '',
      descriptionZh: zh(h.descriptionZh),
      application: h.applicationScenario || h.application || '',
      applicationZh: zh(h.applicationZh),
      example: h.example || '',
      exampleZh: zh(h.exampleZh),
    }))
  );

  // ── ExpressionDNA ──
  // zero output: vocabulary is an object with nested arrays
  // DB expects: flat arrays + nested objects for other fields
  const vocab = expr.vocabulary || {};
  const exprDna = {
    sentenceStyle: Array.isArray(expr.sentenceStyles)
      ? expr.sentenceStyles.map(s => `${s.pattern}: ${s.description}`)
      : [],
    vocabulary: vocab.topWords
      ? vocab.topWords.slice(0, 50).map(w => typeof w === 'string' ? w : w.word)
      : [],
    forbiddenWords: Array.isArray(expr.forbiddenWords)
      ? expr.forbiddenWords.map(fw => fw.word || fw)
      : [],
    rhythm: typeof expr.rhythm === 'string' ? expr.rhythm : (expr.rhythm?.description || ''),
    humorStyle: '',
    certaintyLevel: expr.certaintyProfile?.level || 'medium',
    rhetoricalHabit: Array.isArray(expr.rhetoricalHabits)
      ? expr.rhetoricalHabits.map(rh => `${rh.habit}: ${rh.description}`).join('; ')
      : '',
    quotePatterns: Array.isArray(expr.quotePatterns)
      ? expr.quotePatterns.map(qp => `${qp.pattern}: ${qp.description}`)
      : [],
    chineseAdaptation: '',
    verbalMarkers: Array.isArray(expr.verbalMarkers)
      ? expr.verbalMarkers.map(vm => vm.marker || vm)
      : [],
    speakingStyle: typeof expr.speakingStyle === 'string'
      ? expr.speakingStyle
      : (expr.speakingStyle?.summary || ''),
    tone: expr.tone?.dominant || 'formal',
  };

  // ── Values ──
  const values = JSON.stringify(
    ((knowledge.values || [])).map(v => ({
      name: v.name || '',
      nameZh: v.nameZh || v.name || '',
      priority: v.priority || 0,
      description: v.description || '',
      descriptionZh: v.description || '',
    }))
  );

  // ── Tensions ──
  const tensions = JSON.stringify(
    ((knowledge.tensions || [])).map(t => ({
      dimension: t.dimension || '',
      dimensionZh: t.dimension || '',
      tension: t.dimension || '',
      tensionZh: t.dimension || '',
      positivePole: t.positivePole || '',
      negativePole: t.negativePole || '',
      description: t.description || '',
      descriptionZh: t.description || '',
    }))
  );

  // ── AntiPatterns ──
  const antiPatterns = JSON.stringify(
    Array.isArray(knowledge.antiPatterns)
      ? knowledge.antiPatterns.map(ap => ({
        text: ap.description || ap.id || '',
        textZh: ap.description || ap.id || '',
        description: ap.description || '',
        descriptionZh: ap.description || '',
      }))
      : []
  );

  // ── Honest Boundaries ──
  const honestBoundaries = JSON.stringify(
    ((knowledge.honestBoundaries || [])).map(h => ({
      text: h.description || '',
      textZh: h.description || '',
      reason: h.reason || '',
      reasonZh: h.reason || '',
    }))
  );

  // ── Strengths & Blindspots ──
  // Raw strengths/blindspots are English strings from the distillation engine.
  // Map to objects: text=English (original), textZh='' (no Chinese available).
  const strengths = JSON.stringify(
    Array.isArray(knowledge.strengths)
      ? knowledge.strengths.map(s => {
          const text = typeof s === 'string' ? s : (s.text || s.description || '');
          return { text, textZh: '', description: text, descriptionZh: '' };
        })
      : []
  );
  const blindspots = JSON.stringify(
    Array.isArray(knowledge.blindspots)
      ? knowledge.blindspots.map(s => {
          const text = typeof s === 'string' ? s : (s.text || s.description || '');
          return { text, textZh: '', reason: '', reasonZh: '' };
        })
      : []
  );

  // ── Sources ──
  const corpusSources = JSON.stringify(
    ((knowledge.sources || [])).map(s => ({
      type: s.type || 'other',
      title: s.title || '',
      description: s.title || '',
    }))
  );

  // ── Identity ──
  const identity = knowledge.identity || {};
  // taglineZh: distill from meta.taglineZh, fall back to Chinese tagline in meta.tagline
  const rawTagline = meta.taglineZh || meta.tagline || '';
  const taglineZh = rawTagline.substring(0, 200);
  // briefZh: prefer meta.briefZh (always Chinese in zero JSON), fall back to identity.oneLineSummary
  // Never use English-only content for briefZh
  const rawBrief = (meta.briefZh && /[\u4e00-\u9fa5]/.test(meta.briefZh))
    ? meta.briefZh
    : identity.oneLineSummary || '';
  const briefZh = rawBrief.substring(0, 500);

  // ── Score ──
  // Compute final score from the actual ScoreBreakdown using the same weights as scorer.ts
  // Weights: voice 30%, knowledge 30%, reasoning 25%, safety 15%
  const scoreBreakdown = data.score || {};
  const voiceOverall = scoreBreakdown.voice?.overall ?? 0;
  const knowledgeOverall = scoreBreakdown.knowledge?.overall ?? 0;
  const reasoningOverall = scoreBreakdown.reasoning?.overall ?? 0;
  const safetyOverall = scoreBreakdown.safety?.overall ?? 0;
  const finalScore = Math.round(
    voiceOverall * 0.3 +
    knowledgeOverall * 0.3 +
    reasoningOverall * 0.25 +
    safetyOverall * 0.15
  );
  const grade = (() => {
    if (finalScore >= 90) return 'A';
    if (finalScore >= 75) return 'B';
    if (finalScore >= 60) return 'C';
    if (finalScore >= 45) return 'D';
    return 'F';
  })();

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
    identityPrompt: (identity.identityPrompt || meta.brief || '').substring(0, 2000),
    systemPromptTemplate: (data.systemPrompt || []).map(b => `[${b.role}] ${b.content}`).join('\n\n'),
    taglineZh,
    briefZh,
    finalScore,
    qualityGrade: grade,
    thresholdPassed: finalScore >= 75,
    scoreBreakdown: JSON.stringify(scoreBreakdown),
    scoreFindings: JSON.stringify(data.findings || []),
    corpusItemCount: data.corpusReport?.totalFiles || 0,
    corpusTotalWords: data.corpusReport?.totalWordCount || 0,
    corpusSources,
    keyQuotes: JSON.stringify([]),
    distillVersion: 'zero-v1',
    distillDate: data.distillationDate || new Date().toISOString(),
    personaName,
    personaNameEn,
  };
}

// ─── Step 4: Upsert to DB ───────────────────────────────────────────────────

async function upsertPersona(slug, display, zero) {
  const id = cuid();
  const sessionId = `zero-${slug}`;

  const query = `
    INSERT INTO distilled_personas (
      id, "sessionId", "slug", "name", "nameZh", "nameEn", "domain",
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
      "nameZh" = EXCLUDED."nameZh",
      "nameEn" = EXCLUDED."nameEn",
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
    RETURNING "slug", "name", "nameZh", "finalScore", "qualityGrade", "thresholdPassed", "distillVersion"
  `;

  const params = [
    id, sessionId, slug,
    display.name || zero.personaName || slug,
    display.nameZh || zero.personaName || '',
    display.nameEn || zero.personaNameEn || display.name || slug,
    display.domain || 'philosophy',
    display.tagline || display.name || '',
    display.taglineZh || zero.taglineZh || '',
    display.avatar || null,
    display.accentColor || '#6366f1',
    display.gradientFrom || '#6366f1',
    display.gradientTo || '#8b5cf6',
    display.brief || '',
    zero.briefZh,
    zero.mentalModels,
    zero.decisionHeuristics,
    zero.expressionDNA,
    zero.values,
    zero.antiPatterns,
    zero.tensions,
    zero.honestBoundaries,
    zero.strengths,
    zero.blindspots,
    zero.systemPromptTemplate,
    zero.identityPrompt,
    null, null, zero.keyQuotes, null,
    zero.finalScore,
    zero.qualityGrade,
    zero.thresholdPassed,
    false,
    zero.scoreBreakdown,
    zero.scoreFindings,
    zero.corpusItemCount,
    zero.corpusTotalWords,
    zero.corpusSources,
    zero.distillVersion,
    zero.distillDate,
    true,
    true,
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
}

// ─── Step 5: Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Zero Persona Database Deployment ===\n');

  console.log('Step 1: Loading display data from personas.ts...');
  const displayData = loadDisplayData();
  console.log(`  Loaded display data for ${Object.keys(displayData).length} personas\n`);

  console.log('Step 2: Loading zero JSON files...');
  const zeroFiles = loadZeroFiles();
  console.log(`  Found ${zeroFiles.length} zero files\n`);

  console.log('Step 3: Ensuring distill_sessions entries...');
  for (const { slug, data } of zeroFiles) {
    const sessionId = `zero-${slug}`;
    const name = data.meta?.name || data.meta?.nameZh || displayData[slug]?.name || slugToName(slug);
    await pool.query(`
      INSERT INTO distill_sessions (id, "personaId", "personaName", "personaDomain", status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [sessionId, slug, name, displayData[slug]?.domain || 'philosophy']);
  }
  console.log('  Sessions ensured.\n');

  console.log('Step 4: Upserting personas...\n');
  const results = [];

  for (const { slug, data } of zeroFiles) {
    const display = displayData[slug] || {};
    const zero = extractZeroData(slug, data);

    try {
      const result = await upsertPersona(slug, display, zero);
      const passed = result.thresholdPassed ? '✓' : '✗';
      console.log(
        `  ${passed} ${slug}: score=${result.finalScore} grade=${result.qualityGrade} ` +
        `version=${result.distillVersion} name="${result.name}" nameZh="${result.nameZh || ''}"`
      );
      results.push({ slug, status: 'ok', score: result.finalScore, grade: result.qualityGrade });
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
  console.log('\n=== Verification ===');
  const slugs = ok.slice(0, 6).map(r => r.slug);
  if (slugs.length > 0) {
    const verify = await pool.query(`
      SELECT "slug", "name", "nameZh", "finalScore", "qualityGrade",
             "thresholdPassed", "distillVersion", "corpusTotalWords"
      FROM distilled_personas
      WHERE "slug" = ANY($1)
      ORDER BY "finalScore" DESC
    `, [slugs]);
    verify.rows.forEach(r => {
      console.log(
        `  ${r.slug}: name="${r.name}" nameZh="${r.nameZh}" score=${r.finalScore} ` +
        `grade=${r.qualityGrade} v=${r.distillVersion} words=${r.corpusTotalWords}`
      );
    });
  }

  // Grade distribution
  const grades = await pool.query(`
    SELECT "qualityGrade", COUNT(*) as count, AVG("finalScore") as avg
    FROM distilled_personas
    WHERE "distillVersion" = 'zero-v1'
    GROUP BY "qualityGrade"
    ORDER BY avg DESC
  `);
  console.log('\n=== Zero Grade Distribution ===');
  if (grades.rows.length === 0) {
    console.log('  (no zero-v1 personas yet)');
  } else {
    grades.rows.forEach(r => {
      console.log(`  Grade ${r.qualityGrade}: ${r.count} personas, avg score ${Number(r.avg).toFixed(1)}`);
    });
  }

  // Total
  const total = await pool.query(`SELECT COUNT(*) as total, AVG("finalScore") as avg FROM distilled_personas WHERE "distillVersion" = 'zero-v1'`);
  console.log(`\n  Total Zero personas: ${total.rows[0].total}, avg score: ${Number(total.rows[0].avg).toFixed(1)}`);

  await pool.end();
}

function slugToName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
