#!/usr/bin/env node
/**
 * Fix all nameZh fields in v5 corpus files to use Chinese names from personas.ts.
 * Root cause: v5 distillation pipeline copied English names into nameZh instead of Chinese.
 * Fix: Extract correct nameZh from src/lib/personas.ts and overwrite v5 files.
 *
 * Also updates the DB via Neon Pool connection.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V5_DIR = join(__dirname, '../corpus/distilled/v5');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

// ─── Extract nameZh from personas.ts ─────────────────────────────────────────
// Persona entries are: PERSONAS['slug'] = { ... }
function loadPersonasNameZh() {
  const content = readFileSync(PERSONAS_FILE, 'utf8');
  const result = {};

  // Match each PERSONAS entry
  const entryRegex = /PERSONAS\['([^']+)'\]\s*=\s*\{/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    const slug = match[1];
    const searchStart = match.index + match[0].length;
    const nextEntry = content.indexOf("\nPERSONAS['", searchStart);
    const entryEnd = nextEntry === -1 ? content.length : nextEntry;
    const entryBlock = content.slice(searchStart, entryEnd);

    // Extract nameZh — it may be in quotes or backticks
    // e.g., nameZh: '史蒂夫·乔布斯' or nameZh: `史蒂夫·乔布斯`
    const zhMatch = entryBlock.match(/nameZh:\s*(?:['`"])([^'`"]+)(?:['`"])/);
    if (zhMatch) {
      result[slug] = zhMatch[1];
    } else {
      // Fallback: try nameEn or name field
      const nameMatch = entryBlock.match(/name:\s*(?:['`"])([^'`"]+)(?:['`"])/);
      if (nameMatch) result[slug] = nameMatch[1];
    }
  }

  return result;
}

const NAME_ZH_MAP = loadPersonasNameZh();
console.log(`Loaded ${Object.keys(NAME_ZH_MAP).length} nameZh entries from personas.ts\n`);

// ─── Fix v5 files ────────────────────────────────────────────────────────────
const { readdirSync } = await import('fs');
const v5Files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));

console.log(`Processing ${v5Files.length} v5 files...\n`);

let fixed = 0;
let skipped = 0;
let errors = 0;

for (const file of v5Files) {
  const slug = file.replace('-v5.json', '');
  const correctNameZh = NAME_ZH_MAP[slug];

  if (!correctNameZh) {
    console.log(`⚠ ${slug}: no entry in personas.ts, skipping`);
    skipped++;
    continue;
  }

  const filePath = join(V5_DIR, file);
  const raw = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`✗ ${slug}: JSON parse error ${e.message}`);
    errors++;
    continue;
  }

  const persona = data.persona || {};
  const currentNameZh = persona.nameZh || '';

  // Check if already correct
  const currentHasChinese = /[\u4e00-\u9fff]/.test(currentNameZh);
  const currentName = persona.name || '';

  if (currentHasChinese && currentNameZh === correctNameZh) {
    // Already correct
    continue;
  }

  // Fix nameZh
  persona.nameZh = correctNameZh;

  // Also fix name if it's the English one (e.g. "Charlie Munger" → stays "Charlie Munger" in `name`)
  // We only fix nameZh here, not `name` (which is intentionally English)
  console.log(`✏ ${slug}: nameZh "${currentNameZh}" → "${correctNameZh}" (name="${currentName}")`);

  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  fixed++;
}

console.log(`\n=== V5 Files ===`);
console.log(`  Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`);

// ─── Update DB ────────────────────────────────────────────────────────────────
console.log(`\n=== Updating Database ===`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Get all slugs from v5 directory
  const allSlugs = v5Files.map(f => f.replace('-v5.json', ''));
  const validSlugs = allSlugs.filter(s => NAME_ZH_MAP[s]);

  let dbUpdated = 0;
  let dbErrors = 0;

  for (const slug of validSlugs) {
    const correctNameZh = NAME_ZH_MAP[slug];

    try {
      const r = await pool.query(
        `UPDATE distilled_personas SET "nameZh" = $1, "namezh" = $1, "updatedAt" = NOW() WHERE slug = $2 RETURNING slug`,
        [correctNameZh, slug]
      );
      if (r.rows.length > 0) {
        dbUpdated++;
      }
    } catch (err) {
      console.error(`  DB error ${slug}: ${err.message}`);
      dbErrors++;
    }
  }

  console.log(`  Updated: ${dbUpdated}, Errors: ${dbErrors}`);

  // Verify a sample
  console.log(`\n=== Verification (sample) ===`);
  const sampleSlugs = validSlugs.slice(0, 10);
  const check = await pool.query(
    `SELECT slug, "nameZh" FROM distilled_personas WHERE slug = ANY($1) ORDER BY slug`,
    [sampleSlugs]
  );
  for (const row of check.rows) {
    const hasZh = /[\u4e00-\u9fff]/.test(row.nameZh || '');
    const expected = NAME_ZH_MAP[row.slug] || '';
    const match = row.nameZh === expected;
    const status = hasZh && match ? '✓' : (hasZh ? '⚠' : '✗');
    console.log(`  ${status} ${row.slug}: "${row.nameZh}" (expected: "${expected}")`);
  }

} finally {
  await pool.end();
}

console.log(`\n✅ Done! Fixed ${fixed} v5 files and updated DB.`);
