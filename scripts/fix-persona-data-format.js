#!/usr/bin/env node
/**
 * scripts/fix-persona-data-format.js
 * Migrates all persona data from "simplified" DB format to "full" TypeScript type format.
 * Uses a FRESH connection per persona to avoid Neon serverless connection timeout.
 */
const { neon } = require('@neondatabase/serverless');
const { Pool } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function parseMaybeJson(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

function convertMentalModels(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'id' in item) return item;
    const text = typeof item === 'string' ? item : JSON.stringify(item);
    const parts = text.split(/[—–—]/).map(s => s.trim());
    const namePart = parts[0] || text;
    const nameZh = namePart.replace(/[（(].*[）)]/g, '').trim();
    return {
      id: slugify(nameZh) || `mm-${Math.floor(Math.random() * 99999)}`,
      name: nameZh,
      nameZh,
      oneLiner: parts[1] || nameZh,
      evidence: [],
      crossDomain: [],
      application: '',
      limitation: '',
    };
  });
  return JSON.stringify(formatted);
}

function convertDecisionHeuristics(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'id' in item) return item;
    const obj = typeof item === 'object' ? item : {};
    const nameZh = obj.title || obj.nameZh || String(item);
    return {
      id: slugify(nameZh) || `dh-${Math.floor(Math.random() * 99999)}`,
      name: nameZh,
      nameZh,
      description: obj.description || '',
      application: obj.application || '',
      example: '',
    };
  });
  return JSON.stringify(formatted);
}

function convertValues(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item, idx) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item;
      const nameZh = obj.nameZh || obj.label || obj.name || String(item);
      const name = obj.name || nameZh;
      return {
        name,
        nameZh,
        priority: typeof obj.priority === 'number' ? obj.priority : idx + 1,
        description: obj.description || '',
      };
    }
    const text = String(item);
    return {
      name: text.replace(/[（(].*[）)]/g, '').trim(),
      nameZh: text,
      priority: idx + 1,
      description: '',
    };
  });
  return JSON.stringify(formatted);
}

function convertTensions(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'dimension' in item) {
      const obj = item;
      return {
        dimension: obj.dimension || '',
        tensionZh: obj.tensionZh || obj.dimension || '',
        description: obj.description || '',
        descriptionZh: obj.descriptionZh || obj.description || '',
      };
    }
    const obj = typeof item === 'object' ? item : {};
    const dimA = obj.dimensionA || obj.title || '';
    const dimB = obj.dimensionB || '';
    const desc = obj.description || '';
    return {
      dimension: dimA && dimB ? `${dimA} vs ${dimB}` : (dimA || dimB || ''),
      tensionZh: dimA && dimB ? `${dimA} vs ${dimB}` : (dimA || dimB || ''),
      description: desc,
      descriptionZh: desc,
    };
  });
  return JSON.stringify(formatted);
}

function convertHonestBoundaries(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'text' in item) {
      const obj = item;
      return {
        text: obj.text || '',
        textZh: obj.textZh || obj.title || obj.text || '',
      };
    }
    const obj = typeof item === 'object' ? item : {};
    const text = obj.title || obj.description || String(item);
    return { text, textZh: text };
  });
  return JSON.stringify(formatted);
}

function convertExpressionDNA(raw) {
  const obj = parseMaybeJson(raw);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return JSON.stringify({
      sentenceStyle: [], vocabulary: [], forbiddenWords: [],
      rhythm: '', humorStyle: '', certaintyLevel: 'medium',
      rhetoricalHabit: '', quotePatterns: [], chineseAdaptation: '',
    });
  }
  return JSON.stringify({
    sentenceStyle: Array.isArray(obj.sentenceStyle) ? obj.sentenceStyle : [],
    vocabulary: Array.isArray(obj.vocabulary) ? obj.vocabulary : [],
    forbiddenWords: Array.isArray(obj.forbiddenWords) ? obj.forbiddenWords : [],
    rhythm: typeof obj.rhythm === 'string' ? obj.rhythm : '',
    humorStyle: typeof obj.humorStyle === 'string' ? obj.humorStyle : '',
    certaintyLevel: obj.certaintyLevel || 'medium',
    rhetoricalHabit: typeof obj.rhetoricalHabit === 'string' ? obj.rhetoricalHabit : '',
    quotePatterns: Array.isArray(obj.quotePatterns) ? obj.quotePatterns : [],
    chineseAdaptation: typeof obj.chineseAdaptation === 'string' ? obj.chineseAdaptation : '',
  });
}

