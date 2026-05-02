'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ArrowRight, ChevronDown, ChevronUp, Search, MessageCircle } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

interface CrossCulturalPanelProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  onNodeSelect: (node: TCMNode | null) => void;
}

// Parallel concepts between TCM and other traditions
const PARALLEL_CONCEPTS = [
  { tcm: '阴阳', western: '四体液（血液/粘液/黄胆汁/黑胆汁）', tradition: '古希腊-希波克拉底', strength: 75, color: '#f59e0b' },
  { tcm: '气', western: 'Prana（呼吸生命能）', tradition: '印度阿育吠陀', strength: 85, color: '#fb923c' },
  { tcm: '经络', western: 'Nadi（能量通道）', tradition: '印度瑜伽/阿育吠陀', strength: 80, color: '#fb923c' },
  { tcm: '五行', western: '三Dosha（Vata/Pitta/Kapha）', tradition: '印度阿育吠陀', strength: 70, color: '#fb923c' },
  { tcm: '脾（消化功能）', western: '消化之火（Agni）', tradition: '印度阿育吠陀', strength: 65, color: '#fb923c' },
  { tcm: '治未病', western: 'Dinacharya（日养生法）/Ritucharya（季养生法）', tradition: '印度阿育吠陀', strength: 80, color: '#fb923c' },
  { tcm: '脏腑', western: '五大元素对应器官', tradition: '古希腊四元素', strength: 55, color: '#f59e0b' },
  { tcm: '六经辨证', western: '体质类型分类（Tridosha）', tradition: '印度阿育吠陀', strength: 60, color: '#fb923c' },
  { tcm: '方证对应', western: 'Prakriti-based prescription（个性化配方）', tradition: '印度阿育吠陀', strength: 55, color: '#fb923c' },
  { tcm: '活血化瘀', western: 'Blood purification（血液净化）', tradition: '古希腊-希波克拉底', strength: 50, color: '#f59e0b' },
];

const SCHOOL_COLORS: Record<string, string> = {
  'theory-founding': '#f59e0b', 'six-channel': '#60a5fa',
  'butu-school': '#d97706', 'hanre-school': '#34d399',
  'gongxie-school': '#6ee7b7', 'ziyin-school': '#a78bfa',
  'wenbu-school': '#f472b6', 'wenbing-school': '#c084fc',
  'huoxue-school': '#fb923c', 'jingfang-school': '#e879f9',
  'pulse-diagnosis': '#38bdf8', 'pulse-classics': '#22d3ee',
  'medical-ethics': '#2dd4bf', 'surgery-acupuncture': '#f87171',
  'pharmacology': '#a3e635', 'integration': '#e879f9',
  'ayurveda': '#fb923c', 'ayurveda-surgery': '#fbbf24',
  'western-medicine': '#94a3b8',
};

