/**
 * Prismatic — Persona Index
 * Lightweight index of all personas with computed stats for the galaxy view.
 */

import { PERSONAS } from './personas';
import type { Persona } from './types';

// ─── Cluster Definitions ───────────────────────────────────────────────────────

type ClusterName =
  | 'chinese_philosophy'
  | 'three_kingdoms'
  | 'journey_west'
  | 'stoic'
  | 'tech_visionaries'
  | 'ai_ml'
  | 'science'
  | 'psychology'
  | 'spirituality'
  | 'modern_thinkers';

export const CLUSTERS: Record<ClusterName, string[]> = {
  chinese_philosophy: ['confucius', 'lao-zi', 'mencius', 'zhuang-zi', 'mo-zi', 'han-fei-zi', 'sun-tzu', 'hui-neng', 'wang-dongyue'],
  three_kingdoms: ['cao-cao', 'liu-bei', 'zhuge-liang', 'xiang-yu'],
  journey_west: ['journey-west', 'sun-wukong', 'zhu-bajie', 'tripitaka'],
  stoic: ['socrates', 'epictetus', 'seneca', 'marcus-aurelius'],
  tech_visionaries: ['steve-jobs', 'elon-musk', 'jeff-bezos', 'jack-ma', 'jensen-huang', 'sam-altman', 'peter-thiel', 'warren-buffett', 'charlie-munger', 'ray-dalio', 'paul-graham', 'nassim-taleb', 'naval-ravikant'],
  ai_ml: ['andrej-karpathy', 'ilya-sutskever', 'nassim-taleb'],
  science: ['richard-feynman', 'alan-turing', 'nikola-tesla', 'einstein', 'qian-xuesen'],
  psychology: ['carl-jung'],
  spirituality: ['alan-watts', 'kant', 'zhuang-zi', 'hui-neng'],
  modern_thinkers: ['naval-ravikant', 'nassim-taleb', 'peter-thiel', 'paul-graham', 'warren-buffett', 'charlie-munger'],
};

// ─── Historical Era Detection ─────────────────────────────────────────────────

interface HistoricalInfo {
  yearOfBirth?: number;
  yearOfDeath?: number;
  isHistorical: boolean;
}

/**
 * Detect historical personas based on name and biographical details.
 * Historical figures typically have birth years before 1900.
 */
function detectHistoricalInfo(persona: Persona): HistoricalInfo {
  // Check biographicalDetails first
  if (persona.biographicalDetails?.born) {
    const born = parseInt(persona.biographicalDetails.born.replace(/\D/g, '').slice(0, 4));
    if (!isNaN(born) && born < 1900) {
      return {
        yearOfBirth: born,
        yearOfDeath: persona.biographicalDetails.born.includes('-')
          ? undefined
          : undefined,
        isHistorical: true,
      };
    }
  }

  // Known historical personas
  const historicalSlugs = new Set([
    'confucius', 'lao-zi', 'mencius', 'zhuang-zi', 'mo-zi', 'han-fei-zi',
    'sun-tzu', 'hui-neng', 'cao-cao', 'liu-bei', 'zhuge-liang', 'xiang-yu',
    'journey-west', 'sun-wukong', 'zhu-bajie', 'tripitaka',
    'socrates', 'epictetus', 'seneca', 'marcus-aurelius',
    'kant', 'wittgenstein', 'einstein', 'alan-turing', 'nikola-tesla',
    'qian-xuesen', 'carl-jung', 'john-dee', 'aleister-crowley',
    'osamu-dazai', 'lin-yutang', 'yuan-tiangang', 'li-chunfeng',
    'qu-yuan', 'sima-qian', 'shao-yong', 'huangdi-neijing',
    'records-grand-historian', 'mrbeast', 'nassim-taleb',
  ]);

  // Known modern personas
  const modernSlugs = new Set([
    'steve-jobs', 'elon-musk', 'jeff-bezos', 'jack-ma', 'jensen-huang',
    'sam-altman', 'peter-thiel', 'warren-buffett', 'charlie-munger',
    'ray-dalio', 'paul-graham', 'nassim-taleb', 'naval-ravikant',
    'andrej-karpathy', 'ilya-sutskever', 'richard-feynman',
    'zhang-yiming', 'ni-haixia',
  ]);

  if (historicalSlugs.has(persona.slug)) {
    return { isHistorical: true };
  }
  if (modernSlugs.has(persona.slug)) {
    return { isHistorical: false };
  }

  // Default: consider anyone not clearly modern as potentially historical
  return { isHistorical: false };
}

