/**
 * KnowledgeGapBanner
 *
 * Renders a contextual warning UI when the AI response involves knowledge boundary
 * awareness — indicating the response was generated with degraded/cutoff knowledge.
 *
 * Different degradation modes get different visual treatments:
 *
 * - honest_boundary:  Orange/amber — "I don't know this" signal
 * - extrapolate:      Blue — "Based on values, not facts" signal
 * - hybrid:           Purple — "Part fact, part inference" signal
 * - refer_sources:    Green — "Based on cited sources" signal
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, BookOpen, BrainCircuit, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface KnowledgeGapData {
  isGapAware?: boolean;
  degradationMode?: string;
  warningLabel?: string;
  corpusCutoffDate?: string;
  gapSignals?: string[];
  confidence?: number;
  isExtrapolation?: boolean;
  routingReason?: string;
}

interface KnowledgeGapBannerProps {
  gap: KnowledgeGapData;
  personaNameZh: string;
}

const MODE_CONFIG: Record<string, {
  icon: 'alert' | 'brain' | 'book' | 'info';
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
  iconClass: string;
}> = {
  honest_boundary: {
    icon: 'alert',
    label: '知识边界',
    bgClass: 'bg-amber-500/8',
    borderClass: 'border-amber-500/25',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    iconClass: 'text-amber-400',
  },
  extrapolate: {
    icon: 'brain',
    label: '推演内容',
    bgClass: 'bg-blue-500/8',
    borderClass: 'border-blue-500/25',
    textClass: 'text-blue-300',
    badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    iconClass: 'text-blue-400',
  },
  hybrid: {
    icon: 'info',
    label: '混合内容',
    bgClass: 'bg-purple-500/8',
    borderClass: 'border-purple-500/25',
    textClass: 'text-purple-300',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    iconClass: 'text-purple-400',
  },
  refer_sources: {
    icon: 'book',
    label: '来源引用',
    bgClass: 'bg-green-500/8',
    borderClass: 'border-green-500/25',
    textClass: 'text-green-300',
    badgeClass: 'bg-green-500/15 text-green-300 border border-green-500/30',
    iconClass: 'text-green-400',
  },
};

function GapIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'alert':  return <AlertTriangle className={cn('w-3.5 h-3.5', className)} />;
    case 'brain':  return <BrainCircuit className={cn('w-3.5 h-3.5', className)} />;
    case 'book':   return <BookOpen className={cn('w-3.5 h-3.5', className)} />;
    default:        return <Info className={cn('w-3.5 h-3.5', className)} />;
  }
}

export function KnowledgeGapBanner({ gap, personaNameZh }: KnowledgeGapBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const mode = gap.degradationMode ?? 'hybrid';
  const config = MODE_CONFIG[mode] ?? MODE_CONFIG.hybrid;

  const cutoffDate = gap.corpusCutoffDate
    ? new Date(gap.corpusCutoffDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const confidencePct = gap.confidence != null ? Math.round(gap.confidence * 100) : null;
  const signals = gap.gapSignals ?? [];
  const hasSignals = signals.length > 0;

  return (
    <div
      className={cn(
        'mb-2.5 rounded-xl border px-3 py-2.5',
        config.bgClass,
        config.borderClass
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <GapIcon type={config.icon} className={cn('mt-0.5 flex-shrink-0', config.iconClass)} />

        <div className="flex-1 min-w-0">
          {/* Badge + label row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', config.badgeClass)}>
              {config.label}
            </span>
            {gap.warningLabel && (
              <span className={cn('text-xs', config.textClass, 'opacity-80')}>
                {gap.warningLabel}
              </span>
            )}
          </div>

          {/* Core statement */}
          <p className={cn('text-xs mt-1 leading-relaxed', config.textClass, 'opacity-90')}>
            {mode === 'honest_boundary' && (
              <>此内容超出 {personaNameZh} 的蒸馏知识范围。{cutoffDate ? `知识截止于 ${cutoffDate}。` : ''} 以下内容仅作参考。</>
            )}
            {mode === 'extrapolate' && (
              <>以下为基于 {personaNameZh} 价值观和思维模式的推演内容，非具体事实。{cutoffDate ? `知识截止于 ${cutoffDate}。` : ''}</>
            )}
            {mode === 'hybrid' && (
              <>以下为混合内容：部分基于蒸馏知识，{cutoffDate ? `截止于 ${cutoffDate}，` : ''}部分为推演。{confidencePct != null ? `置信度约 ${confidencePct}%。` : ''}</>
            )}
            {mode === 'refer_sources' && (
              <>以下内容引用自己蒸馏来源，可信度较高。{cutoffDate ? `来源知识截止于 ${cutoffDate}。` : ''}</>
            )}
            {mode !== 'honest_boundary' && mode !== 'extrapolate' && mode !== 'hybrid' && mode !== 'refer_sources' && (
              <>此回复涉及知识边界，请注意甄别。</>
            )}
          </p>
        </div>
      </div>

      {/* Expandable details */}
      {hasSignals && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
              config.textClass,
              'opacity-70 hover:opacity-100'
            )}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? '收起详情' : '查看详情'}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-1.5">
                  {cutoffDate && (
                    <div className="flex items-start gap-1.5">
                      <span className={cn('text-[10px] font-medium mt-px', config.textClass, 'opacity-60')}>
                        知识截止：
                      </span>
                      <span className="text-[11px] text-text-secondary">{cutoffDate}</span>
                    </div>
                  )}
                  {confidencePct != null && (
                    <div className="flex items-start gap-1.5">
                      <span className={cn('text-[10px] font-medium mt-px', config.textClass, 'opacity-60')}>
                        置信度：
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 rounded-full bg-bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: mode === 'honest_boundary' ? '#f59e0b'
                                : mode === 'extrapolate' ? '#3b82f6'
                                : mode === 'hybrid' ? '#a855f7'
                                : '#22c55e',
                              width: `${confidencePct}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-text-secondary">{confidencePct}%</span>
                      </div>
                    </div>
                  )}
                  {signals.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <span className={cn('text-[10px] font-medium mt-px', config.textClass, 'opacity-60')}>
                        空白信号：
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {signals.map((s, i) => (
                          <span
                            key={i}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded',
                              config.bgClass,
                              config.borderClass,
                              config.textClass
                            )}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gap.routingReason && (
                    <div className="flex items-start gap-1.5">
                      <span className={cn('text-[10px] font-medium mt-px', config.textClass, 'opacity-60')}>
                        决策原因：
                      </span>
                      <span className="text-[11px] text-text-secondary">{gap.routingReason}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
