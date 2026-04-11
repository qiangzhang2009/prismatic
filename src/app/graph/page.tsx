'use client';

/**
 * Prismatic — Knowledge Graph Page
 * Interactive 3D visualization of mental model connections
 * Mobile-optimized with touch gestures and auto-fit
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import type { Persona } from '@/lib/types';

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

  // Calculate radius based on persona count — more personas = larger ring
  const personaCount = PERSONA_LIST.length;
  const baseRadius = Math.max(200, personaCount * 15);

  // Add persona nodes in a circle
  PERSONA_LIST.forEach((p, i) => {
    const angle = (i / personaCount) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id: p.id,
      label: p.name,
      labelZh: p.nameZh,
      type: 'persona',
      personaId: p.id,
      x: Math.cos(angle) * baseRadius,
      y: Math.sin(angle) * baseRadius,
      size: Math.min(p.mentalModels.length * 7 + 16, 40),
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
    { id: 'wu-wei', label: 'Wu Wei', labelZh: '无为', personas: ['lao-zi', 'zhuang-zi', 'hui-neng'] },
    { id: 'systems', label: 'Systems', labelZh: '系统思维', personas: ['qian-xuesen', 'elon-musk', 'charlie-munger'] },
    { id: 'wisdom', label: 'Wisdom', labelZh: '东方智慧', personas: ['confucius', 'lao-zi', 'hui-neng'] },
  ];

  sharedConcepts.forEach((concept, i) => {
    const angle = (i / sharedConcepts.length) * Math.PI * 2 - Math.PI / 2;
    const radius = baseRadius * 0.4;
    nodes.push({
      id: concept.id,
      label: concept.label,
      labelZh: concept.labelZh,
      type: 'concept',
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: 36,
      color: '#64748b',
    });

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
    ['kant', 'charlie-munger', 'inspired'],
    ['einstein', 'richard-feynman', 'inspired'],
    ['nassim-taleb', 'nassim-taleb', 'inspired'],
    ['qian-xuesen', 'elon-musk', 'complements'],
    ['lao-zi', 'zhuang-zi', 'inspired'],
    ['confucius', 'lao-zi', 'complements'],
    ['hui-neng', 'lao-zi', 'inspired'],
    ['jiqun', 'hui-neng', 'inspired'],
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
  const [isLoaded, setIsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = generateGraphData();

  // Auto-fit on mount — ensures the whole graph is visible on any screen size
  useEffect(() => {
    const fitGraph = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight - 64; // minus header
      const padding = 48; // breathing room

      // Calculate the bounding box of all nodes
      const maxNodeRadius = Math.max(...nodes.map((n) => Math.abs(n.x) + n.size));
      const graphWidth = maxNodeRadius * 2;
      const graphHeight = maxNodeRadius * 2;

      // Scale to fit within viewport with padding
      const scaleX = (vw - padding * 2) / graphWidth;
      const scaleY = (vh - padding * 2) / graphHeight;
      const fittedScale = Math.min(scaleX, scaleY, 1.0); // cap at 1.0

      // Center the graph
      const centerX = vw / 2;
      const centerY = vh / 2;

      setScale(fittedScale);
      setOffset({ x: centerX, y: centerY });
      setIsLoaded(true);
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(fitGraph, 100);
    window.addEventListener('resize', fitGraph);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', fitGraph);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPersona = (id: string): Persona | undefined => {
    return PERSONA_LIST.find((p) => p.id === id);
  };

  const getConnectedNodes = useCallback(
    (nodeId: string) => {
      const connected: string[] = [];
      edges.forEach((e) => {
        if (e.source === nodeId) connected.push(e.target);
        if (e.target === nodeId) connected.push(e.source);
      });
      return connected;
    },
    [edges]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [dragging, dragStart]
  );

  // Touch handlers for mobile pinch-zoom and pan
  const lastTouchRef = useRef<{ dist: number; x: number; y: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.touches.length === 1) {
        lastTouchRef.current = null;
        setDragging(true);
        setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
      } else if (e.touches.length === 2) {
        // Pinch zoom start
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        lastTouchRef.current = { dist, x: offset.x, y: offset.y };
        setDragging(false);
      }
    },
    [offset]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        setOffset({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        });
      } else if (e.touches.length === 2 && lastTouchRef.current) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scaleDelta = dist / lastTouchRef.current.dist;
        const newScale = Math.max(0.2, Math.min(3, scale * scaleDelta));
        setScale(newScale);
        lastTouchRef.current = { dist, x: lastTouchRef.current.x, y: lastTouchRef.current.y };
      }
    },
    [dragging, dragStart, scale]
  );

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    lastTouchRef.current = null;
  }, []);

  // Wheel zoom — use a ref-based listener so we can preventDefault
  const wheelRef = useRef<(e: WheelEvent) => void>((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.2, Math.min(3, s * delta)));
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.max(0.2, Math.min(3, s * delta)));
    };

    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(3, s * 1.3));
  const zoomOut = () => setScale((s) => Math.max(0.2, s / 1.3));
  const resetView = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 64;
    const padding = 48;
    const maxNodeRadius = Math.max(...nodes.map((n) => Math.abs(n.x) + n.size));
    const graphWidth = maxNodeRadius * 2;
    const graphHeight = maxNodeRadius * 2;
    const scaleX = (vw - padding * 2) / graphWidth;
    const scaleY = (vh - padding * 2) / graphHeight;
    const fittedScale = Math.min(scaleX, scaleY, 1.0);
    setScale(fittedScale);
    setOffset({ x: vw / 2, y: vh / 2 });
  };

  return (
    <div className="h-screen bg-bg-base overflow-hidden relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-4 h-14 flex items-center gap-3 bg-bg-base/80 backdrop-blur-sm border-b border-border-subtle">
        <Link
          href="/"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </Link>
        <div className="w-px h-5 bg-border-subtle" />
        <h1 className="font-display font-semibold text-sm">认知图谱</h1>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-1">
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={zoomOut}
            aria-label="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="text-xs text-text-muted px-1 min-w-[40px] text-center font-mono">
            {Math.round(scale * 100)}%
          </div>
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={zoomIn}
            aria-label="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            onClick={resetView}
            aria-label="重置视图"
            title="适应屏幕"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Graph Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 pt-14 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            {/* Glow filters for each persona */}
            {PERSONA_LIST.map((p) => (
              <filter key={`glow-${p.id}`} id={`glow-${p.id}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feFlood floodColor={p.accentColor} floodOpacity="0.6" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            {/* Glow for concept nodes */}
            <filter id="glow-concept" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor="#64748b" floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Translate to offset (center of graph) */}
          <g transform={`translate(${offset.x}, ${offset.y})`}>
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
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={isHighlighted ? 0.9 : 0.25}
                  strokeDasharray={edge.type === 'inspired' ? '0' : '5 5'}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.03 }}
                  style={{ pointerEvents: 'none' }}
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
                    ? 0.85
                    : 0.15
                  : 0.4;

              const labelSize = Math.max(9, Math.min(12, 11 * scale));

              return (
                <g key={node.id}>
                  {/* Outer glow */}
                  {isHighlighted && (
                    <motion.circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size + 12}
                      fill={node.color}
                      opacity={0.12}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Main circle */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size}
                    fill={node.type === 'persona' ? node.color : '#1a1a25'}
                    stroke={node.color}
                    strokeWidth={isHighlighted ? 2.5 : 1}
                    opacity={opacity}
                    filter={
                      isHighlighted
                        ? node.type === 'concept'
                          ? 'url(#glow-concept)'
                          : persona
                          ? `url(#glow-${persona.id})`
                          : undefined
                        : undefined
                    }
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: isHighlighted ? 1.15 : 1, opacity }}
                    transition={{ type: 'spring', stiffness: 300, delay: nodes.indexOf(node) * 0.02 }}
                    style={{ cursor: 'pointer' }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      setSelectedNode(selectedNode?.id === node.id ? null : node);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(selectedNode?.id === node.id ? null : node);
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  />

                  {/* Inner text for concept nodes */}
                  {node.type === 'concept' && (
                    <text
                      x={node.x}
                      y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#94a3b8"
                      fontSize={9}
                      fontWeight={500}
                      style={{ pointerEvents: 'none' }}
                      opacity={opacity}
                    >
                      {node.labelZh.slice(0, 3)}
                    </text>
                  )}

                  {/* Label below node */}
                  <text
                    x={node.x}
                    y={node.y + node.size + 14}
                    textAnchor="middle"
                    fill={node.color}
                    fontSize={labelSize}
                    fontWeight={node.type === 'persona' ? 500 : 400}
                    opacity={isHighlighted ? 1 : Math.min(opacity + 0.2, 0.85)}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.labelZh.length > 6 ? node.labelZh.slice(0, 6) : node.labelZh}
                    {node.labelZh.length > 6 ? '…' : ''}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Mobile hint — shown briefly */}
      {isLoaded && (
        <motion.div
          className="absolute top-16 left-1/2 -translate-x-1/2 bg-bg-surface/90 backdrop-blur border border-border-subtle rounded-full px-4 py-1.5 text-xs text-text-muted pointer-events-none z-40"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          👆 拖拽平移 · 🤏 双指缩放
        </motion.div>
      )}

      {/* Node Detail Panel — slides up from bottom on mobile */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            className="absolute inset-x-0 bottom-0 md:inset-y-auto md:top-20 md:right-6 md:left-auto md:w-96 md:bottom-6 z-50 bg-bg-surface/95 backdrop-blur-lg border border-border-subtle rounded-t-2xl md:rounded-2xl p-4 shadow-card md:max-h-[60vh] overflow-y-auto"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {(() => {
              const persona = selectedNode.personaId ? getPersona(selectedNode.personaId) : undefined;

              return (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${selectedNode.color}, ${selectedNode.color}80)`,
                      }}
                    >
                      {selectedNode.labelZh.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{selectedNode.labelZh}</h3>
                      <p className="text-xs text-text-muted">
                        {selectedNode.type === 'persona' ? '蒸馏人物' : '共享概念'}
                      </p>
                    </div>
                    <button
                      className="ml-auto text-text-muted hover:text-text-primary flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-base transition-colors"
                      onClick={() => setSelectedNode(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {persona && (
                    <>
                      <p className="text-sm text-text-secondary mb-3 leading-relaxed">
                        {persona.briefZh}
                      </p>

                      {/* Mental Models — scrollable */}
                      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider sticky top-0 bg-bg-surface py-1">
                          思维模型
                        </h4>
                        {persona.mentalModels.slice(0, 4).map((m) => (
                          <div key={m.id} className="flex items-start gap-2">
                            <div
                              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: persona.accentColor }}
                            />
                            <div>
                              <span className="text-sm font-medium">{m.nameZh}</span>
                              <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{m.oneLiner}</p>
                            </div>
                          </div>
                        ))}
                        {persona.mentalModels.length > 4 && (
                          <p className="text-xs text-text-muted pl-3.5">
                            +{persona.mentalModels.length - 4} 个思维模型
                          </p>
                        )}
                      </div>

                      {/* Strengths */}
                      <div className="space-y-1.5 mb-3">
                        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">擅长领域</h4>
                        <div className="flex flex-wrap gap-1">
                          {persona.strengths.map((s) => (
                            <span
                              key={s}
                              className="text-xs px-2 py-0.5 rounded-md border"
                              style={{
                                borderColor: `${persona.accentColor}50`,
                                color: persona.accentColor,
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Link
                        href={`/app?persona=${persona.id}`}
                        className="mt-1 block text-center py-2.5 rounded-xl text-sm font-medium"
                        style={{
                          background: `linear-gradient(135deg, ${persona.gradientFrom}20, ${persona.gradientTo}20)`,
                          color: persona.accentColor,
                          border: `1px solid ${persona.accentColor}40`,
                        }}
                        onClick={() => setSelectedNode(null)}
                      >
                        开始对话 →
                      </Link>
                    </>
                  )}

                  {!persona && selectedNode.type === 'concept' && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      这是一个被多个人物共享的思维概念，连接了不同领域的核心洞察。
                    </p>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend — bottom left, compact on mobile */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3 text-xs text-text-muted">
        {[
          { color: '#4d96ff', label: '启发' },
          { color: '#ffd93d', label: '互补' },
          { color: '#ff6b6b', label: '对立' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 bg-bg-surface/80 backdrop-blur px-2 py-1 rounded-full border border-border-subtle">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
