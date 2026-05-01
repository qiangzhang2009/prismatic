'use client';

import { motion } from 'framer-motion';
import { X, ExternalLink, ChevronRight, Star, GitBranch, Globe, Users } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

const EDGE_LABELS: Record<string, string> = {
  intellectual_influence: '学术影响',
  textual_lineage: '典籍传承',
  cross_cultural_resonance: '跨文化共鸣',
  school_complementary: '派系互补',
  school_opposition: '派系对立',
  theory_evolution: '理论演进',
};

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

const SCHOOL_COLORS: Record<string, string> = {
  'theory-founding': '#fbbf24',
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
  'ayurveda-surgery': '#fb923c',
  'western-medicine': '#94a3b8',
};

interface NodePanelProps {
  node: TCMNode;
  onClose: () => void;
  connectedEdges: TCMEdge[];
  allNodes: TCMNode[];
}

export function NodePanel({ node, onClose, connectedEdges, allNodes }: NodePanelProps) {
  const schoolColor = node.medicalSchool ? SCHOOL_COLORS[node.medicalSchool] || '#60a5fa' : '#60a5fa';
  const schoolLabel = node.medicalSchool ? SCHOOL_LABELS[node.medicalSchool] || node.medicalSchool : null;

  const edgesByType = connectedEdges.reduce((acc, e) => {
    const label = EDGE_LABELS[e.type] || e.type;
    if (!acc[label]) acc[label] = [];
    const otherId = e.source === node.id ? e.target : e.source;
    const otherNode = allNodes.find(n => n.id === otherId);
    acc[label].push({ edge: e, other: otherNode });
    return acc;
  }, {} as Record<string, { edge: TCMEdge; other?: TCMNode }[]>);

  const mentalModels = node.mentalModelsZh?.length
    ? node.mentalModelsZh
    : node.mentalModels?.length
      ? node.mentalModels
      : [];

  const values = node.valuesZh?.length ? node.valuesZh : (node.values || []);
  const tensions = node.tensionsZh?.length ? node.tensionsZh : (node.tensions || []);

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="panel-hit absolute right-0 top-0 h-full w-80 glass border-l border-white/10 overflow-y-auto z-20"
      style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="sticky top-0 glass border-b border-white/10 px-5 py-4 flex items-start justify-between" style={{ background: 'rgba(15,23,42,0.95)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {schoolLabel && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: schoolColor + '22', color: schoolColor, border: `1px solid ${schoolColor}44` }}
              >
                {schoolLabel}
              </span>
            )}
            {node.grade && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                {node.grade}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white truncate">{node.nameZh || node.name}</h2>
          <p className="text-xs text-slate-400">{node.era}{node.era && node.medicalSchool ? ' · ' : ''}{schoolLabel}</p>
        </div>
        <button onClick={onClose} className="ml-3 p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Contribution */}
        {node.contribution && (
          <div>
            <p className="text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">简介</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {node.contribution.length > 160 ? node.contribution.slice(0, 160) + '…' : node.contribution}
            </p>
          </div>
        )}

        {/* Score */}
        {node.distillationScore && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${node.distillationScore}%`,
                  background: node.distillationScore >= 90 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                              node.distillationScore >= 80 ? 'linear-gradient(90deg, #34d399, #10b981)' :
                              'linear-gradient(90deg, #60a5fa, #3b82f6)'
                }}
              />
            </div>
            <span className="text-xs font-mono text-slate-400">{node.distillationScore}</span>
          </div>
        )}

        {/* Mental Models */}
        {mentalModels.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              核心思维模型
            </p>
            <div className="space-y-1.5">
              {mentalModels.slice(0, 6).map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300 leading-snug">{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Values */}
        {values.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" />
              核心价值观
            </p>
            <div className="flex flex-wrap gap-1.5">
              {values.slice(0, 5).map((v, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tensions */}
        {tensions.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">内在张力</p>
            <div className="space-y-1.5">
              {tensions.slice(0, 3).map((t, i) => (
                <div key={i} className="text-sm text-slate-400 italic border-l-2 border-rose-500/50 pl-3">
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections by type */}
        {Object.keys(edgesByType).length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              关系网络
            </p>
            <div className="space-y-3">
              {Object.entries(edgesByType).map(([type, connections]) => (
                <div key={type}>
                  <p className="text-[10px] text-slate-500 font-medium mb-1">{type}</p>
                  <div className="space-y-1">
                    {connections.map(({ edge, other }, i) => other && (
                      <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: schoolColor }}
                        />
                        <span className="font-medium">{other.nameZh || other.name}</span>
                        <span className="text-slate-500 text-xs">{other.era}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dialogue CTA */}
        {node.type === 'person' && (
          <div className="pt-2 border-t border-white/5">
            <a
              href={`/app?persona=${node.id}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-prism-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              与此人对话
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}
