'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { TCMNode, TCMEdge } from '../types';

interface MainGraphProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  selectedNode: TCMNode | null;
  hoveredNode: string | null;
  onNodeSelect: (node: TCMNode | null) => void;
  onNodeHover: (id: string | null) => void;
  nodeSubstantiveDegreeMap: Map<string, number>;
  getSchoolColor: (school?: string) => string;
}

const SCHOOL_COLORS: Record<string, { primary: string; glow: string }> = {
  'theory-founding':      { primary: '#f59e0b', glow: '#fbbf24' },
  'six-channel':          { primary: '#60a5fa', glow: '#93c5fd' },
  'butu-school':         { primary: '#d97706', glow: '#fbbf24' },
  'hanre-school':         { primary: '#34d399', glow: '#6ee7b7' },
  'gongxie-school':       { primary: '#6ee7b7', glow: '#a7f3d0' },
  'ziyin-school':         { primary: '#a78bfa', glow: '#c4b5fd' },
  'wenbu-school':         { primary: '#f472b6', glow: '#f9a8d4' },
  'wenbing-school':       { primary: '#c084fc', glow: '#d8b4fe' },
  'huoxue-school':       { primary: '#fb923c', glow: '#fdba74' },
  'jingfang-school':      { primary: '#e879f9', glow: '#f0abfc' },
  'pulse-diagnosis':     { primary: '#38bdf8', glow: '#7dd3fc' },
  'pulse-classics':       { primary: '#22d3ee', glow: '#67e8f9' },
  'medical-ethics':      { primary: '#2dd4bf', glow: '#5eead4' },
  'surgery-acupuncture': { primary: '#f87171', glow: '#fca5a5' },
  'pharmacology':         { primary: '#a3e635', glow: '#bef264' },
  'integration':          { primary: '#e879f9', glow: '#f0abfc' },
  'ayurveda':             { primary: '#fb923c', glow: '#fdba74' },
  'ayurveda-surgery':     { primary: '#fbbf24', glow: '#fcd34d' },
  'western-medicine':     { primary: '#94a3b8', glow: '#cbd5e1' },
  'default':              { primary: '#60a5fa', glow: '#93c5fd' },
};

const ERA_ORDER: Record<string, number> = {
  '传说时代': 0, '战国': 1, '东汉': 2, '魏晋': 3, '唐代': 4,
  '金代': 5, '元代': 6, '明代': 7, '清代': 8, '清末': 9,
  '清末民初': 10, '近代': 11, '古希腊': 12, '古代印度': 13,
};

const EDGE_COLORS: Record<string, string> = {
  intellectual_influence:   '#94a3b8',
  textual_lineage:           '#60a5fa',
  cross_cultural_resonance:  '#fbbf24',
  school_complementary:     '#34d399',
  school_opposition:       '#ef4444',
  theory_evolution:        '#a78bfa',
};

const EDGE_DASH: Record<string, string | undefined> = {
  intellectual_influence:   undefined,
  textual_lineage:          '4 2',
  cross_cultural_resonance: '3 3',
  school_complementary:     '4 2',
  school_opposition:       '6 3',
  theory_evolution:         '2 2',
};

interface LayoutNode {
  id: string; label: string; labelZh: string;
  type: 'person' | 'text'; x: number; y: number; r: number;
  school: string; era: string; schoolColor: string; glowColor: string;
  node: TCMNode;
}

interface LayoutEdge {
  source: string; target: string; type: string;
  x1: number; y1: number; x2: number; y2: number;
  ctrlX: number; ctrlY: number;
}

