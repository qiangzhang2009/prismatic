'use client';

/**
 * Prismatic — Personas Library Page
 * Fetches from /api/persona-library (DB distilled personas)
 * Falls back to hardcoded PERSONA_LIST for code personas.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, ArrowUpDown, Shield, TrendingUp, Users, Loader2 } from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { PERSONA_CONFIDENCE, getConfidenceLevel } from '@/lib/confidence';
import { PersonaCard } from '@/components/persona-card';
import { cn, unquote, decodeUnicodeEscapes, getDomainGradient } from '@/lib/utils';
import type { Domain } from '@/lib/types';
import { DOMAINS } from '@/lib/constants';

type SortKey = 'default' | 'confidence' | 'influence' | 'name' | 'domain';

interface DistilledPersona {
  slug: string;
  name: string;
  namezh?: string;
  nameZh?: string;
  nameen?: string;
  domain: string;
  tagline?: string;
  taglineZh?: string;
  brief?: string;
  briefZh?: string;
  finalScore?: number | string;
  qualityGrade?: string;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  avatar?: string;
  mentalModels?: unknown[];
}

// Compute display score for a persona (DB score takes priority over confidence.ts)
function personaScore(slug: string, dbScore?: number | string): number {
  // DB score takes absolute priority
  if (dbScore !== undefined) {
    return typeof dbScore === 'string' ? parseFloat(dbScore) : dbScore;
  }
  return PERSONA_CONFIDENCE[slug]?.overall ?? 0;
}

// Build a lookup map from code PERSONA_LIST for fallback data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CODE_PERSONA_MAP = new Map<string, any>(
  PERSONA_LIST.map(p => [p.slug, p])
);

  // Cast DB persona to Persona — DB personas have the display fields needed by PersonaCard
  // When DB mentalModels is empty but code has data, use code data instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function dbToPersona(db: DistilledPersona): any {
    const score = personaScore(db.slug, db.finalScore);
    const domainStr = db.domain ?? 'philosophy';
    const domains = domainStr.includes(',') ? domainStr.split(',') as Domain[] : [domainStr as Domain];
    const color = getDomainGradient(domains);

    // Prefer DB mentalModels (v5 has complete Chinese fields: oneLinerZh, applicationZh, etc.)
    // Fall back to code only if DB mentalModels is empty
    const codePersona = CODE_PERSONA_MAP.get(db.slug);
    const rawMentalModels = (db.mentalModels && (db.mentalModels as unknown[]).length > 0)
      ? db.mentalModels
      : (codePersona?.mentalModels ?? []);

    const mentalModels = rawMentalModels;

    // Use codePersona data as fallback for display fields when DB has placeholder/default values
    const dbTagline = unquote(db.tagline) ?? '';
    const dbTaglineZh = decodeUnicodeEscapes(unquote(db.taglineZh)) ?? '';
    const dbBrief = unquote(db.brief) ?? '';
    const dbBriefZh = decodeUnicodeEscapes(unquote(db.briefZh)) ?? '';
    const dbAccent = (unquote(db.accentColor) as string) || '#6366f1';
    const dbGradientFrom = (unquote(db.gradientFrom) as string) || '#6366f1';
    const dbGradientTo = (unquote(db.gradientTo) as string) || '#8b5cf6';

    // Code persona display fields take priority when DB has placeholder values
    // Only flag very short (1-2 char) standalone Chinese words as placeholders
    const isPlaceholder = (v: string) =>
      !v || (v.length <= 2 && /^[\u4e00-\u9fa5]+$/.test(v));

    const tagline = !isPlaceholder(dbTagline) ? dbTagline : ( codePersona?.tagline ?? dbTagline);
    const taglineZh = !isPlaceholder(dbTaglineZh) ? dbTaglineZh : ( codePersona?.taglineZh ?? dbTaglineZh);
    const brief = !isPlaceholder(dbBrief) ? dbBrief : ( codePersona?.brief ?? dbBrief);
    const briefZh = !isPlaceholder(dbBriefZh) ? dbBriefZh : ( codePersona?.briefZh ?? dbBriefZh);
    const accentColor = !isPlaceholder(dbAccent) ? dbAccent : ( codePersona?.accentColor ?? dbAccent);
    const gradientFrom = !isPlaceholder(dbGradientFrom) ? dbGradientFrom : ( codePersona?.gradientFrom ?? dbGradientFrom);
    const gradientTo = !isPlaceholder(dbGradientTo) ? dbGradientTo : ( codePersona?.gradientTo ?? dbGradientTo);

    return {
      id: db.slug,
      slug: db.slug,
      name: unquote(db.name) || db.slug,
            nameZh: decodeUnicodeEscapes(unquote(db.namezh)) || decodeUnicodeEscapes(unquote(db.nameZh)) || unquote(db.name) || db.slug,
      nameEn: unquote(db.nameen) || unquote(db.name) || db.slug,
      domain: domains,
      tagline,
      taglineZh,
      brief,
      briefZh,
      accentColor,
      gradientFrom,
      gradientTo,
      avatar: unquote(db.avatar) ?? '',
      mentalModels,
      _score: score,
    };
  }

export default function PersonasPage() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  // Merged list: initialized empty; DB fetch populates it in useEffect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mergedPersonas, setMergedPersonas] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/persona-library?sortBy=score&limit=100')
      .then(r => r.json())
      .then(data => {
        if (data.items && data.items.length > 0) {
          const dbSlugSet = new Set(data.items.map((p: DistilledPersona) => p.slug));
          const merged = [
            ...data.items.map(dbToPersona),
            ...PERSONA_LIST.filter(p => !dbSlugSet.has(p.slug)).map(p => ({
              ...p,
              _score: PERSONA_CONFIDENCE[p.id]?.overall ?? 0,
            })),
          ];
          setMergedPersonas(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Derive domains from merged data
  const domains = Array.from(new Set(mergedPersonas.flatMap(p => p.domain ?? []))) as Domain[];

  // Build filtered + sorted list in one pass
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayList = [...mergedPersonas]
    .filter((p: any) => {
      const domains = p.domain ?? [];
      const matchesDomain = selectedDomain === 'all' || (domains as string[]).includes(selectedDomain);
      const matchesSearch =
        !searchQuery ||
        (p.nameZh ?? '').includes(searchQuery) ||
        (p.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.taglineZh ?? '').includes(searchQuery) ||
        (p.briefZh ?? '').includes(searchQuery);
      return matchesDomain && matchesSearch;
    })
    .sort((a: any, b: any) => {
      if (sortKey === 'confidence') return b._score - a._score;
      if (sortKey === 'influence') {
        const aModels = Array.isArray(a.mentalModels) ? a.mentalModels.length : 0;
        const bModels = Array.isArray(b.mentalModels) ? b.mentalModels.length : 0;
        const aDoms = Array.isArray(a.domain) ? a.domain.length : 1;
        const bDoms = Array.isArray(b.domain) ? b.domain.length : 1;
        return (b._score * 0.4 + bModels * 3 + bDoms * 10)
             - (a._score * 0.4 + aModels * 3 + aDoms * 10);
      }
      if (sortKey === 'name') return (a.nameZh ?? '').localeCompare(b.nameZh ?? '', 'zh-CN');
      if (sortKey === 'domain') return ((a.domain?.[0]) ?? '').localeCompare((b.domain?.[0]) ?? '', 'zh-CN');
      return 0;
    });

  const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'default', label: '默认排序', icon: <ArrowUpDown className="w-3.5 h-3.5" />, desc: '按添加顺序' },
    { key: 'influence', label: '按影响力', icon: <TrendingUp className="w-3.5 h-3.5" />, desc: '综合置信度+心智模型数量+领域广度' },
    { key: 'confidence', label: '按置信度', icon: <Shield className="w-3.5 h-3.5" />, desc: '按置信度评分从高到低' },
    { key: 'name', label: '按姓名', icon: <Users className="w-3.5 h-3.5" />, desc: '中文姓名首字母排序' },
    { key: 'domain', label: '按领域', icon: <Filter className="w-3.5 h-3.5" />, desc: '按主要领域分组' },
  ];

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <h1 className="font-display font-semibold">人物档案馆</h1>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-muted ml-auto" />
          ) : (
            <span className="text-text-muted text-sm ml-auto">{displayList.length}位人物</span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索人物姓名、标签或简介..."
              className="input-prismatic pl-10"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border-medium transition-all text-sm"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>{SORT_OPTIONS.find(o => o.key === sortKey)?.label}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={cn('w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-surface transition-colors', sortKey === opt.key && 'bg-prism-blue/5')}
                    >
                      <div className={cn('mt-0.5 flex-shrink-0', sortKey === opt.key ? 'text-prism-blue' : 'text-text-muted')}>
                        {opt.icon}
                      </div>
                      <div>
                        <p className={cn('text-sm font-medium', sortKey === opt.key ? 'text-prism-blue' : 'text-text-primary')}>{opt.label}</p>
                        <p className="text-xs text-text-muted">{opt.desc}</p>
                      </div>
                      {sortKey === opt.key && (
                        <svg className="w-4 h-4 text-prism-blue ml-auto flex-shrink-0 mt-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              className={cn('px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors', selectedDomain === 'all' ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30' : 'text-text-secondary hover:text-text-primary border border-border-subtle')}
              onClick={() => setSelectedDomain('all')}
            >全部</button>
            {domains.map(d => (
              <button
                key={d}
                className={cn('px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors', selectedDomain === d ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30' : 'text-text-secondary hover:text-text-primary border border-border-subtle')}
                onClick={() => setSelectedDomain(d)}
              >{DOMAINS[d as keyof typeof DOMAINS]?.label ?? d}</button>
            ))}
          </div>
        </div>

        {sortKey !== 'default' && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle w-fit">
            <ArrowUpDown className="w-3.5 h-3.5 text-prism-blue" />
            <span className="text-xs text-text-secondary">
              当前排序：<strong className="text-text-primary">{SORT_OPTIONS.find(o => o.key === sortKey)?.label}</strong>
            </span>
            <button onClick={() => setSortKey('default')} className="text-xs text-text-muted hover:text-text-secondary ml-2">重置</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mergedPersonas.length === 0 && loading ? (
            <>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-bg-elevated rounded-2xl border border-border-subtle overflow-hidden">
                  <div className="h-36 bg-gradient-to-br from-bg-surface to-bg-base animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-bg-surface rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-bg-surface rounded animate-pulse w-1/2" />
                    <div className="flex gap-1 mt-3">
                      <div className="h-5 bg-bg-surface rounded-full animate-pulse w-16" />
                      <div className="h-5 bg-bg-surface rounded-full animate-pulse w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            displayList.map((persona, i) => {
            const level = persona._score > 0 ? getConfidenceLevel(persona._score) : null;
            const mmCount = Array.isArray(persona.mentalModels) ? persona.mentalModels.length : 0;
            const domCount = Array.isArray(persona.domain) ? persona.domain.length : 1;
            const influence = Math.round(persona._score * 0.4 + mmCount * 3 + domCount * 10);
            return (
              <div key={persona.id} className="relative">
                {level && (
                  <div
                    className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm"
                    style={{ color: level.color, backgroundColor: `${level.color}18`, borderColor: `${level.color}40` }}
                    title={`置信度 ${persona._score} — ${level.label}`}
                  >
                    <Shield className="w-3 h-3" />
                    {persona._score}
                  </div>
                )}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.03 }}>
                  <PersonaCard persona={persona} distillScore={persona._score} />
                </motion.div>
                {sortKey === 'influence' && (
                  <div className="mt-1 px-1">
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
                      <span>影响力指数</span>
                      <span>{influence}</span>
                    </div>
                    <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, influence)}%`, backgroundColor: '#8b5cf6' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })
          )}
        </div>

        {displayList.length === 0 && !loading && (
          <div className="text-center py-20">
            <p className="text-text-muted">没有找到匹配的人物</p>
          </div>
        )}
      </div>
    </div>
  );
}
