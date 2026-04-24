'use client';

/**
 * Prismatic — Observatory Persona Detail Page
 * Full Brain Explorer: mental models, ExpressionDNA, cognitive architecture, cross-persona influence.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Brain,
  BookOpen,
  Target,
  Zap,
  Shield,
  Star,
  TrendingUp,
  MessageCircle,
  GitCompare,
  Radar,
  Dna,
  Eye,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Network,
  Quote,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Clock,
  Globe,
} from 'lucide-react';

import { getPersonaBySlug, getPersonaStats, getPersonasByCluster, PERSONA_INDEX } from '@/lib/persona-index';
import { PERSONAS } from '@/lib/personas';
import { cn } from '@/lib/utils';
import type { ExpressionDNA, MentalModel, DecisionHeuristic, Tension } from '@/lib/types';

// ─── Radar Chart ─────────────────────────────────────────────────────────────

function RadarChart({ data, color, labels }: {
  data: number[];
  color: string;
  labels: string[];
}) {
  const size = 280;
  const center = size / 2;
  const maxRadius = 110;
  const numAxes = data.length;
  const angleStep = (2 * Math.PI) / numAxes;

  const points = data.map((value, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Grid circles
  const gridLevels = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid circles */}
      {gridLevels.map(level => {
        const r = (level / 100) * maxRadius;
        return (
          <circle
            key={level}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + maxRadius * Math.cos(angle)}
            y2={center + maxRadius * Math.sin(angle)}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={color}
          stroke="#0a0a0f"
          strokeWidth={2}
        />
      ))}

      {/* Labels */}
      {labels.map((label, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelRadius = maxRadius + 20;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize={10}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Vocabulary Barcode ─────────────────────────────────────────────────────

function VocabularyBarcode({ vocabulary, color }: { vocabulary: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {vocabulary.slice(0, 20).map((word, i) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
          className="px-3 py-1.5 rounded-full text-sm font-medium border"
          style={{
            backgroundColor: `${color}15`,
            borderColor: `${color}40`,
            color: color,
            opacity: 1 - (i / 20) * 0.4,
          }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

// ─── Mental Model Card ───────────────────────────────────────────────────────

function MentalModelCard({ model, index }: { model: MentalModel; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const nameText = typeof model.nameZh === 'string' ? model.nameZh : typeof model.name === 'string' ? model.name : '';
  const oneLinerText = typeof model.oneLinerZh === 'string' ? model.oneLinerZh : typeof model.oneLiner === 'string' ? model.oneLiner : '';
  const appText = typeof (model as any).applicationZh === 'string' ? (model as any).applicationZh : typeof model.application === 'string' ? model.application : '';
  const limitText = typeof (model as any).limitationZh === 'string' ? (model as any).limitationZh : typeof model.limitation === 'string' ? model.limitation : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">
            {index + 1}
          </div>
          <div>
            <h4 className="font-medium text-white">{nameText}</h4>
            <p className="text-sm text-gray-400">{oneLinerText}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 space-y-3"
          >
            {appText ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">应用场景</p>
                <p className="text-sm text-gray-300">{appText}</p>
              </div>
            ) : null}
            {limitText ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">局限性</p>
                <p className="text-sm text-gray-400">{limitText}</p>
              </div>
            ) : null}
            {model.crossDomain?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">跨域应用</p>
                <div className="flex flex-wrap gap-1">
                  {model.crossDomain.map(d => (
                    <span key={d} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {model.evidence?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">证据来源</p>
                <div className="space-y-1">
                  {model.evidence.slice(0, 2).map((ev, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Quote className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-400 italic line-clamp-2">{ev.quote}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Decision Heuristic Card ─────────────────────────────────────────────────

function HeuristicCard({ heuristic, index }: { heuristic: DecisionHeuristic; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const nameText = typeof heuristic.nameZh === 'string' ? heuristic.nameZh
    : typeof heuristic.name === 'string' ? heuristic.name
    : String(heuristic.name ?? '');
  const descText = typeof heuristic.descriptionZh === 'string' ? heuristic.descriptionZh
    : typeof heuristic.description === 'string' ? heuristic.description
    : '';
  const appText = typeof heuristic.applicationZh === 'string' ? heuristic.applicationZh
    : typeof heuristic.application === 'string' ? heuristic.application
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">
            {index + 1}
          </div>
          <div>
            <h4 className="font-medium text-white">{nameText}</h4>
            <p className="text-sm text-gray-400">{descText}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 space-y-3"
          >
            {appText ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">应用</p>
                <p className="text-sm text-gray-300">{appText}</p>
              </div>
            ) : null}
            {heuristic.example && (
              <div>
                <p className="text-xs text-gray-500 mb-1">示例</p>
                <p className="text-sm text-gray-400 italic">{heuristic.example}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Values & Tensions Ring ──────────────────────────────────────────────────

function TensionCard({ tension, index }: { tension: Tension; index: number }) {
  const tensionText = typeof tension.tensionZh === 'string' ? tension.tensionZh
    : typeof tension.tension === 'string' ? tension.tension
    : typeof tension === 'string' ? tension
    : (tension as any).dimension ?? '';
  const descText = typeof tension.descriptionZh === 'string' ? tension.descriptionZh
    : typeof tension.description === 'string' ? tension.description
    : '';
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-medium text-white">{tensionText}</h4>
          <p className="text-sm text-gray-400 mt-1">{descText}</p>
          {tension.positivePole && tension.negativePole && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-green-400">+ {tension.positivePole}</span>
              <span className="text-red-400">- {tension.negativePole}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cross-Persona Influence Map ─────────────────────────────────────────────

function InfluenceMap({ currentSlug, cluster }: { currentSlug: string; cluster?: string }) {
  const router = useRouter();

  if (!cluster) return null;

  const clusterMembers = PERSONA_INDEX.filter(p =>
    p.cluster === cluster && p.slug !== currentSlug
  ).slice(0, 6);

  if (clusterMembers.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Network className="w-4 h-4 text-indigo-400" />
        同圈人物
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {clusterMembers.map(p => (
          <button
            key={p.slug}
            onClick={() => router.push(`/observatory/${p.slug}`)}
            className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all text-left"
          >
            <div
              className="w-8 h-8 rounded-full shrink-0"
              style={{
                background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
              }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{p.nameZh}</p>
              <p className="text-xs text-gray-500 truncate">{p.taglineZh}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ExpressionDNA Score Meter ────────────────────────────────────────────────

function CertaintyMeter({ level }: { level: 'high' | 'medium' | 'low' | undefined }) {
  const map = { high: 90, medium: 60, low: 30 };
  const value = level ? map[level] : 50;
  const label = { high: '高度确信', medium: '适度确信', low: '审慎保留' };

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>确信度</span>
        <span>{label[level as keyof typeof label] || '未知'}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, #10b981, ${value > 70 ? '#10b981' : value > 40 ? '#f59e0b' : '#ef4444'})`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ObservatoryPersonaPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [persona, setPersona] = useState<ReturnType<typeof getPersonaBySlug>>(undefined);
  const [stats, setStats] = useState<ReturnType<typeof getPersonaStats>>(null);
  const [fullPersona, setFullPersona] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'expression' | 'cognition' | 'influence'>('overview');

  useEffect(() => {
    if (slug) {
      const personaData = getPersonaBySlug(slug);
      const statsData = getPersonaStats(slug);
      const full = PERSONAS[slug];
      setPersona(personaData || undefined);
      setStats(statsData || null);
      setFullPersona(full || null);
    }
  }, [slug]);

  if (!persona) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  const edna = fullPersona?.expressionDNA as ExpressionDNA | undefined;
  const mentalModels = fullPersona?.mentalModels as MentalModel[] | undefined;
  const heuristics = fullPersona?.decisionHeuristics as DecisionHeuristic[] | undefined;
  const tensions = fullPersona?.tensions as Tension[] | undefined;
  const values = fullPersona?.values as Array<{ name: string; nameZh: string; priority: number }> | undefined;

  // Compute radar data from ExpressionDNA
  const radarLabels = ['词汇丰富度', '句式复杂度', '确信程度', '幽默频率', '引用密度', '节奏感', '修辞力度', '语调范围'];
  const radarData = edna ? [
    Math.min(100, (edna.vocabulary?.length || 0) * 6),
    edna.sentenceStyle?.length ? Math.min(100, edna.sentenceStyle.length * 20) : 50,
    edna.certaintyLevel === 'high' ? 90 : edna.certaintyLevel === 'medium' ? 60 : 30,
    edna.humorStyle?.includes('无') || edna.humorStyle?.includes('几乎没有') ? 10 : 50,
    edna.quotePatterns?.length ? Math.min(100, edna.quotePatterns.length * 20) : 30,
    edna.rhythm ? 70 : 40,
    edna.rhetoricalHabit ? 75 : 40,
    60,
  ] : [50, 50, 50, 50, 50, 50, 50, 50];

  const tabs = [
    { id: 'overview', label: '总览', icon: Eye },
    { id: 'expression', label: '表达DNA', icon: Dna },
    { id: 'cognition', label: '认知架构', icon: Brain },
    { id: 'influence', label: '影响网络', icon: Network },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Cosmic background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${persona.accentColor}15 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${persona.gradientTo}10 0%, transparent 40%)`,
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/observatory')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回星图</span>
          </button>

          <div className="flex items-center gap-2">
            <Link
              href={`/compare?persona=${persona.slug}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <GitCompare className="w-4 h-4" />
              <span>对比</span>
            </Link>
            <Link
              href={`/conversations/new?persona=${persona.slug}`}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-sm text-indigo-300 hover:bg-indigo-500/30 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>对话</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            {/* Avatar Orb */}
            <div className="relative inline-block mb-6">
              <div
                className="w-28 h-28 rounded-full mx-auto animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${persona.accentColor}60 0%, ${persona.gradientFrom} 40%, ${persona.gradientTo} 100%)`,
                  boxShadow: `0 0 80px ${persona.accentColor}40, 0 0 160px ${persona.accentColor}20`,
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
                  opacity: 0.8,
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-[#0a0a0f] flex items-center justify-center">
                <Brain className="w-3 h-3 text-white" />
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-1" style={{ color: persona.accentColor }}>
              {persona.nameZh}
            </h1>
            <p className="text-lg text-gray-400 mb-3">{persona.name}</p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span
                className="px-4 py-1.5 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${persona.accentColor}20`,
                  color: persona.accentColor,
                  border: `1px solid ${persona.accentColor}40`,
                }}
              >
                {persona.taglineZh}
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm bg-white/5 text-gray-400 border border-white/10">
                {persona.primaryDomainLabel}
              </span>
              {persona.isHistorical && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  历史人物
                </span>
              )}
              {persona.hasDistillationData && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  已蒸馏
                </span>
              )}
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <div className="flex justify-center gap-2 mb-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >

              {/* ── Overview Tab ── */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Brain} label="思维模型" value={persona.mentalModelCount} color={persona.accentColor} />
                    <StatCard icon={Target} label="决策启发式" value={persona.heuristicCount} color="#8b5cf6" />
                    <StatCard icon={BookOpen} label="知识来源" value={persona.sourceCount} color="#10b981" />
                    <StatCard icon={Zap} label="认知张力" value={persona.tensionCount} color="#f59e0b" />
                  </div>

                  {/* Brief */}
                  <SectionCard icon={Star} title="人物简介" accentColor={persona.accentColor}>
                    <p className="text-gray-300 leading-relaxed text-sm">
                      {persona.briefPreview || fullPersona?.briefZh || fullPersona?.brief || '暂无简介'}
                    </p>
                  </SectionCard>

                  {/* ExpressionDNA Preview */}
                  {edna && (
                    <SectionCard icon={Dna} title="表达DNA指纹" accentColor="#8b5cf6">
                      <div className="flex items-center gap-8 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-xs text-gray-500 mb-2">关键词汇</p>
                          <div className="flex flex-wrap gap-1">
                            {edna.vocabulary?.slice(0, 8).map(w => (
                              <span
                                key={w}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor: `${persona.accentColor}20`,
                                  color: persona.accentColor,
                                }}
                              >
                                {w}
                              </span>
                            ))}
                            {edna.vocabulary && edna.vocabulary.length > 8 && (
                              <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-500">
                                +{edna.vocabulary.length - 8}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="min-w-[200px]">
                          <CertaintyMeter level={edna.certaintyLevel} />
                        </div>
                      </div>
                      {edna.sentenceStyle && edna.sentenceStyle.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-gray-500 mb-2">句式风格</p>
                          <div className="flex flex-wrap gap-1">
                            {edna.sentenceStyle.map(s => (
                              <span key={s} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                    <button
                      onClick={() => setActiveTab('expression')}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
                    >
                      <Dna className="w-4 h-4" />
                      <span>查看完整表达DNA</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/personas/${persona.slug}`}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white font-medium hover:opacity-90 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>开始对话</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* ── ExpressionDNA Tab ── */}
              {activeTab === 'expression' && edna && (
                <div className="space-y-6">
                  {/* Radar Chart */}
                  <SectionCard icon={Radar} title="表达DNA雷达图" accentColor={persona.accentColor}>
                    <div className="flex justify-center">
                      <RadarChart data={radarData} color={persona.accentColor} labels={radarLabels} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricPill label="词汇量" value={`${edna.vocabulary?.length || 0} 个`} color={persona.accentColor} />
                      <MetricPill label="句式" value={`${edna.sentenceStyle?.length || 0} 种`} color="#8b5cf6" />
                      <MetricPill label="确信度" value={edna.certaintyLevel === 'high' ? '高' : edna.certaintyLevel === 'medium' ? '中' : '低'} color="#10b981" />
                      <MetricPill label="引用" value={`${edna.quotePatterns?.length || 0} 个`} color="#f59e0b" />
                    </div>
                  </SectionCard>

                  {/* Vocabulary Barcode */}
                  <SectionCard icon={Layers} title="词汇指纹" accentColor={persona.accentColor}>
                    <VocabularyBarcode vocabulary={edna.vocabulary || []} color={persona.accentColor} />
                  </SectionCard>

                  {/* Forbidden Words */}
                  {edna.forbiddenWords && edna.forbiddenWords.length > 0 && (
                    <SectionCard icon={Shield} title="禁言词汇" accentColor="#ef4444">
                      <p className="text-xs text-gray-500 mb-2">该人物不会使用的词汇</p>
                      <div className="flex flex-wrap gap-1">
                        {edna.forbiddenWords.map(w => (
                          <span
                            key={w}
                            className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Rhythm & Style */}
                  <SectionCard icon={Clock} title="表达节奏" accentColor="#06b6d4">
                    {edna.rhythm && (
                      <p className="text-gray-300 text-sm leading-relaxed">{edna.rhythm}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {edna.sentenceStyle?.map(s => (
                        <span key={s} className="px-3 py-1 rounded-full text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {s}
                        </span>
                      ))}
                    </div>
                    {edna.humorStyle && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-1">幽默风格</p>
                        <p className="text-sm text-gray-300">{edna.humorStyle}</p>
                      </div>
                    )}
                  </SectionCard>

                  {/* Rhetorical Habit */}
                  {edna.rhetoricalHabit && (
                    <SectionCard icon={AlertTriangle} title="修辞习惯" accentColor="#f97316">
                      <p className="text-gray-300 text-sm leading-relaxed">{edna.rhetoricalHabit}</p>
                    </SectionCard>
                  )}

                  {/* Chinese Adaptation */}
                  {edna.chineseAdaptation && (
                    <SectionCard icon={Globe} title="中文适配" accentColor="#84cc16">
                      <p className="text-gray-300 text-sm leading-relaxed">{edna.chineseAdaptation}</p>
                    </SectionCard>
                  )}

                  {/* Verbal Markers */}
                  {edna.verbalMarkers && edna.verbalMarkers.length > 0 && (
                    <SectionCard icon={Quote} title="语言标记" accentColor="#ec4899">
                      <div className="flex flex-wrap gap-2">
                        {edna.verbalMarkers.map(m => (
                          <span
                            key={m}
                            className="px-3 py-1.5 rounded-full text-xs"
                            style={{ backgroundColor: `${persona.accentColor}15`, color: persona.accentColor }}
                          >
                            &ldquo;{m}&rdquo;
                          </span>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ── Cognition Tab ── */}
              {activeTab === 'cognition' && (
                <div className="space-y-6">
                  {/* Mental Models */}
                  <SectionCard icon={Brain} title="思维模型" accentColor={persona.accentColor}>
                    {mentalModels && mentalModels.length > 0 ? (
                      <div className="space-y-3">
                        {mentalModels.map((model, i) => (
                          <MentalModelCard key={model.id || i} model={model} index={i} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">暂无思维模型数据</p>
                    )}
                  </SectionCard>

                  {/* Decision Heuristics */}
                  <SectionCard icon={Target} title="决策启发式" accentColor="#f59e0b">
                    {heuristics && heuristics.length > 0 ? (
                      <div className="space-y-3">
                        {heuristics.map((h, i) => (
                          <HeuristicCard key={h.id || i} heuristic={h} index={i} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">暂无决策启发式数据</p>
                    )}
                  </SectionCard>

                  {/* Tensions */}
                  {tensions && tensions.length > 0 && (
                    <SectionCard icon={AlertTriangle} title="认知张力" accentColor="#ef4444">
                      <p className="text-xs text-gray-500 mb-3">这些内部矛盾塑造了人物的独特思维方式</p>
                      <div className="space-y-3">
                        {tensions.map((t, i) => (
                          <TensionCard key={t.dimension + i} tension={t} index={i} />
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Values */}
                  {values && values.length > 0 && (
                    <SectionCard icon={CheckCircle2} title="核心价值观" accentColor="#10b981">
                      <div className="space-y-2">
                        {([...values].filter(v => v && typeof v === 'object').sort((a, b) => {
                          const pa = typeof a.priority === 'number' ? a.priority : 99;
                          const pb = typeof b.priority === 'number' ? b.priority : 99;
                          return pa - pb;
                        })).map((v, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="text-xs text-gray-500 w-6">{i + 1}</div>
                            <div className="flex-1">
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(20, 100 - (typeof v.priority === 'number' ? v.priority : 99) * 15)}%` }}
                                  transition={{ delay: i * 0.1, duration: 0.5 }}
                                  className="h-full rounded-full bg-green-500/60"
                                />
                              </div>
                            </div>
                            <div className="text-sm text-gray-300 w-32 text-right">{typeof v.nameZh === 'string' ? v.nameZh : typeof v.name === 'string' ? v.name : String(v.name ?? '')}</div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ── Influence Tab ── */}
              {activeTab === 'influence' && (
                <div className="space-y-6">
                  <InfluenceMap currentSlug={slug} cluster={persona.cluster} />

                  {/* Key Quotes */}
                  {fullPersona?.keyQuotes && fullPersona.keyQuotes.length > 0 && (
                    <SectionCard icon={Quote} title="标志性语录" accentColor={persona.accentColor}>
                      <div className="space-y-4">
                        {fullPersona.keyQuotes.slice(0, 5).map((q: { quote: string; source: string }, i: number) => (
                          <div key={i} className="border-l-2 pl-4" style={{ borderColor: `${persona.accentColor}60` }}>
                            <p className="text-gray-300 italic text-sm">&ldquo;{q.quote}&rdquo;</p>
                            <p className="text-xs text-gray-500 mt-1">— {q.source}</p>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Reasoning Style */}
                  {fullPersona?.reasoningStyle && (
                    <SectionCard icon={Layers} title="推理风格" accentColor="#8b5cf6">
                      <p className="text-gray-300 text-sm leading-relaxed">{fullPersona.reasoningStyle}</p>
                    </SectionCard>
                  )}

                  {/* Life Philosophy */}
                  {fullPersona?.lifePhilosophy && (
                    <SectionCard icon={Star} title="人生哲学" accentColor="#f59e0b">
                      {typeof fullPersona.lifePhilosophy === 'string' ? (
                        <p className="text-gray-300 text-sm">{fullPersona.lifePhilosophy}</p>
                      ) : (
                        <div className="space-y-3">
                          {fullPersona.lifePhilosophy.core && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">核心</p>
                              <p className="text-gray-300 text-sm">{fullPersona.lifePhilosophy.core}</p>
                            </div>
                          )}
                          {fullPersona.lifePhilosophy.threeLevels && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">三层境界</p>
                              {(Object.entries(fullPersona.lifePhilosophy.threeLevels as Record<string, string>)).map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2 mb-1">
                                  <span className="text-xs text-indigo-400 capitalize w-16">{k}</span>
                                  <span className="text-sm text-gray-300">{v}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </SectionCard>
                  )}

                  {/* Sources */}
                  {fullPersona?.sources && fullPersona.sources.length > 0 && (
                    <SectionCard icon={BookOpen} title="知识来源" accentColor="#10b981">
                      <div className="space-y-2">
                        {fullPersona.sources.slice(0, 8).map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span
                              className="px-2 py-0.5 rounded text-xs shrink-0 mt-0.5"
                              style={{
                                backgroundColor: `${persona.accentColor}15`,
                                color: persona.accentColor,
                              }}
                            >
                              {s.type || 'source'}
                            </span>
                            <span className="text-gray-400">{s.title || s.source || '未知来源'}</span>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Brain;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, accentColor, children }: {
  icon: typeof Eye;
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-6"
    >
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
        <span style={{ color: accentColor }}>{title}</span>
      </h2>
      {children}
    </motion.div>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
