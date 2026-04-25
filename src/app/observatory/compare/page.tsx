'use client';

/**
 * Prismatic — Observatory Comparison Arena
 * Side-by-side comparison of two personas.
 */

import { useState, useMemo, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  GitCompare,
  Brain,
  Dna,
  Target,
  Zap,
  BookOpen,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Radar,
} from 'lucide-react';

import { PERSONA_INDEX, searchPersonas } from '@/lib/persona-index';
import { PERSONAS } from '@/lib/personas';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComparePersona {
  slug: string;
  index: ReturnType<typeof PERSONA_INDEX.find>;
  full: any;
}

// ─── Comparison Radar ─────────────────────────────────────────────────────────

function CompareRadar({ left, right }: { left: ComparePersona; right: ComparePersona }) {
  const size = 320;
  const center = size / 2;
  const maxRadius = 110;
  const labels = ['词汇丰富度', '句式复杂度', '确信程度', '幽默频率', '引用密度', '节奏感', '修辞力度', '语调范围'];

  function computeData(edna: any) {
    if (!edna) return labels.map(() => 50);
    return [
      Math.min(100, (edna.vocabulary?.length || 0) * 6),
      edna.sentenceStyle?.length ? Math.min(100, edna.sentenceStyle.length * 20) : 50,
      edna.certaintyLevel === 'high' ? 90 : edna.certaintyLevel === 'medium' ? 60 : 30,
      edna.humorStyle?.includes('无') || edna.humorStyle?.includes('几乎没有') ? 10 : 50,
      edna.quotePatterns?.length ? Math.min(100, edna.quotePatterns.length * 20) : 30,
      edna.rhythm ? 70 : 40,
      edna.rhetoricalHabit ? 75 : 40,
      60,
    ];
  }

  const leftData = computeData(left.full?.expressionDNA);
  const rightData = computeData(right.full?.expressionDNA);
  const numAxes = labels.length;
  const angleStep = (2 * Math.PI) / numAxes;

  function getPolygon(data: number[]) {
    return data.map((value, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      return `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`;
    }).join(' ');
  }

  return (
    <div className="relative">
      <svg width={size} height={size} className="mx-auto">
        {/* Grid */}
        {[25, 50, 75, 100].map(level => (
          <circle key={level} cx={center} cy={center} r={(level / 100) * maxRadius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}

        {/* Axes */}
        {labels.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line key={i} x1={center} y1={center}
              x2={center + maxRadius * Math.cos(angle)} y2={center + maxRadius * Math.sin(angle)}
              stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          );
        })}

        {/* Left persona polygon */}
        <polygon points={getPolygon(leftData)} fill={left.index?.accentColor || '#4f46e5'}
          fillOpacity={0.15} stroke={left.index?.accentColor || '#4f46e5'} strokeWidth={2}
          strokeLinejoin="round" />

        {/* Right persona polygon */}
        <polygon points={getPolygon(rightData)} fill={right.index?.accentColor || '#ec4899'}
          fillOpacity={0.15} stroke={right.index?.accentColor || '#ec4899'} strokeWidth={2}
          strokeLinejoin="round" />

        {/* Labels */}
        {labels.map((label, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = maxRadius + 22;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          return (
            <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.5)" fontSize={9}>
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: left.index?.accentColor || '#4f46e5' }} />
          <span className="text-sm text-gray-300">{left.index?.nameZh}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: right.index?.accentColor || '#ec4899' }} />
          <span className="text-sm text-gray-300">{right.index?.nameZh}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Vocabulary Overlap ───────────────────────────────────────────────────────

function VocabOverlap({ left, right }: { left: ComparePersona; right: ComparePersona }) {
  const leftVocab = new Set<string>((left.full?.expressionDNA?.vocabulary || []).map((w: string) => w.trim()));
  const rightVocab = new Set<string>((right.full?.expressionDNA?.vocabulary || []).map((w: string) => w.trim()));
  const overlap = [...leftVocab].filter(w => rightVocab.has(w));
  const leftOnly = [...leftVocab].filter(w => !rightVocab.has(w)).slice(0, 8);
  const rightOnly = [...rightVocab].filter(w => !leftVocab.has(w)).slice(0, 8);

  return (
    <div className="space-y-4">
      {overlap.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">共享词汇 ({overlap.length})</p>
          <div className="flex flex-wrap gap-2">
            {overlap.map(w => (
              <span key={w} className="px-3 py-1 rounded-full text-xs bg-white/10 text-white border border-white/20">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-2" style={{ color: left.index?.accentColor }}>
            {left.index?.nameZh} 独有用词
          </p>
          <div className="flex flex-wrap gap-1">
            {leftOnly.map(w => (
              <span key={w} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: `${left.index?.accentColor}20`, color: left.index?.accentColor }}>
                {w}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-2" style={{ color: right.index?.accentColor }}>
            {right.index?.nameZh} 独有用词
          </p>
          <div className="flex flex-wrap gap-1">
            {rightOnly.map(w => (
              <span key={w} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: `${right.index?.accentColor}20`, color: right.index?.accentColor }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mental Model Comparison ───────────────────────────────────────────────────

function MMComparison({ left, right }: { left: ComparePersona; right: ComparePersona }) {
  const leftModels = new Set<string>((left.full?.mentalModels || []).map((m: any) => String(m.nameZh || m.name).toLowerCase()));
  const rightModels = new Set<string>((right.full?.mentalModels || []).map((m: any) => String(m.nameZh || m.name).toLowerCase()));
  const overlap = [...leftModels].filter(m => rightModels.has(m));
  const leftOnly = [...leftModels].filter(m => !rightModels.has(m));
  const rightOnly = [...rightModels].filter(m => !leftModels.has(m));

  const similarity = leftModels.size + rightModels.size > 0
    ? Math.round((overlap.length * 2 / (leftModels.size + rightModels.size)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Similarity Score */}
      <div className="text-center">
        <div className="text-4xl font-bold mb-1" style={{ color: '#8b5cf6' }}>{similarity}%</div>
        <p className="text-sm text-gray-500">思维模型相似度</p>
      </div>

      {overlap.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">共同思维模型 ({overlap.length})</p>
          <div className="flex flex-wrap gap-2">
            {overlap.map(w => (
              <span key={w} className="px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/20">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-2" style={{ color: left.index?.accentColor }}>
            {left.index?.nameZh} 独有问题 ({leftOnly.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {leftOnly.slice(0, 5).map(m => (
              <span key={m} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">
                {m}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-2" style={{ color: right.index?.accentColor }}>
            {right.index?.nameZh} 独有问题 ({rightOnly.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {rightOnly.slice(0, 5).map(m => (
              <span key={m} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Persona Selector ─────────────────────────────────────────────────────────

function PersonaSelector({ value, onChange, exclude }: {
  value: string;
  onChange: (slug: string) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    let list = PERSONA_INDEX.filter(p => p.slug !== exclude);
    if (search) list = searchPersonas(search);
    return list.slice(0, 30);
  }, [search, exclude]);

  const selected = PERSONA_INDEX.find(p => p.slug === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left"
      >
        {selected ? (
          <>
            <div
              className="w-8 h-8 rounded-full shrink-0"
              style={{ background: `linear-gradient(135deg, ${selected.gradientFrom}, ${selected.gradientTo})` }}
            />
            <div>
              <p className="text-white font-medium">{selected.nameZh}</p>
              <p className="text-xs text-gray-500">{selected.taglineZh}</p>
            </div>
          </>
        ) : (
          <p className="text-gray-500">选择人物...</p>
        )}
        <ChevronDown className={cn('w-4 h-4 text-gray-400 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
          <div className="p-2 border-b border-white/10">
            <input
              type="text"
              placeholder="搜索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.map(p => (
              <button
                key={p.slug}
                onClick={() => { onChange(p.slug); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
              >
                <div
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
                />
                <div>
                  <p className="text-white text-sm">{p.nameZh}</p>
                  <p className="text-xs text-gray-500">{p.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inner component that uses searchParams ────────────────────────────────────

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLeft = searchParams.get('persona') || '';
  const initialRight = searchParams.get('compare') || '';

  const [leftSlug, setLeftSlug] = useState(initialLeft);
  const [rightSlug, setRightSlug] = useState(initialRight);

  const left: ComparePersona = useMemo(() => ({
    slug: leftSlug,
    index: PERSONA_INDEX.find(p => p.slug === leftSlug),
    full: PERSONAS[leftSlug],
  }), [leftSlug]);

  const right: ComparePersona = useMemo(() => ({
    slug: rightSlug,
    index: PERSONA_INDEX.find(p => p.slug === rightSlug),
    full: PERSONAS[rightSlug],
  }), [rightSlug]);

  const bothSelected = left.index && right.index;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Cosmic bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          background: bothSelected
            ? `radial-gradient(ellipse at 30% 50%, ${left.index?.accentColor}10 0%, transparent 40%), radial-gradient(ellipse at 70% 50%, ${right.index?.accentColor}10 0%, transparent 40%)`
            : 'transparent',
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/observatory')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回星图</span>
          </button>
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-semibold text-white">对比 arena</h1>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Selector Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="md:col-span-1">
              <label className="block text-sm text-gray-500 mb-2">人物 A</label>
              <PersonaSelector value={leftSlug} onChange={setLeftSlug} exclude={rightSlug} />
            </div>

            <div className="hidden md:flex items-center justify-center">
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <GitCompare className="w-5 h-5 text-gray-600 mx-4" />
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm text-gray-500 mb-2">人物 B</label>
              <PersonaSelector value={rightSlug} onChange={setRightSlug} exclude={leftSlug} />
            </div>
          </div>

          {/* Comparison Content */}
          {bothSelected ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

              {/* Identity Row */}
              <div className="grid grid-cols-3 gap-4">
                {[{ p: left, label: 'A' }, { p: right, label: 'B' }].map(({ p, label }) => (
                  <div key={p.slug} className="text-center">
                    <div
                      className="w-20 h-20 rounded-full mx-auto mb-3"
                      style={{
                        background: `linear-gradient(135deg, ${p.index?.gradientFrom}, ${p.index?.gradientTo})`,
                        boxShadow: `0 0 40px ${p.index?.accentColor}40`,
                      }}
                    />
                    <h2 className="text-2xl font-bold" style={{ color: p.index?.accentColor }}>
                      {p.index?.nameZh}
                    </h2>
                    <p className="text-gray-400 text-sm">{p.index?.name}</p>
                    <div className="mt-2 flex justify-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">
                        {p.index?.primaryDomainLabel}
                      </span>
                      {p.index?.cluster && (
                        <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-500">
                          {p.index.cluster.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-center">
                  <Link
                    href={`/conversations/new?persona=${leftSlug},${rightSlug}`}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-white text-sm font-medium hover:opacity-90"
                  >
                    <Sparkles className="w-4 h-4" />
                    辩论
                  </Link>
                </div>
              </div>

              {/* Stats Comparison */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '思维模型', left: left.index?.mentalModelCount, right: right.index?.mentalModelCount, icon: Brain },
                  { label: '决策启发式', left: left.index?.heuristicCount, right: right.index?.heuristicCount, icon: Target },
                  { label: '认知张力', left: left.index?.tensionCount, right: right.index?.tensionCount, icon: Zap },
                  { label: '知识来源', left: left.index?.sourceCount, right: right.index?.sourceCount, icon: BookOpen },
                ].map(({ label, left: lVal, right: rVal, icon: Icon }) => (
                  <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-3 text-center">{label}</p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <div className="text-xl font-bold" style={{ color: left.index?.accentColor }}>{lVal}</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold" style={{ color: right.index?.accentColor }}>{rVal}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ExpressionDNA Radar */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Radar className="w-5 h-5 text-indigo-400" />
                  表达DNA雷达图
                </h3>
                <CompareRadar left={left} right={right} />
              </div>

              {/* Vocabulary Overlap */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Dna className="w-5 h-5 text-purple-400" />
                  词汇指纹对比
                </h3>
                <VocabOverlap left={left} right={right} />
              </div>

              {/* Mental Model Comparison */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-green-400" />
                  思维模型对比
                </h3>
                <MMComparison left={left} right={right} />
              </div>

              {/* Tagline Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{left.index?.nameZh}</p>
                  <p className="text-xl font-bold" style={{ color: left.index?.accentColor }}>
                    {left.index?.taglineZh}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{right.index?.nameZh}</p>
                  <p className="text-xl font-bold" style={{ color: right.index?.accentColor }}>
                    {right.index?.taglineZh}
                  </p>
                </div>
              </div>

            </motion.div>
          ) : (
            <div className="text-center py-24">
              <GitCompare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">请从上方选择两个人物进行对比</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Wrapper with Suspense ─────────────────────────────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  );
}
