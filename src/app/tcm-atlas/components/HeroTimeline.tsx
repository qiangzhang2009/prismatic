'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TCMNode, TCMEdge } from '../types';

interface HeroTimelineProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  onNodeSelect: (node: TCMNode | null) => void;
  nodeSubstantiveDegreeMap: Map<string, number>;
  getSchoolColor: (school?: string) => string;
}

const ERA_ORDER: Record<string, number> = {
  '传说时代': 0, '战国': 1, '东汉': 2, '魏晋': 3, '唐代': 4,
  '金代': 5, '元代': 6, '明代': 7, '清代': 8, '清末': 9,
  '清末民初': 10, '近代': 11, '古希腊': 12, '古代印度': 13,
};

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

const SCHOOL_LABELS: Record<string, string> = {
  'theory-founding': '理论奠基期', 'six-channel': '六经辨证派',
  'butu-school': '补土派', 'hanre-school': '寒凉派',
  'gongxie-school': '攻邪派', 'ziyin-school': '滋阴派',
  'wenbu-school': '温补派', 'wenbing-school': '温病学派',
  'huoxue-school': '活血化瘀派', 'jingfang-school': '经方派',
  'pulse-diagnosis': '脉诊先驱', 'pulse-classics': '脉学整理',
  'medical-ethics': '医德体系', 'surgery-acupuncture': '外科/针灸先驱',
  'pharmacology': '药学集大成', 'integration': '中西汇通派',
  'ayurveda': '阿育吠陀', 'ayurveda-surgery': '阿育吠陀外科',
  'western-medicine': '西方医学',
};

const ERA_BACKGROUND: Record<string, string> = {
  '传说时代': 'from-amber-950/40', '战国': 'from-amber-950/30', '东汉': 'from-blue-950/40',
  '魏晋': 'from-violet-950/40', '唐代': 'from-emerald-950/40', '金代': 'from-emerald-950/30',
  '元代': 'from-purple-950/40', '明代': 'from-pink-950/40', '清代': 'from-violet-950/30',
  '清末': 'from-orange-950/40', '清末民初': 'from-amber-950/20', '近代': 'from-fuchsia-950/40',
  '古希腊': 'from-slate-950/40', '古代印度': 'from-orange-950/30',
};

