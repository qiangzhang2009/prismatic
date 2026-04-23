// Quick test - check nameZh patterns across v4 files
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const V4_DIR = 'corpus/distilled/v4';
const files = readdirSync(V4_DIR).filter(f => f.endsWith('-v4.json')).sort();

console.log('=== Name Field Analysis ===\n');
for (const file of files) {
  const slug = file.replace('-v4.json', '');
  const data = JSON.parse(readFileSync(join(V4_DIR, file), 'utf8'));
  
  const name = data.persona?.name || '';
  const nameZh = data.persona?.nameZh || '';
  const nameEn = data.persona?.nameEn || '';
  const accent = data.persona?.accentColor || '';
  const route = data.meta?.route || '';
  
  // Check for Chinese characters in name
  const hasChinese = /[\u4e00-\u9fff]/.test(name);
  const hasZh = nameZh.length > 0;
  
  console.log(`${slug}: name="${name}" | nameZh="${nameZh}" | nameEn="${nameEn}" | color=${accent} | route=${route} | zh=${hasChinese || hasZh}`);
}

console.log('\n=== Files needing nameZh extraction ===');
for (const file of files) {
  const slug = file.replace('-v4.json', '');
  const data = JSON.parse(readFileSync(join(V4_DIR, file), 'utf8'));
  const name = data.persona?.name || '';
  const nameZh = data.persona?.nameZh || '';
  if (!nameZh) {
    console.log(`  ${slug}: name="${name}" (no nameZh)`);
  }
}
