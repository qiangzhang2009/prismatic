import * as fs from 'fs';

const PERSONAS_TS = 'src/lib/personas.ts';
const V4_FILE = 'corpus/distilled/v4/wittgenstein-v4.json';

const v4 = JSON.parse(fs.readFileSync(V4_FILE, 'utf-8'));
const p = v4.persona;

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// decisionHeuristics: use zh fields
const dhs = (p.decisionHeuristics || []).map((d: any) => {
  const desc = d.descriptionZh || d.description || '';
  const app = d.applicationZh || d.application || '';
  const ex = d.exampleZh || d.example || '';
  return `{
      id: '${esc(d.id)}',
      name: '${esc(d.name)}',
      nameZh: '${esc(d.nameZh)}',
      description: '${esc(desc)}',
      application: '${esc(app)}'${ex ? `,\n      example: '${esc(ex)}'` : ''}
    }`;
}).join(',\n    ');

// Strip fields not in the Persona MentalModel type (e.g., oneLinerZh, applicationZh)
const KNOWN_MM_FIELDS = ['id','name','nameZh','oneLiner','evidence','crossDomain','application','limitation'];
const mmClean = (p.mentalModels || []).map((m: any) => {
  const cleaned: any = {};
  for (const k of KNOWN_MM_FIELDS) { if (m[k] !== undefined) cleaned[k] = m[k]; }
  return cleaned;
});
// tensions: use zh fields
const tensions = (p.tensions || []).map((t: any) => {
  return {
    dimension: t.dimension || t.dimensionZh || '',
    tensionZh: t.tensionZh || '',
    description: t.description || '',
    descriptionZh: t.descriptionZh || '',
  };
});
// values: strip descriptionZh
const KNOWN_VAL_FIELDS = ['name','nameZh','priority','description'];
const valuesClean = (p.values || []).map((v: any) => {
  const cleaned: any = {};
  for (const k of KNOWN_VAL_FIELDS) { if (v[k] !== undefined) cleaned[k] = v[k]; }
  return cleaned;
});

const block = `// ─── Wittgenstein: Ludwig Wittgenstein ─────────────────────────────────────
PERSONAS['wittgenstein'] = {
  id: 'wittgenstein',
  slug: 'wittgenstein',
  name: '${esc(p.name)}',
  nameZh: '${esc(p.nameZh)}',
  nameEn: '${esc(p.nameEn)}',
  domain: ${JSON.stringify(p.domain || ['philosophy'])},
  tagline: '${esc(p.tagline)}',
  taglineZh: '${esc(p.taglineZh)}',
  avatar: '',
  accentColor: '${esc(p.accentColor || '#6366f1')}',
  gradientFrom: '${esc(p.gradientFrom || '#6366f1')}',
  gradientTo: '${esc(p.gradientTo || '#8b5cf6')}',
  brief: '${esc(p.brief)}',
  briefZh: '${esc(p.briefZh)}',
  mentalModels: ${JSON.stringify(mmClean, null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  decisionHeuristics: [
    ${dhs}
  ],
  expressionDNA: ${JSON.stringify(p.expressionDNA || {}, null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \{/, '  {')},
  values: ${JSON.stringify(valuesClean, null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  antiPatterns: ${JSON.stringify(p.antiPatterns || [])},
  tensions: ${JSON.stringify(tensions, null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  honestBoundaries: ${JSON.stringify(p.honestBoundaries || [], null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  strengths: ${JSON.stringify(p.strengths || [])},
  blindspots: ${JSON.stringify(p.blindspots || [])},
  sources: ${JSON.stringify(p.sources || [], null, 4)
    .split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  researchDate: '${esc(p.researchDate || '2026-04-21')}',
  version: 'v4-88',
  researchDimensions: [],
  systemPromptTemplate: '${esc(p.systemPromptTemplate || '')}',
  identityPrompt: '${esc(p.identityPrompt || '')}',
}`;

const content = fs.readFileSync(PERSONAS_TS, 'utf-8');
const exportMarker = '// ─── Legacy Exports';
const idx = content.indexOf(exportMarker);
if (idx < 0) { console.error('Export marker not found'); process.exit(1); }

const newContent = content.slice(0, idx).trimEnd() + '\n\n' + block + '\n\n' + content.slice(idx);
fs.writeFileSync(PERSONAS_TS, newContent);
console.log('Wittgenstein appended successfully.');