// ─── Domain Classification ────────────────────────────────────────────────────

export type DomainCluster =
  | 'philosophy'
  | 'business'
  | 'science'
  | 'spirituality'
  | 'history'
  | 'creativity'
  | 'technology';

export const DOMAIN_CLUSTERS: Record<DomainCluster, { x: number; y: number; label: string; labelZh: string }> = {
  // x = -1 (abstract/philosophical) to +1 (concrete/business)
  // y = -1 (ancient) to +1 (modern)
  philosophy: { x: -0.9, y: 0.0, label: 'Philosophy', labelZh: '哲学' },
  spirituality: { x: -0.7, y: -0.5, label: 'Spirituality', labelZh: '灵性' },
  history: { x: -0.5, y: -0.8, label: 'History', labelZh: '历史' },
  science: { x: 0.2, y: 0.3, label: 'Science', labelZh: '科学' },
  technology: { x: 0.5, y: 0.6, label: 'Technology', labelZh: '科技' },
  business: { x: 0.9, y: 0.4, label: 'Business', labelZh: '商业' },
  creativity: { x: 0.0, y: 0.1, label: 'Creativity', labelZh: '创意' },
};

/**
 * Map persona domain array to primary domain cluster.
 */
function getPrimaryDomainCluster(domains: string[]): DomainCluster {
  const domain = domains[0]?.toLowerCase() || 'philosophy';

  if (['stoicism', 'spirituality', 'zen-buddhism'].some(d => domain.includes(d))) {
    return 'spirituality';
  }
  if (['history', 'literature', 'fiction'].some(d => domain.includes(d))) {
    return 'history';
  }
  if (['science', 'semiconductor', 'AI', 'engineering', 'technology'].some(d => domain.includes(d))) {
    return 'science';
  }
  if (['business', 'investment', 'negotiation', 'leadership', 'product', 'strategy'].some(d => domain.includes(d))) {
    return 'business';
  }
  if (['creativity', 'design', 'psychology'].some(d => domain.includes(d))) {
    return 'creativity';
  }
  if (['philosophy', 'ethics', 'education', 'risk'].some(d => domain.includes(d))) {
    return 'philosophy';
  }

  return 'philosophy';
}

// ─── Persona Index Entry ──────────────────────────────────────────────────────

export interface PersonaIndexEntry {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: string[];
  tagline: string;
  taglineZh: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  mentalModelCount: number;
  vocabularyCount: number;
  tensionCount: number;
  heuristicCount: number;
  sourceCount: number;
  hasDistillationData: boolean;
  briefPreview: string;
  yearOfBirth?: number;
  yearOfDeath?: number;
  isHistorical: boolean;
  primaryDomain: DomainCluster;
  primaryDomainLabel: string;
  cluster?: ClusterName;
  // Position hints for galaxy view
  positionHint?: { x: number; y: number; z?: number };
}

// ─── Build Persona Index ─────────────────────────────────────────────────────

function computePositionHint(
  persona: Persona,
  primaryDomain: DomainCluster,
  historicalInfo: HistoricalInfo,
  cluster?: ClusterName
): { x: number; y: number; z: number } {
  const baseCluster = DOMAIN_CLUSTERS[primaryDomain];

  // Start with domain-based position
  let x = baseCluster.x + (Math.random() - 0.5) * 0.3;
  let y = baseCluster.y + (Math.random() - 0.5) * 0.3;
  let z = (Math.random() - 0.5) * 2;

  // Adjust for historical figures (push towards ancient/left)
  if (historicalInfo.isHistorical) {
    y = Math.min(y, -0.3);
    x = Math.min(x, -0.3);
  }

  // Cluster-specific adjustments
  if (cluster) {
    const clusterOffsets: Record<ClusterName, { x: number; y: number }> = {
      chinese_philosophy: { x: -0.6, y: -0.6 },
      three_kingdoms: { x: -0.4, y: -0.5 },
      journey_west: { x: -0.5, y: -0.4 },
      stoic: { x: -0.7, y: -0.2 },
      tech_visionaries: { x: 0.7, y: 0.5 },
      ai_ml: { x: 0.6, y: 0.7 },
      science: { x: 0.3, y: 0.2 },
      psychology: { x: -0.3, y: 0.1 },
      spirituality: { x: -0.5, y: -0.3 },
      modern_thinkers: { x: 0.5, y: 0.3 },
    };

    const offset = clusterOffsets[cluster];
    x = offset.x + (Math.random() - 0.5) * 0.2;
    y = offset.y + (Math.random() - 0.5) * 0.2;
  }

  // Clamp to valid range
  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));

  return { x, y, z };
}

