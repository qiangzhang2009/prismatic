'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Info, X, ChevronRight, Users, MousePointer2, Move, Maximize2, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TCMNode, TCMEdge } from '../types';
import { NodePanel } from './NodePanel';
import { FilterPanel } from './FilterPanel';

// ─── School / Era Color Palette ───────────────────────────────────────────────

const SCHOOL_COLORS: Record<string, { color: string; gradientFrom: string; gradientTo: string }> = {
  'theory-founding':  { color: '#fbbf24', gradientFrom: '#f59e0b', gradientTo: '#fbbf24' },
  'six-channel':       { color: '#60a5fa', gradientFrom: '#3b82f6', gradientTo: '#818cf8' },
  'butu-school':      { color: '#d97706', gradientFrom: '#b45309', gradientTo: '#d97706' },
  'hanre-school':     { color: '#34d399', gradientFrom: '#10b981', gradientTo: '#34d399' },
  'gongxie-school':   { color: '#6ee7b7', gradientFrom: '#34d399', gradientTo: '#6ee7b7' },
  'ziyin-school':     { color: '#a78bfa', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa' },
  'wenbu-school':     { color: '#f472b6', gradientFrom: '#ec4899', gradientTo: '#f472b6' },
  'wenbing-school':   { color: '#c084fc', gradientFrom: '#a855f7', gradientTo: '#c084fc' },
  'huoxue-school':    { color: '#fb923c', gradientFrom: '#f97316', gradientTo: '#fb923c' },
  'jingfang-school':  { color: '#e879f9', gradientFrom: '#d946ef', gradientTo: '#e879f9' },
  'pulse-diagnosis':  { color: '#38bdf8', gradientFrom: '#0ea5e9', gradientTo: '#38bdf8' },
  'pulse-classics':   { color: '#22d3ee', gradientFrom: '#06b6d4', gradientTo: '#22d3ee' },
  'medical-ethics':   { color: '#2dd4bf', gradientFrom: '#14b8a6', gradientTo: '#2dd4bf' },
  'surgery-acupuncture': { color: '#f87171', gradientFrom: '#ef4444', gradientTo: '#f87171' },
  'pharmacology':     { color: '#a3e635', gradientFrom: '#84cc16', gradientTo: '#a3e635' },
  'integration':      { color: '#e879f9', gradientFrom: '#d946ef', gradientTo: '#f0abfc' },
  'ayurveda':        { color: '#fb923c', gradientFrom: '#f97316', gradientTo: '#fbbf24' },
  'ayurveda-surgery':{ color: '#fb923c', gradientFrom: '#f97316', gradientTo: '#fcd34d' },
  'western-medicine': { color: '#94a3b8', gradientFrom: '#64748b', gradientTo: '#94a3b8' },
  'default':          { color: '#60a5fa', gradientFrom: '#3b82f6', gradientTo: '#818cf8' },
};

const ERA_ORDER: Record<string, number> = {
  '传说时代': 0, '战国': 1, '东汉': 2, '魏晋': 3, '唐代': 4,
  '金代': 5, '元代': 6, '明代': 7, '清代': 8, '清末': 9,
  '清末民初': 10, '近代': 11, '古希腊': 12, '古代印度': 13,
};

const EDGE_COLORS: Record<string, string> = {
  intellectual_influence: '#94a3b8',
  textual_lineage: '#60a5fa',
  cross_cultural_resonance: '#fbbf24',
  school_complementary: '#34d399',
  school_opposition: '#ef4444',
  theory_evolution: '#a78bfa',
};

// ─── Layout Engine ────────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  label: string;
  labelZh: string;
  type: 'person' | 'text';
  x: number;
  y: number;
  r: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  school?: string;
  era?: string;
  node: TCMNode;
}

interface LayoutEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  midX: number;
  midY: number;
  ctrlX: number;
  ctrlY: number;
  edge: TCMEdge;
}

function getSchoolColors(school?: string) {
  return school && SCHOOL_COLORS[school]
    ? SCHOOL_COLORS[school]
    : SCHOOL_COLORS['default'];
}

