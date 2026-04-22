/**
 * Rebuild Wittgenstein persona block from v4 corpus data.
 * Uses v4.knowledge (full rich data) instead of v4.persona (trimmed).
 */
import * as fs from 'fs';

const PERSONAS_TS = 'src/lib/personas.ts';
const V4_FILE = 'corpus/distilled/v4/wittgenstein-v4.json';

const v4 = JSON.parse(fs.readFileSync(V4_FILE, 'utf-8'));
const k = v4.knowledge;      // full knowledge layer (6 MM, 5 DH, etc.)
const p = v4.persona;        // persona identity layer (name, tagline, brief)

// ─── Field serializers ────────────────────────────────────────────────────────

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

// mentalModels: only include fields that exist in the MentalModel type.
// Use zh content (oneLinerZh/applicationZh/limitationZh) for the standard fields.
const mmClean = (k.mentalModels || []).map((m: any) => {
  const cleaned: any = {};
  cleaned.id          = m.id;
  cleaned.name        = m.name;
  cleaned.nameZh      = m.nameZh || m.name || '';
  // Prefer zh for fields without *Zh variant in the type
  cleaned.oneLiner    = m.oneLinerZh  || m.oneLiner    || '';
  cleaned.evidence    = m.evidence    || [];
  cleaned.crossDomain = m.crossDomain || [];
  cleaned.application = m.applicationZh || m.application || '';
  cleaned.limitation = m.limitationZh || m.limitation || '';
  return cleaned;
});

// decisionHeuristics: prefer zh fields
const dhs = (k.decisionHeuristics || []).map((d: any) => {
  const desc   = d.descriptionZh   || d.description   || '';
  const app    = d.applicationZh    || d.application     || '';
  const ex     = d.exampleZh        || d.example         || '';
  return `{
      id: '${esc(d.id)}',
      name: '${esc(d.name || '')}',
      nameZh: '${esc(d.nameZh || d.name || '')}',
      description: '${esc(desc)}',
      application: '${esc(app)}'${ex ? `,\n      example: '${esc(ex)}'` : ''}
    }`;
}).join(',\n    ');

// tensions: use zh fields
const tensions = (k.tensions || []).map((t: any) => ({
  dimension:     t.dimension     || '',
  tensionZh:     t.tensionZh     || t.tension || '',
  description:    t.description   || '',
  descriptionZh:  t.descriptionZh || '',
  positivePole:   t.positivePole  || '',
  negativePole:   t.negativePole  || '',
}));

// values: keep both name and description (en fallback)
const values = (k.values || []).map((v: any) => ({
  name:        v.name       || v.nameZh  || '',
  nameZh:      v.nameZh     || v.name    || '',
  priority:    v.priority   ?? 3,
  description: v.description || v.descriptionZh || '',
}));

// honestBoundaries: prefer zh
const hbs = (k.honestBoundaries || []).map((h: any) => ({
  text:    h.text    || h.textZh  || '',
  textZh:  h.textZh  || h.text    || '',
  reason:  h.reason  || h.reasonZh || '',
  reasonZh:h.reasonZh|| h.reason  || '',
}));

// antiPatterns: prefer zh
const ap = (k.antiPatternsZh || k.antiPatterns || []).map(String);

// strengths: prefer zh
const st = (k.strengthsZh || k.strengths || []).map(String);

// blindspots: prefer zh
const bl = (k.blindspotsZh || k.blindspots || []).map(String);

// sources: keep as-is
const sources = (k.sources || p.sources || []).map((s: any) => ({
  type:        s.type        || 'book',
  title:       s.title       || '',
  description: s.description || '',
}));

// ─── Build block ──────────────────────────────────────────────────────────────

const block =
`// ─── Wittgenstein: Ludwig Wittgenstein ─────────────────────────────────────
PERSONAS['wittgenstein'] = {
  id: 'wittgenstein',
  slug: 'wittgenstein',
  name: '${esc(p.name)}',
  nameZh: '${esc(p.nameZh)}',
  nameEn: '${esc(p.nameEn || p.name)}',
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
    .split('\n').map((l: string, i: number) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  decisionHeuristics: [
    ${dhs}
  ],
  expressionDNA: {
    sentenceStyle: ${JSON.stringify(k.expression?.sentenceStyle  || p.expressionDNA?.sentenceStyle  || [])},
    vocabulary:    ${JSON.stringify(k.expression?.vocabulary     || p.expressionDNA?.vocabulary     || [])},
    forbiddenWords: ${JSON.stringify(k.expression?.forbiddenWords || p.expressionDNA?.forbiddenWords || [])},
    rhythm: '${esc(k.expression?.rhythm || p.expressionDNA?.rhythm || '')}',
    humorStyle: '${esc(k.expression?.humorStyle || p.expressionDNA?.humorStyle || '')}',
    certaintyLevel: '${k.expression?.certaintyLevel || p.expressionDNA?.certaintyLevel || 'low'}',
    rhetoricalHabit: '${esc(k.expression?.rhetoricalHabit || p.expressionDNA?.rhetoricalHabit || '')}',
    quotePatterns: ${JSON.stringify(k.expression?.quotePatterns || p.expressionDNA?.quotePatterns || [])},
    chineseAdaptation: '${esc(k.expression?.chineseAdaptation || p.expressionDNA?.chineseAdaptation || '')}',
    verbalMarkers: ${JSON.stringify(k.expression?.verbalMarkers || p.expressionDNA?.verbalMarkers || [])},
    speakingStyle: '${esc(k.expression?.speakingStyle || p.expressionDNA?.speakingStyle || '')}',
  },
  values: ${JSON.stringify(values, null, 4)
    .split('\n').map((l: string, i: number) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  antiPatterns: ${JSON.stringify(ap)},
  tensions: ${JSON.stringify(tensions, null, 4)
    .split('\n').map((l: string, i: number) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  honestBoundaries: ${JSON.stringify(hbs, null, 4)
    .split('\n').map((l: string, i: number) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  strengths: ${JSON.stringify(st)},
  blindspots: ${JSON.stringify(bl)},
  sources: ${JSON.stringify(sources, null, 4)
    .split('\n').map((l: string, i: number) => i === 0 ? l : '    ' + l).join('\n')
    .replace(/^    \[/, '  [')},
  researchDate: '${esc(p.researchDate || '2026-04-21')}',
  version: 'v4-88',
  researchDimensions: [],
  systemPromptTemplate: '${esc(p.systemPromptTemplate || '')}',
  identityPrompt: '${esc(p.identityPrompt || '')}',
}
`;

// ─── Patch personas.ts ─────────────────────────────────────────────────────────

const content = fs.readFileSync(PERSONAS_TS, 'utf-8');

// Find existing wittgenstein block
const startMarker = "// ─── Wittgenstein: Ludwig Wittgenstein";
const endMarker  = "// ─── Legacy Exports";
const startIdx = content.indexOf(startMarker);
const endIdx   = content.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) {
  console.error('ERROR: could not find wittgenstein block or export marker');
  process.exit(1);
}

const newContent = content.slice(0, startIdx) + block + '\n\n' + content.slice(endIdx);
fs.writeFileSync(PERSONAS_TS, newContent);
console.log('Wittgenstein block rebuilt successfully.');
console.log(`  mentalModels: ${mmClean.length}`);
console.log(`  decisionHeuristics: ${(k.decisionHeuristics || []).length}`);
console.log(`  values: ${values.length}`);
console.log(`  tensions: ${tensions.length}`);
console.log(`  honestBoundaries: ${hbs.length}`);
