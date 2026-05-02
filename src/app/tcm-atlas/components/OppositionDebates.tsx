'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, Zap, Users, ArrowRight, MessageCircle } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

interface OppositionDebatesProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  onNodeSelect: (node: TCMNode | null) => void;
  getSchoolColor: (school?: string) => string;
}

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

const DEBATES = [
  {
    id: 1,
    title: '第一次：寒温之争',
    period: '金代（约1150-1250年）',
    core: '应以清热攻邪为主，还是以补脾扶正为主？',
    problem: '病邪是病因还是正虚是病因？',
    school1: { id: 'liudunhou', name: '刘完素', school: '寒凉派', thesis: '火热为百病之源！外感六淫、内伤七情，皆从火化。不清热，何以治病？' },
    school2: { id: 'liduomin', name: '李东垣', school: '补土派', thesis: '非也！脾胃为后天之本，内伤脾胃百病由生。补土才是治本之道。' },
    color: '#fb923c',
  },
  {
    id: 2,
    title: '第二次：滋阴温阳之争',
    period: '元末明初（1350-1550年）',
    core: '应以滋阴降火为主，还是以温阳补肾为主？',
    problem: '"阳常有余阴不足" vs "阳非有余，阴亦常不足"——两人精通同一经典但解读角度不同',
    school1: { id: 'zhudanhsi', name: '朱丹溪', school: '滋阴派', thesis: '阳常有余阴不足，世人耗损阴精者众。滋阴降火，方为正道。' },
    school2: { id: 'zhangjingyue', name: '张景岳', school: '温补派', thesis: '阳气者，人之大宝。命门为生命之源，温补才能回天。' },
    color: '#a78bfa',
  },
  {
    id: 3,
    title: '第三次：经方温病之争',
    period: '清代（1700-1850年）',
    core: '《伤寒论》的六经辨证能否用于温病？',
    problem: '温病是否有独立的辨证体系？',
    school1: { id: 'caoyingfu', name: '曹颖甫', school: '经方派', thesis: '《伤寒论》为万世立法，经方加减，化裁无穷，足以治一切外感内伤。' },
    school2: { id: 'wujutong', name: '吴鞠通', school: '温病派', thesis: '温病有新感、有伏气，六经辨证只治伤寒，温病当另立三焦辨证体系。' },
    color: '#60a5fa',
  },
  {
    id: 4,
    title: '第四次：中西医学论争',
    period: '清末至今（1850年-）',
    core: '中医的理论体系是否科学？中医和西医能否结合？',
    problem: '传统与现代、继承与革新的永恒张力',
    school1: { id: 'tangzonghai', name: '唐宗海', school: '中西汇通', thesis: '中医长于气化，西医精于解剖。二者各有所长，当汇通为用。' },
    school2: { id: 'zhangxichun', name: '张锡纯', school: '中西汇通', thesis: '以西药之理释中药之用，以中医之验证西医之论，取长补短，殊途同归。' },
    color: '#f472b6',
  },
];

