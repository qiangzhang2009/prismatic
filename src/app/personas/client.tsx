'use client';

/**
 * Prismatic — Personas Library Page (Client)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, ArrowUpDown, Shield, Star,
  TrendingUp, Users, FlaskConical, BookOpen,
} from 'lucide-react';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import { PersonaCard } from '@/components/persona-card';
import { cn } from '@/lib/utils';
import type { Domain, Persona } from '@/lib/types';

type SortKey = 'default' | 'confidence' | 'influence' | 'name' | 'domain';

interface DbPersonaRow {
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: string;
  tagline: string;
  taglineZh: string;
  avatar: string | null;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  brief: string;
  briefZh: string;
  finalScore: number;
  qualityGrade: string;
  thresholdPassed: boolean;
  qualityGateSkipped: boolean;
  distillVersion: string;
  distillDate: Date | string;
  isPublished: boolean;
}

interface Props {
  dbPersonas: DbPersonaRow[];
  codePersonas: Persona[];
}

interface UnifiedPersona {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: Domain[];
  tagline: string;
  taglineZh: string;
  avatar: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  brief: string;
  briefZh: string;
  version: string;
  mentalModels: Persona['mentalModels'];
  isDistilled: boolean;
  finalScore?: number;
  qualityGrade?: string;
  thresholdPassed?: boolean;
  qualityGateSkipped?: boolean;
}

function toUnified(p: Persona): UnifiedPersona {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    domain: p.domain as Domain[],
    tagline: p.tagline,
    taglineZh: p.taglineZh,
    avatar: p.avatar,
    accentColor: p.accentColor,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    brief: p.brief,
    briefZh: p.briefZh,
    version: p.version || '1.0',
    mentalModels: p.mentalModels,
    isDistilled: false,
  };
}

function toUnifiedDb(p: DbPersonaRow): UnifiedPersona {
  return {
    id: p.slug,
    slug: p.slug,
    name: p.name,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    domain: [p.domain as Domain],
    tagline: p.tagline,
    taglineZh: p.taglineZh,
    avatar: p.avatar || '',
    accentColor: p.accentColor,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    brief: p.brief,
    briefZh: p.briefZh,
    version: p.distillVersion || '0.1.0',
    mentalModels: [],
    isDistilled: true,
    finalScore: p.finalScore,
    qualityGrade: p.qualityGrade,
    thresholdPassed: p.thresholdPassed,
    qualityGateSkipped: p.qualityGateSkipped,
  };
}

interface UnifiedPersona {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: Domain[];
  tagline: string;
  taglineZh: string;
  avatar: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  brief: string;
  briefZh: string;
  version: string;
  isDistilled: boolean;
  finalScore?: number;
  qualityGrade?: string;
  thresholdPassed?: boolean;
  qualityGateSkipped?: boolean;
}

export default function PersonasClient({ dbPersonas, codePersonas }: Props) {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showDistilledOnly, setShowDistilledOnly] = useState(false);

  // Merge and deduplicate: DB personas take priority over code personas with same slug
  const codeMap = new Map(codePersonas.map(p => [p.slug, p]));
  const unified: UnifiedPersona[] = [
    ...dbPersonas.map(toUnifiedDb),
    ...codePersonas
      .filter(p => !dbPersonas.some(d => d.slug === p.slug))
      .map(toUnified),
  ];

  const domains = Array.from(new Set(unified.flatMap(p => p.domain))) as Domain[];

  const filtered = unified.filter((p) => {
    const matchesDomain = selectedDomain === 'all' || p.domain.includes(selectedDomain);
    const matchesSearch =
      !searchQuery ||
      p.nameZh.includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.taglineZh.includes(searchQuery) ||
      p.briefZh.includes(searchQuery);
    const matchesDistilled = !showDistilledOnly || p.isDistilled;
    return matchesDomain && matchesSearch && matchesDistilled;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'confidence') {
      const scoreA = a.finalScore ?? PERSONA_CONFIDENCE[a.id]?.overall ?? 0;
      const scoreB = b.finalScore ?? PERSONA_CONFIDENCE[b.id]?.overall ?? 0;
      return scoreB - scoreA;
    }
    if (sortKey === 'influence') {
      const confA = a.finalScore ?? PERSONA_CONFIDENCE[a.id]?.overall ?? 50;
      const confB = b.finalScore ?? PERSONA_CONFIDENCE[b.id]?.overall ?? 50;
      const infA = confA * 0.4 + (a.isDistilled ? 5 : 3) + a.domain.length * 10;
      const infB = confB * 0.4 + (b.isDistilled ? 5 : 3) + b.domain.length * 10;
      return infB - infA;
    }
    if (sortKey === 'name') return a.nameZh.localeCompare(b.nameZh, 'zh-CN');
    if (sortKey === 'domain') return (a.domain[0] ?? '').localeCompare(b.domain[0] ?? '', 'zh-CN');
    return 0;
  });

  const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'default', label: '默认排序', icon: <ArrowUpDown className="w-3.5 h-3.5" />, desc: '按影响力排序' },
    { key: 'influence', label: '按影响力', icon: <TrendingUp className="w-3.5 h-3.5" />, desc: '综合置信度+心智模型数量+领域广度' },
    { key: 'confidence', label: '按置信度', icon: <Shield className="w-3.5 h-3.5" />, desc: '按置信度评分从高到低' },
    { key: 'name', label: '按姓名', icon: <Users className="w-3.5 h-3.5" />, desc: '中文姓名首字母排序' },
    { key: 'domain', label: '按领域', icon: <Filter className="w-3.5 h-3.5" />, desc: '按主要领域分组' },
  ];

  const currentSort = SORT_OPTIONS.find(o => o.key === sortKey);

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-elevated/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </Link>
            <div className="flex-1 flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-text-muted" />
              <h1 className="text-xl font-bold">人物库</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border-subtle">
                {sorted.length} / {unified.length}
              </span>
            </div>
          </div>

          {/* Search + Controls */}
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="搜索人物..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:border-border-primary"
              />
            </div>

            {/* Distilled filter toggle */}
            <button
              onClick={() => setShowDistilledOnly(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors',
                showDistilledOnly
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'bg-bg-base border-border-subtle text-text-muted hover:text-text-primary',
              )}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>蒸馏人物</span>
              {dbPersonas.length > 0 && (
                <span className="text-xs opacity-60">({dbPersonas.length})</span>
              )}
            </button>

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{currentSort?.label}</span>
              </button>
              {showSortMenu && (
                <div className="absolute top-full mt-1 right-0 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg overflow-hidden z-30 min-w-[180px]">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg-base transition-colors',
                        sortKey === opt.key ? 'text-accent-primary' : 'text-text-secondary',
                      )}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                      <span className="ml-auto text-xs text-text-muted">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Domain filter */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setSelectedDomain('all')}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 rounded-lg text-sm border whitespace-nowrap transition-colors',
                  selectedDomain === 'all'
                    ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
                    : 'bg-bg-base border-border-subtle text-text-muted hover:text-text-primary',
                )}
              >
                全部
              </button>
              {domains.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDomain(d)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-lg text-sm border whitespace-nowrap transition-colors',
                    selectedDomain === d
                      ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
                      : 'bg-bg-base border-border-subtle text-text-muted hover:text-text-primary',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Score explanation */}
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted bg-bg-surface/50 rounded-lg px-3 py-2 border border-border-subtle">
            <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>
              <span className="text-text-secondary font-medium">蒸馏置信度</span>
              {' '}基于语料规模、表达一致性、思维准确性多维评估，{' '}
              <span className="text-green-400">B/C级</span> = 语料充足表达忠实，
              <span className="text-yellow-400"> D级</span> = 语料有限需持续优化，
              <span className="text-red-400"> F级</span> = 语料稀缺仅供参考。
              分数仅代表当前蒸馏质量，不代表人物本身的价值。
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {sorted.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">没有找到匹配的人物</p>
            <p className="text-sm mt-1">尝试调整筛选条件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((p, i) => (
              <motion.div
                key={p.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
              >
                <PersonaCard
                  persona={p as unknown as Persona}
                  confidence={p.finalScore ?? PERSONA_CONFIDENCE[p.id]?.overall}
                  showDistillBadge={p.isDistilled}
                  distillGrade={p.qualityGrade}
                  distillScore={p.finalScore}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
