'use client';

/**
 * Prismatic — Guardian Banner
 * "守望者计划" — Game Design Master Edition
 *
 * Design philosophy: This is NOT a dashboard — it's an ARGUMENTUM / STORY INTERFACE.
 * - Guardians are "Shift Masters" on a rotating dial
 * - Engagement is a daily quest with XP and completion rewards
 * - Debate is a theatrical arena with live energy
 * - @mention is a "summon" with dramatic visual feedback
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield, Sparkles, Calendar, ChevronRight, RefreshCw, Eye, CheckCircle2,
  Clock, Flame, Play, Loader2, MessageSquare, ChevronDown, Send,
  Zap, Star, Trophy, Users, Swords, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPersonasByIds } from '@/lib/personas';
import type { DebateRecord, DebateTurn } from '@/lib/debate-arena-engine';

interface Guardian {
  slot: number;
  personaId: string;
  personaSlug: string;
  personaName: string;
  personaNameZh: string;
  personaTagline: string;
  gradientFrom: string;
  gradientTo: string;
  shiftTheme: string;
  interactionCount?: number;
  targetCount?: number;
  status?: string;
  progress?: number;
}

type ScheduleDay = Array<{
  slot: number;
  personaId: string;
  personaNameZh: string;
  personaSlug: string;
  gradientFrom: string;
  gradientTo: string;
  shiftTheme: string;
  maxInteractions: number;
}>;

interface VisitorContribution {
  id: number;
  content: string;
  createdAt: string;
  visitorId: string;
  isAiResponse: boolean;
}

const TONE_META: Record<string, { label: string; color: string; glowColor: string }> = {
  opening:    { label: '开场陈述', color: '#60a5fa', glowColor: 'rgba(96,165,250,0.3)' },
  provocative: { label: '发起质疑', color: '#f97316', glowColor: 'rgba(249,115,22,0.3)' },
  supportive:  { label: '补充论证', color: '#4ade80', glowColor: 'rgba(74,222,128,0.3)' },
  questioning: { label: '追问反驳', color: '#fbbf24', glowColor: 'rgba(251,191,36,0.3)' },
  synthesizing: { label: '总结升华', color: '#a78bfa', glowColor: 'rgba(167,139,250,0.3)' },
};

const STATUS_META = {
  scheduled: { label: '即将开辩', pulseColor: '#facc15' },
  running:   { label: '辩论进行中', pulseColor: '#ef4444' },
  completed: { label: '已结束', pulseColor: '#6b7280' },
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6)  return '夜深了';
  if (hour < 9)  return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午间';
  if (hour < 18) return '午后';
  if (hour < 22) return '傍晚';
  return '夜晚';
}

const SLOT_CHINESE = ['壹', '贰', '叁'];
const SLOT_ENGLISH = ['Alpha', 'Beta', 'Gamma'];

// ─── Guardian Avatar Card (circular, with progress ring) ────────────────────────

function GuardianAvatarCard({ guardian, index }: { guardian: Guardian; index: number }) {
  const isCompleted = guardian.status === 'completed';
  const count = guardian.interactionCount ?? 0;
  const target = guardian.targetCount ?? 5;
  const pct = Math.min(100, Math.round((count / target) * 100));

  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - pct / 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.12, duration: 0.5, type: 'spring' }}
      className="flex flex-col items-center gap-2"
    >
      {/* Avatar with progress ring */}
      <Link href={`/personas/${guardian.personaSlug || guardian.personaId}`} className="block group">
        <div className="relative w-[72px] h-[72px]">
          {/* SVG progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
            {/* Track */}
            <circle
              cx="36" cy="36" r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="3"
            />
            {/* Fill */}
            <circle
              cx="36" cy="36" r={r}
              fill="none"
              stroke={isCompleted ? '#4ade80' : guardian.gradientFrom}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              style={{
                filter: isCompleted
                  ? 'drop-shadow(0 0 4px rgba(74,222,128,0.6))'
                  : `drop-shadow(0 0 4px ${guardian.gradientFrom}60)`,
                transition: 'stroke-dashoffset 0.8s ease-out',
              }}
            />
          </svg>

          {/* Avatar circle */}
          <div
            className="absolute inset-[6px] rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all duration-300 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${guardian.gradientFrom}, ${guardian.gradientTo})`,
              boxShadow: isCompleted
                ? '0 0 16px rgba(74,222,128,0.4)'
                : `0 4px 16px ${guardian.gradientFrom}50`,
            }}
          >
            {guardian.personaNameZh[0]}
          </div>

          {/* Completed badge */}
          {isCompleted && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-bg-elevated">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </Link>

      {/* Slot label */}
      <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: guardian.gradientFrom }}>
        {SLOT_ENGLISH[index]}
      </div>

      {/* Name */}
      <Link href={`/personas/${guardian.personaSlug || guardian.personaId}`}>
        <p className="text-xs font-semibold text-text-primary group-hover:text-white transition-colors text-center leading-tight">
          {guardian.personaNameZh}
        </p>
      </Link>

      {/* Tagline */}
      <p className="text-[10px] text-text-muted text-center leading-tight px-1 line-clamp-2 max-w-[80px]">
        {guardian.shiftTheme}
      </p>

      {/* XP bar */}
      <div className="w-full px-1">
        <div className="flex items-center justify-between text-[9px] text-text-muted mb-0.5 px-1">
          <span className="flex items-center gap-0.5">
            {isCompleted ? (
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <Star className="w-2.5 h-2.5" />
            )}
            今日互动
          </span>
          <span style={{ color: isCompleted ? '#4ade80' : guardian.gradientFrom }}>
            {count}/{target}
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isCompleted
                ? 'linear-gradient(90deg, #10b981, #4ade80)'
                : `linear-gradient(90deg, ${guardian.gradientFrom}, ${guardian.gradientTo})`,
              width: `${pct}%`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + index * 0.1 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Debate Turn Card ────────────────────────────────────────────────────────────

