'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PERSONA_LIST, getPersonasByIds } from '@/lib/personas';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import {
  Brain, Sparkles, Users, Compass, Target, MessageSquare,
  Zap, BookOpen, ChevronDown, X
} from 'lucide-react';

// ─── Mode visual config ────────────────────────────────────────────────────────
const MODE_VISUAL: Record<Mode, {
  emoji: string;
  icon: React.ReactNode;
  gradient: { from: string; to: string };
  glow: string;
  accentText: string;
  badge: string;
}> = {
  solo: {
    emoji: '👤',
    icon: <Brain className="w-4 h-4" />,
    gradient: { from: '#6366f1', to: '#818cf8' },
    glow: 'rgba(99,102,241,0.35)',
    accentText: '#a5b4fc',
    badge: '认知',
  },
  prism: {
    emoji: '🔺',
    icon: <Sparkles className="w-4 h-4" />,
    gradient: { from: '#8b5cf6', to: '#c084fc' },
    glow: 'rgba(139,92,246,0.35)',
    accentText: '#d8b4fe',
    badge: '折射',
  },
  roundtable: {
    emoji: '🏛️',
    icon: <Users className="w-4 h-4" />,
    gradient: { from: '#0ea5e9', to: '#38bdf8' },
    glow: 'rgba(14,165,233,0.35)',
    accentText: '#7dd3fc',
    badge: '辩论',
  },
  epoch: {
    emoji: '⚔️',
    icon: <Compass className="w-4 h-4" />,
    gradient: { from: '#ef4444', to: '#f87171' },
    glow: 'rgba(239,68,68,0.35)',
    accentText: '#fca5a5',
    badge: '交锋',
  },
  mission: {
    emoji: '🎯',
    icon: <Target className="w-4 h-4" />,
    gradient: { from: '#10b981', to: '#34d399' },
    glow: 'rgba(16,185,129,0.35)',
    accentText: '#6ee7b7',
    badge: '协作',
  },
  council: {
    emoji: '🎩',
    icon: <MessageSquare className="w-4 h-4" />,
    gradient: { from: '#f59e0b', to: '#fbbf24' },
    glow: 'rgba(245,158,11,0.35)',
    accentText: '#fcd34d',
    badge: '顾问',
  },
  oracle: {
    emoji: '🔮',
    icon: <Zap className="w-4 h-4" />,
    gradient: { from: '#a855f7', to: '#d946ef' },
    glow: 'rgba(168,85,247,0.35)',
    accentText: '#e9d5ff',
    badge: '洞察',
  },
  fiction: {
    emoji: '📖',
    icon: <BookOpen className="w-4 h-4" />,
    gradient: { from: '#ec4899', to: '#f472b6' },
    glow: 'rgba(236,72,153,0.35)',
    accentText: '#f9a8d4',
    badge: '创意',
  },
};

interface ModeButtonBarProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  selectedIds: string[];
  onTogglePersona: (id: string) => void;
  pickerOpen: boolean;
  onPickerOpen: (open: boolean) => void;
  /** @deprecated No longer needed — all 8 modes are always visible */
  onModePickerOpen?: () => void;
  /** Minimum participants for the current mode */
  minParticipants?: number;
}

