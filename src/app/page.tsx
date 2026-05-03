'use client';

/**
 * Prismatic — Main Landing Page
 * Refined: World-class data analyst perspective + visual optimization
 * Tagline: "人可以是书，书也可以是人"
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Hexagon, Sparkles, ArrowRight, Play, GitFork,
  Target, Brain, Layers, BarChart3, TrendingUp, Sparkle,
  BookOpen, MessageSquare, GitMerge, Zap, Crown, GitBranch,
  Leaf, Users, Network, LineChart,
} from 'lucide-react';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';
import { CONFIDENCE_LIGHT } from '@/lib/confidence-light';
import { MODES, APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { PersonaCard } from '@/components/persona-card';
import { ModeSelector } from '@/components/mode-selector';
import { Footer } from '@/components/footer';
import { CommentsSection } from '@/components/comments-section';
import { cn, getDomainGradient } from '@/lib/utils';

// ─── Hero Stats ────────────────────────────────────────────────────────────────
// Real data from project census (2026-05-03)
// 82 defined personas (PERSONA_LIST_LIGHT), 8 total modes (6 visible), ~3GB persona corpus
const HERO_STATS = [
  { value: '82', label: '蒸馏人物', icon: BookOpen, color: '#4d96ff' },
  { value: '6', label: '协作模式', icon: Layers, color: '#6bcb77' },
  { value: '3GB', label: '原始语料', icon: BarChart3, color: '#c77dff' },
  { value: '∞', label: '视角组合', icon: TrendingUp, color: '#ff9f43' },
];

// ─── Data Visualization Bar ─────────────────────────────────────────────────────
// Dynamically computed from PERSONA_CONFIDENCE real data
const DOMAIN_CATEGORIES = [
  {
    label: '古典哲学',
    domains: ['philosophy', 'stoicism'],
    color: '#4d96ff',
  },
  {
    label: '斯多葛学派',
    domains: [],
    color: '#8e44ad',
    fallbackPersonas: ['marcus-aurelius', 'epictetus', 'seneca'],
  },
  {
    label: '东方智慧',
    domains: ['zen-buddhism', 'spirituality', 'chinese-medicine'],
    color: '#ff6b6b',
    fallbackPersonas: ['jiqun', 'lao-zi', 'zhuang-zi', 'confucius', 'mencius', 'hui-neng', 'liduomin', 'liudunhou', 'zhangjingyue', 'wujutong', 'zhudanhsi', 'zhadanxin', 'wangqingren', 'yetianshi'],
  },
  {
    label: '科技思想',
    domains: ['technology', 'AI', 'engineering', 'semiconductor'],
    color: '#6bcb77',
  },
  {
    label: '投资哲学',
    domains: ['investment', 'economics'],
    color: '#ffd93d',
  },
  {
    label: '科学思维',
    domains: ['science'],
    color: '#c77dff',
  },
];

function computeCorpusData() {
  return DOMAIN_CATEGORIES.map((cat) => {
    let scores: number[] = [];

    if (cat.domains.length > 0) {
      // Find personas whose domain overlaps with this category
      scores = PERSONA_LIST_LIGHT
        .filter((p) => p.domain.some((d) => cat.domains.includes(d)))
        .map((p) => CONFIDENCE_LIGHT[p.id])
        .filter((s): s is number => s !== undefined);
    }

    if (scores.length === 0 && cat.fallbackPersonas) {
      // Fallback: use specific known personas for this category
      scores = cat.fallbackPersonas
        .map((id) => CONFIDENCE_LIGHT[id])
        .filter((s): s is number => s !== undefined);
    }

    const value = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length / 100
      : 0;

    return { label: cat.label, value, color: cat.color };
  });
}

const CORPUS_DATA = computeCorpusData();

// ─── Featured Personas ─────────────────────────────────────────────────────────
const FEATURED_PERSONAS = PERSONA_LIST_LIGHT.slice(0, 6);

// ─── Mode Cards ────────────────────────────────────────────────────────────────
const MODE_ICONS: Record<string, React.ReactNode> = {
  solo: <MessageSquare className="w-6 h-6" />,
  prism: <Layers className="w-6 h-6" />,
  roundtable: <GitMerge className="w-6 h-6" />,
  mission: <Target className="w-6 h-6" />,
};

export default function HomePage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<string>('prism');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleModeClick = (modeId: string) => {
    setSelectedMode(modeId);
    router.push(`/app?mode=${modeId}`);
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6 relative overflow-hidden">
        {/* Background: layered orbs for depth */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-prism-purple/8 blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-prism-blue/8 blur-[100px]" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-prism-cyan/5 blur-[80px]" />
        
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <div className="max-w-5xl mx-auto relative">
          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8"
          >
            <Sparkle className="w-3.5 h-3.5 text-prism-blue" />
            <span className="text-xs text-text-secondary">「人可以是书，那么，书也可以是人」</span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-none tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="gradient-text">{APP_NAME}</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-text-secondary mb-3 font-light max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {APP_DESCRIPTION}
          </motion.p>

          <motion.p
            className="text-base text-text-muted max-w-xl mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            每个人的一生都是一本书，每本书都是一个人的灵魂。
            当我们阅读那些卓越人物的著作时，不仅是在获取知识，更是在与一个伟大的灵魂对话。
            <br />{APP_NAME} 已蒸馏 {PERSONA_LIST_LIGHT.length} 位卓越人物，涵盖哲学、投资、科技、科学、东方智慧等领域。
            让乔布斯、马斯克、芒格、费曼同时为你思考——不是引用他们说过的话，而是用他们的方式去思考你的问题。
          </motion.p>

          {/* CTA */}
          <motion.div
            className="flex flex-wrap items-center gap-3 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-prism-blue/20"
            >
              <Play className="w-4 h-4" />
              开始体验
            </Link>
            <Link
              href="/personas"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-text-primary font-medium hover:bg-white/5 transition-all backdrop-blur-sm"
            >
              探索 {PERSONA_LIST_LIGHT.length} 位蒸馏人物
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Stats Row - redesigned with glass effect */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {HERO_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 text-center"
              >
                <stat.icon className="w-5 h-5 mx-auto mb-3 opacity-60" style={{ color: stat.color }} />
                <div className="text-3xl font-bold text-text-primary mb-1 tracking-tight">{stat.value}</div>
                <div className="text-xs text-text-muted tracking-wide uppercase">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Data Quality Visualization ────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-3">
              语料置信度分布
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              基于全网可获取的完整语料，从零开始系统梳理。每个领域的置信度代表数据的完整程度与质量。
            已覆盖 {PERSONA_LIST_LIGHT.length} 位蒸馏人物，涵盖哲学、投资、科技、科学、东方智慧等多个领域
            </p>
          </motion.div>

          {/* Horizontal bar chart - redesigned */}
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {CORPUS_DATA.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className="flex items-center gap-5"
              >
                <div className="w-20 text-sm text-text-secondary text-right font-medium flex-shrink-0">{item.label}</div>
                <div className="flex-1 h-8 bg-bg-elevated rounded-xl overflow-hidden relative shadow-inner">
                  <motion.div
                    className="h-full rounded-xl relative"
                    style={{ backgroundColor: item.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.value * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.2 + 0.1 * i, ease: 'easeOut' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                  </motion.div>
                  <div className="absolute inset-0 flex items-center justify-end pr-4">
                    <span className="text-sm font-semibold text-white drop-shadow-lg">{Math.round(item.value * 100)}%</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-text-muted flex-shrink-0 text-right">
                  {item.value >= 0.9 ? '5.0' : item.value >= 0.75 ? '4.0' : '3.0'}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center text-xs text-text-muted mt-8 border-t border-border-subtle pt-6">
            数据来源：PerseusDL · chinese-philosophy · The-Digital-Stoic-Library · 全唐诗 (quantangshi) · 古希腊哲学 (greek-classics) · 等 54 个语料目录
          </motion.p>
        </div>
      </section>

      {/* ── Mode Showcase ────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-3">
              选择你的协作模式
            </h2>
            <p className="text-text-muted text-sm max-w-lg mx-auto">
              从单人深度追问到多智能体实时辩论，找到最适合你的思维伙伴组合
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.values(MODES).map((mode, i) => {
              const isSelected = selectedMode === mode.id;
              // 模式专属色彩配置
              const modeColors: Record<string, { gradient: string; glow: string; icon: string }> = {
                solo: { gradient: 'from-indigo-600/25 to-indigo-500/5', glow: 'shadow-indigo-500/20', icon: 'text-indigo-400' },
                prism: { gradient: 'from-violet-600/25 to-violet-500/5', glow: 'shadow-violet-500/20', icon: 'text-violet-400' },
                roundtable: { gradient: 'from-sky-600/25 to-sky-500/5', glow: 'shadow-sky-500/20', icon: 'text-sky-400' },
                epoch: { gradient: 'from-red-600/25 to-red-500/5', glow: 'shadow-red-500/20', icon: 'text-red-400' },
                mission: { gradient: 'from-emerald-600/25 to-emerald-500/5', glow: 'shadow-emerald-500/20', icon: 'text-emerald-400' },
                council: { gradient: 'from-amber-600/25 to-amber-500/5', glow: 'shadow-amber-500/20', icon: 'text-amber-400' },
                oracle: { gradient: 'from-purple-600/25 to-purple-500/5', glow: 'shadow-purple-500/20', icon: 'text-purple-400' },
                fiction: { gradient: 'from-pink-600/25 to-pink-500/5', glow: 'shadow-pink-500/20', icon: 'text-pink-400' },
              };
              const colors = modeColors[mode.id] || modeColors.prism;

              return (
                <motion.button
                  key={mode.id}
                  onClick={() => handleModeClick(mode.id)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative rounded-2xl p-5 text-left transition-all duration-300 border overflow-hidden',
                    isSelected
                      ? 'border-white/20 shadow-xl'
                      : 'border-white/5 hover:border-white/10 hover:shadow-lg'
                  )}
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)`
                      : undefined,
                  }}
                >
                  {/* Glow effect for selected */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `linear-gradient(135deg, ${mode.accent}15 0%, transparent 60%)`,
                      }}
                    />
                  )}

                  {/* Gradient background for unselected */}
                  {!isSelected && (
                    <div
                      className="absolute inset-0 opacity-30 rounded-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${mode.accent}10 0%, transparent 50%)`,
                      }}
                    />
                  )}

                  <div className="relative z-10">
                    {/* Icon with colored background */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                        isSelected ? 'bg-white/10' : 'bg-white/5'
                      )}
                      style={{
                        background: isSelected ? `${mode.accent}20` : `${mode.accent}10`,
                      }}
                    >
                      <span className={isSelected ? 'text-2xl' : 'text-xl'}>{mode.icon}</span>
                    </div>

                    {/* Mode label */}
                    <div className={cn('font-bold mb-1', isSelected ? 'text-text-primary text-base' : 'text-text-secondary text-sm')}>
                      {mode.label}
                    </div>

                    {/* Description */}
                    <div className="text-xs text-text-muted leading-relaxed mb-4">
                      {mode.description}
                    </div>

                    {/* Tag badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-md"
                        style={{
                          background: `${mode.accent}15`,
                          color: mode.accent,
                          border: `1px solid ${mode.accent}30`,
                        }}
                      >
                        {mode.minParticipants}-{mode.maxParticipants}人
                      </span>
                      <span
                        className="text-[10px] px-2 py-1 rounded-md"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {mode.tagline}
                      </span>
                    </div>
                  </div>

                  {/* Active indicator dot */}
                  {isSelected && (
                    <div
                      className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full shadow-lg"
                      style={{ background: mode.accent }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center mt-10"
          >
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-prism-blue/20"
            >
              <Sparkles className="w-4 h-4" />
              开始体验
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Featured Personas ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-10"
          >
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-2">
                蒸馏人物
              </h2>
              <p className="text-text-muted text-sm">
                覆盖哲学、投资、科技、科学、东方智慧等多个领域
              </p>
            </div>
            <Link
              href="/personas"
              className="hidden md:flex items-center gap-1 text-sm text-prism-blue hover:underline"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURED_PERSONAS.map((persona, i) => {
              return (
                <motion.div
                  key={persona.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                >
                  <Link href={`/personas/${persona.slug}`}>
                    <div className="group rounded-xl border border-border-subtle bg-bg-elevated p-4 hover:border-border-medium transition-all duration-200">
                      <div 
                        className="w-12 h-12 rounded-full mb-3 flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${persona.gradientFrom || '#4d96ff'}, ${persona.gradientTo || '#c77dff'})` }}
                      >
                        {persona.nameZh?.[0] || persona.name?.[0] || '?'}
                      </div>
                      <p className="text-sm font-medium text-text-primary group-hover:text-prism-blue transition-colors truncate">
                        {persona.nameZh || persona.name}
                      </p>
                      <p className="text-xs text-text-muted truncate">{persona.tagline || persona.taglineZh}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link href="/personas" className="text-sm text-prism-blue hover:underline flex items-center justify-center gap-1">
              查看全部人物
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TCM Atlas Showcase ────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-10"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-emerald-400/80 uppercase tracking-widest">专题探索</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-2">
                中医思想家影响力图谱
              </h2>
              <p className="text-text-muted text-sm max-w-xl">
                从《黄帝内经》到温病学说，22 位跨文明医家的知识传承网络
              </p>
            </div>
            <Link
              href="/tcm-atlas"
              className="hidden md:flex items-center gap-1 text-sm text-emerald-400 hover:underline"
            >
              完整探索
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          {/* Mini graph preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden border border-white/8 mb-8"
            style={{ height: 320, background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}
          >
            {/* Background grid */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />

            {/* Decorative graph nodes */}
            {[
              { cx: 18, cy: 50, r: 3, color: '#f59e0b', label: '黄帝内经' },
              { cx: 36, cy: 30, r: 2.5, color: '#60a5fa', label: '伤寒论' },
              { cx: 36, cy: 65, r: 2.5, color: '#34d399', label: '刘完素' },
              { cx: 36, cy: 80, r: 2, color: '#a3e635', label: '李时珍' },
              { cx: 54, cy: 20, r: 2, color: '#c084fc', label: '温病学说' },
              { cx: 54, cy: 38, r: 2, color: '#60a5fa', label: '张仲景' },
              { cx: 54, cy: 58, r: 2, color: '#d97706', label: '李东垣' },
              { cx: 54, cy: 72, r: 2, color: '#6ee7b7', label: '张从正' },
              { cx: 72, cy: 25, r: 2, color: '#c084fc', label: '叶天士' },
              { cx: 72, cy: 48, r: 2, color: '#f472b6', label: '张景岳' },
              { cx: 72, cy: 62, r: 2, color: '#fb923c', label: '王清任' },
              { cx: 72, cy: 78, r: 2, color: '#e879f9', label: '唐宗海' },
            ].map((n, i) => (
              <div
                key={i}
                className="absolute"
                style={{ left: `${n.cx}%`, top: `${n.cy}%`, transform: 'translate(-50%, -50%)' }}
              >
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: n.r * 2 + 8, height: n.r * 2 + 8,
                    background: n.color + '20',
                    border: `1.5px solid ${n.color}60`,
                    boxShadow: `0 0 8px ${n.color}30`,
                    marginLeft: -(n.r + 4), marginTop: -(n.r + 4),
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                />
                <motion.div
                  className="rounded-full"
                  style={{
                    width: n.r * 2, height: n.r * 2,
                    background: `radial-gradient(circle at 35% 35%, ${n.color}cc, ${n.color})`,
                    boxShadow: `0 0 6px ${n.color}80`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                />
              </div>
            ))}

            {/* Decorative edges */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ overflow: 'visible' }}>
              {[
                [18, 50, 36, 30], [18, 50, 36, 65], [18, 50, 36, 80],
                [36, 30, 54, 20], [36, 30, 54, 38],
                [36, 65, 54, 58], [36, 65, 54, 72],
                [36, 80, 54, 78],
                [54, 20, 72, 25], [54, 38, 72, 48], [54, 58, 72, 62], [54, 78, 72, 78],
              ].map(([x1p, y1p, x2p, y2p], i) => (
                <motion.line
                  key={i}
                  x1={`${x1p}%`} y1={`${y1p}%`} x2={`${x2p}%`} y2={`${y2p}%`}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.03, duration: 0.4 }}
                />
              ))}
            </svg>

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050d1a] via-transparent to-[#050d1a]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050d1a] via-transparent to-transparent" />

            {/* Corner label */}
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-400/60 bg-emerald-500/10 border border-emerald-500/20">
              知识传承网络 · 预览
            </div>

            {/* Stats overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6">
              {[
                { value: '22', label: '思想家', icon: Users },
                { value: '7', label: '经典典籍', icon: BookOpen },
                { value: '28', label: '知识关系', icon: Network },
                { value: '6', label: '关系类型', icon: LineChart },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/8"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                >
                  <stat.icon className="w-3.5 h-3.5 text-emerald-400/70" />
                  <span className="text-white font-mono font-bold text-sm">{stat.value}</span>
                  <span className="text-slate-400 text-xs">{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Three insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Network,
                title: '经典奠基 → 流派分化',
                desc: '《黄帝内经》建立阴阳五行框架，张仲景开创六经辨证，金元四大家各执一端——寒凉、补土、滋阴、攻邪',
                color: '#f59e0b',
                stat: '理论演进脉络',
              },
              {
                icon: Users,
                title: '跨文明医家网络',
                desc: '从古希腊希波克拉底到印度遮罗迦，从中国历代名家到日本曲直濑道三，医学智慧的跨文化共鸣',
                color: '#60a5fa',
                stat: '跨文化共鸣',
              },
              {
                icon: LineChart,
                title: '从理论到临床',
                desc: '伤寒论 → 六经辨证 → 卫气营血/三焦辨证，温病学说将热病理论推向新高度',
                color: '#34d399',
                stat: '临床分化',
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="rounded-xl p-5 border"
                style={{
                  background: card.color + '06',
                  borderColor: card.color + '20',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: card.color + '15' }}
                  >
                    <card.icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: card.color + '12', color: card.color, border: `1px solid ${card.color}25` }}
                  >
                    {card.stat}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">{card.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8 md:hidden">
            <Link href="/tcm-atlas" className="text-sm text-emerald-400 hover:underline flex items-center justify-center gap-1">
              探索完整图谱
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── About Section ─────────────────────────────────────────────────── */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary mb-4">
              关于{APP_NAME}
            </h2>
            <p className="text-text-secondary leading-relaxed max-w-2xl mx-auto">
              {APP_NAME} 基于「认知蒸馏」技术，通过深度访谈、文献研究、著作分析等方式，
              对人类历史上最卓越的思考者进行系统性分析，重构他们的思维模型、决策框架和表达 DNA。
              <br />目前已蒸馏 {PERSONA_LIST_LIGHT.length} 位卓越人物，支持 6 种协作模式，从单人深度追问到多智能体实时辩论，
              让不同领域的顶尖头脑同时为你思考，发现单一视角无法产生的洞见。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: '深度蒸馏', desc: '从原始文本中提取思维模式和决策框架，而非简单的角色扮演' },
              { icon: Layers, title: '多视角协作', desc: '不同领域的蒸馏人物可以同时参与讨论，碰撞出单一视角无法产生的洞见' },
              { icon: Target, title: '解决实际问题', desc: '不只是提供观点，而是将智慧应用于你的具体问题' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <item.icon className="w-7 h-7 text-text-secondary mx-auto mb-5" />
                <h3 className="font-medium text-text-primary mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl relative overflow-hidden p-12 md:p-16"
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-prism-blue/10 via-transparent to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-prism-blue/10 rounded-full blur-[100px]" />
            
            {/* Border */}
            <div className="absolute inset-0 rounded-3xl border border-white/10" />
            
            <div className="relative">
              <Crown className="w-12 h-12 text-amber-400/80 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
                开始你的思维进化之旅
              </h2>
              <p className="text-text-secondary mb-10 max-w-md mx-auto leading-relaxed">
                无论是深入探索一个思想家的智慧，还是让多个领域的顶尖头脑同时为你思考，{APP_NAME} 都是你的认知升级工具
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-prism-gradient text-white font-semibold hover:opacity-90 transition-all shadow-xl shadow-prism-blue/25 text-base"
                >
                  <Zap className="w-5 h-5" />
                  免费开始体验
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
