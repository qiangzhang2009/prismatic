'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { trackModeSwitch } from '@/lib/use-tracking';
import {
  X, Brain, Sparkles, Users, Compass, Target, MessageSquare,
  Zap, BookOpen, ChevronRight
} from 'lucide-react';

interface ModePickerOverlayProps {
  isOpen: boolean;
  currentMode: Mode;
  onSelect: (mode: Mode) => void;
  onClose: () => void;
}

// 8种模式的详细配置
const MODE_DETAILS: Record<Mode, {
  icon: React.ReactNode;
  gradient: { from: string; to: string };
  glow: string;
  scenarios: string[];
}> = {
  solo: {
    icon: <Brain className="w-8 h-8" />,
    gradient: { from: 'from-indigo-600', to: 'to-indigo-400' },
    glow: 'shadow-indigo-500/30',
    scenarios: [
      '深入学习一个思想家的思维方式',
      '遇到困惑需要大师指点迷津',
      '建立持续的学习对话和追问',
    ],
  },
  prism: {
    icon: <Sparkles className="w-8 h-8" />,
    gradient: { from: 'from-violet-600', to: 'to-violet-400' },
    glow: 'shadow-violet-500/30',
    scenarios: [
      '快速全面了解一个新领域',
      '需要多元视角综合分析',
      '寻找不同观点的交汇点',
    ],
  },
  roundtable: {
    icon: <Users className="w-8 h-8" />,
    gradient: { from: 'from-sky-600', to: 'to-sky-400' },
    glow: 'shadow-sky-500/30',
    scenarios: [
      '需要被挑战和质疑',
      '想找到思维漏洞和盲点',
      '让不同观点真正碰撞',
    ],
  },
  epoch: {
    icon: <Compass className="w-8 h-8" />,
    gradient: { from: 'from-red-600', to: 'to-red-400' },
    glow: 'shadow-red-500/30',
    scenarios: [
      '两种截然不同的世界观交锋',
      '正反双方深度辩论',
      '历史与现实的对话',
    ],
  },
  mission: {
    icon: <Target className="w-8 h-8" />,
    gradient: { from: 'from-emerald-600', to: 'to-emerald-400' },
    glow: 'shadow-emerald-500/30',
    scenarios: [
      '需要一个完整可执行的方案',
      '复杂任务需要多方分工协作',
      '追求最佳整合输出',
    ],
  },
  council: {
    icon: <MessageSquare className="w-8 h-8" />,
    gradient: { from: 'from-amber-600', to: 'to-amber-400' },
    glow: 'shadow-amber-500/30',
    scenarios: [
      '重大决策需要多方专业意见',
      '寻求综合性建议',
      '从不同角度审视问题',
    ],
  },
  oracle: {
    icon: <Zap className="w-8 h-8" />,
    gradient: { from: 'from-purple-600', to: 'to-purple-400' },
    glow: 'shadow-purple-500/30',
    scenarios: [
      '需要战略预判和未来视角',
      '看清事物发展的深层逻辑',
      '寻求先知般的洞察',
    ],
  },
  fiction: {
    icon: <BookOpen className="w-8 h-8" />,
    gradient: { from: 'from-pink-600', to: 'to-pink-400' },
    glow: 'shadow-pink-500/30',
    scenarios: [
      '用故事形式理解思想',
      '沉浸式叙事体验',
      '角色扮演与创意探索',
    ],
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300]"
            onClick={onClose}
          />

          {/* Overlay content */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-x-4 bottom-4 top-[10%] md:inset-auto md:top-[10%] md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-5xl md:max-h-[85vh] z-[301] flex flex-col"
          >
            {/* Modal container */}
            <div className="flex-1 bg-bg-elevated rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 px-6 py-5 border-b border-white/10 bg-bg-surface/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">选择协作模式</h2>
                    <p className="text-sm text-white/40 mt-0.5">
                      当前：
                      <span
                        className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ background: MODES[currentMode].accent }}
                      >
                        {MODES[currentMode].icon} {MODES[currentMode].label}
                      </span>
                    </p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.values(MODES).map((mode, index) => {
                    const details = MODE_DETAILS[mode.id];
                    const isCurrent = currentMode === mode.id;

                    return (
                      <motion.button
                        key={mode.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect(mode.id as Mode)}
                        className={cn(
                          'relative text-left rounded-2xl p-5 overflow-hidden transition-all duration-300 border',
                          isCurrent
                            ? 'border-white/30 shadow-2xl'
                            : 'border-white/5 hover:border-white/15'
                        )}
                        style={{
                          background: isCurrent
                            ? `linear-gradient(135deg, ${mode.accent}20 0%, var(--bg-surface) 100%)`
                            : undefined,
                        }}
                      >
                        {/* Gradient background for unselected */}
                        {!isCurrent && (
                          <div
                            className={cn('absolute inset-0 opacity-40', `bg-gradient-to-br ${details.gradient.from} ${details.gradient.to}`)}
                          />
                        )}

                        {/* Glow effect */}
                        <div
                          className={cn('absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20', `bg-gradient-to-br ${details.gradient.from} ${details.gradient.to}`)}
                        />

                        {/* Content */}
                        <div className="relative z-10">
                          {/* Icon */}
                          <div
                            className={cn(
                              'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform',
                              isCurrent ? 'scale-110' : ''
                            )}
                            style={{
                              background: isCurrent
                                ? `linear-gradient(135deg, ${mode.accent}30, ${mode.accent}15)`
                                : `${mode.accent}20`,
                              border: `1px solid ${mode.accent}40`,
                            }}
                          >
                            <div style={{ color: mode.accent }}>{details.icon}</div>
                          </div>

                          {/* Mode name */}
                          <div className={cn('font-bold mb-1', isCurrent ? 'text-white text-lg' : 'text-white/90')}>
                            {mode.label}
                          </div>
                          <div className="text-xs text-white/40 mb-3">{mode.labelEn}</div>

                          {/* Tagline */}
                          <div
                            className="text-xs font-medium mb-3 leading-relaxed"
                            style={{ color: mode.accent }}
                          >
                            {mode.tagline}
                          </div>

                          {/* Description */}
                          <div className="text-xs text-white/50 leading-relaxed mb-4">
                            {mode.description}
                          </div>

                          {/* Scenarios */}
                          <div className="space-y-2">
                            {details.scenarios.map((scenario, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <ChevronRight
                                  className="w-3 h-3 mt-0.5 flex-shrink-0"
                                  style={{ color: mode.accent }}
                                />
                                <div className="text-[11px] text-white/40 leading-tight">
                                  {scenario}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Participants badge */}
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                            <span className="text-[10px] text-white/30">参与人数</span>
                            <span className="text-[10px] text-white/50 font-medium">
                              {mode.minParticipants}-{mode.maxParticipants}人
                            </span>
                          </div>
                        </div>

                        {/* Current indicator */}
                        {isCurrent && (
                          <div className="absolute top-4 right-4">
                            <div
                              className="w-3 h-3 rounded-full shadow-lg"
                              style={{ background: mode.accent }}
                            />
                          </div>
                        )}

                        {/* Select indicator */}
                        {!isCurrent && (
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-3 h-3 rounded-full bg-white/20" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer hint */}
              <div className="flex-shrink-0 px-6 py-3 border-t border-white/5 bg-bg-surface/30 text-center">
                <p className="text-xs text-white/30">
                  点击卡片切换模式 · 每种模式都有独特的思考方式
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