function DebateTurnCard({ turn, index }: { turn: DebateTurn; index: number }) {
  const meta = TONE_META[turn.tone] ?? TONE_META.opening;
  const isModerator = turn.speakerId === 'moderator';
  const personas = getPersonasByIds([turn.speakerId]);
  const persona = personas[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'rounded-xl p-4 border backdrop-blur-sm',
        isModerator
          ? 'bg-purple-950/40 border-purple-500/20'
          : 'bg-white/[0.025] border-white/[0.06]'
      )}
      style={{
        boxShadow: isModerator
          ? '0 0 20px rgba(167,139,250,0.1) inset'
          : `0 0 16px ${meta.glowColor} inset`,
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        {isModerator ? (
          <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-sm shadow-inner" style={{ boxShadow: '0 0 8px rgba(167,139,250,0.3)' }}>🎭</div>
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-lg"
            style={{
              background: persona
                ? `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`
                : '#4d96ff',
              boxShadow: `0 0 8px ${persona?.gradientFrom ?? '#4d96ff'}60`,
            }}
          >
            {turn.speakerName.slice(0, 2)}
          </div>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn('text-sm font-semibold truncate', isModerator ? 'text-purple-200' : 'text-gray-100')}>
            {turn.speakerName}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{
              background: `${meta.color}20`,
              color: meta.color,
              boxShadow: `0 0 6px ${meta.glowColor}`,
            }}
          >
            {meta.label}
          </span>
          {turn.round > 0 && (
            <span className="text-[9px] text-white/20 flex-shrink-0">R{turn.round}</span>
          )}
        </div>
      </div>
      <p className={cn('text-sm leading-relaxed', isModerator ? 'text-purple-200' : 'text-gray-300')}>
        {turn.content.length > 180 ? turn.content.slice(0, 180) + '…' : turn.content}
      </p>
    </motion.div>
  );
}

// ─── Deterministic Fallback Guardians (used when DB is unavailable) ───────────────────────

