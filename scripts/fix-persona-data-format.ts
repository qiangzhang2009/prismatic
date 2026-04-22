/**
 * scripts/fix-persona-data-format.ts
 *
 * Migrates all persona data from "simplified" DB format to "full" TypeScript type format.
 * Uses a FRESH connection per persona to avoid Neon serverless timeout.
 */
import { neon } from '@neondatabase/serverless';
import { Pool } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function parseMaybeJson(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

function convertMentalModels(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'id' in item) return item;
    const text = typeof item === 'string' ? item : JSON.stringify(item);
    const parts = text.split(/[—–—]/).map(s => s.trim());
    const namePart = parts[0] || text;
    const nameZh = namePart.replace(/[（(].*[）)]/g, '').trim();
    return {
      id: slugify(nameZh) || `mm-${Math.floor(Math.random() * 9999)}`,
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

function convertDecisionHeuristics(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'id' in item) return item;
    const obj = typeof item === 'object' ? item as Record<string, unknown> : {};
    const nameZh = (obj.title as string) || (obj.nameZh as string) || String(item);
    return {
      id: slugify(nameZh) || `dh-${Math.floor(Math.random() * 9999)}`,
      name: nameZh,
      nameZh,
      description: (obj.description as string) || '',
      application: (obj.application as string) || '',
      example: '',
    };
  });
  return JSON.stringify(formatted);
}

function convertValues(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item, idx) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const nameZh = (obj.nameZh as string) || (obj.label as string) || (obj.name as string) || String(item);
      const name = (obj.name as string) || nameZh;
      return {
        name,
        nameZh,
        priority: typeof obj.priority === 'number' ? obj.priority : idx + 1,
        description: (obj.description as string) || '',
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

function convertTensions(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'dimension' in item) {
      const obj = item as Record<string, unknown>;
      return {
        dimension: obj.dimension as string || '',
        tensionZh: (obj.tensionZh as string) || (obj.dimension as string) || '',
        description: (obj.description as string) || '',
        descriptionZh: (obj.descriptionZh as string) || (obj.description as string) || '',
      };
    }
    const obj = typeof item === 'object' ? item as Record<string, unknown> : {};
    const dimA = (obj.dimensionA as string) || (obj.title as string) || '';
    const dimB = (obj.dimensionB as string) || '';
    const desc = (obj.description as string) || '';
    return {
      dimension: dimA && dimB ? `${dimA} vs ${dimB}` : (dimA || dimB || ''),
      tensionZh: dimA && dimB ? `${dimA} vs ${dimB}` : (dimA || dimB || ''),
      description: desc,
      descriptionZh: desc,
    };
  });
  return JSON.stringify(formatted);
}

function convertHonestBoundaries(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map((item) => {
    if (typeof item === 'object' && item !== null && 'text' in item) {
      const obj = item as Record<string, unknown>;
      return {
        text: (obj.text as string) || '',
        textZh: (obj.textZh as string) || (obj.title as string) || (obj.text as string) || '',
      };
    }
    const obj = typeof item === 'object' ? item as Record<string, unknown> : {};
    const text = (obj.title as string) || (obj.description as string) || String(item);
    return { text, textZh: text };
  });
  return JSON.stringify(formatted);
}

function convertExpressionDNA(raw: unknown): string {
  const obj = parseMaybeJson(raw);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return JSON.stringify({
      sentenceStyle: [], vocabulary: [], forbiddenWords: [],
      rhythm: '', humorStyle: '', certaintyLevel: 'medium',
      rhetoricalHabit: '', quotePatterns: [], chineseAdaptation: '',
    });
  }
  const record = obj as Record<string, unknown>;
  return JSON.stringify({
    sentenceStyle: Array.isArray(record.sentenceStyle) ? record.sentenceStyle : [],
    vocabulary: Array.isArray(record.vocabulary) ? record.vocabulary : [],
    forbiddenWords: Array.isArray(record.forbiddenWords) ? record.forbiddenWords : [],
    rhythm: typeof record.rhythm === 'string' ? record.rhythm : '',
    humorStyle: typeof record.humorStyle === 'string' ? record.humorStyle : '',
    certaintyLevel: (record.certaintyLevel as string) || 'medium',
    rhetoricalHabit: typeof record.rhetoricalHabit === 'string' ? record.rhetoricalHabit : '',
    quotePatterns: Array.isArray(record.quotePatterns) ? record.quotePatterns : [],
    chineseAdaptation: typeof record.chineseAdaptation === 'string' ? record.chineseAdaptation : '',
  });
}

