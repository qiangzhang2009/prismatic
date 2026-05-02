'use client';

import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink, ChevronRight, Star, GitBranch, Globe, Users, TrendingUp, Zap, Swords, ArrowRight, MessageCircle, BarChart3, Network } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';
import { MainGraph } from './MainGraph';
import { HeroTimeline } from './HeroTimeline';
import { CrossCulturalPanel } from './CrossCulturalPanel';
import { OppositionDebates } from './OppositionDebates';
import { TheoryEvolution } from './TheoryEvolution';
import { StatsDashboard } from './StatsDashboard';

export type ViewMode = 'graph' | 'timeline' | 'cultural' | 'debates' | 'evolution' | 'stats';

// TCM node IDs that have a corresponding Prismatic persona (verified by slug match)
const HAS_PERSONA = new Set([
  'zhang-zhongjing', 'huangdi', 'sun-simiao', 'li-shizhen', 'hua-tuo',
  'liduomin', 'liudunhou', 'zhadanxin', 'zhudanhsi', 'zhangjingyue',
  'wujutong', 'wangqingren', 'yetianshi', 'bianque', 'wangshuhen',
  'xueshengbai', 'zhangxichun', 'tangzonghai', 'caoyingfu',
  'hippocrates', 'caraka', 'sushruta',
]);

function getPersonaLink(nodeId: string): string | null {
  if (HAS_PERSONA.has(nodeId)) return `/personas/${nodeId}`;
  return null;
}

const SCHOOL_LABELS: Record<string, string> = {
  'theory-founding': '理论奠基期',
  'six-channel': '六经辨证派',
  'butu-school': '补土派',
  'hanre-school': '寒凉派',
  'gongxie-school': '攻邪派',
  'ziyin-school': '滋阴派',
  'wenbu-school': '温补派',
  'wenbing-school': '温病学派',
  'huoxue-school': '活血化瘀派',
  'jingfang-school': '经方派',
  'pulse-diagnosis': '脉诊先驱',
  'pulse-classics': '脉学整理',
  'medical-ethics': '医德体系',
  'surgery-acupuncture': '外科/针灸先驱',
  'pharmacology': '药学集大成',
  'integration': '中西汇通派',
  'ayurveda': '阿育吠陀',
  'ayurveda-surgery': '阿育吠陀外科',
  'western-medicine': '西方医学',
};

const SCHOOL_COLORS: Record<string, string> = {
  'theory-founding': '#f59e0b',
  'six-channel': '#60a5fa',
  'butu-school': '#d97706',
  'hanre-school': '#34d399',
  'gongxie-school': '#6ee7b7',
  'ziyin-school': '#a78bfa',
  'wenbu-school': '#f472b6',
  'wenbing-school': '#c084fc',
  'huoxue-school': '#fb923c',
  'jingfang-school': '#e879f9',
  'pulse-diagnosis': '#38bdf8',
  'pulse-classics': '#22d3ee',
  'medical-ethics': '#2dd4bf',
  'surgery-acupuncture': '#f87171',
  'pharmacology': '#a3e635',
  'integration': '#e879f9',
  'ayurveda': '#fb923c',
  'ayurveda-surgery': '#fbbf24',
  'western-medicine': '#94a3b8',
};

const EDGE_LABELS: Record<string, string> = {
  intellectual_influence: '学术影响',
  textual_lineage: '典籍传承',
  cross_cultural_resonance: '跨文化共鸣',
  school_complementary: '派系互补',
  school_opposition: '派系对立',
  theory_evolution: '理论演进',
};

