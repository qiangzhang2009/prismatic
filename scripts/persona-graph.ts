#!/usr/bin/env bun
/**
 * corpus/persona-graph.ts — 跨 Persona 知识图谱构建
 *
 * 扫描 corpus/distilled/v4/ 和 corpus/distilled/v5/ 目录，
 * 提取所有 persona 的思维模型（mentalModels）、价值观（values）、
 * 张力（tensions）中的跨 persona 关联，构建知识图谱。
 *
 * 图谱节点: Persona
 * 图谱边类型:
 *   - same_domain: 同领域 (philosophy, business, science...)
 *   - intellectual_lineage: 思想传承 (Aristotle→Aquinas, 孔子→孟子)
 *   - opposing_view: 对立观点 (Utilitarianism vs Deontology)
 *   - shares_concept: 共享概念 (e.g., "第一性原理" appears in both Musk and Taleb)
 *   - historical_relationship: 历史关联 (Sun Tzu → The Art of War tradition)
 *
 * 输出:
 *   corpus/distilled/persona-graph.json          — 完整图谱数据
 *   corpus/distilled/persona-graph-report.md    — 人类可读报告
 *
 * Usage:
 *   bun run scripts/corpus/persona-graph.ts                    # 构建图谱
 *   bun run scripts/corpus/persona-graph.ts --verbose          # 详细输出
 *   bun run scripts/corpus/persona-graph.ts --output json    # 仅 JSON
 *   bun run scripts/corpus/persona-graph.ts --output md       # 仅 Markdown
 */

import * as fs from 'fs';
import * as path from 'path';

const DISTILLED_DIR = path.join(process.cwd(), 'corpus', 'distilled');
const OUTPUT_JSON = path.join(DISTILLED_DIR, 'persona-graph.json');
const OUTPUT_MD = path.join(DISTILLED_DIR, 'persona-graph-report.md');

// ─── Types ───────────────────────────────────────────────────────────────────

interface PersonaNode {
  id: string;
  name: string;
  nameZh: string;
  version: 'v4' | 'v5';
  domain: string[];
  distillationScore?: number;
  grade?: string;
  mentalModels: string[];    // mental model names (EN)
  mentalModelsZh: string[];  // mental model names (ZH)
  values: string[];          // value names
  tensions: string[];        // tension names
  keywords: string[];        // all extracted keywords
  topBigrams: string[];      // key phrase bigrams
  isHistorical: boolean;      // born > 150 years ago
  primaryLanguage: string;
  crossDomain: string[];
  outgoingEdges: number;      // count for sorting
}

interface PersonaEdge {
  source: string;     // persona id
  target: string;     // persona id
  type: EdgeType;
  weight: number;     // 0-100, confidence of relationship
  sharedConcepts: string[];
  sharedKeywords: string[];
  description: string;
}

type EdgeType =
  | 'same_domain'
  | 'intellectual_lineage'
  | 'opposing_view'
  | 'shares_concept'
  | 'historical_relationship'
  | 'similar_reasoning_pattern'
  | 'shares_tension';

interface PersonaGraph {
  generatedAt: string;
  nodes: PersonaNode[];
  edges: PersonaEdge[];
  statistics: {
    totalPersonas: number;
    totalEdges: number;
    domainDistribution: Record<string, number>;
    edgeTypeDistribution: Record<string, number>;
    mostConnectedPersonas: Array<{ id: string; connections: number }>;
  };
}

// ─── Universal / Stopword Mental Models ───────────────────────────────────────
// Concepts appearing in many personas = low signal. Excluded from edges entirely.
const MM_STOPWORDS = new Set([
  // Stoic / general wisdom
  'dichotomy of control', 'wu wei', 'wu wei (effortless action)', 'wu wei (non-action)',
  'memento mori', 'amor fati', 'dharma', 'dharma (right action)',
  // Systemic / reasoning (very generic)
  'first principles thinking', 'first principles reasoning',
  'first-principles thinking', 'first-principles deconstruction',
  'systemic thinking', 'systemic optimization', 'systemic constraints analysis', 'systemic observation',
  'inversion', 'inversion thinking', 'inversion for problem-solving',
  'feedback loop leverage', 'feedback loop dynamics', 'feedback loop mastery',
  'second-order thinking', 'second-order consequence mapping', 'second-order effects mapping',
  'second-order consequence forecasting',
  'leverage points in complex systems', 'antifragile leverage',
  'constraint-first thinking', 'probabilistic worldview',
  'opportunity cost thinking', 'recognition of invisible work',
  'contextual intelligence over abstract knowledge',
  'incentive structure alignment', 'incentive landscape mapping',
  'leveraged growth', 'iterative refinement',
  // Foundational philosophical concepts that appear everywhere
  'theory of forms', 'categorical imperative', 'hegelian dialectic',
  'śūnyatā (emptiness)', 'śūnyatā', 'sunyata',
  'allegory of the cave',
  // "general" domain placeholder
  'general',
]);