export function ModeButtonBar({
  mode,
  onModeChange,
  selectedIds,
  onTogglePersona,
  pickerOpen,
  onPickerOpen,
  minParticipants = 1,
}: ModeButtonBarProps) {
  const selectedPersonas = getPersonasByIds(selectedIds);

  return (
    <div className="flex-shrink-0 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
      {/* ── Mode cards strip ─────────────────────────────────────── */}
      <div className="overflow-x-auto scrollbar-none px-3 py-2">
        <div className="flex items-center gap-2 min-w-max">
          {Object.values(MODES).map((m) => {
            const visual = MODE_VISUAL[m.id];
            const isActive = mode === m.id;

            return (
              <motion.button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'relative flex-shrink-0 rounded-xl px-3 py-2 text-left transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'ring-1 ring-white/20 shadow-lg'
                    : 'ring-1 ring-white/5 hover:ring-white/10 hover:bg-white/5'
                )}
                style={{
                  background: isActive
                    ? `linear-gradient(145deg, ${visual.gradient.from}30, ${visual.gradient.to}15)`
                    : `linear-gradient(145deg, ${visual.gradient.from}12, ${visual.gradient.to}05)`,
                  boxShadow: isActive ? `0 0 16px ${visual.glow}, 0 2px 8px rgba(0,0,0,0.2)` : undefined,
                  minWidth: '110px',
                }}
              >
                {/* Active indicator bar */}
                <div
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-200"
                  style={{
                    background: `linear-gradient(90deg, ${visual.gradient.from}, ${visual.gradient.to})`,
                    opacity: isActive ? 1 : 0,
                  }}
                />

                {/* Glow orb for active */}
                {isActive && (
                  <div
                    className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${visual.gradient.from}, transparent)` }}
                  />
                )}

                <div className="relative z-10">
                  {/* Top: emoji + badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        background: isActive
                          ? `linear-gradient(145deg, ${visual.gradient.from}40, ${visual.gradient.to}20)`
                          : `${visual.gradient.from}18`,
                        color: visual.accentText,
                      }}
                    >
                      {visual.icon}
                    </div>
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: `${visual.gradient.from}20`,
                        color: visual.accentText,
                        opacity: isActive ? 1 : 0.7,
                      }}
                    >
                      {visual.badge}
                    </span>
                  </div>

                  {/* Mode name */}
                  <div
                    className="text-xs font-semibold mb-0.5 leading-tight"
                    style={{ color: isActive ? visual.accentText : 'rgba(255,255,255,0.7)' }}
                  >
                    {m.label}
                  </div>

                  {/* Tagline */}
                  <div
                    className="text-[10px] leading-tight"
                    style={{ color: isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)' }}
                  >
                    {m.tagline}
                  </div>

                  {/* Participants */}
                  <div
                    className="text-[9px] mt-1.5 font-medium"
                    style={{ color: `${visual.gradient.from}80` }}
                  >
                    {m.minParticipants}-{m.maxParticipants}人
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Persona row ──────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-border-subtle flex items-center gap-3 overflow-x-auto scrollbar-none">
        <button
          className={cn(
            'flex items-center gap-2 text-xs transition-colors px-2 py-1 rounded-lg flex-shrink-0',
            pickerOpen
              ? 'text-text-primary bg-bg-surface'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
          )}
          onClick={() => onPickerOpen(!pickerOpen)}
        >
          <span className="text-[11px]">人物</span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', pickerOpen ? 'rotate-180' : '')} />
        </button>

        {/* Selected personas — individual chips with name + X */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {selectedPersonas.map((p) => {
            const isLast = selectedIds[selectedIds.length - 1] === p.id;
            const canDeselect = selectedIds.length > minParticipants;
            return (
              <div
                key={p.id}
                className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full border flex-shrink-0 text-xs transition-all"
                style={{
                  borderColor: `${p.accentColor}50`,
                  background: `${p.accentColor}10`,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
                >
                  {p.nameZh?.slice(0, 1)}
                </div>
                <span style={{ color: p.accentColor }} className="font-medium whitespace-nowrap">
                  {p.nameZh}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canDeselect) {
                      onTogglePersona(p.id);
                    }
                  }}
                  disabled={!canDeselect}
                  title={canDeselect ? `移除 ${p.nameZh}` : '至少需要保留 1 人'}
                  className={cn(
                    'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                    canDeselect
                      ? 'text-text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer'
                      : 'text-text-muted/30 cursor-not-allowed'
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Total count badge */}
        <span className="text-[11px] text-text-muted flex-shrink-0 ml-1">
          共{selectedIds.length}人
        </span>
      </div>
    </div>
  );
}
