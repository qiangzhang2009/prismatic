'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ChevronDown, Settings, Trash2, X, Download, FileText, Image } from 'lucide-react';
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
import { LimitReachedModal } from '@/components/limit-reached-modal';
import { exportChatAsImage, exportChatAsText } from '@/lib/export-chat';

const STORAGE_KEY = 'prismatic-chat-state';

const DAILY_LIMIT = 60;
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
  const [showLimitModal, setShowLimitModal] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isPickerOpenRef = useRef(false);
  const [turnCount, setTurnCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Persona picker filter state
  const [pickerTab, setPickerTab] = useState<string>('all');
  const [pickerSearch, setPickerSearch] = useState('');

  const selectedPersonas = getPersonasByIds(selectedIds);

  // Reset picker filters when picker closes
  useEffect(() => {
    if (!isPickerOpen) {
      setPickerTab('all');
      setPickerSearch('');
    }
  }, [isPickerOpen]);

  // Filtered persona list
  const filteredPersonas = PERSONA_LIST.filter((p) => {
    const matchTab = pickerTab === 'all' || p.domain.includes(pickerTab as any);
    const matchSearch = pickerSearch.trim() === '' ||
      p.nameZh.includes(pickerSearch) ||
      p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      p.domain.some(d => d.toLowerCase().includes(pickerSearch.toLowerCase()));
    return matchTab && matchSearch;
  });

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
    // Only change if this is a deliberate navigation from outside
    if (initialPersona !== selectedIds[0]) {
      // Check if this is a different conversation (user clicked from persona page)
      const isDifferentConversation = saved?.selectedIds?.[0] !== initialPersona;
      if (isDifferentConversation && !hasActiveMessages()) {
        setSelectedIds([initialPersona]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPersona]);

  // Helper to check if current conversation has active messages
  function hasActiveMessages(): boolean {
    return messages.length > 0;
  }

  useEffect(() => {
    if (!initialMode) return;
    if (initialMode !== mode && initialMode !== saved?.mode) {
      setModeState(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  // Close picker on outside click — use ref to avoid stale closure with isPickerOpen state
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!isPickerOpenRef.current) return;
      const target = e.target as Node;
      if (
        pickerRef.current?.contains(target) ||
        toggleRef.current?.contains(target)
      ) {
        return;
      }
      isPickerOpenRef.current = false;
      setIsPickerOpen(false);
      setShowPersonaPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExportAsImage = async () => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      await exportChatAsImage(messages, selectedIds, mode);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAsText = () => {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      exportChatAsText(messages, selectedIds, mode);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

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
      setShowLimitModal(true);
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

      // Record usage server-side (non-blocking, ignore failures)
      // Only for authenticated users (guests use localStorage limits only)
      if (user) {
        fetch('/api/messages/record', { method: 'POST', credentials: 'include' }).catch(() => {});
      }

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

          {/* Persona picker toggle — always visible */}
          <button
            ref={toggleRef}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              isPickerOpen
                ? "text-text-primary bg-bg-surface px-2 py-1 rounded-lg"
                : "text-text-secondary hover:text-text-primary"
            )}
            onClick={() => {
              const next = !isPickerOpen;
              isPickerOpenRef.current = next;
              setIsPickerOpen(next);
              setShowPersonaPicker(next);
            }}
          >
            <div className="flex -space-x-1">
              {selectedPersonas.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="w-6 h-6 rounded-full border-2 border-bg-base flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}
                >
                  {p.nameZh.slice(0, 1)}
                </div>
              ))}
              {selectedIds.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-bg-base bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
                  +{selectedIds.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-text-muted">
              {selectedIds.length}人
            </span>
            {isPickerOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Settings */}
          <button
            className="text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Export */}
          {messages.length > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-bg-elevated border border-border-subtle rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                      onClick={handleExportAsImage}
                    >
                      <Image className="w-4 h-4 text-prism-blue" alt="" />
                      导出为图片
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-surface transition-colors"
                      onClick={handleExportAsText}
                    >
                      <FileText className="w-4 h-4 text-prism-purple" />
                      导出为文本
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Daily limit indicator */}
          {limitReached ? (
            <button
              className="text-xs text-orange-400 font-medium hover:text-orange-300 transition-colors"
              title="今日额度已用完，点击查看如何开通"
              onClick={() => setShowLimitModal(true)}
            >
              额度已用完
            </button>
          ) : (
            <span
              className="text-xs text-text-muted hidden sm:inline"
              title="今日对话额度，剩余次数"
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
      </div>

      {/* ── Persona Picker Overlay ─────────────────────────────── */}
      <AnimatePresence>
        {showPersonaPicker && isPickerOpen && (
          <motion.div
            ref={pickerRef}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { isPickerOpenRef.current = false; setIsPickerOpen(false); setShowPersonaPicker(false); }}
            />

            {/* Picker panel */}
            <motion.div
              className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[75vh] bg-bg-elevated border border-border-subtle sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            >
              {/* Drag handle (mobile) */}
              <div className="flex items-center justify-center pt-3 pb-2 sm:hidden">
                <div className="w-9 h-1 rounded-full bg-border-subtle" />
              </div>

              {/* Header */}
              <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">选择人物</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedIds.length}人已选 · {mode === 'solo' ? '单人模式' : mode === 'prism' ? '折射模式(最多3人)' : '圆桌模式(最多8人)'}
                  </p>
                </div>
                <button
                  onClick={() => { isPickerOpenRef.current = false; setIsPickerOpen(false); setShowPersonaPicker(false); }}
                  className="w-8 h-8 rounded-full bg-bg-surface hover:bg-bg-base flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-border-subtle flex-shrink-0">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索姓名或领域..."
                    value={pickerSearch}
                    onChange={(e) => { setPickerSearch(e.target.value); setPickerTab('all'); }}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-bg-base border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-purple"
                  />
                  {pickerSearch && (
                    <button
                      onClick={() => setPickerSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Domain tabs */}
              <div className="flex-shrink-0 border-b border-border-subtle overflow-x-auto scrollbar-none">
                <div className="flex gap-1 px-4 py-1.5 min-w-max">
                  {([
                    ['all', '全部', PERSONA_LIST.length],
                    ['strategy', '策略', 34],
                    ['philosophy', '哲学', 33],
                    ['leadership', '领导力', 18],
                    ['creativity', '创造力', 10],
                    ['technology', '科技', 8],
                    ['science', '科学', 7],
                    ['education', '教育', 7],
                    ['investment', '投资', 4],
                    ['product', '产品', 3],
                  ] as [string, string, number][]).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => { setPickerTab(key); setPickerSearch(''); }}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors whitespace-nowrap',
                        pickerTab === key && key === 'all' ? 'bg-prism-purple text-white' :
                        pickerTab === key ? 'bg-bg-surface text-text-primary' :
                        'text-text-muted hover:text-text-primary hover:bg-bg-surface'
                      )}
                    >
                      {label}
                      <span className={cn(
                        'text-[10px]',
                        pickerTab === key && key === 'all' ? 'text-white/70' :
                        pickerTab === key ? 'text-text-muted' :
                        'text-text-muted'
                      )}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredPersonas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <svg className="w-8 h-8 text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-text-muted">没有找到匹配的人物</p>
                    <button
                      onClick={() => { setPickerSearch(''); setPickerTab('all'); }}
                      className="mt-2 text-xs text-prism-purple hover:underline"
                    >
                      清除筛选
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-text-muted mb-3">
                      {pickerSearch ? `搜索「${pickerSearch}」找到 ${filteredPersonas.length} 人` :
                       pickerTab !== 'all' ? `共 ${filteredPersonas.length} 人` : null}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {filteredPersonas.map((persona) => {
                        const isSelected = selectedIds.includes(persona.id);
                        return (
                          <button
                            key={persona.id}
                            onClick={() => togglePersona(persona.id)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150',
                              isSelected
                                ? 'bg-bg-surface border-2'
                                : 'bg-bg-base border border-border-subtle hover:border-border-medium'
                            )}
                            style={isSelected ? { borderColor: persona.accentColor } : undefined}
                          >
                            <div className="relative">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})` }}
                              >
                                {persona.nameZh.slice(0, 1)}
                              </div>
                              {isSelected && (
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: persona.accentColor }}
                                >
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] text-text-secondary text-center leading-tight">
                              {persona.nameZh}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-3 border-t border-border-subtle flex-shrink-0 sm:hidden">
                <p className="text-xs text-text-muted text-center">点击头像添加/移除人物，上滑关闭</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ── Limit Reached Modal ─────────────────────────────── */}
      <LimitReachedModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>
  );
}