function buildLayout(nodes: TCMNode[], edges: TCMEdge[], eraFilter: string, schoolFilter: string, edgeTypeFilter: string) {
  // Filter nodes
  const filteredNodes = nodes.filter(n => {
    if (eraFilter && n.era !== eraFilter) return false;
    if (schoolFilter && n.medicalSchool !== schoolFilter) return false;
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter edges
  const filteredEdges = edges.filter(e => {
    if (edgeTypeFilter && e.type !== edgeTypeFilter) return false;
    return filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target);
  });

  // Group by era (for ring layout)
  const eraGroups: Record<string, TCMNode[]> = {};
  for (const node of filteredNodes) {
    if (node.type === 'text') {
      // Text nodes go in inner ring
    } else {
      const era = node.era || '其他';
      if (!eraGroups[era]) eraGroups[era] = [];
      eraGroups[era].push(node);
    }
  }

  // Inner ring: text nodes
  const textNodes = filteredNodes.filter(n => n.type === 'text');
  const personNodes = filteredNodes.filter(n => n.type === 'person');
  const totalEras = Object.keys(eraGroups).filter(e => e !== '其他').length || 1;
  const eraKeys = [...new Set([...Object.keys(eraGroups).filter(e => e !== '其他'), ...Object.keys(ERA_ORDER).filter(e => ERA_ORDER[e] <= 13)])].sort((a, b) => (ERA_ORDER[a] ?? 99) - (ERA_ORDER[b] ?? 99));

  const layoutNodes: LayoutNode[] = [];
  const cx = 0, cy = 0;

  // Era ring layout
  const eraRingR = 340;
  let eraIdx = 0;
  const erasToShow = eraKeys.filter(e => eraGroups[e]?.length > 0);

  for (const era of erasToShow) {
    const persons = eraGroups[era] || [];
    if (persons.length === 0) continue;

    const eraAngle = (eraIdx / erasToShow.length) * Math.PI * 2 - Math.PI / 2;
    const eraX = cx + Math.cos(eraAngle) * eraRingR;
    const eraY = cy + Math.sin(eraAngle) * eraRingR;

    for (let pi = 0; pi < persons.length; pi++) {
      const p = persons[pi];
      const spreadAngle = persons.length === 1 ? 0 : 0.4;
      const angle = eraAngle + (pi - (persons.length - 1) / 2) * spreadAngle;
      const r = 110 + Math.random() * 0; // deterministic: use pi
      const colors = getSchoolColors(p.medicalSchool);
      layoutNodes.push({
        id: p.id,
        label: p.name,
        labelZh: p.nameZh,
        type: 'person',
        x: eraX + Math.cos(angle) * r,
        y: eraY + Math.sin(angle) * r,
        r: 22,
        color: colors.color,
        gradientFrom: colors.gradientFrom,
        gradientTo: colors.gradientTo,
        school: p.medicalSchool,
        era: p.era,
        node: p,
      });
    }
    eraIdx++;
  }

  // Inner ring: text nodes
  const textRingR = 120;
  for (let ti = 0; ti < textNodes.length; ti++) {
    const t = textNodes[ti];
    const angle = (ti / textNodes.length) * Math.PI * 2 - Math.PI / 2;
    layoutNodes.push({
      id: t.id,
      label: t.name,
      labelZh: t.nameZh,
      type: 'text',
      x: cx + Math.cos(angle) * textRingR,
      y: cy + Math.sin(angle) * textRingR,
      r: 16,
      color: '#94a3b8',
      gradientFrom: '#64748b',
      gradientTo: '#94a3b8',
      node: t,
    });
  }

  // Build layout edges
  const layoutEdges: LayoutEdge[] = [];
  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));
  for (const edge of filteredEdges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(30, dist * 0.08);
    const ctrlX = midX - dy / dist * offset;
    const ctrlY = midY + dx / dist * offset;
    layoutEdges.push({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
      midX,
      midY,
      ctrlX,
      ctrlY,
      edge,
    });
  }

  return { layoutNodes, layoutEdges };
}

// ─── Touch + Responsive Helpers ─────────────────────────────────────────────────

interface TouchState {
  active: boolean;
  lastX: number;
  lastY: number;
  lastDist: number;
}