// ─── Domain Inference ─────────────────────────────────────────────────────────

// ─── Persona Name → Domain mapping ──────────────────────────────────────────────
// Explicit domain assignments for well-known historical figures.
const PERSONA_DOMAIN_MAP: Record<string, string[]> = {
  'han-fei-zi': ['philosophy', 'politics'],
  'mencius': ['philosophy', 'politics'],
  'mo-zi': ['philosophy', 'politics'],
  'zhuang-zi': ['philosophy', 'spirituality'],
  'lao-zi': ['philosophy', 'spirituality'],
  'confucius': ['philosophy', 'politics'],
  'sun-tzu': ['military', 'philosophy'],
  'sun-wukong': ['literature'],
  'zhu-bajie': ['literature'],
  'tripitaka': ['spirituality', 'philosophy'],
  'hui-neng': ['spirituality', 'philosophy'],
  'sima-qian': ['history', 'philosophy'],
  'records-grand-historian': ['history'],
  'zhuge-liang': ['military', 'philosophy'],
  'cao-cao': ['military', 'literature'],
  'liu-bei': ['military'],
  'xiang-yu': ['military'],
  'li-chunfeng': ['history', 'science'],
  'shao-yong': ['philosophy'],
  'qu-yuan': ['literature', 'politics'],
  'journey-west': ['literature'],
  'huangdi-neijing': ['science', 'medicine'],
  'three-kingdoms': ['literature', 'history'],
};

// Narrow + specific keywords only. Each domain needs >= 3 distinct hits.
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  philosophy: ['virtue ethics', 'deontology', 'utilitarianism', 'dialectical', 'skepticism', 'existentialism', 'categorical imperative', 'allegory of the cave', 'theory of forms', '辩证法', '形而上学', '中观', '唯识', '心学', '理学', '诸子百家'],
  science: ['quantum mechanics', 'wave function', 'relativistic', 'peer review', 'falsifiable', 'double-slit', '核酸', '演化论', '热力学第二定律', '量子场论', '可证伪性', '同行评审'],
  military: ['attrition warfare', 'encirclement', 'flanking', 'supply chain', 'tactical doctrine', '消耗战', '包围歼灭', '侧翼迂回', '军事后勤', '兵贵神速'],
  spirituality: ['nirvana', 'reincarnation', 'bodhisattva vow', '八正道', '四圣谛', '六度万行', '三昧耶', '轮回转世', '瑜伽行派', '中观学派', '如来藏', '阿赖耶识'],
  literature: ['narrative arc', 'archetype', 'protagonist', 'plot twist', 'foreshadowing', 'tragic hero', '叙事学', '原型批评', '主人公', '情节反转', '悲剧英雄'],
  psychology: ['collective unconscious', 'shadow archetype', 'persona mask', 'emotional complex', 'psychodynamic', '防御机制', '集体无意识', '人格面具', '阴影原型', '情结理论'],
  economics: ['inflation spiral', 'liquidity trap', 'quantitative easing', 'yield curve inversion', '流通性陷阱', '收益率曲线', '量化宽松政策', '财政赤字货币化'],
  history: ['dynastic cycle', 'historiography', 'feudal fragmentation', 'conquest narrative', '王朝兴衰', '编年史学', '封建割据', '征服战争'],
  politics: ['legalism', 'mandate of heaven', 'centralized authority', '无为而治', '礼乐制度', '王霸道杂之', '依法治国'],
  medicine: ['气血', '经络', '阴阳五行', '辨证论治', '脏腑学说'],
  business: ['capital allocation', 'moat', 'monopoly rent', 'creative destruction', 'oligopoly', 'short-selling', 'brand moat', '资本配置', '护城河', '垄断租金', '创造性破坏'],
};