const FALLBACK_PERSONAS = [
  { id: 'socrates', name: 'Socrates', nameZh: '苏格拉底', tagline: '未经审视的人生不值得过', gradientFrom: '#4d96ff', gradientTo: '#06b6d4' },
  { id: 'marcus-aurelius', name: 'Marcus Aurelius', nameZh: '马可·奥勒留', tagline: '每日清晨对自己说：我将遇到好管闲事的人', gradientFrom: '#c77dff', gradientTo: '#8b5cf6' },
  { id: 'nassim-taleb', name: 'Nassim Taleb', nameZh: '纳西姆·塔勒布', tagline: '反脆弱：在不确定性中茁壮成长', gradientFrom: '#ff9f43', gradientTo: '#ffd93d' },
];

const FALLBACK_THEMES = [
  '今日话题：你最近在思考什么问题？',
  '哲学时间：什么塑造了你现在的思维？',
  '思想实验：如果能和任何历史人物对话，你选谁？',
  '实践派：分享一个你正在尝试的习惯',
];

function getDeterministicGuardians(): Guardian[] {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const dayOfWeek = today.getDay();

  return FALLBACK_PERSONAS.map((p, i) => ({
    slot: i + 1,
    personaId: p.id,
    personaSlug: p.id,
    personaName: p.name,
    personaNameZh: p.nameZh,
    personaTagline: p.tagline,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    shiftTheme: FALLBACK_THEMES[(seed + i + dayOfWeek) % FALLBACK_THEMES.length],
    interactionCount: 0,
    targetCount: 5,
    status: 'scheduled',
  }));
}

// ─── Main Guardian Banner ────────────────────────────────────────────────────────

