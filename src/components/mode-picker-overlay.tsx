'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { trackModeSwitch } from '@/lib/use-tracking';
import {
  X, Brain, Sparkles, Users, Compass, Target, MessageSquare,
  Zap, BookOpen, ChevronRight, Sparkle
} from 'lucide-react';

interface ModePickerOverlayProps {
  isOpen: boolean;
  currentMode: Mode;
  onSelect: (mode: Mode) => void;
  onClose: () => void;
}

// 8种模式的大卡片配置 — 多彩渐变 + 丰富视觉
const MODE_CARDS: Record<Mode, {
  icon: React.ReactNode;
  emoji: string;
  gradient: { from: string; to: string; via?: string };
  glowColor: string;
  borderColor: string;
  badge: string;
  scenarios: string[];
  accentText: string;
}> = {
  solo: {
    icon: <Brain className="w-10 h-10" />,
    emoji: '👤',
    gradient: { from: '#6366f1', to: '#818cf8', via: '#4f46e5' },
    glowColor: 'rgba(99,102,241,0.4)',
    borderColor: 'rgba(99,102,241,0.3)',
    badge: '认知',
    scenarios: ['深入学习一个思想家的思维方式', '遇到困惑需要大师指点', '建立持续的学习对话'],
    accentText: '#a5b4fc',
  },
  prism: {
    icon: <Sparkles className="w-10 h-10" />,
    emoji: '🔺',
    gradient: { from: '#8b5cf6', to: '#c084fc', via: '#7c3aed' },
    glowColor: 'rgba(139,92,246,0.4)',
    borderColor: 'rgba(139,92,246,0.3)',
    badge: '折射',
    scenarios: ['快速全面了解一个新领域', '需要多元视角综合分析', '寻找不同观点的交汇点'],
    accentText: '#d8b4fe',
  },
  roundtable: {
    icon: <Users className="w-10 h-10" />,
    emoji: '🏛️',
    gradient: { from: '#0ea5e9', to: '#38bdf8', via: '#0284c7' },
    glowColor: 'rgba(14,165,233,0.4)',
    borderColor: 'rgba(14,165,233,0.3)',
    badge: '辩论',
    scenarios: ['需要被挑战和质疑', '想找到思维漏洞和盲点', '让不同观点真正碰撞'],
    accentText: '#7dd3fc',
  },
  epoch: {
    icon: <Compass className="w-10 h-10" />,
    emoji: '⚔️',
    gradient: { from: '#ef4444', to: '#f87171', via: '#dc2626' },
    glowColor: 'rgba(239,68,68,0.4)',
    borderColor: 'rgba(239,68,68,0.3)',
    badge: '交锋',
    scenarios: ['两种截然不同的世界观交锋', '正反双方深度辩论', '历史与现实的对话'],
    accentText: '#fca5a5',
  },
  mission: {
    icon: <Target className="w-10 h-10" />,
    emoji: '🎯',
    gradient: { from: '#10b981', to: '#34d399', via: '#059669' },
    glowColor: 'rgba(16,185,129,0.4)',
    borderColor: 'rgba(16,185,129,0.3)',
    badge: '协作',
    scenarios: ['需要一个完整可执行的方案', '复杂任务需要多方分工协作', '追求最佳整合输出'],
    accentText: '#6ee7b7',
  },
  council: {
    icon: <MessageSquare className="w-10 h-10" />,
    emoji: '🎩',
    gradient: { from: '#f59e0b', to: '#fbbf24', via: '#d97706' },
    glowColor: 'rgba(245,158,11,0.4)',
    borderColor: 'rgba(245,158,11,0.3)',
    badge: '顾问',
    scenarios: ['重大决策需要多方专业意见', '寻求综合性建议', '从不同角度审视问题'],
    accentText: '#fcd34d',
  },
  oracle: {
    icon: <Zap className="w-10 h-10" />,
    emoji: '🔮',
    gradient: { from: '#a855f7', to: '#d946ef', via: '#9333ea' },
    glowColor: 'rgba(168,85,247,0.4)',
    borderColor: 'rgba(168,85,247,0.3)',
    badge: '洞察',
    scenarios: ['需要战略预判和未来视角', '看清事物发展的深层逻辑', '寻求先知般的洞察'],
    accentText: '#e9d5ff',
  },
  fiction: {
    icon: <BookOpen className="w-10 h-10" />,
    emoji: '📖',
    gradient: { from: '#ec4899', to: '#f472b6', via: '#db2777' },
    glowColor: 'rgba(236,72,153,0.4)',
    borderColor: 'rgba(236,72,153,0.3)',
    badge: '创意',
    scenarios: ['用故事形式理解思想', '沉浸式叙事体验', '角色扮演与创意探索'],
    accentText: '#f9a8d4',
  },
};

