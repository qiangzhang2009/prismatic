/**
 * Prismatic — Persona Detail Page (Client)
 */

'use client';

import { useState, useEffect } from 'react';
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
  BookOpen,
  Mic,
  Clock,
  Layers,
  CheckCircle2,
  Star,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import type { Persona } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PERSONA_CONFIDENCE, getConfidenceLevel } from '@/lib/confidence';
import type { ConfidenceScore } from '@/lib/confidence';
import { trackModelExpand } from '@/lib/use-tracking';

interface Props {
  persona: Persona;
  colors: { accent: string; from: string; to: string };
}

const DIMENSION_LABELS = {
  dataCoverage: { label: '数据覆盖', icon: <BookOpen className="w-3.5 h-3.5" /> },
  rawMaterial: { label: '原始素材', icon: <Mic className="w-3.5 h-3.5" /> },
  timeSpan: { label: '时间跨度', icon: <Clock className="w-3.5 h-3.5" /> },
  contentDiversity: { label: '内容多样', icon: <Layers className="w-3.5 h-3.5" /> },
  sourceVerifiability: { label: '来源可验证', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
} as const;

const DIMENSION_KEYS = Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>;

const TABS = [
  { id: 'mental-models', label: '心智模型', icon: <Brain className="w-4 h-4" /> },
  { id: 'voice', label: '表达DNA', icon: <Zap className="w-4 h-4" /> },
  { id: 'quotes', label: '核心引用', icon: <Quote className="w-4 h-4" /> },
  { id: 'tensions', label: '内在张力', icon: <Eye className="w-4 h-4" /> },
  { id: 'confidence', label: '置信度', icon: <TrendingUp className="w-4 h-4" /> },
];

function MentalModelCard({ model, accentColor, personaId }: { model: Persona['mentalModels'][0]; accentColor: string; personaId: string }) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded) {
      trackModelExpand(personaId, model.id, model.nameZh);
    }
    setExpanded(!expanded);
  };

  return (
    <motion.div
      className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        className="w-full flex items-start gap-4 p-5 text-left"
        onClick={handleToggle}
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

  // 追踪人物详情页浏览
  useEffect(() => {
    if (window.zxqTrackV2) {
      window.zxqTrackV2.track('persona_view', {
        persona_id: persona.id,
        persona_name: persona.nameZh,
        domain: persona.domain?.[0],
        page_path: window.location.pathname,
      });
    }
  }, [persona]);

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

              {/* Scroll CTA */}
              <div className="flex items-center gap-3 mt-4">
                <Link
                  href={`/personas/${persona.slug}/scroll`}
                  className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{
                    background: `${colors.accent}15`,
                    color: colors.accent,
                    border: `1px solid ${colors.accent}33`,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  展开画卷
                </Link>
                <span className="text-xs text-text-muted">沉浸式体验这个灵魂</span>
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
                <MentalModelCard key={m.id} model={m} accentColor={colors.accent} personaId={persona.id} />
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

          {/* Confidence Tab */}
          {activeTab === 'confidence' && (() => {
            const confidence: ConfidenceScore | undefined = PERSONA_CONFIDENCE[persona.id];
            if (!confidence) {
              return (
                <div className="text-center py-12 text-text-muted text-sm">
                  暂无置信度数据，该人物正在完善中
                </div>
              );
            }
            const level = getConfidenceLevel(confidence.overall);
            return (
              <div className="space-y-6">
                {/* Score hero */}
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg width="96" height="96" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <circle
                        cx="48" cy="48" r="40" fill="none"
                        stroke={level.color} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(confidence.overall / 100) * 251} 251`}
                        strokeDashoffset="62.75"
                        transform="rotate(-90 48 48)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: level.color }}>{confidence.overall}</span>
                      <span className="text-[10px] text-text-muted">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-text-primary mb-1">综合置信度</h3>
                    <div
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border mb-2"
                      style={{ color: level.color, backgroundColor: level.bgColor, borderColor: level.borderColor }}
                    >
                      {level.label}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
                      基于 5 维度评估：数据覆盖（30%）、原始素材（25%）、时间跨度（15%）、内容多样（15%）、来源可验证（15%）
                    </p>
                  </div>
                </div>

                {/* Five-dimension bars */}
                <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
                  <h4 className="text-sm font-medium text-text-primary mb-4">五维评分</h4>
                  <div className="space-y-3">
                    {DIMENSION_KEYS.map((key) => {
                      const dim = DIMENSION_LABELS[key];
                      const weights: Record<string, number> = {
                        dataCoverage: 30, rawMaterial: 25, timeSpan: 15, contentDiversity: 15, sourceVerifiability: 15,
                      };
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-text-secondary">
                              {dim.icon}
                              {dim.label}
                              <span className="text-text-muted">×{weights[key]}%</span>
                            </span>
                            <span className="font-medium" style={{ color: level.color }}>{confidence[key]}</span>
                          </div>
                          <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${confidence[key]}%`, backgroundColor: level.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Radar chart (simplified CSS version) */}
                <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
                  <h4 className="text-sm font-medium text-text-primary mb-4">能力雷达图</h4>
                  <div className="flex items-center justify-center">
                    <div className="relative w-40 h-40">
                      <svg width="160" height="160" viewBox="0 0 160 160">
                        {/* Grid circles */}
                        {[25, 50, 75, 100].map((level) => (
                          <circle
                            key={level}
                            cx="80" cy="80"
                            r={(level / 100) * 65}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="1"
                          />
                        ))}
                        {/* Axis lines */}
                        {DIMENSION_KEYS.map((_, i) => {
                          const angle = (i * 360 / DIMENSION_KEYS.length) - 90;
                          const rad = (angle * Math.PI) / 180;
                          return (
                            <line
                              key={i}
                              x1="80" y1="80"
                              x2={80 + 65 * Math.cos(rad)}
                              y2={80 + 65 * Math.sin(rad)}
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {/* Score polygon */}
                        {(() => {
                          const points = DIMENSION_KEYS.map((key, i) => {
                            const angle = (i * 360 / DIMENSION_KEYS.length) - 90;
                            const rad = (angle * Math.PI) / 180;
                            const r = (confidence[key] / 100) * 65;
                            return `${80 + r * Math.cos(rad)},${80 + r * Math.sin(rad)}`;
                          }).join(' ');
                          return (
                            <polygon
                              points={points}
                              fill={`${level.color}25`}
                              stroke={level.color}
                              strokeWidth="1.5"
                            />
                          );
                        })()}
                        {/* Axis labels */}
                        {DIMENSION_KEYS.map((key, i) => {
                          const angle = (i * 360 / DIMENSION_KEYS.length) - 90;
                          const rad = (angle * Math.PI) / 180;
                          const label = DIMENSION_LABELS[key].label;
                          return (
                            <text
                              key={key}
                              x={80 + 78 * Math.cos(rad)}
                              y={80 + 78 * Math.sin(rad)}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(255,255,255,0.45)"
                              fontSize="8"
                            >
                              {label}
                            </text>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Data sources */}
                {confidence.dataSources.length > 0 && (
                  <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
                    <h4 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: colors.accent }} />
                      数据来源
                    </h4>
                    <div className="space-y-2">
                      {confidence.dataSources.map((src, i) => (
                        <div key={i} className="flex items-start justify-between p-3 bg-bg-base rounded-lg border border-border-subtle">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text-primary">{src.type}</p>
                            <p className="text-xs text-text-muted">{src.source} · {src.quantity}</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className="w-2.5 h-2.5"
                                fill={parseInt(src.quality) >= s ? '#f59e0b' : 'transparent'}
                                stroke={parseInt(src.quality) >= s ? '#f59e0b' : 'rgba(255,255,255,0.15)'}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps */}
                {confidence.mainGaps.length > 0 && (
                  <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
                    <h4 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-prism-orange" />
                      主要缺口
                    </h4>
                    <div className="space-y-2">
                      {confidence.mainGaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                          <span className="text-prism-orange mt-0.5">▸</span>
                          {gap}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                      <Shield className="w-3.5 h-3.5" />
                      置信度越高，人物蒸馏越接近真实人物思维
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
