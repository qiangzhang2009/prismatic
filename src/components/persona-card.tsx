'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn, hexToRgba } from '@/lib/utils';
import type { Persona } from '@/lib/types';

interface PersonaCardProps {
  persona: Persona;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
  showGradient?: boolean;
}

export function PersonaCard({
  persona,
  compact = false,
  selected = false,
  onClick,
  showGradient = true,
}: PersonaCardProps) {
  const gradient = showGradient
    ? `linear-gradient(135deg, ${persona.gradientFrom}22, ${persona.gradientTo}22)`
    : undefined;

  if (compact) {
    return (
      <motion.button
        className={cn(
          'relative rounded-xl p-4 text-left transition-all duration-200 cursor-pointer',
          'border',
          selected
            ? 'border-opacity-60 prism-border'
            : 'border-border-subtle hover:border-border-medium bg-bg-surface',
          onClick ? 'w-full' : ''
        )}
        style={{ background: gradient }}
        onClick={onClick}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
            style={{
              background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
              color: '#fff',
            }}
          >
            {persona.nameZh.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{persona.nameZh}</div>
            <div className="text-xs text-text-muted truncate">{persona.taglineZh}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {persona.domain.slice(0, 2).map((d) => (
            <span
              key={d}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: hexToRgba(persona.accentColor, 0.15), color: persona.accentColor }}
            >
              {d}
            </span>
          ))}
        </div>
        {selected && (
          <motion.div
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{ backgroundColor: persona.accentColor }}
            layoutId="selected-dot"
          />
        )}
      </motion.button>
    );
  }

  // Full card — link to detail page
  return (
    <Link href={`/personas/${persona.slug}`}>
      <motion.div
        className="persona-card cursor-pointer"
        style={{ background: gradient }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
              color: '#fff',
            }}
          >
            {persona.nameZh.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg mb-1">{persona.nameZh}</h3>
            <p className="text-xs text-text-muted">{persona.taglineZh}</p>
          </div>
        </div>

        <p className="text-sm text-text-secondary mb-4 line-clamp-3">{persona.briefZh}</p>

        <div className="space-y-2 mb-4">
          {persona.mentalModels.slice(0, 2).map((model) => (
            <div key={model.id} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: persona.accentColor }} />
              <div className="min-w-0">
                <span className="text-xs font-medium" style={{ color: persona.accentColor }}>
                  {model.nameZh}
                </span>
                <p className="text-xs text-text-muted line-clamp-1">{model.oneLiner}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {persona.domain.map((d) => (
            <span
              key={d}
              className="text-xs px-2 py-1 rounded-md border"
              style={{ borderColor: `${persona.accentColor}40`, color: persona.accentColor }}
            >
              {d}
            </span>
          ))}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
          style={{ background: `linear-gradient(90deg, ${persona.gradientFrom}, ${persona.gradientTo})` }}
        />
      </motion.div>
    </Link>
  );
}

