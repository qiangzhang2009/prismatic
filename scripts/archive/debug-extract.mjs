import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V4_DIR = join(__dirname, '../corpus/distilled/v4');

// Test marcus-aurelius extraction
const d = JSON.parse(readFileSync(join(V4_DIR, 'marcus-aurelius-v4.json'), 'utf-8'));

const k = d.knowledge || {};
const p = d.persona || {};

console.log('d.persona exists:', !!d.persona);
console.log('d.knowledge exists:', !!d.knowledge);
console.log('d.knowledge.mentalModels count:', (d.knowledge?.mentalModels || []).length);
console.log('d.persona.mentalModels count:', (d.persona?.mentalModels || []).length);

// Extract like the script does
const mms = (p.mentalModels || k.mentalModels || []).map(m => ({
  oneLinerZh: m.oneLinerZh || m.oneLiner || '',
}));

console.log('\nExtracted oneLinerZh[0]:', mms[0].oneLinerZh?.slice(0, 80));

// Now check: is d.persona.mentalModels overriding d.knowledge.mentalModels?
// d.persona.mentalModels might be the ENGLISH one from personas.ts!
console.log('\nd.persona?.mentalModels?.[0]?.oneLinerZh:', p.mentalModels?.[0]?.oneLinerZh?.slice(0, 80));
console.log('d.knowledge?.mentalModels?.[0]?.oneLinerZh:', k.mentalModels?.[0]?.oneLinerZh?.slice(0, 80));
