/**
 * Backfill script for v4 distilled personas.
 *
 * Two distinct operations:
 *
 * 1. TRANSLATION: For English-text fields that SHOULD be Chinese
 *    - mentalModels[].oneLinerZh (if English text exists but no Chinese)
 *    - mentalModels[].applicationZh
 *    - This applies to English-corpus personas (Marcus Aurelius, Seneca, etc.)
 *
 * 2. RE-EXTRACTION NEEDED: For expressionDNA fields
 *    - expressionDNA.vocabulary: ALWAYS empty — needs LLM re-extraction
 *    - expressionDNA.sentenceStyle: ALWAYS empty — needs LLM re-extraction
 *    - Cannot be fixed by translation alone; requires distillation pipeline
 *
 * Usage:
 *   node scripts/backfill-v4-chinese.mjs                    # analyze only
 *   node scripts/backfill-v4-chinese.mjs --apply           # apply translation fixes
 *   node scripts/backfill-v4-chinese.mjs --reextract        # only report re-extraction needs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V4_DIR = path.join(__dirname, '../corpus/distilled/v4');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = 'https://api.deepseek.com';

const PRESERVE_NOUNS = [
  'Marcus Aurelius', 'Stoicism', 'Stoic', 'Epictetus', 'Seneca',
  'Plato', 'Aristotle', 'Buddha', 'Dharma', 'Nirvana', 'Zen',
  'wu wei', 'Dao', 'Tao', '道', '无为', '法', '佛法', '涅槃',
  'Marcus', 'Aurelius', 'Nagarjuna', 'Wittgenstein',
];

// ─── Translation ─────────────────────────────────────────────────────────────

async function translate(text) {
  if (!text || !text.trim()) return text;
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  if (hasChinese) return text; // Already has Chinese, skip

  const preserveNote = PRESERVE_NOUNS.length > 0
    ? `\n以下专有名词不要翻译（保留原文）：${PRESERVE_NOUNS.join(', ')}`
    : '';

  const prompt = `将以下英文文本翻译为中文。

规则：
- 保持哲学/概念精确性
- 保持语气和修辞风格
- 专有名词（如人名、哲学术语）保留英文原文${preserveNote}
- 只输出翻译结果，不要添加任何解释

=== 待翻译文本 ===
${text}
=== 结束 ===`;

  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: Math.min(text.length * 4, 3000),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() ?? text;
}

// ─── Analysis ────────────────────────────────────────────────────────────────

function analyzeFile(filepath) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const issues = {
    // Fields needing translation
    mentalModelTranslations: [],  // {name, field, enText}
    strengthsNeedsTranslation: false,
    blindspotsNeedsTranslation: false,
    // Fields needing re-extraction (NOT translation)
    expressionDNANeedsReextraction: false,
  };

  // Check expressionDNA
  const vocab = data.expression?.vocabulary ?? [];
  const styles = data.expression?.sentenceStyle ?? [];
  if (vocab.length === 0 || styles.length === 0) {
    issues.expressionDNANeedsReextraction = true;
  }

  // Check mental models for English text with missing Chinese
  for (const mm of (data.knowledge?.mentalModels ?? [])) {
    if (mm.oneLiner && !mm.oneLinerZh) {
      issues.mentalModelTranslations.push({ name: mm.name, field: 'oneLinerZh', enText: mm.oneLiner });
    }
    if (mm.application && !mm.applicationZh) {
      issues.mentalModelTranslations.push({ name: mm.name, field: 'applicationZh', enText: mm.application });
    }
  }

  // Check strengths/blindspots
  const strengths = data.knowledge?.strengths ?? [];
  const strengthsZh = data.knowledge?.strengthsZh ?? [];
  if (strengths.length > 0 && strengthsZh.length === 0) {
    issues.strengthsNeedsTranslation = true;
  }

  const blindspots = data.knowledge?.blindspots ?? [];
  const blindspotsZh = data.knowledge?.blindspotsZh ?? [];
  if (blindspots.length > 0 && blindspotsZh.length === 0) {
    issues.blindspotsNeedsTranslation = true;
  }

  return issues;
}

async function processFile(filepath, dryRun = true) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const slug = path.basename(filepath, '.json').replace(/-v4$/, '');
  const issues = analyzeFile(filepath);

  const needsWork = issues.mentalModelTranslations.length > 0 ||
    issues.strengthsNeedsTranslation ||
    issues.blindspotsNeedsTranslation ||
    issues.expressionDNANeedsReextraction;

  if (!needsWork) {
    console.log(`  [OK] ${slug}`);
    return { slug, status: 'ok' };
  }

  console.log(`  [${dryRun ? 'DRY' : 'APPLY'}] ${slug}:`);

  if (issues.expressionDNANeedsReextraction) {
    console.log(`    ! expressionDNA (vocabulary/sentenceStyle) is EMPTY — requires re-extraction via distillation pipeline`);
  }
  for (const t of issues.mentalModelTranslations) {
    console.log(`    - translate ${t.field} for "${t.name}": "${t.enText.slice(0, 60)}..."`);
  }
  if (issues.strengthsNeedsTranslation) console.log(`    - translate strengths[]`);
  if (issues.blindspotsNeedsTranslation) console.log(`    - translate blindspots[]`);

  if (dryRun) {
    console.log(`    -> Would translate ${issues.mentalModelTranslations.length} fields`);
    return { slug, status: 'dry-run', issues };
  }

  // Actual translation
  console.log(`    -> Translating...`);
  try {
    let translated = 0;

    for (const t of issues.mentalModelTranslations) {
      const mm = data.knowledge?.mentalModels?.find(m => m.name === t.name);
      if (!mm) continue;

      if (t.field === 'oneLinerZh') {
        mm.oneLinerZh = await translate(t.enText);
      } else if (t.field === 'applicationZh') {
        mm.applicationZh = await translate(t.enText);
      }
      translated++;
    }

    if (issues.strengthsNeedsTranslation && data.knowledge?.strengths?.length > 0) {
      data.knowledge.strengthsZh = await Promise.all(
        data.knowledge.strengths.map(s => translate(s))
      );
      translated += data.knowledge.strengths.length;
    }

    if (issues.blindspotsNeedsTranslation && data.knowledge?.blindspots?.length > 0) {
      data.knowledge.blindspotsZh = await Promise.all(
        data.knowledge.blindspots.map(s => translate(s))
      );
      translated += data.knowledge.blindspots.length;
    }

    // Backup and save
    const backupPath = filepath + '.backup';
    fs.copyFileSync(filepath, backupPath);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`    -> Translated ${translated} fields, saved (backup: ${path.basename(backupPath)})`);

    return { slug, status: 'applied', translated };
  } catch (err) {
    console.error(`    ! Error: ${err.message}`);
    return { slug, status: 'error', error: err.message };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const targetSlug = args.find(a => !a.startsWith('--'));

  console.log('=== V4 Chinese Backfill ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log('');

  const files = fs.readdirSync(V4_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(V4_DIR, f))
    .sort();

  console.log(`Analyzing ${files.length} v4 persona files\n`);

  let ok = 0, dry = 0, applied = 0, error = 0, reextract = 0;
  const results = [];

  for (const filepath of files) {
    const slug = path.basename(filepath, '.json').replace(/-v4$/, '');
    if (targetSlug && slug !== targetSlug) continue;

    const result = await processFile(filepath, dryRun);
    results.push(result);

    if (result.status === 'ok') ok++;
    else if (result.status === 'dry-run') {
      dry++;
      if (result.issues?.expressionDNANeedsReextraction) reextract++;
    }
    else if (result.status === 'applied') applied++;
    else if (result.status === 'error') error++;
  }

  console.log('\n=== Summary ===');
  console.log(`OK (no changes needed):   ${ok}`);
  console.log(`Dry-run (missing fields): ${dry}`);
  console.log(`  └─ expressionDNA re-extraction needed: ${reextract} files`);
  console.log(`Applied:                   ${applied}`);
  console.log(`Errors:                   ${error}`);

  if (dryRun && dry > 0) {
    console.log(`\nRun with --apply to translate missing Chinese fields.`);
    console.log(`Note: expressionDNA needs re-extraction via distillation pipeline (--reextract for report).`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