export function GuardianBanner() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [debate, setDebate] = useState<DebateRecord | null>(null);
  const [debatePreview, setDebatePreview] = useState<{
    topic: string;
    guardians: Array<{ personaId: string; personaNameZh: string }>;
    estimatedTurns: number;
    estimatedStartTime: string;
    highlights: string[];
    conflicts: string[];
  } | null>(null);
  const [contributions, setContributions] = useState<VisitorContribution[]>([]);
  const [showParticipation, setShowParticipation] = useState(false);
  const [contributionText, setContributionText] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAllTurns, setShowAllTurns] = useState(false);
  const [guardianSource, setGuardianSource] = useState<'api' | 'fallback'>('api');

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [guardianRes, statsRes, debateRes, meRes] = await Promise.all([
        fetch('/api/guardian'),
        fetch('/api/guardian/stats'),
        fetch('/api/forum/debate'),
        fetch('/api/user/me'),
      ]);

      const guardianData = guardianRes.ok ? await guardianRes.json() : {};
      const statsData = statsRes.ok ? await statsRes.json() : {};
      const debateData = debateRes.ok ? await debateRes.json() : {};
      const meData = meRes.ok ? await meRes.json() : {};

      const guardiansFromApi: any[] = Array.isArray(guardianData.guardians) ? guardianData.guardians : [];

      // Use API data if available, otherwise use deterministic fallback
      if (guardiansFromApi.length > 0) {
        const statsMap: Record<string, any> = {};
        if (statsData.guardians && Array.isArray(statsData.guardians)) {
          for (const s of statsData.guardians) {
            if (s?.personaId) statsMap[s.personaId] = s;
          }
        }
        const merged = guardiansFromApi.map((g: any) => {
          const stats = statsMap[g.personaId];
          return stats ? { ...g, ...stats } : g;
        });
        setGuardians(merged);
        setGuardianSource('api');
      } else {
        // Fallback: generate deterministic guardians client-side
        setGuardians(getDeterministicGuardians());
        setGuardianSource('fallback');
      }

      setDebate(debateData.debate ?? null);
      setDebatePreview(debateData.preview ?? null);
      setIsAdmin(meData?.user?.isAdmin === true);

      if (debateData.debate?.id) {
        const contribRes = await fetch(`/api/forum/debate/visitor?debateId=${debateData.debate.id}`);
        if (contribRes.ok) {
          const contribData = await contribRes.json();
          setContributions(contribData.contributions ?? []);
        }
      }
    } catch {
      // On any error, use fallback
      setGuardians(getDeterministicGuardians());
      setGuardianSource('fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debate || !contributionText.trim() || submittingContribution) return;
    setSubmittingContribution(true);
    setContributionError(null);
    try {
      const res = await fetch('/api/forum/debate/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debateId: debate.id, content: contributionText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setContributionError(data.error || '提交失败'); return; }
      setContributions(prev => [...prev, data.contribution]);
      setContributionText('');
    } catch { setContributionError('网络错误'); }
    finally { setSubmittingContribution(false); }
  };

  const handleAdminDebateAction = async () => {
    if (!debate) return;
    setAdminLoading(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/forum/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', debateId: debate.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMsg({ type: 'success', text: '辩论已启动！' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setAdminMsg({ type: 'error', text: data.error || '启动失败' });
      }
    } catch { setAdminMsg({ type: 'error', text: '网络错误' }); }
    finally { setAdminLoading(false); }
  };

  const canParticipate = debate && (debate.status === 'scheduled' || debate.status === 'running');
  const displayedTurns = showAllTurns ? debate?.turns : debate?.turns.slice(-3);
  const visibleContributions = contributions.slice(-3);

  const completedCount = guardians.filter(g => g.status === 'completed').length;
  const debateStatusMeta = debate?.status ? STATUS_META[debate.status as keyof typeof STATUS_META] : null;

  return (
    <section className="relative overflow-hidden">

      {/* ── Top Decorative Wave ─────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(77,150,255,0.4), rgba(199,125,255,0.4), transparent)',
      }} />

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full bg-prism-purple/8 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-60 h-60 rounded-full bg-prism-blue/8 blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 relative">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {/* Shield icon with glow */}
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center border border-white/10">
                <Shield className="w-5.5 h-5.5 text-prism-blue" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-xl border border-prism-blue/30 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary tracking-tight">守望者计划</h2>
                {/* Online indicator */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400">
                    {mounted ? getTimeGreeting() : '你好'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                每日三位思想家轮值 · {completedCount}/{guardians.length} 已完成任务
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">排班表</span>
            </button>
            <button
              onClick={fetchAll}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Guardian Dial ─────────────────────────────────────────────── */}
        {loading && guardians.length === 0 ? (
          <div className="flex justify-center py-6">
            <div className="flex gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-[72px] h-[72px] rounded-full bg-bg-elevated" />
                  <div className="h-2 bg-bg-elevated rounded w-8" />
                  <div className="h-3 bg-bg-elevated rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        ) : guardians.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">今日守望者加载中...</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6 md:gap-10 py-4">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 h-px top-[calc(50%-1px)] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none hidden md:block" />

            {guardians.map((g, i) => (
              <GuardianAvatarCard key={`${g.personaId}-${g.slot}`} guardian={g} index={i} />
            ))}
          </div>
        )}

        {/* ── Debate Arena ────────────────────────────────────────────── */}
        {(debate || debatePreview) && (
          <div className="mt-8 space-y-3">
            {/* Arena header */}
            <div className="rounded-2xl border overflow-hidden" style={{
              borderColor: debate?.status === 'running' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
              background: debate?.status === 'running'
                ? 'linear-gradient(135deg, rgba(127,29,29,0.3), rgba(113,63,18,0.2))'
                : 'rgba(255,255,255,0.02)',
              boxShadow: debate?.status === 'running' ? '0 0 30px rgba(239,68,68,0.1)' : 'none',
            }}>
              {/* Top glow bar */}
              <div className="h-0.5" style={{
                background: debate?.status === 'running'
                  ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)'
                  : 'linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)',
              }} />

              <div className="p-5">
                {/* Title row */}
                <div className="flex items-center gap-3 mb-3">
                  {/* Arena icon */}
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center',
                    debate?.status === 'running'
                      ? 'bg-red-500/20 border border-red-500/30'
                      : 'bg-amber-500/15 border border-amber-500/25'
                  )}>
                    {debate?.status === 'running'
                      ? <Swords className="w-4.5 h-4.5 text-red-400" />
                      : <Sparkles className="w-4.5 h-4.5 text-amber-400" />
                    }
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">
                        {debate?.status === 'running' ? '⚔️ 智辩场进行中' : '📋 今日辩题预告'}
                      </span>
                      {debateStatusMeta && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${debateStatusMeta.pulseColor}20`,
                            color: debateStatusMeta.pulseColor,
                          }}
                        >
                          {debateStatusMeta.label}
                        </span>
                      )}
                      {debate?.status === 'running' && (
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Topic */}
                <div className="bg-white/[0.03] rounded-xl p-3 mb-3 border border-white/5">
                  <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1">辩题</div>
                  <p className="text-sm font-semibold text-text-primary leading-snug">
                    {debate?.topic ?? debatePreview?.topic}
                  </p>
                </div>

                {/* Highlights */}
                {debatePreview && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {debatePreview.highlights?.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        {h}
                      </span>
                    ))}
                    {debatePreview.conflicts?.slice(0, 2).map((c, i) => (
                      <span key={`c-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300/80 border border-red-500/20 flex items-center gap-1">
                        ⚡ {c.length > 20 ? c.slice(0, 20) + '…' : c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Time info */}
                {debatePreview?.estimatedStartTime && debate?.status !== 'running' && (
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-3">
                    <Clock className="w-3 h-3" />
                    <span>预计 {debatePreview.estimatedStartTime} 开辩 · 共 {debatePreview.estimatedTurns} 轮</span>
                  </div>
                )}

                {/* Live CTA */}
                {debate?.status === 'running' && (
                  <button
                    onClick={() => {
                      setShowParticipation(true);
                      document.getElementById('debate-participation')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.2))',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#fca5a5',
                      boxShadow: '0 0 20px rgba(239,68,68,0.2)',
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    我想发言 — 围观也能参与
                  </button>
                )}

                {/* Admin */}
                {isAdmin && debate?.status === 'scheduled' && (
                  <div className="mt-3 pt-3 border-t border-red-500/15">
                    {adminMsg && (
                      <div className={`text-xs mb-2 px-2 py-1 rounded ${adminMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {adminMsg.text}
                      </div>
                    )}
                    <button
                      onClick={handleAdminDebateAction}
                      disabled={adminLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                    >
                      {adminLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      启动辩论
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Debate turns */}
            {debate && debate.turns.length > 0 && (
              <div className="space-y-2">
                {displayedTurns?.map((turn, idx) => (
                  <DebateTurnCard key={idx} turn={turn} index={idx} />
                ))}
                {debate.turns.length > 3 && (
                  <button
                    onClick={() => setShowAllTurns(!showAllTurns)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-text-muted hover:text-text-secondary transition-colors rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/5"
                  >
                    {showAllTurns ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showAllTurns ? '收起' : `展开全部 ${debate.turns.length} 轮`}
                  </button>
                )}
              </div>
            )}

            {/* Visitor participation */}
            {canParticipate && (
              <div id="debate-participation" className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setShowParticipation(!showParticipation)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all',
                    showParticipation
                      ? 'bg-prism-blue/10 border-b border-prism-blue/20 text-prism-blue'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  {showParticipation ? '收起参与面板' : '✦ 我也想说几句'}
                </button>

                {showParticipation && (
                  <div className="p-4 space-y-3">
                    <textarea
                      value={contributionText}
                      onChange={e => setContributionText(e.target.value)}
                      placeholder="围绕今日辩题，写下你的观点..."
                      maxLength={300}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-prism-blue/50 transition-colors resize-none"
                    />
                    {contributionError && (
                      <p className="text-xs text-red-400">{contributionError}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{contributionText.length}/300</span>
                      <button
                        type="submit"
                        onClick={handleSubmitContribution}
                        disabled={!contributionText.trim() || submittingContribution || contributionText.length < 2}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-prism-gradient text-white text-xs disabled:opacity-40 transition-opacity font-medium"
                      >
                        {submittingContribution ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {submittingContribution ? '发送中…' : '发布观点'}
                      </button>
                    </div>

                    {visibleContributions.length > 0 && (
                      <div className="mt-2 space-y-2 pt-3 border-t border-white/5">
                        <div className="text-[10px] text-text-muted uppercase tracking-widest">
                          围观发言 ({contributions.length})
                        </div>
                        {visibleContributions.map(c => (
                          <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[10px] text-text-muted">👤</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Completed: show contributions */}
            {debate?.status === 'completed' && contributions.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2">围观发言 ({contributions.length})</div>
                {visibleContributions.map(c => (
                  <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-text-muted">👤</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quest Hint ──────────────────────────────────────────────── */}
        {!debate && !debatePreview && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted/60 py-4">
            <Trophy className="w-3.5 h-3.5" />
            <span>发表评论，即有机会获得守望者亲自回复</span>
          </div>
        )}
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(199,125,255,0.3), transparent)',
      }} />

      {/* Calendar Modal */}
      {showCalendar && (
        <GuardianCalendarModal onClose={() => setShowCalendar(false)} />
      )}
    </section>
  );
}

// ─── Calendar Modal ─────────────────────────────────────────────────────────────

function GuardianCalendarModal({ onClose }: { onClose: () => void }) {
  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/guardian/schedule?days=14')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.schedule && typeof data.schedule === 'object' && data.schedule !== null) {
          setSchedule(data.schedule as Record<string, ScheduleDay>);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const todayStr = mounted ? new Date().toISOString().slice(0, 10) : '';
  const scheduleEntries = Object.entries(schedule).sort(([a], [b]) => a.localeCompare(b)).slice(0, 14);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-bg-elevated border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-prism-blue/15 border border-prism-blue/25 flex items-center justify-center">
                <Calendar className="w-4.5 h-4.5 text-prism-blue" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">守望者排班表</h3>
                <p className="text-xs text-text-muted">未来两周轮值安排</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors text-lg"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh] p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-text-muted">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : scheduleEntries.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">暂无排班数据</div>
            ) : (
              <div className="space-y-3">
                {scheduleEntries.map(([date, day]) => {
                  const isToday = date === todayStr;
                  const dayObj = new Date(date + 'T00:00:00');
                  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

                  return (
                    <div
                      key={date}
                      className={cn(
                        'flex items-start gap-4 p-3.5 rounded-xl border transition-colors',
                        isToday
                          ? 'bg-prism-blue/5 border-prism-blue/20'
                          : 'border-white/[0.05] hover:border-white/[0.1]'
                      )}
                    >
                      <div className="w-16 flex-shrink-0 text-center">
                        <p className={cn('text-[10px] font-medium', isToday ? 'text-prism-blue' : 'text-text-muted')}>
                          {days[dayObj.getDay()]}
                        </p>
                        <p className={cn('text-lg font-bold mt-0.5', isToday ? 'text-prism-blue' : 'text-text-primary')}>
                          {date.slice(5).replace('-', '/')}
                        </p>
                        {isToday && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-prism-blue/10 text-prism-blue">今日</span>
                        )}
                      </div>

                      <div className="flex-1 flex gap-3 flex-wrap">
                        {day.map((g, slotIdx) => (
                          <Link
                            key={`${g.personaId}-${slotIdx}`}
                            href={`/personas/${g.personaSlug}`}
                            className="flex items-center gap-2 group"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-md transition-transform group-hover:scale-110"
                              style={{ background: `linear-gradient(135deg, ${g.gradientFrom}, ${g.gradientTo})` }}
                            >
                              {g.personaNameZh[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-text-primary group-hover:text-white transition-colors truncate max-w-[80px]">{g.personaNameZh}</p>
                              <p className="text-[9px] text-text-muted truncate max-w-[80px]">{SLOT_CHINESE[slotIdx]}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/[0.06] flex justify-center">
            <Link
              href="/personas"
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-prism-blue hover:underline"
            >
              了解所有守望者
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