function inferDomain(persona: any): string[] {
  const personaId = persona.meta?.personaId ?? persona.personaId ?? '';

  // 1. Use explicit name mapping for well-known historical figures
  if (PERSONA_DOMAIN_MAP[personaId]) return [...PERSONA_DOMAIN_MAP[personaId]];

  // 2. Fall back to keyword matching — require >= 3 distinct hits
  const domains: string[] = [];
  const allText = [
    persona.persona?.tagline ?? '',
    persona.persona?.taglineZh ?? '',
    ...(persona.knowledge?.mentalModels ?? []).map((m: any) => `${m.name} ${m.nameZh}`),
    ...(persona.knowledge?.values ?? []).map((v: any) => `${v.name} ${v.nameZh}`),
  ].join(' ').toLowerCase();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matches = keywords.filter(kw => allText.includes(kw.toLowerCase())).length;
    if (matches >= 3) domains.push(domain);
  }

  if (domains.length === 0) domains.push('general');
  return domains;
}

// ─── Historical Lineage Map ────────────────────────────────────────────────────

const LINEAGE_MAP: Record<string, { influences: string[]; influencedBy: string[]; opposedBy: string[] }> = {
  // Influences = this persona influences the listed ones (A influences B means A→B)
  'socrates': { influences: ['plato', 'aristotle', 'seneca', 'epictetus', 'marcus-aurelius'], influencedBy: [], opposedBy: [] },
  'plato': { influences: ['aristotle'], influencedBy: ['socrates'], opposedBy: [] },
  'aristotle': { influences: ['aquinas', 'confucianism'], influencedBy: ['plato', 'socrates'], opposedBy: [] },
  'confucius': { influences: ['mencius', 'han-fei-zi', 'mo-zi', 'sima-qian', 'zhuge-liang'], influencedBy: [], opposedBy: ['lao-zi', 'zhuang-zi'] },
  'lao-zi': { influences: ['zhuang-zi', 'hui-neng', 'tripitaka'], influencedBy: [], opposedBy: ['confucius'] },
  'zhuang-zi': { influences: [], influencedBy: ['lao-zi'], opposedBy: ['confucius'] },
  'seneca': { influences: ['marcus-aurelius'], influencedBy: ['socrates', 'plato'], opposedBy: [] },
  'epictetus': { influences: ['marcus-aurelius'], influencedBy: ['socrates'], opposedBy: [] },
  'marcus-aurelius': { influences: [], influencedBy: ['socrates', 'seneca', 'epictetus'], opposedBy: [] },
  'mencius': { influences: [], influencedBy: ['confucius'], opposedBy: ['mo-zi'] },
  'sun-tzu': { influences: ['zhuge-liang', 'cao-cao', 'liu-bei'], influencedBy: [], opposedBy: [] },
  'nietzsche': { influences: [], influencedBy: ['schopenhauer'], opposedBy: [] },
  'carl-jung': { influences: [], influencedBy: ['freud'], opposedBy: [] },
  'alan-turing': { influences: [], influencedBy: [], opposedBy: [] },
  'nassim-taleb': { influences: [], influencedBy: ['nietzsche', 'seneca'], opposedBy: [] },
};

// ─── Keyword Extraction ────────────────────────────────────────────────────────

const ZH_CHARS = /[\u4e00-\u9fff]/;
const ZH_BIGRAMS = /(?:[\u4e00-\u9fff]{2,4})+/g;
const EN_WORDS = /[a-zA-Z]{3,}/g;

function extractKeywords(text: string): string[] {
  const kw = new Set<string>();
  const zhMatches = text.match(ZH_BIGRAMS) ?? [];
  for (const m of zhMatches) kw.add(m);
  const enMatches = text.match(EN_WORDS) ?? [];
  for (const w of enMatches) kw.add(w.toLowerCase());
  return [...kw];
}

function extractAllKeywords(persona: any): { keywords: string[]; bigrams: string[] } {
  const allText = [
    persona.name,
    persona.nameZh,
    ...(persona.knowledge?.mentalModels ?? []).flatMap((m: any) => [m.name, m.nameZh, m.crossDomain?.join(' ')]),
    ...(persona.knowledge?.values ?? []).flatMap((v: any) => [v.name, v.nameZh]),
    ...(persona.knowledge?.tensions ?? []).flatMap((t: any) => [t.tension, t.tensionZh, t.positivePole, t.negativePole]),
    ...(persona.knowledge?.decisionHeuristics ?? []).flatMap((d: any) => [d.name, d.nameZh]),
    ...(persona.expression?.vocabulary ?? []),
    ...(persona.expression?.sentenceStyle ?? []),
  ].filter(Boolean).join(' ');

  const kwSet = new Set<string>();
  const bgSet = new Set<string>();

  const zhMatches = allText.match(ZH_BIGRAMS) ?? [];
  for (const m of zhMatches) {
    kwSet.add(m);
    bgSet.add(m);
  }

  const enMatches = allText.match(EN_WORDS) ?? [];
  for (const w of enMatches) {
    if (w.length >= 3) kwSet.add(w.toLowerCase());
  }

  return { keywords: [...kwSet], bigrams: [...bgSet] };
}

