'use client';

/**
 * Prismatic — Wisdom Mentor Library
 * /library — 智慧导师订阅库
 *
 * Features:
 *   - Grid of all personas with tier badges (FREE/MONTHLY/LIFETIME)
 *   - Domain filter, tier filter, search
 *   - Subscription modal for gated personas
 *   - Fetches from /api/library
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, Filter, ArrowUpDown, Lock, Unlock,
  Crown, Sparkles, Loader2, X, ChevronRight,
  BookOpen, Users, Zap, Star, Shield, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_CONFIG = {
  FREE: {
    label: '免费体验', labelEn: 'Free',
    color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
    icon: '🌿',
    description: '基础对话体验',
    price: '¥0',
    badge: null,
  },
  MONTHLY: {
    label: '月度订阅', labelEn: 'Monthly',
    color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    icon: '📜',
    description: '解锁全部思维模型',
    price: '¥39/月',
    badge: '精选',
  },
  LIFETIME: {
    label: '终身珍藏', labelEn: 'Lifetime',
    color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    icon: '🏛️',
    description: '古籍原文深度对话',
    price: '¥299',
    badge: '大师',
  },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

const DOMAINS = [
  { id: 'philosophy', label: '哲学思想', labelEn: 'Philosophy', emoji: '🏛️' },
  { id: 'technology', label: '科技商业', labelEn: 'Technology', emoji: '⚡' },
  { id: 'investment', label: '投资智慧', labelEn: 'Investment', emoji: '📈' },
  { id: 'science', label: '科学研究', labelEn: 'Science', emoji: '🔬' },
  { id: 'medicine', label: '传统医学', labelEn: 'Medicine', emoji: '💊' },
  { id: 'literature', label: '文学艺术', labelEn: 'Literature', emoji: '📚' },
  { id: 'history', label: '历史人物', labelEn: 'History', emoji: '⚔️' },
  { id: 'business', label: '商业经营', labelEn: 'Business', emoji: '🎯' },
  { id: 'psychology', label: '心理认知', labelEn: 'Psychology', emoji: '🧠' },
  { id: 'strategy', label: '战略兵法', labelEn: 'Strategy', emoji: '♟️' },
] as const;

const SORT_OPTIONS = [
  { id: 'score', label: '品质得分', labelEn: 'Quality Score' },
  { id: 'name', label: '姓名排序', labelEn: 'Name' },
  { id: 'created', label: '最近添加', labelEn: 'Recently Added' },
] as const;

interface LibraryPersona {
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: string;
  tagline: string;
  taglineZh: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  avatar: string;
  brief: string;
  briefZh: string;
  finalScore: number;
  qualityGrade: string;
  mentalModels: unknown[];
  tier: TierKey;
  canAccess: boolean;
  isPublished: boolean;
  createdAt: string;
  distillVersion: string;
  corpusTotalWords: number;
}

interface LibraryResponse {
  personas: LibraryPersona[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userTier: TierKey;
}

function PersonaCard({
  persona,
  onUpgradeClick,
}: {
  persona: LibraryPersona;
  onUpgradeClick: (tier: TierKey) => void;
}) {
  const tier = TIER_CONFIG[persona.tier] as typeof TIER_CONFIG[FREE] | typeof TIER_CONFIG[MONTHLY] | typeof TIER_CONFIG[LIFETIME];
  const isLocked = !persona.canAccess;
  const gradeColors: Record<string, string> = {
    S: 'text-yellow-400', A: 'text-emerald-400', B: 'text-blue-400',
    C: 'text-slate-400', D: 'text-red-400', F: 'text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative"
    >
      <div
        className="relative rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm overflow-hidden transition-all duration-300 group-hover:border-white/15 group-hover:bg-white/[0.07]"
        style={{
          boxShadow: isLocked ? 'none' : `0 4px 24px ${persona.gradientFrom}22`,
        }}
      >
        {/* Gradient accent bar */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(135deg, ${persona.gradientFrom || persona.accentColor}, ${persona.gradientTo || persona.accentColor})`,
            opacity: isLocked ? 0.4 : 1,
          }}
        />

        {/* Tier badge */}
        {tier.badge && (
          <div
            className="absolute top-3 right-3 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: tier.bgColor,
              color: tier.color,
              border: `1px solid ${tier.borderColor}`,
            }}
          >
            {tier.icon} {tier.badge}
          </div>
        )}

        {/* Lock overlay */}
        {isLocked && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(1px)' }}
          >
            <button
              onClick={() => onUpgradeClick(persona.tier)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105"
              style={{ background: tier.color, color: '#000' }}
            >
              <Lock className="w-3.5 h-3.5" />
              解锁 {tier.label}
            </button>
          </div>
        )}

        <div className="p-5">
          {/* Header: Avatar + Name */}
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{
                background: `linear-gradient(135deg, ${persona.gradientFrom || persona.accentColor}cc, ${persona.gradientTo || persona.accentColor}88)`,
                opacity: isLocked ? 0.6 : 1,
              }}
            >
              {persona.avatar ? (
                <img src={persona.avatar} alt={persona.nameZh} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <span className="text-white">{persona.nameZh[0]}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={cn(
                'font-semibold text-sm truncate',
                isLocked ? 'text-white/50' : 'text-white/90'
              )}>
                {persona.nameZh}
              </h3>
              <p className="text-[11px] text-white/40 truncate">{persona.nameEn}</p>

              {/* Grade + Score */}
              <div className="flex items-center gap-2 mt-1">
                {persona.qualityGrade && (
                  <span className={cn(
                    'text-[11px] font-bold px-1.5 py-0.5 rounded',
                    isLocked ? 'opacity-40' : '',
                    gradeColors[persona.qualityGrade] || 'text-slate-400'
                  )}>
                    Grade {persona.qualityGrade}
                  </span>
                )}
                <span className={cn(
                  'text-[11px] font-mono',
                  isLocked ? 'text-white/30' : 'text-white/50'
                )}>
                  {persona.finalScore.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <p className={cn(
            'text-[12px] leading-relaxed mb-3 line-clamp-2',
            isLocked ? 'text-white/30' : 'text-white/60'
          )}>
            {persona.taglineZh || persona.tagline || persona.briefZh || persona.brief || ''}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{
                  background: `${persona.gradientFrom || persona.accentColor}22`,
                  color: isLocked ? 'rgba(255,255,255,0.3)' : `${persona.gradientFrom || persona.accentColor}dd`,
                }}
              >
                {persona.domain}
              </span>
              {persona.corpusTotalWords > 0 && (
                <span className="text-[10px] text-white/30">
                  {(persona.corpusTotalWords / 10000).toFixed(0)}w字
                </span>
              )}
            </div>

            <Link
              href={`/library/${persona.slug}`}
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium transition-colors',
                isLocked
                  ? 'text-white/20 pointer-events-none'
                  : 'text-white/50 hover:text-white/80'
              )}
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {isLocked ? '订阅查看' : '查看详情'}
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UpgradeModal({
  tier,
  onClose,
}: {
  tier: TierKey;
  onClose: () => void;
}) {
  const config = TIER_CONFIG[tier];
  const otherTiers = (Object.keys(TIER_CONFIG) as TierKey[])
    .filter(t => t !== tier)
    .map(t => ({ tier: t, ...TIER_CONFIG[t] }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f1a] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: config.bgColor, color: config.color }}
            >
              {config.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{config.label} 人物</h2>
              <p className="text-sm text-white/50">{config.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div
          className="rounded-xl p-4 mb-6 border"
          style={{ background: config.bgColor, borderColor: config.borderColor }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: config.color }}>{config.label}</span>
            <span className="text-xl font-bold text-white">{config.price}</span>
          </div>
          <div className="space-y-2">
            {tier === 'MONTHLY' && [
              '解锁全部思维模型完整内容',
              '古籍原文深度对话能力',
              '优先排队访问新人物',
              '无限对话历史记录',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
                {item}
              </div>
            ))}
            {tier === 'LIFETIME' && [
              '包含月度订阅全部权益',
              '终身访问，无需续费',
              '优先体验内测新人物',
              '古籍原文 RAG 检索增强',
              '专属终身会员标识',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-white/40 mb-4">
          了解更多订阅方案：
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {otherTiers.map(({ tier: t, icon, label, color, price, description }) => (
            <button
              key={t}
              onClick={() => {/* navigate */}}
              className="rounded-xl p-3 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-all text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
              <div className="text-xs font-bold" style={{ color }}>{price}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{description}</div>
            </button>
          ))}
        </div>

        <Link
          href="/subscribe"
          className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-black transition-all hover:opacity-90"
          style={{ background: config.color }}
        >
          立即订阅 {config.label}
        </Link>
      </motion.div>
    </motion.div>
  );
}

export default function LibraryPage() {
  const [personas, setPersonas] = useState<LibraryPersona[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null);
  const [sortBy, setSortBy] = useState('score');
  const [userTier, setUserTier] = useState<TierKey>('FREE');
  const [upgradeModalTier, setUpgradeModalTier] = useState<TierKey | null>(null);

  const LIMIT = 24;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(page),
        sortBy,
        sortDir: 'desc',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedDomain) params.set('domain', selectedDomain);
      if (selectedTier) params.set('tier', selectedTier);

      const res = await fetch(`/api/library?${params}`);
      const data: LibraryResponse = await res.json();
      setPersonas(data.personas || []);
      setTotal(data.total || 0);
      setUserTier(data.userTier || 'FREE');
    } catch (e) {
      console.error('Failed to fetch library:', e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedDomain, selectedTier, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedDomain, selectedTier]);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const tierCounts = personas.reduce<Record<TierKey, number>>((acc, p) => {
    acc[p.tier] = (acc[p.tier] || 0) + 1;
    return acc;
  }, { FREE: 0, MONTHLY: 0, LIFETIME: 0 });

  return (
    <div className="min-h-screen bg-[#080810]">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">智慧导师库</h1>
                <p className="text-sm text-white/40">与人类最卓越的灵魂对话</p>
              </div>
            </div>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6 mt-4"
          >
            {(['FREE', 'MONTHLY', 'LIFETIME'] as TierKey[]).map((tier) => {
              const config = TIER_CONFIG[tier];
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    selectedTier === tier
                      ? 'border-current'
                      : 'border-white/10 hover:border-white/20 text-white/50 hover:text-white/70'
                  )}
                  style={selectedTier === tier ? { color: config.color, borderColor: config.borderColor, background: config.bgColor } : {}}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span className="opacity-60">({tierCounts[tier] || 0})</span>
                </button>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="搜索人物..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white/[0.05] border border-white/8 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Domain pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedDomain(null)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                !selectedDomain ? 'border-white/20 bg-white/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
              )}
            >
              全部领域
            </button>
            {DOMAINS.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDomain(selectedDomain === d.id ? null : d.id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selectedDomain === d.id ? 'border-white/20 bg-white/10 text-white' : 'border-white/8 text-white/40 hover:text-white/60 hover:border-white/15'
                )}
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-white/30" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs bg-transparent text-white/50 border-none focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.id} value={o.id} className="bg-[#0f0f1a]">{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        {/* Result count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-white/40">
            {loading ? '加载中...' : `${total} 位导师`}
          </p>
          <Link
            href="/subscribe"
            className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            查看订阅方案 →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : personas.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-white/40 text-sm">没有找到匹配的人物</p>
            <button
              onClick={() => { setSearch(''); setSelectedDomain(null); setSelectedTier(null); }}
              className="mt-3 text-xs text-amber-400/70 hover:text-amber-400"
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {personas.map(persona => (
              <PersonaCard
                key={persona.slug}
                persona={persona}
                onUpgradeClick={setUpgradeModalTier}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-sm border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 disabled:opacity-30 transition-all"
            >
              上一页
            </button>
            <span className="text-sm text-white/40 px-2">
              第 {page} / {Math.ceil(total / LIMIT)} 页
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / LIMIT)}
              className="px-4 py-2 rounded-lg text-sm border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 disabled:opacity-30 transition-all"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {upgradeModalTier && (
          <UpgradeModal tier={upgradeModalTier} onClose={() => setUpgradeModalTier(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
