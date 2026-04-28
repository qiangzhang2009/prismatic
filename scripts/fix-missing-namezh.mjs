#!/usr/bin/env node
/**
 * Fix nameZh for personas in v5 corpus files that have NO entry in personas.ts.
 * These need manual name extraction from the v5 files themselves or external knowledge.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V5_DIR = join(__dirname, '../corpus/distilled/v5');

// These are in v5 but not in personas.ts — manually set Chinese names
const MANUAL_NAMES = {
  'laozi': '老子',
  'zhuangzi': '庄子',
  'lex-fridman': '莱克斯·弗里德曼',
  'chinese-classics': '中国经典',
  'greek-classics': '希腊经典',
  'quantangshi': '全唐诗',
};

async function main() {
  const { readdirSync } = await import('fs');
  const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));

  console.log('=== Fixing missing nameZh ===\n');

  for (const [slug, nameZh] of Object.entries(MANUAL_NAMES)) {
    const filePath = join(V5_DIR, `${slug}-v5.json`);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      const persona = data.persona || {};

      const currentNameZh = persona.nameZh || '';
      if (/[\u4e00-\u9fff]/.test(currentNameZh) && currentNameZh === nameZh) {
        console.log(`  ✓ ${slug}: already correct "${currentNameZh}"`);
        continue;
      }

      persona.nameZh = nameZh;
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  ✏ ${slug}: "${currentNameZh}" → "${nameZh}"`);
    } catch (err) {
      console.error(`  ✗ ${slug}: ${err.message}`);
    }
  }

  console.log('\n✅ Done');
}

main();
