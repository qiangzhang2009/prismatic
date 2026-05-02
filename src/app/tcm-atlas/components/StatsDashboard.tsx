'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Globe, Swords, GitBranch } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

interface StatsDashboardProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  nodeSubstantiveDegreeMap: Map<string, number>;
  getSchoolColor: (school?: string) => string;
  getSchoolLabel: (school?: string) => string;
  EDGE_LABELS: Record<string, string>;
  EDGE_COLORS: Record<string, string>;
}

const ERA_ORDER: Record<string, number> = {
  '传说时代': 0, '战国': 1, '东汉': 2, '魏晋': 3, '唐代': 4,
  '金代': 5, '元代': 6, '明代': 7, '清代': 8, '清末': 9,
  '清末民初': 10, '近代': 11, '古希腊': 12, '古代印度': 13,
};

export function StatsDashboard({
  nodes, edges, nodeSubstantiveDegreeMap,
  getSchoolColor, getSchoolLabel, EDGE_LABELS, EDGE_COLORS,
}: StatsDashboardProps) {
  const personNodes = nodes.filter(n => n.type === 'person');
  const textNodes = nodes.filter(n => n.type === 'text');

  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of edges) counts[e.type] = (counts[e.type] || 0) + 1;
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count, label: EDGE_LABELS[type] || type, color: EDGE_COLORS[type] || '#94a3b8' }))
      .sort((a, b) => b.count - a.count);
  }, [edges, EDGE_LABELS, EDGE_COLORS]);

  const eraCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of personNodes) {
      const era = n.era || '其他';
      counts[era] = (counts[era] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([era, count]) => ({ era, count }))
      .sort((a, b) => (ERA_ORDER[a.era] ?? 99) - (ERA_ORDER[b.era] ?? 99));
  }, [personNodes]);

  const schoolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of personNodes) {
      const school = n.medicalSchool || '其他';
      counts[school] = (counts[school] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([school, count]) => ({ school, label: getSchoolLabel(school), count, color: getSchoolColor(school) }))
      .sort((a, b) => b.count - a.count);
  }, [personNodes, getSchoolColor, getSchoolLabel]);

  const topNodes = useMemo(() => {
    return [...personNodes]
      .map(n => ({ node: n, degree: nodeSubstantiveDegreeMap.get(n.id) || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);
  }, [personNodes, nodeSubstantiveDegreeMap]);

  const avgDegree = useMemo(() => {
    if (personNodes.length === 0) return 0;
    const total = [...personNodes].reduce((sum, n) => sum + (nodeSubstantiveDegreeMap.get(n.id) || 0), 0);
    return (total / personNodes.length).toFixed(1);
  }, [personNodes, nodeSubstantiveDegreeMap]);

  const maxBarW = 100;
  const maxDegree = Math.max(...topNodes.map(n => n.degree));

  return (
    <div className="relative w-full h-full overflow-y-auto" style={{
      background: 'radial-gradient(ellipse 80% 40% at 50% 0%, #0a1628 0%, #050810 60%)',
    }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 pt-8 pb-6" style={{
        background: 'linear-gradient(180deg, rgba(5,8,16,1) 0%, rgba(5,8,16,0) 100%)',
      }}>
        <div className="flex items-center gap-4 mb-2">
          <BarChart3 className="w-6 h-6 text-blue-400" style={{ filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.5))' }} />
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            数据总览
          </h2>
        </div>
        <p className="text-sm text-slate-500">全球中医思想家影响力图谱的量化统计</p>
      </div>

      <div className="px-8 pb-32 max-w-6xl mx-auto space-y-8">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '思想家', value: personNodes.length, icon: '🧠', color: '#60a5fa', sub: '历代名医' },
            { label: '经典典籍', value: textNodes.length, icon: '📜', color: '#fbbf24', sub: '核心著作' },
            { label: '关系连线', value: edges.length, icon: '🔗', color: '#34d399', sub: '6 种类型' },
            { label: '平均连接', value: avgDegree, icon: '📊', color: '#a78bfa', sub: '节点连通度' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-5"
              style={{
                background: `${kpi.color}08`,
                border: `1px solid ${kpi.color}20`,
                boxShadow: `0 0 30px ${kpi.color}08`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{kpi.icon}</span>
                <span className="text-2xl font-display font-black" style={{ color: kpi.color }}>
                  {kpi.value}
                </span>
              </div>
              <p className="text-sm font-semibold text-white mb-0.5">{kpi.label}</p>
              <p className="text-xs text-slate-500">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Influence ranking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              影响力排行 TOP 10
            </h3>
            <div className="space-y-2">
              {topNodes.map(({ node, degree }, i) => {
                const color = getSchoolColor(node.medicalSchool);
                const barW = (degree / maxDegree) * 100;
                return (
                  <div
                    key={node.id}
                    className="flex items-center gap-3 rounded-xl p-2 cursor-pointer transition-all hover:bg-white/5"
                  >
                    <span className={`w-5 text-center font-mono font-bold text-xs ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${color}20`, color }}>
                      {node.nameZh.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-medium truncate">{node.nameZh}</span>
                        <span className="text-xs font-mono font-bold ml-2 flex-shrink-0" style={{ color }}>{degree}</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barW}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                        >
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Edge type distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-400" />
              关系类型分布
            </h3>
            <div className="space-y-3">
              {edgeTypeCounts.map(({ type, count, label, color }, i) => {
                const pct = Math.round((count / edges.length) * 100);
                const barW = (count / Math.max(...edgeTypeCounts.map(e => e.count))) * 100;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300">{label}</span>
                        <span className="text-xs font-mono text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barW}%` }}
                          transition={{ delay: 0.2 + i * 0.06, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Era and school distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Era distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              时代分布
            </h3>
            <div className="space-y-2">
              {eraCounts.map(({ era, count }, i) => {
                const barW = (count / Math.max(...eraCounts.map(e => e.count))) * 100;
                const eraColors: Record<string, string> = {
                  '传说时代': '#f59e0b', '战国': '#fbbf24', '东汉': '#60a5fa',
                  '魏晋': '#818cf8', '唐代': '#34d399', '金代': '#6ee7b7',
                  '元代': '#a78bfa', '明代': '#f472b6', '清代': '#c084fc',
                  '清末': '#fb923c', '古希腊': '#94a3b8', '古代印度': '#fb923c',
                };
                const color = eraColors[era] || '#60a5fa';
                return (
                  <div key={era} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 text-right flex-shrink-0">{era}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barW}%` }}
                          transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* School distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-400" />
              流派分布
            </h3>
            <div className="space-y-2">
              {schoolCounts.map(({ school, label, count, color }, i) => {
                const barW = (count / Math.max(...schoolCounts.map(s => s.count))) * 100;
                return (
                  <div key={school} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-slate-400 flex-1">{label}</span>
                    <div className="flex-1 max-w-[80px]">
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barW}%` }}
                          transition={{ delay: 0.35 + i * 0.04, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