function convertStrengthsBlindspots(raw: unknown): string {
  const arr = parseMaybeJson(raw);
  if (!Array.isArray(arr)) return '[]';
  const formatted = arr.map(s => {
    if (typeof s === 'string') return s;
    const obj = s as Record<string, unknown>;
    return (obj.label as string) || (obj.text as string) || (obj.name as string) || JSON.stringify(s);
  });
  return JSON.stringify(formatted);
}

// Fresh Pool per persona to avoid Neon serverless connection timeout
async function getPool() {
  const { Pool } = await import('@neondatabase/serverless');
  return new Pool({ connectionString: DATABASE_URL });
}

async function fixPersona(slug: string): Promise<boolean> {
  const pool = await getPool();
  try {
    const rows = await pool.query`SELECT * FROM distilled_personas WHERE slug = ${slug} AND "isActive" = true`;
    if (rows.rowCount === 0) return false;
    const row = rows.rows[0] as Record<string, unknown>;

    const mm = convertMentalModels(row.mentalModels);
    const dh = convertDecisionHeuristics(row.decisionHeuristics);
    const edna = convertExpressionDNA(row.expressionDNA);
    const vals = convertValues(row.values);
    const tens = convertTensions(row.tensions);
    const hb = convertHonestBoundaries(row.honestBoundaries);
    const strengths = convertStrengthsBlindspots(row.strengths);
    const blindspots = convertStrengthsBlindspots(row.blindspots);

    await pool.query`
      UPDATE distilled_personas SET
        "mentalModels" = ${mm}::jsonb,
        "decisionHeuristics" = ${dh}::jsonb,
        "expressionDNA" = ${edna}::jsonb,
        "values" = ${vals}::jsonb,
        "tensions" = ${tens}::jsonb,
        "honestBoundaries" = ${hb}::jsonb,
        "strengths" = ${strengths}::jsonb,
        "blindspots" = ${blindspots}::jsonb
      WHERE slug = ${slug}
    `;
    return true;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('Fixing persona data format...\n');

  // Get all slugs first with a fresh connection
  const getPool = await import('@neondatabase/serverless');
  const listPool = new getPool.Pool({ connectionString: DATABASE_URL });
  const rows = await listPool.query('SELECT slug FROM distilled_personas WHERE "isActive" = true ORDER BY "finalScore" DESC');
  await listPool.end();

  const slugs = rows.rows.map(r => (r as { slug: string }).slug);
  console.log(`Total personas: ${slugs.length}\n`);

  let fixed = 0, failed = 0;
  for (const slug of slugs) {
    process.stdout.write(`  ${slug.padEnd(25)}... `);
    try {
      const ok = await fixPersona(slug);
      if (ok) {
        console.log('✓');
        fixed++;
      } else {
        console.log('skip');
      }
    } catch (e: unknown) {
      console.error(`✗ ${(e as Error)?.message?.split('\n')[0]}`);
      failed++;
    }
    // Small delay between connections to avoid overwhelming Neon
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone. Fixed: ${fixed}, Failed: ${failed}`);

  // Verify
  console.log('\n--- Verification ---');
  const verifyPool = await getPool();
  for (const slug of ['wittgenstein', 'elon-musk', 'jiqun', 'socrates']) {
    const r = await verifyPool.query`SELECT slug, "mentalModels", "decisionHeuristics", "values", "tensions" FROM distilled_personas WHERE slug = ${slug}`;
    if (!r.rows[0]) continue;
    const row = r.rows[0] as Record<string, unknown>;
    const mm = parseMaybeJson(row.mentalModels);
    const dh = parseMaybeJson(row.decisionHeuristics);
    const vals = parseMaybeJson(row.values);
    const tens = parseMaybeJson(row.tensions);
    const firstMM = (mm as any[])?.[0];
    const firstDH = (dh as any[])?.[0];
    console.log(`  ${slug}:`);
    console.log(`    mentalModels: ${Array.isArray(mm) ? mm.length + ' items, first.id=' + (firstMM?.id || '?') : '?'}`);
    console.log(`    decisionHeuristics: ${Array.isArray(dh) ? dh.length + ' items, first.id=' + (firstDH?.id || '?') : '?'}`);
    console.log(`    values: ${Array.isArray(vals) ? vals.length + ' items' : '?'}`);
    console.log(`    tensions: ${Array.isArray(tens) ? tens.length + ' items' : '?'}`);
  }
  await verifyPool.end();
}

main().catch(console.error);