function findCluster(slug: string): ClusterName | undefined {
  for (const [clusterName, members] of Object.entries(CLUSTERS)) {
    if (members.includes(slug)) {
      return clusterName as ClusterName;
    }
  }
  return undefined;
}

export const PERSONA_INDEX: PersonaIndexEntry[] = Object.values(PERSONAS).map((persona) => {
  const historicalInfo = detectHistoricalInfo(persona);
  const cluster = findCluster(persona.slug);
  const primaryDomain = getPrimaryDomainCluster(persona.domain);
  const positionHint = computePositionHint(persona, primaryDomain, historicalInfo, cluster);

  const vocabularyCount = persona.expressionDNA?.vocabulary?.length ?? 0;
  const distillationData = persona.distillation;
  const briefPreview = persona.briefZh?.slice(0, 100) || persona.brief?.slice(0, 100) || '';

  return {
    id: persona.id,
    slug: persona.slug,
    name: persona.name,
    nameZh: persona.nameZh,
    nameEn: persona.nameEn,
    domain: persona.domain,
    tagline: persona.tagline,
    taglineZh: persona.taglineZh,
    accentColor: persona.accentColor,
    gradientFrom: persona.gradientFrom,
    gradientTo: persona.gradientTo,
    mentalModelCount: persona.mentalModels?.length ?? 0,
    vocabularyCount,
    tensionCount: persona.tensions?.length ?? 0,
    heuristicCount: persona.decisionHeuristics?.length ?? 0,
    sourceCount: persona.sources?.length ?? 0,
    hasDistillationData: !!distillationData,
    briefPreview,
    yearOfBirth: historicalInfo.yearOfBirth,
    yearOfDeath: historicalInfo.yearOfDeath,
    isHistorical: historicalInfo.isHistorical,
    primaryDomain,
    primaryDomainLabel: DOMAIN_CLUSTERS[primaryDomain].labelZh,
    cluster,
    positionHint,
  };
});

// ─── Persona Stats ───────────────────────────────────────────────────────────

export interface PersonaStats {
  slug: string;
  mentalModels: number;
  decisionHeuristics: number;
  tensions: number;
  sources: number;
  vocabularyFingerprint: number;
  hasDistillation: boolean;
  distillationTier?: 1 | 2 | 3;
  thinkingPace?: number;
  communityRating?: number;
}

export function getPersonaStats(slug: string): PersonaStats | null {
  const persona = PERSONAS[slug];
  if (!persona) return null;

  return {
    slug,
    mentalModels: persona.mentalModels?.length ?? 0,
    decisionHeuristics: persona.decisionHeuristics?.length ?? 0,
    tensions: persona.tensions?.length ?? 0,
    sources: persona.sources?.length ?? 0,
    vocabularyFingerprint: persona.expressionDNA?.vocabulary?.length ?? 0,
    hasDistillation: !!persona.distillation,
    distillationTier: persona.distillation?.corpusTier,
    thinkingPace: persona.distillation?.thinkingPace,
    communityRating: persona.playtest?.communityRating,
  };
}

// ─── Graph Data ──────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'persona' | 'concept';
  label: string;
  labelZh: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  slug?: string;
  cluster?: ClusterName;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'shares_cluster' | 'shares_domain' | 'inspired' | 'complements';
  strength: number;
  label?: string;
}

