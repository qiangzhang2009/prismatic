/**
 * Direct sync: extract clean data from personas.ts and update DB records.
 * Run with: bun run scripts/sync-clean-personas-direct.ts
 *
 * This is simpler than parsing TypeScript — it imports the actual JS objects.
 *
 * Contamination detection includes:
 * - Medical terms (Ni Haixia contamination)
 * - Digital humanities terms (ctext.org/digital library contamination)
 * - Wrong-domain mental models (e.g., Greek philosophy for Chinese philosophers)
 */

import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as PERSONAS from '../src/lib/personas.ts';

config({ path: '.env.local' });

const IS_DRY_RUN = process.argv.includes('--dry-run');

// Medical terms — signals Ni Haixia / TCM contamination
const MEDICAL_TERMS = [
  '患者', '病人', '临床', '诊疗', '处方', '病历', '病房',
  '护士', '医院', '医疗', '医药', '症状', '诊断',
  '医者', '病家', '主诉', '依从性', '伤胃',
  '苦寒', '滋腻', '寒热并用', '攻补兼施', '君臣佐使',
  '热证', '虚证', '脾不统血', '血热妄行',
];

// Digital humanities / ctext.org terms — signals ctext scraper contamination
const DIGITAL_HUMANITIES_TERMS = [
  'open-access digital',
  'Chinese Text Project',
  'ctext.org',
  'AI-Assisted Translation',
  'Crowdsourced Correction',
  'Structured Entity Data',
  'Large-Scale Digitization',
  'Cross-Institutional Collaboration',
  'Unicode Compatibility',
  'Sustainability Through Subscription',
  'digital library',
  'digital humanities',
  '开放获取数字',
];