function buildLayout(nodes: TCMNode[], edges: TCMEdge[], nodeSubstantiveDegreeMap: Map<string, number>) {
  const personNodes = nodes.filter(n => n.type === 'person');
  const textNodes = nodes.filter(n => n.type === 'text');

  const eraGroups: Record<string, TCMNode[]> = {};
  for (const n of personNodes) {
    const era = n.era || '其他';
    if (!eraGroups[era]) eraGroups[era] = [];
    eraGroups[era].push(n);
  }

  const layoutNodes: LayoutNode[] = [];
  const cx = 0, cy = 0;
  const MAX_RING_R = 380;

  const eras = [...new Set([...Object.keys(eraGroups)])]
    .filter(e => eraGroups[e]?.length > 0)
    .sort((a, b) => (ERA_ORDER[a] ?? 99) - (ERA_ORDER[b] ?? 99));

  for (let ei = 0; ei < eras.length; ei++) {
    const era = eras[ei];
    const persons = eraGroups[era] || [];
    if (persons.length === 0) continue;

    const baseAngle = (ei / eras.length) * Math.PI * 2 - Math.PI / 2;
    const R = MAX_RING_R;

    for (let pi = 0; pi < persons.length; pi++) {
      const p = persons[pi];
      const spread = persons.length === 1 ? 0 : 0.45;
      const angle = baseAngle + (pi - (persons.length - 1) / 2) * spread;
      const radialR = 90;
      const x = cx + Math.cos(angle) * R + Math.cos(angle + Math.PI / 2) * radialR;
      const y = cy + Math.sin(angle) * R + Math.sin(angle + Math.PI / 2) * radialR;

      const schoolKey = p.medicalSchool || 'default';
      const sc = SCHOOL_COLORS[schoolKey] || SCHOOL_COLORS['default'];
      const degree = nodeSubstantiveDegreeMap.get(p.id) || 0;
      const r = Math.max(14, Math.min(28, 10 + degree * 1.2));

      layoutNodes.push({
        id: p.id, label: p.name, labelZh: p.nameZh,
        type: 'person', x, y, r,
        school: schoolKey, era: p.era || '',
        schoolColor: sc.primary, glowColor: sc.glow,
        node: p,
      });
    }
  }

  const textR = 110;
  for (let ti = 0; ti < textNodes.length; ti++) {
    const t = textNodes[ti];
    const angle = (ti / textNodes.length) * Math.PI * 2 - Math.PI / 2;
    layoutNodes.push({
      id: t.id, label: t.name, labelZh: t.nameZh,
      type: 'text', x: cx + Math.cos(angle) * textR, y: cy + Math.sin(angle) * textR,
      r: 18, school: '', era: '',
      schoolColor: '#64748b', glowColor: '#94a3b8',
      node: t,
    });
  }

  const layoutEdges: LayoutEdge[] = [];
  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(35, dist * 0.07);
    const ctrlX = midX - dy / dist * offset;
    const ctrlY = midY + dx / dist * offset;
    layoutEdges.push({
      source: edge.source, target: edge.target, type: edge.type,
      x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y,
      ctrlX, ctrlY,
    });
  }

  return { layoutNodes, layoutEdges };
}

// Draw curved edge on canvas
function drawEdge(ctx: CanvasRenderingContext2D, e: LayoutEdge, color: string, dash: string | undefined, opacity: number, strokeW: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeW;
  ctx.setLineDash(dash ? dash.split(' ').map(Number) : []);
  ctx.beginPath();
  ctx.moveTo(e.x1, e.y1);
  ctx.quadraticCurveTo(e.ctrlX, e.ctrlY, e.x2, e.y2);
  ctx.stroke();
  ctx.restore();
}

function drawEdgeHitArea(ctx: CanvasRenderingContext2D, e: LayoutEdge, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.globalAlpha = 0.01;
  ctx.beginPath();
  ctx.moveTo(e.x1, e.y1);
  ctx.quadraticCurveTo(e.ctrlX, e.ctrlY, e.x2, e.y2);
  ctx.stroke();
  ctx.restore();
}

