/**
 * Prismatic — Prism View Component
 * Multi-perspective analysis display with structured synthesis
 */

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPersonasByIds } from '@/lib/personas';
import type { Persona } from '@/lib/types';

interface SynthesisData {
  id?: string;
  content: string;
  timestamp?: string;
  _usage?: any;
  isPrediction?: boolean;
}

interface PrismViewProps {
  perspectives: {
    personaId: string;
    content: string;
    confidence: number;
    mentalModelUsed?: string;
  }[];
  synthesis?: SynthesisData;
  loading?: boolean;
}

interface SynthesisSection {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  content: string;
}

// Parse structured synthesis content into sections
function parseSynthesis(content: string): SynthesisSection[] {
  const sections: SynthesisSection[] = [];

  const consensusMatch = content.match(/## 共识\n([\s\S]*?)(?=## |$)/i);
  if (consensusMatch) {
    sections.push({
      label: '共识',
      icon: '🤝',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      content: consensusMatch[1].trim(),
    });
  }

  const disagreementMatch = content.match(/## 分歧\n([\s\S]*?)(?=## |$)/i);
  if (disagreementMatch) {
    sections.push({
      label: '分歧',
      icon: '⚡',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      content: disagreementMatch[1].trim(),
    });
  }

  const blindspotMatch = content.match(/## 盲点\n([\s\S]*?)(?=## |$)/i);
  if (blindspotMatch) {
    sections.push({
      label: '盲点',
      icon: '👁️',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/20',
      content: blindspotMatch[1].trim(),
    });
  }

  const futureMatch = content.match(/## 未来视角\n([\s\S]*?)(?=## |$)/i);
  if (futureMatch) {
    sections.push({
      label: '未来视角',
      icon: '🔮',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      content: futureMatch[1].trim(),
    });
  }

  // Fallback: treat entire content as single section
  if (sections.length === 0 && content.trim()) {
    sections.push({
      label: '综合分析',
      icon: '✨',
      color: 'text-prism-blue',
      bgColor: 'bg-prism-blue/10 border-prism-blue/20',
      content: content.trim(),
    });
  }

  return sections;
}

export function PrismView({ perspectives, synthesis, loading }: PrismViewProps) {
  const personas = getPersonasByIds(perspectives.map((p) => p.personaId));
  const synthesisSections = synthesis ? parseSynthesis(synthesis.content) : [];

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

      {/* Enhanced Synthesis — Structured sections */}
      {synthesisSections.length > 0 && (
        <motion.div
          className="rounded-2xl p-6 border border-border-subtle bg-gradient-to-br from-bg-surface to-bg-elevated"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: perspectives.length * 0.1 }}
        >
          {/* Synthesis header */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-prism-green" />
            <h3 className="font-medium text-sm">
              {synthesis?.isPrediction ? '折射洞察 + 未来判断' : '折射洞察'}
            </h3>
            {synthesis?.isPrediction && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                🔮 含未来视角
              </span>
            )}
          </div>

          {/* Structured sections */}
          <div className="space-y-3">
            {synthesisSections.map((section, index) => (
              <motion.div
                key={section.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: perspectives.length * 0.1 + index * 0.08 }}
                className={cn(
                  'rounded-xl p-4 border',
                  section.bgColor
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">{section.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-semibold mb-1.5', section.color)}>
                      {section.label}
                    </div>
                    <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                      {section.content}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