export function OppositionDebates({ nodes, edges, onNodeSelect, getSchoolColor }: OppositionDebatesProps) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <div className="relative w-full h-full overflow-y-auto" style={{
      background: 'radial-gradient(ellipse 80% 50% at 50% 0%, #1a0a0a 0%, #050810 50%)',
    }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 pt-8 pb-6" style={{
        background: 'linear-gradient(180deg, rgba(5,8,16,1) 0%, rgba(5,8,16,0) 100%)',
      }}>
        <div className="flex items-center gap-4 mb-2">
          <Swords className="w-6 h-6 text-rose-400" style={{ filter: 'drop-shadow(0 0 8px rgba(248,113,113,0.5))' }} />
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            流派论战 · 千年争鸣
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400/80 border border-rose-500/30 font-mono">
            4 大论战
          </span>
        </div>
        <p className="text-sm text-slate-500 max-w-xl">
          中医史上的四次大论战，每次论战都推动了理论深化与临床进步
        </p>
      </div>

      <div className="px-8 pb-32 max-w-4xl mx-auto space-y-10">
        {DEBATES.map((debate, di) => {
          const node1 = nodeMap.get(debate.school1.id);
          const node2 = nodeMap.get(debate.school2.id);
          const c1 = getSchoolColor(node1?.medicalSchool);
          const c2 = getSchoolColor(node2?.medicalSchool);

          return (
            <motion.div
              key={debate.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: di * 0.12 }}
              className="relative"
            >
              {/* Debate card */}
              <div
                className="relative rounded-3xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${debate.color}25`,
                  boxShadow: `0 0 40px ${debate.color}08`,
                }}
              >
                {/* Top accent */}
                <div
                  className="h-1"
                  style={{
                    background: `linear-gradient(90deg, ${debate.color}40, ${debate.color}80, ${debate.color}40)`,
                  }}
                />

                <div className="p-6">
                  {/* Header row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ background: `${debate.color}20`, color: debate.color }}>
                        {debate.id}
                      </div>
                      <h3 className="text-lg font-display font-bold text-white">{debate.title}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full text-slate-500"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {debate.period}
                    </span>
                  </div>

                  {/* Core question */}
                  <div
                    className="rounded-xl p-4 mb-5"
                    style={{
                      background: `${debate.color}08`,
                      border: `1px solid ${debate.color}20`,
                    }}
                  >
                    <p className="text-xs text-slate-500 mb-1 font-medium">核心问题</p>
                    <p className="text-sm text-slate-200 font-medium">{debate.core}</p>
                    <p className="text-xs text-slate-500 mt-2 italic">{debate.problem}</p>
                  </div>

                  {/* VS Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                    {/* VS badge */}
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full flex items-center justify-center text-sm font-display font-black"
                      style={{
                        background: `linear-gradient(135deg, ${debate.color}30, ${debate.color}15)`,
                        color: debate.color,
                        border: `2px solid ${debate.color}50`,
                        boxShadow: `0 0 20px ${debate.color}30`,
                      }}
                    >
                      VS
                    </div>

                    {/* School 1 */}
                    <div
                      className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, ${c1}08 0%, transparent 100%)`,
                        border: `1px solid ${c1}30`,
                      }}
                      onClick={() => node1 && onNodeSelect(node1)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                          style={{ background: `${c1}20`, color: c1 }}>
                          {debate.school1.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-base font-bold text-white">{debate.school1.name}</p>
                          <p className="text-xs font-medium" style={{ color: c1 }}>{debate.school1.school}</p>
                        </div>
                      </div>
                      <div
                        className="text-sm italic leading-relaxed rounded-lg p-3"
                        style={{ background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${c1}` }}
                      >
                        <span className="text-slate-400">「</span>
                        <span className="text-slate-300">{debate.school1.thesis}</span>
                        <span className="text-slate-400">」</span>
                      </div>
                    </div>

                    {/* School 2 */}
                    <div
                      className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
                      style={{
                        background: `linear-gradient(135deg, ${c2}08 0%, transparent 100%)`,
                        border: `1px solid ${c2}30`,
                      }}
                      onClick={() => node2 && onNodeSelect(node2)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                          style={{ background: `${c2}20`, color: c2 }}>
                          {debate.school2.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-base font-bold text-white">{debate.school2.name}</p>
                          <p className="text-xs font-medium" style={{ color: c2 }}>{debate.school2.school}</p>
                        </div>
                      </div>
                      <div
                        className="text-sm italic leading-relaxed rounded-lg p-3"
                        style={{ background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${c2}` }}
                      >
                        <span className="text-slate-400">「</span>
                        <span className="text-slate-300">{debate.school2.thesis}</span>
                        <span className="text-slate-400">」</span>
                      </div>
                    </div>
                  </div>

                  {/* Insight */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <Zap className="w-3 h-3" style={{ color: debate.color }} />
                    <span>论战结果：两派理论互补，共同丰富了中医学的临床实践体系</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