// Seeded pseudo-random for stars (deterministic)
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function MainGraph({
  nodes, edges, selectedNode, hoveredNode,
  onNodeSelect, onNodeHover, nodeSubstantiveDegreeMap,
}: MainGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan/zoom state (CSS transform on inner div)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStateRef = useRef<{ active: boolean; lastX: number; lastY: number; lastDist: number }>({ active: false, lastX: 0, lastY: 0, lastDist: 0 });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const { layoutNodes, layoutEdges } = useMemo(
    () => buildLayout(nodes, edges, nodeSubstantiveDegreeMap),
    [nodes, edges, nodeSubstantiveDegreeMap]
  );

  // Compute SVG canvas size from container
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    // Initial measurement
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // Initial pan: center the graph
  useEffect(() => {
    if (layoutNodes.length === 0) return;
    const cx = containerSize.w / 2;
    const cy = containerSize.h / 2;
    setPan({ x: cx, y: cy });
  }, [layoutNodes, containerSize]);

  // Build node map for edge lookup
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);

  // Compute connected nodes for dimming
  const connectedIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>([hoveredNode]);
    for (const e of layoutEdges) {
      if (e.source === hoveredNode) ids.add(e.target);
      if (e.target === hoveredNode) ids.add(e.source);
    }
    return ids;
  }, [hoveredNode, layoutEdges]);

  // Draw edges on canvas (with pan+zoom applied)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = containerSize;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Apply pan: translate to center point, then zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    for (const e of layoutEdges) {
      const edgeColor = EDGE_COLORS[e.type] || '#94a3b8';
      const dash = EDGE_DASH[e.type];
      const isOpposition = e.type === 'school_opposition';
      const isHovered = hoveredNode === e.source || hoveredNode === e.target;
      const isDimmed = hoveredNode !== null && !connectedIds.has(e.source) && !connectedIds.has(e.target);
      const opacity = isDimmed ? 0.15 : isHovered ? 0.95 : 0.8;
      const strokeW = isOpposition ? 2.5 : isHovered ? 3 : 2.5;

      drawEdge(ctx, e, edgeColor, dash, opacity, strokeW);
    }

    ctx.restore();
  }, [layoutEdges, hoveredNode, connectedIds, containerSize, pan, zoom, tick]);

  // Mouse event handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.91;
    setZoom(z => Math.max(0.3, Math.min(3, z * factor)));
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      isDragging.current = true;
      dragStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
      touchStateRef.current = { active: true, lastX: t.clientX, lastY: t.clientY, lastDist: 0 };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStateRef.current.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const ts = touchStateRef.current;
    if (e.touches.length === 1 && isDragging.current) {
      const t = e.touches[0];
      const dx = t.clientX - ts.lastX;
      const dy = t.clientY - ts.lastY;
      ts.lastX = t.clientX;
      ts.lastY = t.clientY;
      setPan({ x: pan.x + dx, y: pan.y + dy });
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / ts.lastDist;
      ts.lastDist = dist;
      setZoom(z => Math.max(0.3, Math.min(3, z * factor)));
    }
  }, [pan]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    touchStateRef.current.active = false;
    touchStateRef.current.lastDist = 0;
  }, []);

  const handleBgClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    onNodeSelect(null);
  };

  const personNodes = layoutNodes.filter(n => n.type === 'person');
  const textNodes = layoutNodes.filter(n => n.type === 'text');

  // Stars (deterministic)
  const stars = useMemo(() => {
    const rand = seededRand(42);
    return Array.from({ length: 60 }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 100,
      size: 0.5 + rand() * 1.5,
      delay: rand() * 4,
      dur: 3 + rand() * 4,
    }));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, #0f172a 0%, #050810 70%)',
        cursor: isDragging.current ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleBgClick}
    >
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              animation: `starPulse ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes starPulse {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>

      {/* Ring guide circles — size relative to container */}
      {containerSize.w > 0 && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: pan.x, top: pan.y,
              width: Math.min(containerSize.w * 0.85, 760),
              height: Math.min(containerSize.w * 0.85, 760),
              marginLeft: -Math.min(containerSize.w * 0.85, 760) / 2,
              marginTop: -Math.min(containerSize.w * 0.85, 760) / 2,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              borderRadius: '50%',
              border: '1px dashed rgba(255,255,255,0.06)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              left: pan.x, top: pan.y,
              width: Math.min(containerSize.w * 0.25, 220),
              height: Math.min(containerSize.w * 0.25, 220),
              marginLeft: -Math.min(containerSize.w * 0.25, 220) / 2,
              marginTop: -Math.min(containerSize.w * 0.25, 220) / 2,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          />
        </>
      )}

      {/* Edge canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: containerSize.w, height: containerSize.h }}
      />

      {/* Graph inner: transformed container for pan/zoom */}
      <div
        style={{
          position: 'absolute',
          left: pan.x,
          top: pan.y,
          transformOrigin: '0 0',
          transform: `scale(${zoom})`,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
      >
        {/* Text nodes (典籍) */}
        {textNodes.map(node => {
          const hovered = hoveredNode === node.id;
          const selected = selectedNode?.id === node.id;
          const dim = hoveredNode !== null && !connectedIds.has(node.id);

          return (
            <div
              key={node.id}
              data-node
              className="absolute flex flex-col items-center justify-center cursor-pointer"
              style={{
                left: node.x,
                top: node.y,
                width: node.r * 2 + 40,
                height: node.r * 2 + 50,
                marginLeft: -(node.r + 20),
                marginTop: -(node.r + 25),
                opacity: dim ? 0.1 : 1,
                transition: 'opacity 0.25s',
              }}
              onClick={(e) => { e.stopPropagation(); onNodeSelect(node.node); }}
              onMouseEnter={() => onNodeHover(node.id)}
              onMouseLeave={() => onNodeHover(null)}
            >
              {/* Outer glow */}
              {(hovered || selected) && (
                <div
                  className="absolute rounded-full"
                  style={{
                    width: (node.r + 14) * 2,
                    height: (node.r + 14) * 2,
                    marginLeft: -(node.r + 14),
                    marginTop: -(node.r + 14),
                    border: `2px solid ${node.schoolColor}`,
                    boxShadow: `0 0 12px ${node.schoolColor}80`,
                    opacity: 0.5,
                    animation: 'pulseRing 2s ease-in-out infinite',
                  }}
                />
              )}
              {/* Hexagon shape via clip-path */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: node.r * 2,
                  height: node.r * 2,
                  background: `radial-gradient(circle at 38% 32%, ${node.glowColor} 0%, ${node.schoolColor} 100%)`,
                  borderRadius: '4px',
                  clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                  border: `${selected ? 2.5 : 1.5}px solid ${node.schoolColor}`,
                  boxShadow: hovered ? `0 0 8px ${node.schoolColor}` : undefined,
                  transform: hovered || selected ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.2s',
                }}
              >
                <span
                  className="text-white font-bold text-center leading-none"
                  style={{ fontSize: Math.max(8, Math.min(10, node.r * 0.7)) }}
                >
                  {node.labelZh.length > 3 ? node.labelZh.slice(0, 2) : node.labelZh}
                </span>
              </div>
              {/* Name label */}
              <span
                className="mt-1 text-center text-slate-400"
                style={{
                  fontSize: 9,
                  fontFamily: 'system-ui',
                  maxWidth: node.r * 2 + 30,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.labelZh.length > 5 ? node.labelZh.slice(0, 4) + '…' : node.labelZh}
              </span>
            </div>
          );
        })}

        {/* Person nodes */}
        {personNodes.map(node => {
          const hovered = hoveredNode === node.id;
          const selected = selectedNode?.id === node.id;
          const dim = hoveredNode !== null && !connectedIds.has(node.id);

          return (
            <div
              key={node.id}
              data-node
              className="absolute flex flex-col items-center justify-center cursor-pointer"
              style={{
                left: node.x,
                top: node.y,
                width: node.r * 2 + 36,
                height: node.r * 2 + 36,
                marginLeft: -(node.r + 18),
                marginTop: -(node.r + 18),
                opacity: dim ? 0.08 : 1,
                transition: 'opacity 0.25s',
              }}
              onClick={(e) => { e.stopPropagation(); onNodeSelect(node.node); }}
              onMouseEnter={() => onNodeHover(node.id)}
              onMouseLeave={() => onNodeHover(null)}
            >
              {/* Ambient glow */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: (node.r + 20) * 2,
                  height: (node.r + 20) * 2,
                  marginLeft: -(node.r + 20),
                  marginTop: -(node.r + 20),
                  background: `radial-gradient(circle, ${node.schoolColor}30 0%, transparent 70%)`,
                  opacity: hovered || selected ? 0.6 : 0.2,
                  transition: 'opacity 0.25s',
                }}
              />
              {/* Outer glow ring */}
              {(hovered || selected) && (
                <div
                  className="absolute rounded-full"
                  style={{
                    width: (node.r + 12) * 2,
                    height: (node.r + 12) * 2,
                    marginLeft: -(node.r + 12),
                    marginTop: -(node.r + 12),
                    border: `2px solid ${node.schoolColor}`,
                    boxShadow: `0 0 8px ${node.schoolColor}`,
                    opacity: 0.5,
                  }}
                />
              )}
              {/* Node body */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: node.r * 2,
                  height: node.r * 2,
                  background: `radial-gradient(circle at 38% 32%, ${node.glowColor} 0%, ${node.schoolColor} 100%)`,
                  borderRadius: '50%',
                  border: `${selected ? 2.5 : hovered ? 2 : 1.5}px solid ${node.schoolColor}`,
                  boxShadow: hovered ? `0 0 6px ${node.schoolColor}` : `inset 0 -${node.r * 0.2}px ${node.r * 0.3}px rgba(0,0,0,0.4), 0 0 0 1px ${node.schoolColor}30`,
                  transform: hovered || selected ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Inner shine */}
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: node.r * 0.8,
                    height: node.r * 0.8,
                    top: node.r * 0.1,
                    left: node.r * 0.2,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                  }}
                />
                {/* Name */}
                <span
                  className="text-white font-bold text-center leading-none"
                  style={{
                    fontSize: Math.max(7, Math.min(10, node.r * 0.65)),
                    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  }}
                >
                  {node.labelZh.length > 3 ? node.labelZh.slice(0, 2) : node.labelZh}
                </span>
                {/* Degree dot */}
                {(hovered || selected) && (
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      top: -2,
                      right: -2,
                      background: node.glowColor,
                      boxShadow: `0 0 4px ${node.glowColor}`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-20 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 0.82))}
          title="放大"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.8)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z * 1.22))}
          title="缩小"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.8)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setPan({ x: containerSize.w / 2, y: containerSize.h / 2 }); setZoom(1); }}
          title="重置"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.8)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-6 rounded-xl px-3 py-2.5 z-10" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-widest">关系类型</p>
        <div className="space-y-1">
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-[10px] text-slate-400">
              <div className="w-6 h-0.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span>
                {type === 'intellectual_influence' && '学术影响'}
                {type === 'textual_lineage' && '典籍传承'}
                {type === 'cross_cultural_resonance' && '跨文化共鸣'}
                {type === 'school_complementary' && '派系互补'}
                {type === 'school_opposition' && '派系对立'}
                {type === 'theory_evolution' && '理论演进'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="absolute top-4 left-4 rounded-xl px-3 py-2.5 z-10 max-w-[180px]" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-widest">影响力排行</p>
        <div className="space-y-1">
          {[...personNodes]
            .sort((a, b) => (nodeSubstantiveDegreeMap.get(b.id) || 0) - (nodeSubstantiveDegreeMap.get(a.id) || 0))
            .slice(0, 5)
            .map((n, i) => (
              <div
                key={n.id}
                className="flex items-center gap-2 text-xs cursor-pointer"
                onClick={() => onNodeSelect(n.node)}
              >
                <span className={`w-4 text-center font-mono font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {i + 1}
                </span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: n.schoolColor }} />
                <span className="text-slate-300 truncate">{n.labelZh}</span>
                <span className="text-slate-600 ml-auto font-mono text-[10px]">{nodeSubstantiveDegreeMap.get(n.id) || 0}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
