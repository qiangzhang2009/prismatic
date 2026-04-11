/**
 * Prismatic — Knowledge Graph Page
 * Interactive 3D visualization of mental model connections
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import type { Persona } from '@/lib/types';
import { cn, hexToRgba } from '@/lib/utils';

interface GraphNode {
  id: string;
  label: string;
  labelZh: string;
  type: 'persona' | 'concept' | 'model';
  personaId?: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'inspired' | 'complements' | 'opposes';
  strength: number;
}

// Generate graph data from personas
function generateGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add persona nodes
  PERSONA_LIST.forEach((p, i) => {
    const angle = (i / PERSONA_LIST.length) * Math.PI * 2;
    const radius = 300;
    nodes.push({
      id: p.id,
      label: p.name,
      labelZh: p.nameZh,
      type: 'persona',
      personaId: p.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: p.mentalModels.length * 8 + 20,
      color: p.accentColor,
    });
  });

  // Add shared concept nodes at center
  const sharedConcepts = [
    { id: 'first-principles', label: 'First Principles', labelZh: '第一性原理', personas: ['elon-musk', 'richard-feynman', 'nassim-taleb'] },
    { id: 'leverage', label: 'Leverage', labelZh: '杠杆思维', personas: ['naval-ravikant', 'elon-musk'] },
    { id: 'inversion', label: 'Inversion', labelZh: '逆向思维', personas: ['charlie-munger', 'nassim-taleb'] },
    { id: 'taste', label: 'Taste', labelZh: '品味', personas: ['steve-jobs', 'paul-graham'] },
    { id: 'escape-velocity', label: 'Escape Velocity', labelZh: '逃逸速度', personas: ['zhang-yiming', 'steve-jobs'] },
  ];

  sharedConcepts.forEach((concept, i) => {
    const angle = (i / sharedConcepts.length) * Math.PI * 2;
    const radius = 120;
    nodes.push({
      id: concept.id,
      label: concept.label,
      labelZh: concept.labelZh,
      type: 'concept',
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: 40,
      color: '#64748b',
    });

    // Connect to personas
    concept.personas.forEach((pId) => {
      edges.push({
        source: concept.id,
        target: pId,
        type: 'inspired',
        strength: 0.8,
      });
    });
  });

  // Cross-persona connections
  const connections: [string, string, 'inspired' | 'complements' | 'opposes'][] = [
    ['elon-musk', 'steve-jobs', 'inspired'],
    ['charlie-munger', 'nassim-taleb', 'inspired'],
    ['naval-ravikant', 'charlie-munger', 'complements'],
    ['richard-feynman', 'andrej-karpathy', 'inspired'],
    ['zhang-yiming', 'steve-jobs', 'inspired'],
    ['paul-graham', 'steve-jobs', 'complements'],
    ['elon-musk', 'charlie-munger', 'complements'],
  ];

  connections.forEach(([source, target, type]) => {
    edges.push({ source, target, type, strength: 0.6 });
  });

  return { nodes, edges };
}

export default function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { nodes, edges } = generateGraphData();

  const getPersona = (id: string): Persona | undefined => {
    return PERSONA_LIST.find((p) => p.id === id);
  };

  const getConnectedNodes = (nodeId: string) => {
    const connected: string[] = [];
    edges.forEach((e) => {
      if (e.source === nodeId) connected.push(e.target);
      if (e.target === nodeId) connected.push(e.source);
    });
    return connected;
  };

  const getNodeEdges = (nodeId: string) => {
    return edges.filter((e) => e.source === nodeId || e.target === nodeId);
  };

  return (
    <div className="h-screen bg-bg-base overflow-hidden relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 h-16 flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">返回</span>
        </Link>
        <div className="w-px h-5 bg-border-subtle" />
        <h1 className="font-display font-semibold">认知图谱</h1>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setScale((s) => Math.min(s * 1.2, 3))}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setScale((s) => Math.max(s / 1.2, 0.5))}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Graph Canvas */}
      <div
        className="absolute inset-0 pt-16 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          setDragging(true);
          setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }}
        onMouseMove={(e) => {
          if (dragging) {
            setOffset({
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y,
            });
          }
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <svg
          className="w-full h-full"
          style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }}
        >
          <defs>
            {/* Glow filters */}
            {PERSONA_LIST.map((p) => (
              <filter key={`glow-${p.id}`} id={`glow-${p.id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor={p.accentColor} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* Center point */}
          <g transform={`translate(${typeof window !== 'undefined' ? window.innerWidth / 2 : 600}, ${typeof window !== 'undefined' ? window.innerHeight / 2 : 400})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted =
                hoveredNode === edge.source ||
                hoveredNode === edge.target ||
                selectedNode?.id === edge.source ||
                selectedNode?.id === edge.target;

              return (
                <motion.line
                  key={`edge-${i}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={
                    edge.type === 'opposes'
                      ? '#ff6b6b'
                      : edge.type === 'complements'
                      ? '#ffd93d'
                      : '#4d96ff'
                  }
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 0.8 : 0.2}
                  strokeDasharray={edge.type === 'inspired' ? '0' : '4 4'}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: i * 0.05 }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const persona = node.personaId ? getPersona(node.personaId) : undefined;
              const isHighlighted = hoveredNode === node.id || selectedNode?.id === node.id;
              const connected = getConnectedNodes(node.id);
              const opacity =
                !hoveredNode && !selectedNode
                  ? 1
                  : isHighlighted
                  ? 1
                  : hoveredNode
                  ? connected.includes(hoveredNode) || connected.length === 0
                    ? 0.8
                    : 0.2
                  : 0.3;

              return (
                <g key={node.id}>
                  {/* Outer glow */}
                  {isHighlighted && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size + 8}
                      fill={node.color}
                      opacity={0.15}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    />
                  )}

                  {/* Main circle */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size}
                    fill={node.type === 'persona' ? node.color : '#1a1a25'}
                    stroke={node.color}
                    strokeWidth={isHighlighted ? 2 : 1}
                    opacity={opacity}
                    filter={isHighlighted && persona ? `url(#glow-${persona.id})` : undefined}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, delay: nodes.indexOf(node) * 0.03 }}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  />

                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + node.size + 16}
                    textAnchor="middle"
                    fill={node.color}
                    fontSize={node.type === 'concept' ? 10 : 11}
                    fontWeight={node.type === 'persona' ? 500 : 400}
                    opacity={isHighlighted ? 1 : 0.7}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.labelZh}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Node Detail Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            className="absolute bottom-6 left-6 right-6 md:left-auto md:w-96 bg-bg-surface/95 backdrop-blur-lg border border-border-subtle rounded-2xl p-5 shadow-card max-h-[40vh] overflow-y-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {(() => {
              const persona = selectedNode.personaId
                ? getPersona(selectedNode.personaId)
                : undefined;

              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${selectedNode.color}, ${selectedNode.color}80)`,
                      }}
                    >
                      {selectedNode.labelZh.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedNode.labelZh}</h3>
                      <p className="text-xs text-text-muted">{selectedNode.type === 'persona' ? '蒸馏人物' : '共享概念'}</p>
                    </div>
                    <button
                      className="ml-auto text-text-muted hover:text-text-primary"
                      onClick={() => setSelectedNode(null)}
                    >
                      ×
                    </button>
                  </div>

                  {persona && (
                    <>
                      <p className="text-sm text-text-secondary mb-4">{persona.briefZh}</p>

                      {/* Mental Models */}
                      <div className="space-y-2 mb-4">
                        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">心智模型</h4>
                        {persona.mentalModels.map((m) => (
                          <div key={m.id} className="flex items-start gap-2">
                            <div
                              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: persona.accentColor }}
                            />
                            <div>
                              <span className="text-sm font-medium">{m.nameZh}</span>
                              <p className="text-xs text-text-muted line-clamp-1">{m.oneLiner}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Strengths */}
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">擅长领域</h4>
                        <div className="flex flex-wrap gap-1">
                          {persona.strengths.map((s) => (
                            <span
                              key={s}
                              className="text-xs px-2 py-0.5 rounded-md border"
                              style={{ borderColor: `${persona.accentColor}40`, color: persona.accentColor }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Link
                        href={`/app?persona=${persona.id}`}
                        className="mt-4 block text-center py-2 rounded-xl text-sm font-medium"
                        style={{
                          background: `linear-gradient(135deg, ${persona.gradientFrom}20, ${persona.gradientTo}20)`,
                          color: persona.accentColor,
                          border: `1px solid ${persona.accentColor}40`,
                        }}
                      >
                        开始对话
                      </Link>
                    </>
                  )}

                  {!persona && selectedNode.type === 'concept' && (
                    <p className="text-sm text-text-secondary">
                      这是一个被多个人物共享的思维概念。它连接了不同领域的关键洞察。
                    </p>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 flex items-center gap-4 text-xs text-text-muted">
        {[
          { color: '#4d96ff', label: '启发' },
          { color: '#ffd93d', label: '互补' },
          { color: '#ff6b6b', label: '对立' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="absolute top-20 left-6 text-xs text-text-muted space-y-1">
        <p>拖拽平移 · 滚轮缩放</p>
        <p>点击节点查看详情</p>
      </div>
    </div>
  );
}
