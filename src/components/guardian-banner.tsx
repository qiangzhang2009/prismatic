'use client';

/**
 * Prismatic — Guardian Banner
 * "守望者计划" Hero Component
 *
 * Displays today's 3 guardian personas with their shift themes and interaction progress.
 * Also embeds the full debate stage content (no separate debate section needed).
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield, Sparkles, Calendar, ChevronRight, RefreshCw, Eye, CheckCircle2,
  Clock, Flame, Play, Loader2, MessageSquare, ChevronDown, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERSONA_LIST_LIGHT } from '@/lib/persona-list-light';
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

const TONE_META: Record<string, { label: string; emoji: string; color: string }> = {
  opening: { label: '开场', emoji: '🎙️', color: 'text-blue-400' },
  provocative: { label: '质疑', emoji: '⚡', color: 'text-orange-400' },
  supportive: { label: '补充', emoji: '🤝', color: 'text-green-400' },
  questioning: { label: '追问', emoji: '❓', color: 'text-yellow-400' },
  synthesizing: { label: '总结', emoji: '✨', color: 'text-purple-400' },
};

const STATUS_META = {
  scheduled: { label: '即将开始', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  running: { label: '辩论进行中', color: 'text-red-400', bg: 'bg-red-400/10' },
  completed: { label: '已结束', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 9) return '清晨好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '午安';
  if (hour < 18) return '下午好';
  if (hour < 22) return '傍晚好';
  return '夜深了';
}

const SLOT_LABELS = ['壹', '贰', '叁'];

function DebateTurnCard({ turn }: { turn: DebateTurn }) {
  const meta = TONE_META[turn.tone] ?? TONE_META.opening;
  const isModerator = turn.speakerId === 'moderator';
  const persona = PERSONA_LIST_LIGHT.find(p => p.id === turn.speakerId);

  return (
    <div className={cn(
      'rounded-lg p-3 border text-xs',
      isModerator ? 'bg-purple-900/20 border-purple-500/20' : 'bg-white/5 border-white/10'
    )}>
      <div className="flex items-center gap-2 mb-2">
        {isModerator ? (
          <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-sm">🎭</div>
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{
              background: persona
                ? `linear-gradient(135deg, ${persona.gradientFrom || '#4d96ff'}, ${persona.gradientTo || '#c77dff'})`
                : '#4d96ff',
            }}
          >
            {turn.speakerName.slice(0, 2)}
          </div>
        )}
        <span className={cn('font-medium', isModerator ? 'text-purple-300' : 'text-gray-200')}>
          {turn.speakerName}
        </span>
        <span className={cn('text-[10px]', meta.color)}>{meta.emoji} {meta.label}</span>
        {turn.round > 0 && <span className="text-[10px] text-gray-500">R{turn.round}</span>}
      </div>
      <p className={cn('leading-relaxed', isModerator ? 'text-purple-200' : 'text-gray-300')}>
        {turn.content.length > 200 ? turn.content.slice(0, 200) + '…' : turn.content}
      </p>
    </div>
  );
}

export function GuardianBanner() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Debate state
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
      setDebate(debateData.debate ?? null);
      setDebatePreview(debateData.preview ?? null);
      setIsAdmin(meData?.user?.isAdmin === true);

      // Fetch contributions if debate exists
      if (debateData.debate?.id) {
        const contribRes = await fetch(`/api/forum/debate/visitor?debateId=${debateData.debate.id}`);
        if (contribRes.ok) {
          const contribData = await contribRes.json();
          setContributions(contribData.contributions ?? []);
        }
      }
    } catch {
      // ignore
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
      if (!res.ok) {
        setContributionError(data.error || '提交失败');
        return;
      }
      setContributions(prev => [...prev, data.contribution]);
      setContributionText('');
    } catch {
      setContributionError('网络错误');
    } finally {
      setSubmittingContribution(false);
    }
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
    } catch {
      setAdminMsg({ type: 'error', text: '网络错误' });
    } finally {
      setAdminLoading(false);
    }
  };

  const slotLabels = ['壹', '贰', '叁'];
  const canParticipate = debate && (debate.status === 'scheduled' || debate.status === 'running');
  const displayedTurns = showAllTurns
    ? debate?.turns
    : debate?.turns.slice(-3);
  const visibleContributions = contributions.slice(-3);

  return (
    <section className="relative overflow-hidden bg-bg-surface/50 border-y border-border-subtle">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-prism-purple/20 blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-prism-blue/20 blur-[60px]" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-prism-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">守望者计划</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-prism-blue/10 text-prism-blue font-medium">
                  {mounted ? getTimeGreeting() : '你好'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">每日三位思想家轮值，守护社区智慧</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-bg-elevated transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">值班表</span>
            </button>
            <button
              onClick={fetchAll}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Guardians */}
        {loading && guardians.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border-subtle bg-bg-elevated p-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-bg-surface mb-3" />
                <div className="h-4 bg-bg-surface rounded w-3/4 mb-2" />
                <div className="h-3 bg-bg-surface rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : guardians.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-sm">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>今日守望者加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {guardians.map((guardian, i) => {
              const isCompleted = guardian.status === 'completed';
              const count = guardian.interactionCount ?? 0;
              const target = guardian.targetCount ?? 5;
              const progressPct = Math.min(100, Math.round((count / target) * 100));

              return (
                <motion.div
                  key={`${guardian.personaId}-${guardian.slot}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative rounded-xl border bg-bg-elevated p-4 transition-all hover:shadow-lg hover:shadow-black/20"
                  style={{
                    borderColor: isCompleted ? guardian.gradientFrom : 'var(--border-subtle)',
                  }}
                >
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      任务完成
                    </div>
                  )}

                  <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-overlay border border-border-subtle text-text-muted">
                    守望者 {slotLabels[guardian.slot - 1]}
                  </div>

                  <Link
                    href={`/personas/${guardian.personaSlug || guardian.personaId}`}
                    className="block flex items-center gap-3 mt-1 mb-3 hover:opacity-80 transition-opacity"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${guardian.gradientFrom}, ${guardian.gradientTo})`,
                        boxShadow: `0 4px 12px ${guardian.gradientFrom}40`,
                      }}
                    >
                      {guardian.personaNameZh[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{guardian.personaNameZh}</p>
                      <p className="text-[11px] text-text-muted truncate">{guardian.personaTagline}</p>
                      <p className="text-[10px] text-prism-blue/60 mt-0.5 flex items-center gap-1">
                        <span>点击了解 →</span>
                      </p>
                    </div>
                  </Link>

                  <div className="mb-3">
                    <div
                      className="text-[11px] text-text-secondary leading-relaxed line-clamp-2"
                      title={guardian.shiftTheme}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1 text-prism-purple flex-shrink-0" />
                      {guardian.shiftTheme}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                      <span className="flex items-center gap-1">
                        {isCompleted ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        今日互动
                      </span>
                      <span className={isCompleted ? 'text-emerald-500 font-medium' : ''}>
                        {count} / {target} {isCompleted ? '✓' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: isCompleted
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : `linear-gradient(90deg, ${guardian.gradientFrom}, ${guardian.gradientTo})`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at center, ${guardian.gradientFrom}08 0%, transparent 70%)`,
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-4 flex flex-col items-center gap-3">
          {/* Debate Content — embedded inside GuardianBanner, no separate section needed */}
          {(debate || debatePreview) && (
            <div className="w-full space-y-3">
              {/* Debate Header */}
              <div className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {debate?.status === 'running' ? '智辩场进行中' :
                     debate?.status === 'scheduled' ? '今日辩论预告' :
                     debatePreview ? '今日辩论预告' : '辩论预告'}
                  </span>
                  {debate?.status && (() => {
                    const cfg = STATUS_META[debate.status as keyof typeof STATUS_META] ?? STATUS_META.completed;
                    return (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', cfg.color, cfg.bg)}>
                        {cfg.label}
                      </span>
                    );
                  })()}
                  {debate?.status === 'running' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-text-secondary mb-2">
                  辩题：<span className="text-text-primary font-medium">
                    {debate?.topic ?? debatePreview?.topic}
                  </span>
                </div>

                {/* Live CTA — 论坛运营优化：辩论进行中时醒目引导参与 */}
                {debate?.status === 'running' && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <button
                      onClick={() => { setShowParticipation(true); document.getElementById('debate-participation')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                        'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 animate-pulse',
                        'text-red-300 hover:from-red-500/30 hover:to-orange-500/30'
                      )}
                      style={{ boxShadow: '0 0 20px rgba(239,68,68,0.15)' }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      🔥 我想说几句 — 围观也能发声
                    </button>
                  </div>
                )}

                {/* Non-running: show conflicts/promises as hook */}
                {(debate?.status === 'completed' || debatePreview) && debate?.status !== 'running' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                    <Eye className="w-3 h-3" />
                    <span>围观也能参与 · 辩论结束后可继续讨论</span>
                  </div>
                )}

                {/* Preview highlights & conflicts */}
                {debatePreview && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {debatePreview.highlights?.map((h, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
                          {h}
                        </span>
                      ))}
                    </div>
                    {debatePreview.conflicts && debatePreview.conflicts.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {debatePreview.conflicts.slice(0, 2).map((c, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[10px] text-text-muted">
                            <span className="text-red-400/60 flex-shrink-0 mt-0.5">⚡</span>
                            <span className="leading-relaxed">{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {debatePreview?.estimatedStartTime && debate?.status !== 'running' && (
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mb-2">
                    <Clock className="w-3 h-3" />
                    <span>预计 {debatePreview.estimatedStartTime} 开始 · 共 {debatePreview.estimatedTurns} 轮</span>
                  </div>
                )}

                {/* Admin controls */}
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    {adminMsg && (
                      <div className={`text-xs mb-2 px-2 py-1 rounded ${adminMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {adminMsg.text}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {debate?.status === 'scheduled' && (
                        <button
                          onClick={handleAdminDebateAction}
                          disabled={adminLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                        >
                          {adminLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          启动辩论
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-admin: debate content is inline — no link needed */}
                {!isAdmin && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                    <Flame className="w-3 h-3 text-red-400" />
                    <span>辩论内容在下方围观区直接可见</span>
                  </div>
                )}
              </div>

              {/* Debate Turns — show when debate has turns */}
              {debate && debate.turns.length > 0 && (
                <div className="space-y-2">
                  {(displayedTurns ?? []).map((turn, idx) => (
                    <DebateTurnCard key={idx} turn={turn} />
                  ))}
                  {debate.turns.length > 3 && (
                    <button
                      onClick={() => setShowAllTurns(!showAllTurns)}
                      className="w-full flex items-center justify-center gap-1 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {showAllTurns ? (
                        <span>收起</span>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" />查看全部（{debate.turns.length}条）</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Visitor participation */}
              {canParticipate && (
                <div id="debate-participation" className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <button
                    onClick={() => setShowParticipation(!showParticipation)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all',
                      showParticipation
                        ? 'bg-prism-blue/20 border border-prism-blue/50 text-prism-blue'
                        : 'bg-white/5 border border-white/10 text-text-muted hover:text-text-secondary'
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {showParticipation ? '收起参与面板' : '我也想说几句 ✨'}
                  </button>

                  {showParticipation && (
                    <form onSubmit={handleSubmitContribution} className="mt-3 space-y-2">
                      <textarea
                        value={contributionText}
                        onChange={e => setContributionText(e.target.value)}
                        placeholder="围绕今日辩题写下你的观点..."
                        maxLength={300}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:border-prism-blue/50 transition-colors resize-none"
                      />
                      {contributionError && (
                        <p className="text-xs text-red-400">{contributionError}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">{contributionText.length}/300</span>
                        <button
                          type="submit"
                          disabled={!contributionText.trim() || submittingContribution || contributionText.length < 2}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-prism-gradient text-white text-xs disabled:opacity-50 transition-opacity"
                        >
                          {submittingContribution ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          {submittingContribution ? '发送中...' : '发言'}
                        </button>
                      </div>

                      {visibleContributions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] text-text-muted">围观发言 ({contributions.length})</p>
                          {visibleContributions.map(c => (
                            <div key={c.id} className="flex items-start gap-2 rounded-lg p-2 bg-white/5 border border-white/5">
                              <div className="w-5 h-5 rounded-full bg-gray-600/50 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] text-gray-400">👤</span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Completed — show contributions */}
              {debate?.status === 'completed' && contributions.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[10px] text-text-muted mb-2">围观发言 ({contributions.length})</p>
                  {visibleContributions.map(c => (
                    <div key={c.id} className="flex items-start gap-2 mb-2 last:mb-0">
                      <div className="w-5 h-5 rounded-full bg-gray-600/50 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-gray-400">👤</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Eye className="w-3 h-3" />
            <span>发表评论，即有机会获得守望者回复</span>
          </div>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <GuardianCalendarModal onClose={() => setShowCalendar(false)} />
      )}
    </section>
  );
}

/* ─── Guardian Calendar Modal ─────────────────────────────────────────── */
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

  const scheduleEntries = Object.entries(schedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 14);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-bg-elevated border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <div>
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-prism-blue" />
                守望者排班表
              </h3>
              <p className="text-xs text-text-muted mt-0.5">未来两周值班安排</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto max-h-[60vh] p-6">
            {loading ? (
              <div className="text-center py-12 text-text-muted">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : scheduleEntries.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-sm">
                暂无排班数据
              </div>
            ) : (
              <div className="space-y-3">
                {scheduleEntries.map(([date, day]) => {
                  const isToday = date === todayStr;
                  const dayObj = new Date(date + 'T00:00:00');
                  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

                  return (
                    <div
                      key={date}
                      className={`flex items-start gap-4 p-3 rounded-xl ${
                        isToday
                          ? 'bg-prism-blue/5 border border-prism-blue/20'
                          : 'border border-border-subtle'
                      }`}
                    >
                      {/* Date */}
                      <div className="w-20 flex-shrink-0 text-center">
                        <p className={`text-xs font-medium ${isToday ? 'text-prism-blue' : 'text-text-muted'}`}>
                          {days[dayObj.getDay()]}
                        </p>
                        <p className={`text-lg font-bold ${isToday ? 'text-prism-blue' : 'text-text-primary'}`}>
                          {date.slice(5).replace('-', '/')}
                        </p>
                        {isToday && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-prism-blue/10 text-prism-blue">今日</span>
                        )}
                      </div>

                      {/* Guardians */}
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {day.map((g) => (
                          <div key={g.slot} className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${g.gradientFrom}, ${g.gradientTo})`,
                              }}
                            >
                              {g.personaNameZh[0]}
                            </div>
                            <span className="text-xs text-text-secondary truncate">{g.personaNameZh}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border-subtle">
            <Link
              href="/personas"
              onClick={onClose}
              className="flex items-center justify-center gap-2 text-sm text-prism-blue hover:underline"
            >
              了解所有守望者
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
