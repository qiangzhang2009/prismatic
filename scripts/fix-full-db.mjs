/**
 * Full DB fix: populate expressionDNA for all 41 v4 personas
 * The ON CONFLICT in deploy-v4-to-db.mjs was only updating distillDate/isPublished,
 * not the content fields. This script does direct UPDATE for all.
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V4_DIR = join(__dirname, '../corpus/distilled/v4');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Display data parser ──────────────────────────────────────────────────────

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
      briefZh: extractField('briefZh'),
      accentColor: extractField('accentColor') || '#6366f1',
      gradientFrom: extractField('gradientFrom') || '#6366f1',
      gradientTo: extractField('gradientTo') || '#8b5cf6',
    };
  }

  return result;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Full DB Fix: expressionDNA + all fields ===\n');

  const displayData = loadDisplayData();
  const files = readdirSync(V4_DIR).filter(f => f.endsWith('-v4.json'));
  console.log(`Processing ${files.length} v4 files...\n`);

  let ok = 0, empty = 0;

  for (const file of files) {
    const slug = file.replace('-v4.json', '');
    const d = JSON.parse(readFileSync(join(V4_DIR, file), 'utf-8'));
    const display = displayData[slug] || {};
    const k = d.knowledge || {};
    const p = d.persona || {};

    // expressionDNA
    const expr = d.expression || {};
    const expressionDNA = JSON.stringify({
      sentenceStyle: Array.isArray(expr.sentenceStyle) ? expr.sentenceStyle : [],
      vocabulary: Array.isArray(expr.vocabulary) ? expr.vocabulary : [],
      forbiddenWords: Array.isArray(expr.forbiddenWords) ? expr.forbiddenWords : [],
      rhythm: expr.rhythm || '',
      tone: expr.tone || 'formal',
      certaintyLevel: expr.certaintyLevel || 'medium',
      rhetoricalHabit: expr.rhetoricalHabit || '',
      quotePatterns: Array.isArray(expr.quotePatterns) ? expr.quotePatterns : [],
      chineseAdaptation: expr.chineseAdaptation || '',
      verbalMarkers: Array.isArray(expr.verbalMarkers) ? expr.verbalMarkers : [],
      speakingStyle: expr.speakingStyle || '',
    });

    // mentalModels
    const mentalModels = JSON.stringify(
      ((k.mentalModels || p.mentalModels || [])).map(m => ({
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

    // decisionHeuristics
    const decisionHeuristics = JSON.stringify(
      ((k.decisionHeuristics || p.decisionHeuristics || [])).map(h => ({
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

    // values
    const values = JSON.stringify(
      ((k.values || p.values || [])).map(v => ({
        name: v.name || '',
        nameZh: v.nameZh || v.name || '',
        priority: v.priority || 0,
        description: v.description || '',
        descriptionZh: v.descriptionZh || v.description || '',
      }))
    );

    // tensions
    const tensions = JSON.stringify(
      ((k.tensions || p.tensions || [])).map(t => ({
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

    // Check expressionDNA has data
    const exprData = JSON.parse(expressionDNA);
    const hasVocab = exprData.vocabulary && exprData.vocabulary.length > 0;
    const hasStyle = exprData.sentenceStyle && exprData.sentenceStyle.length > 0;

    if (!hasVocab || !hasStyle) {
      console.log(`  ✗ ${slug}: expressionDNA empty (vocab=${exprData.vocabulary?.length}, style=${exprData.sentenceStyle?.length})`);
      empty++;
    }

    try {
      await pool.query(`
        UPDATE distilled_personas SET
          "namezh" = $2,
          "tagline" = $3,
          "taglineZh" = $4,
          "accentColor" = $5,
          "gradientFrom" = $6,
          "gradientTo" = $7,
          "briefZh" = $8,
          "mentalModels" = $9,
          "decisionHeuristics" = $10,
          "values" = $11,
          "expressionDNA" = $12,
          "tensions" = $13,
          "distillVersion" = $14,
          "updatedAt" = NOW()
        WHERE slug = $1
      `, [
        slug,
        display.nameZh || display.name || slug,
        display.tagline || display.name || slug,
        display.taglineZh || '',
        display.accentColor || '#6366f1',
        display.gradientFrom || '#6366f1',
        display.gradientTo || '#8b5cf6',
        display.briefZh || '',
        mentalModels,
        decisionHeuristics,
        values,
        expressionDNA,
        tensions,
        'v4',
      ]);

      // Verify
      const r = await pool.query(
        `SELECT "mentalModels", "taglineZh", "values", "expressionDNA" FROM distilled_personas WHERE slug = $1`,
        [slug]
      );
      const row = r.rows[0];
      const mm0 = row?.mentalModels?.[0];
      const mmZh = mm0?.oneLinerZh && /[\u4e00-\u9fff]/.test(mm0.oneLinerZh);
      const vals0 = row?.values?.[0];
      const valZh = vals0?.descriptionZh && /[\u4e00-\u9fff]/.test(vals0.descriptionZh);
      const tagZh = row?.taglineZh && /[\u4e00-\u9fff]/.test(row.taglineZh);
      const vocabLen = row?.expressionDNA?.vocabulary?.length || 0;
      const styleLen = row?.expressionDNA?.sentenceStyle?.length || 0;
      const exprOk = vocabLen > 0 && styleLen > 0;

      const mark = (mmZh && valZh && tagZh && exprOk) ? '✓' : '✗';
      const markExpr = exprOk ? '✓' : '✗';
      console.log(`  ${mark} ${slug}: exprDNA=${markExpr}(vocab=${vocabLen},style=${styleLen}) oneLinerZh=${mmZh?'✓':'✗'} taglineZh=${tagZh?'✓':'✗'} valZh=${valZh?'✓':'✗'}`);

      ok++;
    } catch (err) {
      console.error(`  ERROR ${slug}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Processed: ${ok}, expressionDNA empty in source: ${empty}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
