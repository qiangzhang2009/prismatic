'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { trackModeSwitch } from '@/lib/use-tracking';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  participantCount?: number;
}

export function ModeSelector({ value, onChange, participantCount = 1 }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const getRecommendedModes = () => {
    if (participantCount === 1) return ['solo'];
    if (participantCount === 2 || participantCount === 3) return ['prism', 'mission'];
    if (participantCount >= 4) return ['roundtable', 'mission'];
    return [];
  };

  const recommended = getRecommendedModes();
  const currentMode = Object.values(MODES).find((m) => m.id === value)!;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        openRef.current = false;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (modeId: Mode) => {
    if (modeId !== value) trackModeSwitch(value, modeId);
    openRef.current = false;
    setOpen(false);
    onChange(modeId);
  };

  return (
    <div ref={ref} className="relative">
      {/* Compact mode toggle button */}
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
          open
            ? 'bg-bg-surface border border-prism-blue/50 text-text-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface border border-transparent'
        )}
        onClick={() => {
          openRef.current = !open;
          setOpen(!open);
        }}
      >
        <span>{currentMode.icon}</span>
        <span className="hidden sm:inline text-xs">{currentMode.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-64 bg-bg-elevated border border-border-subtle rounded-xl shadow-2xl z-[300] overflow-hidden"
          >
            {/* Current mode description */}
            <div className="px-4 py-3 border-b border-border-subtle bg-bg-surface/50">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{currentMode.icon}</span>
                <span className="text-sm font-semibold text-text-primary">{currentMode.label}</span>
                <span className="ml-auto text-xs text-text-muted">{currentMode.minParticipants}-{currentMode.maxParticipants}人</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                <span className="text-prism-blue">何时用：</span>{currentMode.when}
              </p>
              <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                <span className="text-prism-purple">如何运行：</span>{currentMode.how}
              </p>
            </div>

            {/* Mode options */}
            <div className="py-1">
              {Object.values(MODES).map((mode) => {
                const isActive = value === mode.id;
                const isRecommended = recommended.includes(mode.id as Mode);

                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSelect(mode.id as Mode)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-prism-blue/10'
                        : 'hover:bg-bg-surface'
                    )}
                  >
                    <span className="text-base flex-shrink-0">{mode.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', isActive ? 'text-text-primary' : 'text-text-secondary')}>
                          {mode.label}
                        </span>
                        {isRecommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-prism-blue/15 text-prism-blue">推荐</span>
                        )}
                        {isActive && (
                          <Check className="w-3.5 h-3.5 text-prism-blue ml-auto flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 leading-snug">
                        {mode.minParticipants}-{mode.maxParticipants}人 · {mode.when.slice(0, 20)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
