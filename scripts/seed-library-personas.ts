/**
 * scripts/seed-library-personas.ts
 *
 * Seed the DistilledPersona table with all hardcoded personas from personas.ts,
 * enriched with corpus stats (text size, file count), then assign subscription
 * tiers based on quality tier:
 *
 *   FREE      — Grade C/D (draft quality, < 70 score)
 *   MONTHLY   — Grade B  (good quality, 70-84 score)
 *   LIFETIME  — Grade A  (excellent quality, ≥85 score)
 *
 * Also seeds the Persona DB table for analytics tracking.
 *
 * Usage:
 *   bun run scripts/seed-library-personas.ts          # seed all
 *   bun run scripts/seed-library-personas.ts --dry   # dry run (show what would be seeded)
 *   bun run scripts/seed-library-personas.ts --plan   # show tier distribution
 */

import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ─── Inline persona registry (mirrors PERSONAS from src/lib/personas.ts) ─────────
// This avoids TypeScript/ESM import issues. Update this when PERSONAS changes.

const PERSONA_REGISTRY: Array<{
  slug: string;
  name: string;
  nameZh: string;
  nameEn?: string;
  domain?: string | string[];
  brief?: string;
  briefZh?: string;
  tagline?: string;
  taglineZh?: string;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  avatar?: string;
  mentalModels?: Array<{ name: string; nameZh?: string }>;
  values?: Array<{ name: string; nameZh?: string }>;
  distillation?: { score?: number; grade?: string; version?: string; breakdown?: Record<string, number> };
}> = [
  // Sample — populated from actual corpus directories
  { slug: 'confucius', name: 'Confucius', nameZh: '孔子', domain: 'philosophy', briefZh: '儒家学派创始人', distillation: { score: 92, grade: 'A', version: '5.0' } },
  { slug: 'lao-zi', name: 'Laozi', nameZh: '老子', domain: 'philosophy', briefZh: '道家学派创始人', distillation: { score: 91, grade: 'A', version: '5.0' } },
  { slug: 'huangdi-neijing', name: 'Huangdi Neijing', nameZh: '黄帝内经', domain: 'medicine', briefZh: '中医理论奠基之作', distillation: { score: 88, grade: 'A', version: '5.0' } },
  { slug: 'charlie-munger', name: 'Charlie Munger', nameZh: '查理·芒格', domain: 'investment', briefZh: '伯克希尔副董事长，跨学科思维大师', distillation: { score: 87, grade: 'A', version: '5.0' } },
  { slug: 'alan-watts', name: 'Alan Watts', nameZh: '艾伦·沃茨', domain: 'philosophy', briefZh: '西方禅宗布道者', distillation: { score: 86, grade: 'A', version: '5.0' } },
  { slug: 'lin-yutang', name: 'Lin Yutang', nameZh: '林语堂', domain: 'philosophy', briefZh: '中国现代文学家、哲学家', distillation: { score: 85, grade: 'A', version: '5.0' } },
  { slug: 'epictetus', name: 'Epictetus', nameZh: '爱比克泰德', domain: 'philosophy', briefZh: '斯多葛学派哲学家', distillation: { score: 85, grade: 'A', version: '5.0' } },
  { slug: 'marcus-aurelius', name: 'Marcus Aurelius', nameZh: '马可·奥勒留', domain: 'philosophy', briefZh: '罗马皇帝，斯多葛学派代表', distillation: { score: 84, grade: 'B', version: '5.0' } },
  { slug: 'hui-neng', name: 'Huineng', nameZh: '慧能', domain: 'philosophy', briefZh: '禅宗六祖', distillation: { score: 84, grade: 'B', version: '5.0' } },
  { slug: 'han-fei-zi', name: 'Han Feizi', nameZh: '韩非子', domain: 'philosophy', briefZh: '法家思想集大成者', distillation: { score: 83, grade: 'B', version: '5.0' } },
  { slug: 'qu-yuan', name: 'Qu Yuan', nameZh: '屈原', domain: 'literature', briefZh: '战国时期楚国诗人', distillation: { score: 83, grade: 'B', version: '5.0' } },
  { slug: 'paul-graham', name: 'Paul Graham', nameZh: 'Paul Graham', domain: 'technology', briefZh: 'YC创始人，硅谷思想家', distillation: { score: 82, grade: 'B', version: '5.0' } },
  { slug: 'elon-musk', name: 'Elon Musk', nameZh: '埃隆·马斯克', domain: 'technology', briefZh: 'SpaceX和Tesla创始人', distillation: { score: 82, grade: 'B', version: '5.0' } },
  { slug: 'nassim-taleb', name: 'Nassim Taleb', nameZh: '纳西姆·塔勒布', domain: 'philosophy', briefZh: '不确定性思想家', distillation: { score: 82, grade: 'B', version: '5.0' } },
  { slug: 'niall-ferguson', name: 'Niall Ferguson', nameZh: '尼尔·弗格森', domain: 'history', briefZh: '英国历史学家', distillation: { score: 80, grade: 'B', version: '5.0' } },
  { slug: 'kant', name: 'Immanuel Kant', nameZh: '康德', domain: 'philosophy', briefZh: '德国古典哲学创始人', distillation: { score: 80, grade: 'B', version: '5.0' } },
  { slug: 'jeff-bezos', name: 'Jeff Bezos', nameZh: '杰夫·贝索斯', domain: 'business', briefZh: '亚马逊创始人', distillation: { score: 79, grade: 'B', version: '5.0' } },
  { slug: 'steve-jobs', name: 'Steve Jobs', nameZh: '史蒂夫·乔布斯', domain: 'product', briefZh: '苹果公司创始人', distillation: { score: 79, grade: 'B', version: '5.0' } },
  { slug: 'richard-feynman', name: 'Richard Feynman', nameZh: '理查德·费曼', domain: 'science', briefZh: '诺贝尔物理学奖得主', distillation: { score: 78, grade: 'B', version: '5.0' } },
  { slug: 'jack-ma', name: 'Jack Ma', nameZh: '马云', domain: 'business', briefZh: '阿里巴巴创始人', distillation: { score: 78, grade: 'B', version: '5.0' } },
  { slug: 'journey-west', name: 'Journey to the West', nameZh: '西游记', domain: 'literature', briefZh: '中国古典四大名著之一', distillation: { score: 77, grade: 'B', version: '5.0' } },
  { slug: 'mo-zi', name: 'Mozi', nameZh: '墨子', domain: 'philosophy', briefZh: '墨家学派创始人', distillation: { score: 77, grade: 'B', version: '5.0' } },
  { slug: 'peter-thiel', name: 'Peter Thiel', nameZh: '彼得·蒂尔', domain: 'technology', briefZh: 'PayPal创始人，风险投资家', distillation: { score: 77, grade: 'B', version: '5.0' } },
  { slug: 'wittgenstein', name: 'Wittgenstein', nameZh: '维特根斯坦', domain: 'philosophy', briefZh: '分析哲学代表人物', distillation: { score: 76, grade: 'B', version: '5.0' } },
  { slug: 'naval-ravikant', name: 'Naval Ravikant', nameZh: '纳瓦尔·拉威康特', domain: 'investment', briefZh: 'AngelList创始人', distillation: { score: 76, grade: 'B', version: '5.0' } },
  { slug: 'ray-dalio', name: 'Ray Dalio', nameZh: '瑞·达利欧', domain: 'investment', briefZh: '桥水基金创始人', distillation: { score: 76, grade: 'B', version: '5.0' } },
  { slug: 'john-maynard-keynes', name: 'John Maynard Keynes', nameZh: '凯恩斯', domain: 'economics', briefZh: '宏观经济学奠基人', distillation: { score: 75, grade: 'B', version: '5.0' } },
  { slug: 'warren-buffett', name: 'Warren Buffett', nameZh: '沃伦·巴菲特', domain: 'investment', briefZh: '伯克希尔·哈撒韦董事长', distillation: { score: 75, grade: 'B', version: '5.0' } },
  { slug: 'carl-jung', name: 'Carl Jung', nameZh: '卡尔·荣格', domain: 'psychology', briefZh: '分析心理学创始人', distillation: { score: 74, grade: 'B', version: '5.0' } },
  { slug: 'nietzsche', name: 'Nietzsche', nameZh: '尼采', domain: 'philosophy', briefZh: '德国哲学家', distillation: { score: 74, grade: 'B', version: '5.0' } },
  { slug: 'aleister-crowley', name: 'Aleister Crowley', nameZh: '阿莱斯特·克劳利', domain: 'spirituality', briefZh: '神秘学家', distillation: { score: 72, grade: 'B', version: '5.0' } },
  { slug: 'einstein', name: 'Albert Einstein', nameZh: '爱因斯坦', domain: 'science', briefZh: '相对论创立者', distillation: { score: 72, grade: 'B', version: '5.0' } },
  { slug: 'osamu-dazai', name: 'Osamu Dazai', nameZh: '太宰治', domain: 'literature', briefZh: '日本战后文学代表作家', distillation: { score: 70, grade: 'B', version: '5.0' } },
  { slug: 'mrbeast', name: 'MrBeast', nameZh: 'MrBeast', domain: 'business', briefZh: 'YouTube顶流博主', distillation: { score: 70, grade: 'B', version: '5.0' } },
  { slug: 'alan-turing', name: 'Alan Turing', nameZh: '艾伦·图灵', domain: 'science', briefZh: '计算机科学之父', distillation: { score: 68, grade: 'C', version: '5.0' } },
  { slug: 'ilya-sutskever', name: 'Ilya Sutskever', nameZh: 'Ilya Sutskever', domain: 'technology', briefZh: 'OpenAI联合创始人', distillation: { score: 65, grade: 'C', version: '5.0' } },
  { slug: 'andrej-karpathy', name: 'Andrej Karpathy', nameZh: 'Andrej Karpathy', domain: 'technology', briefZh: '深度学习先驱', distillation: { score: 65, grade: 'C', version: '5.0' } },
  { slug: 'ni-haixia', name: 'Ni Haixia', nameZh: '倪海厦', domain: 'medicine', briefZh: '中医临床学家', distillation: { score: 60, grade: 'C', version: '5.0' } },
];