// ─── Core Graph Builder ────────────────────────────────────────────────────────

function loadDistilledPersonas(): any[] {
  const personas: any[] = [];

  for (const version of ['v5', 'v4'] as const) {
    const dir = path.join(DISTILLED_DIR, version);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json') || file.includes('.expr-backup')) continue;
      const filepath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filepath, 'utf-8');
        const data = JSON.parse(raw);
        personas.push({ ...data, _version: version, _file: file });
      } catch (e: any) {
        console.log(`⚠ Skipping ${file}: ${e.message}`);
      }
    }
  }

  return personas;
}

function buildNode(persona: any): PersonaNode {
  const domains = inferDomain(persona);
  const { keywords, bigrams } = extractAllKeywords(persona);

  // Determine if historical (>150 years old)
  let isHistorical = false;
  const birthYearMatch = (persona.nameZh || persona.name || '').match(/\d{4}/);
  if (birthYearMatch) {
    const year = parseInt(birthYearMatch[0]);
    if (year > 0 && year < 1876) isHistorical = true;
  }

  // v5 JSON: personaId lives at meta.personaId, name at persona.name
  const personaId = persona.meta?.personaId ?? persona.personaId ?? 'unknown';
  const name = persona.persona?.name ?? persona.name ?? 'Unknown';
  const nameZh = persona.persona?.nameZh ?? persona.nameZh ?? '';

  return {
    id: personaId,
    name,
    nameZh,
    version: persona._version as 'v4' | 'v5',
    domain: domains,
    distillationScore: persona.score?.overall ?? persona.score ?? undefined,
    grade: persona.grade ?? undefined,
    mentalModels: (persona.knowledge?.mentalModels ?? []).map((m: any) => m.name || m.nameZh || '').filter(Boolean),
    mentalModelsZh: (persona.knowledge?.mentalModels ?? []).map((m: any) => m.nameZh || m.name || '').filter(Boolean),
    values: (persona.knowledge?.values ?? []).map((v: any) => v.name || v.nameZh || '').filter(Boolean),
    tensions: (persona.knowledge?.tensions ?? []).map((t: any) => t.tension || t.tensionZh || '').filter(Boolean),
    keywords,
    topBigrams: bigrams.slice(0, 30),
    isHistorical,
    primaryLanguage: persona.meta?.primaryLanguage ?? persona.primaryLanguage ?? 'en',
    crossDomain: [...new Set((persona.knowledge?.mentalModels ?? []).flatMap((m: any) => m.crossDomain ?? []))],
    outgoingEdges: 0,
  };
}

