/**
 * Prismatic — Persona Detail Page (Client)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Quote,
  Brain,
  Zap,
  Shield,
  Eye,
  Play,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { Persona } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  persona: Persona;
  colors: { accent: string; from: string; to: string };
}

const TABS = [
  { id: 'mental-models', label: '心智模型', icon: <Brain className="w-4 h-4" /> },
  { id: 'voice', label: '表达DNA', icon: <Zap className="w-4 h-4" /> },
  { id: 'quotes', label: '核心引用', icon: <Quote className="w-4 h-4" /> },
  { id: 'tensions', label: '内在张力', icon: <Eye className="w-4 h-4" /> },
];

function MentalModelCard({ model, accentColor }: { model: Persona['mentalModels'][0]; accentColor: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        className="w-full flex items-start gap-4 p-5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-medium text-sm">{model.nameZh}</h4>
            <span className="text-xs text-text-muted">{model.name}</span>
          </div>
          <p className="text-sm text-text-secondary line-clamp-2">{model.oneLiner}</p>
        </div>
        <div className="flex-shrink-0 text-text-muted">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="px-5 pb-5 border-t border-border-subtle pt-4 space-y-4"
        >
          {/* Evidence */}
          <div>
            <h5 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
              <Quote className="w-3 h-3" />
              原始引用
            </h5>
            <div className="space-y-2">
              {model.evidence.map((e, i) => (
                <div key={i} className="pl-3 border-l-2 border-border-subtle">
                  <p className="text-xs text-text-secondary italic">&ldquo;{e.quote}&rdquo;</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    — {e.source}{e.year ? `, ${e.year}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-domain */}
          <div>
            <h5 className="text-xs font-medium text-text-muted mb-2">跨领域应用</h5>
            <div className="flex flex-wrap gap-1.5">
              {model.crossDomain.map((d) => (
                <span
                  key={d}
                  className="text-xs px-2 py-0.5 rounded-md border"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Application */}
          <div>
            <h5 className="text-xs font-medium text-text-muted mb-2">实际应用</h5>
            <p className="text-xs text-text-secondary">{model.application}</p>
          </div>

          {/* Limitation */}
          <div className="rounded-lg p-3 bg-red-500/5 border border-red-500/15">
            <h5 className="text-xs font-medium text-red-400 mb-1">边界条件</h5>
            <p className="text-xs text-text-secondary">{model.limitation}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function DecisionHeuristicCard({ h, accentColor }: { h: Persona['decisionHeuristics'][0]; accentColor: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-xl border border-border-subtle bg-bg-surface p-4 hover:border-border-medium transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{h.nameZh}</span>
        <span className="text-xs text-text-muted">{h.name}</span>
      </div>
      <p className="text-xs text-text-secondary">{h.description}</p>
      {expanded && (
        <p className="text-xs text-text-muted mt-2 pt-2 border-t border-border-subtle">
          应用于：{h.application}
        </p>
      )}
    </button>
  );
}

export function PersonaDetailClient({ persona, colors }: Props) {
  const [activeTab, setActiveTab] = useState('mental-models');

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/personas" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">人物档案馆</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-3">
            <img
              src={persona.avatar}
              alt={persona.nameZh}
              className="w-7 h-7 rounded-full object-cover"
            />
            <span className="font-display font-semibold text-sm">{persona.nameZh}</span>
          </div>
          <Link
            href={`/app?persona=${persona.id}`}
            className="ml-auto flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
            style={{
              background: `linear-gradient(135deg, ${colors.from}20, ${colors.to}20)`,
              color: colors.accent,
              border: `1px solid ${colors.accent}40`,
            }}
          >
            <Play className="w-3.5 h-3.5" />
            开始对话
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6">
            <img
              src={persona.avatar}
              alt={persona.nameZh}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
              style={{ border: `2px solid ${colors.accent}40` }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-display font-bold">{persona.nameZh}</h1>
                <span className="text-lg text-text-muted">{persona.name}</span>
              </div>
              <p className="text-text-secondary italic mb-3">&ldquo;{persona.taglineZh}&rdquo;</p>
              <p className="text-sm text-text-secondary">{persona.briefZh}</p>

              {/* Domain tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {persona.domain.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2.5 py-0.5 rounded-full border"
                    style={{ borderColor: `${colors.accent}40`, color: colors.accent }}
                  >
                    {d}
                  </span>
                ))}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border-subtle">
                  v{persona.version}
                </span>
              </div>
            </div>
          </div>

          {/* Strengths / Blindspots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="rounded-xl p-4 bg-green-500/5 border border-green-500/15">
              <h3 className="text-sm font-medium text-green-400 mb-2">擅长领域</h3>
              <div className="flex flex-wrap gap-1.5">
                {persona.strengths.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-400">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-4 bg-yellow-500/5 border border-yellow-500/15">
              <h3 className="text-sm font-medium text-yellow-400 mb-2">认知盲区</h3>
              <div className="flex flex-wrap gap-1.5">
                {persona.blindspots.map((b) => (
                  <span key={b} className="text-xs px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Research info */}
          <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
            <span>研究日期：{persona.researchDate}</span>
            <span>·</span>
            <span>版本：v{persona.version}</span>
            <span>·</span>
            <span>心智模型：{persona.mentalModels.length}个</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-current'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                )}
                style={activeTab === tab.id ? { color: colors.accent } : {}}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Content */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Mental Models Tab */}
          {activeTab === 'mental-models' && (
            <div className="space-y-3">
              {persona.mentalModels.map((m) => (
                <MentalModelCard key={m.id} model={m} accentColor={colors.accent} />
              ))}
            </div>
          )}

          {/* Voice DNA Tab */}
          {activeTab === 'voice' && persona.expressionDNA && (
            <div className="space-y-6">
              {/* Sentence style */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: colors.accent }} />
                  句式特征
                </h3>
                <div className="flex flex-wrap gap-2">
                  {persona.expressionDNA.sentenceStyle.map((s) => (
                    <span key={s} className="text-sm px-3 py-1 rounded-lg bg-bg-elevated text-text-secondary border border-border-subtle">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Vocabulary */}
              {persona.expressionDNA.vocabulary.length > 0 && (
                <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
                  <h3 className="font-medium mb-4">标志性词汇</h3>
                  <div className="flex flex-wrap gap-2">
                    {persona.expressionDNA.vocabulary.map((v) => (
                      <span
                        key={v}
                        className="text-sm px-3 py-1 rounded-lg"
                        style={{ backgroundColor: `${colors.accent}15`, color: colors.accent }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Forbidden words */}
              {persona.expressionDNA.forbiddenWords.length > 0 && (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-6">
                  <h3 className="font-medium mb-4 text-red-400 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    禁用词汇（绝不应出现）
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {persona.expressionDNA.forbiddenWords.map((w) => (
                      <span key={w} className="text-sm px-3 py-1 rounded-lg bg-red-500/10 text-red-400">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Other DNA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {persona.expressionDNA.certaintyLevel && (
                  <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                    <h4 className="text-xs text-text-muted mb-1">确定性水平</h4>
                    <p className="text-sm font-medium">{persona.expressionDNA.certaintyLevel}</p>
                  </div>
                )}
                {persona.expressionDNA.rhythm && (
                  <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                    <h4 className="text-xs text-text-muted mb-1">节奏特征</h4>
                    <p className="text-sm text-text-secondary">{persona.expressionDNA.rhythm}</p>
                  </div>
                )}
                {persona.expressionDNA.humorStyle && (
                  <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                    <h4 className="text-xs text-text-muted mb-1">幽默风格</h4>
                    <p className="text-sm text-text-secondary">{persona.expressionDNA.humorStyle}</p>
                  </div>
                )}
                {persona.expressionDNA.rhetoricalHabit && (
                  <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                    <h4 className="text-xs text-text-muted mb-1">修辞习惯</h4>
                    <p className="text-sm text-text-secondary">{persona.expressionDNA.rhetoricalHabit}</p>
                  </div>
                )}
              </div>

              {/* Identity & Chinese Adaptation */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
                <h3 className="font-medium mb-3 text-sm text-text-muted">身份认同</h3>
                <p className="text-sm text-text-secondary italic">&ldquo;{persona.identityPrompt}&rdquo;</p>
              </div>

              {persona.expressionDNA.chineseAdaptation && (
                <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
                  <h3 className="font-medium mb-3 text-sm text-text-muted">中文适配规则</h3>
                  <p className="text-sm text-text-secondary">{persona.expressionDNA.chineseAdaptation}</p>
                </div>
              )}

              {/* Decision Heuristics */}
              {persona.decisionHeuristics.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">决策启发式</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {persona.decisionHeuristics.map((h) => (
                      <DecisionHeuristicCard key={h.id} h={h} accentColor={colors.accent} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quotes Tab */}
          {activeTab === 'quotes' && persona.sources && persona.sources.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Quote className="w-4 h-4" style={{ color: colors.accent }} />
                  主要参考来源
                </h3>
                <div className="space-y-3">
                  {persona.sources.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: s.type === 'primary' ? `${colors.accent}20` : 'bg-bg-elevated',
                          color: s.type === 'primary' ? colors.accent : 'var(--color-text-muted)',
                        }}
                      >
                        {s.type === 'primary' ? '一手' : '二手'}
                      </span>
                      <div>
                        <p className="text-sm text-text-secondary">{s.title}</p>
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {s.url}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tensions Tab */}
          {activeTab === 'tensions' && persona.tensions && persona.tensions.length > 0 && (
            <div className="space-y-4">
              {persona.tensions.map((t, i) => (
                <motion.div
                  key={i}
                  className="rounded-2xl border border-border-subtle bg-bg-surface p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4" style={{ color: colors.accent }} />
                    <h3 className="font-medium text-sm">{t.tensionZh}</h3>
                  </div>
                  <p className="text-sm text-text-secondary">{t.descriptionZh}</p>
                </motion.div>
              ))}

              {/* Honest Boundaries */}
              {persona.honestBoundaries && persona.honestBoundaries.length > 0 && (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-6">
                  <h3 className="font-medium mb-4 text-red-400 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    诚实边界
                  </h3>
                  <div className="space-y-2">
                    {persona.honestBoundaries.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-text-secondary">{b.textZh ?? b.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-12 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-display font-bold mb-3">
            和{persona.nameZh}对话
          </h2>
          <p className="text-text-secondary mb-6">
            开启与{persona.nameZh}的深度思维协作，探索{persona.taglineZh}
          </p>
          <Link
            href={`/app?persona=${persona.id}`}
            className="btn-primary inline-flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
            }}
          >
            <Play className="w-4 h-4" />
            开始对话
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
