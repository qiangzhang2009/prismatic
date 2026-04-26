'use client';

/**
 * Prismatic — Main Landing Page
 * World-class visual redesign: prism metaphor, editorial sections, premium feel
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Hexagon, Sparkles, ArrowRight, Play, GitFork,
  Target, Brain, Layers, BarChart3, TrendingUp, Sparkle,
  BookOpen, MessageSquare, GitMerge, Zap, Crown, GitBranch,
  ChevronDown, Star, Quote,
} from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import { MODES, APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { Footer } from '@/components/footer';
import { CommentsSection } from '@/components/comments-section';
import { cn, getDomainGradient } from '@/lib/utils';

// ─── Animated Prism SVG ─────────────────────────────────────────────────────────

function PrismLight() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="absolute right-0 top-1/2 -translate-y-1/2 w-[40vw] max-w-[600px] opacity-[0.18] pointer-events-none hidden lg:block"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Prism body */}
      <polygon
        points="100,40 200,260 0,260"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Refracted beams */}
      <motion.line
        x1="100" y1="40" x2="60" y2="290"
        stroke="url(#beamRed)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 2, delay: 0.5 }}
      />
      <motion.line
        x1="100" y1="40" x2="120" y2="295"
        stroke="url(#beamYellow)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 2, delay: 0.7 }}
      />
      <motion.line
        x1="100" y1="40" x2="180" y2="300"
        stroke="url(#beamGreen)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 2, delay: 0.9 }}
      />
      <motion.line
        x1="100" y1="40" x2="240" y2="295"
        stroke="url(#beamBlue)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 2, delay: 1.1 }}
      />
      <motion.line
        x1="100" y1="40" x2="300" y2="280"
        stroke="url(#beamPurple)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 2, delay: 1.3 }}
      />
      {/* Beam gradients */}
      <defs>
        <linearGradient id="beamRed" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamYellow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd93d" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffd93d" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamGreen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6bcb77" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6bcb77" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamBlue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4d96ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4d96ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamPurple" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c77dff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c77dff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Floating Light Particles ────────────────────────────────────────────────────

function HeroParticles() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 6,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 6 + Math.random() * 12,
    delay: Math.random() * 8,
    opacity: 0.1 + Math.random() * 0.4,
    hue: Math.floor(Math.random() * 360),
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `hsl(${p.hue}, 80%, 65%)`,
            opacity: p.opacity,
          }}
          animate={{ y: [-8, 8, -8], scale: [1, 1.2, 1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Domain Orb ─────────────────────────────────────────────────────────────────

// Dynamically compute top domains from real persona data
const DOMAIN_NAME_MAP: Record<string, string> = {
  philosophy: '哲学', strategy: '兵法', history: '历史', science: '科学',
  creativity: '创意', spirituality: '灵性', stoicism: '斯多葛', literature: '文学',
  investment: '投资', leadership: '领导力', ethics: '伦理', business: '商业',
  education: '教育', zen_buddhism: '禅修', medicine: '医学', negotiation: '谈判',
  psychology: '心理学', fiction: '文学', economics: '经济学', AI: '人工智能',
};

const DOMAIN_COLORS = [
  '#4d96ff', '#8b5cf6', '#ff6b6b', '#6bcb77',
  '#ffd93d', '#c77dff', '#f472b6', '#38bdf8', '#fb923c',
];

const toRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Extract top domains by frequency from actual persona data
const domainCounts: Record<string, number> = {};
PERSONA_LIST.forEach(p => (p.domain ?? []).forEach(d => {
  domainCounts[d] = (domainCounts[d] || 0) + 1;
}));
const TOP_DOMAINS = Object.entries(domainCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 9)
  .map(([key, count], i) => ({
    name: DOMAIN_NAME_MAP[key] ?? key,
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
    glow: toRgba(DOMAIN_COLORS[i % DOMAIN_COLORS.length], 0.4),
    count,
    size: 120 - i * 4,
  }));

function DomainOrbs() {
  return (
    <div className="relative w-full h-48 flex items-center justify-center">
      {/* Orb container */}
      <div className="absolute inset-0 flex items-center justify-center">
        {TOP_DOMAINS.map((d, i) => {
          const angle = (i / TOP_DOMAINS.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 130;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <motion.div
              key={d.name}
              className="absolute flex flex-col items-center gap-1 cursor-default"
              style={{ x, y }}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.6 }}
              whileHover={{ scale: 1.15 }}
            >
              <div
                className="rounded-full flex items-center justify-center font-semibold text-white shadow-lg"
                style={{
                  width: d.size,
                  height: d.size,
                  background: `radial-gradient(circle at 35% 35%, ${d.color}, ${d.color}80)`,
                  boxShadow: `0 0 ${d.size * 0.4}px ${d.glow}, 0 0 ${d.size * 0.8}px ${d.glow}`,
                }}
              >
                <span className="text-xs px-2 text-center leading-tight">{d.name}</span>
              </div>
            </motion.div>
          );
        })}
        {/* Center glow */}
        <div className="absolute w-16 h-16 rounded-full bg-white/5" />
      </div>
    </div>
  );
}

// ─── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({
  mode,
  index,
  onClick,
}: {
  mode: (typeof MODES)[keyof typeof MODES];
  index: number;
  onClick: () => void;
}) {
  const accentColors: Record<string, string> = {
    solo: '#818cf8',
    prism: '#c084fc',
    roundtable: '#38bdf8',
    mission: '#34d399',
    epoch: '#f87171',
    council: '#fbbf24',
    oracle: '#a78bfa',
    fiction: '#fb7185',
  };
  const accent = accentColors[mode.id] || '#818cf8';

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-2xl p-6 text-left border border-white/[0.06] bg-bg-elevated/40 hover:bg-bg-elevated/60 hover:border-white/[0.1] transition-all duration-300 overflow-hidden"
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
        style={{ background: `${accent}18`, color: accent }}
      >
        <span className="text-xl">{mode.icon}</span>
      </div>

      {/* Label */}
      <h3 className="font-semibold text-text-primary text-base mb-1.5">{mode.label}</h3>

      {/* Tagline */}
      <p className="text-xs text-text-muted leading-relaxed mb-4">{mode.tagline}</p>

      {/* Meta */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: `${accent}15`,
            color: accent,
            border: `1px solid ${accent}30`,
          }}
        >
          {mode.minParticipants}-{mode.maxParticipants}人
        </span>
      </div>

      {/* Hover arrow */}
      <div
        className="absolute bottom-5 right-5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
        style={{ background: `${accent}20`, color: accent }}
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </motion.button>
  );
}

