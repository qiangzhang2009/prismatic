'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ChevronDown, Settings, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonaCard } from '@/components/persona-card';
import { ModeSelector } from '@/components/mode-selector';
import { MessageContent } from '@/components/message-content';
import { PERSONA_LIST, getPersonasByIds } from '@/lib/personas';
import { useChatHistory } from '@/lib/use-chat-history';
import { useAuthStore } from '@/lib/auth-store';
import type { Mode, Persona, AgentMessage } from '@/lib/types';
import { nanoid } from 'nanoid';
import { trackChatStart, trackChatMessage } from '@/lib/use-tracking';

const STORAGE_KEY = 'prismatic-chat-state';

const DAILY_LIMIT = 200;
const DAILY_LIMIT_KEY = 'prismatic-daily-messages';
const DAILY_DATE_KEY = 'prismatic-daily-date';

function getDailyCount(): { count: number; date: string } {
  try {
    const date = new Date().toDateString();
    const savedDate = localStorage.getItem(DAILY_DATE_KEY);
    if (savedDate !== date) {
      // Reset for new day
      localStorage.setItem(DAILY_LIMIT_KEY, '0');
      localStorage.setItem(DAILY_DATE_KEY, date);
      return { count: 0, date };
    }
    const count = parseInt(localStorage.getItem(DAILY_LIMIT_KEY) ?? '0', 10);
    return { count, date };
  } catch {
    return { count: 0, date: new Date().toDateString() };
  }
}

