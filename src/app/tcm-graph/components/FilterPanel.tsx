'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

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
  'western-medicine': '西方医学奠基',
};

const EDGE_LABELS: Record<string, { label: string; color: string }> = {
  intellectual_influence: { label: '学术影响', color: '#94a3b8' },
  textual_lineage: { label: '典籍传承', color: '#60a5fa' },
  cross_cultural_resonance: { label: '跨文化共鸣', color: '#fbbf24' },
  school_complementary: { label: '派系互补', color: '#34d399' },
  school_opposition: { label: '派系对立', color: '#ef4444' },
  theory_evolution: { label: '理论演进', color: '#a78bfa' },
};

const ERA_ORDER = [
  '传说时代', '战国', '东汉', '魏晋', '唐代',
  '金代', '元代', '明代', '清代', '清末', '清末民初', '近代', '古希腊', '古代印度',
];

interface FilterPanelProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  eraFilter: string;
  schoolFilter: string;
  edgeTypeFilter: string;
  onEraChange: (era: string) => void;
  onSchoolChange: (school: string) => void;
  onEdgeTypeChange: (type: string) => void;
}

export function FilterPanel({
  nodes, edges, eraFilter, schoolFilter, edgeTypeFilter,
  onEraChange, onSchoolChange, onEdgeTypeChange,
}: FilterPanelProps) {
  const schools = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach(n => { if (n.medicalSchool) set.add(n.medicalSchool); });
    return [...set].sort((a, b) => {
      const order = Object.keys(SCHOOL_LABELS);
      return (order.indexOf(a)) - (order.indexOf(b));
    });
  }, [nodes]);

  const eras = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach(n => { if (n.era) set.add(n.era); });
    return ERA_ORDER.filter(e => set.has(e));
  }, [nodes]);

  const edgeTypes = useMemo(() => Object.keys(EDGE_LABELS), []);

  const hasActiveFilter = eraFilter || schoolFilter || edgeTypeFilter;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
    >
      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
        <Filter className="w-3 h-3" />
        <span>筛选</span>
      </div>

      {/* Era filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">时代</span>
        <button
          onClick={() => onEraChange('')}
          className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
            !eraFilter ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
          }`}
        >
          全部
        </button>
        {eras.map(era => (
          <button
            key={era}
            onClick={() => onEraChange(eraFilter === era ? '' : era)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
              eraFilter === era ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {era}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-slate-700" />

      {/* School filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">流派</span>
        <button
          onClick={() => onSchoolChange('')}
          className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
            !schoolFilter ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
          }`}
        >
          全部
        </button>
        {schools.map(s => (
          <button
            key={s}
            onClick={() => onSchoolChange(schoolFilter === s ? '' : s)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
              schoolFilter === s ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {SCHOOL_LABELS[s] || s}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-slate-700" />

      {/* Edge type filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">关系</span>
        <button
          onClick={() => onEdgeTypeChange('')}
          className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
            !edgeTypeFilter ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
          }`}
        >
          全部
        </button>
        {edgeTypes.map(t => (
          <button
            key={t}
            onClick={() => onEdgeTypeChange(edgeTypeFilter === t ? '' : t)}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
              edgeTypeFilter === t ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            <div
              className="w-2 h-0.5 rounded-full"
              style={{ backgroundColor: EDGE_LABELS[t]?.color }}
            />
            {EDGE_LABELS[t]?.label}
          </button>
        ))}
      </div>

      {/* Clear all */}
      {hasActiveFilter && (
        <button
          onClick={() => { onEraChange(''); onSchoolChange(''); onEdgeTypeChange(''); }}
          className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 ml-auto"
        >
          <X className="w-3 h-3" />
          清除筛选
        </button>
      )}

      {/* Legend */}
      <div className="w-full flex items-center gap-3 flex-wrap pt-1 border-t border-white/5">
        {Object.entries(EDGE_LABELS).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
