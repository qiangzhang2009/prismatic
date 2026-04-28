#!/usr/bin/env node
/**
 * Fix nameZh in DB — update from English to Chinese for all distilled_personas.
 * Column name is "nameZh" (camelCase, as per Prisma schema).
 */
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Map: slug → correct Chinese name
// Extracted from src/lib/personas.ts
const NAME_ZH_MAP = {
  'alan-turing': '艾伦·图灵',
  'aleister-crowley': '阿莱斯特·克劳利',
  'carl-jung': '卡尔·荣格',
  'charlie-munger': '查理·芒格',
  'confucius': '孔子',
  'donald-trump': '唐纳德·特朗普',
  'einstein': '阿尔伯特·爱因斯坦',
  'elon-musk': '埃隆·马斯克',
  'epictetus': '爱比克泰德',
  'han-fei-zi': '韩非子',
  'hui-neng': '慧能',
  'jack-ma': '马云',
  'jeff-bezos': '杰夫·贝索斯',
  'jiqun': '济群法师',
  'journey-west': '西游记',
  'marcus-aurelius': '马可·奥勒留',
  'mo-zi': '墨子',
  'naval-ravikant': '纳瓦尔·拉维坎特',
  'ni-haixia': '倪海厦',
  'nikola-tesla': '尼古拉·特斯拉',
  'paul-graham': '保罗·格雷厄姆',
  'peter-thiel': '彼得·蒂尔',
  'qian-xuesen': '钱学森',
  'qu-yuan': '屈原',
  'ray-dalio': '雷·达里奥',
  'richard-feynman': '理查德·费曼',
  'sam-altman': '萨姆·阿尔特曼',
  'seneca': '塞涅卡',
  'sima-qian': '司马迁',
  'sun-tzu': '孙子',
  'sun-wukong': '孙悟空',
  'three-kingdoms': '三国演义',
  'tripitaka': '大唐西域记',
  'warren-buffett': '沃伦·巴菲特',
  'zhang-xuefeng': '张雪峰',
  'zhu-bajie': '猪八戒',
  'zhuge-liang': '诸葛亮',
  // Also fix any hardcoded code personas not in v5
  'steve-jobs': '史蒂夫·乔布斯',
  'zhang-yiming': '张一鸣',
  'nassim-taleb': '纳西姆·塔勒布',
  'andrej-karpathy': '安德烈·卡帕西',
  'ilya-sutskever': '伊利亚·苏茨克维',
  'jensen-huang': '黄仁勋',
  'mrbeast': '野兽先生',
  'kant': '伊曼努尔·康德',
  'alan-watts': '艾伦·瓦茨',
  'wittgenstein': '维特根斯坦',
  'cao-cao': '曹操',
  'john-dee': '约翰·迪伊',
  'lin-yutang': '林语堂',
  'yuan-tiangang': '袁天刚',
  'osamu-dazai': '太宰治',
  'wang-dongyue': '王东岳',
  'john-maynard-keynes': '约翰·梅纳德·凯恩斯',
  'lao-zi': '老子',
  'li-chunfeng': '李淳风',
  'liu-bei': '刘备',
  'mencius': '孟子',
  'huangdi-neijing': '黄帝内经',
  'records-grand-historian': '太史公',
  'zhuangzi': '庄子',
  'lex-fridman': '莱克斯·弗里德曼',
};

async function main() {
  console.log('=== Updating nameZh in Database ===\n');

  // Check current state first
  const before = await pool.query(
    `SELECT slug, "nameZh" FROM distilled_personas ORDER BY slug LIMIT 20`
  );
  console.log('Before:');
  for (const row of before.rows) {
    const hasZh = /[\u4e00-\u9fff]/.test(row.nameZh || '');
    console.log(`  ${hasZh ? '✓' : '✗'} ${row.slug}: "${row.nameZh}"`);
  }

  console.log('\n--- Updating ---\n');

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [slug, nameZh] of Object.entries(NAME_ZH_MAP)) {
    try {
      const r = await pool.query(
        `UPDATE distilled_personas SET "nameZh" = $1, "updatedAt" = NOW() WHERE slug = $2 RETURNING slug`,
        [nameZh, slug]
      );
      if (r.rows.length > 0) {
        console.log(`  ✓ ${slug} → "${nameZh}"`);
        updated++;
      } else {
        console.log(`  — ${slug}: not found in DB`);
        skipped++;
      }
    } catch (err) {
      console.error(`  ✗ ${slug}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);

  // Verify
  console.log(`\n=== Verification ===`);
  const slugs = Object.keys(NAME_ZH_MAP).slice(0, 20);
  const check = await pool.query(
    `SELECT slug, "nameZh" FROM distilled_personas WHERE slug = ANY($1) ORDER BY slug`,
    [slugs]
  );
  for (const row of check.rows) {
    const expected = NAME_ZH_MAP[row.slug];
    const hasZh = /[\u4e00-\u9fff]/.test(row.nameZh || '');
    const match = row.nameZh === expected;
    const status = hasZh && match ? '✓' : hasZh ? '⚠' : '✗';
    console.log(`  ${status} ${row.slug}: "${row.nameZh}" (expected: "${expected}")`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