// ─── Persona Showcase Card ───────────────────────────────────────────────────────

function PersonaShowcaseCard({
  persona,
  index,
}: {
  persona: (typeof PERSONA_LIST)[number];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
    >
      <Link href={`/personas/${persona.slug}`}>
        <div className="group relative rounded-2xl border border-white/[0.06] bg-bg-surface/60 hover:bg-bg-elevated/80 hover:border-white/[0.1] transition-all duration-300 p-5 overflow-hidden">
          {/* Top color accent */}
          <div
            className="absolute top-0 left-0 right-0 h-1 opacity-70"
            style={{
              background: `linear-gradient(90deg, ${persona.gradientFrom || '#4d96ff'}, ${persona.gradientTo || '#c77dff'})`,
            }}
          />

          {/* Avatar */}
          <div className="flex items-start gap-4 mt-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${persona.gradientFrom || '#4d96ff'}, ${persona.gradientTo || '#c77dff'})`,
                boxShadow: `0 4px 20px ${(persona.gradientFrom || '#4d96ff')}40`,
              }}
            >
              {persona.nameZh?.[0] || persona.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-text-primary group-hover:text-white transition-colors truncate">
                {persona.nameZh || persona.name}
              </h3>
              <p className="text-xs text-text-muted truncate mt-0.5">
                {persona.tagline || persona.taglineZh}
              </p>
              {/* Domain tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {persona.domain.slice(0, 2).map((d) => (
                  <span
                    key={d}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quote snippet */}
          {persona.taglineZh && (
            <div className="mt-4 pl-3 border-l-2 border-white/10">
              <p className="text-xs text-text-muted italic leading-relaxed line-clamp-2">
                &ldquo;{persona.taglineZh}&rdquo;
              </p>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<string>('prism');

  const handleModeClick = (modeId: string) => {
    setSelectedMode(modeId);
    router.push(`/app?mode=${modeId}`);
  };

  return (
    <div className="min-h-screen bg-bg-base">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-28 px-6 overflow-hidden min-h-[92vh] flex flex-col justify-center">
        {/* Layered atmospheric background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-prism-purple/10 blur-[150px]" />
          <div className="absolute top-10 right-1/4 w-[400px] h-[400px] rounded-full bg-prism-blue/10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-prism-cyan/6 blur-[100px]" />
        </div>

        <HeroParticles />
        <PrismLight />

        <div className="max-w-5xl mx-auto relative">
          {/* Tagline badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-10"
          >
            <Quote className="w-3.5 h-3.5 text-prism-blue" />
            <span className="text-xs text-text-secondary italic">
              「人可以是书，那么，书也可以是人」
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-8 leading-[1.05] tracking-tight"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <span className="gradient-text">{APP_NAME}</span>
            <br />
            <span className="text-text-primary/90 font-light">棱镜折射</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-lg md:text-xl text-text-secondary mb-6 leading-relaxed max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            一道白光，经由卓越思维的棱镜，折射出七彩的光谱
          </motion.p>

          {/* Description */}
          <motion.p
            className="text-base text-text-muted mb-12 leading-relaxed max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            每本书都是一个卓越灵魂的凝结。当我们阅读那些伟大人物的著作时，不仅是在获取知识，更是在与一个伟大的灵魂对话。
            棱镜折射让乔布斯、马斯克、芒格、费曼同时成为你的思维棱镜——不是引用他们说过的话，而是用他们各自独特的方式，折射你的每一个问题。
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <Link
              href="/app"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-prism-gradient text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-prism-blue/20 text-base"
            >
              <Play className="w-4 h-4" />
              开始体验
            </Link>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all text-base font-medium"
            >
              <Sparkles className="w-4 h-4" />
              蒸馏方法论
            </Link>
          </motion.div>

          {/* Bottom stats */}
          <motion.div
            className="flex items-center gap-8 mt-16 pt-10 border-t border-white/[0.06]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            {[
              { value: String(PERSONA_LIST.length), label: '蒸馏人物', color: '#4d96ff' },
              { value: '8', label: '协作模式', color: '#6bcb77' },
              { value: '1.8GB+', label: '训练语料', color: '#c77dff' },
              { value: '∞', label: '视角组合', color: '#ff9f43' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: stat.color }}
                />
                <div>
                  <span className="text-lg font-bold text-text-primary">{stat.value}</span>
                  <span className="text-xs text-text-muted ml-1.5">{stat.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-xs text-text-muted">向下探索</span>
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      </section>

      {/* ── Domain Orbs ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-y border-white/[0.04] bg-bg-surface/20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">
              覆盖 {PERSONA_LIST.length} 位卓越人物的思想宇宙
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              从古典哲学到现代科学，从东方智慧到硅谷思维——每一个领域的卓越头脑，都已成为你的思维伙伴
            </p>
          </motion.div>
          <DomainOrbs />
        </div>
      </section>

      {/* ── Mode Showcase ───────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-text-muted mb-4">
              <Layers className="w-3.5 h-3.5" />
              8 种协作模式
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              选择你的思维协作方式
            </h2>
            <p className="text-text-muted max-w-lg mx-auto">
              从单人深度追问到多智能体实时辩论，找到最适合你的思维伙伴组合
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.values(MODES).map((mode, i) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                index={i}
                onClick={() => handleModeClick(mode.id)}
              />
            ))}
          </div>

          <motion.div
            className="text-center mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-prism-blue/20"
            >
              开始体验
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Featured Personas ─────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="flex items-end justify-between mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-text-muted mb-3">
                <BookOpen className="w-3.5 h-3.5" />
                人物档案馆
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold">
                蒸馏人物
              </h2>
            </div>
            <Link
              href="/personas"
              className="hidden md:flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERSONA_LIST.slice(0, 6).map((p, i) => (
              <PersonaShowcaseCard key={p.id} persona={p} index={i} />
            ))}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link href="/personas" className="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center justify-center gap-1.5">
              查看全部人物
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Philosophy / Pull Quote ─────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            {/* Decorative quote mark */}
            <div className="relative inline-block mb-8">
              <Quote className="w-16 h-16 text-white/5 mx-auto" />
            </div>

            <blockquote className="text-2xl md:text-3xl font-display font-bold text-text-primary leading-snug mb-6 italic">
              我们不是在训练一个知道很多的知识库，
              <br />
              <span className="gradient-text">我们是在蒸馏一种思维方式。</span>
            </blockquote>

            <p className="text-text-muted text-sm max-w-xl mx-auto leading-relaxed">
              棱镜折射基于「认知蒸馏」技术，通过深度访谈、文献研究、著作分析等方式，
              对人类历史上最卓越的思考者进行系统性分析，重构他们的思维模型、决策框架和表达 DNA。
            </p>

            <div className="mt-8 pt-8 border-t border-white/[0.06] flex items-center justify-center gap-6 flex-wrap">
              {[
                { icon: <Brain className="w-4 h-4" />, label: '深度蒸馏' },
                { icon: <GitMerge className="w-4 h-4" />, label: '多视角协作' },
                { icon: <Target className="w-4 h-4" />, label: '解决实际问题' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-text-muted text-sm">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            {/* Decorative background */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-prism-blue/8 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-prism-blue/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Border */}
            <div className="absolute inset-0 rounded-3xl border border-white/[0.08] pointer-events-none" />

            <div className="relative py-16 px-8">
              {/* Crown */}
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-8">
                <Crown className="w-7 h-7 text-amber-400/80" />
              </div>

              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                开始你的思维进化之旅
              </h2>
              <p className="text-text-muted mb-10 max-w-sm mx-auto leading-relaxed">
                {PERSONA_LIST.length} 位经过 Zero 引擎科学蒸馏的思维伙伴已经就位。
                选择一位，开启真正有深度的认知协作。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-prism-gradient text-white font-semibold hover:opacity-90 transition-all shadow-xl shadow-prism-blue/25 text-base"
                >
                  <Zap className="w-5 h-5" />
                  免费开始体验
                </Link>
                <Link
                  href="/personas"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all text-base font-medium"
                >
                  <BookOpen className="w-5 h-5" />
                  浏览人物库
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Comments ───────────────────────────────────────────────────────── */}
      <CommentsSection />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