export function ModePickerOverlay({
  isOpen,
  currentMode,
  onSelect,
  onClose,
}: ModePickerOverlayProps) {
  const handleSelect = (modeId: Mode) => {
    if (modeId !== currentMode) {
      trackModeSwitch(currentMode, modeId);
      onSelect(modeId);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300]"
            onClick={onClose}
          />

          {/* Overlay content */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-4 top-[8%] z-[301] flex flex-col"
          >
            {/* Modal container */}
            <div className="flex-1 bg-[#0f0f18] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">

              {/* Decorative top glow bar */}
              <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
                <div className="w-full h-full flex">
                  {Object.values(MODE_CARDS).map((card) => (
                    <div
                      key={card.glowColor}
                      className="flex-1"
                      style={{ background: `linear-gradient(90deg, ${card.gradient.from}, ${card.gradient.to})` }}
                    />
                  ))}
                </div>
              </div>

              {/* Header */}
              <div className="flex-shrink-0 px-8 py-6 border-b border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                      <Sparkle className="w-5 h-5 text-white/70" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">选择体验模式</h2>
                      <p className="text-sm text-white/40 mt-0.5">
                        八种独特视角，遇见不一样的思考方式
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mode cards grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr">
                  {Object.values(MODES).map((mode, index) => {
                    const card = MODE_CARDS[mode.id];
                    const isCurrent = currentMode === mode.id;

                    return (
                      <motion.button
                        key={mode.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        whileHover={{ scale: 1.03, y: -4 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelect(mode.id as Mode)}
                        className={cn(
                          'relative text-left rounded-2xl p-5 overflow-hidden transition-all duration-300 cursor-pointer group',
                          isCurrent ? 'ring-2 ring-offset-2 ring-offset-[#0f0f18]' : 'ring-1 ring-white/5'
                        )}
                        style={{
                          background: `linear-gradient(145deg, ${card.gradient.from}18, ${card.gradient.to}08, ${card.gradient.via}05)`,
                          boxShadow: isCurrent
                            ? `0 0 40px ${card.glowColor}, 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 2px ${card.glowColor}`
                            : `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`,
                        }}
                      >
                        {/* Large decorative glow orb */}
                        <div
                          className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-35"
                          style={{ background: `radial-gradient(circle, ${card.gradient.from}, transparent)` }}
                        />

                        {/* Bottom accent line */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300"
                          style={{ background: `linear-gradient(90deg, ${card.gradient.from}, ${card.gradient.to})` }}
                        />

                        {/* Content */}
                        <div className="relative z-10 h-full flex flex-col">
                          {/* Icon & emoji row */}
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                              style={{
                                background: `linear-gradient(145deg, ${card.gradient.from}40, ${card.gradient.to}20)`,
                                border: `1px solid ${card.gradient.from}30`,
                                boxShadow: `0 0 20px ${card.glowColor}40`,
                              }}
                            >
                              <span style={{ filter: `drop-shadow(0 0 8px ${card.glowColor})` }}>
                                {card.icon}
                              </span>
                            </div>
                            <div
                              className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider"
                              style={{
                                background: `${card.gradient.from}20`,
                                color: card.accentText,
                                border: `1px solid ${card.gradient.from}30`,
                              }}
                            >
                              {card.badge}
                            </div>
                          </div>

                          {/* Mode name */}
                          <div className="mb-1">
                            <span
                              className="text-2xl mr-2"
                              style={{ filter: `drop-shadow(0 0 6px ${card.glowColor})` }}
                            >
                              {card.emoji}
                            </span>
                            <span className="text-lg font-bold" style={{ color: card.accentText }}>
                              {mode.label}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 mb-4">{mode.labelEn}</div>

                          {/* Tagline */}
                          <div
                            className="text-xs font-medium mb-3 leading-relaxed"
                            style={{ color: card.accentText, opacity: 0.9 }}
                          >
                            {mode.tagline}
                          </div>

                          {/* Description */}
                          <div className="text-xs text-white/50 leading-relaxed mb-4 flex-1">
                            {mode.description}
                          </div>

                          {/* Divider */}
                          <div
                            className="h-px w-full mb-3"
                            style={{ background: `linear-gradient(90deg, transparent, ${card.gradient.from}40, transparent)` }}
                          />

                          {/* Scenarios */}
                          <div className="space-y-2">
                            {card.scenarios.map((scenario, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <ChevronRight
                                  className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-colors"
                                  style={{ color: card.accentText }}
                                />
                                <div className="text-[11px] text-white/40 leading-tight">
                                  {scenario}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Participants badge */}
                          <div
                            className="flex items-center gap-2 mt-4 pt-3 rounded-xl"
                            style={{ borderTop: `1px solid ${card.gradient.from}15` }}
                          >
                            <span className="text-[10px] text-white/30">参与</span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${card.gradient.from}20`,
                                color: card.accentText,
                              }}
                            >
                              {mode.minParticipants}-{mode.maxParticipants}人
                            </span>
                          </div>
                        </div>

                        {/* Current / selected indicator */}
                        {isCurrent && (
                          <div className="absolute top-3 right-3 flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full animate-pulse"
                              style={{ background: card.gradient.from, boxShadow: `0 0 8px ${card.glowColor}` }}
                            />
                          </div>
                        )}

                        {/* Hover sparkle */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <div
                            className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                            style={{ background: card.accentText, opacity: 0.6 }}
                          />
                          <div
                            className="absolute bottom-20 left-3 w-1 h-1 rounded-full"
                            style={{ background: card.accentText, opacity: 0.4 }}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer hint */}
              <div
                className="flex-shrink-0 px-6 py-4 border-t bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/30">
                    点击任意卡片立即切换模式
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: '#6366f1' }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: '#8b5cf6', animationDelay: '0.2s' }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: '#ec4899', animationDelay: '0.4s' }}
                    />
                    <span className="text-xs text-white/30 ml-1">8种独特体验</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