export function CrossCulturalPanel({ nodes, edges, onNodeSelect }: CrossCulturalPanelProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'strength' | 'tcm'>('strength');

  const culturalEdges = useMemo(() =>
    edges.filter(e => e.type === 'cross_cultural_resonance'),
    [edges]
  );

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const groupedByTradition = useMemo(() => {
    const groups: Record<string, { tcm: TCMNode; western: TCMNode; strength: number }[]> = {};
    for (const edge of culturalEdges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      // Determine which is western (ayurveda/hippocrates)
      const isAyurveda = (n: TCMNode) =>
        n.medicalSchool === 'ayurveda' || n.medicalSchool === 'ayurveda-surgery';
      const isWestern = (n: TCMNode) =>
        n.medicalSchool === 'western-medicine';

      const tcm = (src.medicalSchool === 'western-medicine' || isAyurveda(src)) ? tgt : src;
      const western = (isAyurveda(tgt) || isWestern(tgt)) ? tgt : src;

      let tradition = '古希腊';
      if (isAyurveda(western) || isAyurveda(tcm)) tradition = '印度阿育吠陀';
      if (isWestern(western)) tradition = '古希腊医学';

      if (!groups[tradition]) groups[tradition] = [];
      groups[tradition].push({ tcm, western, strength: edge.weight });
    }
    return groups;
  }, [culturalEdges, nodeMap]);

  const sortedConcepts = useMemo(() => {
    let filtered = [...PARALLEL_CONCEPTS];
    if (search) {
      filtered = filtered.filter(c =>
        c.tcm.includes(search) || c.western.includes(search) || c.tradition.includes(search)
      );
    }
    if (sortBy === 'strength') filtered.sort((a, b) => b.strength - a.strength);
    else filtered.sort((a, b) => a.tcm.localeCompare(b.tcm));
    return filtered;
  }, [search, sortBy]);

  const traditions = Object.keys(groupedByTradition);

  return (
    <div className="relative w-full h-full overflow-y-auto" style={{
      background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #1a0a00 0%, #050810 50%)',
    }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 pt-8 pb-6" style={{
        background: 'linear-gradient(180deg, rgba(5,8,16,1) 0%, rgba(5,8,16,0) 100%)',
      }}>
        <div className="flex items-center gap-4 mb-2">
          <Globe className="w-6 h-6 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' }} />
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            跨文化共鸣网络
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400/80 border border-amber-500/30 font-mono">
            {culturalEdges.length} 条连接
          </span>
        </div>
        <p className="text-sm text-slate-500 max-w-xl">
          中医思想与古希腊医学、印度阿育吠陀的深层共鸣，揭示人类医学传统的共同智慧
        </p>
      </div>

      <div className="px-8 pb-32 max-w-5xl mx-auto space-y-12">
        {/* Search & Sort */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索概念..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-slate-900/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setSortBy(s => s === 'strength' ? 'tcm' : 'strength')}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            排序：{sortBy === 'strength' ? '共鸣强度' : '中医概念'}
            {sortBy === 'strength' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>

        {/* Concepts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedConcepts.map((concept, i) => (
            <motion.div
              key={concept.tcm}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative rounded-2xl p-5 cursor-pointer group"
              style={{
                background: `linear-gradient(135deg, ${concept.color}08 0%, transparent 60%)`,
                border: `1px solid ${concept.color}25`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${concept.color}50`;
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${concept.color}15 0%, transparent 60%)`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${concept.color}25`;
                (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${concept.color}08 0%, transparent 60%)`;
              }}
            >
              {/* Strength bar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 font-medium">{concept.tradition}</span>
                <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${concept.strength}%` }}
                    transition={{ delay: i * 0.04 + 0.3, duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${concept.color}, ${concept.color}80)`,
                      boxShadow: `0 0 6px ${concept.color}60`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: concept.color }}>
                  {concept.strength}%
                </span>
              </div>

              {/* TCM concept */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${concept.color}20`, color: concept.color }}>
                  中
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{concept.tcm}</p>
                  <p className="text-[10px] text-slate-500">中医核心概念</p>
                </div>
              </div>

              <div className="flex justify-center my-2">
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </div>

              {/* Western concept */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${concept.color}12`, color: concept.color, opacity: 0.8 }}>
                  {concept.tradition.includes('印度') ? '印' : '希'}
                </div>
                <div>
                  <p className="text-sm text-slate-300">{concept.western}</p>
                  <p className="text-[10px] text-slate-600">{concept.tradition}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Connection network by tradition */}
        <div className="space-y-8">
          <h3 className="text-lg font-display font-bold text-white">跨文化人物共鸣图</h3>

          {traditions.map((tradition, ti) => {
            const items = groupedByTradition[tradition] || [];
            const isAyurveda = tradition === '印度阿育吠陀';
            const isGreek = tradition === '古希腊医学';
            const tradColor = isAyurveda ? '#fb923c' : '#f59e0b';

            return (
              <motion.div
                key={tradition}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ti * 0.1 }}
                className="rounded-2xl p-6"
                style={{
                  background: `${tradColor}06`,
                  border: `1px solid ${tradColor}20`,
                }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-2 rounded-full" style={{ background: tradColor, boxShadow: `0 0 8px ${tradColor}` }} />
                  <h4 className="text-base font-semibold" style={{ color: tradColor }}>
                    {tradition}
                  </h4>
                  <span className="text-xs text-slate-500">{items.length} 条共鸣</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(({ tcm, western, strength }, i) => {
                    const tcmColor = SCHOOL_COLORS[tcm.medicalSchool || ''] || '#60a5fa';
                    const wColor = isAyurveda ? '#fb923c' : '#f59e0b';

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02]"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                        onClick={() => onNodeSelect(tcm)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `${tcmColor}20`, color: tcmColor }}
                        >
                          {tcm.nameZh.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{tcm.nameZh}</p>
                          <p className="text-[10px] text-slate-500">{western.nameZh}</p>
                        </div>
                        <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: tradColor }}>
                          {strength}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
