'use client';

/**
 * Prismatic — Observatory Galaxy View
 * Interactive 3D visualization of all personas as glowing orbs in a cosmic constellation.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X, Sparkles, Brain, BookOpen, Users, TrendingUp, Loader2 } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  PERSONA_INDEX,
  PERSONA_GRAPH_DATA,
  getConstellationStats,
  getPersonaStats,
  searchPersonas,
  type PersonaIndexEntry,
  type ConstellationStats,
} from '@/lib/persona-index';
import { cn } from '@/lib/utils';

// ─── Domain Colors ────────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  philosophy: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  spirituality: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  history: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  science: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  technology: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  business: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  creativity: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
};

const DOMAIN_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'philosophy', label: '哲学' },
  { id: 'spirituality', label: '灵性' },
  { id: 'history', label: '历史' },
  { id: 'science', label: '科学' },
  { id: 'technology', label: '科技' },
  { id: 'business', label: '商业' },
  { id: 'creativity', label: '创意' },
];

// ─── Three.js Types ────────────────────────────────────────────────────────────

interface Persona3DObject {
  entry: PersonaIndexEntry;
  mesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  glowMaterial: THREE.MeshBasicMaterial;
  label: HTMLDivElement;
  position: { x: number; y: number; z: number };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ObservatoryPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    personaObjects: Persona3DObject[];
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    animationId: number;
  } | null>(null);

  const [stats, setStats] = useState<ConstellationStats | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaIndexEntry | null>(null);
  const [hoveredPersona, setHoveredPersona] = useState<PersonaIndexEntry | null>(null);
  const [filterDomain, setFilterDomain] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Filter personas based on search and domain
  const filteredPersonas = useMemo(() => {
    let personas = PERSONA_INDEX;

    if (searchQuery) {
      personas = searchPersonas(searchQuery);
    }

    if (filterDomain !== 'all') {
      personas = personas.filter(p => p.primaryDomain === filterDomain);
    }

    return personas;
  }, [searchQuery, filterDomain]);

  // Get persona visibility
  const getPersonaVisibility = useCallback((entry: PersonaIndexEntry) => {
    const isFiltered = filteredPersonas.some(p => p.slug === entry.slug);
    const isHovered = hoveredPersona?.slug === entry.slug;
    const isSelected = selectedPersona?.slug === entry.slug;

    return {
      visible: isFiltered,
      dimmed: !isHovered && !isSelected && hoveredPersona !== null,
      highlighted: isHovered || isSelected,
    };
  }, [filteredPersonas, hoveredPersona, selectedPersona]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 30);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 80;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x4f46e5, 1, 100);
    pointLight1.position.set(20, 20, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xec4899, 0.8, 100);
    pointLight2.position.set(-20, -20, 10);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0x06b6d4, 0.6, 100);
    pointLight3.position.set(0, 20, -20);
    scene.add(pointLight3);

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Create persona objects
    const personaObjects: Persona3DObject[] = [];

    // Create starfield background
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 200;
      starPositions[i + 1] = (Math.random() - 0.5) * 200;
      starPositions[i + 2] = (Math.random() - 0.5) * 200;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Create edges between clustered personas
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x4f46e5,
      transparent: true,
      opacity: 0.15,
    });

    for (const edge of PERSONA_GRAPH_DATA.edges) {
      const sourceNode = PERSONA_GRAPH_DATA.nodes.find(n => n.id === edge.source);
      const targetNode = PERSONA_GRAPH_DATA.nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const points = [
          new THREE.Vector3(sourceNode.x * 15, sourceNode.y * 10, sourceNode.z * 2),
          new THREE.Vector3(targetNode.x * 15, targetNode.y * 10, targetNode.z * 2),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, edgeMaterial);
        scene.add(line);
      }
    }

    // Create persona meshes
    for (const entry of PERSONA_INDEX) {
      const pos = entry.positionHint || { x: 0, y: 0, z: 0 } as const;
      const x = pos.x * 15;
      const y = pos.y * 10;
      const z = (pos.z ?? 0) * 2;

      // Main orb
      const radius = 0.3 + (entry.mentalModelCount / 20) * 0.3;
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: entry.accentColor,
        emissive: entry.accentColor,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.userData = { personaSlug: entry.slug };
      scene.add(mesh);

      // Glow effect
      const glowGeometry = new THREE.SphereGeometry(radius * 1.5, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: entry.accentColor,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.set(x, y, z);
      scene.add(glowMesh);

      // Label
      const label = document.createElement('div');
      label.className = 'absolute pointer-events-none transition-opacity duration-200';
      label.style.cssText = `
        font-size: 12px;
        color: white;
        text-shadow: 0 0 10px ${entry.accentColor}, 0 2px 4px rgba(0,0,0,0.8);
        white-space: nowrap;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(0,0,0,0.5);
        transform: translate(-50%, 0);
      `;
      label.textContent = entry.nameZh;
      label.style.opacity = '0.8';
      container.appendChild(label);

      personaObjects.push({
        entry,
        mesh,
        glowMesh,
        glowMaterial,
        label,
        position: { x, y, z },
      });
    }

    // Store scene reference
    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      personaObjects,
      raycaster,
      mouse,
      animationId: 0,
    };

    // Animation loop
    function animate() {
      if (!sceneRef.current) return;

      const { renderer, scene, camera, controls, personaObjects } = sceneRef.current;
      sceneRef.current.animationId = requestAnimationFrame(animate);

      // Update controls
      controls.update();

      // Update labels and visibility
      const widthHalf = container.clientWidth / 2;
      const heightHalf = container.clientHeight / 2;

      for (const obj of personaObjects) {
        // Get screen position
        const vector = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
        vector.project(camera);

        const x = (vector.x * widthHalf) + widthHalf;
        const y = -(vector.y * heightHalf) + heightHalf;

        // Update label position
        obj.label.style.left = `${x}px`;
        obj.label.style.top = `${y + 20}px`;

        // Check if behind camera
        if (vector.z > 1) {
          obj.label.style.opacity = '0';
          obj.mesh.visible = false;
          obj.glowMesh.visible = false;
        } else {
          obj.mesh.visible = true;
          obj.glowMesh.visible = true;

          // Update opacity based on visibility
          const visibility = getPersonaVisibility(obj.entry);
          if (!visibility.visible) {
            obj.label.style.opacity = '0';
            (obj.mesh.material as THREE.MeshStandardMaterial).opacity = 0.1;
          } else if (visibility.dimmed) {
            obj.label.style.opacity = '0.3';
            (obj.mesh.material as THREE.MeshStandardMaterial).opacity = 0.3;
          } else {
            obj.label.style.opacity = '0.9';
            (obj.mesh.material as THREE.MeshStandardMaterial).opacity = 1;
          }

          // Highlight hovered
          if (visibility.highlighted) {
            obj.label.style.opacity = '1';
            obj.label.style.transform = 'translate(-50%, 0) scale(1.1)';
            obj.glowMaterial.opacity = 0.4;
          } else {
            obj.label.style.transform = 'translate(-50%, 0) scale(1)';
            obj.glowMaterial.opacity = 0.15;
          }
        }
      }

      // Render
      renderer.render(scene, camera);
    }

    animate();
    setIsLoading(false);

    // Load stats
    setStats(getConstellationStats());

    // Handle resize
    function handleResize() {
      if (!sceneRef.current || !container) return;

      const { camera, renderer } = sceneRef.current;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    window.addEventListener('resize', handleResize);

    // Mouse move handler
    function handleMouseMove(event: MouseEvent) {
      if (!sceneRef.current || !container) return;

      const { raycaster, mouse, camera, personaObjects } = sceneRef.current;

      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = personaObjects.map(obj => obj.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const slug = intersects[0].object.userData.personaSlug;
        const persona = PERSONA_INDEX.find(p => p.slug === slug);
        if (persona) {
          setHoveredPersona(persona);
          setTooltipPosition({ x: event.clientX, y: event.clientY });
          container.style.cursor = 'pointer';
        }
      } else {
        setHoveredPersona(null);
        container.style.cursor = 'default';
      }
    }

    // Mouse click handler
    function handleClick() {
      if (!sceneRef.current || !container) return;

      const { raycaster, mouse, camera, personaObjects } = sceneRef.current;

      raycaster.setFromCamera(mouse, camera);
      const meshes = personaObjects.map(obj => obj.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const slug = intersects[0].object.userData.personaSlug;
        router.push(`/observatory/${slug}`);
      }
    }

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);

        // Remove labels
        for (const obj of sceneRef.current.personaObjects) {
          obj.label.remove();
        }

        // Dispose Three.js objects
        sceneRef.current.renderer.dispose();
      }

      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
    };
  }, [getPersonaVisibility, router]);

  // Get hovered persona stats
  const hoveredStats = hoveredPersona ? getPersonaStats(hoveredPersona.slug) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Cosmic gradient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 20%, rgba(79, 70, 229, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.05) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">返回</span>
            </button>

            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                思想星空
              </h1>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索人物..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Domain Filters */}
          <div className="hidden lg:flex items-center gap-2">
            {DOMAIN_FILTERS.slice(0, 5).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterDomain(filter.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm transition-all',
                  filterDomain === filter.id
                    ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Loading */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-gray-400">正在构建星图...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: 'default' }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredPersona && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipPosition.x + 15,
              top: tooltipPosition.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <div
              className="bg-[#1a1a2e]/95 backdrop-blur-sm border rounded-xl p-4 shadow-2xl min-w-[240px]"
              style={{ borderColor: `${hoveredPersona.accentColor}40` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: `linear-gradient(135deg, ${hoveredPersona.gradientFrom}, ${hoveredPersona.gradientTo})` }}
                >
                  {hoveredPersona.nameZh[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{hoveredPersona.nameZh}</h3>
                  <p className="text-sm text-gray-400">{hoveredPersona.name}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-gray-300 line-clamp-2">
                {hoveredPersona.briefPreview}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    DOMAIN_COLORS[hoveredPersona.primaryDomain]?.bg || 'bg-gray-500/20',
                    DOMAIN_COLORS[hoveredPersona.primaryDomain]?.text || 'text-gray-400'
                  )}
                >
                  {hoveredPersona.primaryDomainLabel}
                </span>
                {hoveredPersona.isHistorical && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
                    历史人物
                  </span>
                )}
              </div>

              {hoveredStats && (
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Brain className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{hoveredStats.mentalModels} 思维模型</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>{hoveredStats.sources} 来源</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    <span>{hoveredStats.decisionHeuristics} 决策启发式</span>
                  </div>
                  {hoveredStats.hasDistillation && (
                    <div className="flex items-center gap-2 text-xs text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>已蒸馏</span>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-xs text-indigo-400 text-center">
                点击查看详情
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Panel */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-2xl">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            星图统计
          </h3>

          {stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{stats.totalPersonas}</span>
                <span className="text-xs text-gray-500">人物总数</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 rounded p-2">
                  <div className="text-gray-400">平均思维模型</div>
                  <div className="text-white font-medium">{stats.averageMentalModels}</div>
                </div>
                <div className="bg-white/5 rounded p-2">
                  <div className="text-gray-400">已蒸馏</div>
                  <div className="text-green-400 font-medium">{stats.personasWithDistillation}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">领域分布</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.domainDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([domain, count]) => {
                      const colors = DOMAIN_COLORS[domain] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
                      return (
                        <span
                          key={domain}
                          className={cn('px-2 py-0.5 rounded text-xs', colors.bg, colors.text)}
                        >
                          {domain} ({count})
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">加载中...</div>
          )}
        </div>
      </div>

      {/* Domain Filter Pills (Mobile) */}
      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 shadow-2xl">
          <div className="flex flex-wrap gap-2 max-w-[200px]">
            {DOMAIN_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterDomain(filter.id)}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-all',
                  filterDomain === filter.id
                    ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="fixed top-20 right-4 z-40">
        <div className="bg-[#1a1a2e]/60 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-xs text-gray-400">
          <p className="font-medium text-gray-300 mb-1">操作提示</p>
          <ul className="space-y-0.5">
            <li>拖拽旋转视角</li>
            <li>滚轮缩放</li>
            <li>悬停查看详情</li>
            <li>点击进入详情页</li>
          </ul>
        </div>
      </div>

      {/* Search Results Count */}
      {searchQuery && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-2 text-sm text-indigo-300">
            找到 {filteredPersonas.length} 个人物
          </div>
        </div>
      )}
    </div>
  );
}
