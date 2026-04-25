'use client';

/**
 * Prismatic — ExpressionDNA Sonic Fingerprint
 * Transforms ExpressionDNA data into a unique visual fingerprint.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Share2,
  Sparkles,
  Brain,
  BarChart3,
  Waves,
  Quote,
  AlertTriangle,
  Mic,
  Zap,
} from 'lucide-react';

import { getPersonaBySlug } from '@/lib/persona-index';
import { PERSONAS } from '@/lib/personas';
import { cn } from '@/lib/utils';

// ─── Waveform Strip ───────────────────────────────────────────────────────────

function WaveformStrip({ score, color, label }: {
  score: number;
  color: string;
  label: string;
}) {
  const bars = 32;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span style={{ color }}>{Math.round(score * 100)}%</span>
      </div>
      <div className="flex items-end gap-px h-12">
        {Array.from({ length: bars }).map((_, i) => {
          const center = bars / 2;
          const dist = Math.abs(i - center) / center;
          const baseHeight = Math.cos(dist * Math.PI * 1.5) * 0.5 + 0.5;
          const noise = Math.sin(i * 0.7 + score * 10) * 0.3;
          const height = Math.max(5, (baseHeight + noise) * score * 100);
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-300"
              style={{
                height: `${height}%`,
                background: `linear-gradient(to top, ${color}80, ${color})`,
                opacity: 0.5 + (height / 100) * 0.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Vocabulary Grid ───────────────────────────────────────────────────────────

function VocabGrid({ vocabulary, color }: { vocabulary: string[]; color: string }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {vocabulary.slice(0, 25).map((word, i) => {
        const size = Math.max(10, 18 - i * 0.4);
        const opacity = Math.max(0.4, 1 - i * 0.025);
        return (
          <motion.div
            key={word}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className="text-center py-2 rounded-lg"
            style={{
              fontSize: `${size}px`,
              fontWeight: Math.max(400, 600 - i * 15),
              color,
              opacity,
            }}
          >
            {word}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Sentence Style Icons ────────────────────────────────────────────────────

function SentenceStyleRow({ styles }: { styles: string[] }) {
  const iconMap: Record<string, string> = {
    '口语化': '🗣',
    '反问式': '❓',
    '诗性': '✦',
    '幽默自嘲': '😂',
    '严谨长句': '📐',
    '三段论结构': '🔗',
    '短句': '—',
    '长句': '≡',
    '省略': '…',
    '比喻': '≋',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {styles.map(s => (
        <motion.span
          key={s}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 border"
          style={{ borderColor: `${styles.length > 5 ? '#8b5cf6' : '#10b981'}40` }}
        >
          <span>{iconMap[s] || '▸'}</span>
          <span>{s}</span>
        </motion.span>
      ))}
    </div>
  );
}

// ─── Certainty Bar ────────────────────────────────────────────────────────────

function CertaintyBar({ level }: { level: 'high' | 'medium' | 'low' | undefined }) {
  const map = {
    high: { label: '高度确信', color: '#10b981', width: 92 },
    medium: { label: '适度确信', color: '#f59e0b', width: 60 },
    low: { label: '审慎保留', color: '#6b7280', width: 28 },
  };
  const cfg = level ? map[level] : map.medium;

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>确信度</span>
        <span style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cfg.width}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: cfg.color }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
        <span>审慎保留</span>
        <span>高度确信</span>
      </div>
    </div>
  );
}

// ─── Quote Pattern ─────────────────────────────────────────────────────────────

function QuotePatternRow({ quotes }: { quotes: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {quotes.map((q, i) => (
        <motion.span
          key={q}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="px-3 py-1 rounded-lg text-xs italic bg-white/5 text-gray-300 border-l-2 border-indigo-500"
        >
          &ldquo;{q}&rdquo;
        </motion.span>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [persona, setPersona] = useState<ReturnType<typeof getPersonaBySlug>>(undefined);
  const [fullPersona, setFullPersona] = useState<any>(null);

  useEffect(() => {
    if (slug) {
      const data = getPersonaBySlug(slug);
      const full = PERSONAS[slug];
      setPersona(data);
      setFullPersona(full || null);
    }
  }, [slug]);

  if (!persona || !fullPersona) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  const edna = fullPersona.expressionDNA;
  if (!edna) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <p>该人物暂无表达DNA数据</p>
          <button onClick={() => router.push('/observatory')} className="mt-4 text-indigo-400 hover:underline">
            返回星图
          </button>
        </div>
      </div>
    );
  }

  // Compute sub-scores for waveform strips
  const vocScore = Math.min(1, (edna.vocabulary?.length || 0) / 20);
  const styleScore = Math.min(1, (edna.sentenceStyle?.length || 0) / 4);
  const certaintyMap: Record<string, number> = { high: 0.9, medium: 0.6, low: 0.3 };
  const certaintyScore = edna.certaintyLevel ? (certaintyMap[edna.certaintyLevel as string] ?? 0.5) : 0.5;
  const humorScore = edna.humorStyle?.includes('无') || edna.humorStyle?.includes('几乎没有') ? 0.1 : 0.6;
  const quoteScore = Math.min(1, (edna.quotePatterns?.length || 0) / 5);
  const rhythmScore = edna.rhythm ? 0.7 : 0.4;
  const rhetoricalScore = edna.rhetoricalHabit ? 0.75 : 0.3;

  const strips = [
    { score: vocScore, color: persona.accentColor, label: '词汇丰富度' },
    { score: styleScore, color: '#8b5cf6', label: '句式多样性' },
    { score: certaintyScore, color: '#10b981', label: '确信程度' },
    { score: humorScore, color: '#f59e0b', label: '幽默频率' },
    { score: quoteScore, color: '#ec4899', label: '引用密度' },
    { score: rhythmScore, color: '#06b6d4', label: '节奏感' },
    { score: rhetoricalScore, color: '#f97316', label: '修辞力度' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Cosmic background */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${persona.accentColor}12 0%, transparent 50%)`,
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push(`/observatory/${slug}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            表达指纹
          </h1>
          <button
            onClick={() => {
              const url = `${window.location.origin}/observatory/fingerprint/${slug}`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden sm:inline">分享</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Identity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl font-bold mb-1" style={{ color: persona.accentColor }}>
              {persona.nameZh}
            </h2>
            <p className="text-gray-400 mb-2">{persona.name}</p>
            <p className="text-sm text-gray-600">ExpressionDNA 声纹档案</p>
          </motion.div>

          {/* Fingerprint Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-6"
          >
            {/* Header stripe */}
            <div
              className="h-2"
              style={{
                background: `linear-gradient(90deg, ${persona.gradientFrom}, ${persona.accentColor}, ${persona.gradientTo})`,
              }}
            />

            <div className="p-8 space-y-8">
              {/* Waveform Strips */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-indigo-400" />
                  声纹波形
                </h3>
                <div className="space-y-4">
                  {strips.map(s => (
                    <WaveformStrip key={s.label} {...s} />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Vocabulary Grid */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  词汇指纹
                </h3>
                <VocabGrid vocabulary={edna.vocabulary || []} color={persona.accentColor} />
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Sentence Styles */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-cyan-400" />
                  句式风格
                </h3>
                <SentenceStyleRow styles={edna.sentenceStyle || []} />
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Certainty */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  确信度
                </h3>
                <CertaintyBar level={edna.certaintyLevel} />
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Rhetorical Habit */}
              {edna.rhetoricalHabit && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    修辞习惯
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{edna.rhetoricalHabit}</p>
                </div>
              )}

              {/* Divider */}
              {edna.rhetoricalHabit && <div className="border-t border-white/10" />}

              {/* Rhythm */}
              {edna.rhythm && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Waves className="w-4 h-4 text-pink-400" />
                    表达节奏
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{edna.rhythm}</p>
                </div>
              )}

              {/* Divider */}
              {edna.rhythm && <div className="border-t border-white/10" />}

              {/* Humor */}
              {edna.humorStyle && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span className="text-lg">😂</span>
                    幽默风格
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{edna.humorStyle}</p>
                </div>
              )}

              {/* Divider */}
              {edna.humorStyle && <div className="border-t border-white/10" />}

              {/* Quote Patterns */}
              {edna.quotePatterns && edna.quotePatterns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <Quote className="w-4 h-4 text-rose-400" />
                    引用习惯
                  </h3>
                  <QuotePatternRow quotes={edna.quotePatterns} />
                </div>
              )}

              {/* Divider */}
              {edna.quotePatterns && edna.quotePatterns.length > 0 && (
                <div className="border-t border-white/10" />
              )}

              {/* Chinese Adaptation */}
              {edna.chineseAdaptation && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-yellow-400" />
                    中文适配
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{edna.chineseAdaptation}</p>
                </div>
              )}

              {/* Forbidden Words */}
              {edna.forbiddenWords && edna.forbiddenWords.length > 0 && (
                <>
                  <div className="border-t border-white/10" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      禁言词汇 (该人物不会说的话)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(edna.forbiddenWords as string[]).map(w => (
                        <span
                          key={w}
                          className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 line-through"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Link
              href={`/observatory/${slug}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              完整档案
            </Link>
            <Link
              href={`/conversations/new?persona=${slug}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white font-medium hover:opacity-90 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              开始对话
            </Link>
          </div>

          {/* Attribution */}
          <p className="text-center text-xs text-gray-700 mt-8">
            Prismatic Brain Observatory — 思想星空
          </p>
        </div>
      </main>
    </div>
  );
}
