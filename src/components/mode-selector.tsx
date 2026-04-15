'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';
import { trackModeSwitch } from '@/lib/use-tracking';
import { X, Zap, Users, Brain, Sparkles, MessageSquare, Target, Compass, BookOpen } from 'lucide-react';

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  participantCount?: number;
  /** If true, the selector is shown as a full-screen overlay */
  fullScreen?: boolean;
  /** Called when user wants to close (if not fullScreen) */
  onClose?: () => void;
}

// 每个模式的详细配置（包含颜色和图标）
const MODE_CONFIG: Record<Mode, {
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeColor: string;
  description: string;
  scenarios: string[];
  icon: React.ReactNode;
}> = {
  solo: {
    gradient: 'from-indigo-600/20 via-indigo-500/10 to-transparent',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    badge: '认知型',
    badgeColor: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
    description: '选择一个思维伙伴，深度追问，挖掘大师的思考方式',
    scenarios: ['深入学习一个思想家的思维方式', '遇到困惑需要大师指点', '想要建立持续的学习对话'],
    icon: <Brain className="w-6 h-6" />,
  },
  prism: {
    gradient: 'from-violet-600/20 via-violet-500/10 to-transparent',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    badge: '折射型',
    badgeColor: 'text-violet-400 bg-violet-500/20 border-violet-500/30',
    description: '多视角全面分析，系统自动融合共识与分歧，输出完整认知地图',
    scenarios: ['快速全面了解一个新领域', '需要多元视角综合分析', '寻找不同观点的交汇点'],
    icon: <Sparkles className="w-6 h-6" />,
  },
  roundtable: {
    gradient: 'from-sky-600/20 via-sky-500/10 to-transparent',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    badge: '对话型',
    badgeColor: 'text-sky-400 bg-sky-500/20 border-sky-500/30',
    description: '多角色真正来回碰撞，观点交锋，揭示你没想到的思维盲点',
    scenarios: ['需要被挑战和质疑', '想找到思维漏洞', '让不同观点真正碰撞'],
    icon: <Users className="w-6 h-6" />,
  },
  epoch: {
    gradient: 'from-red-600/20 via-red-500/10 to-transparent',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    badge: '交锋型',
    badgeColor: 'text-red-400 bg-red-500/20 border-red-500/30',
    description: '跨越时空的正面对决，让不同时代的人物在同一问题上针锋相对',
    scenarios: ['两种截然不同的世界观碰撞', '正反双方深度辩论', '历史与现实的对话'],
    icon: <Compass className="w-6 h-6" />,
  },
  mission: {
    gradient: 'from-emerald-600/20 via-emerald-500/10 to-transparent',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    badge: '协作型',
    badgeColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
    description: '专家团队分工协作，产出完整可用的结构化成果',
    scenarios: ['需要一个完整可执行的方案', '复杂任务需要多方协作', '追求最佳整合输出'],
    icon: <Target className="w-6 h-6" />,
  },
  council: {
    gradient: 'from-amber-600/20 via-amber-500/10 to-transparent',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    badge: '顾问型',
    badgeColor: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
    description: '各领域顾问给出专业建议，交叉点评，最终形成共识行动方案',
    scenarios: ['重大决策需要多方专业意见', '寻求综合性建议', '从不同角度审视问题'],
    icon: <MessageSquare className="w-6 h-6" />,
  },
  oracle: {
    gradient: 'from-purple-600/20 via-purple-500/10 to-transparent',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    badge: '洞察型',
    badgeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
    description: '思想家以未来视角诊断现状，预测发展趋势，给出战略判断',
    scenarios: ['需要战略预判', '看清事物发展的深层逻辑', '寻求未来视角的洞察'],
    icon: <Zap className="w-6 h-6" />,
  },
  fiction: {
    gradient: 'from-pink-600/20 via-pink-500/10 to-transparent',
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
    badge: '创意型',
    badgeColor: 'text-pink-400 bg-pink-500/20 border-pink-500/30',
    description: '多个角色共同演绎故事，每个角色保持独特的语言风格与思维方式',
    scenarios: ['用故事形式理解思想', '沉浸式叙事体验', '角色扮演与创意探索'],
    icon: <BookOpen className="w-6 h-6" />,
  },
};

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
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">选择协作模式</h2>
          {fullScreen && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-white/50">
          当前使用：
          <span className="ml-1.5 inline-flex items-center gap-1 text-white font-medium">
            {currentMode.icon} {currentMode.label}
          </span>
        </p>
      </div>

      {/* Mode cards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.keys(MODES).map((modeId) => {
            const mode = MODES[modeId as Mode];
            const config = MODE_CONFIG[modeId as Mode];
            const isActive = selected === modeId;
            const isCurrent = value === modeId;

            return (
              <motion.button
                key={modeId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(modeId as Mode)}
                className={cn(
                  'relative text-left rounded-2xl p-5 transition-all duration-300 overflow-hidden',
                  'border',
                  isActive
                    ? 'border-white/20 shadow-xl'
                    : 'border-white/5 hover:border-white/10'
                )}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${config.gradient.includes('indigo') ? 'rgba(99,102,241,0.15)' : config.gradient.includes('violet') ? 'rgba(139,92,246,0.15)' : config.gradient.includes('sky') ? 'rgba(14,165,233,0.15)' : config.gradient.includes('red') ? 'rgba(239,68,68,0.15)' : config.gradient.includes('emerald') ? 'rgba(16,185,129,0.15)' : config.gradient.includes('amber') ? 'rgba(245,158,11,0.15)' : config.gradient.includes('purple') ? 'rgba(168,85,247,0.15)' : 'rgba(236,72,153,0.15)'} 0%, transparent 100%), var(--bg-surface)`
                    : undefined,
                }}
              >
                {/* Glow effect for active */}
                {isActive && (
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `radial-gradient(circle at top right, ${config.iconColor.replace('text-', 'rgba(').replace('-400', ',0.3)').replace('/', ',0.3)').replace('indigo', '99,102,241').replace('violet', '139,92,246').replace('sky', '14,165,233').replace('red', '239,68,68').replace('emerald', '16,185,129').replace('amber', '245,158,11').replace('purple', '168,85,247').replace('pink', '236,72,153')}, transparent 60%)`,
                    }}
                  />
                )}

                {/* Card content */}
                <div className="relative z-10">
                  {/* Top row: icon + badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.iconBg)}>
                      <div className={config.iconColor}>{config.icon}</div>
                    </div>
                    <div className={cn('text-[10px] font-medium px-2 py-1 rounded-full border', config.badgeColor)}>
                      {config.badge}
                    </div>
                  </div>

                  {/* Mode name */}
                  <div className="text-base font-bold text-white mb-1">{mode.label}</div>
                  <div className="text-xs text-white/40 mb-3">{mode.labelEn}</div>

                  {/* Tagline */}
                  <div className={cn('text-xs font-medium mb-3', config.iconColor)}>
                    {mode.tagline}
                  </div>

                  {/* Description */}
                  <div className="text-xs text-white/60 leading-relaxed mb-3">
                    {config.description}
                  </div>

                  {/* Scenarios */}
                  <div className="space-y-1.5">
                    {config.scenarios.map((scenario, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', config.iconColor.replace('text-', 'bg-').replace('-400', '-400'))} />
                        <div className="text-[11px] text-white/40">{scenario}</div>
                      </div>
                    ))}
                  </div>

                  {/* Participants info */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                    <span className="text-[10px] text-white/30">参与人数</span>
                    <span className="text-[10px] text-white/50">
                      {mode.minParticipants}-{mode.maxParticipants}人
                    </span>
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-white shadow-lg" />
                )}
                {isCurrent && !isActive && (
                  <div className="absolute top-4 right-4 text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                    当前
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Footer confirm */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={selected === value}
            className={cn(
              'flex-1 py-3 rounded-xl text-sm font-semibold transition-all',
              selected === value
                ? 'bg-white/5 text-white/40 cursor-not-allowed'
                : 'bg-white text-slate-900 hover:bg-white/90 active:scale-[0.98]'
            )}
          >
            {selected === value ? `当前使用中 — ${MODES[value].label}` : `切换为 ${MODES[selected as Mode].label}`}
          </button>
          {onClose && selected === value && (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-medium bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
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
      <div className="fixed inset-0 z-[500] bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="h-full max-w-4xl mx-auto">
          {panel}
        </div>
      </div>
    );
  }

  return panel;
}

/** Compact trigger button + dropdown for use in the chat header */
interface CompactModeTriggerProps {
  value: Mode;
  onOpen: () => void;
}

export function CompactModeTrigger({ value, onOpen }: CompactModeTriggerProps) {
  const mode = MODES[value];
  const config = MODE_CONFIG[value];

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all border border-transparent hover:border-white/10"
      style={{
        background: `linear-gradient(135deg, ${config.iconBg.includes('indigo') ? 'rgba(99,102,241,0.1)' : config.iconBg.includes('violet') ? 'rgba(139,92,246,0.1)' : config.iconBg.includes('sky') ? 'rgba(14,165,233,0.1)' : config.iconBg.includes('red') ? 'rgba(239,68,68,0.1)' : config.iconBg.includes('emerald') ? 'rgba(16,185,129,0.1)' : config.iconBg.includes('amber') ? 'rgba(245,158,11,0.1)' : config.iconBg.includes('purple') ? 'rgba(168,85,247,0.1)' : 'rgba(236,72,153,0.1)'}, transparent)`,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <span className={config.iconColor}>{config.icon}</span>
      <span className="hidden sm:inline text-xs font-medium text-white/80">{mode.label}</span>
    </button>
  );
}
