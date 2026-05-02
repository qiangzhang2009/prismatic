'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

interface TheoryEvolutionProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
}

const EVOLUTION_TREE = [
  {
    id: 'huangdi-neijing', name: '黄帝内经', era: '战国-汉', type: 'text' as const, color: '#f59e0b',
    children: [
      { id: 'shanghan-lun', name: '伤寒论', era: '东汉', type: 'text' as const, color: '#60a5fa',
        children: [
          { id: 'zhang-zhongjing', name: '张仲景', era: '东汉', type: 'person' as const, color: '#60a5fa',
            children: [{ id: 'jingui-yaolue', name: '金匮要略', era: '东汉', type: 'text' as const, color: '#60a5fa', children: [] }] },
          { id: 'wenbing-xue', name: '温病学说', era: '清代', type: 'text' as const, color: '#c084fc',
            children: [
              { id: 'yetianshi', name: '叶天士', era: '清代', type: 'person' as const, color: '#c084fc',
                children: [{ id: 'wujutong', name: '吴鞠通', era: '清代', type: 'person' as const, color: '#c084fc', children: [] }] },
            ] },
        ],
      },
      { id: 'liudunhou', name: '刘完素', era: '金代', type: 'person' as const, color: '#34d399',
        children: [
          { id: 'liduomin', name: '李东垣', era: '金代', type: 'person' as const, color: '#d97706',
            children: [{ id: 'zhangjingyue', name: '张景岳', era: '明代', type: 'person' as const, color: '#f472b6', children: [] }] },
          { id: 'zhadanxin', name: '张从正', era: '金代', type: 'person' as const, color: '#6ee7b7',
            children: [{ id: 'wangqingren', name: '王清任', era: '清代', type: 'person' as const, color: '#fb923c', children: [] }] },
        ],
      },
      { id: 'lishizhen', name: '李时珍', era: '明代', type: 'person' as const, color: '#a3e635',
        children: [
          { id: 'tangzonghai', name: '唐宗海', era: '清末', type: 'person' as const, color: '#e879f9',
            children: [{ id: 'zhangxichun', name: '张锡纯', era: '清末民初', type: 'person' as const, color: '#e879f9', children: [] }] },
        ],
      },
    ],
  },
];

interface TreeNode {
  id: string; name: string; era: string;
  type: 'person' | 'text'; color: string; children: TreeNode[];
}

interface RenderedNode {
  id: string; name: string; era: string;
  type: 'person' | 'text'; color: string;
  x: number; y: number; depth: number;
}

interface RenderedLine {
  x1: number; y1: number; x2: number; y2: number;
  color: string;
}

const CARD_W = 100;
const CARD_H = 52;
const GAP_X = 120; // horizontal gap between depth levels
const GAP_Y = 100; // vertical gap between rows
const SVG_W = 700;
const SVG_H = 900;
const PADDING_TOP = 24;
const PADDING_LEFT = 0;

function subtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(c => subtreeHeight(c)));
}

function buildTree() {
  const nodes: RenderedNode[] = [];
  const lines: RenderedLine[] = [];

  function render(node: TreeNode, depth: number, x: number, subtreeTop: number): void {
    const sh = subtreeHeight(node);
    const centerOffset = Math.floor(sh / 2);
    const nodeY = subtreeTop + centerOffset;
    nodes.push({ id: node.id, name: node.name, era: node.era, type: node.type, color: node.color, x, y: nodeY, depth });

    if (node.children.length === 0) return;

    const childHeights = node.children.map(c => subtreeHeight(c));
    let currentTop = subtreeTop;
    for (let ci = 0; ci < node.children.length; ci++) {
      const child = node.children[ci];
      const childX = x + GAP_X;
      const childY = currentTop + Math.floor(childHeights[ci] / 2);
      lines.push({ x1: x, y1: nodeY, x2: childX, y2: childY, color: child.color });
      render(child, depth + 1, childX, currentTop);
      currentTop += childHeights[ci];
    }
  }

  render(EVOLUTION_TREE[0], 0, 0, 0);
  return { nodes, lines };
}

function nodeSvgY(nodeY: number): number {
  return PADDING_TOP + nodeY * GAP_Y;
}

function nodeSvgX(nodeX: number): number {
  return PADDING_LEFT + nodeX + CARD_W / 2;
}

