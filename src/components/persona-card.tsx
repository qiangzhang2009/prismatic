'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn, hexToRgba } from '@/lib/utils';
import type { Persona } from '@/lib/types';
import { trackPersonaView } from '@/lib/use-tracking';

interface PersonaCardProps {
  persona: Persona;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
  showGradient?: boolean;
  confidence?: number;
  showDistillBadge?: boolean;
  distillGrade?: string;
  distillScore?: number;
}

export function PersonaCard({
  persona,
  compact = false,
  selected = false,
  onClick,
  showGradient = true,
  showDistillBadge,
}: PersonaCardProps) {
  const gradient = showGradient
    ? `linear-gradient(135deg, ${persona.gradientFrom}18, ${persona.gradientTo}18)`
    : undefined;

  if (compact) {
    return (
      <motion.button
        className={cn(
          'relative rounded-xl p-4 text-left transition-all duration-200 cursor-pointer',
          'border h-[96px]',
          selected
            ? 'border-opacity-60 prism-border'
            : 'border-border-subtle hover:border-border-medium bg-bg-surface',
          onClick ? 'w-full' : ''
        )}
        style={{ background: gradient }}
        onClick={onClick}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
            style={{
              background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
              color: '#fff',
            }}
          >
            {persona.nameZh?.slice(0, 1) ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{persona.nameZh || persona.name || '?'}</div>
            <div className="text-xs text-text-muted truncate">{persona.taglineZh || ''}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(persona.domain ?? []).slice(0, 2).map((d) => (
            <span
              key={d}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
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

  return (
    <Link
      href={`/personas/${persona.slug}`}
      onClick={() => {
        trackPersonaView(persona.id, persona.nameZh, persona.domain?.[0]);
      }}
      className="block h-[320px]"
    >
      <motion.div
        className="persona-card cursor-pointer h-full flex flex-col"
        style={{ background: gradient }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header: avatar + name + tagline */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3 flex-shrink-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
              color: '#fff',
            }}
          >
            {persona.nameZh?.slice(0, 1) ?? '?'}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-semibold text-base leading-snug">{persona.nameZh || persona.name || '?'}</h3>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5 line-clamp-2">{persona.taglineZh || persona.tagline || ''}</p>
          </div>
        </div>

        {/* Brief — fixed height */}
        <div className="px-4 flex-shrink-0">
          <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-2">
            {persona.briefZh || persona.brief || ''}
          </p>
        </div>

        {/* Mental Models — flex-grow, overflow hidden */}
        <div className="px-4 py-3 flex-1 overflow-hidden">
          {persona.mentalModels && persona.mentalModels.length > 0 ? (
            <div className="space-y-1.5">
              {(persona.mentalModels ?? []).slice(0, 2).map((model: any) => (
                <div key={model.id} className="flex items-start gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: persona.accentColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium leading-tight block" style={{ color: persona.accentColor }}>
                      {model.nameZh}
                    </span>
                    <span className="text-[10px] text-text-muted leading-snug block line-clamp-1">
                      {model.oneLiner}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-[11px] text-text-muted">暂无心智模型</span>
            </div>
          )}
        </div>

        {/* Domain tags — fixed at bottom */}
        <div className="px-4 pb-3 flex-shrink-0 border-t border-border-subtle pt-2.5 mt-auto">
          <div className="flex flex-wrap gap-1.5">
            {(persona.domain ?? []).map((d) => (
              <span
                key={d}
                className="text-[10px] px-2 py-0.5 rounded-md border"
                style={{ borderColor: `${persona.accentColor}40`, color: persona.accentColor }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          className="h-0.5 rounded-b-xl flex-shrink-0"
          style={{ background: `linear-gradient(90deg, ${persona.gradientFrom}, ${persona.gradientTo})` }}
        />
      </motion.div>
    </Link>
  );
}