const EDGE_COLORS: Record<string, string> = {
  intellectual_influence: '#94a3b8',
  textual_lineage: '#60a5fa',
  cross_cultural_resonance: '#fbbf24',
  school_complementary: '#34d399',
  school_opposition: '#ef4444',
  theory_evolution: '#a78bfa',
};

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ReactNode; zh: string }[] = [
  { id: 'graph', label: 'Graph', zh: '知识图谱', icon: <Network className="w-3.5 h-3.5" /> },
  { id: 'timeline', label: 'Timeline', zh: '时间轴', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'cultural', label: 'Culture', zh: '跨文化', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'debates', label: 'Debates', zh: '流派论战', icon: <Swords className="w-3.5 h-3.5" /> },
  { id: 'evolution', label: 'Evolution', zh: '理论演进', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'stats', label: 'Stats', zh: '数据总览', icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

interface TCMAtlasClientProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
}

export function TCMAtlasClient({ nodes, edges }: TCMAtlasClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [selectedNode, setSelectedNode] = useState<TCMNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const personNodes = useMemo(() => nodes.filter(n => n.type === 'person'), [nodes]);
  const textNodes = useMemo(() => nodes.filter(n => n.type === 'text'), [nodes]);

  const substantiveEdgeTypes = new Set([
    'intellectual_influence', 'textual_lineage',
    'school_complementary', 'school_opposition', 'theory_evolution',
  ]);

  // Total degree: all edge types
  const nodeDegreeMap = useMemo(() => {
    const map = new Map<string, number>();
    const counted = new Set<string>();
    for (const n of nodes) map.set(n.id, 0);
    for (const e of edges) {
      const pairKey = [e.source, e.target].sort().join('||');
      if (!counted.has(pairKey)) {
        counted.add(pairKey);
        map.set(e.source, (map.get(e.source) || 0) + 1);
        map.set(e.target, (map.get(e.target) || 0) + 1);
      }
    }
    return map;
  }, [nodes, edges]);

  // Substantive degree: excludes cross_cultural_resonance (resonance is just similarity, not influence)
  const nodeSubstantiveDegreeMap = useMemo(() => {
    const map = new Map<string, number>();
    const counted = new Set<string>();
    for (const n of nodes) map.set(n.id, 0);
    for (const e of edges) {
      if (!substantiveEdgeTypes.has(e.type)) continue;
      const pairKey = [e.source, e.target].sort().join('||');
      if (!counted.has(pairKey)) {
        counted.add(pairKey);
        map.set(e.source, (map.get(e.source) || 0) + 1);
        map.set(e.target, (map.get(e.target) || 0) + 1);
      }
    }
    return map;
  }, [nodes, edges]);

  const getSchoolColor = useCallback((school?: string) => {
    return school && SCHOOL_COLORS[school] ? SCHOOL_COLORS[school] : '#60a5fa';
  }, []);

  const getSchoolLabel = useCallback((school?: string) => {
    return school && SCHOOL_LABELS[school] ? SCHOOL_LABELS[school] : school || '';
  }, []);

  const handleNodeSelect = useCallback((node: TCMNode | null) => {
    setSelectedNode(node);
  }, []);

  const topNodes = useMemo(() => {
    return [...personNodes]
      .sort((a, b) => (nodeSubstantiveDegreeMap.get(b.id) || 0) - (nodeSubstantiveDegreeMap.get(a.id) || 0))
      .slice(0, 10);
  }, [personNodes, nodeSubstantiveDegreeMap]);

  return (
    <div className="relative w-full h-screen pt-14">
      {/* Main view area */}
      <div className="w-full h-full overflow-hidden">
        <AnimatePresence mode="wait">
          <div
            key={viewMode}
            className="w-full h-full"
          >
            {viewMode === 'graph' && (
              <MainGraph
                nodes={nodes}
                edges={edges}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeSelect={handleNodeSelect}
                onNodeHover={setHoveredNode}
                nodeSubstantiveDegreeMap={nodeSubstantiveDegreeMap}
                getSchoolColor={getSchoolColor}
              />
            )}
            {viewMode === 'timeline' && (
              <HeroTimeline
                nodes={personNodes}
                edges={edges}
                onNodeSelect={handleNodeSelect}
                nodeSubstantiveDegreeMap={nodeSubstantiveDegreeMap}
                getSchoolColor={getSchoolColor}
              />
            )}
            {viewMode === 'cultural' && (
              <CrossCulturalPanel
                nodes={personNodes}
                edges={edges}
                onNodeSelect={handleNodeSelect}
              />
            )}
            {viewMode === 'debates' && (
              <OppositionDebates
                nodes={nodes}
                edges={edges}
                onNodeSelect={handleNodeSelect}
                getSchoolColor={getSchoolColor}
              />
            )}
            {viewMode === 'evolution' && (
              <TheoryEvolution
                nodes={nodes}
                edges={edges}
              />
            )}
            {viewMode === 'stats' && (
              <StatsDashboard
                nodes={nodes}
                edges={edges}
                nodeSubstantiveDegreeMap={nodeSubstantiveDegreeMap}
                getSchoolColor={getSchoolColor}
                getSchoolLabel={getSchoolLabel}
                EDGE_LABELS={EDGE_LABELS}
                EDGE_COLORS={EDGE_COLORS}
              />
            )}
          </div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-2xl"
        style={{
          background: 'rgba(5,8,16,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
        }}
      >
        {VIEW_MODES.map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200"
            style={{
              color: viewMode === mode.id ? '#fff' : 'rgba(148,163,184,0.7)',
              background: viewMode === mode.id
                ? `linear-gradient(135deg, ${SCHOOL_COLORS['six-channel']}22, ${SCHOOL_COLORS['ayurveda']}22)`
                : 'transparent',
              border: viewMode === mode.id ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            }}
          >
            {viewMode === mode.id && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${SCHOOL_COLORS['six-channel']}15, ${SCHOOL_COLORS['ayurveda']}15)`,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {mode.icon}
              <span className="hidden sm:inline">{mode.zh}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            connectedEdges={edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)}
            allNodes={nodes}
            getSchoolColor={getSchoolColor}
            getSchoolLabel={getSchoolLabel}
            EDGE_LABELS={EDGE_LABELS}
            EDGE_COLORS={EDGE_COLORS}
            nodeDegree={(nodeDegreeMap.get(selectedNode.id) || 0)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Node Detail Panel ────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node: TCMNode;
  onClose: () => void;
  connectedEdges: TCMEdge[];
  allNodes: TCMNode[];
  getSchoolColor: (school?: string) => string;
  getSchoolLabel: (school?: string) => string;
  EDGE_LABELS: Record<string, string>;
  EDGE_COLORS: Record<string, string>;
  nodeDegree: number;
}

function NodeDetailPanel({
  node, onClose, connectedEdges, allNodes,
  getSchoolColor, getSchoolLabel, EDGE_LABELS, EDGE_COLORS, nodeDegree,
}: NodeDetailPanelProps) {
  const schoolColor = getSchoolColor(node.medicalSchool);
  const schoolLabel = getSchoolLabel(node.medicalSchool);

  const edgesByType = connectedEdges.reduce((acc, e) => {
    const label = EDGE_LABELS[e.type] || e.type;
    if (!acc[label]) acc[label] = [];
    const otherId = e.source === node.id ? e.target : e.source;
    const otherNode = allNodes.find(n => n.id === otherId);
    acc[label].push({ edge: e, other: otherNode });
    return acc;
  }, {} as Record<string, { edge: TCMEdge; other?: TCMNode }[]>);

  const mentalModels = node.mentalModelsZh?.length ? node.mentalModelsZh : (node.mentalModels || []);
  const values = node.valuesZh?.length ? node.valuesZh : (node.values || []);
  const tensions = node.tensionsZh?.length ? node.tensionsZh : (node.tensions || []);

  const crossCulturalNodes = allNodes.filter(n => {
    if (n.id === node.id || n.type !== 'person') return false;
    return connectedEdges.some(e =>
      (e.source === node.id && e.target === n.id && e.type === 'cross_cultural_resonance') ||
      (e.target === node.id && e.source === n.id && e.type === 'cross_cultural_resonance')
    );
  });

  return (
    <div
      className="fixed right-0 top-14 bottom-0 w-96 overflow-y-auto z-40 slide-in-panel"
      style={{
        background: 'rgba(5,8,16,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 px-5 py-4 flex items-start justify-between"
        style={{
          background: 'rgba(5,8,16,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {schoolLabel && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: schoolColor + '18',
                  color: schoolColor,
                  border: `1px solid ${schoolColor}33`,
                }}
              >
                {schoolLabel}
              </span>
            )}
            {node.grade && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                {node.grade}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {nodeDegree} 条连接
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{node.nameZh || node.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{node.era}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Score bar */}
        {node.distillationScore && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">蒸馏质量</span>
              <span className="font-mono text-amber-400">{node.distillationScore}</span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                animate={{ width: `${node.distillationScore}%` }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${schoolColor}, ${schoolColor}88)`,
                  boxShadow: `0 0 8px ${schoolColor}66`,
                }}
              />
            </div>
          </div>
        )}

        {/* Contribution */}
        {node.contribution && (
          <div>
            <p className="text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">人物简介</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {node.contribution.length > 200 ? node.contribution.slice(0, 200) + '…' : node.contribution}
            </p>
          </div>
        )}

        {/* Mental Models */}
        {mentalModels.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-500" />
              核心思维模型
            </div>
            <div className="space-y-1.5">
              {mentalModels.slice(0, 5).map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: schoolColor }} />
                  <span className="text-slate-300 leading-snug">{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Values */}
        {values.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <GitBranch className="w-3 h-3 text-emerald-500" />
              核心价值观
            </div>
            <div className="flex flex-wrap gap-1.5">
              {values.slice(0, 5).map((v, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{
                    background: schoolColor + '15',
                    color: schoolColor,
                    border: `1px solid ${schoolColor}25`,
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cross-cultural connections */}
        {crossCulturalNodes.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-amber-400" />
              跨文化共鸣
            </div>
            <div className="space-y-1">
              {crossCulturalNodes.map((n, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                  <span className="text-slate-300 font-medium">{n.nameZh || n.name}</span>
                  <span className="text-slate-500 text-xs">{n.era}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tensions */}
        {tensions.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">内在张力</p>
            <div className="space-y-2">
              {tensions.slice(0, 3).map((t, i) => (
                <div
                  key={i}
                  className="text-sm text-slate-400 italic border-l-2 pl-3 leading-relaxed"
                  style={{ borderColor: schoolColor + '66' }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections by type */}
        {Object.keys(edgesByType).length > 0 && (
          <div>
            <div className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Users className="w-3 h-3 text-blue-400" />
              关系网络 ({connectedEdges.length})
            </div>
            <div className="space-y-3">
              {Object.entries(edgesByType).map(([type, connections]) => (
                <div key={type}>
                  <div
                    className="text-[10px] font-semibold mb-1 flex items-center gap-1.5"
                    style={{ color: EDGE_COLORS[type] || '#94a3b8' }}
                  >
                    <div className="w-2 h-0.5 rounded-full" style={{ backgroundColor: EDGE_COLORS[type] }} />
                    {type}
                  </div>
                  <div className="space-y-0.5">
                    {connections.map(({ edge, other }, i) => other && (
                      <div key={i} className="flex items-center gap-2 text-sm pl-4">
                        <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <span className="text-slate-300 font-medium">{other.nameZh || other.name}</span>
                        <span className="text-slate-500 text-xs">{other.era}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {node.type === 'person' && (() => {
          const personaLink = getPersonaLink(node.id);
          return (
          <div className="pt-3 border-t border-white/5">
            {personaLink ? (
              <a
                href={personaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${schoolColor}33, ${schoolColor}15)`,
                  color: schoolColor,
                  border: `1px solid ${schoolColor}33`,
                  boxShadow: `0 0 20px ${schoolColor}15`,
                }}
              >
                <MessageCircle className="w-4 h-4" />
                深入了解此人
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            ) : (
              <div
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${schoolColor}15, ${schoolColor}08)`,
                  color: schoolColor,
                  border: `1px solid ${schoolColor}20`,
                }}
              >
                <MessageCircle className="w-4 h-4" />
                蒸馏中 · 敬请期待
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