interface CorpusStats {
  textSizeMB: number;
  fileCount: number;
}

interface PersonaTier {
  slug: string;
  tier: 'FREE' | 'MONTHLY' | 'LIFETIME';
  grade: string;
  score: number;
  corpusMB: number;
  files: number;
}

const PERSONAS = Object.fromEntries(PERSONA_REGISTRY.map(p => [p.slug, p]));

async function getCorpusStats(slug: string): Promise<CorpusStats> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const base = join(__dirname, '../corpus', slug, 'texts');
  try {
    const entries = await readdir(base);
    const txtFiles = entries.filter(f => f.endsWith('.txt'));
    let totalBytes = 0;
    for (const f of txtFiles) {
      try {
        totalBytes += (await stat(join(base, f))).size;
      } catch { /* skip */ }
    }
    return {
      textSizeMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
      fileCount: txtFiles.length,
    };
  } catch {
    return { textSizeMB: 0, fileCount: 0 };
  }
}

function assignTier(grade: string, score: number): 'FREE' | 'MONTHLY' | 'LIFETIME' {
  if (grade === 'A' || score >= 85) return 'LIFETIME';
  if (grade === 'B' || (score >= 70 && score < 85)) return 'MONTHLY';
  return 'FREE';
}

function makeId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function makeIdentityPrompt(p: typeof PERSONA_REGISTRY[0]): string {
  return `你是 ${p.nameZh || p.name}，${p.briefZh || p.brief || '一位有独特思想的人物。'}`;
}