function buildEdges(nodes: PersonaNode[]): PersonaEdge[] {
  const edges: PersonaEdge[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];

    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const edgeTypes: EdgeType[] = [];
      const sharedConcepts: string[] = [];
      const sharedKeywords: string[] = [];

      // 1. Same domain
      const sharedDomains = a.domain.filter(d => b.domain.includes(d));
      if (sharedDomains.length > 0) {
        edgeTypes.push('same_domain');
        sharedConcepts.push(...sharedDomains);
      }

      // 2. Intellectual lineage
      const lineageA = LINEAGE_MAP[a.id];
      const lineageB = LINEAGE_MAP[b.id];
      if (lineageA) {
        if (lineageA.influences.includes(b.id)) {
          edgeTypes.push('intellectual_lineage');
          sharedConcepts.push(`${a.id}→${b.id}`);
        }
        if (lineageA.opposedBy.includes(b.id)) {
          edgeTypes.push('opposing_view');
          sharedConcepts.push(`${a.id} vs ${b.id}`);
        }
      }
      if (lineageB) {
        if (lineageB.influences.includes(a.id)) {
          edgeTypes.push('intellectual_lineage');
          sharedConcepts.push(`${b.id}→${a.id}`);
        }
        if (lineageB.opposedBy.includes(a.id)) {
          edgeTypes.push('opposing_view');
          sharedConcepts.push(`${b.id} vs ${a.id}`);
        }
      }

      // 3. Shared keywords (semantic similarity)
      const kwA = new Set(a.keywords.map(k => k.toLowerCase()));
      const kwB = new Set(b.keywords.map(k => k.toLowerCase()));
      let kwOverlap = 0;
      for (const k of kwA) { if (kwB.has(k)) { kwOverlap++; sharedKeywords.push(k); } }

      // Shared bigrams
      const bgA = new Set(a.topBigrams.map(bg => bg.toLowerCase()));
      const bgB = new Set(b.topBigrams.map(bg => bg.toLowerCase()));
      let bgOverlap = 0;
      for (const bg of bgA) { if (bgB.has(bg)) { bgOverlap++; sharedKeywords.push(bg); } }

      // 4. Shares concept — overlap in mental model names (stopwords excluded)
      const mmNormA = a.mentalModels.filter(m => !MM_STOPWORDS.has(m.toLowerCase())).map(m => m.toLowerCase());
      const mmNormB = b.mentalModels.filter(m => !MM_STOPWORDS.has(m.toLowerCase())).map(m => m.toLowerCase());
      const mmSetA = new Set(mmNormA);
      const mmSetB = new Set(mmNormB);
      const mmOverlap = [...mmSetA].filter(m => mmSetB.has(m)).length;

      if (mmOverlap >= 1) {
        edgeTypes.push('shares_concept');
        sharedConcepts.push(...mmNormA.filter(m => mmSetB.has(m)));
      }

      // 5. Shares tension (stopwords excluded)
      const tenNormA = a.tensions.filter(t => !MM_STOPWORDS.has(t.toLowerCase())).map(t => t.toLowerCase());
      const tenNormB = b.tensions.filter(t => !MM_STOPWORDS.has(t.toLowerCase())).map(t => t.toLowerCase());
      const tenSetA = new Set(tenNormA);
      const tenSetB = new Set(tenNormB);
      const tenOverlap = [...tenSetA].filter(t => tenSetB.has(t)).length;
      if (tenOverlap >= 1) {
        edgeTypes.push('shares_tension');
        sharedConcepts.push(...tenNormA.filter(t => tenSetB.has(t)));
      }

      // Compute weight — structured so rare connections score higher
      let weight = 0;
      if (edgeTypes.includes('intellectual_lineage')) weight += 50;
      if (edgeTypes.includes('opposing_view')) weight += 40;
      if (edgeTypes.includes('shares_concept')) weight += 20 + mmOverlap * 15;
      if (edgeTypes.includes('shares_tension')) weight += 10 + tenOverlap * 10;
      // same_domain only adds a small bonus when paired with real semantic types
      if (edgeTypes.includes('same_domain') && edgeTypes.length > 1) weight += 5;
      // Keyword/bigram overlap only contributes if meaningful
      const kwOverlapCount = [...kwA].filter(k => kwB.has(k)).length;
      if (kwOverlapCount >= 3) weight += Math.min(10, kwOverlapCount);
      const bgOverlapCount = [...bgA].filter(bg => bgB.has(bg)).length;
      if (bgOverlapCount >= 2) weight += Math.min(8, bgOverlapCount);
      weight = Math.min(100, weight);

      // Skip if no meaningful edge type AND weight too low
      const hasSemanticType = edgeTypes.length > 0;
      if (!hasSemanticType || weight < 15) continue;

      // same_domain only edge → upgrade to shares_concept only if weight >= 35
      let finalType = edgeTypes[0];
      if (edgeTypes.length === 1 && edgeTypes[0] === 'same_domain' && weight < 35) continue;

      // Build description
      const typeLabels: Record<EdgeType, string> = {
        same_domain: '同领域',
        intellectual_lineage: '思想传承',
        opposing_view: '对立观点',
        shares_concept: '共享概念',
        historical_relationship: '历史关联',
        similar_reasoning_pattern: '相似思维模式',
        shares_tension: '共享张力',
      };

      const edgeTypeLabels = edgeTypes.map(t => typeLabels[t] || t).join(', ');
      let description = `${a.name} 与 ${b.name} 存在关联: ${edgeTypeLabels}`;
      if (sharedKeywords.length > 0) {
        description += `。共享关键词: ${sharedKeywords.slice(0, 5).join(', ')}`;
      }
      if (sharedConcepts.length > 0) {
        description += `。共享概念: ${[...new Set(sharedConcepts)].slice(0, 5).join(', ')}`;
      }

      const edge: PersonaEdge = {
        source: a.id,
        target: b.id,
        type: edgeTypes[0] || 'similar_reasoning_pattern',
        weight,
        sharedConcepts: [...new Set(sharedConcepts)].slice(0, 10),
        sharedKeywords: [...new Set(sharedKeywords)].slice(0, 20),
        description,
      };

      edges.push(edge);
      a.outgoingEdges++;
      b.outgoingEdges++;
    }
  }

  // Also add explicit lineage edges from LINEAGE_MAP
  for (const [personaId, lineage] of Object.entries(LINEAGE_MAP)) {
    if (!nodeMap.has(personaId)) continue;

    for (const influencedId of lineage.influences) {
      if (!nodeMap.has(influencedId)) continue;
      const exists = edges.find(e => e.source === personaId && e.target === influencedId);
      if (!exists) {
        edges.push({
          source: personaId,
          target: influencedId,
          type: 'intellectual_lineage',
          weight: 80,
          sharedConcepts: [`${personaId}→${influencedId}`],
          sharedKeywords: [],
          description: `${nodeMap.get(personaId)?.name} 的思想影响了 ${nodeMap.get(influencedId)?.name}`,
        });
        nodeMap.get(personaId)!.outgoingEdges++;
        nodeMap.get(influencedId)!.outgoingEdges++;
      }
    }

    for (const opposedId of lineage.opposedBy) {
      if (!nodeMap.has(opposedId)) continue;
      const exists = edges.find(e => e.source === personaId && e.target === opposedId);
      if (!exists) {
        edges.push({
          source: personaId,
          target: opposedId,
          type: 'opposing_view',
          weight: 75,
          sharedConcepts: [`${personaId} vs ${opposedId}`],
          sharedKeywords: [],
          description: `${nodeMap.get(personaId)?.name} 与 ${nodeMap.get(opposedId)?.name} 持对立观点`,
        });
        nodeMap.get(personaId)!.outgoingEdges++;
        nodeMap.get(opposedId)!.outgoingEdges++;
      }
    }
  }

  return edges;
}

