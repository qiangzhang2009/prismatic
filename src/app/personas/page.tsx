'use client';

/**
 * Prismatic — Personas Library Page
 * Added: sorting by confidence score + influence, confidence mini-card overlay
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, ArrowUpDown, Shield, Star, TrendingUp, Users } from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { PERSONA_CONFIDENCE, getConfidenceLevel } from '@/lib/confidence';
import { PersonaCard } from '@/components/persona-card';
import { cn } from '@/lib/utils';
import type { Domain } from '@/lib/types';
import { MODES, DOMAINS } from '@/lib/constants';

type SortKey = 'default' | 'confidence' | 'influence' | 'name' | 'domain';

export default function PersonasPage() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const domains = Array.from(new Set(PERSONA_LIST.flatMap((p) => p.domain))) as Domain[];

  const filtered = PERSONA_LIST.filter((p) => {
    const matchesDomain = selectedDomain === 'all' || p.domain.includes(selectedDomain);
    const matchesSearch =
      !searchQuery ||
      p.nameZh.includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.taglineZh.includes(searchQuery) ||
      p.briefZh.includes(searchQuery);
    return matchesDomain && matchesSearch;
  });

  // Influence: use confidence overall score as proxy (higher confidence = more researched = more influential figure)
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'confidence') {
      const scoreA = PERSONA_CONFIDENCE[a.id]?.overall ?? 0;
      const scoreB = PERSONA_CONFIDENCE[b.id]?.overall ?? 0;
      return scoreB - scoreA; // 从高到低
    }
    if (sortKey === 'influence') {
      // Influence = weighted: confidence (40%) + number of mental models (30%) + domain breadth (30%)
      const confA = PERSONA_CONFIDENCE[a.id]?.overall ?? 50;
      const confB = PERSONA_CONFIDENCE[b.id]?.overall ?? 50;
      const modelsA = a.mentalModels.length;
      const modelsB = b.mentalModels.length;
      const domainsA = a.domain.length;
      const domainsB = b.domain.length;
      const infA = confA * 0.4 + modelsA * 3 + domainsA * 10;
      const infB = confB * 0.4 + modelsB * 3 + domainsB * 10;
      return infB - infA;
    }
    if (sortKey === 'name') return a.nameZh.localeCompare(b.nameZh, 'zh-CN');
    if (sortKey === 'domain') return (a.domain[0] ?? '').localeCompare(b.domain[0] ?? '', 'zh-CN');
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
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <h1 className="font-display font-semibold">人物档案馆</h1>
          <span className="text-text-muted text-sm ml-auto">{sorted.length}位人物</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-8">
          {/* Search */}
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

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border-medium transition-all text-sm"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-surface transition-colors',
                        sortKey === opt.key && 'bg-prism-blue/5'
                      )}
                    >
                      <div className={cn('mt-0.5 flex-shrink-0', sortKey === opt.key ? 'text-prism-blue' : 'text-text-muted')}>
                        {opt.icon}
                      </div>
                      <div>
                        <p className={cn('text-sm font-medium', sortKey === opt.key ? 'text-prism-blue' : 'text-text-primary')}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-text-muted">{opt.desc}</p>
                      </div>
                      {sortKey === opt.key && (
                        <CheckIcon className="w-4 h-4 text-prism-blue ml-auto flex-shrink-0 mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Domain filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                selectedDomain === 'all'
                  ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                  : 'text-text-secondary hover:text-text-primary border border-border-subtle'
              )}
              onClick={() => setSelectedDomain('all')}
            >
              全部
            </button>
            {domains.map((d) => (
              <button
                key={d}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  selectedDomain === d
                    ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                    : 'text-text-secondary hover:text-text-primary border border-border-subtle'
                )}
                onClick={() => setSelectedDomain(d)}
              >
                {DOMAINS[d as keyof typeof DOMAINS]?.label ?? d}
              </button>
            ))}
          </div>
        </div>

        {/* Sort indicator */}
        {sortKey !== 'default' && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle w-fit">
            <ArrowUpDown className="w-3.5 h-3.5 text-prism-blue" />
            <span className="text-xs text-text-secondary">
              当前排序：<strong className="text-text-primary">{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</strong>
              {sortKey === 'influence' && '（置信度×40% + 心智模型数×30% + 领域广度×30%）'}
            </span>
            <button
              onClick={() => setSortKey('default')}
              className="text-xs text-text-muted hover:text-text-secondary ml-2"
            >
              重置
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sorted.map((persona, i) => {
            const confidence = PERSONA_CONFIDENCE[persona.id];
            const level = confidence ? getConfidenceLevel(confidence.overall) : null;

            return (
              <div key={persona.id} className="relative">
                {/* Confidence overlay badge */}
                {confidence && (
                  <div
                    className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm"
                    style={{
                      color: level!.color,
                      backgroundColor: `${level!.color}18`,
                      borderColor: `${level!.color}40`,
                    }}
                    title={`置信度 ${confidence.overall} — ${level!.label}`}
                  >
                    <Shield className="w-3 h-3" />
                    {confidence.overall}
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                >
                  <PersonaCard persona={persona} />
                </motion.div>

                {/* Influence score bar (subtle, at bottom) */}
                {sortKey === 'influence' && (() => {
                  const conf = confidence?.overall ?? 50;
                  const models = persona.mentalModels.length;
                  const domains = persona.domain.length;
                  const inf = Math.round(conf * 0.4 + models * 3 + domains * 10);
                  const maxInf = 100;
                  return (
                    <div className="mt-1 px-1">
                      <div className="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
                        <span>影响力指数</span>
                        <span>{inf}</span>
                      </div>
                      <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(inf / maxInf) * 100}%`, backgroundColor: '#8b5cf6' }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-20">
            <p className="text-text-muted">没有找到匹配的人物</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