// Wrong-domain patterns — mental models that clearly don't belong
const WRONG_DOMAIN_PATTERNS = [
  // Greek/Western philosophy injected into Chinese philosophers
  { pattern: /Dichotomy of Control/i, badFor: ['mo-zi', 'confucius', 'lao-zi', 'zhuang-zi', 'han-fei-zi', 'sun-tzu'] },
  { pattern: /Wu Wei|Effortless Action/i, badFor: ['mo-zi', 'sun-tzu', 'han-fei-zi', 'confucius'] },
  { pattern: /Theory of Forms|Hegelian Dialectic|Amor Fati/i, badFor: ['mo-zi', 'confucius', 'zhuang-zi', 'lao-zi'] },
  { pattern: /Categorical Imperative|Golden Mean/i, badFor: ['mo-zi', 'zhuang-zi', 'han-fei-zi'] },
  // Chinese philosophy injected into Western figures
  { pattern: /兼爱|非攻|尚贤|节用|天志|明鬼/i, badFor: ['epictetus', 'seneca', 'marcus-aurelius', 'socrates'] },
  { pattern: /道可道|无为|道法自然/i, badFor: ['epictetus', 'seneca', 'marcus-aurelius'] },
  // ctext.org content for wrong personas
  { pattern: /ctext\.org|ctext-scraper/i, badFor: ['epictetus', 'seneca', 'marcus-aurelius', 'socrates', 'alan-watts', 'alan-turing', 'nassim-taleb'] },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

function isClean(obj: unknown): boolean {
  const s = JSON.stringify(obj);
  if (MEDICAL_TERMS.some(t => s.includes(t))) return false;
  if (DIGITAL_HUMANITIES_TERMS.some(t => s.includes(t))) return false;
  return true;
}

function checkWrongDomain(name: string, obj: unknown): string | null {
  const s = JSON.stringify(obj);
  for (const { pattern, badFor } of WRONG_DOMAIN_PATTERNS) {
    if (pattern.test(s) && badFor.includes(name)) {
      return `wrong-domain: pattern ${pattern} found in ${name}'s data`;
    }
  }
  return null;
}

function cleanArray(arr: unknown[]): string[] {
  return arr.map(a => typeof a === 'string' ? a : JSON.stringify(a));
}

async function main() {
  try {
    const result = await pool.query(`SELECT slug FROM distilled_personas WHERE "isActive" = true`);
    const dbSlugs = result.rows.map(r => r.slug);
    console.log(`Checking ${dbSlugs.length} DB records...\n`);

    let clean = 0, dirty = 0, synced = 0;

    for (const slug of dbSlugs.sort()) {
      const rows = await pool.query(`
        SELECT "mentalModels", "decisionHeuristics", "values",
               "antiPatterns", "tensions", "honestBoundaries",
               "strengths", "blindspots", "expressionDNA"
        FROM distilled_personas WHERE slug = $1 AND "isActive" = true LIMIT 1`, [slug]);

      if (!rows.rows.length) continue;
      const db = rows.rows[0];
      const allFields = [db.mentalModels, db.decisionHeuristics, db.values,
                        db.expressionDNA, db.antiPatterns, db.tensions,
                        db.honestBoundaries, db.strengths, db.blindspots];

      // Check contamination across all text fields
      const allFields = [db.mentalModels, db.decisionHeuristics, db.values,
                        db.expressionDNA, db.antiPatterns, db.tensions,
                        db.honestBoundaries, db.strengths, db.blindspots];
      const allFieldsStr = JSON.stringify(allFields);

      const hasMedical = MEDICAL_TERMS.some(t => allFieldsStr.includes(t));
      const hasDigitalHum = DIGITAL_HUMANITIES_TERMS.some(t => allFieldsStr.includes(t));
      const wrongDomain = checkWrongDomain(slug, allFields);

      if (!hasMedical && !hasDigitalHum && !wrongDomain) {
        clean++;
        console.log(`[CLEAN] ${slug}`);
        continue;
      }

      if (hasMedical) dirty++;
      if (hasDigitalHum) dirty++;
      if (wrongDomain) dirty++;
      console.log(`[DIRTY] ${slug}${wrongDomain ? ' | ' + wrongDomain : ''}${hasDigitalHum ? ' | digital-humanities-contamination' : ''}${hasMedical ? ' | medical-contamination' : ''}`);

      const code = (PERSONAS as any).PERSONAS?.[slug];
      if (!code || !code.mentalModels?.length) {
        console.log(`  -> SKIP: no matching code persona`);
        continue;
      }

      const codeDirty = !isClean(code) || checkWrongDomain(slug, code);
      if (codeDirty) {
        console.log(`  -> SKIP: code ALSO contaminated`);
        continue;
      }

      console.log(`  -> SYNC: ${code.mentalModels.length} mental models`);

      if (IS_DRY_RUN) {
        continue;
      }

      await pool.query(`
        UPDATE distilled_personas SET
          name = $2, "nameZh" = $3,
          tagline = $4, "taglineZh" = $5,
          brief = $6, "briefZh" = $7,
          "mentalModels" = $8,
          "decisionHeuristics" = $9,
          "expressionDNA" = $10,
          "values" = $11,
          "antiPatterns" = $12,
          "tensions" = $13,
          "honestBoundaries" = $14,
          "strengths" = $15,
          "blindspots" = $16,
          "systemPromptTemplate" = $17,
          "identityPrompt" = $18,
          "distillVersion" = $19,
          "distillDate" = NOW()
        WHERE slug = $1 AND "isActive" = true
      `, [
        slug,
        code.name || '',
        code.nameZh || '',
        code.tagline || '',
        code.taglineZh || '',
        code.brief || '',
        code.briefZh || '',
        JSON.stringify(code.mentalModels || []),
        JSON.stringify(code.decisionHeuristics || []),
        JSON.stringify(code.expressionDNA || {}),
        JSON.stringify(code.values || []),
        JSON.stringify(cleanArray(code.antiPatterns || [])),
        JSON.stringify(code.tensions || []),
        JSON.stringify(code.honestBoundaries || []),
        JSON.stringify(cleanArray(code.strengths || [])),
        JSON.stringify(cleanArray(code.blindspots || [])),
        code.systemPromptTemplate || '',
        code.identityPrompt || '',
        `code-sync-${new Date().toISOString().slice(0, 10)}`,
      ]);

      synced++;
    }

    console.log(`\n=== Results ===`);
    console.log(`Clean:  ${clean}`);
    console.log(`Dirty:  ${dirty}`);
    console.log(`Synced: ${synced}`);

  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
