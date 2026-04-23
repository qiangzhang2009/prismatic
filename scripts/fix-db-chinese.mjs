/**
 * Direct DB fix: update distilled_personas with correct Chinese fields
 * Reads from corpus/distilled/v4/*.json and src/lib/personas.ts
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
  console.log('=== Direct DB Fix: Full Chinese Fields ===\n');

  const displayData = loadDisplayData();
  console.log(`Loaded display data for ${Object.keys(displayData).length} personas\n`);

  const files = readdirSync(V4_DIR).filter(f => f.endsWith('-v4.json'));
  console.log(`Processing ${files.length} v4 files...\n`);

  let ok = 0, error = 0;

  for (const file of files) {
    const slug = file.replace('-v4.json', '');
    const d = JSON.parse(readFileSync(join(V4_DIR, file), 'utf-8'));
    const display = displayData[slug] || {};
    const k = d.knowledge || {};
    const p = d.persona || {};

    // mentalModels — knowledge layer has Chinese fields, persona layer may be English-only
    // Priority: knowledge (has *_Zh) > persona (English-only)
    const mentalModels = JSON.stringify(
      (k.mentalModels || p.mentalModels || []).map(m => ({
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

    // values — knowledge layer has descriptionZh, persona layer doesn't
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
      ]);

      // Verify
      const r = await pool.query(
        `SELECT "mentalModels", "taglineZh", "values" FROM distilled_personas WHERE slug = $1`,
        [slug]
      );
      const row = r.rows[0];
      const mm0 = row?.mentalModels?.[0];
      const zhOk = mm0?.oneLinerZh && /[\u4e00-\u9fff]/.test(mm0.oneLinerZh);
      const vals0 = row?.values?.[0];
      const valZhOk = vals0?.descriptionZh && /[\u4e00-\u9fff]/.test(vals0.descriptionZh);
      const tagOk = row?.taglineZh && /[\u4e00-\u9fff]/.test(row.taglineZh);

      const mark = zhOk && valZhOk && tagOk ? '✓' : '✗';
      console.log(`  ${mark} ${slug}: oneLinerZh=${zhOk?'✓':'✗'} taglineZh=${tagOk?'✓':'✗'} valZh=${valZhOk?'✓':'✗'}`);
      if (!zhOk) console.log(`      mm[0].oneLinerZh: ${mm0?.oneLinerZh?.slice(0,40) || 'MISSING'}`);
      if (!tagOk) console.log(`      taglineZh: ${row?.taglineZh || 'MISSING'}`);
      if (!valZhOk) console.log(`      val[0].descriptionZh: ${vals0?.descriptionZh?.slice(0,40) || 'MISSING'}`);

      ok++;
    } catch (err) {
      console.error(`  ✗ ERROR ${slug}: ${err.message}`);
      error++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  OK: ${ok}, Errors: ${error}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