export function TheoryEvolution(_props: TheoryEvolutionProps) {
  const [selected, setSelected] = useState<RenderedNode | null>(null);
  const { nodes: renderedNodes, lines: renderedLines } = useMemo(() => buildTree(), []);

  const maxDepth = Math.max(...renderedNodes.map(n => n.depth));
  const svgContentH = Math.max(...renderedNodes.map(n => nodeSvgY(n.y) + CARD_H)) + 20;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 20%, #0a1628 0%, #050810 60%)' }}
    >
      <div
        className="relative z-10 px-8 pt-6 pb-4"
        style={{ background: 'linear-gradient(180deg, rgba(5,8,16,0.95) 0%, rgba(5,8,16,0) 100%)' }}
      >
        <div className="flex items-center gap-4 mb-1">
          <Zap className="w-5 h-5 text-violet-400" style={{ filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.5))' }} />
          <h2 className="text-xl font-display font-bold text-white tracking-tight">理论演进脉络</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400/80 border border-violet-500/30 font-mono">知识传承树</span>
        </div>
        <p className="text-xs text-slate-500 max-w-xl">
          从《黄帝内经》到温病学说，理论体系的分支与演进
        </p>
      </div>

      <div className="px-8 pb-4 overflow-auto">
        <div className="relative mx-auto" style={{ width: SVG_W, height: Math.max(SVG_H, svgContentH) }}>
          {/* SVG connector lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={SVG_W}
            height={Math.max(SVG_H, svgContentH)}
            viewBox={`0 0 ${SVG_W} ${Math.max(SVG_H, svgContentH)}`}
            style={{ overflow: 'visible' }}
          >
            {renderedLines.map((line, i) => {
              const x1 = nodeSvgX(line.x1);
              const y1 = nodeSvgY(line.y1);
              const x2 = nodeSvgX(line.x2);
              const y2 = nodeSvgY(line.y2);
              const midX = x2;
              return (
                <g key={'line-' + i} opacity={0.5}>
                  <line x1={x1} y1={y1} x2={midX} y2={y1} stroke={line.color} strokeWidth={1.5} />
                  <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={line.color} strokeWidth={1.5} />
                </g>
              );
            })}
          </svg>

          {/* Tree nodes */}
          {renderedNodes.map((n) => {
            const nameLen = n.name.length;
            const fontSize = nameLen >= 4 ? 9 : nameLen >= 3 ? 11 : 12;
            const absX = nodeSvgX(n.x);
            const absY = nodeSvgY(n.y);
            const delay = n.depth * 0.1 + n.y * 0.02;
            return (
              <div
                key={n.id}
                className="absolute cursor-pointer"
                style={{
                  left: absX - CARD_W / 2,
                  top: absY - CARD_H / 2,
                  width: CARD_W,
                  height: CARD_H,
                  opacity: 0,
                  animation: `fadeInNode 0.4s ease-out ${delay}s forwards`,
                }}
                onClick={() => setSelected(n)}
              >
                <div
                  className="relative flex flex-col items-center justify-center w-full h-full rounded-xl px-1.5"
                  style={{
                    background: n.color + '18',
                    border: `1.5px solid ${n.color}60`,
                    boxShadow: `0 0 8px ${n.color}25`,
                  }}
                >
                  <div
                    className="absolute -top-1.5 left-1 px-1 py-0.5 rounded text-[7px] font-bold leading-none"
                    style={{ background: n.color + '35', color: n.color }}
                  >
                    {n.type === 'person' ? '人' : '典'}
                  </div>
                  <span
                    className="text-white font-bold text-center leading-tight"
                    style={{ fontSize }}
                  >
                    {n.name}
                  </span>
                  <span className="text-[7px] text-slate-400 leading-none mt-0.5">
                    {n.era}
                  </span>
                  {n.depth === 0 && (
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: 7, height: 7,
                        background: n.color,
                        boxShadow: `0 0 5px ${n.color}`,
                        top: -4, right: -4,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Detail panel */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2 }}
                className="absolute top-24 right-8 w-80 rounded-2xl p-5 z-20"
                style={{
                  background: 'rgba(5, 8, 16, 0.93)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${selected.color}40`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${selected.color}20`,
                }}
              >
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ background: selected.color + '25', color: selected.color }}
                  >
                    {selected.type === 'person' ? '人' : '典'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{selected.name}</h3>
                    <p className="text-xs text-slate-400">
                      {selected.era} · {selected.type === 'person' ? '思想家' : '经典'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">理论脉络：</span>
                    <span className="text-slate-300">从经典奠基到流派分化的传承节点</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">学派归属：</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: selected.color }} />
                    <span style={{ color: selected.color }}>
                      {selected.type === 'person' ? '金元医学派' : '经典文献'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summary cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { title: '经典奠基', desc: '《黄帝内经》建立阴阳五行、脏腑经络、天人相应的理论框架', color: '#f59e0b', icon: '理' },
            { title: '临床分化', desc: '张仲景《伤寒论》开创六经辨证，温病学派发展出卫气营血、三焦辨证', color: '#60a5fa', icon: '用' },
            { title: '流派争鸣', desc: '金元四大家各执一端——寒凉、补土、滋阴、攻邪——共同推动学术繁荣', color: '#34d399', icon: '争' },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              className="rounded-2xl p-5"
              style={{ background: card.color + '08', border: `1px solid ${card.color}25` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{ background: card.color + '20', color: card.color }}
                >
                  {card.icon}
                </div>
                <h3 className="text-base font-semibold text-white">{card.title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeInNode {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
