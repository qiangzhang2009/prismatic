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
} from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import { MODES, APP_NAME, APP_DESCRIPTION } from '@/lib/constants';
import { PersonaCard } from '@/components/persona-card';
import { ModeSelector } from '@/components/mode-selector';
import { Footer } from '@/components/footer';
import { CommentsSection } from '@/components/comments-section';
import { cn } from '@/lib/utils';

// ─── Persona Domain Colors ────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, { from: string; to: string; label: string }> = {
  philosophy: { from: '#4d96ff', to: '#6bcb77', label: '哲学' },
  technology: { from: '#6bcb77', to: '#ffd93d', label: '科技' },
  investment: { from: '#ffd93d', to: '#ff6b6b', label: '投资' },
  entrepreneurship: { from: '#ff6b6b', to: '#c77dff', label: '创业' },
  science: { from: '#c77dff', to: '#4d96ff', label: '科学' },
  default: { from: '#4d96ff', to: '#8e44ad', label: '其他' },
};

function getDomainGradient(domains: string[]) {
  const d = domains?.[0] || 'default';
  return DOMAIN_COLORS[d] || DOMAIN_COLORS.default;
}

// ─── Hero Stats ────────────────────────────────────────────────────────────────
const HERO_STATS = [
  { value: '40+', label: '蒸馏人物', icon: BookOpen, color: '#4d96ff' },
  { value: '4', label: '协作模式', icon: Layers, color: '#6bcb77' },
  { value: '1.2GB+', label: '训练语料', icon: BarChart3, color: '#c77dff' },
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
    domains: ['zen-buddhism', 'spirituality'],
    color: '#ff6b6b',
    fallbackPersonas: ['jiqun', 'lao-zi', 'zhuang-zi', 'confucius', 'mencius', 'hui-neng'],
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
      scores = PERSONA_LIST
        .filter((p) => p.domain.some((d) => cat.domains.includes(d)))
        .map((p) => PERSONA_CONFIDENCE[p.id]?.overall)
        .filter((s): s is number => s !== undefined);
    }

    if (scores.length === 0 && cat.fallbackPersonas) {
      // Fallback: use specific known personas for this category
      scores = cat.fallbackPersonas
        .map((id) => PERSONA_CONFIDENCE[id]?.overall)
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
const FEATURED_PERSONAS = PERSONA_LIST.slice(0, 6);

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
            <br />{APP_NAME} 让乔布斯、马斯克、芒格、费曼同时为你思考——不是引用他们说过的话，而是用他们的方式去思考你的问题。
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
              探索 40+ 蒸馏人物
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
              基于全网可获取的完整语料，从零开始系统梳理。每个领域的置信度代表数据的完整程度与质量
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
            className="text-center text-xs text-text-muted mt-8 border-t border-border-subtle pt-6"
          >
            数据来源：PerseusDL · Guopop/chinese-philosophy · The-Digital-Stoic-Library · HuggingFace Lex Fridman
          </motion.p>
        </div>
      </section>

      {/* ── Mode Showcase ────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(MODES).map((mode, i) => {
              const isSelected = selectedMode === mode.id;
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
                    'relative rounded-2xl p-5 text-left transition-all duration-300 border',
                    isSelected
                      ? 'border-prism-blue/50 bg-gradient-to-b from-white/[0.08] to-transparent shadow-xl shadow-prism-blue/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-prism-blue shadow-lg shadow-prism-blue/50" />
                  )}
                  <div className={cn('mb-4', isSelected ? 'text-prism-blue' : 'text-text-muted')}>
                    {MODE_ICONS[mode.id]}
                  </div>
                  <div className="font-medium text-text-primary mb-2">{mode.label}</div>
                  <div className="text-xs text-text-secondary mb-4 leading-relaxed">{mode.description}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-text-muted bg-white/5 px-2 py-1 rounded-md">
                      {mode.minParticipants}-{mode.maxParticipants}人
                    </span>
                    <span className="text-[10px] text-text-muted/50">·</span>
                    <span className="text-[10px] text-text-muted">{mode.when.slice(0, 10)}...</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
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
