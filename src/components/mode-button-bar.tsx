'use client';

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERSONA_LIST, getPersonasByIds } from '@/lib/personas';
import type { Mode } from '@/lib/types';

// ─── Mode definitions (inline — avoids module resolution issues) ─────────────────
const MODES = [
  { id: 'solo' as Mode, label: '单人对话', icon: '👤', accent: '#6366f1', maxP: 1 },
  { id: 'prism' as Mode, label: '折射视图', icon: '🔺', accent: '#8b5cf6', maxP: 3 },
  { id: 'roundtable' as Mode, label: '圆桌辩论', icon: '🏛️', accent: '#0ea5e9', maxP: 6 },
  { id: 'epoch' as Mode, label: '关公战秦琼', icon: '⚔️', accent: '#ef4444', maxP: 2 },
  { id: 'mission' as Mode, label: '任务模式', icon: '🎯', accent: '#10b981', maxP: 6 },
  { id: 'council' as Mode, label: '顾问团', icon: '🎩', accent: '#f59e0b', maxP: 4 },
  { id: 'oracle' as Mode, label: '预言家', icon: '🔮', accent: '#a855f7', maxP: 2 },
  { id: 'fiction' as Mode, label: '共创故事', icon: '📖', accent: '#ec4899', maxP: 3 },
];

interface ModeButtonBarProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  selectedIds: string[];
  onTogglePersona: (id: string) => void;
  pickerOpen: boolean;
  onPickerOpen: (open: boolean) => void;
}

export function ModeButtonBar({
  mode,
  onModeChange,
  selectedIds,
  onTogglePersona,
  pickerOpen,
  onPickerOpen,
}: ModeButtonBarProps) {
  const selectedPersonas = getPersonasByIds(selectedIds);

  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {/* Mode buttons */}
        {MODES.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              title={m.label}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-surface'
              )}
              style={isActive ? { background: m.accent } : undefined}
            >
              <span>{m.icon}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}

        <div className="w-px h-5 bg-border-subtle mx-1 flex-shrink-0" />

        {/* Persona picker toggle */}
        <button
          className={cn(
            'flex items-center gap-2 text-sm transition-colors px-2 py-1.5 rounded flex-shrink-0',
            pickerOpen
              ? 'text-text-primary bg-bg-surface'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
          )}
          onClick={() => onPickerOpen(!pickerOpen)}
        >
          <div className="flex -space-x-1">
            {selectedPersonas.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="w-5 h-5 rounded-full border-2 border-bg-base flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
              >
                {p.nameZh?.slice(0, 1)}
              </div>
            ))}
            {selectedIds.length > 3 && (
              <div className="w-5 h-5 rounded-full border-2 border-bg-base bg-bg-elevated flex items-center justify-center text-[9px] font-bold text-text-muted">
                +{selectedIds.length - 3}
              </div>
            )}
          </div>
          <span className="text-xs text-text-muted hidden sm:inline">
            {selectedIds.length}人
          </span>
          {pickerOpen ? (
            <X className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