export function HeroTimeline({ nodes, edges, onNodeSelect, nodeSubstantiveDegreeMap, getSchoolColor }: HeroTimelineProps) {
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) =>
      (ERA_ORDER[a.era || ''] ?? 99) - (ERA_ORDER[b.era || ''] ?? 99)
    );
  }, [nodes]);

  const eraGroups = useMemo(() => {
    const groups: Record<string, typeof nodes> = {};
    for (const n of sortedNodes) {
      const era = n.era || '其他';
      if (!groups[era]) groups[era] = [];
      groups[era].push(n);
    }
    return groups;
  }, [sortedNodes]);

  const eras = Object.keys(eraGroups).sort((a, b) => (ERA_ORDER[a] ?? 99) - (ERA_ORDER[b] ?? 99));

  return (
    <div className="relative w-full h-full overflow-auto">
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 100% 80% at 50% 0%, #0f172a 0%, #050810 60%)',
      }} />

      {/* Decorative timeline line */}
      <div className="absolute left-0 right-0 h-px" style={{
        top: '50%',
        background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.15) 5%, rgba(148,163,184,0.15) 95%, transparent)',
      }} />

      {/* Header */}
      <div className="sticky top-0 z-10 px-8 pt-6 pb-4" style={{
        background: 'linear-gradient(180deg, rgba(5,8,16,1) 0%, rgba(5,8,16,0) 100%)',
      }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-px bg-gradient-to-r from-transparent to-amber-500/50" />
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            千年医道 · 薪火相传
          </h2>
          <div className="flex-1 h-px bg-gradient-to-l from-amber-500/30 to-transparent" />
        </div>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          从传说时代到近代，22位医学思想家跨越2500年，共同构建了人类医学知识体系
        </p>
      </div>

      {/* Timeline content */}
      <div className="relative px-8 pb-32" style={{ minWidth: 'max-content' }}>
        {eras.map((era, ei) => {
          const eraNodes = eraGroups[era] || [];
          if (eraNodes.length === 0) return null;

          const bg = ERA_BACKGROUND[era] || 'from-slate-950/40';
          const isLeft = ei % 2 === 0;

          return (
            <div key={era} className="relative mb-12">
              {/* Era marker on timeline */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full border-2"
                    style={{
                      borderColor: '#c9a84c',
                      background: '#050810',
                      boxShadow: '0 0 12px rgba(201,168,76,0.5)',
                    }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-display font-bold text-amber-400/80 leading-none">{era}</span>
                  <span className="text-[10px] text-slate-600 mt-0.5">{eraNodes.length} 位思想家</span>
                </div>
              </div>

              {/* Cards */}
              <div
                className="ml-20 grid gap-3 transition-all"
                style={{
                  gridTemplateColumns: `repeat(${eraNodes.length}, 220px)`,
                }}
              >
                {eraNodes.map((node, ni) => {
                  const color = getSchoolColor(node.medicalSchool);
                  const schoolLabel = SCHOOL_LABELS[node.medicalSchool || ''] || node.medicalSchool || '';
                  const degree = nodeSubstantiveDegreeMap.get(node.id) || 0;
                  const isTop = degree >= 6;

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (ei * 3 + ni) * 0.04, duration: 0.4 }}
                      onClick={() => onNodeSelect(node)}
                      className="relative cursor-pointer group"
                    >
                      {/* Card */}
                      <div
                        className="relative rounded-2xl p-4 transition-all duration-300 group-hover:scale-[1.03]"
                        style={{
                          background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
                          border: `1px solid ${color}30`,
                          boxShadow: isTop ? `0 0 20px ${color}20, 0 4px 20px rgba(0,0,0,0.4)` : '0 4px 20px rgba(0,0,0,0.4)',
                        }}
                      >
                        {/* Top accent line */}
                        <div
                          className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full"
                          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                        />

                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-white leading-tight truncate">
                              {node.nameZh || node.name}
                            </h3>
                            {schoolLabel && (
                              <span
                                className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                              >
                                {schoolLabel}
                              </span>
                            )}
                          </div>
                          {/* Degree badge */}
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: `${color}20`,
                              color,
                              border: `1px solid ${color}40`,
                              boxShadow: isTop ? `0 0 10px ${color}40` : undefined,
                            }}
                          >
                            {degree}
                          </div>
                        </div>

                        {/* Contribution excerpt */}
                        {node.contribution && (
                          <div className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
                            {node.contribution.slice(0, 80)}…
                          </div>
                        )}

                        {/* Mental models */}
                        {node.mentalModelsZh && node.mentalModelsZh.length > 0 && (
                          <div className="space-y-1">
                            {node.mentalModelsZh.slice(0, 2).map((m, mi) => (
                              <div key={mi} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <span className="truncate">{m}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Hover glow effect */}
                        <div
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                          style={{
                            background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${color}10 0%, transparent 70%)`,
                            border: `1px solid ${color}50`,
                          }}
                        />
                      </div>

                      {/* Connector line to timeline */}
                      <div
                        className="absolute w-6 h-px"
                        style={{
                          left: -24,
                          top: '50%',
                          background: `linear-gradient(90deg, transparent, ${color}60)`,
                        }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Right side: key insights */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-56 space-y-4 hidden xl:block">
          <div className="rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-widest mb-2 font-semibold">核心洞察</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              希波克拉底以14条连接成为图谱中心，连接东西方医学传统的桥梁
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <p className="text-[10px] text-blue-400/60 uppercase tracking-widest mb-2 font-semibold">理论高峰</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              金元时期（四大家）出现学术大爆炸，温病学派的卫气营血辨证影响至今
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(168,139,250,0.06)', border: '1px solid rgba(168,139,250,0.15)' }}>
            <p className="text-[10px] text-purple-400/60 uppercase tracking-widest mb-2 font-semibold">文化交汇</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              中医与阿育吠陀在阴阳五行/三体液、经络/Nadi等概念上高度共鸣
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