function convertArrayField(raw) {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map(s => {
    if (typeof s === 'string') return s;
    return s.label || s.text || s.name || JSON.stringify(s);
  });
  return JSON.stringify(formatted);
}

async function fixPersona(slug) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await pool.query('SELECT * FROM distilled_personas WHERE slug = $1 AND "isActive" = true', [slug]);
    if (result.rowCount === 0) return false;
    const row = result.rows[0];

    const mm = convertMentalModels(row.mentalModels);
    const dh = convertDecisionHeuristics(row.decisionHeuristics);
    const edna = convertExpressionDNA(row.expressionDNA);
    const vals = convertValues(row.values);
    const tens = convertTensions(row.tensions);
    const hb = convertHonestBoundaries(row.honestBoundaries);
    const strengths = convertArrayField(row.strengths);
    const blindspots = convertArrayField(row.blindspots);

    await pool.query(
      `UPDATE distilled_personas SET
        "mentalModels" = $1::jsonb,
        "decisionHeuristics" = $2::jsonb,
        "expressionDNA" = $3::jsonb,
        "values" = $4::jsonb,
        "tensions" = $5::jsonb,
        "honestBoundaries" = $6::jsonb,
        "strengths" = $7::jsonb,
        "blindspots" = $8::jsonb
      WHERE slug = $9`,
      [mm, dh, edna, vals, tens, hb, strengths, blindspots, slug]
    );
    return true;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('Fixing persona data format...\n');

  // Get all slugs
  const listPool = new Pool({ connectionString: DATABASE_URL });
  const result = await listPool.query('SELECT slug FROM distilled_personas WHERE "isActive" = true ORDER BY "finalScore" DESC');
  await listPool.end();

  const slugs = result.rows.map(r => r.slug);
  console.log(`Total personas: ${slugs.length}\n`);

  let fixed = 0, failed = 0;
  for (const slug of slugs) {
    process.stdout.write(`  ${slug.padEnd(25)}... `);
    try {
      const ok = await fixPersona(slug);
      console.log(ok ? '✓' : 'skip');
      if (ok) fixed++;
    } catch (e) {
      console.error(`✗ ${e.message.split('\n')[0]}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone. Fixed: ${fixed}, Failed: ${failed}`);

  // Verify
  console.log('\n--- Verification ---');
  const vPool = new Pool({ connectionString: DATABASE_URL });
  for (const slug of ['wittgenstein', 'elon-musk', 'jiqun', 'socrates']) {
    const r = await vPool.query('SELECT slug, "mentalModels", "decisionHeuristics", "values", "tensions" FROM distilled_personas WHERE slug = $1', [slug]);
    if (!r.rows[0]) continue;
    const row = r.rows[0];
    const mm = parseMaybeJson(row.mentalModels);
    const dh = parseMaybeJson(row.decisionHeuristics);
    const vals = parseMaybeJson(row.values);
    const tens = parseMaybeJson(row.tensions);
    const firstMM = Array.isArray(mm) ? mm[0] : null;
    const firstDH = Array.isArray(dh) ? dh[0] : null;
    console.log(`  ${slug}:`);
    console.log(`    mentalModels: ${Array.isArray(mm) ? mm.length + ' items, first.id=' + (firstMM?.id || '?') : '?'}`);
    console.log(`    decisionHeuristics: ${Array.isArray(dh) ? dh.length + ' items, first.id=' + (firstDH?.id || '?') : '?'}`);
    console.log(`    values: ${Array.isArray(vals) ? vals.length + ' items' : '?'}`);
    console.log(`    tensions: ${Array.isArray(tens) ? tens.length + ' items' : '?'}`);
  }
  await vPool.end();
}

main().catch(console.error);
