'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { trackModeSwitch } from '@/lib/use-tracking';
import { X } from 'lucide-react';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  participantCount?: number;
  /** If true, the selector is shown as a full-screen overlay */
  fullScreen?: boolean;
  /** Called when user wants to close (if not fullScreen) */
  onClose?: () => void;
}

const MODE_CATEGORIES = [
  { id: 'cognitive', label: '认知型', labelEn: 'Cognitive', modes: ['solo', 'prism'] as Mode[] },
  { id: 'dialogue', label: '对话型', labelEn: 'Dialogue', modes: ['roundtable', 'epoch'] as Mode[] },
  { id: 'output', label: '产出型', labelEn: 'Output', modes: ['mission', 'council'] as Mode[] },
  { id: 'creative', label: '洞察/创意', labelEn: 'Insight & Creative', modes: ['oracle', 'fiction'] as Mode[] },
];

export function ModeSelector({ value, onChange, fullScreen = false, onClose }: ModeSelectorProps) {
  const [selected, setSelected] = useState<Mode>(value);
  const currentMode = MODES[value];

  // Sync internal state when external value changes
  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleConfirm = () => {
    if (selected !== value) {
      trackModeSwitch(value, selected);
      onChange(selected);
    }
    onClose?.();
  };

  const handleSelect = (modeId: Mode) => {
    setSelected(modeId);
  };

  const panel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-text-primary">选择对话模式</h2>
          {fullScreen && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-bg-base hover:bg-bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-text-muted">
          当前：
          <span className="ml-1.5 inline-flex items-center gap-1 text-prism-blue font-medium">
            <span>{currentMode.icon}</span>
            {currentMode.label}
          </span>
          <span className="text-text-muted"> — {currentMode.description}</span>
        </p>
      </div>

      {/* Mode cards by category */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {MODE_CATEGORIES.map((category, catIdx) => (
          <div key={category.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{category.labelEn}</span>
              <span className="text-xs text-text-muted/60">{category.label}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {category.modes.map((modeId) => {
                const mode = MODES[modeId];
                const isActive = selected === modeId;
                const isCurrent = value === modeId;

                return (
                  <motion.button
                    key={modeId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: catIdx * 0.05 }}
                    onClick={() => handleSelect(modeId)}
                    className={cn(
                      'relative text-left p-4 rounded-2xl border-2 transition-all duration-200',
                      'hover:scale-[1.01] active:scale-[0.99]',
                      isActive
                        ? 'border-opacity-100'
                        : 'border-border-subtle hover:border-border-medium bg-bg-surface',
                    )}
                    style={{
                      borderColor: isActive ? mode.accent : undefined,
                      background: isActive ? `${mode.accent}08` : undefined,
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div
                        className="absolute top-3 right-3 w-2 h-2 rounded-full"
                        style={{ background: mode.accent }}
                      />
                    )}

                    {/* Current badge */}
                    {isCurrent && !isActive && (
                      <div className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded bg-bg-base text-text-muted">
                        当前
                      </div>
                    )}

                    {/* Icon + label */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-2xl">{mode.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{mode.label}</div>
                        <div className="text-xs text-text-muted">{mode.labelEn}</div>
                      </div>
                    </div>

                    {/* Tagline */}
                    <div
                      className="text-xs font-medium mb-2 italic"
                      style={{ color: mode.accent }}
                    >
                      {mode.tagline}
                    </div>

                    {/* Description */}
                    <div className="text-xs text-text-secondary leading-relaxed mb-3">
                      {mode.description}
                    </div>

                    {/* When to use */}
                    <div className="text-xs text-text-muted">
                      <span className="text-text-muted/70">何时用：</span>
                      <span>{mode.when}</span>
                    </div>

                    {/* Participant range */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-muted/60">参与人数</span>
                      <span className="text-[10px] text-text-muted">
                        {mode.minParticipants === mode.maxParticipants
                          ? `${mode.minParticipants}人`
                          : `${mode.minParticipants}-${mode.maxParticipants}人`}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer confirm */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-border-subtle bg-bg-surface/50">
        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={selected === value}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              selected === value
                ? 'bg-bg-base text-text-muted cursor-not-allowed'
                : 'bg-prism-blue text-white hover:bg-prism-blue/90 active:scale-[0.98]',
            )}
          >
            {selected === value ? `当前使用中 — ${MODES[value].label}` : `切换为 ${MODES[selected].label}`}
          </button>
          {onClose && selected === value && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-bg-base text-text-secondary hover:bg-bg-surface transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[500] bg-bg-base/95 backdrop-blur-md">
        <div className="h-full max-w-3xl mx-auto">
          {panel}
        </div>
      </div>
    );
  }

  // Inline dropdown version (for header use — smaller cards)
  return panel;
}

/** Compact trigger button + dropdown for use in the chat header */
interface CompactModeTriggerProps {
  value: Mode;
  onOpen: () => void;
}

export function CompactModeTrigger({ value, onOpen }: CompactModeTriggerProps) {
  const mode = MODES[value];
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface border border-transparent hover:border-border-subtle transition-all"
    >
      <span>{mode.icon}</span>
      <span className="hidden sm:inline text-xs font-medium">{mode.label}</span>
    </button>
  );
}
