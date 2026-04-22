/**
 * V4 Distillation → PERSONAS Registry Updater
 * Replaces existing persona blocks in src/lib/personas.ts with v4 distilled data
 *
 * Usage:
 *   bun run scripts/merge-v4-personas.ts              # Preview
 *   bun run scripts/merge-v4-personas.ts --write      # Write changes
 */

import * as fs from 'fs';
import * as path from 'path';

const V4_DIR = path.join(process.cwd(), 'corpus', 'distilled', 'v4');
const PERSONAS_TS = path.join(process.cwd(), 'src', 'lib', 'personas.ts');
const BACKUP_DIR = path.join(process.cwd(), 'src', 'lib', 'backup');

// ─── Persona Metadata ────────────────────────────────────────────────────────

const PERSONA_META: Record<string, { name: string; nameZh: string; domain: string[]; accentColor: string; gradientFrom: string; gradientTo: string }> = {
  'wittgenstein': { name: 'Ludwig Wittgenstein', nameZh: '路德维希·维特根斯坦', domain: ['philosophy'], accentColor: '#6366f1', gradientFrom: '#6366f1', gradientTo: '#8b5cf6' },
  'alan-turing': { name: 'Alan Turing', nameZh: '艾伦·图灵', domain: ['science', 'philosophy'], accentColor: '#3b82f6', gradientFrom: '#3b82f6', gradientTo: '#60a5fa' },
  'aleister-crowley': { name: 'Aleister Crowley', nameZh: '阿莱斯特·克劳利', domain: ['spirituality'], accentColor: '#8b5cf6', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa' },
  'cao-cao': { name: 'Cao Cao', nameZh: '曹操', domain: ['history'], accentColor: '#dc2626', gradientFrom: '#dc2626', gradientTo: '#f87171' },
  'carl-jung': { name: 'Carl Jung', nameZh: '卡尔·荣格', domain: ['psychology'], accentColor: '#f59e0b', gradientFrom: '#f59e0b', gradientTo: '#fbbf24' },
  'confucius': { name: 'Confucius', nameZh: '孔子', domain: ['philosophy'], accentColor: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a78bfa' },
  'einstein': { name: 'Albert Einstein', nameZh: '阿尔伯特·爱因斯坦', domain: ['science'], accentColor: '#fbbf24', gradientFrom: '#fbbf24', gradientTo: '#fde68a' },
  'epictetus': { name: 'Epictetus', nameZh: '爱比克泰德', domain: ['stoicism'], accentColor: '#059669', gradientFrom: '#059669', gradientTo: '#34d399' },
  'han-fei-zi': { name: 'Han Fei Zi', nameZh: '韩非子', domain: ['strategy', 'philosophy'], accentColor: '#0891b2', gradientFrom: '#0891b2', gradientTo: '#22d3ee' },
  'huangdi-neijing': { name: 'Huang Di Nei Jing', nameZh: '黄帝内经', domain: ['medicine'], accentColor: '#16a34a', gradientFrom: '#16a34a', gradientTo: '#4ade80' },
  'hui-neng': { name: 'Hui Neng', nameZh: '慧能', domain: ['zen-buddhism'], accentColor: '#ca8a04', gradientFrom: '#ca8a04', gradientTo: '#eab308' },
  'jack-ma': { name: 'Jack Ma', nameZh: '马云', domain: ['business'], accentColor: '#ea580c', gradientFrom: '#ea580c', gradientTo: '#fb923c' },
  'jeff-bezos': { name: 'Jeff Bezos', nameZh: '杰夫·贝索斯', domain: ['business'], accentColor: '#2563eb', gradientFrom: '#2563eb', gradientTo: '#60a5fa' },
  'john-maynard-keynes': { name: 'John Maynard Keynes', nameZh: '约翰·梅纳德·凯恩斯', domain: ['economics'], accentColor: '#0d9488', gradientFrom: '#0d9488', gradientTo: '#2dd4bf' },
  'journey-west': { name: 'Journey to the West', nameZh: '西游记', domain: ['literature'], accentColor: '#d97706', gradientFrom: '#d97706', gradientTo: '#fbbf24' },
  'lao-zi': { name: 'Lao Zi', nameZh: '老子', domain: ['philosophy'], accentColor: '#65a30d', gradientFrom: '#65a30d', gradientTo: '#a3e635' },
  'li-chunfeng': { name: 'Li Chunfeng', nameZh: '李淳风', domain: ['history'], accentColor: '#b45309', gradientFrom: '#b45309', gradientTo: '#d97706' },
  'liu-bei': { name: 'Liu Bei', nameZh: '刘备', domain: ['history'], accentColor: '#65a30d', gradientFrom: '#65a30d', gradientTo: '#84cc16' },
  'marcus-aurelius': { name: 'Marcus Aurelius', nameZh: '马可·奥勒留', domain: ['stoicism'], accentColor: '#b45309', gradientFrom: '#b45309', gradientTo: '#d97706' },
  'mencius': { name: 'Mencius', nameZh: '孟子', domain: ['philosophy'], accentColor: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a78bfa' },
  'mo-zi': { name: 'Mo Zi', nameZh: '墨子', domain: ['philosophy'], accentColor: '#0891b2', gradientFrom: '#0891b2', gradientTo: '#22d3ee' },
  'naval-ravikant': { name: 'Naval Ravikant', nameZh: '纳瓦尔·拉维坎特', domain: ['investment', 'philosophy'], accentColor: '#059669', gradientFrom: '#059669', gradientTo: '#34d399' },
  'nikola-tesla': { name: 'Nikola Tesla', nameZh: '尼古拉·特斯拉', domain: ['science'], accentColor: '#0891b2', gradientFrom: '#0891b2', gradientTo: '#22d3ee' },
  'peter-thiel': { name: 'Peter Thiel', nameZh: '彼得·蒂尔', domain: ['investment'], accentColor: '#1e1b4b', gradientFrom: '#1e1b4b', gradientTo: '#4338ca' },
  'qian-xuesen': { name: 'Qian Xuesen', nameZh: '钱学森', domain: ['science'], accentColor: '#dc2626', gradientFrom: '#dc2626', gradientTo: '#f87171' },
  'qu-yuan': { name: 'Qu Yuan', nameZh: '屈原', domain: ['literature', 'philosophy'], accentColor: '#0891b2', gradientFrom: '#0891b2', gradientTo: '#22d3ee' },
  'ray-dalio': { name: 'Ray Dalio', nameZh: '雷·达里奥', domain: ['investment'], accentColor: '#1d4ed8', gradientFrom: '#1d4ed8', gradientTo: '#3b82f6' },
  'records-grand-historian': { name: 'Sima Qian', nameZh: '司马迁', domain: ['history'], accentColor: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a78bfa' },
  'sam-altman': { name: 'Sam Altman', nameZh: '萨姆·阿尔特曼', domain: ['AI'], accentColor: '#10b981', gradientFrom: '#10b981', gradientTo: '#34d399' },
  'seneca': { name: 'Seneca', nameZh: '塞涅卡', domain: ['stoicism'], accentColor: '#b45309', gradientFrom: '#b45309', gradientTo: '#d97706' },
  'shao-yong': { name: 'Shao Yong', nameZh: '邵雍', domain: ['philosophy'], accentColor: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a78bfa' },
  'sima-qian': { name: 'Sima Qian', nameZh: '司马迁', domain: ['history'], accentColor: '#7c3aed', gradientFrom: '#7c3aed', gradientTo: '#a78bfa' },
  'socrates': { name: 'Socrates', nameZh: '苏格拉底', domain: ['philosophy'], accentColor: '#6366f1', gradientFrom: '#6366f1', gradientTo: '#8b5cf6' },
  'sun-tzu': { name: 'Sun Tzu', nameZh: '孙子', domain: ['strategy'], accentColor: '#b45309', gradientFrom: '#b45309', gradientTo: '#d97706' },
  'sun-wukong': { name: 'Sun Wukong', nameZh: '孙悟空', domain: ['fiction'], accentColor: '#dc2626', gradientFrom: '#dc2626', gradientTo: '#f87171' },
  'three-kingdoms': { name: 'Romance of Three Kingdoms', nameZh: '三国演义', domain: ['history', 'literature'], accentColor: '#dc2626', gradientFrom: '#dc2626', gradientTo: '#f87171' },
  'tripitaka': { name: 'Tripitaka', nameZh: '大唐西域记', domain: ['philosophy'], accentColor: '#ca8a04', gradientFrom: '#ca8a04', gradientTo: '#eab308' },
  'wittgenstein': { name: 'Ludwig Wittgenstein', nameZh: '路德维希·维特根斯坦', domain: ['philosophy'], accentColor: '#6366f1', gradientFrom: '#6366f1', gradientTo: '#8b5cf6' },
  'xiang-yu': { name: 'Xiang Yu', nameZh: '项羽', domain: ['history'], accentColor: '#dc2626', gradientFrom: '#dc2626', gradientTo: '#f87171' },
  'zhu-bajie': { name: 'Zhu Bajie', nameZh: '猪八戒', domain: ['fiction'], accentColor: '#ea580c', gradientFrom: '#ea580c', gradientTo: '#fb923c' },
  'zhuang-zi': { name: 'Zhuang Zi', nameZh: '庄子', domain: ['philosophy'], accentColor: '#65a30d', gradientFrom: '#65a30d', gradientTo: '#a3e635' },
  'zhuge-liang': { name: 'Zhuge Liang', nameZh: '诸葛亮', domain: ['strategy', 'history'], accentColor: '#0891b2', gradientFrom: '#0891b2', gradientTo: '#22d3ee' },
};

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84b6f4'];

function getAvatar(name: string, color: string) {
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color.replace('#', '')}&color=fff&bold=true&format=svg`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}

// ─── V4 → Persona Converter ───────────────────────────────────────────────────

function convertV4(personaId: string, v4: any) {
  const meta = PERSONA_META[personaId] ?? {
    name: personaId.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
    nameZh: personaId, domain: ['philosophy'],
    accentColor: AVATAR_COLORS[Math.abs(hashCode(personaId)) % AVATAR_COLORS.length],
    gradientFrom: AVATAR_COLORS[Math.abs(hashCode(personaId)) % AVATAR_COLORS.length],
    gradientTo: '#8b5cf6',
  };
  const { knowledge = {}, expression = {}, score = {}, meta: meta_v4 = {} } = v4;

  const mentalModels = (knowledge.mentalModels ?? []).map((m: any, i: number) => ({
    id: m.id || `mm-${i}`,
    name: m.name || `Model ${i + 1}`,
    nameZh: m.nameZh || m.name || `思维模型${i + 1}`,
    oneLiner: m.oneLiner || m.oneLinerZh || '',
    evidence: (m.evidence ?? []).map((e: any) => ({ quote: e.quote || '', source: e.source || '', year: e.year ?? undefined })),
    crossDomain: m.crossDomain ?? [],
    application: m.application || m.applicationZh || '',
    limitation: m.limitation || m.limitationZh || '',
  }));

  const decisionHeuristics = (knowledge.decisionHeuristics ?? []).map((h: any, i: number) => ({
    id: h.id || `dh-${i}`,
    name: h.name || `Heuristic ${i + 1}`,
    nameZh: h.nameZh || h.name || `决策启发式${i + 1}`,
    description: h.description || h.descriptionZh || '',
    application: h.application || h.applicationZh || '',
    example: h.example || h.exampleZh || '',
  }));

  const values = (knowledge.values ?? []).map((v: any) => ({
    name: v.name || '', nameZh: v.nameZh || v.name || '', priority: v.priority || 3, description: v.description || v.descriptionZh || '',
  }));

  const tensions = (knowledge.tensions ?? []).map((t: any) => ({
    dimension: t.dimension || t.dimensionZh || '', tensionZh: t.tensionZh || t.tension || '',
    description: t.description || '', descriptionZh: t.descriptionZh || t.description || '',
  }));

  const honestBoundaries = (knowledge.honestBoundaries ?? []).map((hb: any) => ({
    text: hb.text || '', textZh: hb.textZh || hb.text || '',
  }));

  const tagline = values[0]?.nameZh || values[0]?.name || meta.nameZh;

  const systemPrompt = `你是${(knowledge.identityPromptZh || knowledge.identityPrompt || meta.nameZh).split('。')[0]}。表达风格：${expression.speakingStyle || expression.tone || 'formal'}。语气：${expression.tone === 'formal' ? '正式严谨' : expression.tone === 'casual' ? '轻松自然' : '中性'}。确信程度：${expression.certaintyLevel === 'high' ? '表达确定果断' : expression.certaintyLevel === 'low' ? '保持适度不确定' : '平衡客观'}。核心价值观：${values.slice(0, 3).map(v => v.nameZh || v.name).filter(Boolean).join('、') || '待定义'}。`;

  return {
    id: personaId, slug: personaId, name: meta.name, nameZh: meta.nameZh, nameEn: meta.name, domain: meta.domain,
    tagline, taglineZh: tagline,
    avatar: getAvatar(meta.name, meta.accentColor),
    accentColor: meta.accentColor, gradientFrom: meta.gradientFrom, gradientTo: meta.gradientTo,
    brief: (knowledge.identityPrompt || '').slice(0, 200),
    briefZh: (knowledge.identityPromptZh || knowledge.identityPrompt || '').slice(0, 200),
    mentalModels, decisionHeuristics,
    expressionDNA: {
      sentenceStyle: expression.sentenceStyle ?? [], vocabulary: expression.vocabulary ?? [],
      forbiddenWords: expression.forbiddenWords ?? [], rhythm: expression.rhythm || expression.rhythmDescription || '',
      humorStyle: '', certaintyLevel: expression.certaintyLevel || 'medium',
      rhetoricalHabit: expression.rhetoricalHabit || '', quotePatterns: expression.quotePatterns ?? [],
      chineseAdaptation: expression.chineseAdaptation || '',
      verbalMarkers: expression.verbalMarkers ?? [], speakingStyle: expression.speakingStyle ?? '',
    },
    values, antiPatterns: knowledge.antiPatterns ?? [], tensions, honestBoundaries,
    strengths: knowledge.strengths ?? [], blindspots: knowledge.blindspots ?? [],
    sources: (knowledge.sources ?? []).map((s: any) => ({ type: s.type || 'book', title: s.title || '', description: s.description || '' })),
    researchDate: meta_v4.createdAt ? new Date(meta_v4.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    version: `v4-${score.overall ?? 0}`,
    researchDimensions: [],
    systemPromptTemplate: systemPrompt,
    identityPrompt: knowledge.identityPrompt || `I am ${meta.name}.`,
  };
}

// ─── TS Code Generator ────────────────────────────────────────────────────────

function esc(s: string): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function sa(arr: string[]): string {
  return arr?.length ? `[${arr.map(v => `'${esc(v)}'`).join(', ')}]` : '[]';
}

function genBlock(id: string, p: any): string {
  return `PERSONAS['${id}'] = {
  id: '${id}',
  slug: '${p.slug}',
  name: '${esc(p.name)}',
  nameZh: '${esc(p.nameZh)}',
  nameEn: '${esc(p.nameEn)}',
  domain: [${p.domain.map((d: string) => `'${d}'`).join(', ')}],
  tagline: '${esc(p.tagline)}',
  taglineZh: '${esc(p.taglineZh)}',
  avatar: '${p.avatar}',
  accentColor: '${p.accentColor}',
  gradientFrom: '${p.gradientFrom}',
  gradientTo: '${p.gradientTo}',
  brief: '${esc(p.brief)}',
  briefZh: '${esc(p.briefZh)}',
  mentalModels: ${p.mentalModels.length ? '[\n' + p.mentalModels.map(m =>
    `    {
      id: '${esc(m.id)}',
      name: '${esc(m.name)}',
      nameZh: '${esc(m.nameZh)}',
      oneLiner: '${esc(m.oneLiner)}',
      evidence: ${m.evidence?.length ? '[' + m.evidence.map(e => `{ quote: '${esc(e.quote)}', source: '${esc(e.source)}', year: ${e.year ?? 'undefined'} }`).join(', ') + ']' : '[]'},
      crossDomain: ${sa(m.crossDomain)},
      application: '${esc(m.application)}',
      limitation: '${esc(m.limitation)}',
    }`).join(',\n') + '\n  ]' : '[]'},
  decisionHeuristics: ${p.decisionHeuristics.length ? '[\n' + p.decisionHeuristics.map(h =>
    `    {
      id: '${esc(h.id)}',
      name: '${esc(h.name)}',
      nameZh: '${esc(h.nameZh)}',
      description: '${esc(h.description)}',
      application: '${esc(h.application)}',
      example: '${esc(h.example)}',
    }`).join(',\n') + '\n  ]' : '[]'},
  expressionDNA: {
    sentenceStyle: ${sa(p.expressionDNA.sentenceStyle)},
    vocabulary: ${sa(p.expressionDNA.vocabulary)},
    forbiddenWords: ${sa(p.expressionDNA.forbiddenWords)},
    rhythm: '${esc(p.expressionDNA.rhythm)}',
    humorStyle: '${esc(p.expressionDNA.humorStyle)}',
    certaintyLevel: '${p.expressionDNA.certaintyLevel || 'medium'}',
    rhetoricalHabit: '${esc(p.expressionDNA.rhetoricalHabit)}',
    quotePatterns: ${sa(p.expressionDNA.quotePatterns)},
    chineseAdaptation: '${esc(p.expressionDNA.chineseAdaptation)}',
    verbalMarkers: ${sa(p.expressionDNA.verbalMarkers ?? [])},
    speakingStyle: '${esc(p.expressionDNA.speakingStyle)}',
  },
  values: ${p.values.length ? '[\n' + p.values.map(v =>
    `    { name: '${esc(v.name)}', nameZh: '${esc(v.nameZh)}', priority: ${v.priority ?? 3}, description: '${esc(v.description)}' }`).join(',\n') + '\n  ]' : '[]'},
  antiPatterns: ${sa(p.antiPatterns)},
  tensions: ${p.tensions.length ? '[\n' + p.tensions.map(t =>
    `    { dimension: '${esc(t.dimension)}', tensionZh: '${esc(t.tensionZh)}', description: '${esc(t.description)}', descriptionZh: '${esc(t.descriptionZh)}' }`).join(',\n') + '\n  ]' : '[]'},
  honestBoundaries: ${p.honestBoundaries.length ? '[\n' + p.honestBoundaries.map(h => `    { text: '${esc(h.text)}', textZh: '${esc(h.textZh)}' }`).join(',\n') + '\n  ]' : '[]'},
  strengths: ${sa(p.strengths)},
  blindspots: ${sa(p.blindspots)},
  sources: ${p.sources.length ? '[\n' + p.sources.map(s => `    { type: '${s.type || 'book'}', title: '${esc(s.title)}', description: '${esc(s.description)}' }`).join(',\n') + '\n  ]' : '[]'},
  researchDate: '${p.researchDate}',
  version: '${p.version}',
  researchDimensions: [],
  systemPromptTemplate: '${esc(p.systemPromptTemplate)}',
  identityPrompt: '${esc(p.identityPrompt)}',
}`;
}

// ─── Reliable Block Replacement ───────────────────────────────────────────────

/**
 * Each PERSONAS block starts with `PERSONAS['id'] = {` and ends with
 * `};` at column 0 (with a preceding newline).
 * We find the first `}\n` after the opening `{` where the `}` is alone on a line.
 */
function replaceBlock(content: string, personaId: string, newBlock: string): string {
  const startStr = `PERSONAS['${personaId}'] = {`;
  const startIdx = content.indexOf(startStr);
  if (startIdx < 0) return content; // not found

  // Walk from the `{`, find `}\n` where `}` is at column 0 of the next line
  const rest = content.slice(startIdx);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '\n') {
      const afterNL = rest.slice(i + 1);
      if (afterNL.startsWith('};')) {
        const endIdx = startIdx + i + 1 + 2; // after `};`
        return content.slice(0, startIdx) + newBlock + content.slice(endIdx);
      }
    }
  }
  return content;
}

function appendBeforeExports(content: string, newBlock: string): string {
  // Find the export functions section
  const exportMarker = '// ─── Legacy Exports';
  const idx = content.indexOf(exportMarker);
  if (idx < 0) {
    // Fallback: just append before the last };
    return content.trimEnd() + '\n\n' + newBlock + '\n';
  }
  // Insert before the export marker, preserving the blank line before it
  const before = content.slice(0, idx).replace(/\n+$/, '');
  return before + '\n\n' + newBlock + '\n\n' + content.slice(idx);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const dryRun = !writeMode;

  if (!fs.existsSync(V4_DIR)) {
    console.error(`V4 dir not found: ${V4_DIR}`); process.exit(1);
  }

  const files = fs.readdirSync(V4_DIR).filter(f => f.endsWith('-v4.json')).sort();
  console.log(`Found ${files.length} v4 files\n`);

  const originalContent = fs.readFileSync(PERSONAS_TS, 'utf-8');
  const exportMarker = '// ─── Legacy Exports';
  const exportIdx = originalContent.indexOf(exportMarker);
  const contentBeforeExports = exportIdx >= 0 ? originalContent.slice(0, exportIdx) : originalContent;

  // Step 1: Find all existing PERSONAS block boundaries in original content
  type Block = { id: string; startIdx: number; endIdx: number };
  const existingBlocks: Block[] = [];
  let searchFrom = 0;
  while (true) {
    const m = contentBeforeExports.slice(searchFrom).match(/PERSONAS\['([^']+)'\]\s*=\s*\{/);
    if (!m) break;
    const id = m[1];
    const blockStart = searchFrom + m.index!;
    const rest = contentBeforeExports.slice(blockStart);
    // Find the next `PERSONAS[` keyword to mark block end
    const nextPersonaMatch = rest.match(/PERSONAS\['/);
    const blockEnd = nextPersonaMatch
      ? blockStart + (nextPersonaMatch.index!)
      : contentBeforeExports.length;
    existingBlocks.push({ id, startIdx: blockStart, endIdx: blockEnd });
    searchFrom = blockEnd;
  }

  // Step 2: Build replacements map and track what to append
  const replacements: Map<number, { id: string; block: string }> = new Map();
  const toAppend: { id: string; block: string }[] = [];

  for (const file of files) {
    const id = file.replace('-v4.json', '');
    const v4 = JSON.parse(fs.readFileSync(path.join(V4_DIR, file), 'utf-8'));
    const p = convertV4(id, v4);
    const tsBlock = genBlock(id, p);
    const score = v4.score?.overall ?? 0;
    const grade = v4.score?.grade ?? '?';
    const route = v4.meta?.route ?? 'unknown';

    const existing = existingBlocks.find(b => b.id === id);
    if (existing) {
      replacements.set(existing.startIdx, { id, block: tsBlock });
      console.log(`[REPLACE] ${id}: ${score}/100 (${grade}) [${route}]`);
    } else {
      toAppend.push({ id, block: tsBlock });
      console.log(`[NEW] ${id}: ${score}/100 (${grade}) [${route}]`);
    }
    console.log(`  MM=${p.mentalModels.length} DH=${p.decisionHeuristics.length} V=${p.values.length} Vocab=${p.expressionDNA.vocabulary.length}`);
  }

  if (dryRun) {
    console.log('\nDry run — use --write to apply');
    return;
  }

  // Step 3: Sort REPLACEMENTS in reverse order (process from bottom up)
  const sortedPositions = Array.from(replacements.keys()).sort((a, b) => b - a);

  // Step 3: Build new content by applying replacements in reverse
  let content = originalContent;
  for (const blockStart of sortedPositions) {
    const { id, block: tsBlock } = replacements.get(blockStart)!;
    // Find actual end in current content (block may have shifted due to prior replacements)
    const currentStartMatch = content.slice(blockStart).match(/PERSONAS\['([^']+)'\]\s*=\s*\{/);
    if (!currentStartMatch) { console.error(`  SKIP: ${id} not found at ${blockStart}`); continue; }
    const actualStart = blockStart + currentStartMatch.index!;
    const rest = content.slice(actualStart);
    const nextPersona = rest.match(/PERSONAS\['/);
    const actualEnd = nextPersona ? actualStart + nextPersona.index! : content.length;
    const newContent = content.slice(0, actualStart) + tsBlock + content.slice(actualEnd);
    console.log(`  Replaced ${id}: ${actualStart}-${actualEnd} (${actualEnd - actualStart} chars)`);
    content = newContent;
  }

  // Step 4: Append NEW personas before the export marker
  if (toAppend.length > 0 && exportIdx >= 0) {
    const before = content.slice(0, exportIdx).replace(/\n+$/, '');
    const after = content.slice(exportIdx);
    content = before + '\n\n' + toAppend.map(t => t.block).join('\n\n') + '\n\n' + after;
    toAppend.forEach(t => console.log(`  Appended new: ${t.id}`));
  }

  if (dryRun) {
    console.log('\nDry run — use --write to apply');
    return;
  }

  // Step 5: Write
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = path.join(BACKUP_DIR, `personas-pre-v4-${Date.now()}.ts`);
  fs.writeFileSync(backupFile, originalContent);
  fs.writeFileSync(PERSONAS_TS, content);
  console.log(`\nBackup: ${backupFile}`);
  console.log(`Written: ${PERSONAS_TS}`);
  console.log(`  Replaced: ${replacements.size} | New: ${toAppend.length}`);
}

main().catch(console.error);
