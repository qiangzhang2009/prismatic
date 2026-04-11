'use client';

import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  participantCount?: number;
}

export function ModeSelector({ value, onChange, participantCount = 1 }: ModeSelectorProps) {
  const getRecommendedModes = () => {
    if (participantCount === 1) return ['solo'];
    if (participantCount === 2 || participantCount === 3) return ['prism', 'mission'];
    if (participantCount >= 4) return ['roundtable', 'mission'];
    return [];
  };

  const recommended = getRecommendedModes();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-1 rounded-xl bg-bg-elevated border border-border-subtle">
        {Object.values(MODES).map((mode) => {
          const isActive = value === mode.id;
          const isRecommended = recommended.includes(mode.id);

          return (
            <motion.button
              key={mode.id}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
              onClick={() => onChange(mode.id as Mode)}
              whileTap={{ scale: 0.97 }}
            >
              <span>{mode.icon}</span>
              <span className="hidden sm:inline">{mode.label}</span>

              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(77,150,255,0.15), rgba(199,125,255,0.15))',
                    border: '1px solid rgba(77,150,255,0.3)',
                  }}
                  layoutId="mode-active"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {isRecommended && !isActive && (
                <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0.5 rounded bg-prism-blue/20 text-prism-blue">
                  推荐
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Mode guide — shows when to use this mode */}
      <motion.div
        key={value}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border-subtle bg-bg-surface/80 px-4 py-3"
      >
        {(() => {
          const mode = Object.values(MODES).find(m => m.id === value)!;
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{mode.icon}</span>
                <span className="font-medium text-sm">{mode.label}</span>
                <span className="text-xs text-text-muted ml-auto">{mode.minParticipants}-{mode.maxParticipants}人</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                <span className="text-prism-blue font-medium">何时用：</span>{mode.when}
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                <span className="text-prism-purple font-medium">如何运行：</span>{mode.how}
              </p>
            </div>
          );
        })()}
      </motion.div>
    </div>
  );
}
