#!/usr/bin/env bun
/**
 * Fix corrupted nameZh and brief fields in all V5 JSON files.
 * nameZh was wrongly set to the full Chinese identity prompt (not just the name).
 * brief/briefZh may also have been set to incomplete or wrong values.
 * This script overwrites them with correct values from personas.ts.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const V5_DIR = join(process.cwd(), 'corpus/distilled/v5');

// ─── Load correct metadata from personas.ts ─────────────────────────────────
function loadPersonasMeta() {
  const content = readFileSync(join(process.cwd(), 'src/lib/personas.ts'), 'utf8');
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
      if (m[1] !== undefined) return (m[1].match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, ''));
      return m[2] || m[3] || null;
    };
    result[slug] = {
      name: extractField('name') || slug,
      nameZh: extractField('nameZh') || slug,
      nameEn: extractField('nameEn') || extractField('name') || slug,
      tagline: extractField('tagline') || '',
      taglineZh: extractField('taglineZh') || '',
      brief: extractField('brief') || '',
      briefZh: extractField('briefZh') || '',
    };
  }
  return result;
}

const META = loadPersonasMeta();
const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));

let fixed = 0;
let skipped = 0;

for (const file of files) {
  const slug = file.replace('-v5.json', '');
  const meta = META[slug];

  if (!meta) {
    console.log(`⚠ ${slug}: no entry in personas.ts, skipping`);
    skipped++;
    continue;
  }

  const raw = readFileSync(join(V5_DIR, file), 'utf8');
  const data = JSON.parse(raw);
  const persona = data.persona || {};

  let changed = false;

  // Fix nameZh: should be just the Chinese name, not a paragraph
  if (persona.nameZh !== meta.nameZh) {
    console.log(`✏ ${slug}: nameZh "${persona.nameZh?.substring(0, 40)}..." → "${meta.nameZh}"`);
    persona.nameZh = meta.nameZh;
    changed = true;
  }

  // Fix name: should be the canonical English name
  if (persona.name !== meta.name) {
    console.log(`✏ ${slug}: name "${persona.name}" → "${meta.name}"`);
    persona.name = meta.name;
    changed = true;
  }

  // Fix nameEn
  if (persona.nameEn !== meta.nameEn) {
    persona.nameEn = meta.nameEn;
    changed = true;
  }

  // Fix taglineZh
  if (persona.taglineZh !== meta.taglineZh) {
    console.log(`✏ ${slug}: taglineZh "${persona.taglineZh}" → "${meta.taglineZh}"`);
    persona.taglineZh = meta.taglineZh;
    changed = true;
  }

  // Fix brief/briefZh from personas.ts (more reliable)
  if (meta.briefZh && persona.briefZh !== meta.briefZh) {
    persona.briefZh = meta.briefZh;
    changed = true;
  }
  if (meta.brief && persona.brief !== meta.brief) {
    persona.brief = meta.brief;
    changed = true;
  }

  if (changed) {
    writeFileSync(join(V5_DIR, file), JSON.stringify(data, null, 2), 'utf8');
    fixed++;
  }
}

console.log(`\n✅ Fixed ${fixed} files, skipped ${skipped}`);
