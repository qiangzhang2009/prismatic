/**
 * Merge Zero distillation results into personas.ts
 *
 * Strategy: For each persona, find the LINE NUMBER range of each cognitive field
 * in the existing file and replace ONLY those lines. Keeps all other fields
 * (expressionDNA, brief, colors, etc.) completely untouched.
 *
 * Slug mapping: laozi→lao-zi, zhuangzi→zhuang-zi
 *
 * Run: node scripts/merge-zero-to-personas.mjs --dry-run  # preview
 *      node scripts/merge-zero-to-personas.mjs --write    # write
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZERO_DIR = join(__dirname, '../corpus/distilled/zero');
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

const DRY_RUN = !process.argv.includes('--write');

// ─── Slug mapping ───────────────────────────────────────────────────────────────
const SLUG_MAP = { laozi: 'lao-zi', zhuangzi: 'zhuang-zi' };

function resolveSlug(s) { return SLUG_MAP[s] ?? s; }

// ─── Load zero data ───────────────────────────────────────────────────────────
function loadZeroFiles() {
  const files = readdirSync(ZERO_DIR).filter(f => f.endsWith('-zero.json'));
  const result = {};
  for (const file of files) {
    const zeroSlug = file.replace('-zero.json', '');
    const slug = resolveSlug(zeroSlug);
    const data = JSON.parse(readFileSync(join(ZERO_DIR, file), 'utf8'));
    result[slug] = data;
  }
  return result;
}

// ─── JSON helpers ──────────────────────────────────────────────────────────────
function jsonVal(v) { return JSON.stringify(v ?? ''); }

// ─── Generate replacement lines for each field ────────────────────────────────
function genMentalModels(data) {
  const mm = data.knowledge?.mentalModels || [];
  const lines = ['  mentalModels: ['];
  for (let i = 0; i < mm.length; i++) {
    const m = mm[i];
    const evidence = (m.evidence || []).map(e => ({ quote: e.quote || '', source: e.source || '', year: e.year || null }));
    lines.push('    {');
    lines.push(`      id: '${m.id || `mm-${i + 1}`}',`);
    lines.push(`      name: ${jsonVal(m.nameEn || m.name || m.nameZh || '')},`);
    lines.push(`      nameZh: ${jsonVal(m.nameZh || m.name || '')},`);
    lines.push(`      oneLiner: ${jsonVal(m.oneLiner || '')},`);
    lines.push(`      oneLinerZh: ${jsonVal(m.oneLiner || '')},`);
    lines.push(`      evidence: ${jsonVal(evidence)},`);
    lines.push(`      crossDomain: ${jsonVal(m.crossDomain || [])},`);
    lines.push(`      application: ${jsonVal(m.application || '')},`);
    lines.push(`      applicationZh: ${jsonVal(m.application || '')},`);
    lines.push(`      limitation: ${jsonVal(m.limitations || m.limitation || '')},`);
    lines.push(`      limitationZh: ${jsonVal(m.limitations || m.limitation || '')},`);
    lines.push('    },');
  }
  lines.push('  ],');
  return lines;
}

function genDecisionHeuristics(data) {
  const hh = data.knowledge?.decisionHeuristics || [];
  const lines = ['  decisionHeuristics: ['];
  for (let i = 0; i < hh.length; i++) {
    const h = hh[i];
    lines.push('    {');
    lines.push(`      id: '${h.id || `heur-${i + 1}`}',`);
    lines.push(`      name: ${jsonVal(h.nameEn || h.name || h.nameZh || '')},`);
    lines.push(`      nameZh: ${jsonVal(h.nameZh || h.name || '')},`);
    lines.push(`      description: ${jsonVal(h.description || '')},`);
    lines.push(`      descriptionZh: ${jsonVal(h.description || '')},`);
    lines.push(`      application: ${jsonVal(h.applicationScenario || h.application || '')},`);
    lines.push(`      applicationZh: ${jsonVal(h.applicationScenario || h.application || '')},`);
    lines.push(`      example: ${jsonVal(h.example || '')},`);
    lines.push('    },');
  }
  lines.push('  ],');
  return lines;
}

function genTensions(data) {
  const tt = data.knowledge?.tensions || [];
  const lines = ['  tensions: ['];
  for (const t of tt) {
    lines.push('    {');
    lines.push(`      dimension: ${jsonVal(t.dimension || '')},`);
    lines.push(`      tension: ${jsonVal(t.dimension || '')},`);
    lines.push(`      tensionZh: ${jsonVal(t.dimension || '')},`);
    lines.push(`      description: ${jsonVal(t.description || '')},`);
    lines.push(`      descriptionZh: ${jsonVal(t.description || '')},`);
    lines.push(`      positivePole: ${jsonVal(t.positivePole || '')},`);
    lines.push(`      negativePole: ${jsonVal(t.negativePole || '')},`);
    lines.push('    },');
  }
  lines.push('  ],');
  return lines;
}

function genAntiPatterns(data) {
  const aps = data.knowledge?.antiPatterns || [];
  const items = aps.map(ap => jsonVal(ap.description || ap.id || String(ap)));
  return [`  antiPatterns: [ ${items.join(', ')} ],`];
}

function genHonestBoundaries(data) {
  const bb = data.knowledge?.honestBoundaries || [];
  const lines = ['  honestBoundaries: ['];
  for (const h of bb) {
    lines.push(`    { text: ${jsonVal(h.description || '')}, textZh: ${jsonVal(h.description || '')}, reason: ${jsonVal(h.reason || '')}, reasonZh: ${jsonVal(h.reason || '')} },`);
  }
  lines.push('  ],');
  return lines;
}

function genStrengths(data) {
  const ss = data.strengths || data.knowledge?.strengths || [];
  const items = ss.map(s => jsonVal(String(s)));
  return [`  strengths: [ ${items.join(', ')} ],`];
}

function genBlindspots(data) {
  const bb = data.blindspots || data.knowledge?.blindspots || [];
  const items = bb.map(b => jsonVal(String(b)));
  return [`  blindspots: [ ${items.join(', ')} ],`];
}

function genSources(data) {
  const ss = data.knowledge?.sources || [];
  const lines = ['  sources: ['];
  for (const s of ss) {
    lines.push(`    { type: '${s.type || 'other'}', title: ${jsonVal(s.title || '')}, description: ${jsonVal(s.title || '')} },`);
  }
  lines.push('  ],');
  return lines;
}

function genVersion(data) {
  const grade = data.grade || 'C';
  const scoreMap = { A: 95, B: 85, C: 75, D: 60, F: 40 };
  const finalScore = scoreMap[grade] || 80;
  return [`  version: ${jsonVal(`zero-v1.${finalScore}`)},`];
}

function genResearchDate() {
  return [`  researchDate: ${jsonVal(new Date().toISOString().split('T')[0])},`];
}

// ─── Line-based field replacement ───────────────────────────────────────────

/**
 * For a given slug, find the line ranges of fields to replace.
 * Works on the CURRENT state of the lines array (mutated after each splice).
 */
