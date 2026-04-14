'use client';

/**
 * Prismatic — Guardian Banner
 * "守望者计划" Hero Component
 *
 * Displays today's 3 guardian personas with their shift themes and interaction progress.
 * Creates daily anticipation — "Who is watching over us today?"
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Shield, Sparkles, Calendar, ChevronRight, RefreshCw, Eye, CheckCircle2, Clock, Flame, Play, Loader2 } from 'lucide-react';

interface Guardian {
  slot: number;
  personaId: string;
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

// ScheduleDay is the value type in the schedule Record — an array of guardian entries for one date
type ScheduleDay = Array<{
  slot: number;
  personaId: string;
  personaNameZh: string;
  gradientFrom: string;
  gradientTo: string;
  shiftTheme: string;
  maxInteractions: number;
}>;

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

export function GuardianBanner() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Debate state
  const [debateInfo, setDebateInfo] = useState<{
    id: number;
    topic: string;
    status: string;
    participantIds: string[];
  } | null>(null);
  const [debatePreview, setDebatePreview] = useState<{
    topic: string;
    guardians: Array<{ personaId: string; personaNameZh: string }>;
    estimatedTurns: number;
    estimatedStartTime: string;
    highlights: string[];
    conflicts: string[];
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [guardianRes, statsRes, debateRes, meRes] = await Promise.all([
        fetch('/api/guardian'),
        fetch('/api/guardian/stats'),
        fetch('/api/forum/debate'),
        fetch('/api/auth/me'),
      ]);

      const guardianData = guardianRes.ok ? await guardianRes.json() : {};
      const statsData = statsRes.ok ? await statsRes.json() : {};
      const debateData = debateRes.ok ? await debateRes.json() : {};
      const meData = meRes.ok ? await meRes.json() : {};

      const guardiansFromApi: any[] = Array.isArray(guardianData.guardians) ? guardianData.guardians : [];
      const statsMap: Record<string, any> = {};

      if (statsData.guardians && Array.isArray(statsData.guardians)) {
        for (const s of statsData.guardians) {
          if (s?.personaId) {
            statsMap[s.personaId] = s;
          }
        }
      }

      const merged = guardiansFromApi.map((g: any) => {
        const stats = statsMap[g.personaId];
        return stats ? { ...g, ...stats } : g;
      });

      setGuardians(merged);
      setDebateInfo(debateData.debate ?? null);
      setDebatePreview(debateData.preview ?? null);
      setIsAdmin(meData?.user?.isAdmin === true);
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

  const slotLabels = ['壹', '贰', '叁'];

  const handleAdminDebateAction = async () => {
    setAdminLoading(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/forum/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', debateId: debateInfo?.id }),
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
                  {/* Completed badge */}
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      任务完成
                    </div>
                  )}

                  {/* Slot badge */}
                  <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-overlay border border-border-subtle text-text-muted">
                    守望者 {slotLabels[guardian.slot - 1]}
                  </div>

                  {/* Avatar */}
                  <div className="flex items-center gap-3 mt-1 mb-3">
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
                    </div>
                  </div>

                  {/* Shift theme */}
                  <div className="mb-3">
                    <div
                      className="text-[11px] text-text-secondary leading-relaxed line-clamp-2"
                      title={guardian.shiftTheme}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1 text-prism-purple flex-shrink-0" />
                      {guardian.shiftTheme}
                    </div>
                  </div>

                  {/* Progress bar */}
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

                  {/* Hover glow */}
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
          {/* Debate Preview Card */}
          {(debatePreview || debateInfo) && (
            <div className="w-full max-w-md bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔥</span>
                <span className="text-sm font-semibold text-text-primary">
                  {debateInfo?.status === 'running' ? '智辩场进行中' :
                   debateInfo?.status === 'scheduled' ? '今日辩论预告' :
                   '今日辩论预告'}
                </span>
                {debateInfo?.status === 'running' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary mb-2">
                辩题：<span className="text-text-primary font-medium">{debatePreview?.topic ?? debateInfo?.topic}</span>
              </div>
              {/* 辩论预告详情 */}
              {(debatePreview || debateInfo) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {debatePreview?.highlights?.map((h, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
                      {h}
                    </span>
                  ))}
                </div>
              )}
              {/* 辩论矛盾点 */}
              {debatePreview?.conflicts && debatePreview.conflicts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {debatePreview.conflicts.slice(0, 2).map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-text-muted">
                      <span className="text-red-400/60 flex-shrink-0 mt-0.5">⚡</span>
                      <span className="leading-relaxed">{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 辩论时间预估 */}
              {debatePreview?.estimatedStartTime && debateInfo?.status !== 'running' && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-text-muted">
                  <Clock className="w-3 h-3" />
                  <span>预计 {debatePreview.estimatedStartTime} 开始 · 共 {debatePreview.estimatedTurns} 轮</span>
                </div>
              )}

              {/* Admin Debate Controls */}
              {isAdmin && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  {adminMsg && (
                    <div className={`text-xs mb-2 px-2 py-1 rounded ${adminMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {adminMsg.text}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {debateInfo?.status === 'scheduled' && (
                      <button
                        onClick={handleAdminDebateAction}
                        disabled={adminLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                      >
                        {adminLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        启动辩论
                      </button>
                    )}
                    <Link
                      href="/forum/debate"
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text-secondary text-xs hover:text-text-primary hover:bg-white/10 transition-colors"
                    >
                      <Flame className="w-3 h-3" />
                      {debateInfo?.status === 'running' ? '围观辩论' : '进入智辩场'}
                    </Link>
                  </div>
                </div>
              )}

              {/* Non-admin: direct link */}
              {!isAdmin && (
                <div className="mt-2">
                  <Link
                    href="/forum/debate"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <Flame className="w-3 h-3" />
                    {debateInfo?.status === 'running' ? '围观辩论进行中' :
                     debateInfo?.status === 'scheduled' ? '查看辩论预告' : '查看今日辩论'}
                  </Link>
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
