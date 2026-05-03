'use client';

/**
 * Prismatic — Library Persona Detail
 * /library/[slug] — 智慧导师详情页
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Lock, Unlock, Crown, Sparkles, BookOpen,
  Users, Star, Loader2, ChevronDown, ChevronRight,
  MessageCircle, Zap, Shield, Globe, TrendingUp, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_CONFIG = {
  FREE: { label: '免费体验', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.25)', icon: '🌿', price: '¥0' },
  MONTHLY: { label: '月度订阅', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)', icon: '📜', price: '¥39/月' },
  LIFETIME: { label: '终身珍藏', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', icon: '🏛️', price: '¥299' },
};

type TierKey = 'FREE' | 'MONTHLY' | 'LIFETIME';

interface PersonaDetail {
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: string;
  domainLabel: { zh: string; en: string };
  tagline: string;
  taglineZh: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  avatar: string;
  brief: string;
  briefZh: string;
  mentalModels: unknown[] | null;
  decisionHeuristics: unknown[] | null;
  expressionDNA: unknown | null;
  values: unknown[] | null;
  antiPatterns: unknown[] | null;
  tensions: unknown[] | null;
  honestBoundaries: unknown[] | null;
  strengths: string[] | null;
  blindspots: string[] | null;
  systemPromptTemplate: string | null;
  identityPrompt: string | null;
  finalScore: number;
  qualityGrade: string;
  thresholdPassed: boolean;
  scoreBreakdown: Record<string, number>;
  distillVersion: string;
  distillDate: string;
  corpusItemCount: number;
  corpusTotalWords: number;
  tier: TierKey;
  tierConfig: (typeof TIER_CONFIG)[TierKey];
  canAccess: boolean;
  isPublished: boolean;
  icon: string | null;
  createdAt: string;
}

export default function LibraryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';

  const [persona, setPersona] = useState<PersonaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['values', 'strengths']));

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/library/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setPersona(data); }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
      </div>
    );
  }

  if (error || !persona) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center gap-4">
        <div className="text-4xl">😕</div>
        <p className="text-white/50 text-sm">{error || '人物不存在'}</p>
        <Link href="/library" className="text-amber-400/70 hover:text-amber-400 text-sm">
          ← 返回导师库
        </Link>
      </div>
    );
  }

  const tier = TIER_CONFIG[persona.tier];
  const gradeColors: Record<string, string> = {
    S: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
    A: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
    B: 'bg-blue-400/10 text-blue-400 border-blue-400/30',
    C: 'bg-slate-400/10 text-slate-400 border-slate-400/30',
    D: 'bg-orange-400/10 text-orange-400 border-orange-400/30',
    F: 'bg-red-400/10 text-red-400 border-red-400/30',
  };
  const scoreColor = persona.finalScore >= 85 ? 'text-emerald-400' :
    persona.finalScore >= 70 ? 'text-blue-400' : 'text-slate-400';

  return (
    <div className="min-h-screen bg-[#080810]">
      {/* Header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${persona.gradientFrom}18 0%, transparent 100%)`,
        }}
      >
        {/* Back */}
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回导师库
          </Link>
        </div>

        {/* Hero */}
        <div className="max-w-5xl mx-auto px-6 pb-10 pt-4">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="shrink-0"
            >
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${persona.gradientFrom}ee, ${persona.gradientTo}aa)`,
                  boxShadow: `0 0 40px ${persona.gradientFrom}33`,
                }}
              >
                {persona.avatar ? (
                  <img src={persona.avatar} alt={persona.nameZh} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <span className="text-white">{persona.nameZh[0]}</span>
                )}
              </div>
            </motion.div>

            <div className="flex-1">
              {/* Name + Tier */}
              <div className="flex items-center gap-3 mb-2">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold text-white"
                >
                  {persona.nameZh}
                </motion.h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                  style={{ background: tier.bgColor, color: tier.color, borderColor: tier.borderColor }}
                >
                  {tier.icon} {tier.label}
                </span>
              </div>

              <p className="text-white/40 text-sm mb-3">{persona.nameEn}</p>

              {/* Score + Grade */}
              <div className="flex items-center gap-3 mb-4">
                {persona.qualityGrade && (
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-md border',
                    gradeColors[persona.qualityGrade] || gradeColors.C
                  )}>
                    Grade {persona.qualityGrade}
                  </span>
                )}
                <span className={cn('text-lg font-bold font-mono', scoreColor)}>
                  {persona.finalScore.toFixed(0)}
                </span>
                <span className="text-xs text-white/30">综合得分</span>
                {persona.domainLabel && (
                  <span className="text-xs text-white/40 border border-white/10 rounded-md px-2 py-0.5">
                    {persona.domainLabel.zh}
                  </span>
                )}
              </div>

              {/* Tagline */}
              <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-2xl">
                {persona.taglineZh || persona.tagline || persona.briefZh || persona.brief}
              </p>

              {/* CTA */}
              <div className="flex items-center gap-3">
                {persona.canAccess ? (
                  <Link
                    href={`/app?persona=${persona.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90"
                    style={{ background: persona.gradientFrom || persona.accentColor }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    开始对话
                  </Link>
                ) : (
                  <button
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90"
                    style={{ background: tier.color }}
                  >
                    <Lock className="w-4 h-4" />
                    解锁 {tier.label}
                  </button>
                )}
                <Link
                  href="/subscribe"
                  className="text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  查看订阅方案
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Locked Banner */}
      {!persona.canAccess && (
        <div className="max-w-5xl mx-auto px-6 mt-6">
          <div
            className="rounded-xl p-4 border flex items-center justify-between"
            style={{ background: tier.bgColor, borderColor: tier.borderColor }}
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5" style={{ color: tier.color }} />
              <div>
                <p className="text-sm font-medium" style={{ color: tier.color }}>
                  {tier.label} 内容
                </p>
                <p className="text-xs text-white/50">
                  订阅解锁完整思维模型、决策启发和古籍原文对话能力
                </p>
              </div>
            </div>
            <Link
              href="/subscribe"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-black transition-all hover:opacity-90 shrink-0"
              style={{ background: tier.color }}
            >
              立即订阅
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* About */}
            <Section title="人物简介" icon={<BookOpen className="w-4 h-4" />} defaultOpen>
              <p className="text-sm text-white/70 leading-relaxed">
                {persona.briefZh || persona.brief || '暂无简介'}
              </p>
            </Section>

            {/* Values */}
            {persona.canAccess && persona.values && Array.isArray(persona.values) && persona.values.length > 0 && (
              <Section
                title="核心价值观"
                icon={<TrendingUp className="w-4 h-4" />}
                open={expandedSections.has('values')}
                onToggle={() => toggleSection('values')}
              >
                <div className="space-y-2">
                  {persona.values.map((v: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-white/80 font-medium">{(v as any).nameZh || (v as any).name || v}</span>
                        {(v as any).description && (
                          <p className="text-white/40 text-xs mt-0.5">{(v as any).description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Strengths */}
            {persona.canAccess && persona.strengths && persona.strengths.length > 0 && (
              <Section
                title="思维优势"
                icon={<Zap className="w-4 h-4" />}
                open={expandedSections.has('strengths')}
                onToggle={() => toggleSection('strengths')}
              >
                <div className="flex flex-wrap gap-2">
                  {persona.strengths.map((s: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-lg text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Blindspots */}
            {persona.canAccess && persona.blindspots && persona.blindspots.length > 0 && (
              <Section
                title="思维盲点"
                icon={<Shield className="w-4 h-4" />}
                open={expandedSections.has('blindspots')}
                onToggle={() => toggleSection('blindspots')}
              >
                <div className="flex flex-wrap gap-2">
                  {persona.blindspots.map((s: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-lg text-xs bg-orange-400/10 text-orange-400 border border-orange-400/20">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Mental Models */}
            {persona.canAccess && persona.mentalModels && Array.isArray(persona.mentalModels) && persona.mentalModels.length > 0 && (
              <Section
                title="思维模型"
                icon={<Sparkles className="w-4 h-4" />}
                open={expandedSections.has('mentalModels')}
                onToggle={() => toggleSection('mentalModels')}
              >
                <div className="space-y-3">
                  {persona.mentalModels.map((m: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/8 p-3 bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white/60">{i + 1}.</span>
                        <span className="text-sm font-medium text-white/80">{m.nameZh || m.name}</span>
                        {m.name && m.nameZh && (
                          <span className="text-xs text-white/30">({m.name})</span>
                        )}
                      </div>
                      {m.oneLiner && <p className="text-xs text-white/50 pl-5">{m.oneLiner}</p>}
                      {m.application && <p className="text-xs text-white/40 pl-5 mt-1">{m.application}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quality Score */}
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">蒸馏质量</h3>
              <div className="flex items-center gap-3 mb-4">
                <span className={cn('text-4xl font-bold font-mono', scoreColor)}>
                  {persona.finalScore.toFixed(0)}
                </span>
                <div className="text-xs text-white/40">
                  <div>/ 100</div>
                  <div>综合得分</div>
                </div>
              </div>
              {persona.scoreBreakdown && Object.keys(persona.scoreBreakdown).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(persona.scoreBreakdown).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-24 truncate">{key}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(value as number) * 10}%`,
                            background: persona.gradientFrom || persona.accentColor,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/50 font-mono w-6 text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-white/30">蒸馏版本</span>
                <span className="text-xs text-white/40 font-mono">v{persona.distillVersion}</span>
              </div>
            </div>

            {/* Corpus Stats */}
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">语料统计</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <div className="text-xl font-bold text-white/80">{persona.corpusItemCount || 0}</div>
                  <div className="text-[10px] text-white/40">文档数</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <div className="text-xl font-bold text-white/80">
                    {persona.corpusTotalWords > 0
                      ? `${(persona.corpusTotalWords / 10000).toFixed(0)}w`
                      : '0'}
                  </div>
                  <div className="text-[10px] text-white/40">字数</div>
                </div>
              </div>
            </div>

            {/* Subscription CTA */}
            {!persona.canAccess && (
              <div
                className="rounded-xl p-5 border"
                style={{ background: tier.bgColor, borderColor: tier.borderColor }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{tier.icon}</span>
                  <span className="font-semibold text-white">{tier.label}</span>
                </div>
                <p className="text-xs text-white/50 mb-4">
                  解锁完整思维模型，深入古籍原文对话
                </p>
                <Link
                  href="/subscribe"
                  className="block w-full py-2.5 rounded-xl text-center text-sm font-semibold text-black hover:opacity-90 transition-all"
                  style={{ background: tier.color }}
                >
                  {TIER_CONFIG[persona.tier].price} · 立即订阅
                </Link>
              </div>
            )}

            {/* Back link */}
            <Link
              href="/library"
              className="block text-center text-xs text-white/30 hover:text-white/60 transition-colors py-2"
            >
              ← 返回导师库
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  open,
  onToggle,
  defaultOpen,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const isOpen = open ?? defaultOpen ?? false;
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/70 hover:text-white/90 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white/40">{icon}</span>
          {title}
        </div>
        {onToggle && (
          isOpen ? <ChevronDown className="w-4 h-4 text-white/30" />
            : <ChevronRight className="w-4 h-4 text-white/30" />
        )}
      </button>
      {(isOpen || defaultOpen) && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