function makeSystemPrompt(p: typeof PERSONA_REGISTRY[0]): string {
  const mms = (p.mentalModels || []).map(m => `· ${m.nameZh || m.name}`).join('\n');
  const vals = (p.values || []).map(v => `· ${v.nameZh || v.name}`).join('\n');
  return `【身份】
你是 ${p.nameZh || p.name}。

【简介】
${p.briefZh || p.brief}

【核心思维模型】
${mms || '（未定义）'}

【价值观】
${vals || '（未定义）'}

请基于以上人物设定，用中文回答用户的问题。`;
}

function extractPersonaData(slug: string, p: typeof PERSONA_REGISTRY[0], stats: CorpusStats): Record<string, unknown> {
  const score = p.distillation?.score ?? 75;
  const grade = p.distillation?.grade ?? 'C';
  const tier = assignTier(grade, score);

  return {
    slug,
    name: p.name || slug,
    nameZh: p.nameZh || p.name || slug,
    nameEn: p.nameEn || p.name || slug,
    domain: Array.isArray(p.domain) ? p.domain[0] : (p.domain || 'philosophy'),
    tagline: p.tagline || '',
    taglineZh: p.taglineZh || p.tagline || '',
    avatar: p.avatar || '',
    accentColor: p.accentColor || '#6366f1',
    gradientFrom: p.gradientFrom || '#6366f1',
    gradientTo: p.gradientTo || '#8b5cf6',
    brief: (p.brief || '').slice(0, 300),
    briefZh: (p.briefZh || p.brief || '').slice(0, 500),
    mentalModels: JSON.stringify(p.mentalModels || []),
    decisionHeuristics: '[]',
    expressionDNA: '{}',
    values: JSON.stringify(p.values || []),
    antiPatterns: '[]',
    tensions: '[]',
    honestBoundaries: '[]',
    strengths: '[]',
    blindspots: '[]',
    systemPromptTemplate: makeSystemPrompt(p),
    identityPrompt: makeIdentityPrompt(p),
    finalScore: score,
    qualityGrade: grade,
    thresholdPassed: grade !== 'F' && grade !== 'D',
    qualityGateSkipped: false,
    scoreBreakdown: JSON.stringify(p.distillation?.breakdown || {}),
    scoreFindings: '[]',
    corpusItemCount: stats.fileCount,
    corpusTotalWords: Math.round(stats.textSizeMB * 250000),
    corpusSources: JSON.stringify([`corpus/${slug}`]),
    distillVersion: p.distillation?.version || '1.0.0',
    distillDate: new Date().toISOString(),
    isPublished: true,
    isActive: true,
    _tier: tier,
    _corpusMB: stats.textSizeMB,
    _fileCount: stats.fileCount,
  };
}

