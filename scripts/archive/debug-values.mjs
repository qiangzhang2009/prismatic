import { readFileSync } from 'fs';
import { join } from 'path';

const d = JSON.parse(readFileSync(join('corpus/distilled/v4', 'marcus-aurelius-v4.json'), 'utf-8'));

const k = d.knowledge || {};
const p = d.persona || {};

console.log('p.values exists:', !!p.values, 'count:', (p.values||[]).length);
console.log('k.values exists:', !!k.values, 'count:', (k.values||[]).length);
console.log();
console.log('p.values[0]:', JSON.stringify(p.values?.[0], null, 2));
console.log();
console.log('k.values[0]:', JSON.stringify(k.values?.[0], null, 2));
