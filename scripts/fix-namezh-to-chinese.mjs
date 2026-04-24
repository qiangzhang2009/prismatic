import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const updates = [
  ['andrej-karpathy', '安德烈·卡帕西'],
  ['charlie-munger', '查理·芒格'],
  ['elon-musk', '埃隆·马斯克'],
  ['ilya-sutskever', '伊利亚·苏茨克沃'],
  ['jensen-huang', '黄仁勋'],
  ['nassim-taleb', '纳西姆·塔勒布'],
  ['paul-graham', '保罗·格雷厄姆'],
  ['richard-feynman', '理查德·费曼'],
  ['steve-jobs', '史蒂夫·乔布斯'],
  ['warren-buffett', '沃伦·巴菲特'],
  ['zhang-xuefeng', '张雪峰'],
  ['zhang-yiming', '张一鸣'],
];

async function main() {
  for (const [slug, namezh] of updates) {
    const r = await pool.query(
      `UPDATE distilled_personas SET namezh = $1 WHERE slug = $2 RETURNING slug, namezh`,
      [namezh, slug]
    );
    if (r.rows.length > 0) {
      console.log(`✓ ${slug} => ${namezh}`);
    } else {
      console.log(`✗ ${slug} not found`);
    }
  }

  // Verify
  console.log('\n--- Verification ---');
  const slugs = updates.map(u => u[0]);
  const check = await pool.query(
    `SELECT slug, namezh FROM distilled_personas WHERE slug = ANY($1)`,
    [slugs]
  );
  for (const row of check.rows) {
    const hasEn = /^[a-z]/.test(row.namezh || '');
    console.log(`${row.slug}: ${row.namezh}${hasEn ? ' ← STILL ENGLISH!' : ''}`);
  }

  await pool.end();
}

main().catch(console.error);
