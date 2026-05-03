'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ChevronDown, Sparkles, ShieldAlert, BookOpen, Brain, Globe, User, RefreshCw, MessageSquare, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TCM_PERSONA_LIST } from '@/lib/tcm-personas';
import { useConversationSync } from '@/lib/use-conversation-sync';
import { useDailyLimit } from '@/lib/use-daily-limit';
import { useAuthStore } from '@/lib/auth-store';
import { LimitReachedModal, type LimitModalType } from '@/components/limit-reached-modal';
import type { AgentMessage } from '@/lib/types';

const TCM_COLORS = {
  bg: 'bg-[#050810]',
  surface: 'bg-[#0d1424]',
  border: 'border-[#1e2d4a]',
  accent: 'text-[#c9a84c]',
  accentDim: 'text-[#c9a84c]/60',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-400',
  textMuted: 'text-slate-500',
  input: 'bg-[#0a1628]',
};

const TCM_CONVERSATION_PREFIX = 'tcm:';
const TCM_CONVERSATION_ID_KEY = 'prismatic-tcm-convid';

interface TCMMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  personaId: string;
  personaName: string;
  timestamp?: string;
}

interface TCMPersona {
  id: string;
  name: string;
  nameZh: string;
  tagline: string;
  taglineZh: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  briefZh: string;
  mentalModels: Array<{ name: string; nameZh: string }>;
}

interface TCMStoredConv {
  messages: TCMMessage[];
  personaId: string;
  personaName: string;
  lastUpdated: number;
}

interface TCMRegistry {
  version: number;
  conversations: Record<string, TCMStoredConv>;
}

interface TCMConversationMeta {
  id: string;
  title: string;
  personaId: string;
  personaName: string;
  messageCount: number;
  updatedAt: string;
}

function loadTCMRegistry(): TCMRegistry {
  try {
    const raw = localStorage.getItem('prismatic-tcm-registry');
    if (!raw) return { version: 1, conversations: {} };
    const reg: TCMRegistry = JSON.parse(raw);
    if (reg.version !== 1) return { version: 1, conversations: {} };
    return reg;
  } catch { return { version: 1, conversations: {} }; }
}

function saveTCMRegistry(reg: TCMRegistry) {
  try { localStorage.setItem('prismatic-tcm-registry', JSON.stringify(reg)); } catch {}
}

