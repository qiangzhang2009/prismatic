'use client';

/**
 * Prismatic — Debate Arena Page Client
 * 智辩场 — 每日辩论围观页（客户端交互）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Flame, Users, Clock, ArrowLeft,
  MessageSquare, ThumbsUp, Eye, ChevronRight,
  Send, Loader2, User, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPersonasByIds } from '@/lib/personas';
import type { DebateRecord, DebateTurn } from '@/lib/debate-arena-engine';

interface DebateArenaClientProps {
  debate?: DebateRecord | null;
  preview?: {
    topic: string;
    guardians: Array<{ personaId: string; personaNameZh: string }>;
    estimatedTurns: number;
  };
  error?: string;
}

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

function PersonaBubble({ personaId, name, size = 'md' }: { personaId: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white', sz)}>
      {name.slice(0, 2)}
    </div>
  );
}

function TurnCard({ turn, persona }: { turn: DebateTurn; persona?: { nameZh: string; taglineZh: string } }) {
  const meta = TONE_META[turn.tone] ?? TONE_META.opening;
  const isModerator = turn.speakerId === 'moderator';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'rounded-2xl p-5 border',
        isModerator
          ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30'
          : 'bg-[#1a1a2e]/80 border-white/10'
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        {isModerator ? (
          <div className="w-10 h-10 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-lg">🎭</div>
        ) : (
          <PersonaBubble personaId={turn.speakerId} name={turn.speakerName} />
        )}
        <div>
          <div className={cn('font-bold text-sm', isModerator ? 'text-purple-300' : 'text-white')}>
            {turn.speakerName}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', meta.color)}>{meta.emoji} {meta.label}</span>
            {turn.round > 0 && <span className="text-xs text-gray-500">第{turn.round}轮</span>}
          </div>
        </div>
        <div className="ml-auto text-xs text-gray-500">
          {new Date(turn.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className={cn('text-sm leading-relaxed', isModerator ? 'text-purple-200' : 'text-gray-200')}>
        {turn.content}
      </div>
      {!isModerator && persona?.taglineZh && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500 italic">
          — {persona.taglineZh}
        </div>
      )}
    </motion.div>
  );
}

// Visitor Contribution Card
function VisitorCard({ contribution }: { contribution: VisitorContribution }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl p-4 bg-white/5 border border-white/10"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-600/50 border border-white/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {contribution.isAiResponse && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-prism-blue/20 text-prism-blue">
                <Sparkles className="w-2.5 h-2.5" />
                AI 回复
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(contribution.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{contribution.content}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function DebateArenaClient({ debate, preview, error }: DebateArenaClientProps) {
  const [tab, setTab] = useState<'debate' | 'history'>('debate');
  const [history, setHistory] = useState<DebateRecord[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState(false);

  // Visitor participation state
  const [contributions, setContributions] = useState<VisitorContribution[]>([]);
  const [contributionText, setContributionText] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const contributionsEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/forum/debate?path=history&limit=7');
      const data = await res.json();
      setHistory(data.debates ?? []);
    } catch { /* silent */ }
  }, []);

  const loadContributions = useCallback(async () => {
    if (!debate) return;
    try {
      const res = await fetch(`/api/forum/debate/visitor?debateId=${debate.id}`);
      if (res.ok) {
        const data = await res.json();
        setContributions(data.contributions ?? []);
      }
    } catch { /* silent */ }
  }, [debate?.id]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  // Load contributions when debate changes and showVisitorForm is open
  useEffect(() => {
    if (debate && showVisitorForm) {
      loadContributions();
    }
  }, [debate, showVisitorForm, loadContributions]);

  // Auto-scroll to newest contribution
  useEffect(() => {
    if (contributions.length > 0) {
      contributionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [contributions.length]);

  const handleVote = async (personaId: string) => {
    if (!debate || voted) return;
    try {
      await fetch('/api/forum/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', debateId: debate.id, personaId, userId: 'anon' }),
      });
      setVoted(true);
      setVotes((p) => ({ ...p, [personaId]: (p[personaId] ?? 0) + 1 }));
    } catch { /* silent */ }
  };

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
      setContributionError('网络错误，请重试');
    } finally {
      setSubmittingContribution(false);
    }
  };

  const personas = debate ? getPersonasByIds(debate.participantIds) : [];
  const personaMap = new Map(personas.map((p) => [p.id, p]));
  const canParticipate = debate && (debate.status === 'scheduled' || debate.status === 'running');

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>加载失败，请稍后重试。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      {/* ── Sticky header ───────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[#0d0d1a]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <span className="text-xl">🔥</span>
          <h1 className="font-bold text-white">智辩场</h1>
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /><span>{debate?.liveViewers ?? 0} 在线</span></div>
            <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /><span>{debate?.viewCount ?? 0} 围观</span></div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Tabs ──────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
          {[
            { key: 'debate', label: '辩论', icon: Flame },
            { key: 'history', label: '往期', icon: Clock },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                tab === key ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Debate tab ─────────────────────────────────── */}
          {tab === 'debate' && (
            <motion.div key="debate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

              {/* No debate yet — show preview */}
              {!debate && preview && (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">🔥</div>
                  <h2 className="text-xl font-bold text-white mb-2">今日辩论即将开始</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    {preview.guardians.map((g) => g.personaNameZh).join('、')} 三位思想家将就以下话题展开辩论
                  </p>
                  <div className="bg-white/5 rounded-2xl p-5 max-w-lg mx-auto mb-6 border border-white/10">
                    <div className="text-xs text-gray-500 mb-2">今日话题</div>
                    <div className="text-lg font-bold text-white">{preview.topic}</div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    {preview.guardians.map((g) => (
                      <PersonaBubble key={g.personaId} personaId={g.personaId} name={g.personaNameZh} size="lg" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    辩论将在开始后自动进行，你可以围观并参与讨论
                  </p>
                </div>
              )}

              {/* Debate loaded */}
              {debate && (
                <>
                  {/* Topic hero */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      {(() => {
                        const cfg = STATUS_META[debate.status as keyof typeof STATUS_META] ?? STATUS_META.completed;
                        return <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', cfg.color, cfg.bg)}>{cfg.label}</span>;
                      })()}
                      <span className="text-xs text-gray-500">{debate.date} · {debate.participantIds.length} 位思想家</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">{debate.topic}</h2>
                    <div className="flex items-center gap-3">
                      {debate.participantIds.map((pid) => {
                        const p = personaMap.get(pid);
                        return (
                          <div key={pid} className="flex items-center gap-2">
                            <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="sm" />
                            <span className="text-sm text-gray-300">{p?.nameZh}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live banner */}
                  {debate.status === 'running' && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="text-sm text-red-300 font-medium">辩论正在进行中，你也可以参与讨论...</span>
                    </div>
                  )}

                  {/* Visitor participation toggle */}
                  {canParticipate && (
                    <div className="mb-6">
                      <button
                        onClick={() => setShowVisitorForm(!showVisitorForm)}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
                          showVisitorForm
                            ? 'bg-prism-blue/20 border border-prism-blue/50 text-prism-blue'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200'
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {showVisitorForm ? '收起参与面板' : '我也想说几句 ✨'}
                      </button>
                    </div>
                  )}

                  {/* Visitor participation panel */}
                  <AnimatePresence>
                    {showVisitorForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 space-y-4 overflow-hidden"
                      >
                        {/* Contribution form */}
                        <form onSubmit={handleSubmitContribution} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">围观群众发言</span>
                          </div>
                          <textarea
                            value={contributionText}
                            onChange={(e) => setContributionText(e.target.value)}
                            placeholder="在这里写下你的观点、提问或回应..."
                            maxLength={300}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-prism-blue/50 transition-colors resize-none mb-3 text-sm"
                          />
                          {contributionError && (
                            <div className="mb-3 text-xs text-red-400">{contributionError}</div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{contributionText.length}/300</span>
                            <button
                              type="submit"
                              disabled={!contributionText.trim() || submittingContribution || contributionText.length < 2}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-prism-gradient text-white text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
                            >
                              {submittingContribution ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              {submittingContribution ? '发送中...' : '发言'}
                            </button>
                          </div>
                        </form>

                        {/* Contributions list */}
                        {contributions.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs text-gray-500 font-medium px-1">
                              围观发言 ({contributions.length})
                            </div>
                            <AnimatePresence>
                              {contributions.map((c) => (
                                <VisitorCard key={c.id} contribution={c} />
                              ))}
                            </AnimatePresence>
                            <div ref={contributionsEndRef} />
                          </div>
                        )}

                        {contributions.length === 0 && (
                          <div className="text-center py-6 text-xs text-gray-500">
                            还没有围观发言，来说第一句吧 ✨
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Turns timeline */}
                  <div className="space-y-4">
                    {debate.turns.map((turn, idx) => (
                      <TurnCard
                        key={idx}
                        turn={turn}
                        persona={turn.speakerId !== 'moderator' ? personaMap.get(turn.speakerId) : undefined}
                      />
                    ))}
                  </div>

                  {/* Visitor contributions after turns (completed debate) */}
                  {debate.status === 'completed' && contributions.length > 0 && (
                    <div className="mt-8">
                      <div className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        围观发言 ({contributions.length})
                      </div>
                      <div className="space-y-3">
                        {contributions.map((c) => (
                          <VisitorCard key={c.id} contribution={c} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vote section */}
                  {debate.status === 'completed' && (
                    <div className="mt-8 bg-white/5 rounded-2xl p-5 border border-white/10">
                      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4" />你站谁？
                      </h3>
                      {voted ? (
                        <div className="flex items-center gap-4">
                          {debate.participantIds.map((pid) => {
                            const p = personaMap.get(pid);
                            return (
                              <div key={pid} className="flex items-center gap-2">
                                <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="sm" />
                                <span className="text-sm text-gray-300">{p?.nameZh}</span>
                                <span className="text-xs text-gray-500">{votes[pid] ?? 0}票</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {debate.participantIds.map((pid) => {
                            const p = personaMap.get(pid);
                            return (
                              <button
                                key={pid}
                                onClick={() => handleVote(pid)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 transition-all"
                              >
                                <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="md" />
                                <span className="text-xs font-medium text-gray-200">{p?.nameZh}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── History tab ──────────────────────────────────── */}
          {tab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
              {history.map((item) => (
                <Link
                  key={item.id}
                  href={`/forum/debate?id=${item.id}`}
                  className="block bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">{item.date}</div>
                      <div className="font-bold text-white mb-2">{item.topic}</div>
                      <div className="flex items-center gap-3">
                        {item.participantIds.slice(0, 3).map((pid) => {
                          const p = personas.find((x) => x.id === pid);
                          return (
                            <div key={pid} className="flex items-center gap-1">
                              <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="sm" />
                              <span className="text-xs text-gray-400">{p?.nameZh}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border',
                        STATUS_META[item.status as keyof typeof STATUS_META]?.color,
                        STATUS_META[item.status as keyof typeof STATUS_META]?.bg,
                      )}>
                        {STATUS_META[item.status as keyof typeof STATUS_META]?.label ?? item.status}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="w-3 h-3" />{item.viewCount}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {history.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">暂无历史辩论记录</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
