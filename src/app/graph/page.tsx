'use client';

/**
 * Prismatic — Knowledge Graph Page
 * A world-class interactive visualization of mental model connections.
 * Enhancements: entrance animations, edge flow animation, domain hub counter badges,
 * ambient pulsing on concept nodes, smarter hover dim, click-to-deselect background,
 * floating stats panel, concept descriptions, concept persona avatar list.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Info, X, ChevronRight } from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/types';
import { trackGraphNodeClick, trackModelExpand } from '@/lib/use-tracking';

// ─── Domain Configuration ────────────────────────────────────────────────────
const DOMAINS = [
  { id: 'philosophy', label: '哲学', color: '#60a5fa', gradientFrom: '#3b82f6', gradientTo: '#818cf8', personas: [] as string[] },
  { id: 'strategy',   label: '战略', color: '#f472b6', gradientFrom: '#ec4899', gradientTo: '#f472b6', personas: [] as string[] },
  { id: 'technology', label: '科技', color: '#34d399', gradientFrom: '#10b981', gradientTo: '#34d399', personas: [] as string[] },
  { id: 'investment', label: '投资', color: '#fbbf24', gradientFrom: '#f59e0b', gradientTo: '#fbbf24', personas: [] as string[] },
  { id: 'science',   label: '科学', color: '#a78bfa', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa', personas: [] as string[] },
  { id: 'creativity',label: '创意', color: '#fb923c', gradientFrom: '#f97316', gradientTo: '#fb923c', personas: [] as string[] },
];

// Build domain mapping
PERSONA_LIST.forEach((p) => {
  const primary = p.domain?.[0] || 'philosophy';
  const domain = DOMAINS.find((d) => d.id === primary) || DOMAINS[0];
  if (!domain.personas.includes(p.id)) domain.personas.push(p.id);
});

// ─── Graph Data Model ─────────────────────────────────────────────────────────
interface Node {
  id: string;
  label: string;
  labelZh: string;
  type: 'persona' | 'concept' | 'domain';
  personaId?: string;
  x: number;
  y: number;
  r: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  domain?: string;
}

interface Edge {
  source: string;
  target: string;
  type: 'inspired' | 'complements' | 'opposes';
  weight: number;
}

// Curated shared concepts
const CONCEPTS: { id: string; label: string; labelZh: string; desc: string; personas: string[] }[] = [
  { id: 'first-principles', label: 'First Principles', labelZh: '第一性原理', desc: '从物理本质出发，拆解问题的最底层不可再分假设', personas: ['elon-musk', 'richard-feynman', 'nassim-taleb'] },
  { id: 'leverage',          label: 'Leverage',        labelZh: '杠杆思维',  desc: '识别并构建不对称的杠杆效应，放大单位努力的产出', personas: ['naval-ravikant', 'elon-musk'] },
  { id: 'inversion',         label: 'Inversion',       labelZh: '逆向思维',  desc: '从终点倒推，思考什么会导致失败并主动规避', personas: ['charlie-munger', 'nassim-taleb'] },
  { id: 'taste',             label: 'Taste',           labelZh: '品味',       desc: '对美与极致的直觉判断力，是创造卓越产品的根基', personas: ['steve-jobs', 'paul-graham'] },
  { id: 'systems',           label: 'Systems',         labelZh: '系统思维',  desc: '理解反馈回路和非线性效应，把握全局而非局部', personas: ['qian-xuesen', 'elon-musk', 'charlie-munger'] },
  { id: 'wuwei',             label: 'Wu Wei',         labelZh: '无为',        desc: '顺势而为之道，不强行干预，让事物按其自然规律运行', personas: ['lao-zi', 'zhuang-zi', 'hui-neng'] },
  { id: 'wisdom',            label: 'Wisdom',         labelZh: '东方智慧',  desc: '以儒道佛为代表的东方哲学与人生哲学体系', personas: ['confucius', 'lao-zi', 'hui-neng'] },
  { id: 'mindfulness',       label: 'Mindfulness',    labelZh: '觉察',        desc: '对当下身心状态的清晰觉知，修习专注与内观', personas: ['dalai-lama', 'mark-zuckerberg', 'buddha'] },
];

const PERSONA_CONNECTIONS: [string, string, 'inspired' | 'complements' | 'opposes'][] = [
  ['elon-musk', 'steve-jobs', 'inspired'],
  ['charlie-munger', 'nassim-taleb', 'inspired'],
  ['naval-ravikant', 'charlie-munger', 'complements'],
  ['richard-feynman', 'elon-musk', 'inspired'],
  ['zhang-yiming', 'steve-jobs', 'inspired'],
  ['paul-graham', 'steve-jobs', 'complements'],
  ['elon-musk', 'charlie-munger', 'complements'],
  ['kant', 'charlie-munger', 'inspired'],
  ['einstein', 'richard-feynman', 'inspired'],
  ['qian-xuesen', 'elon-musk', 'complements'],
  ['lao-zi', 'zhuang-zi', 'inspired'],
  ['confucius', 'lao-zi', 'complements'],
  ['hui-neng', 'lao-zi', 'inspired'],
  ['confucius', 'hui-neng', 'inspired'],
  ['buffett', 'charlie-munger', 'inspired'],
  ['dalai-lama', 'confucius', 'complements'],
];

// ─── Layout Engine ────────────────────────────────────────────────────────────
function buildGraph() {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cx = 0, cy = 0;

  // Layer 1: Domain clusters
  const domainRingR = 360;
  const usedDomains = DOMAINS.filter((d) => d.personas.length > 0);
  usedDomains.forEach((domain, di) => {
    const angle = (di / usedDomains.length) * Math.PI * 2 - Math.PI / 2;
    const dx = cx + Math.cos(angle) * domainRingR;
    const dy = cy + Math.sin(angle) * domainRingR;

    nodes.push({ id: `domain-${domain.id}`, label: domain.label, labelZh: domain.label, type: 'domain', x: dx, y: dy, r: 54, color: domain.color, gradientFrom: domain.gradientFrom, gradientTo: domain.gradientTo, domain: domain.id });

    const clusterR = 120;
    const personCount = domain.personas.length;
    domain.personas.forEach((pId, pi) => {
      const persona = PERSONA_LIST.find((p) => p.id === pId);
      if (!persona) return;
      const pa = (pi / personCount) * Math.PI * 2 - Math.PI / 2;
      nodes.push({ id: pId, label: persona.name, labelZh: persona.nameZh, type: 'persona', personaId: pId, x: dx + Math.cos(pa) * clusterR, y: dy + Math.sin(pa) * clusterR, r: Math.min(persona.mentalModels.length * 2.5 + 14, 30), color: persona.accentColor, gradientFrom: persona.gradientFrom, gradientTo: persona.gradientTo, domain: domain.id });
      edges.push({ source: pId, target: `domain-${domain.id}`, type: 'inspired', weight: 0.6 });
    });
  });

  // Layer 2: Shared concepts (inner ring)
  const conceptRingR = 190;
  CONCEPTS.forEach((concept, ci) => {
    const angle = (ci / CONCEPTS.length) * Math.PI * 2 - Math.PI / 2;
    nodes.push({ id: concept.id, label: concept.label, labelZh: concept.labelZh, type: 'concept', x: cx + Math.cos(angle) * conceptRingR, y: cy + Math.sin(angle) * conceptRingR, r: 32, color: '#64748b', gradientFrom: '#475569', gradientTo: '#1e293b' });
    concept.personas.forEach((pId) => {
      if (nodes.find((n) => n.id === pId)) edges.push({ source: concept.id, target: pId, type: 'inspired', weight: 0.5 });
    });
  });

  // Layer 3: Cross-persona connections
  PERSONA_CONNECTIONS.forEach(([src, tgt, type]) => {
    if (nodes.find((n) => n.id === src) && nodes.find((n) => n.id === tgt)) edges.push({ source: src, target: tgt, type, weight: 0.7 });
  });

  return { nodes, edges };
}

// Curved path for elegant edges
function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const perpX = -dy * 0.18, perpY = dx * 0.18;
  return `M ${x1} ${y1} Q ${midX + perpX} ${midY + perpY} ${x2} ${y2}`;
}

const EDGE_COLORS = { inspired: '#60a5fa', complements: '#fbbf24', opposes: '#f87171' };

// ─── Viewport transform state ─────────────────────────────────────────────────
// We use SVG viewBox manipulation for pan/zoom so the viewport naturally fills
// the container on any screen size (avoids Android CSS scale clipping issues).
interface Viewport {
  minX: number; // viewBox left (world coordinate)
  minY: number; // viewBox top
  width: number;  // viewBox width = screen / scale
  height: number;  // viewBox height = screen / scale
  scale: number;
}

// Compute world-to-screen and screen-to-world helpers
function toScreen(wx: number, wy: number, vp: Viewport): [number, number] {
  return [wx - vp.minX, wy - vp.minY];
}
function toWorld(sx: number, sy: number, vp: Viewport): [number, number] {
  return [sx + vp.minX, sy + vp.minY];
}
function computeViewBox(vp: Viewport) {
  return `${vp.minX} ${vp.minY} ${vp.width} ${vp.height}`;
}

function fitToScreen(vw: number, vh: number, nodes: Node[]): Viewport {
  if (nodes.length === 0) return { minX: -400, minY: -300, width: 800, height: 600, scale: 1 };
  // Compute actual content bounds from all nodes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    if (n.x - n.r < minX) minX = n.x - n.r;
    if (n.x + n.r > maxX) maxX = n.x + n.r;
    if (n.y - n.r < minY) minY = n.y - n.r;
    if (n.y + n.r > maxY) maxY = n.y + n.r;
  });
  // Use bounding circle radius for scale (original strategy)
  const maxR = Math.max(Math.hypot((minX + maxX) / 2 - minX, (minY + maxY) / 2 - minY), 360);
  const desiredW = maxR * 2 * 1.06;
  const desiredH = maxR * 2 * 1.06;
  const scaleX = vw / desiredW;
  const scaleY = vh / desiredH;
  const scale = Math.min(scaleX, scaleY, 1.1);
  const w = vw / scale;
  const h = vh / scale;
  // Center the viewBox on the actual content bounds (not on origin)
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;
  return { minX: contentCenterX - w / 2, minY: contentCenterY - h / 2, width: w, height: h, scale };
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function GraphPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [vp, setVp] = useState<Viewport>(() => ({ minX: 0, minY: 0, width: 800, height: 600, scale: 1 }));
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ wx: 0, wy: 0 }); // world coords at drag start
  const [showInfo, setShowInfo] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = useMemo(() => buildGraph(), []);

  // Auto-fit on mount and on resize
  useEffect(() => {
    const fit = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const cw = Math.max(rect?.width ?? window.innerWidth, 320);
      const ch = Math.max(rect?.height ?? (window.innerHeight - 64), 240);
      setVp(fitToScreen(cw, ch, nodes));
      setIsLoaded(true);
    };
    const t1 = setTimeout(fit, 80);
    const t2 = setTimeout(fit, 400); // after mobile browser paint
    const ro = new ResizeObserver(fit);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', fit);
    return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); window.removeEventListener('resize', fit); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mouse drag / Pan ───────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, .detail-panel')) return;
    setDragging(true);
    const [wx, wy] = toWorld(e.clientX, e.clientY, vp);
    setDragStart({ wx: vp.minX - wx, wy: vp.minY - wy });
  }, [vp]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY, vp);
    setVp((v) => ({ ...v, minX: wx + dragStart.wx, minY: wy + dragStart.wy }));
  }, [dragging, vp, dragStart]);

  // ── Touch drag / Pinch ─────────────────────────────────────────────────────
  const lastTouch = useRef<{ dist: number; vp: Viewport; cx: number; cy: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (e.touches.length === 1) {
      lastTouch.current = null;
      setDragging(true);
      const [wx, wy] = toWorld(e.touches[0].clientX, e.touches[0].clientY, vp);
      setDragStart({ wx: vp.minX - wx, wy: vp.minY - wy });
    } else if (e.touches.length === 2) {
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      lastTouch.current = { dist, vp: { ...vp }, cx, cy };
      setDragging(false);
    }
  }, [vp]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      const [wx, wy] = toWorld(e.touches[0].clientX, e.touches[0].clientY, vp);
      setVp((v) => ({ ...v, minX: wx + dragStart.wx, minY: wy + dragStart.wy }));
    } else if (e.touches.length === 2 && lastTouch.current) {
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      const ratio = dist / lastTouch.current.dist;
      const { vp: prevVp, cx, cy } = lastTouch.current;
      // Scale around the pinch center (screen coords)
      const newScale = Math.max(0.15, Math.min(4, prevVp.scale * ratio));
      const worldCX = cx / newScale + prevVp.minX;
      const worldCY = cy / newScale + prevVp.minY;
      const newW = containerRef.current?.clientWidth ?? window.innerWidth;
      const newH = containerRef.current?.clientHeight ?? (window.innerHeight - 64);
      setVp({
        scale: newScale,
        minX: worldCX - cx / newScale,
        minY: worldCY - cy / newScale,
        width: newW / newScale,
        height: newH / newScale,
      });
    }
  }, [dragging, dragStart, vp]);

  const handleTouchEnd = useCallback(() => { setDragging(false); lastTouch.current = null; }, []);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.88 : 1.12;
      const newScale = Math.max(0.15, Math.min(4, vp.scale * factor));
      // Zoom toward mouse position
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldMX = mx / vp.scale + vp.minX;
      const worldMY = my / vp.scale + vp.minY;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      setVp({
        scale: newScale,
        minX: worldMX - mx / newScale,
        minY: worldMY - my / newScale,
        width: cw / newScale,
        height: ch / newScale,
      });
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [vp]);

  // ── Button zoom ────────────────────────────────────────────────────────────
  const zoomIn = () => {
    const cw = containerRef.current?.clientWidth ?? window.innerWidth;
    const ch = containerRef.current?.clientHeight ?? (window.innerHeight - 64);
    const cx = cw / 2, cy = ch / 2;
    const newScale = Math.min(4, vp.scale * 1.25);
    const worldCX = cx / vp.scale + vp.minX;
    const worldCY = cy / vp.scale + vp.minY;
    setVp({ scale: newScale, minX: worldCX - cx / newScale, minY: worldCY - cy / newScale, width: cw / newScale, height: ch / newScale });
  };
  const zoomOut = () => {
    const cw = containerRef.current?.clientWidth ?? window.innerWidth;
    const ch = containerRef.current?.clientHeight ?? (window.innerHeight - 64);
    const cx = cw / 2, cy = ch / 2;
    const newScale = Math.max(0.15, vp.scale / 1.25);
    const worldCX = cx / vp.scale + vp.minX;
    const worldCY = cy / vp.scale + vp.minY;
    setVp({ scale: newScale, minX: worldCX - cx / newScale, minY: worldCY - cy / newScale, width: cw / newScale, height: ch / newScale });
  };
  const resetView = () => {
    const cw = Math.max(containerRef.current?.clientWidth ?? window.innerWidth, 320);
    const ch = Math.max(containerRef.current?.clientHeight ?? (window.innerHeight - 64), 240);
    setVp(fitToScreen(cw, ch, nodes));
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getConnected = useCallback((nodeId: string) => {
    const ids: string[] = [];
    edges.forEach((e) => { if (e.source === nodeId) ids.push(e.target); if (e.target === nodeId) ids.push(e.source); });
    return ids;
  }, [edges]);

  const getNodeOpacity = useCallback((node: Node) => {
    if (!hoveredNode && !selectedNode) return 1;
    if (hoveredNode === node.id || selectedNode?.id === node.id) return 1;
    const connected = getConnected(hoveredNode || selectedNode?.id || '');
    return connected.includes(node.id) || connected.length === 0 ? 0.75 : 0.1;
  }, [hoveredNode, selectedNode, getConnected]);

  const getEdgeOpacity = useCallback((edge: Edge) => {
    if (!hoveredNode && !selectedNode) return 0.45;
    return (edge.source === hoveredNode || edge.target === hoveredNode || edge.source === selectedNode?.id || edge.target === selectedNode?.id) ? 0.92 : 0.05;
  }, [hoveredNode, selectedNode]);

  const getPersona = (id: string): Persona | undefined => PERSONA_LIST.find((p) => p.id === id);

  const personaCount = nodes.filter((n) => n.type === 'persona').length;
  const conceptCount = nodes.filter((n) => n.type === 'concept').length;
  const edgeCount = edges.length;
  const domainCount = nodes.filter((n) => n.type === 'domain').length;

  return (
    <div className="h-screen bg-[#06060f] overflow-hidden relative font-sans">
      {/* ── Atmospheric Background ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 65%)' }} />
        <div style={{ background: 'radial-gradient(ellipse 40% 40% at 20% 80%, rgba(168,85,247,0.04) 0%, transparent 60%)' }} />
        <div style={{ background: 'radial-gradient(ellipse 30% 30% at 80% 20%, rgba(52,211,153,0.03) 0%, transparent 60%)' }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]">
          <defs>
            <pattern id="dot-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #06060f 0%, transparent 10%, transparent 90%, #06060f 100%)' }} />
      </div>

      {/* ── Header ── */}
      <header className="absolute top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3" style={{ background: 'rgba(6,6,15,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/" className="flex items-center gap-2 text-white/45 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">返回</span>
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="font-medium text-sm text-white/85">认知图谱</span>
          <span className="text-xs text-white/25 hidden sm:inline">· {personaCount} 位人物</span>
        </div>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all', showInfo ? 'text-white border' : 'text-white/40 hover:text-white/70')}
            style={showInfo ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' } : {}}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">图例</span>
          </button>
          <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={zoomOut} className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors" aria-label="缩小"><ZoomOut className="w-3.5 h-3.5" /></button>
            <div className="px-2 py-1.5 text-xs text-white/45 font-mono min-w-[44px] text-center">{Math.round(vp.scale * 100)}%</div>
            <button onClick={zoomIn} className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors" aria-label="放大"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button onClick={resetView} className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }} aria-label="适应屏幕"><RotateCcw className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </header>

      {/* ── SVG Graph Canvas ── */}
      <div
        ref={containerRef}
        className="absolute inset-0 pt-14 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => { setDragging(false); setHoveredNode(null); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setSelectedNode(null)}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={computeViewBox(vp)}
          preserveAspectRatio="xMidYMid meet"
          suppressHydrationWarning
        >
          <defs>
            {nodes.filter((n) => n.type === 'persona').map((n) => (
              <radialGradient key={`rg-${n.id}`} id={`grad-${n.id}`} cx="35%" cy="28%" r="68%">
                <stop offset="0%" stopColor={n.gradientTo} stopOpacity="1" />
                <stop offset="100%" stopColor={n.gradientFrom} stopOpacity="1" />
              </radialGradient>
            ))}
            {nodes.filter((n) => n.type === 'domain').map((n) => (
              <radialGradient key={`rg-${n.id}`} id={`grad-${n.id}`} cx="35%" cy="28%" r="68%">
                <stop offset="0%" stopColor={n.gradientTo} stopOpacity="1" />
                <stop offset="100%" stopColor={n.gradientFrom} stopOpacity="1" />
              </radialGradient>
            ))}
            <radialGradient id="grad-concept" cx="35%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#4b5563" />
              <stop offset="100%" stopColor="#1e293b" />
            </radialGradient>
            <filter id="glow-node" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-domain" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="edge-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Edge flow dash animation */}
            <marker id="arrow-inspired" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" opacity="0.6" />
            </marker>
          </defs>

          <g>

            {/* ── Edges ── */}
            {edges.map((edge, i) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;
              const isActive = hoveredNode === edge.source || hoveredNode === edge.target || selectedNode?.id === edge.source || selectedNode?.id === edge.target;
              const opacity = getEdgeOpacity(edge);
              const color = EDGE_COLORS[edge.type];
              const path = curvedPath(src.x, src.y, tgt.x, tgt.y);

              return (
                <g key={`edge-${i}`}>
                  {/* Wide hit area */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth="14" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedNode(src.id === selectedNode?.id ? null : src); }} />
                  {isActive && (
                    <path d={path} fill="none" stroke={color} strokeWidth="5" strokeOpacity="0.25" filter="url(#edge-glow)" style={{ pointerEvents: 'none' }} />
                  )}
                  <path
                    d={path} fill="none" stroke={color} strokeWidth={isActive ? 2 : 1.2}
                    strokeOpacity={opacity} strokeDasharray={edge.type === 'inspired' ? undefined : '7 5'}
                    style={{ pointerEvents: 'none', transition: 'stroke-opacity 0.25s' }}
                  />
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {nodes.map((node, i) => {
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode?.id === node.id;
              const isActive = isHovered || isSelected;
              const opacity = getNodeOpacity(node);
              const gradId = node.type === 'concept' ? 'grad-concept' : `grad-${node.id}`;
              const glowFilter = node.type === 'domain' ? 'url(#glow-domain)' : 'url(#glow-node)';

              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 追踪图谱节点点击
                    if (node.type === 'persona') {
                      trackGraphNodeClick('persona', node.id, node.labelZh, node.personaId);
                    } else if (node.type === 'concept') {
                      trackGraphNodeClick('concept', node.id, node.labelZh);
                    } else if (node.type === 'domain') {
                      trackGraphNodeClick('domain', node.id, node.labelZh);
                    }
                    setSelectedNode(isSelected ? null : node);
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer ambient ring (domain nodes) */}
                  {isActive && node.type === 'domain' && (
                    <motion.circle
                      cx={node.x} cy={node.y} r={node.r + 18}
                      fill="none" stroke={node.color} strokeWidth="1.5" strokeOpacity="0.2"
                      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 250 }}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Ambient glow for active nodes */}
                  {isActive && (
                    <motion.circle
                      cx={node.x} cy={node.y} r={node.r + 12}
                      fill={node.color} fillOpacity="0.07"
                      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 280 }}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}

                  {/* Domain counter badge */}
                  {node.type === 'domain' && (
                    <motion.g
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 * i, type: 'spring', stiffness: 300 }}
                      style={{ pointerEvents: 'none' }}
                    >
                      <circle
                        cx={node.x + node.r * 0.65} cy={node.y - node.r * 0.65}
                        r={11} fill={node.color} stroke="#06060f" strokeWidth="2"
                      />
                      <text
                        x={node.x + node.r * 0.65} y={node.y - node.r * 0.65 + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize="8" fontWeight="700"
                      >
                        {DOMAINS.find((d) => `domain-${d.id}` === node.id)?.personas.length ?? 0}
                      </text>
                    </motion.g>
                  )}

                  {/* Main circle */}
                  <motion.circle
                    cx={node.x} cy={node.y}
                    r={isActive ? node.r * 1.15 : node.r}
                    fill={node.type === 'concept' ? `url(#grad-concept)` : `url(#${gradId})`}
                    stroke={node.color} strokeWidth={isActive ? 2.5 : 1.2}
                    strokeOpacity={isActive ? 0.95 : 0.5}
                    filter={isActive ? glowFilter : undefined}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: isActive ? 1.15 : 1, opacity }}
                    transition={{ type: 'spring', stiffness: 300, delay: 0.02 * i }}
                    style={{ transition: 'r 0.22s cubic-bezier(0.34,1.56,0.64,1), stroke-width 0.2s, filter 0.2s' }}
                  />

                  {/* Specular highlight */}
                  <ellipse
                    cx={node.x - node.r * 0.28} cy={node.y - node.r * 0.28}
                    rx={node.r * 0.38} ry={node.r * 0.22}
                    fill="white" fillOpacity="0.1"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Concept label inside */}
                  {node.type === 'concept' && (
                    <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="8" fontWeight="500" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.labelZh.slice(0, 3)}
                    </text>
                  )}

                  {/* Domain label below */}
                  {node.type === 'domain' && (
                    <text x={node.x} y={node.y + node.r + 18} textAnchor="middle" fill={node.color} fontSize="12" fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.labelZh}
                    </text>
                  )}

                  {/* Persona label */}
                  {node.type === 'persona' && (
                    <text
                      x={node.x} y={node.y + node.r + 14}
                      textAnchor="middle" fill={node.color} fontSize="10" fontWeight="500"
                      opacity={Math.max(opacity, isActive ? 1 : 0.65)}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.labelZh.length > 5 ? node.labelZh.slice(0, 5) + '…' : node.labelZh}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ── Floating Stats Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(6,6,15,0.65)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { label: '人物', value: personaCount, color: '#60a5fa' },
          { label: '概念', value: conceptCount, color: '#64748b' },
          { label: '连线', value: edgeCount, color: '#a78bfa' },
          { label: '领域', value: domainCount, color: '#34d399' },
        ].map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            {i > 0 && <div className="w-px h-3 bg-white/10" />}
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: stat.color }} />
              <span className="text-[11px] text-white/45">{stat.value}</span>
              <span className="text-[10px] text-white/25">{stat.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Legend Panel ── */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute top-20 right-4 z-40 w-72 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(8,8,20,0.88)', backdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-white/90">图例</h3>
                <button onClick={() => setShowInfo(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-medium">连线类型</p>
                <div className="space-y-2.5">
                  {[
                    { color: '#60a5fa', label: '启发 Inspired', desc: '思维上的传承或影响', dash: false },
                    { color: '#fbbf24', label: '互补 Complements', desc: '视角与方法互为补充', dash: true },
                    { color: '#f87171', label: '对立 Opposes', desc: '思考方式的根本对立', dash: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <svg width="36" height="10" className="flex-shrink-0">
                        <line x1="2" y1="5" x2="34" y2="5" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash ? '5 3' : undefined} strokeLinecap="round" />
                      </svg>
                      <div>
                        <p className="text-xs text-white/65 font-medium">{item.label}</p>
                        <p className="text-[10px] text-white/25">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-medium">节点类型</p>
                <div className="space-y-2.5">
                  {[
                    { color: '#3b82f6', label: '蒸馏人物', desc: '心智模型节点，大小反映模型数量' },
                    { color: '#8b5cf6', label: '领域枢纽', desc: '按领域分组的人物簇中心（数字=人物数）' },
                    { color: '#475569', label: '共享概念', desc: '跨越多人的核心思维概念' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: `radial-gradient(circle at 35% 30%, ${item.color}aa, ${item.color}55)` }} />
                      <div>
                        <p className="text-xs font-medium text-white/75">{item.label}</p>
                        <p className="text-[10px] text-white/25">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-medium">领域色彩</p>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.filter((d) => d.personas.length > 0).map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-[10px] text-white/40">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile hint ── */}
      {isLoaded && (
        <motion.div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full text-xs text-white/30 pointer-events-none"
          style={{ background: 'rgba(6,6,15,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.5 }}
        >
          点击节点查看详情 · 拖拽平移 · 双指缩放
        </motion.div>
      )}

      {/* ── Node Detail Panel ── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            key={selectedNode.id}
            className="detail-panel absolute bottom-0 inset-x-0 md:inset-y-auto md:top-20 md:right-5 md:left-auto md:w-[23rem] md:bottom-6 z-50 rounded-t-3xl md:rounded-2xl overflow-hidden"
            style={{ background: 'rgba(8,8,22,0.94)', backdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.09)' }}
            initial={{ opacity: 0, y: 50, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 310, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${selectedNode.gradientFrom || selectedNode.color}, ${selectedNode.gradientTo || selectedNode.color})` }} />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${selectedNode.gradientFrom || selectedNode.color}, ${selectedNode.gradientTo || selectedNode.color})` }}
                >
                  {selectedNode.labelZh.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white text-base truncate">{selectedNode.labelZh}</h3>
                    {selectedNode.type === 'persona' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: selectedNode.color, borderColor: `${selectedNode.color}50`, backgroundColor: `${selectedNode.color}12`, border: '1px solid' }}>
                        蒸馏人物
                      </span>
                    )}
                    {selectedNode.type === 'concept' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/50" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' }}>
                        共享概念
                      </span>
                    )}
                    {selectedNode.type === 'domain' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: selectedNode.color, borderColor: `${selectedNode.color}50`, backgroundColor: `${selectedNode.color}12`, border: '1px solid' }}>
                        领域枢纽
                      </span>
                    )}
                  </div>
                  {selectedNode.type !== 'domain' && (
                    <p className="text-xs text-white/30 mt-0.5">{selectedNode.label}</p>
                  )}
                </div>
                <button onClick={() => setSelectedNode(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Persona Detail ── */}
              {selectedNode.type === 'persona' && (() => {
                const persona = getPersona(selectedNode.id);
                if (!persona) return null;
                const connected = getConnected(selectedNode.id);
                const connectedPersonas = connected.map((id) => nodes.find((n) => n.id === id)).filter((n) => n?.type === 'persona' && n.id !== selectedNode.id);
                const connectedConcepts = connected.map((id) => nodes.find((n) => n.id === id)).filter((n) => n?.type === 'concept');
                return (
                  <>
                    <p className="text-sm text-white/55 leading-relaxed mb-4">{persona.briefZh}</p>

                    <div className="mb-4">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-medium">思维模型</p>
                      <div className="space-y-2">
                        {persona.mentalModels.slice(0, 3).map((m) => (
                          <div key={m.id} className="flex items-start gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: selectedNode.color }} />
                            <div>
                              <p className="text-sm font-medium text-white/75">{m.nameZh}</p>
                              <p className="text-xs text-white/30 line-clamp-1 mt-0.5">{m.oneLiner}</p>
                            </div>
                          </div>
                        ))}
                        {persona.mentalModels.length > 3 && (
                          <p className="text-xs text-white/20 pl-3.5">+{persona.mentalModels.length - 3} 个思维模型</p>
                        )}
                      </div>
                    </div>

                    {connectedConcepts.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-medium">共享概念</p>
                        <div className="flex flex-wrap gap-1.5">
                          {connectedConcepts.map((c) => (
                            <span key={c!.id} className="text-xs px-2.5 py-1 rounded-lg text-white/55" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {c!.labelZh}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {connectedPersonas.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-medium">相关人物 ({connectedPersonas.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {connectedPersonas.slice(0, 8).map((p) => (
                            <div key={p!.id} className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${p!.gradientFrom}, ${p!.gradientTo})` }}>
                                {p!.labelZh.slice(0, 1)}
                              </div>
                              <span className="text-xs text-white/45">{p!.labelZh.slice(0, 4)}</span>
                            </div>
                          ))}
                          {connectedPersonas.length > 8 && (
                            <span className="text-xs text-white/20 self-center">+{connectedPersonas.length - 8}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <Link
                      href={`/app?persona=${selectedNode.id}`}
                      className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ background: `linear-gradient(135deg, ${selectedNode.gradientFrom}22, ${selectedNode.gradientTo}22)`, color: selectedNode.color, border: `1px solid ${selectedNode.color}45` }}
                      onClick={() => setSelectedNode(null)}
                      onMouseDown={() => {
                        if (selectedNode.type === 'persona') {
                          const persona = getPersona(selectedNode.id);
                          if (persona) {
                            trackGraphNodeClick('persona', selectedNode.id, selectedNode.labelZh, selectedNode.personaId);
                          }
                        }
                      }}
                    >
                      开始对话
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </>
                );
              })()}

              {/* ── Concept Detail ── */}
              {selectedNode.type === 'concept' && (() => {
                const concept = CONCEPTS.find((c) => c.id === selectedNode.id);
                const linkedPersonas = (concept?.personas || []).map((pId) => nodes.find((n) => n.id === pId)).filter(Boolean);
                return (
                  <>
                    {concept?.desc && (
                      <p className="text-sm text-white/50 leading-relaxed mb-4">{concept.desc}</p>
                    )}
                    {linkedPersonas.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-medium">相关人物 ({linkedPersonas.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {linkedPersonas.map((p) => (
                            <div key={p!.id} className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${p!.gradientFrom}, ${p!.gradientTo})` }}>
                                {p!.labelZh.slice(0, 1)}
                              </div>
                              <span className="text-xs text-white/45">{p!.labelZh.slice(0, 4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs text-white/30">
                        共有 <span className="text-white/55 font-medium">{concept?.personas.length ?? 0} 位</span> 蒸馏人物以此概念为核心思维工具
                      </p>
                    </div>
                  </>
                );
              })()}

              {/* ── Domain Hub Detail ── */}
              {selectedNode.type === 'domain' && (() => {
                const domainId = selectedNode.id.replace('domain-', '');
                const domainPersonas = nodes.filter((n) => n.domain === domainId && n.type === 'persona');
                const connectedConceptCount = CONCEPTS.filter((c) => c.personas.some((pId) => domainPersonas.some((dp) => dp.id === pId))).length;
                const domain = DOMAINS.find((d) => d.id === domainId);
                return (
                  <>
                    <div className="flex gap-3 mb-4">
                      <div className="flex-1 p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-xl font-bold" style={{ color: selectedNode.color }}>{domainPersonas.length}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">蒸馏人物</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-xl font-bold" style={{ color: selectedNode.color }}>{connectedConceptCount}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">共享概念</p>
                      </div>
                    </div>

                    <p className="text-sm text-white/45 leading-relaxed mb-4">
                      {domain?.label}领域的蒸馏人物共享相似的思维框架与认知模式。
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {domainPersonas.slice(0, 8).map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}>
                            {p.labelZh.slice(0, 1)}
                          </div>
                          <span className="text-xs text-white/45">{p.labelZh.slice(0, 4)}</span>
                        </div>
                      ))}
                      {domainPersonas.length > 8 && (
                        <span className="text-xs text-white/20 self-center">+{domainPersonas.length - 8} 人</span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Legend ── */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
        {[
          { color: '#60a5fa', label: '启发' },
          { color: '#fbbf24', label: '互补' },
          { color: '#f87171', label: '对立' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(6,6,15,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-4 h-px rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-white/35">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