// ─── Report Rendering ─────────────────────────────────────────────────────────

function renderMarkdownReport(graph: PersonaGraph): string {
  const today = new Date().toISOString().split('T')[0];

  // Top connected personas
  const topConnected = [...graph.nodes]
    .sort((a, b) => b.outgoingEdges - a.outgoingEdges)
    .slice(0, 15);

  // Domain distribution
  const domainCounts: Record<string, number> = {};
  for (const node of graph.nodes) {
    for (const d of node.domain) {
      domainCounts[d] = (domainCounts[d] ?? 0) + 1;
    }
  }

  // Edge type distribution
  const edgeTypeCounts: Record<string, number> = {};
  for (const edge of graph.edges) {
    edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] ?? 0) + 1;
  }

  // Cluster by domain — each persona appears once per domain at most
  const domainClusters = new Map<string, PersonaNode[]>();
  for (const node of graph.nodes) {
    const seen = new Set<string>();
    for (const d of node.domain) {
      if (!seen.has(d)) {
        seen.add(d);
        if (!domainClusters.has(d)) domainClusters.set(d, []);
        domainClusters.get(d)!.push(node);
      }
    }
  }

  // Strongest edges
  const strongEdges = [...graph.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  const edgeTypeLabels: Record<string, string> = {
    same_domain: '同领域',
    intellectual_lineage: '思想传承',
    opposing_view: '对立观点',
    shares_concept: '共享概念',
    historical_relationship: '历史关联',
    similar_reasoning_pattern: '相似思维模式',
    shares_tension: '共享张力',
  };

  // ── Mental Model Universe ──────────────────────────────────────────────
  const allMMs = new Map<string, { en: string; zh: string; personas: string[] }>();
  for (const node of graph.nodes) {
    for (const mm of node.mentalModels) {
      const key = mm.toLowerCase();
      if (MM_STOPWORDS.has(key)) continue;
      if (!allMMs.has(key)) allMMs.set(key, { en: mm, zh: '', personas: [] });
      allMMs.get(key)!.personas.push(node.name);
    }
    for (const mm of node.mentalModelsZh) {
      const key = mm.toLowerCase();
      if (MM_STOPWORDS.has(key)) continue;
      if (!allMMs.has(key)) allMMs.set(key, { en: '', zh: mm, personas: [] });
    }
  }
  const mmByPopularity = [...allMMs.values()].sort((a, b) => b.personas.length - a.personas.length);

  // ── Cross-Persona Dialogue Recommendations ───────────────────────────────
  // Find edges that are purely "shares_concept" (excluding same_domain) with real MMs
  const dialogueCandidates = [...graph.edges]
    .filter(e => {
      if (e.type !== 'shares_concept' && e.type !== 'opposing_view') return false;
      const realConcepts = e.sharedConcepts.filter(c => !MM_STOPWORDS.has(c.toLowerCase()));
      return realConcepts.length > 0;
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  const DIALOGUE_TEMPLATES: Record<string, string> = {
    shares_concept: '共同持有「{concept}」思维模型，可探讨该模型的边界条件与实践差异',
    opposing_view: '持对立观点，适合「思想实验」式对话',
  };

  // ── Quality Scoreboard ────────────────────────────────────────────────
  const scored = graph.nodes
    .filter(n => n.distillationScore !== undefined)
    .sort((a, b) => (b.distillationScore ?? 0) - (a.distillationScore ?? 0));
  const avgScore = scored.length > 0 ? scored.reduce((s, n) => s + (n.distillationScore ?? 0), 0) / scored.length : 0;

  // ── Render ────────────────────────────────────────────────────────────
  let md = `# 跨 Persona 知识图谱报告

> 生成时间: ${today}
> 节点: ${graph.nodes.length} 个 Persona | 边: ${graph.edges.length} 条关系

## 统计概览

| 指标 | 值 |
|------|-----|
| 总 Persona 数 | ${graph.nodes.length} |
| 总关系数 | ${graph.edges.length} |
| 平均连接度 | ${(graph.edges.length * 2 / graph.nodes.length).toFixed(1)} |
| 思维模型总数（去重） | ${allMMs.size} |
| 平均蒸馏得分 | ${avgScore.toFixed(1)} |

### 关系类型分布

| 关系类型 | 数量 |
|----------|------|
${Object.entries(edgeTypeCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `| ${edgeTypeLabels[t] || t} | ${c} |`).join('\n')}

## 最强关系 (Top 20)

| 权重 | Persona A | Persona B | 类型 | 共享概念 |
|------|-----------|-----------|------|---------|
${strongEdges.map(e => {
  const sourceNode = graph.nodes.find(n => n.id === e.source);
  const targetNode = graph.nodes.find(n => n.id === e.target);
  const realConcepts = e.sharedConcepts.filter(c => !MM_STOPWORDS.has(c.toLowerCase()));
  return `| ${e.weight} | ${sourceNode?.name ?? e.source} | ${targetNode?.name ?? e.target} | ${edgeTypeLabels[e.type] || e.type} | ${realConcepts.slice(0, 3).join(', ') || '—'} |`;
}).join('\n')}

## 中心性排名 (连接度 Top 15)

| 排名 | Persona | 领域 | 连接度 | 蒸馏得分 |
|------|---------|------|--------|---------|
${topConnected.map((n, i) => {
  return `| ${i + 1} | ${n.name} ${n.nameZh ? `(${n.nameZh})` : ''} | ${n.domain.join(', ')} | ${n.outgoingEdges} | ${n.distillationScore ?? '—'} |`;
}).join('\n')}

## 思维模型宇宙

> 统计所有 Persona 的思维模型（排除通用概念），按出现频次排列。

| 思维模型 | 出现次数 | 代表人物 |
|---------|---------|---------|
${mmByPopularity.slice(0, 40).map(mm => {
  const personas = [...new Set(mm.personas)].slice(0, 3).join(', ');
  const label = mm.en || mm.zh;
  return `| ${label} | ${mm.personas.length} | ${personas} |`;
}).join('\n')}

## 推荐对话配对

> 基于共享思维模型或对立观点自动推荐的可对话组合。

| Persona A | Persona B | 推荐理由 | 对话模板 |
|-----------|-----------|---------|---------|
${dialogueCandidates.map(e => {
  const source = graph.nodes.find(n => n.id === e.source);
  const target = graph.nodes.find(n => n.id === e.target);
  const realConcepts = e.sharedConcepts.filter(c => !MM_STOPWORDS.has(c.toLowerCase()));
  const concept = realConcepts[0] || e.sharedConcepts[0] || '—';
  const template = DIALOGUE_TEMPLATES[e.type]?.replace('{concept}', concept) || '';
  return `| ${source?.name ?? e.source} | ${target?.name ?? e.target} | ${template} | ${concept} |`;
}).join('\n')}

## 蒸馏质量排行榜

| 排名 | Persona | 蒸馏得分 | 等级 | 版本 |
|------|---------|---------|------|------|
${scored.slice(0, 20).map((n, i) => {
  return `| ${i + 1} | ${n.name} ${n.nameZh ? `(${n.nameZh})` : ''} | ${n.distillationScore} | ${n.grade ?? '—'} | ${n.version} |`;
}).join('\n')}

## 领域聚类（去重）

`;
  for (const [domain, members] of domainClusters.entries()) {
    if (members.length < 2) continue;
    md += `### ${domain} (${members.length} personas)\n\n`;
    for (const node of members) {
      const mmFiltered = node.mentalModels.filter(m => !MM_STOPWORDS.has(m.toLowerCase()));
      const mmList = mmFiltered.slice(0, 3).join(', ') || '—';
      md += `- **${node.name}** ${node.nameZh ? `(${node.nameZh})` : ''} — 核心: ${mmList}\n`;
    }
    md += '\n';
  }

  // Lineage section
  const lineageEdges = graph.edges.filter(e => e.type === 'intellectual_lineage');
  if (lineageEdges.length > 0) {
    md += `## 思想传承链 (${lineageEdges.length} 条)\n\n`;
    for (const edge of lineageEdges) {
      const source = graph.nodes.find(n => n.id === edge.source);
      const target = graph.nodes.find(n => n.id === edge.target);
      md += `- **${source?.name ?? edge.source}** → **${target?.name ?? edge.target}**\n`;
    }
    md += '\n';
  }

  // Opposition section
  const oppositionEdges = graph.edges.filter(e => e.type === 'opposing_view');
  if (oppositionEdges.length > 0) {
    md += `## 对立观点 (${oppositionEdges.length} 对)\n\n`;
    for (const edge of oppositionEdges) {
      const source = graph.nodes.find(n => n.id === edge.source);
      const target = graph.nodes.find(n => n.id === edge.target);
      md += `- **${source?.name ?? edge.source}** vs **${target?.name ?? edge.target}**\n`;
    }
    md += '\n';
  }

  md += `---\n\n*自动生成 | persona-graph.ts*\n`;
  return md;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function buildGraph(): PersonaGraph {
  console.log('Loading distilled personas...');
  const personas = loadDistilledPersonas();
  console.log(`Loaded ${personas.length} personas`);

  console.log('Building nodes...');
  const nodes = personas.map(p => buildNode(p));
  console.log(`Built ${nodes.length} nodes`);

  console.log('Building edges...');
  const edges = buildEdges(nodes);
  console.log(`Built ${edges.length} edges`);

  // Statistics
  const domainDistribution: Record<string, number> = {};
  for (const node of nodes) {
    for (const d of node.domain) {
      domainDistribution[d] = (domainDistribution[d] ?? 0) + 1;
    }
  }

  const edgeTypeDistribution: Record<string, number> = {};
  for (const edge of edges) {
    edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] ?? 0) + 1;
  }

  const mostConnected = [...nodes]
    .sort((a, b) => b.outgoingEdges - a.outgoingEdges)
    .slice(0, 10)
    .map(n => ({ id: n.id, connections: n.outgoingEdges }));

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    statistics: {
      totalPersonas: nodes.length,
      totalEdges: edges.length,
      domainDistribution,
      edgeTypeDistribution,
      mostConnectedPersonas: mostConnected,
    },
  };
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose'),
  output: args.includes('--output') ? args[args.indexOf('--output') + 1] : 'both',
};