function incrementDailyCount(): number {
  try {
    const { count } = getDailyCount();
    const newCount = count + 1;
    localStorage.setItem(DAILY_LIMIT_KEY, String(newCount));
    return newCount;
  } catch {
    return 1;
  }
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveState(state: { selectedIds: string[]; mode: Mode }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface ChatInterfaceProps {
  className?: string;
  initialPersona?: string;
  initialMode?: Mode;
}

export function ChatInterface({ className, initialPersona, initialMode }: ChatInterfaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, init } = useAuthStore();

  const saved = loadSavedState();
  const { count: dailyCount } = getDailyCount();
  const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyCount);
  const limitReached = dailyCount >= DAILY_LIMIT;

  // Priority: URL param > saved state > default (steve-jobs for backwards compat)
  const getInitialPersonaId = () => {
    if (initialPersona) return initialPersona;
    if (saved?.selectedIds?.[0]) return saved.selectedIds[0];
    return 'steve-jobs';
  };

  const getInitialMode = () => {
    if (initialMode) return initialMode;
    if (saved?.mode) return saved.mode;
    return 'solo';
  };

  const [mode, setModeState] = useState<Mode>(getInitialMode);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const id = getInitialPersonaId();
    return saved?.selectedIds?.length > 1 ? saved.selectedIds : [id];
  });
  const { messages, setMessages, clearHistory } = useChatHistory(selectedIds);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false); // compact header mode
  const pickerRef = useRef<HTMLDivElement>(null);
  const [turnCount, setTurnCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  const selectedPersonas = getPersonasByIds(selectedIds);

  // Sync state to localStorage & URL
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    saveState({ selectedIds, mode });

    // Sync to URL params (for shareability)
    const params = new URLSearchParams();
    if (selectedIds.length === 1) {
      params.set('persona', selectedIds[0]);
    } else {
      params.set('personas', selectedIds.join(','));
    }
    params.set('mode', mode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selectedIds, mode, pathname, router]);

  // React to URL param changes (navigating from persona page or graph → update selection)
  useEffect(() => {
    if (!initialPersona) return;
    if (initialPersona !== selectedIds[0] && initialPersona !== saved?.selectedIds?.[0]) {
      setSelectedIds([initialPersona]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPersona]);

  useEffect(() => {
    if (!initialMode) return;
    if (initialMode !== mode && initialMode !== saved?.mode) {
      setModeState(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  // Close picker on outside click
  useEffect(() => {
    if (!isPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
        setShowPersonaPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isPickerOpen]);

  // Handle mode changes: adjust participant count if needed
  useEffect(() => {
    const minParticipants = mode === 'solo' ? 1 : 2;
    const maxParticipants = mode === 'prism' ? 3 : mode === 'roundtable' ? 8 : 6;

    setSelectedIds((prev) => {
      let next = [...prev];

      if (next.length < minParticipants) {
        const currentSet = new Set(next);
        for (const p of PERSONA_LIST) {
          if (!currentSet.has(p.id)) {
            currentSet.add(p.id);
            if (currentSet.size >= minParticipants) break;
          }
        }
        next = Array.from(currentSet);
      }

      if (next.length > maxParticipants) {
        next = next.slice(0, maxParticipants);
      }

      return next;
    });
  }, [mode]);

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Daily limit check
    const { count } = getDailyCount();
    if (count >= DAILY_LIMIT) {
      alert('今日对话额度已用完（每天 200 条），明天再来吧');
      return;
    }

    const userMessage: AgentMessage = {
      id: nanoid(),
      personaId: 'user',
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 追踪对话开始（首条消息）
    if (messages.length === 0) {
      const primaryPersona = selectedPersonas[0];
      if (primaryPersona) {
        trackChatStart(primaryPersona.id, primaryPersona.nameZh, mode, primaryPersona.domain?.[0]);
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          participantIds: selectedIds,
          message: input.trim(),
          conversationId: 'local',
          // Pass history for solo mode (deep questioning continuity)
          history: mode === 'solo' ? messages.slice(-8).map(m => ({
            content: m.content,
            response: m.role === 'agent' ? m.content : undefined,
          })) : undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/signin');
          return;
        }
        throw new Error('API error');
      }
      const data = await response.json();

      // 追踪 AI 响应延迟
      const aiLatencyMs = Date.now() - (window._lastMessageSentTime || Date.now());
      window._lastMessageSentTime = Date.now();
      const currentTurn = turnCount + 1;
      setTurnCount(currentTurn);
      incrementDailyCount();

      // ── Roundtable: Multi-Agent Dialogue ──────────────────────────────────────
      if (data.debate) {
        for (const turn of data.debate.turns ?? []) {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              personaId: turn.speakerId,
              role: 'agent',
              content: turn.content,
              round: turn.round,
              timestamp: new Date(turn.timestamp),
            },
          ]);
        }
        // Convergence: blind spots and key insights
        if (data.debate.convergence?.content) {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              personaId: 'system',
              role: 'system',
              content: `🔍 多元对话总结\n\n${data.debate.convergence.content}`,
              timestamp: new Date(data.debate.convergence.timestamp),
            },
          ]);
        }
        // 追踪回合消息
        const primaryPersona = selectedPersonas[0];
        if (primaryPersona) {
          trackChatMessage(primaryPersona.id, mode, currentTurn, aiLatencyMs, data.model || 'claude');
        }
        return;
      }

      // ── Mission: Collaborative Output ──────────────────────────────────────────
      if (data.mission) {
        // Show task plan (who is doing what)
        if (data.mission.taskPlan?.length) {
          const planText = data.mission.taskPlan
            .map((t: any) => `• **${t.aspect ?? t.assignedTo}**: ${t.description} (${t.status === 'done' ? '✓' : '○'})`)
            .join('\n');
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              personaId: 'system',
              role: 'system',
              content: `📋 协作任务分解\n\n${planText}`,
              timestamp: new Date(),
            },
          ]);
        }
        // Show individual contributions
        if (data.mission.results?.length) {
          for (const r of data.mission.results) {
            setMessages((prev) => [
              ...prev,
              {
                id: nanoid(),
                personaId: r.personaId,
                role: 'agent',
                content: `**【${r.aspect ?? r.personaId}】**\n\n${r.result}`,
                timestamp: new Date(),
              },
            ]);
          }
        }
        // Show final integrated output
        if (data.mission.output?.content) {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              personaId: 'system',
              role: 'system',
              content: `✨ 协作产出\n\n${data.mission.output.content}`,
              timestamp: new Date(data.mission.output.timestamp),
            },
          ]);
        }
        // 追踪回合消息
        const primaryPersona2 = selectedPersonas[0];
        if (primaryPersona2) {
          trackChatMessage(primaryPersona2.id, mode, currentTurn, aiLatencyMs, data.model || 'claude');
        }
        return;
      }

      // ── Prism: Multi-Perspective + Synthesis ──────────────────────────────────
      if (data.messages) {
        for (const msg of data.messages) {
          setMessages((prev) => [
            ...prev,
            { ...msg, id: nanoid(), timestamp: new Date(msg.timestamp ?? Date.now()) },
          ]);
        }
        if (data.synthesis?.content) {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              personaId: 'system',
              role: 'system',
              content: `🔬 折射综合\n\n${data.synthesis.content}`,
              timestamp: new Date(data.synthesis.timestamp ?? Date.now()),
            },
          ]);
        }
        // 追踪回合消息
        const primaryPersona3 = selectedPersonas[0];
        if (primaryPersona3) {
          trackChatMessage(primaryPersona3.id, mode, currentTurn, aiLatencyMs, data.model || 'claude');
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg === '401' || errMsg.includes('请先登录')) {
        router.push('/auth/signin');
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          personaId: 'system',
          role: 'system',
          content: '抱歉，发生了错误。请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePersona = (id: string) => {
    const minParticipants = mode === 'solo' ? 1 : 2;

    if (selectedIds.includes(id)) {
      if (selectedIds.length > minParticipants) {
        setSelectedIds(selectedIds.filter((i) => i !== id));
      }
    } else {
      const maxParticipants =
        mode === 'prism' ? 3 : mode === 'roundtable' ? 8 : 6;
      if (selectedIds.length < maxParticipants) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <ModeSelector value={mode} onChange={setMode} participantCount={selectedIds.length} />

          {/* Persona picker toggle — only show when picker is closed */}
          {!isPickerOpen ? (
            <button
              className="ml-auto flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setIsPickerOpen(true)}
            >
              <div className="flex -space-x-2">
                {selectedPersonas.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="w-6 h-6 rounded-full border-2 border-bg-base flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
                  >
                    {p.nameZh.slice(0, 1)}
                  </div>
                ))}
              </div>
              <span className="hidden sm:inline">
                {selectedIds.length}人参与
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>
          ) : (
            /* Compact view when picker is open — shows active personas + collapse button */
            <div className="ml-auto flex items-center gap-2 overflow-hidden flex-1">
              <div className="flex -space-x-1.5">
                {selectedPersonas.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="w-7 h-7 rounded-full border-2 border-bg-base flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
                    title={p.nameZh}
                  >
                    {p.nameZh.slice(0, 1)}
                  </div>
                ))}
              </div>
              <span className="text-xs text-text-muted flex-shrink-0">
                {selectedIds.length}人
              </span>
              {/* Collapse button */}
              <button
                className="flex-shrink-0 p-1 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                onClick={() => { setIsPickerOpen(false); setShowPersonaPicker(false); }}
                title="收起人物选择"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Settings */}
          <button
            className="text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Daily limit indicator */}
          {limitReached ? (
            <span className="text-xs text-red-400 font-medium" title="今日额度已用完">
              今日额度已用完
            </span>
          ) : (
            <span
              className="text-xs text-text-muted hidden sm:inline"
              title={`今日对话额度，剩余 ${Math.max(0, DAILY_LIMIT - dailyCount)}/${DAILY_LIMIT} 条`}
            >
              {Math.max(0, DAILY_LIMIT - dailyCount)}/{DAILY_LIMIT}
            </span>
          )}

          {/* Clear history */}
          {messages.length > 0 && (
            <button
              className="text-text-muted hover:text-red-400 transition-colors"
              onClick={() => {
                if (window.confirm('确定清空当前对话历史？此操作不可撤销。')) {
                  clearHistory();
                }
              }}
              title="清空对话历史"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Persona picker dropdown */}
        <AnimatePresence>
          {showPersonaPicker && isPickerOpen && (
            <motion.div
              ref={pickerRef}
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3 pt-3 border-t border-border-subtle"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {PERSONA_LIST.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  compact
                  selected={selectedIds.includes(persona.id)}
                  onClick={() => togglePersona(persona.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Messages ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* Not logged in notice */}
        {!user && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-lg font-medium mb-2">登录后即可开启对话</h3>
            <p className="text-sm text-text-muted max-w-sm mb-6">
              与顶尖思想家对话，限时体验中
            </p>
            <div className="flex gap-3">
              <button
                className="px-5 py-2 rounded-xl bg-prism-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity"
                onClick={() => router.push('/auth/signin')}
              >
                登录
              </button>
              <button
                className="px-5 py-2 rounded-xl border border-border-subtle text-text-secondary text-sm hover:bg-bg-surface transition-colors"
                onClick={() => router.push('/auth/signup')}
              >
                注册
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 && user && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center mb-4">
              <span className="text-2xl">
                {selectedPersonas[0]?.nameZh?.slice(0, 1) ?? 'P'}
              </span>
            </div>
            <h3 className="text-lg font-medium mb-2">
              {selectedPersonas.map((p) => p.nameZh).join(' × ')}
            </h3>
            <p className="text-sm text-text-muted max-w-sm">
              {mode === 'solo'
                ? `向${selectedPersonas[0]?.nameZh}提出你的问题`
                : mode === 'prism'
                ? `${selectedIds.length}个视角同时为你分析一个问题`
                : mode === 'roundtable'
                ? `${selectedIds.length}个人物正在进行圆桌辩论`
                : `多角色协作完成复杂任务`}
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          if (message.role === 'user') {
            return (
              <motion.div
                key={message.id}
                className="flex justify-end"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="chat-bubble chat-bubble-user max-w-[80%]">
                  <MessageContent content={message.content} role="user" />
                </div>
              </motion.div>
            );
          }

          if (message.role === 'system') {
            return (
              <motion.div
                key={message.id}
                className="flex justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="max-w-[90%] px-4 py-3 rounded-xl bg-gradient-to-r from-prism-blue/8 to-prism-purple/8 border border-prism-blue/15 text-sm">
                  <MessageContent content={message.content} role="system" />
                </div>
              </motion.div>
            );
          }

          const persona = selectedPersonas.find((p) => p.id === message.personaId);
          if (!persona) return null;

          return (
            <motion.div
              key={message.id}
              className="flex gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {/* Persona avatar */}
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white mt-1"
                style={{
                  background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})`,
                }}
              >
                {persona.nameZh.slice(0, 1)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">{persona.nameZh}</span>
                  {message.confidence !== undefined && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1 rounded-full bg-bg-elevated overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: persona.accentColor }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${message.confidence * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted">
                        {Math.round(message.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="chat-bubble chat-bubble-agent">
                  <MessageContent content={message.content} role="agent" />
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, #4d96ff, #c77dff)` }}
            >
              P
            </div>
            <div className="chat-bubble chat-bubble-agent">
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">思考中...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-border-subtle bg-bg-surface/80 backdrop-blur-sm">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                mode === 'solo'
                  ? `向${selectedPersonas[0]?.nameZh}提问...`
                  : `提出你的问题，让${selectedIds.length}个人物为你思考...`
              }
              className="input-prismatic resize-none pr-12"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <span className="absolute bottom-3 right-3 text-xs text-text-muted">
              Enter 发送 / Shift+Enter 换行
            </span>
          </div>
          <motion.button
            className="btn-primary flex-shrink-0 px-5 py-2.5 flex items-center gap-2"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || limitReached}
            whileTap={{ scale: 0.97 }}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">发送</span>
          </motion.button>
        </div>

        {/* Quick suggestions */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {[
            '帮我分析这个创业方向',
            '用第一性原理拆解这个问题',
            '多元思维模型怎么看这件事',
            '评估一下这个投资机会',
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="text-xs px-3 py-1.5 rounded-full border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-medium transition-colors whitespace-nowrap"
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
