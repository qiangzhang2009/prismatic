'use client';

/**
 * Prismatic — Debate Arena Page Client
 * 智辩场 — 每日辩论围观页（客户端交互）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame, Users, Clock, ArrowLeft,
  MessageSquare, ThumbsUp, Eye, ChevronRight,
  Send, Loader2, User, Sparkles, Shield, RefreshCw, Play, AlertCircle
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
    estimatedStartTime?: string;
    highlights?: string[];
    conflicts?: string[];
  };
  error?: string;
}

interface VisitorContribution {
  id: number;
  content: string;
  createdAt: string;
  visitorId: string;
  nickname: string;
  avatarUrl: string;
  isAiResponse: boolean;
  /** 被引用的辩论轮次 ID */
  quotedTurnId?: number;
  /** 被引用的人物 ID（@人物） */
  mentionedPersonaId?: string;
}

interface QuotedTurn {
  id: number;
  speakerName: string;
  content: string;
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

function TurnCard({ turn, persona, onQuote, onMention }: {
  turn: DebateTurn;
  persona?: { nameZh: string; taglineZh: string };
  onQuote?: (turn: QuotedTurn) => void;
  onMention?: (personaId: string) => void;
}) {
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
        <div className="ml-auto flex items-center gap-3">
          {/* Quote button */}
          {!isModerator && onQuote && (
            <button
              onClick={() => onQuote({ id: turn.debateId * 1000 + turn.round, speakerName: turn.speakerName, content: turn.content.slice(0, 80) })}
              title="引用这段发言到围观区"
              className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
            </button>
          )}
          {/* @Mention button */}
          {!isModerator && onMention && (
            <button
              onClick={() => onMention(turn.speakerId)}
              title={`@${turn.speakerName}`}
              className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
            </button>
          )}
          <div className="text-xs text-gray-500">
            {new Date(turn.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
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
        <Image
          src={contribution.avatarUrl}
          alt={contribution.nickname}
          width={32}
          height={32}
          unoptimized
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-medium text-gray-200">{contribution.nickname}</span>
            {/* @Mention badge */}
            {contribution.mentionedPersonaId && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                @{contribution.mentionedPersonaId}
              </span>
            )}
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
          {/* Quoted turn */}
          {contribution.quotedTurnId && (
            <div className="mb-2 pl-3 border-l-2 border-blue-500/40 text-xs text-blue-300/70 italic">
              <span className="text-blue-400/60 font-medium">引用发言</span>
            </div>
          )}
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

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(true); // 默认展开，方便管理员操作
  const [customTopic, setCustomTopic] = useState('');

  // Visitor participation state
  const [contributions, setContributions] = useState<VisitorContribution[]>([]);
  const [contributionText, setContributionText] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuotedTurn | null>(null);
  const [selectedMention, setSelectedMention] = useState<string | null>(null);
  const [showQuotePanel, setShowQuotePanel] = useState(false);
  const [showMentionPanel, setShowMentionPanel] = useState(false);
  const contributionsEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/forum/debate?path=history&limit=7');
      const data = await res.json();
      setHistory(data.debates ?? []);
    } catch { /* silent */ }
  }, []);

  // Check admin status on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {/* silent */});
  }, []);

  const handleAdminAction = async (action: 'start' | 'create', topic?: string) => {
    if (!debate && action === 'start') return;
    setAdminLoading(true);
    setAdminMessage(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === 'start') body.debateId = debate!.id;
      if (action === 'create' && topic) body.topic = topic;

      const res = await fetch('/api/forum/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage({ type: 'success', text: action === 'start' ? '辩论已启动！' : `辩论已创建 (ID: ${data.debateId})` });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setAdminMessage({ type: 'error', text: data.error || '操作失败' });
      }
    } catch {
      setAdminMessage({ type: 'error', text: '网络错误' });
    } finally {
      setAdminLoading(false);
    }
  };

  const loadContributions = useCallback(async () => {
    if (!debate) return;
    try {
      const res = await fetch(`/api/forum/debate/visitor?debateId=${debate.id}`);
      if (res.ok) {
        const data = await res.json();
        setContributions(data.contributions ?? []);
      }
    } catch { /* silent */ }
  }, [debate]);

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
        body: JSON.stringify({
          debateId: debate.id,
          content: contributionText.trim(),
          quotedTurnId: selectedQuote?.id,
          mentionedPersonaId: selectedMention,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setContributionError(data.error || '提交失败');
        return;
      }

      setContributions(prev => [...prev, data.contribution]);
      setContributionText('');
      setSelectedQuote(null);
      setSelectedMention(null);
    } catch {
      setContributionError('网络错误，请重试');
    } finally {
      setSubmittingContribution(false);
    }
  };

  const personas = debate ? getPersonasByIds(debate.participantIds) : [];
  const personaMap = new Map(personas.map((p) => [p.id, p]));
  const canParticipate = debate && (debate.status === 'scheduled' || debate.status === 'running' || debate.status === 'completed');

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

      {/* ── Admin Control Panel ─────────────────────────────── */}
      {isAdmin && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">管理员控制</span>
              </div>
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="text-xs text-amber-400/60 hover:text-amber-300 transition-colors"
              >
                {showAdminPanel ? '收起' : '展开'}
              </button>
            </div>

            {showAdminPanel && (
              <div className="space-y-3">
                {adminMessage && (
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                    adminMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                  )}>
                    {adminMessage.type === 'success' ? <Sparkles className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {adminMessage.text}
                  </div>
                )}

                {debate?.status === 'scheduled' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdminAction('start')}
                      disabled={adminLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-all"
                    >
                      {adminLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      启动辩论
                    </button>
                  </div>
                )}

                {!debate && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="输入自定义话题（留空使用默认话题）"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder:text-gray-500 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    <button
                      onClick={() => handleAdminAction('create', customTopic)}
                      disabled={adminLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-all"
                    >
                      {adminLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      创建辩论 {customTopic ? '(自定义)' : '(默认话题)'}
                    </button>
                  </div>
                )}

                {debate?.status === 'running' && (
                  <p className="text-xs text-amber-400/60">辩论进行中，刷新页面查看最新进展</p>
                )}

                {debate?.status === 'completed' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="输入自定义话题"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder:text-gray-500 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    <button
                      onClick={() => handleAdminAction('create', customTopic)}
                      disabled={adminLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-all"
                    >
                      {adminLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      创建新辩论
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                <div className="space-y-6 py-6">
                  {/* 辩论公告头部 */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/20 bg-red-500/5 mb-4">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="text-xs text-red-400 font-medium">今日辩论 · 即将开始</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">🔥 {preview.topic}</h2>
                  </div>

                  {/* 辩论规则卡片 */}
                  <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">📋</span>
                      <h3 className="text-sm font-semibold text-amber-300">辩论规则</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-amber-400/60 mt-0.5">01</span>
                        <div>
                          <p className="text-xs font-medium text-amber-200">开场陈述</p>
                          <p className="text-[11px] text-amber-400/60">每位思想家发表开场观点</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-amber-400/60 mt-0.5">02</span>
                        <div>
                          <p className="text-xs font-medium text-amber-200">交叉质询</p>
                          <p className="text-[11px] text-amber-400/60">3轮深度辩论与回应</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-amber-400/60 mt-0.5">03</span>
                        <div>
                          <p className="text-xs font-medium text-amber-200">精彩总结</p>
                          <p className="text-[11px] text-amber-400/60">主持人提炼各方观点</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-amber-400/60 mt-0.5">04</span>
                        <div>
                          <p className="text-xs font-medium text-amber-200">观众互动</p>
                          <p className="text-[11px] text-amber-400/60">围观者可发表观点参与</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 今日辩手 */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-4">今日辩手</p>
                    <div className="flex items-center justify-center gap-4 mb-4">
                      {preview.guardians.map((g) => (
                        <div key={g.personaId} className="flex flex-col items-center gap-2">
                          <PersonaBubble personaId={g.personaId} name={g.personaNameZh} size="lg" />
                          <span className="text-sm text-gray-300">{g.personaNameZh}</span>
                        </div>
                      ))}
                    </div>
                    {preview.estimatedStartTime && (
                      <p className="text-xs text-gray-500">
                        预计开始时间：<span className="text-gray-300">{preview.estimatedStartTime}</span>
                      </p>
                    )}
                  </div>

                  {/* 围观提示 */}
                  <div className="text-center py-4 border-t border-white/5">
                    <p className="text-xs text-gray-500">
                      辩论开始后自动进行，你可以围观并参与讨论
                    </p>
                  </div>
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
                            <div className="w-8 h-8 rounded-full bg-gray-600/50 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <User className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className="text-sm text-gray-400">围观群众发言</span>
                            <div className="ml-auto flex items-center gap-1.5">
                              {/* Quote button */}
                              <button
                                type="button"
                                onClick={() => { setShowQuotePanel(!showQuotePanel); setShowMentionPanel(false); }}
                                className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', selectedQuote ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-200 hover:bg-white/10')}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                                引用
                              </button>
                              {/* @Mention button */}
                              <button
                                type="button"
                                onClick={() => { setShowMentionPanel(!showMentionPanel); setShowQuotePanel(false); }}
                                className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', selectedMention ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-200 hover:bg-white/10')}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                                @
                              </button>
                            </div>
                          </div>

                          {/* Quote selector panel */}
                          {showQuotePanel && (
                            <div className="mb-3 bg-white/5 rounded-xl p-3 border border-blue-500/20">
                              <p className="text-xs text-blue-400 mb-2">选择要引用的发言</p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {debate.turns.map((t, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setSelectedQuote({ id: t.debateId * 1000 + t.round, speakerName: t.speakerName, content: t.content.slice(0, 80) }); setShowQuotePanel(false); }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                  >
                                    <span className="text-blue-400 font-medium">【{t.speakerName}】</span>
                                    <span className="text-gray-400 ml-1">{t.content.slice(0, 40)}…</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* @Mention selector panel */}
                          {showMentionPanel && (
                            <div className="mb-3 bg-white/5 rounded-xl p-3 border border-blue-500/20">
                              <p className="text-xs text-blue-400 mb-2">@哪一位思想家</p>
                              <div className="flex gap-2 flex-wrap">
                                {debate.participantIds.map(pid => {
                                  const p = personaMap.get(pid);
                                  return (
                                    <button
                                      key={pid}
                                      type="button"
                                      onClick={() => { setSelectedMention(p?.nameZh ?? pid); setShowMentionPanel(false); }}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                    >
                                      <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="sm" />
                                      <span className="text-gray-200">@{p?.nameZh ?? pid}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Active selections display */}
                          {(selectedQuote || selectedMention) && (
                            <div className="mb-3 flex items-center gap-2 flex-wrap">
                              {selectedQuote && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                                  <span className="text-blue-300">引用「{selectedQuote.speakerName}」</span>
                                  <button type="button" onClick={() => setSelectedQuote(null)} className="text-blue-400/50 hover:text-blue-300 ml-1">✕</button>
                                </div>
                              )}
                              {selectedMention && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                                  <span className="text-blue-300">@{selectedMention}</span>
                                  <button type="button" onClick={() => setSelectedMention(null)} className="text-blue-400/50 hover:text-blue-300 ml-1">✕</button>
                                </div>
                              )}
                            </div>
                          )}

                          <textarea
                            value={contributionText}
                            onChange={(e) => setContributionText(e.target.value)}
                            placeholder={selectedMention ? `@{selectedMention}，你的观点是…` : '在这里写下你的观点、提问或回应…'}
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
                        onQuote={(q) => { setSelectedQuote(q); setShowVisitorForm(true); }}
                        onMention={(pid) => {
                          const p = personaMap.get(pid);
                          setSelectedMention(p?.nameZh ?? pid);
                          setShowVisitorForm(true);
                        }}
                      />
                    ))}
                  </div>

                  {/* Visitor contributions after turns (completed debate) — always visible */}
                  {debate.status === 'completed' && (
                    <div className="mt-8 space-y-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">围观发言</span>
                        <span className="text-xs text-gray-600">辩论结束后仍可继续讨论</span>
                      </div>
                      <form onSubmit={handleSubmitContribution} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-gray-600/50 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="text-sm text-gray-400">围观群众发言</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setShowQuotePanel(!showQuotePanel); setShowMentionPanel(false); }}
                              className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', selectedQuote ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-200 hover:bg-white/10')}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                              引用
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowMentionPanel(!showMentionPanel); setShowQuotePanel(false); }}
                              className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all', selectedMention ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-200 hover:bg-white/10')}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                              @
                            </button>
                          </div>
                        </div>
                        {showQuotePanel && (
                          <div className="mb-3 bg-white/5 rounded-xl p-3 border border-blue-500/20">
                            <p className="text-xs text-blue-400 mb-2">选择要引用的发言</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {debate.turns.map((t, i) => (
                                <button key={i} type="button"
                                  onClick={() => { setSelectedQuote({ id: t.debateId * 1000 + t.round, speakerName: t.speakerName, content: t.content.slice(0, 80) }); setShowQuotePanel(false); }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors">
                                  <span className="text-blue-400 font-medium">【{t.speakerName}】</span>
                                  <span className="text-gray-400 ml-1">{t.content.slice(0, 40)}…</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {showMentionPanel && (
                          <div className="mb-3 bg-white/5 rounded-xl p-3 border border-blue-500/20">
                            <p className="text-xs text-blue-400 mb-2">@哪一位思想家</p>
                            <div className="flex gap-2 flex-wrap">
                              {debate.participantIds.map(pid => {
                                const p = personaMap.get(pid);
                                return (
                                  <button key={pid} type="button"
                                    onClick={() => { setSelectedMention(p?.nameZh ?? pid); setShowMentionPanel(false); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors">
                                    <PersonaBubble personaId={pid} name={p?.nameZh ?? pid} size="sm" />
                                    <span className="text-gray-200">@{p?.nameZh ?? pid}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(selectedQuote || selectedMention) && (
                          <div className="mb-3 flex items-center gap-2 flex-wrap">
                            {selectedQuote && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                                <span className="text-blue-300">引用「{selectedQuote.speakerName}」</span>
                                <button type="button" onClick={() => setSelectedQuote(null)} className="text-blue-400/50 hover:text-blue-300 ml-1">✕</button>
                              </div>
                            )}
                            {selectedMention && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                                <span className="text-blue-300">@{selectedMention}</span>
                                <button type="button" onClick={() => setSelectedMention(null)} className="text-blue-400/50 hover:text-blue-300 ml-1">✕</button>
                              </div>
                            )}
                          </div>
                        )}
                        <textarea
                          value={contributionText}
                          onChange={(e) => setContributionText(e.target.value)}
                          placeholder={selectedMention ? `@${selectedMention}，你的观点是…` : '辩论已结束，在这里写下你的观点或回应…'}
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
                            disabled={!contributionText.trim() || submittingContribution}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-prism-gradient text-white text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
                          >
                            {submittingContribution ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {submittingContribution ? '发送中...' : '发言'}
                          </button>
                        </div>
                      </form>
                      {contributions.length > 0 ? (
                        <div className="space-y-3">
                          {contributions.map((c) => (
                            <VisitorCard key={c.id} contribution={c} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-gray-500">
                          还没有围观发言，来说第一句吧 ✨
                        </div>
                      )}
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
