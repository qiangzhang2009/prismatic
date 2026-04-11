/**
 * Prismatic — Debate View Component
 * Multi-person round table debate display
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPersonasByIds } from '@/lib/personas';
import type { Persona } from '@/lib/types';

interface DebateRound {
  round: number;
  speakerId: string;
  content: string;
  targets?: string[];
}

interface DebateViewProps {
  rounds: DebateRound[];
  consensus?: {
    text: string;
    agreedBy: string[];
    strength: number;
  };
  summary?: string;
}

export function DebateView({ rounds, consensus, summary }: DebateViewProps) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  const personas = getPersonasByIds(Array.from(new Set(rounds.map((r) => r.speakerId))));
  const personaMap = Object.fromEntries(personas.map((p) => [p.id, p]));

  const groupedByRound = rounds.reduce((acc, turn) => {
    if (!acc[turn.round]) acc[turn.round] = [];
    acc[turn.round].push(turn);
    return acc;
  }, {} as Record<number, DebateRound[]>);

  const maxRound = Math.max(...Object.keys(groupedByRound).map(Number));

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: maxRound + 1 }).map((_, i) => {
          const hasContent = groupedByRound[i]?.length > 0;
          return (
            <motion.div
              key={i}
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-300',
                hasContent ? 'bg-prism-blue' : 'bg-bg-elevated',
                expandedRound === i && 'ring-2 ring-prism-blue ring-offset-2 ring-offset-bg-base'
              )}
              animate={hasContent ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            />
          );
        })}
        <span className="text-xs text-text-muted ml-2">
          {maxRound + 1}轮对话
        </span>
      </div>

      {/* Rounds */}
      {Object.entries(groupedByRound)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([roundStr, turnRound]) => {
          const round = Number(roundStr);
          const isRound0 = round === 0;

          return (
            <motion.div
              key={round}
              className={cn(
                'rounded-2xl border overflow-hidden transition-all duration-300',
                expandedRound === round
                  ? 'border-prism-blue/50 bg-bg-surface'
                  : 'border-border-subtle bg-bg-surface/50'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: round * 0.1 }}
            >
              {/* Round header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedRound(expandedRound === round ? null : round)}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                    isRound0 ? 'bg-prism-blue/20 text-prism-blue' : 'bg-bg-elevated text-text-secondary'
                  )}
                >
                  {isRound0 ? '开场' : `R${round}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {turnRound.map((t) => personaMap[t.speakerId]?.nameZh ?? t.speakerId).join(' · ')}
                  </div>
                  <div className="text-xs text-text-muted line-clamp-1">
                    {turnRound[0]?.content.slice(0, 60)}...
                  </div>
                </div>
                <div
                  className={cn(
                    'w-4 h-4 rounded border border-border-subtle transition-transform duration-200',
                    expandedRound === round && 'rotate-45 bg-prism-blue border-prism-blue'
                  )}
                />
              </button>

              {/* Round content */}
              <AnimatePresence>
                {expandedRound === round && (
                  <motion.div
                    className="px-4 pb-4 space-y-4"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {turnRound.map((turn) => {
                      const persona = personaMap[turn.speakerId];
                      if (!persona) return null;

                      return (
                        <div key={`${round}-${turn.speakerId}`} className="flex gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                            style={{
                              background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
                            }}
                          >
                            {persona.nameZh.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">{persona.nameZh}</span>
                              {turn.targets && turn.targets.length > 0 && (
                                <span className="text-xs text-text-muted">
                                  →{' '}
                                  {turn.targets
                                    .map((t) => personaMap[t]?.nameZh ?? t)
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-text-secondary leading-relaxed">
                              {turn.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

      {/* Consensus */}
      {consensus && (
        <motion.div
          className="rounded-2xl p-6 border border-prism-green/30 bg-gradient-to-br from-bg-surface to-prism-green/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-prism-green/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-prism-green" />
            </div>
            <h3 className="font-semibold">辩论共识</h3>
            <span className="text-xs text-text-muted ml-auto">
              置信度 {Math.round(consensus.strength * 100)}%
            </span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {consensus.text}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-text-muted">共识达成:</span>
            {consensus.agreedBy.map((id) => {
              const p = personaMap[id];
              return p ? (
                <span
                  key={id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${p.accentColor}20`,
                    color: p.accentColor,
                  }}
                >
                  {p.nameZh}
                </span>
              ) : null;
            })}
          </div>
        </motion.div>
      )}

      {/* Summary */}
      {summary && (
        <div className="rounded-xl p-4 bg-bg-elevated/50 border border-border-subtle">
          <div className="text-xs text-text-muted mb-2">辩论摘要</div>
          <p className="text-sm text-text-secondary leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}