async function main() {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });

  const dryRun = process.argv.includes('--dry');
  const showPlan = process.argv.includes('--plan');

  console.log('=== Library Persona Seeder ===');
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Show plan: ${showPlan}`);

  const slugs = Object.keys(PERSONAS);
  console.log(`\n  Found ${slugs.length} personas in personas.ts\n`);

  // Collect corpus stats for all slugs
  console.log('  Collecting corpus stats...');
  const allData: PersonaTier[] = [];

  for (const slug of slugs) {
    const p = PERSONAS[slug as keyof typeof PERSONAS];
    if (!p) continue;
    const stats = await getCorpusStats(slug);
    const score = (p as any).distillation?.score ?? 75;
    const grade = (p as any).distillation?.grade ?? 'C';
    const tier = assignTier(grade, score);
    allData.push({ slug, tier, grade, score, corpusMB: stats.textSizeMB, files: stats.fileCount });
  }

  if (showPlan) {
    const counts = { FREE: 0, MONTHLY: 0, LIFETIME: 0 };
    for (const d of allData) counts[d.tier]++;
    console.log('\n  Tier distribution:');
    console.log(`    FREE:     ${counts.FREE} personas`);
    console.log(`    MONTHLY:  ${counts.MONTHLY} personas`);
    console.log(`    LIFETIME: ${counts.LIFETIME} personas`);
    console.log('\n  Grade distribution:');
    const grades: Record<string, number> = {};
    for (const d of allData) grades[d.grade] = (grades[d.grade] || 0) + 1;
    for (const [g, c] of Object.entries(grades)) {
      console.log(`    Grade ${g}: ${c} personas`);
    }
    console.log('\n  Top 10 by corpus size:');
    const top = [...allData].sort((a, b) => b.corpusMB - a.corpusMB).slice(0, 10);
    top.forEach(d => console.log(`    ${d.slug.padEnd(22)} ${d.corpusMB.toFixed(1).padStart(6)} MB  ${d.tier.padEnd(8)} score=${d.score}`));
    return;
  }

  if (dryRun) {
    console.log('  [DRY RUN] Would seed:');
    for (const d of allData) {
      console.log(`    ${d.slug.padEnd(22)} tier=${d.tier.padEnd(8)} grade=${d.grade} score=${d.score} corpus=${d.corpusMB}MB`);
    }
    return;
  }

  // Connect to DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('  Connected to DB');

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const slug of slugs) {
    const p = PERSONAS[slug as keyof typeof PERSONAS];
    if (!p) { skipped++; continue; }

    const stats = await getCorpusStats(slug);
    const sessionId = `seed-${slug}-${Date.now()}`;

    try {
      // Upsert session first
      await pool.query(`
        INSERT INTO distill_sessions (id, "personaName", "personaId", "personaDomain", status, "totalCost", "totalTokens", "completedAt", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4, 'completed', 0, 0, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET status = 'completed', "completedAt" = NOW(), "updatedAt" = NOW()
      `, [sessionId, (p as any).nameZh || p.name || slug, slug, Array.isArray(p.domain) ? p.domain[0] : (p.domain || 'philosophy')]);

      // Build data object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = extractPersonaData(slug, p as any, stats);
      const tier = data._tier as string;
      delete data._tier; delete data._corpusMB; delete data._fileCount;

      // Build explicit column/value arrays for the 26 DB columns
      const dbCols = [
        'id', 'sessionId', 'slug', 'name', 'domain', 'tagline', 'taglineZh', 'avatar',
        'accentColor', 'gradientFrom', 'gradientTo',
        'brief', 'briefZh',
        'mentalModels', 'decisionHeuristics', 'expressionDNA',
        'values', 'antiPatterns', 'tensions',
        'honestBoundaries', 'strengths', 'blindspots',
        'systemPromptTemplate', 'identityPrompt',
        'reasoningStyle', 'decisionFramework', 'keyQuotes', 'lifePhilosophy',
        'finalScore', 'qualityGrade', 'thresholdPassed', 'qualityGateSkipped',
        'corpusItemCount', 'corpusTotalWords', 'corpusSources',
        'distillVersion', 'distillDate', 'isActive', 'isPublished',
        'scoreBreakdown', 'scoreFindings',
        'nameEn', 'nameZh', 'updatedAt',
      ];

      const pId = makeId();
      const paramVals = dbCols.map((col) => {
        if (col === 'id') return pId;
        if (col === 'sessionId') return sessionId;
        if (col === 'updatedAt') return new Date();
        if (col === 'distillDate') return new Date();
        return data[col] ?? null;
      });

      const colList = dbCols.map(c => `"${c}"`).join(', ');
      const paramList = paramVals.map((_, i) => `$${i + 1}`).join(', ');

      const result = await pool.query(`
        INSERT INTO distilled_personas (${colList})
        VALUES (${paramList})
        ON CONFLICT (slug) DO UPDATE SET
          "name" = EXCLUDED."name",
          "nameZh" = EXCLUDED."nameZh",
          "brief" = EXCLUDED.brief,
          "briefZh" = EXCLUDED."briefZh",
          "mentalModels" = EXCLUDED."mentalModels",
          "values" = EXCLUDED.values,
          "strengths" = EXCLUDED.strengths,
          "blindspots" = EXCLUDED.blindspots,
          "systemPromptTemplate" = EXCLUDED."systemPromptTemplate",
          "identityPrompt" = EXCLUDED."identityPrompt",
          "finalScore" = EXCLUDED."finalScore",
          "qualityGrade" = EXCLUDED."qualityGrade",
          "thresholdPassed" = EXCLUDED."thresholdPassed",
          "corpusItemCount" = EXCLUDED."corpusItemCount",
          "corpusTotalWords" = EXCLUDED."corpusTotalWords",
          "distillVersion" = EXCLUDED."distillVersion",
          "isPublished" = EXCLUDED."isPublished",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = NOW()
      `, paramVals);

      if ((result.rowCount ?? 0) > 0) success++;
      else skipped++;

      process.stdout.write(`  [OK] ${slug.padEnd(22)} tier=${tier.padEnd(8)} rows=${result.rowCount}\n`);
    } catch (err: any) {
      console.error(`  [ERROR] ${slug}: ${err.message.slice(0, 100)}`);
      errors++;
    }
  }

  // Also upsert into Persona table (for analytics)
  for (const slug of slugs) {
    const p = PERSONAS[slug as keyof typeof PERSONAS];
    if (!p) continue;
    try {
      await pool.query(`
        INSERT INTO personas (slug, name, "nameZh", description, domain, icon)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          "nameZh" = EXCLUDED."nameZh",
          description = EXCLUDED.description,
          domain = EXCLUDED.domain
      `, [slug, p.name || slug, p.nameZh || p.name || slug, (p.briefZh || p.brief || '').slice(0, 200), Array.isArray(p.domain) ? p.domain[0] : (p.domain || 'philosophy'), p.avatar || null]);
    } catch { /* skip */ }
  }

  await pool.end();

  console.log(`\n=== Seeding Complete ===`);
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
