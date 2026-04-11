/**
 * Prismatic — Main Landing Page
 * The prism that refracts the best minds into action
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Hexagon,
  Sparkles,
  Users,
  Network,
  Zap,
  ArrowRight,
  Star,
  GitFork,
  Play,
} from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { MODES, APP_TAGLINE, APP_NAME } from '@/lib/constants';
import { PersonaCard } from '@/components/persona-card';
import { ModeSelector } from '@/components/mode-selector';
import { UserMenu } from '@/components/user-menu';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState('prism');
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Hexagon className="w-8 h-8 text-prism-blue" strokeWidth={1.5} />
              <Sparkles className="w-3 h-3 text-prism-purple absolute -top-1 -right-1" />
            </div>
            <span className="font-display font-bold text-lg gradient-text">{APP_NAME}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/personas" className="text-text-secondary hover:text-text-primary transition-colors text-sm">
              人物档案馆
            </Link>
            <Link href="/graph" className="text-text-secondary hover:text-text-primary transition-colors text-sm">
              知识图谱
            </Link>
            <Link href="/demo" className="text-text-secondary hover:text-text-primary transition-colors text-sm">
              在线体验
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <GitFork className="w-4 h-4" />
              <span className="hidden md:inline">GitHub</span>
            </a>
            <div className="pl-2 border-l border-border-subtle">
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Animated prism */}
          <motion.div
            className="relative w-24 h-24 mx-auto mb-10"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute inset-0 rounded-2xl bg-prism-gradient opacity-20 blur-xl" />
            <div className="absolute inset-2 rounded-xl bg-bg-surface flex items-center justify-center">
              <Hexagon className="w-12 h-12 text-prism-blue" strokeWidth={1} />
            </div>
            {/* Orbit particles */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.div
                key={angle}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f43'][i],
                  top: '50%',
                  left: '50%',
                  transformOrigin: '0 40px',
                  transform: `rotate(${angle}deg) translateX(40px)`,
                }}
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
              />
            ))}
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-5xl md:text-6xl font-display font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="gradient-text">{APP_NAME}</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-text-secondary mb-4 font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {APP_TAGLINE}
          </motion.p>

          <motion.p
            className="text-base text-text-muted max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            不是单个人物的角色扮演——是多个蒸馏人物的实时协作辩论、联合分析与协同任务执行。
            汇聚人类最卓越的认知操作系统，让决策质量产生质的飞跃。
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link
              href="/app"
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              开始体验
            </Link>
            <Link
              href="/personas"
              className="btn-ghost flex items-center gap-2 border border-border-subtle rounded-xl px-6 py-2.5"
            >
              探索人物库
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex items-center justify-center gap-12 mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { value: '15', label: '蒸馏人物' },
              { value: '4', label: '协作模式' },
              { value: '100+', label: '心智模型' },
              { value: '∞', label: '视角组合' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Mode Showcase ───────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">选择你的协作模式</h2>
            <p className="text-text-secondary">从单人深度对话到多智能体协作，找到最适合你的思维伙伴组合</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(MODES).map((mode, i) => (
              <motion.button
                key={mode.id}
                className={cn(
                  'relative rounded-2xl p-6 text-left transition-all duration-300',
                  'border',
                  selectedMode === mode.id
                    ? 'border-prism-blue/50 bg-bg-elevated prism-border'
                    : 'border-border-subtle bg-bg-surface hover:border-border-medium'
                )}
                onClick={() => setSelectedMode(mode.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div className="text-3xl mb-3">{mode.icon}</div>
                <div className="font-medium mb-1">{mode.label}</div>
                <div className="text-sm text-text-secondary">{mode.description}</div>
                <div className="text-xs text-text-muted mt-3">
                  {mode.minParticipants}-{mode.maxParticipants}人
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Personas Grid ────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">人物档案馆</h2>
            <p className="text-text-secondary">15位来自不同领域的卓越思考者，等待与你对话</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {PERSONA_LIST.slice(0, 10).map((persona, i) => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                onHoverStart={() => setHoveredPersona(persona.id)}
                onHoverEnd={() => setHoveredPersona(null)}
              >
                <PersonaCard persona={persona} compact />
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/personas"
              className="inline-flex items-center gap-2 text-prism-blue hover:text-prism-purple transition-colors"
            >
              查看全部15位人物
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Users className="w-8 h-8" />,
                title: '折射视图',
                description: '2-3个视角同时分析，全面透视问题本质。每个人物卡片实时展示置信度和引用来源。',
                color: '#4d96ff',
              },
              {
                icon: <Network className="w-8 h-8" />,
                title: '圆桌辩论',
                description: '4+人物实时辩论，系统识别分歧点，引导辩论收敛，输出多方共识陈述和行动建议。',
                color: '#c77dff',
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: '任务模式',
                description: '多角色分工协作，系统自动分解复杂任务，分别执行后综合输出完整解决方案。',
                color: '#ffd93d',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="rounded-2xl p-8 border border-border-subtle bg-bg-surface"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${feature.color}20`, color: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Source Banner ─────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            className="rounded-2xl p-10 border border-border-subtle bg-gradient-to-br from-bg-surface to-bg-elevated"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold gradient-text">开源 · 可部署 · 可扩展</span>
            </div>
            <h2 className="text-2xl font-display font-bold mb-3">成为 Prismatic 的贡献者</h2>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">
              Prismatic 是一个开源项目。我们欢迎对以下方面的贡献：新人物蒸馏、工具脚本、UI改进、
              文档完善、性能优化，以及将 Prismatic 部署到你自己的基础设施上。
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <GitFork className="w-4 h-4" />
                在 GitHub 上星标
              </a>
              <Link href="/docs" className="btn-ghost border border-border-subtle rounded-xl px-6 py-2.5">
                阅读文档
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="w-6 h-6 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-secondary">{APP_NAME}</span>
          </div>
          <div className="text-sm text-text-muted">
            MIT License · Built with Next.js & AI · {new Date().getFullYear()}
          </div>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <Link href="/privacy" className="hover:text-text-secondary">隐私政策</Link>
            <Link href="/terms" className="hover:text-text-secondary">使用条款</Link>
            <Link href="/contact" className="hover:text-text-secondary">联系我们</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
