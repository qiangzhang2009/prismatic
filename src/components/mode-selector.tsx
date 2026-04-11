'use client';

import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { motion } from 'framer-motion';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  participantCount?: number;
}

export function ModeSelector({ value, onChange, participantCount = 1 }: ModeSelectorProps) {
  const getRecommendedModes = () => {
    if (participantCount === 1) return ['solo'];
    if (participantCount === 2 || participantCount === 3) return ['prism'];
    if (participantCount >= 4) return ['roundtable', 'mission'];
    return [];
  };

  const recommended = getRecommendedModes();

  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-bg-elevated border border-border-subtle">
      {Object.values(MODES).map((mode) => {
        const isActive = value === mode.id;
        const isRecommended = recommended.includes(mode.id);

        return (
          <motion.button
            key={mode.id}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
            )}
            onClick={() => onChange(mode.id as Mode)}
            whileTap={{ scale: 0.97 }}
          >
            <span>{mode.icon}</span>
            <span className="hidden sm:inline">{mode.label}</span>

            {/* Active indicator */}
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

            {/* Recommended badge */}
            {isRecommended && !isActive && (
              <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0.5 rounded bg-prism-blue/20 text-prism-blue">
                推荐
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