function findFieldLineRange(lines, slug) {
  // Find persona start
  let personaStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`PERSONAS['${slug}']`) && lines[i].includes(' = {')) {
      personaStartLine = i;
      break;
    }
  }
  if (personaStartLine < 0) return null;

  // Find persona end
  let personaEndLine = lines.length;
  for (let i = personaStartLine + 1; i < lines.length; i++) {
    if (lines[i].match(/^PERSONAS\[/)) {
      personaEndLine = i;
      break;
    }
  }

  // Find line indices of each field
  const fields = ['mentalModels', 'decisionHeuristics', 'tensions', 'antiPatterns',
                  'honestBoundaries', 'strengths', 'blindspots', 'sources',
                  'researchDate', 'version'];
  const result = {};
  for (const field of fields) {
    for (let i = personaStartLine; i < personaEndLine; i++) {
      if (lines[i].match(new RegExp(`^  ${field}:`))) {
        // Find closing bracket
        let depth = 0;
        let closeLine = i;
        for (let j = i; j < personaEndLine; j++) {
          for (const c of lines[j]) {
            if (c === '[' || c === '{') depth++;
            else if (c === ']' || c === '}') depth--;
          }
          closeLine = j;
          if (depth <= 0) break;
        }
        result[field] = { startLine: i, endLine: closeLine + 1 };
        break;
      }
    }
  }

  return { personaStartLine, personaEndLine, fieldRanges: result };
}

// ─── Core merge ───────────────────────────────────────────────────────────────
function mergePersonas(content, zeroData) {
  const allLines = content.split('\n');
  let lines = [...allLines]; // mutable, updated after each splice
  let totalUpdated = 0;
  const updatedSlugs = [];
  const skippedSlugs = [];

  // Process personas from BOTTOM to TOP so earlier replacements don't shift indices
  const entries = Object.entries(zeroData).reverse();

  for (const [slug, data] of entries) {
    const info = findFieldLineRange(lines, slug);
    if (!info) {
      skippedSlugs.push(slug);
      continue;
    }

    const { personaStartLine, fieldRanges } = info;

    // Replacement map: fieldName → newLines
    const genFns = {
      mentalModels: genMentalModels,
      decisionHeuristics: genDecisionHeuristics,
      tensions: genTensions,
      antiPatterns: genAntiPatterns,
      honestBoundaries: genHonestBoundaries,
      strengths: genStrengths,
      blindspots: genBlindspots,
      sources: genSources,
      researchDate: genResearchDate,
      version: genVersion,
    };

    // Collect all replacements
    const replacements = [];
    for (const [field, range] of Object.entries(fieldRanges)) {
      const fn = genFns[field];
      if (!fn) continue;
      replacements.push({
        startLine: range.startLine,
        endLine: range.endLine,
        newLines: fn(data),
      });
    }

    // Sort descending by line number so we replace from bottom to top
    replacements.sort((a, b) => b.startLine - a.startLine);

    // Apply replacements (mutates `lines`)
    for (const { startLine, endLine, newLines: nl } of replacements) {
      lines.splice(startLine, endLine - startLine, ...nl);
    }

    totalUpdated++;
    updatedSlugs.push(slug);
  }

  return { result: lines.join('\n'), totalUpdated, updatedSlugs, skippedSlugs };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? '=== Zero → personas.ts Merge (DRY RUN) ===\n' : '=== Zero → personas.ts Merge (WRITING) ===\n');

  const zeroData = loadZeroFiles();
  console.log(`Loaded ${Object.keys(zeroData).length} zero files\n`);

  const personasContent = readFileSync(PERSONAS_FILE, 'utf8');
  const { result, totalUpdated, updatedSlugs, skippedSlugs } = mergePersonas(personasContent, zeroData);

  console.log(`Updated: ${totalUpdated}`);
  console.log(`Skipped: ${skippedSlugs.length}`);
  if (skippedSlugs.length) console.log(`  ${skippedSlugs.join(', ')}`);

  if (totalUpdated === 0) return;

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Run with --write to apply.');
  } else {
    writeFileSync(PERSONAS_FILE, result, 'utf8');
    console.log(`\n[WRITTEN] personas.ts updated. ${totalUpdated} personas merged.`);
    console.log('Next: npm run build && vercel --prod --yes');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
