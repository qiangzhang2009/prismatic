/**
 * Deploy V5 Distilled Personas to Neon Database
 *
 * Merges display data from personas.ts with V5 cognitive data from corpus/distilled/v5/*-v5.json
 *
 * Run: node scripts/deploy-v5-to-db.mjs
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V5_DIR = join(__dirname, '../corpus/distilled/v5');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

try {
  const { config } = await import('dotenv');
  config({ path: join(__dirname, '../.env') });
} catch (e) {}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function cuid() {
  const id = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `c_${timestamp}${id.substring(0, 16)}`;
}

// ─── Load display data from personas.ts ────────────────────────────────────────

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

// ─── Load V5 JSON files ────────────────────────────────────────────────────────

function loadV5Files() {
  const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));
  const personas = [];
  for (const file of files) {
    const slug = file.replace('-v5.json', '');
    const raw = readFileSync(join(V5_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    personas.push({ slug, data });
  }
  return personas;
}

// ─── Extract V5 data ─────────────────────────────────────────────────────────

function extractV5Data(slug, data) {
  const knowledge = data.knowledge || {};
  const persona = data.persona || {};
  const expr = data.expression || {};

  const mentalModels = JSON.stringify(
    ((knowledge.mentalModels || persona.mentalModels || [])).map(m => ({
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
    ((knowledge.decisionHeuristics || persona.decisionHeuristics || [])).map(h => ({
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
    ((knowledge.values || persona.values || [])).map(v => ({
      name: v.name || '',
      nameZh: v.nameZh || v.name || '',
      priority: v.priority || 0,
      description: v.description || '',
      descriptionZh: v.descriptionZh || v.description || '',
    }))
  );

  const tensions = JSON.stringify(
    ((knowledge.tensions || persona.tensions || [])).map(t => ({
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

  // blindspots: merge en+zh string arrays into objects
  const rawBlindspots = Array.isArray(knowledge.blindspots) ? knowledge.blindspots : [];
  const rawBlindspotsZh = Array.isArray(knowledge.blindspotsZh) ? knowledge.blindspotsZh : [];
  const blindspots = rawBlindspots.map((bs, i) => ({
    text: bs || '',
    textZh: rawBlindspotsZh[i] || bs || '',
    reason: '',
    reasonZh: '',
  }));

  // strengths: merge en+zh string arrays into objects
  const rawStrengths = Array.isArray(knowledge.strengths) ? knowledge.strengths : [];
  const rawStrengthsZh = Array.isArray(knowledge.strengthsZh) ? knowledge.strengthsZh : [];
  const strengths = rawStrengths.map((s, i) => ({
    text: s || '',
    textZh: rawStrengthsZh[i] || s || '',
    description: s || '',
    descriptionZh: rawStrengthsZh[i] || s || '',
  }));

  // antiPatterns: merge en+zh string arrays into objects
  const rawAntiPatterns = Array.isArray(knowledge.antiPatterns) ? knowledge.antiPatterns : [];
  const rawAntiPatternsZh = Array.isArray(knowledge.antiPatternsZh) ? knowledge.antiPatternsZh : [];
  const antiPatterns = rawAntiPatterns.map((ap, i) => ({
    text: ap || '',
    textZh: rawAntiPatternsZh[i] || ap || '',
    description: ap || '',
    descriptionZh: rawAntiPatternsZh[i] || ap || '',
  }));

  const score = data.score || {};
  const stats = data.meta?.corpusStats || {};

  return {
    mentalModels,
    decisionHeuristics,
    expressionDNA: JSON.stringify(exprDna),
    values,
    antiPatterns: JSON.stringify(antiPatterns),
    tensions,
    honestBoundaries,
    strengths: JSON.stringify(strengths),
    blindspots: JSON.stringify(blindspots),
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
    corpusSources: JSON.stringify((knowledge.sources || persona.sources || []).map(s => ({
      type: s.type || 'other',
      title: s.title || '',
      description: s.description || '',
    }))),
    keyQuotes: JSON.stringify(
      ((persona.mentalModels || knowledge.mentalModels || [])).flatMap(mm =>
        ((mm.evidence || []).slice(0, 3)).map(e => ({
          quote: e.quote || e.text || '',
          source: mm.nameZh || mm.name || '',
        }))
      ).filter(q => q.quote.length > 5).slice(0, 20)
    ),
    distillVersion: data.meta?.distillationVersion || 'v5',
    distillDate: data.meta?.createdAt || new Date().toISOString(),
  };
}

// ─── Upsert to DB ──────────────────────────────────────────────────────────────

async function upsertPersona(slug, display, v5) {
  const id = cuid();
  const sessionId = `v5-${slug}`;

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
    (v5.identityPrompt || '').substring(0, 1000),
    v5.briefZh || '',
    v5.mentalModels,
    v5.decisionHeuristics,
    v5.expressionDNA,
    v5.values,
    v5.antiPatterns,
    v5.tensions,
    v5.honestBoundaries,
    v5.strengths,
    v5.blindspots,
    v5.systemPromptTemplate,
    v5.identityPrompt,
    v5.reasoningStyle || null,
    v5.decisionFramework || null,
    v5.keyQuotes || '[]',
    v5.lifePhilosophy || null,
    v5.finalScore,
    v5.qualityGrade,
    v5.thresholdPassed,
    false,
    v5.scoreBreakdown,
    v5.scoreFindings,
    v5.corpusItemCount,
    v5.corpusTotalWords,
    v5.corpusSources || '[]',
    v5.distillVersion,
    v5.distillDate,
    true,
    true,
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== V5 Persona Database Deployment ===\n');

  console.log('Step 1: Loading display data from personas.ts...');
  const displayData = loadDisplayData();
  console.log(`  Loaded display data for ${Object.keys(displayData).length} personas\n`);

  console.log('Step 2: Loading v5 JSON files...');
  const v5Files = loadV5Files();
  console.log(`  Found ${v5Files.length} v5 files\n`);

  console.log('Step 3: Ensuring distill_sessions entries...');
  for (const { slug, data } of v5Files) {
    const sessionId = `v5-${slug}`;
    const name = data.persona?.name || data.knowledge?.identityPrompt?.split('.')[0] || displayData[slug]?.name || slugToName(slug);
    await pool.query(`
      INSERT INTO distill_sessions (id, "personaId", "personaName", "personaDomain", status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [sessionId, slug, name, displayData[slug]?.domain || 'philosophy']);
  }
  console.log('  Sessions ensured.\n');

  console.log('Step 4: Upserting personas...\n');
  const results = [];

  for (const { slug, data } of v5Files) {
    const display = displayData[slug] || {};
    const v5 = extractV5Data(slug, data);

    try {
      const result = await upsertPersona(slug, display, v5);
      const passed = (result.thresholdpassed || result.thresholdPassed || result['thresholdpassed']) ? '✓' : '✗';
      const score = result.finalscore ?? result.finalScore ?? result['finalscore'];
      const grade = result.qualitygrade ?? result.qualityGrade ?? result['qualitygrade'];
      const ver = result.distillversion ?? result.distillVersion ?? result['distillversion'];
      const nameZh = result.namezh ?? result.nameZh ?? result['namezh'] ?? '';
      console.log(
        `  ${passed} ${slug}: score=${score} grade=${grade} ` +
        `version=${ver} name="${result.name}" nameZh="${nameZh}"`
      );
      results.push({ slug, status: 'ok', score, grade });
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

  // Grade distribution
  const grades = await pool.query(`
    SELECT "qualityGrade", COUNT(*) as count, AVG("finalScore") as avg
    FROM distilled_personas
    WHERE "distillVersion" = 'v5'
    GROUP BY "qualityGrade"
    ORDER BY avg DESC
  `);
  console.log('\n=== V5 Grade Distribution ===');
  grades.rows.forEach(r => {
    console.log(`  Grade ${r.qualitygrade}: ${r.count} personas, avg score ${Number(r.avg).toFixed(1)}`);
  });

  // Total
  const total = await pool.query(`SELECT COUNT(*) as total, AVG("finalScore") as avg FROM distilled_personas WHERE "distillVersion" = 'v5'`);
  console.log(`\n  Total V5 personas: ${total.rows[0].total}, avg score: ${Number(total.rows[0].avg).toFixed(1)}`);
}

function slugToName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error(err); pool.end(); process.exit(1); });