async function main() {
  console.log('=== Persona Graph Builder ===\n');

  const graph = buildGraph();

  if (flags.output === 'json' || flags.output === 'both') {
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(graph, null, 2), 'utf-8');
    console.log(`✅ Graph saved to: ${OUTPUT_JSON}`);
  }

  if (flags.output === 'md' || flags.output === 'both') {
    const report = renderMarkdownReport(graph);
    fs.writeFileSync(OUTPUT_MD, report, 'utf-8');
    console.log(`✅ Report saved to: ${OUTPUT_MD}`);
  }

  // Print summary
  console.log(`\n📊 统计:`);
  console.log(`   Nodes: ${graph.statistics.totalPersonas}`);
  console.log(`   Edges: ${graph.statistics.totalEdges}`);
  console.log(`   Avg connections: ${(graph.statistics.totalEdges * 2 / graph.statistics.totalPersonas).toFixed(1)}`);
  console.log(`\n   Top 5 connected:`);
  for (const { id, connections } of graph.statistics.mostConnectedPersonas.slice(0, 5)) {
    const node = graph.nodes.find(n => n.id === id);
    console.log(`     ${node?.name ?? id}: ${connections} connections`);
  }

  console.log(`\n   Edge types:`);
  for (const [type, count] of Object.entries(graph.statistics.edgeTypeDistribution).sort((a, b) => b[1] - a[1])) {
    const labels: Record<string, string> = {
      same_domain: '同领域', intellectual_lineage: '思想传承', opposing_view: '对立观点',
      shares_concept: '共享概念', historical_relationship: '历史关联',
      similar_reasoning_pattern: '相似思维模式', shares_tension: '共享张力',
    };
    console.log(`     ${labels[type] ?? type}: ${count}`);
  }
}

main().catch(console.error);