function getStoredConvId(personaId: string): string | null {
  try {
    const raw = localStorage.getItem(TCM_CONVERSATION_ID_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[personaId] || null;
  } catch { return null; }
}

function saveStoredConvId(personaId: string, convId: string) {
  try {
    const raw = localStorage.getItem(TCM_CONVERSATION_ID_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[personaId] = convId;
    localStorage.setItem(TCM_CONVERSATION_ID_KEY, JSON.stringify(data));
  } catch {}
}

function PersonaAvatar({ persona, size = 'md' }: { persona: TCMPersona; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-lg' };
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-bold text-white shrink-0', sizeClasses[size])}
      style={{ background: `linear-gradient(135deg, ${persona.gradientFrom}, ${persona.gradientTo})` }}
    >
      {persona.nameZh.slice(0, 1)}
    </div>
  );
}

function DisclaimerBanner() {
  return (
    <div className={cn('mx-4 mb-3 px-3 py-2 rounded-lg border text-xs', TCM_COLORS.surface, 'border-[#c9a84c]/20')}>
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#c9a84c]" />
        <p className="text-slate-400 leading-relaxed">
          <span className="text-[#c9a84c] font-medium">中医AI助手</span> 仅供学习和参考，不能替代专业医生的诊断和治疗。如有健康问题，请及时就医。
        </p>
      </div>
    </div>
  );
}

function ConversationHistoryItem({
  conv,
  isActive,
  onSelect,
  onClear,
}: {
  conv: TCMConversationMeta;
  isActive: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs group',
        isActive ? 'bg-[#c9a84c]/15 border border-[#c9a84c]/30' : 'hover:bg-white/5 border border-transparent'
      )}
      onClick={onSelect}
    >
      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#c9a84c]/60" />
      <div className="flex-1 min-w-0">
        <p className="text-slate-300 truncate">{conv.title || '新对话'}</p>
        <p className="text-slate-600 text-[10px] flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {new Date(conv.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onClear(); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-500 hover:text-red-400 transition-all"
        title="删除此对话"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function TCMChatInterface() {
  const user = useAuthStore(s => s.user);
  const userId = user?.id;
  const { pushSnapshot } = useConversationSync();
  const {
    plan, credits, isPaid, hasCredits, dailyLimit, dailyCount,
    dailyRemaining, limitReached, creditsExhausted, incrementCount,
  } = useDailyLimit();

  const [selectedPersona, setSelectedPersona] = useState<TCMPersona>(
    () => TCM_PERSONA_LIST[0] as TCMPersona
  );
  const [messages, setMessages] = useState<TCMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en' | 'auto'>('zh');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('daily_limit');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<TCMConversationMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitializedRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // ── Load conversation history from DB on mount ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch('/api/tcm/conversations?limit=20', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const convs: TCMConversationMeta[] = (data.conversations || []).map((c: any) => ({
            id: c.id,
            title: c.title || '',
            personaId: c.participants?.[0] || '',
            personaName: '',
            messageCount: c.messageCount || 0,
            updatedAt: c.updatedAt,
          }));
          setConversationHistory(convs);
        }
      } catch (e) {
        console.warn('[TCM] Failed to load conversation history:', e);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [userId]);

  // ── Load conversation ID + messages for selected persona ────────────────────────
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const loadForPersona = async () => {
      // 1. Check localStorage for stored conversationId
      const storedConvId = getStoredConvId(selectedPersona.id);

      // 2. Try localStorage for messages first (fast, no network)
      const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
      const tcmReg = loadTCMRegistry();
      const stored = tcmReg.conversations[key];

      if (stored?.messages?.length > 0) {
        setMessages(stored.messages);
        if (storedConvId) {
          setConversationId(storedConvId);
        }
        return;
      }

      // 3. Load from DB if we have a stored conversationId
      if (storedConvId) {
        try {
          const res = await fetch(`/api/tcm/conversations/${storedConvId}`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            if (data.messages?.length > 0) {
              const loaded: TCMMessage[] = data.messages.map((m: any) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                personaId: m.personaId || selectedPersona.id,
                personaName: selectedPersona.nameZh,
                timestamp: m.createdAt,
              }));
              setMessages(loaded);
              setConversationId(storedConvId);
              return;
            }
          }
        } catch (e) {
          console.warn('[TCM] Failed to load conversation from DB:', e);
        }
      }

      // 4. No history found
      setMessages([]);
      setConversationId(null);
    };

    loadForPersona();
  }, [selectedPersona.id, selectedPersona.nameZh]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
    const tcmReg = loadTCMRegistry();
    tcmReg.conversations[key] = {
      messages,
      personaId: selectedPersona.id,
      personaName: selectedPersona.nameZh,
      lastUpdated: Date.now(),
    };
    saveTCMRegistry(tcmReg);
  }, [messages, selectedPersona]);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    if (!userId) {
      alert('请先登录后再使用中医对话功能');
      return;
    }

    if (limitReached) {
      setLimitModalType('daily_limit');
      setShowLimitModal(true);
      return;
    }

    const userMsg: TCMMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: input.trim(),
      personaId: selectedPersona.id,
      personaName: selectedPersona.nameZh,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setSyncStatus('syncing');

    try {
      const res = await fetch('/api/tcm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          message: userMsg.content,
          language,
          conversationId: conversationId || undefined,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '请先登录');
      }

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errData.error || '今日对话次数已达上限'), { code: 'DAILY_LIMIT_REACHED' });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || '请求失败');
      }

      const data = await res.json();

      const assistantMsg: TCMMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: data.response,
        personaId: data.personaId || selectedPersona.id,
        personaName: data.personaName || selectedPersona.nameZh,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Persist conversationId — the server generates one if none was provided
      if (data.conversationId) {
        setConversationId(data.conversationId);
        saveStoredConvId(selectedPersona.id, data.conversationId);
      }

      // Update history list if this is a new conversation
      if (data.conversationId && data.title) {
        setConversationHistory(prev => {
          const existing = prev.findIndex(c => c.id === data.conversationId);
          const newConv: TCMConversationMeta = {
            id: data.conversationId,
            title: data.title,
            personaId: selectedPersona.id,
            personaName: selectedPersona.nameZh,
            messageCount: (prev[existing]?.messageCount || 0) + 2,
            updatedAt: new Date().toISOString(),
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = newConv;
            return next;
          }
          return [newConv, ...prev];
        });
      }

      setSyncStatus('saved');
      incrementCount();
      if (data.creditsAfter !== undefined) {
        useAuthStore.getState().updateUser({ credits: data.creditsAfter });
      }

      // Push to sync system (mirrors persona chat)
      const conversationKey = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
      const allMessages = [...messages, userMsg, assistantMsg];
      pushSnapshot([selectedPersona.id], allMessages as any, undefined, undefined, 'tcm-assistant', userId)
        .catch(err => console.warn('[TCM] pushSnapshot failed:', err));

    } catch (err) {
      setSyncStatus('error');
      const errMsg = err instanceof Error ? err.message : '服务暂时不可用';
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉：${errMsg}。请稍后再试。`,
        personaId: selectedPersona.id,
        personaName: selectedPersona.nameZh,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSelectConversation(conv: TCMConversationMeta) {
    if (conv.personaId && conv.personaId !== selectedPersona.id) {
      const persona = Object.values(TCM_PERSONA_LIST).find(p => p.id === conv.personaId);
      if (persona) setSelectedPersona(persona as TCMPersona);
    }
    setConversationId(conv.id);
    saveStoredConvId(selectedPersona.id, conv.id);
    setShowHistory(false);
  }

  function handleClearConversation(convId: string) {
    setConversationHistory(prev => prev.filter(c => c.id !== convId));
    if (conversationId === convId) {
      setMessages([]);
      setConversationId(null);
      const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
      const reg = loadTCMRegistry();
      delete reg.conversations[key];
      saveTCMRegistry(reg);
      localStorage.removeItem(TCM_CONVERSATION_ID_KEY);
    }
  }

  function clearChat() {
    const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
    const reg = loadTCMRegistry();
    delete reg.conversations[key];
    saveTCMRegistry(reg);
    setMessages([]);
    setConversationId(null);
    if (conversationId) {
      saveStoredConvId(selectedPersona.id, '');
    }
  }

  // Mark as initialized after first render
  useEffect(() => {
    isInitializedRef.current = true;
  }, []);

  const syncLabel = {
    idle: null,
    syncing: (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <RefreshCw className="w-3 h-3 animate-spin" /> 同步中...
      </span>
    ),
    saved: (
      <span className="text-xs text-[#22c55e]"> 已保存</span>
    ),
    error: (
      <span className="text-xs text-red-400"> 保存失败</span>
    ),
  };

  return (
    <div className={cn('flex flex-col h-screen', TCM_COLORS.bg)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-5 py-3 border-b', TCM_COLORS.border)}>
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm shrink-0">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
            <path d="M10 1 A9 9 0 0 1 10 19 A4.5 4.5 0 0 1 10 10 A4.5 4.5 0 0 0 10 1" fill="#c9a84c"/>
            <circle cx="10" cy="5.5" r="1.5" fill="#050810"/>
            <circle cx="10" cy="14.5" r="1.5" fill="#c9a84c"/>
          </svg>
          <span className="hidden sm:inline">Prismatic</span>
        </Link>

        <div className="w-px h-5 bg-slate-700 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-[#c9a84c]/20 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-[#c9a84c]" />
          </div>
          <h1 className="font-bold text-sm text-white tracking-tight hidden sm:block">中医AI助手</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30 font-mono">TCM</span>
        </div>

        {/* Sync status + quota indicator */}
        <div className="flex items-center gap-3 ml-auto">
          {syncLabel[syncStatus]}

          {/* History button */}
          {userId && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all',
                showHistory
                  ? 'bg-[#c9a84c]/15 border-[#c9a84c]/30 text-[#c9a84c]'
                  : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-[#c9a84c]/30'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">历史</span>
            </button>
          )}

          {limitReached ? (
            <Link
              href="/subscribe"
              className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-xs text-red-400 font-medium">已达上限</span>
            </Link>
          ) : isPaid ? (
            <span className="text-xs text-green-400 font-medium">无限制</span>
          ) : creditsExhausted ? (
            <div className="flex items-center gap-1.5">
              {Number(dailyRemaining) <= 3 ? (
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-400 font-medium">{dailyRemaining} 条今日</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-400 font-medium">{dailyRemaining}</span>
                  <span className="text-xs text-slate-600">/ {dailyLimit} 条今日</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {Number(dailyRemaining) <= 3 ? (
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-400 font-medium">{dailyRemaining} 条剩余</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-green-400 font-medium">{dailyRemaining}</span>
                  <span className="text-xs text-slate-600">/ {dailyLimit} 条今日</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#0a1628] rounded-lg p-0.5 border border-[#1e2d4a]">
            {(['zh', 'en', 'auto'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-all',
                  language === lang
                    ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {lang === 'zh' ? '中文' : lang === 'en' ? 'EN' : 'Auto'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && userId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-[#1e2d4a]"
          >
            <div className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
              {isLoadingHistory ? (
                <div className="text-xs text-slate-500 text-center py-2">加载中...</div>
              ) : conversationHistory.length === 0 ? (
                <div className="text-xs text-slate-600 text-center py-2">暂无历史对话</div>
              ) : (
                conversationHistory.map(conv => (
                  <ConversationHistoryItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === conversationId}
                    onSelect={() => handleSelectConversation(conv)}
                    onClear={() => handleClearConversation(conv.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <DisclaimerBanner />

      {/* Persona Selector */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            当前医师
          </span>
          <button
            onClick={() => setShowPersonaPicker(v => !v)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm',
              'border-[#1e2d4a] hover:border-[#c9a84c]/40',
              TCM_COLORS.surface
            )}
          >
            <PersonaAvatar persona={selectedPersona} size="sm" />
            <div className="text-left">
              <div className="text-white font-medium text-xs">{selectedPersona.nameZh}</div>
              <div className="text-slate-500 text-[10px]">{selectedPersona.taglineZh}</div>
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 transition-transform', showPersonaPicker && 'rotate-180')} />
          </button>

          <button
            onClick={clearChat}
            className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors px-2 py-1"
          >
            清空对话
          </button>

          <div className="text-xs text-slate-600 ml-auto hidden sm:block">
            {messages.length === 0 ? (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {Object.keys(TCM_PERSONA_LIST).length} 位医家可选
              </span>
            ) : (
              <span>{messages.length} 条对话</span>
            )}
          </div>
        </div>

        {/* Persona Picker Dropdown */}
        <AnimatePresence>
          {showPersonaPicker && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn('mt-2 p-3 rounded-xl border max-h-72 overflow-y-auto', TCM_COLORS.surface, TCM_COLORS.border)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TCM_PERSONA_LIST.map(persona => (
                  <button
                    key={persona.id}
                    onClick={() => {
                      setSelectedPersona(persona as TCMPersona);
                      setShowPersonaPicker(false);
                    }}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
                      selectedPersona.id === persona.id
                        ? 'border-[#c9a84c]/50 bg-[#c9a84c]/10'
                        : 'border-transparent hover:border-[#1e2d4a] hover:bg-white/5'
                    )}
                  >
                    <PersonaAvatar persona={persona as TCMPersona} size="md" />
                    <div className="min-w-0">
                      <div className="text-white font-medium text-xs truncate">{persona.nameZh}</div>
                      <div className="text-slate-500 text-[10px] truncate">{persona.taglineZh}</div>
                    </div>
                    {selectedPersona.id === persona.id && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#c9a84c] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
                <path d="M16 2 A14 14 0 0 1 16 30 A7 7 0 0 1 16 16 A7 7 0 0 0 16 2" fill="#c9a84c"/>
                <circle cx="16" cy="8.5" r="2.5" fill="#050810"/>
                <circle cx="16" cy="23.5" r="2.5" fill="#c9a84c"/>
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base mb-1">欢迎来到 {selectedPersona.nameZh} 的诊室</h2>
              <p className="text-slate-500 text-sm max-w-sm">{selectedPersona.briefZh?.slice(0, 100)}...</p>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="flex items-center gap-1.5 justify-center">
                <Brain className="w-3 h-3" />
                核心思维：{selectedPersona.mentalModels?.slice(0, 3).map(m => m.nameZh).join(' · ') || '综合辨证'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 pt-2">
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" />双语支持</span>
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />古籍引证</span>
              <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" />医疗免责声明</span>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
          >
            {msg.role === 'assistant' && <PersonaAvatar persona={selectedPersona} size="md" />}
            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-full bg-[#1e2d4a] flex items-center justify-center text-white text-sm font-medium shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
            <div className={cn('max-w-[80%] space-y-1', msg.role === 'user' && 'items-end')}>
              {msg.role === 'user' && (
                <div className="text-xs text-slate-500 text-right px-1">{msg.personaName}</div>
              )}
              <div
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'assistant'
                    ? `${TCM_COLORS.surface} text-slate-200 border ${TCM_COLORS.border} rounded-tl-sm`
                    : 'bg-[#1e2d4a] text-white rounded-tr-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <PersonaAvatar persona={selectedPersona} size="md" />
            <div className={cn('px-4 py-3 rounded-2xl text-sm', TCM_COLORS.surface, TCM_COLORS.border, 'rounded-tl-sm')}>
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{selectedPersona.nameZh} 正在辨证...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1e2d4a]">
        <div className={cn(
          'flex items-end gap-3 rounded-xl border px-4 py-3',
          TCM_COLORS.input,
          TCM_COLORS.border,
          'focus-within:border-[#c9a84c]/50'
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`询问 ${selectedPersona.nameZh}（症状/养生/方剂/疾病）...`}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 resize-none outline-none leading-relaxed max-h-32"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0',
              input.trim() && !isLoading
                ? 'bg-[#c9a84c] hover:bg-[#b8963e] text-[#050810]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          诊疗建议仅供参考 · {selectedPersona.nameZh} · {Object.keys(TCM_PERSONA_LIST).length} 位古今中医大家
        </p>
      </div>

      {/* 额度用尽弹窗（与人物库一致） */}
      <LimitReachedModal
        isOpen={showLimitModal}
        type={limitModalType}
        onClose={() => setShowLimitModal(false)}
        onSetApiKey={() => { setShowLimitModal(false); }}
      />
    </div>
  );
}