export interface PersonaGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function buildPersonaGraphData(): PersonaGraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Create persona nodes
  for (const entry of PERSONA_INDEX) {
    const size = 0.3 + (entry.mentalModelCount / 20) * 0.3; // 0.3 to 0.6 based on mental models

    nodes.push({
      id: entry.slug,
      type: 'persona',
      label: entry.name,
      labelZh: entry.nameZh,
      x: entry.positionHint?.x ?? 0,
      y: entry.positionHint?.y ?? 0,
      z: entry.positionHint?.z ?? 0,
      size,
      color: entry.accentColor,
      gradientFrom: entry.gradientFrom,
      gradientTo: entry.gradientTo,
      slug: entry.slug,
      cluster: entry.cluster,
    });
  }

  // Create cluster edges
  for (const [clusterName, members] of Object.entries(CLUSTERS)) {
    const cluster = clusterName as ClusterName;
    const strength = 1 / Math.sqrt(members.length); // Smaller clusters = stronger edges

    // Connect each pair of personas in the same cluster
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const source = members[i];
        const target = members[j];

        // Only add edge if both personas exist in our index
        if (PERSONA_INDEX.some(p => p.slug === source) && PERSONA_INDEX.some(p => p.slug === target)) {
          edges.push({
            id: `${source}-${target}`,
            source,
            target,
            type: 'shares_cluster',
            strength,
            label: cluster.replace('_', ' '),
          });
        }
      }
    }
  }

  // Create domain-based edges (connect personas sharing primary domain)
  const domainGroups = new Map<string, string[]>();
  for (const entry of PERSONA_INDEX) {
    const primaryDomain = entry.domain[0] || 'philosophy';
    if (!domainGroups.has(primaryDomain)) {
      domainGroups.set(primaryDomain, []);
    }
    domainGroups.get(primaryDomain)!.push(entry.slug);
  }

  for (const [, members] of Array.from(domainGroups.entries())) {
    if (members.length > 1 && members.length < 10) {
      // Only connect domains with moderate membership
      const strength = 0.3;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const edgeId = `${members[i]}-${members[j]}`;
          // Don't duplicate cluster edges
          if (!edges.some(e => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: members[i],
              target: members[j],
              type: 'shares_domain',
              strength,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}

export const PERSONA_GRAPH_DATA = buildPersonaGraphData();

// ─── Summary Stats ───────────────────────────────────────────────────────────

export interface ConstellationStats {
  totalPersonas: number;
  domainDistribution: Record<string, number>;
  clusterDistribution: Record<string, number>;
  averageMentalModels: number;
  personasWithDistillation: number;
  historicalPersonas: number;
  modernPersonas: number;
}

export function getConstellationStats(): ConstellationStats {
  const domainDistribution: Record<string, number> = {};
  const clusterDistribution: Record<string, number> = {};
  let totalMentalModels = 0;

  for (const entry of PERSONA_INDEX) {
    // Domain distribution
    const primaryDomain = entry.domain[0] || 'philosophy';
    domainDistribution[primaryDomain] = (domainDistribution[primaryDomain] || 0) + 1;

    // Cluster distribution
    if (entry.cluster) {
      clusterDistribution[entry.cluster] = (clusterDistribution[entry.cluster] || 0) + 1;
    }

    totalMentalModels += entry.mentalModelCount;
  }

  return {
    totalPersonas: PERSONA_INDEX.length,
    domainDistribution,
    clusterDistribution,
    averageMentalModels: Math.round(totalMentalModels / PERSONA_INDEX.length * 10) / 10,
    personasWithDistillation: PERSONA_INDEX.filter(p => p.hasDistillationData).length,
    historicalPersonas: PERSONA_INDEX.filter(p => p.isHistorical).length,
    modernPersonas: PERSONA_INDEX.filter(p => !p.isHistorical).length,
  };
}

// ─── Lookup Functions ────────────────────────────────────────────────────────

export function getPersonaBySlug(slug: string): PersonaIndexEntry | undefined {
  return PERSONA_INDEX.find(p => p.slug === slug);
}

export function getPersonasByCluster(cluster: ClusterName): PersonaIndexEntry[] {
  return PERSONA_INDEX.filter(p => p.cluster === cluster);
}

export function getPersonasByDomain(domain: string): PersonaIndexEntry[] {
  return PERSONA_INDEX.filter(p => p.domain.includes(domain));
}

export function searchPersonas(query: string): PersonaIndexEntry[] {
  const q = query.toLowerCase();
  return PERSONA_INDEX.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.nameZh.includes(query) ||
    p.nameEn.toLowerCase().includes(q) ||
    p.tagline.toLowerCase().includes(q) ||
    p.taglineZh.includes(query) ||
    p.domain.some(d => d.toLowerCase().includes(q))
  );
}
