/**
 * Re-extract expressionDNA for existing v4 persona files.
 *
 * expressionDNA.vocabulary and expressionDNA.sentenceStyle are EMPTY in 33 out of 41 v4 files.
 * This script uses the LLM to extract expression DNA directly from the corpus files.
 *
 * Usage:
 *   node scripts/reextract-expression-dna.mjs                        # analyze only
 *   node scripts/reextract-expression-dna.mjs --apply              # apply to all
 *   node scripts/reextract-expression-dna.mjs marcus-aurelius         # single persona
 *   node scripts/reextract-expression-dna.mjs marcus-aurelius --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V4_DIR = path.join(__dirname, '../corpus/distilled/v4');
const CORPUS_DIR = path.join(__dirname, '../corpus/distilled');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = 'https://api.deepseek.com';

if (!DEEPSEEK_API_KEY) {
  console.error('Error: DEEPSEEK_API_KEY not set');
  process.exit(1);
}

// ─── LLM Expression Extraction ─────────────────────────────────────────────────

async function extractExpressionDNA(personaId, corpusSample, targetLang = 'zh-CN') {
  const prompt = `你是一位风格分析专家。请从以下语料中提取这个人物的中文表达特征。
即使原语料不是中文，也要提取该人物用中文表达时会展现的特征。

请用中文返回（所有字段均使用中文）：
{
  "vocabulary": ["该人物最常用的10-15个中文特征词汇或短语（用中文，不是英文）"],
  "sentenceStyle": ["3-5个该人物特有的中文句式习惯"],
  "forbiddenWords": ["该人物绝对不会使用的3-5个词或表达"],
  "tone": "formal|casual|passionate|detached|humorous|therapeutic",
  "certaintyLevel": "high|medium|low",
  "rhetoricalHabit": "1-2句话描述该人物的中文修辞特点",
  "quotePatterns": ["该人物引用或典故使用的2-3个模式"],
  "verbalMarkers": ["该人物的口头禅或惯用语2-3个"],
  "speakingStyle": "2-3句话描述该人物的中文交流风格",
  "chineseAdaptation": "在中文输出时保持该人物风格的3个具体建议"
}

=== CORPUS SAMPLE ===
${corpusSample.slice(0, 8000)}
=== END CORPUS ===`;

  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices[0]?.message?.content?.trim() ?? '';

  // Parse JSON from response
  const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) throw new Error('No JSON found in response');

  const json = JSON.parse(jsonMatch[0]);

  return {
    vocabulary: Array.isArray(json.vocabulary) ? json.vocabulary.slice(0, 15) : [],
    sentenceStyle: Array.isArray(json.sentenceStyle) ? json.sentenceStyle.slice(0, 5) : [],
    forbiddenWords: Array.isArray(json.forbiddenWords) ? json.forbiddenWords.slice(0, 10) : [],
    tone: ['formal', 'casual', 'passionate', 'detached', 'humorous', 'therapeutic'].includes(json.tone) ? json.tone : 'formal',
    certaintyLevel: ['high', 'medium', 'low'].includes(json.certaintyLevel) ? json.certaintyLevel : 'medium',
    rhetoricalHabit: String(json.rhetoricalHabit ?? ''),
    quotePatterns: Array.isArray(json.quotePatterns) ? json.quotePatterns : [],
    verbalMarkers: Array.isArray(json.verbalMarkers) ? json.verbalMarkers.slice(0, 5) : [],
    speakingStyle: String(json.speakingStyle ?? ''),
    chineseAdaptation: String(json.chineseAdaptation ?? ''),
    confidence: 'high',
    confidenceNotes: [],
  };
}

// ─── Heuristic Expression Extraction (fallback) ─────────────────────────────────

function extractHeuristicExpression(text) {
  const words = text.match(/[\u4e00-\u9fff]{2,4}/g) ?? [];
  const ZH_STOP = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '这', '那', '也', '个', '上', '下', '来', '去', '着', '过', '会', '能', '要', '可', '以', '于']);
  const freq = new Map();
  for (const w of words) {
    if (!ZH_STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const vocab = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 5);
  const styles = [];
  const questions = sentences.filter(s => /[？?]/.test(s)).length;
  if (questions / Math.max(1, sentences.length) > 0.1) styles.push('善于提问，引导思考');
  const exclamations = sentences.filter(s => /[！！!]/.test(s)).length;
  if (exclamations / Math.max(1, sentences.length) > 0.05) styles.push('善用感叹，强调观点');
  const short = sentences.filter(s => s.length < 20).length;
  if (short / Math.max(1, sentences.length) > 0.3) styles.push('善用短句，简洁有力');
  if (styles.length === 0) styles.push('长短句交错，节奏自然');

  return {
    vocabulary: vocab,
    sentenceStyle: styles.slice(0, 5),
    forbiddenWords: [],
    tone: 'formal',
    certaintyLevel: 'medium',
    rhetoricalHabit: styles.join('；'),
    quotePatterns: [],
    verbalMarkers: [],
    speakingStyle: `措辞${text.length > 5000 ? '严谨' : '自然'}，${styles.join('，')}。`,
    chineseAdaptation: styles.join('；') + '。',
    confidence: 'low',
    confidenceNotes: ['Heuristic extraction — LLM extraction preferred'],
  };
}

// ─── Load corpus for a persona ────────────────────────────────────────────────

function loadCorpusForPersona(personaId) {
  const PROJECT_ROOT = path.join(__dirname, '..');
  // Check subdirs first (most corpus files are in texts/ subdirectory)
  const candidates = [
    path.join(PROJECT_ROOT, 'corpus', personaId, 'texts'),
    path.join(PROJECT_ROOT, 'corpus', personaId, 'text'),
    path.join(PROJECT_ROOT, 'corpus', personaId),
  ];

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f =>
      f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.html')
    );
    if (files.length === 0) continue;

    // Read all text files and concatenate
    const texts = [];
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (content.length > 100) texts.push(content);
    }
    if (texts.length > 0) {
      return texts.join('\n\n').slice(0, 15000);
    }
  }
  return null;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function processFile(personaId, dryRun = true) {
  const v4File = path.join(V4_DIR, `${personaId}-v4.json`);
  if (!fs.existsSync(v4File)) {
    console.log(`  [SKIP] ${personaId}: no v4 file found`);
    return { slug: personaId, status: 'skip', reason: 'no v4 file' };
  }

  const data = JSON.parse(fs.readFileSync(v4File, 'utf-8'));
  const vocab = data.expression?.vocabulary ?? [];
  const styles = data.expression?.sentenceStyle ?? [];

  if (vocab.length > 0 && styles.length > 0) {
    console.log(`  [OK] ${personaId}: expressionDNA already populated`);
    return { slug: personaId, status: 'ok' };
  }

  console.log(`  [${dryRun ? 'DRY' : 'APPLY'}] ${personaId}: will extract expressionDNA (vocab=${vocab.length}, styles=${styles.length})`);

  if (dryRun) return { slug: personaId, status: 'dry-run' };

  // Load corpus
  const corpus = loadCorpusForPersona(personaId);
  if (!corpus) {
    console.log(`    ! No corpus found for ${personaId}, using heuristic extraction`);
    const v4Data = JSON.parse(fs.readFileSync(v4File, 'utf-8'));
    const identityText = (v4Data.knowledge?.identityPrompt ?? '') + ' ' +
      (v4Data.knowledge?.identityPromptZh ?? '') + ' ' +
      (v4Data.knowledge?.mentalModels ?? []).map((m) =>
        `${m.oneLiner ?? ''} ${m.oneLinerZh ?? ''} ${m.application ?? ''} ${m.applicationZh ?? ''}`
      ).join(' ');
    const expr = extractHeuristicExpression(identityText);
    data.expression = { ...data.expression, ...expr };
  } else {
    try {
      const expr = await extractExpressionDNA(personaId, corpus);
      data.expression = { ...data.expression, ...expr };
      console.log(`    -> LLM extracted: ${expr.vocabulary.length} vocab, ${expr.sentenceStyle.length} styles`);
    } catch (err) {
      console.log(`    ! LLM extraction failed: ${err.message}, using heuristic`);
      const fallback = extractHeuristicExpression(corpus);
      data.expression = { ...data.expression, ...fallback };
    }
  }

  const backupPath = v4File + '.expr-backup';
  fs.copyFileSync(v4File, backupPath);
  fs.writeFileSync(v4File, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`    -> Saved (backup: ${path.basename(backupPath)})`);

  return { slug: personaId, status: 'applied' };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const targetSlug = args.find(a => !a.startsWith('--'));

  console.log('=== expressionDNA Re-extraction ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}\n`);

  const files = fs.readdirSync(V4_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} v4 persona files\n`);

  let ok = 0, dry = 0, applied = 0, skip = 0, error = 0;

  for (const f of files) {
    const personaId = f.replace('-v4.json', '');
    if (targetSlug && personaId !== targetSlug) continue;

    try {
      const result = await processFile(personaId, dryRun);
      if (result.status === 'ok') ok++;
      else if (result.status === 'dry-run') dry++;
      else if (result.status === 'applied') applied++;
      else if (result.status === 'skip') skip++;
    } catch (err) {
      console.error(`  ! Error: ${err.message}`);
      error++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`OK:         ${ok} (already populated)`);
  console.log(`Dry-run:    ${dry} (needs extraction)`);
  console.log(`Applied:    ${applied}`);
  console.log(`Skipped:   ${skip}`);
  console.log(`Errors:     ${error}`);

  if (dryRun && dry > 0) {
    console.log(`\nRun with --apply to re-extract expressionDNA.`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
