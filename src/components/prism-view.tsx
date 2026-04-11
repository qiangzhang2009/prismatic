/**
 * Prismatic — Prism View Component
 * Multi-perspective analysis display
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPersonasByIds } from '@/lib/personas';
import type { Persona } from '@/lib/types';

interface PrismViewProps {
  perspectives: {
    personaId: string;
    content: string;
    confidence: number;
    mentalModelUsed?: string;
  }[];
  synthesis?: string;
  loading?: boolean;
}

export function PrismView({ perspectives, synthesis, loading }: PrismViewProps) {
  const personas = getPersonasByIds(perspectives.map((p) => p.personaId));

  return (
    <div className="space-y-6">
      {/* Perspective panels */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(perspectives.length, 3)}, 1fr)`,
        }}
      >
        {perspectives.map((perspective, index) => {
          const persona = personas.find((p) => p.id === perspective.personaId);
          if (!persona) return null;

          return (
            <motion.div
              key={perspective.personaId}
              className="prism-panel"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              {/* Header */}
              <div className="prism-panel-header">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
                  }}
                >
                  {persona.nameZh.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{persona.nameZh}</div>
                  {perspective.mentalModelUsed && (
                    <div className="text-xs text-text-muted truncate">
                      {perspective.mentalModelUsed}
                    </div>
                  )}
                </div>
                {/* Confidence */}
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full bg-bg-elevated overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: persona.accentColor }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${perspective.confidence * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right">
                    {Math.round(perspective.confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="prism-panel-content">
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                    {perspective.content}
                  </div>
                </div>
              </div>

              {/* Gradient accent */}
              <div
                className="h-0.5"
                style={{
                  background: `linear-gradient(90deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Synthesis */}
      {synthesis && (
        <motion.div
          className="rounded-2xl p-6 border border-border-subtle bg-gradient-to-br from-bg-surface to-bg-elevated"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: perspectives.length * 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-prism-green" />
            <h3 className="font-medium text-sm">综合分析</h3>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
              {synthesis}
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-text-muted">
            <motion.div
              className="w-2 h-2 rounded-full bg-prism-blue"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.div
              className="w-2 h-2 rounded-full bg-prism-purple"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.1 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full bg-prism-cyan"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <span className="text-sm ml-2">折射分析中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
