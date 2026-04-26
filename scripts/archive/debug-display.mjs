import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONAS_FILE = join(__dirname, '../src/lib/personas.ts');

const content = readFileSync(PERSONAS_FILE, 'utf8');
const result = {};

const entryStartRegex = /PERSONAS\['([^']+)'\]\s*=\s*\{/g;
let match;

while ((match = entryStartRegex.exec(content)) !== null) {
  const slug = match[1];
  const searchStart = match.index + match[0].length;
  const nextEntry = content.indexOf('\nPERSONAS[', searchStart);
  const entryEnd = nextEntry === -1 ? content.length : nextEntry;
  const entryBlock = content.slice(searchStart, entryEnd);

  const extractField = (key) => {
    const re = new RegExp(`${key}:\\s*(?:\\[([^\\]]*)\\]|'([^']*)'|"([^"]*)")`);
    const m = entryBlock.match(re);
    if (!m) return null;
    if (m[1] !== undefined) {
      return (m[1].match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, ''));
    }
    return m[2] || m[3] || null;
  };

  result[slug] = {
    nameZh: extractField('nameZh'),
    taglineZh: extractField('taglineZh'),
    briefZh: extractField('briefZh'),
  };
}

for (const slug of ['marcus-aurelius', 'confucius', 'wittgenstein', 'aleister-crowley', 'huangdi-neijing']) {
  const d = result[slug];
  console.log(`${slug}: nameZh="${d?.nameZh || 'NULL'}" taglineZh="${d?.taglineZh || 'NULL'}" briefZh(len)=${(d?.briefZh || '').length}`);
}
console.log(`\nTotal: ${Object.keys(result).length}`);