function getTouchDist(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMobileDevice(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

// ─── SVG Helpers ───────────────────────────────────────────────────────────────

function roundTo(n: number, decimals: number) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function curvedPath(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  return `M ${roundTo(x1, 3)} ${roundTo(y1, 3)} Q ${roundTo(cx, 3)} ${roundTo(cy, 3)} ${roundTo(x2, 3)} ${roundTo(y2, 3)}`;
}

function straightPath(x1: number, y1: number, x2: number, y2: number) {
  return `M ${roundTo(x1, 3)} ${roundTo(y1, 3)} L ${roundTo(x2, 3)} ${roundTo(y2, 3)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  nodes: TCMNode[];
  edges: TCMEdge[];
  eraFilter: string;
  schoolFilter: string;
  edgeTypeFilter: string;
}

export function GraphCanvas({ nodes, edges, eraFilter, schoolFilter, edgeTypeFilter }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewBox, setViewBox] = useState({ minX: -1000, minY: -1000, width: 2000, height: 2000 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, minX: 0, minY: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TCMNode | null>(null);
  const [scale, setScale] = useState(1);
  const [panelNode, setPanelNode] = useState<TCMNode | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const touchStateRef = useRef<TouchState>({ active: false, lastX: 0, lastY: 0, lastDist: 0 });

  const { layoutNodes, layoutEdges } = useMemo(
    () => buildLayout(nodes, edges, eraFilter, schoolFilter, edgeTypeFilter),
    [nodes, edges, eraFilter, schoolFilter, edgeTypeFilter]
  );

  // Fit to view on mount/data change — mobile uses larger initial viewport so nodes stay readable
  const containerSizeRef = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerSizeRef.current = {
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        };
      }
    });
    obs.observe(el);
    containerSizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (layoutNodes.length === 0) return;
    const xs = layoutNodes.map(n => n.x);
    const ys = layoutNodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const { w, h } = containerSizeRef.current;
    // On mobile: make viewBox match physical pixels so SVG units ≈ px
    // On desktop: keep virtual coordinate system for SVG features
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      // Set viewBox to screen pixel dimensions so node coordinates map 1:1
      const newViewBox = {
        minX: 0,
        minY: 0,
        width: Math.max(w, 320),
        height: Math.max(h, 480),
      };
      setViewBox(newViewBox);
    } else {
      // Desktop: virtual coordinate system
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const padding = 80;
      const size = Math.max(contentW, contentH, 400) + padding * 2;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setViewBox({ minX: cx - size / 2, minY: cy - size / 2, width: size, height: size });
    }
    setScale(1);
  }, [eraFilter, schoolFilter, edgeTypeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build layout nodes in absolute pixel coordinates on mobile
  const mobileLayoutNodes = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobile) return layoutNodes;
    const { w, h } = containerSizeRef.current;
    const size = Math.max(w, 320);
    const cx = size / 2;
    const cy = size / 2;
    const maxRingR = Math.min(cx, cy) * 0.7;

    return layoutNodes.map(n => ({
      ...n,
      // Remap from virtual coords to pixel coords centered in container
      x: cx + n.x,
      y: cy + n.y,
      r: Math.max(n.r, 18),
    }));
  }, [layoutNodes]);

  // Use mobile layout only on mobile, otherwise original
  const activeLayoutNodes = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return isMobile ? mobileLayoutNodes : layoutNodes;
  }, [mobileLayoutNodes, layoutNodes]);

  // Connected node set
  const connectedIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>([hoveredNode]);
    for (const e of layoutEdges) {
      if (e.source === hoveredNode) ids.add(e.target);
      if (e.target === hoveredNode) ids.add(e.source);
    }
    return ids;
  }, [hoveredNode, layoutEdges]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('.node-hit, .edge-hit')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, minX: viewBox.minX, minY: viewBox.minY });
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgW = rect.width, svgH = rect.height;
    const dx = (e.clientX - panStart.x) / svgW * viewBox.width;
    const dy = (e.clientY - panStart.y) / svgH * viewBox.height;
    setViewBox(v => ({ ...v, minX: panStart.minX - dx, minY: panStart.minY - dy }));
  }, [isPanning, panStart, viewBox]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // Wheel zoom + touch pinch-zoom — use native addEventListener (not React onWheel) so we can
  // call preventDefault() without conflicting with Next.js passive listeners.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY > 0 ? 1.12 : 0.89;
      setViewBox(v => {
        const newW = Math.max(150, Math.min(5000, v.width * zoomFactor));
        const newH = Math.max(150, Math.min(5000, v.height * zoomFactor));
        const fx = mouseX / rect.width;
        const fy = mouseY / rect.height;
        return {
          minX: v.minX + (v.width - newW) * fx,
          minY: v.minY + (v.height - newH) * fy,
          width: newW,
          height: newH,
        };
      });
      setScale(s => Math.max(0.2, Math.min(5, s * (e.deltaY > 0 ? 1 / 1.12 : 1.12))));
    };

    // Touch handlers for mobile pinch-zoom + pan
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStateRef.current = {
          active: true,
          lastX: t.clientX,
          lastY: t.clientY,
          lastDist: 0,
        };
        setIsPanning(true);
      } else if (e.touches.length === 2) {
        setIsPanning(false);
        touchStateRef.current.lastDist = getTouchDist(e.touches[0], e.touches[1]);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const ts = touchStateRef.current;
      if (!ts.active && e.touches.length < 2) return;

      const rect = el.getBoundingClientRect();

      if (e.touches.length === 1) {
        // Single-finger pan
        const t = e.touches[0];
        const dx = (t.clientX - ts.lastX) / rect.width * viewBox.width;
        const dy = (t.clientY - ts.lastY) / rect.height * viewBox.height;
        ts.lastX = t.clientX;
        ts.lastY = t.clientY;
        setViewBox(v => ({
          ...v,
          minX: v.minX - dx,
          minY: v.minY - dy,
        }));
      } else if (e.touches.length === 2) {
        // Two-finger pinch zoom
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const factor = dist / ts.lastDist;
        ts.lastDist = dist;

        setViewBox(v => {
          const newW = Math.max(150, Math.min(5000, v.width / factor));
          const newH = Math.max(150, Math.min(5000, v.height / factor));
          const fx = midX / rect.width;
          const fy = midY / rect.height;
          return {
            minX: v.minX + (v.width - newW) * fx,
            minY: v.minY + (v.height - newH) * fy,
            width: newW,
            height: newH,
          };
        });
        setScale(s => Math.max(0.2, Math.min(5, s * factor)));
      }
    };

    const onTouchEnd = () => {
      touchStateRef.current.active = false;
      touchStateRef.current.lastDist = 0;
      setIsPanning(false);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [viewBox]);

  const zoomIn = () => {
    setViewBox(v => {
      const newW = Math.max(150, v.width * 0.8);
      const newH = Math.max(150, v.height * 0.8);
      const cx = v.minX + v.width / 2;
      const cy = v.minY + v.height / 2;
      return { minX: cx - newW / 2, minY: cy - newH / 2, width: newW, height: newH };
    });
    setScale(s => Math.min(5, s * 1.25));
  };

  const zoomOut = () => {
    setViewBox(v => {
      const newW = Math.min(5000, v.width * 1.25);
      const newH = Math.min(5000, v.height * 1.25);
      const cx = v.minX + v.width / 2;
      const cy = v.minY + v.height / 2;
      return { minX: cx - newW / 2, minY: cy - newH / 2, width: newW, height: newH };
    });
    setScale(s => Math.max(0.2, s * 0.8));
  };

  const resetView = () => {
    setViewBox({ minX: -1000, minY: -1000, width: 2000, height: 2000 });
    setScale(1);
    if (layoutNodes.length > 0) {
      const xs = layoutNodes.map(n => n.x);
      const ys = layoutNodes.map(n => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const padding = isMobile ? 1500 : 80;
      const size = Math.max(maxX - minX, maxY - minY, 400) + padding * 2;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setViewBox({ minX: cx - size / 2, minY: cy - size / 2, width: size, height: size });
    }
  };

  const handleNodeClick = (node: LayoutNode) => {
    setSelectedNode((prev: TCMNode | null) => prev?.id === node.id ? null : node.node);
    setPanelNode(node.node);
  };

  const handleBgClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.node-hit, .edge-hit, .panel-hit')) return;
    setSelectedNode(null);
    setPanelNode(null);
  };

  const isDim = (nodeId: string) => {
    if (!hoveredNode) return false;
    return !connectedIds.has(nodeId);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full select-none"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBgClick}
      >
        <defs>
          {Object.entries(SCHOOL_COLORS).map(([key, c]) => (
            <radialGradient key={key} id={`grad-${key}`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor={c.gradientTo} />
              <stop offset="100%" stopColor={c.gradientFrom} />
            </radialGradient>
          ))}
          <radialGradient id="grad-text" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid background dots — hidden on mobile */}
        <style>{`
          @media (max-width: 767px) { .grid-dots { display: none; } }
        `}</style>
        <g className="grid-dots">
          {Array.from({ length: 30 }, (_, i) => (
            Array.from({ length: 30 }, (_, j) => (
              <circle
                key={`dot-${i}-${j}`}
                cx={roundTo(viewBox.minX + (viewBox.width / 30) * i, 3)}
                cy={roundTo(viewBox.minY + (viewBox.height / 30) * j, 3)}
                r={0.8}
                fill="rgba(148,163,184,0.08)"
              />
            ))
          )).flat()}
        </g>

        {/* Edges */}
        {activeLayoutNodes.length > 0 && layoutEdges.map((e, i) => {
          const src = activeLayoutNodes.find(n => n.id === e.source);
          const tgt = activeLayoutNodes.find(n => n.id === e.target);
          if (!src || !tgt) return null;
          const edgeColor = EDGE_COLORS[e.type] || '#94a3b8';
          const isEdgeHovered = hoveredNode === e.source || hoveredNode === e.target;
          const opacity = hoveredNode ? (isEdgeHovered ? 0.85 : 0.1) : 0.5;
          const strokeWidth = e.type === 'school_opposition' ? 2.5 : e.type === 'cross_cultural_resonance' ? 2 : 1.5;
          const dashArray = e.type === 'school_opposition' ? '6 4' : e.type === 'cross_cultural_resonance' ? '4 3' : e.type === 'school_complementary' ? '4 3' : e.type === 'theory_evolution' ? '3 3' : undefined;

          return (
            <g key={`edge-${i}`} className="edge-hit" opacity={opacity} style={{ transition: 'opacity 0.2s' }}>
              {/* Wide transparent hit area */}
              <path
                d={curvedPath(src.x, src.y, e.ctrlX, e.ctrlY, tgt.x, tgt.y)}
                stroke="transparent"
                strokeWidth={14}
                fill="none"
              />
              {/* Visible edge */}
              <path
                d={curvedPath(src.x, src.y, e.ctrlX, e.ctrlY, tgt.x, tgt.y)}
                stroke={edgeColor}
                strokeWidth={isEdgeHovered ? strokeWidth + 1 : strokeWidth}
                strokeDasharray={dashArray}
                fill="none"
                filter={isEdgeHovered ? 'url(#glow)' : undefined}
                style={{ transition: 'all 0.2s' }}
              />
              {/* Arrow head at target */}
              <circle
                cx={tgt.x + (tgt.x - e.ctrlX) * 0.05}
                cy={tgt.y + (tgt.y - e.ctrlY) * 0.05}
                r={3}
                fill={edgeColor}
                opacity={0.7}
              />
            </g>
          );
        })}

        {/* Text nodes (典籍) */}
        {activeLayoutNodes.filter(n => n.type === 'text').map(node => {
          const dim = isDim(node.id);
          const hovered = hoveredNode === node.id;
          const selected = selectedNode?.id === node.id;
          return (
            <g
              key={node.id}
              className="node-hit"
              opacity={dim ? 0.15 : 1}
              style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
              transform={`translate(${roundTo(node.x, 3)}, ${roundTo(node.y, 3)})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
            >
              {/* Glow ring */}
              {(hovered || selected) && (
                <circle r={node.r + 8} fill="none" stroke={node.color} strokeWidth={2} opacity={0.4} filter="url(#glow)" />
              )}
              {/* Node body */}
              <polygon
                points={`0,${-node.r} ${node.r * 0.866},${node.r * 0.5} ${-node.r * 0.866},${node.r * 0.5} ${-node.r * 0.866},${-node.r * 0.5} ${node.r * 0.866},${-node.r * 0.5}`}
                fill={`url(#grad-text)`}
                stroke={node.color}
                strokeWidth={1.5}
              />
              {/* Label */}
              <text
                y={node.r + 14}
                textAnchor="middle"
                className="fill-slate-300"
                style={{ fontSize: 9, fontFamily: 'system-ui, sans-serif' }}
              >
                {node.labelZh.length > 8 ? node.labelZh.slice(0, 7) + '…' : node.labelZh}
              </text>
            </g>
          );
        })}

        {/* Person nodes */}
        {activeLayoutNodes.filter(n => n.type === 'person').map(node => {
          const dim = isDim(node.id);
          const hovered = hoveredNode === node.id;
          const selected = selectedNode?.id === node.id;
          const gradId = node.school && SCHOOL_COLORS[node.school] ? `grad-${node.school}` : 'grad-default';
          return (
            <g
              key={node.id}
              className="node-hit"
              opacity={dim ? 0.12 : 1}
              style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
              transform={`translate(${roundTo(node.x, 3)}, ${roundTo(node.y, 3)})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
            >
              {/* Outer glow ring */}
              {(hovered || selected) && (
                <circle r={node.r + 10} fill="none" stroke={node.color} strokeWidth={2.5} opacity={0.5} filter="url(#glow-strong)" />
              )}
              {/* Pulse ring for selected */}
              {selected && (
                <circle r={node.r + 6} fill="none" stroke={node.color} strokeWidth={1.5} opacity={0.3} />
              )}
              {/* Node body */}
              <circle
                r={node.r}
                fill={`url(#${gradId})`}
                stroke={node.color}
                strokeWidth={selected ? 2.5 : 1.5}
              />
              {/* Era badge */}
              <text
                y={4}
                textAnchor="middle"
                style={{
                  fontSize: 8,
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 600,
                  fill: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}
              >
                {node.labelZh.length > 4 ? node.labelZh.slice(0, 3) : node.labelZh}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <button onClick={zoomIn} className="w-10 h-10 glass flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="放大">
          <ZoomIn className="w-4 h-4 text-slate-300" />
        </button>
        <button onClick={zoomOut} className="w-10 h-10 glass flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="缩小">
          <ZoomOut className="w-4 h-4 text-slate-300" />
        </button>
        <button onClick={resetView} className="w-10 h-10 glass flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="重置视图">
          <RotateCcw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 left-4 glass px-3 py-1.5 rounded-lg text-xs text-slate-400 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        <span>{activeLayoutNodes.filter(n => n.type === 'person').length} 人物</span>
        <span className="text-slate-600">·</span>
        <span>{layoutEdges.length} 关系</span>
        <span className="text-slate-600">·</span>
        <span>{scale < 1 ? `${(scale * 100).toFixed(0)}%` : `${(scale * 100).toFixed(0)}%`}</span>
        <div className="w-px h-3 bg-slate-600" />
        <button
          onClick={() => setShowGuide(g => !g)}
          className="flex items-center gap-1 hover:text-white transition-colors"
          title="操作说明"
        >
          <Info className="w-3.5 h-3.5" />
          <span>操作说明</span>
        </button>
      </div>

      {/* Interactive guide panel */}
      {showGuide && (
        <div className="absolute bottom-24 left-4 w-72 glass rounded-xl p-4 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              图谱操作指南
            </h3>
            <button onClick={() => setShowGuide(false)} className="p-0.5 rounded hover:bg-white/10 transition-colors">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MousePointer2 className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">点击节点</p>
                <p className="text-[11px] text-slate-500 mt-0.5">点击任意人物或典籍节点，右侧滑出详情面板，可查看思维模型、价值观、关系网络等</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Move className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">拖拽平移</p>
                <p className="text-[11px] text-slate-500 mt-0.5">在空白区域按住鼠标拖动，可平移整个图谱视图</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">滚轮缩放</p>
                <p className="text-[11px] text-slate-500 mt-0.5">滚动鼠标滚轮可缩放图谱；也可使用右下角按钮放大/缩小</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">筛选节点</p>
                <p className="text-[11px] text-slate-500 mt-0.5">点击顶部「时代」「流派」「关系」标签可筛选显示特定节点</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">悬停高亮</p>
                <p className="text-[11px] text-slate-500 mt-0.5">悬停在任意节点上，自动高亮与其相关的所有连线与节点</p>
              </div>
            </div>
          </div>
          <div className="pt-1.5 border-t border-white/5 text-[10px] text-slate-600 text-center">
            点击节点右下角「与此人对阵」可进入对话模式
          </div>
        </div>
      )}

      {/* Node detail panel */}
      <AnimatePresence>
        {panelNode && (
          <NodePanel
            node={panelNode}
            onClose={() => { setPanelNode(null); setSelectedNode(null); }}
            connectedEdges={edges.filter(e => e.source === panelNode.id || e.target === panelNode.id)}
            allNodes={nodes}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
