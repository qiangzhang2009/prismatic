/**
 * Fix taglineZh for personas that have "诚信" or other generic placeholder taglines.
 * Strategy: Extract the first meaningful sentence from briefZh as the tagline.
 * Then update both personas.ts and the database.
 *
 * Run: node scripts/fix-taglines.mjs
 */

import { Pool } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

try {
  const { config } = await import('dotenv');
  config({ path: join(__dirname, '../.env') });
} catch (e) {}

// Connect to DB
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Generic/placeholder taglines that need replacement
const BAD_TAGLINES = new Set([
  '诚信', '诚实', '正直', '真诚', '可靠', '守信',
  '正直诚信', '诚实守信', '诚信正直',
  'thought leader', 'Thinker', 'Philosopher',
]);

// Patterns indicating a good tagline: short (5-30 chars), not starting with common names
const TAGLINE_MIN = 5;
const TAGLINE_MAX = 35;

function extractTaglineFromBrief(briefZh) {
  if (!briefZh || briefZh.length < 10) return null;

  // Extract first complete sentence (ends with 。？！ or English .?!)
  const firstSentence = briefZh.match(/^[^。？！.?!]{10,80}[。？！.?!]/);

  if (firstSentence) {
    const sentence = firstSentence[0];
    // If it's very long, just use the first clause (before the first comma or pause)
    if (sentence.length > TAGLINE_MAX) {
      const short = sentence.substring(0, TAGLINE_MAX);
      const lastComma = short.lastIndexOf('，');
      const lastPause = short.lastIndexOf('。');
      const cutoff = lastComma > 10 ? lastComma + 1 : (lastPause > 10 ? lastPause + 1 : TAGLINE_MAX);
      return sentence.substring(0, cutoff).replace(/[。？！.?!]$/, '').trim();
    }
    return sentence.replace(/[。？！.?!]$/, '').trim();
  }

  // Fallback: just truncate to max
  return briefZh.substring(0, TAGLINE_MAX).trim();
}

// For some personas, we have hardcoded correct taglines in scroll themes
const MANUAL_TAGLINES = {
  'marcus-aurelius': '自控力',
  'epictetus': '掌控你能控制的',
  'seneca': '死亡的准备是自由的前提',
  'alan-turing': '机器能思考吗',
  'einstein': '想象力比知识更重要',
  'socrates': '未经审视的人生不值得度过',
  'lao-zi': '为学日益，为道日损',
  'confucius': '己所不欲，勿施于人',
  'nassim-taleb': '反脆弱',
  'warren-buffett': '在别人恐惧时贪婪',
  'steve-jobs': '保持饥饿，保持愚蠢',
  'charlie-munger': '反过来想，总是反过来想',
  'elon-musk': '唯一需要遵守的规则是物理定律',
  'zhang-yiming': '平庸有重力，需要逃逸速度',
  'richard-feynman': '凡是我不能创造的，都是我不理解的',
  'jensen-huang': '我们是一台竞争机器',
  'jeff-bezos': '客户至上',
  'jack-ma': '让天下没有难做的生意',
  'sam-altman': '我相信人工智能会改变世界',
  'ray-dalio': '痛苦+反思=进步',
  'naval-ravikant': '追求幸福，而不是财富',
  'peter-thiel': '竞争是失败的遗产',
  'paul-graham': '最有价值的事是自己思考',
  'andrej-karpathy': 'Software 2.0正在吞噬世界',
  'ilya-sutskever': '规模化就是一切',
  'zhang-xuefeng': 'ROI现实主义者',
};

async function main() {
  console.log('=== Fix taglineZh Script ===\n');

  // Step 1: Load all personas from DB
  const dbPersonas = await pool.query(`
    SELECT "slug", "taglineZh", "briefZh", "distillVersion", "finalScore"
    FROM distilled_personas
    WHERE "isActive" = true AND "isPublished" = true
  `);

  console.log(`Found ${dbPersonas.rows.length} active personas in DB\n`);

  // Step 2: Analyze each persona
  const fixes = [];
  for (const row of dbPersonas.rows) {
    const { slug, taglineZh, briefZh } = row;
    const needsFix = BAD_TAGLINES.has(taglineZh) ||
      taglineZh === 'thought leader' ||
      taglineZh === 'Thinker' ||
      (taglineZh && taglineZh.length <= 2 && /^[\u4e00-\u9fa5]+$/.test(taglineZh));

    if (needsFix) {
      // Try manual first, then extract from brief
      const manual = MANUAL_TAGLINES[slug];
      let newTagline = manual || extractTaglineFromBrief(briefZh);
      if (newTagline && newTagline !== taglineZh) {
        fixes.push({ slug, oldTagline: taglineZh, newTagline, source: manual ? 'manual' : 'brief' });
      }
    }
  }

  console.log(`Found ${fixes.length} taglines that need fixing:\n`);
  for (const f of fixes) {
    console.log(`  ${f.slug}: "${f.oldTagline}" → "${f.newTagline}" [${f.source}]`);
  }

  if (fixes.length === 0) {
    console.log('No fixes needed. Exiting.');
    await pool.end();
    return;
  }

  // Step 3: Update DB
  console.log('\n--- Updating database ---');
  for (const f of fixes) {
    await pool.query(
      `UPDATE distilled_personas SET "taglineZh" = $1, "tagline" = $1 WHERE "slug" = $2`,
      [f.newTagline, f.slug]
    );
    console.log(`  ✓ Updated DB: ${f.slug} = "${f.newTagline}"`);
  }

  // Step 4: Also update personas.ts if the slug exists there
  console.log('\n--- Updating personas.ts ---');
  let personasContent = readFileSync(PERSONAS_FILE, 'utf8');

  for (const f of fixes) {
    // Only update if the slug exists in personas.ts
    const slugRegex = new RegExp(`PERSONAS\\['${f.slug}'\\]\\s*=\\s*\\{`);
    if (slugRegex.test(personasContent)) {
      // Update taglineZh field
      const blockRegex = new RegExp(
        `PERSONAS\\['${f.slug}'\\]\\s*=\\s*\\{[\\s\\S]*?(?=\\n\\s*PERSONAS\\[)`,
      );
      personasContent = personasContent.replace(blockRegex, (block) => {
        // Replace taglineZh value
        const escapedTagline = f.newTagline.replace(/'/g, "\\'");
        if (block.includes('taglineZh:')) {
          return block.replace(/taglineZh:\s*['"][^'"]*['"]/, `taglineZh: '${escapedTagline}'`);
        }
        return block;
      });
      console.log(`  ✓ Updated personas.ts: ${f.slug} = "${f.newTagline}"`);
    }
  }

  writeFileSync(PERSONAS_FILE, personasContent, 'utf8');

  // Step 5: Verify
  console.log('\n--- Verification ---');
  const verify = await pool.query(`
    SELECT "slug", "taglineZh", "distillVersion"
    FROM distilled_personas
    WHERE "slug" = ANY($1::text[])
    ORDER BY "finalScore" DESC
  `, [fixes.map(f => f.slug)]);

  for (const row of verify.rows) {
    const expected = fixes.find(f => f.slug === row.slug);
    const status = row.taglineZh === expected.newTagline ? '✓' : '✗';
    console.log(`  ${status} ${row.slug}: "${row.taglineZh}"`);
  }

  console.log('\n=== Done ===');
  console.log('IMPORTANT: Re-run deploy-v4-to-db.mjs to sync all changes to DB, then redeploy frontend.');
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch(err => { console.error(err); pool.end(); process.exit(1); });
