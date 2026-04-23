/**
 * Fix wittgenstein values[].descriptionZh via LLM translation
 * (The only persona still missing Chinese values)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V4_DIR = join(__dirname, '../corpus/distilled/v4');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE = 'https://api.deepseek.com';

async function translate(text) {
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `翻译为中文（哲学风格）：${text}` }],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });
  const data = await resp.json();
  return data.choices[0]?.message?.content?.trim() || text;
}

async function main() {
  const d = JSON.parse(readFileSync(join(V4_DIR, 'wittgenstein-v4.json'), 'utf-8'));
  const k = d.knowledge || {};

  console.log('Wittgenstein values needing translation:');
  for (let i = 0; i < k.values.length; i++) {
    const v = k.values[i];
    if (!v.descriptionZh || v.descriptionZh.length < 5) {
      console.log(`  [${i}] ${v.name}: "${v.description?.slice(0, 50)}..."`);
    }
  }

  console.log('\nTranslating missing descriptionZh fields...');
  for (let i = 0; i < k.values.length; i++) {
    const v = k.values[i];
    if (!v.descriptionZh || v.descriptionZh.length < 5) {
      const zh = await translate(v.description);
      v.descriptionZh = zh;
      console.log(`  [${i}] "${v.descriptionZh?.slice(0, 50)}..."`);
    }
  }

  const { writeFileSync } = await import('fs');
  writeFileSync(
    join(V4_DIR, 'wittgenstein-v4.json'),
    JSON.stringify(d, null, 2),
    'utf-8'
  );
  console.log('\nSaved wittgenstein-v4.json');
}

main().catch(console.error);
