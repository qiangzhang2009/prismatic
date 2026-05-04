'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ChevronDown, Sparkles, ShieldAlert, BookOpen, Brain, Globe, User, RefreshCw, Clock, Trash2, MessageSquare, X, Download, Image, FileText } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TCM_PERSONA_LIST, TCM_PERSONAS } from '@/lib/tcm-personas';
import { useConversationSync, loadRegistry, saveRegistry as saveSharedRegistry } from '@/lib/use-conversation-sync';
import { useDailyLimit, saveDailyCount } from '@/lib/use-daily-limit';
import { useAuthStore } from '@/lib/auth-store';
import { LimitReachedModal, type LimitModalType } from '@/components/limit-reached-modal';
import { ExportPanel } from '@/components/export-panel';
import { exportChatAsImage, generateChatText, downloadTextViaAPI } from '@/lib/export-chat';
import type { AgentMessage, Mode } from '@/lib/types';
import type { PersonaMeta } from '@/lib/export-chat';

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
const TCM_STORAGE_VERSION = 2;

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
  mode: string;
  participants: string[];
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

function loadTCMRegistry(): TCMRegistry {
  try {
    const raw = localStorage.getItem('prismatic-tcm-registry');
    if (!raw) return { version: TCM_STORAGE_VERSION, conversations: {} };
    const reg: TCMRegistry = JSON.parse(raw);
    // Migrate v1 → v2: rename legacy 'tcm:' prefix to 'tcm:' prefix (same) but fix storage key
    if (reg.version !== TCM_STORAGE_VERSION) {
      return { version: TCM_STORAGE_VERSION, conversations: {} };
    }
    return reg;
  } catch { return { version: TCM_STORAGE_VERSION, conversations: {} }; }
}

function saveTCMRegistry(reg: TCMRegistry) {
  try { localStorage.setItem('prismatic-tcm-registry', JSON.stringify(reg)); } catch {}
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

export function TCMChatInterface() {
  const user = useAuthStore(s => s.user);
  const userId = user?.id;
  const { pushSnapshot } = useConversationSync();
  const { plan, credits, isPaid, hasCredits, dailyLimit, dailyCount,
    dailyRemaining, limitReached, creditsExhausted, incrementCount,
    syncDailyCount,
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
  const [showSidebar, setShowSidebar] = useState(false);
  const [conversationList, setConversationList] = useState<TCMConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitializedRef = useRef(false);
  const migrationDoneRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load TCM messages from localStorage on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;

    // Try TCM-specific registry first
    const tcmReg = loadTCMRegistry();
    if (tcmReg.conversations[key]?.messages?.length > 0) {
      setMessages(tcmReg.conversations[key].messages);
      return;
    }

    // Fall back to shared registry (for migrated data)
    if (userId) {
      const sharedReg = loadRegistry();
      if (sharedReg.conversations[key]?.messages?.length > 0) {
        const shared = sharedReg.conversations[key];
        const loaded: TCMMessage[] = shared.messages.map((m: AgentMessage) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
          personaId: m.personaId || selectedPersona.id,
          personaName: selectedPersona.nameZh,
          timestamp: (m as any).timestamp || new Date().toISOString(),
        }));
        setMessages(loaded);
      }
    }
  }, [selectedPersona.id, userId, selectedPersona.nameZh]);

  // Fetch conversation history list from server when user is logged in
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadFromServer() {
      try {
        const res = await fetch('/api/tcm/conversations?limit=50');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const convs: TCMConversationMeta[] = data.conversations || [];
        setConversationList(convs);

        // Auto-resume the most recent conversation for the selected persona
        const latestForPersona = convs.find(c =>
          c.participants?.[0] === selectedPersona.id
        );
        if (latestForPersona && messages.length === 0) {
          loadConversation(latestForPersona.id, latestForPersona.participants?.[0]);
        }
      } catch {
        // ignore
      }
    }

    loadFromServer();
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to localStorage whenever messages change (both TCM-specific and shared registry)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;

    // Save to TCM-specific registry (fast per-doctor lookup)
    const tcmReg = loadTCMRegistry();
    tcmReg.conversations[key] = {
      messages,
      personaId: selectedPersona.id,
      personaName: selectedPersona.nameZh,
      lastUpdated: Date.now(),
    };
    saveTCMRegistry(tcmReg);

    // Save to shared registry so pushSnapshot/useConversationSync can see it
    if (userId) {
      const sharedKey = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
      const sharedReg = loadRegistry();
      const agentMessages: AgentMessage[] = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        personaId: m.personaId,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      } as AgentMessage));
      sharedReg.conversations[sharedKey] = {
        messages: agentMessages,
        title: '',
        tags: [],
        lastUpdated: Date.now(),
        mode: 'tcm-assistant',
        contentHash: '',
        lastSyncedAt: sharedReg.conversations[sharedKey]?.lastSyncedAt,
        syncStatus: 'pending',
      };
      saveSharedRegistry(sharedReg);
    }
  }, [messages, selectedPersona, userId]);

  // Load a specific conversation from the server
  async function loadConversation(convId: string, personaIdOverride?: string) {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/tcm/conversations/${convId}`);
      if (!res.ok) return;
      const data = await res.json();
      const loadedMessages: TCMMessage[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        personaId: m.personaId || personaIdOverride || selectedPersona.id,
        personaName: TCM_PERSONAS[m.personaId || personaIdOverride || selectedPersona.id]?.nameZh || selectedPersona.nameZh,
        timestamp: m.createdAt,
      }));
      setMessages(loadedMessages);
      setActiveConvId(convId);

      // Switch persona if needed
      const loadedPersonaId = personaIdOverride || data.conversation?.participants?.[0];
      if (loadedPersonaId && loadedPersonaId !== selectedPersona.id) {
        const p = TCM_PERSONA_LIST.find(p => p.id === loadedPersonaId);
        if (p) setSelectedPersona(p as TCMPersona);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }

  // Delete a conversation from the server
  async function deleteConversation(convId: string) {
    try {
      await fetch(`/api/tcm/conversations/${convId}`, { method: 'DELETE' });
      setConversationList(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {
      // ignore
    }
  }

  // Start a new conversation (clears current state)
  function startNewConversation() {
    setActiveConvId(null);
    setMessages([]);
    setShowSidebar(false);
  }

  // Migration: on mount, detect any existing TCM messages in TCM-specific registry
  // and write them to the shared registry so useConversationSync can push them to the server.
  useEffect(() => {
    if (migrationDoneRef.current) return;
    if (!userId) return;
    migrationDoneRef.current = true;

    const tcmReg = loadTCMRegistry();
    const keys = Object.keys(tcmReg.conversations).filter(k => k.startsWith(TCM_CONVERSATION_PREFIX));

    if (keys.length === 0) return;

    const sharedReg = loadRegistry();
    for (const key of keys) {
      const stored = tcmReg.conversations[key];
      if (!stored?.messages?.length) continue;

      const personaId = stored.personaId || key.replace(TCM_CONVERSATION_PREFIX, '');
      const agentMessages: AgentMessage[] = stored.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        personaId: m.personaId,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      } as AgentMessage));

      const firstMsg = stored.messages.find((m: TCMMessage) => m.role === 'user');
      const title = firstMsg
        ? `向${stored.personaName || personaId}提问：${firstMsg.content.slice(0, 20).replace(/\n/g, ' ').trim()}`
        : '';

      sharedReg.conversations[key] = {
        messages: agentMessages,
        title,
        tags: [],
        lastUpdated: stored.lastUpdated || Date.now(),
        mode: 'tcm-assistant',
        contentHash: '',
        lastSyncedAt: undefined,
        syncStatus: 'pending',
      };
      console.log(`[TCM Migration] Migrated ${stored.messages.length} messages for ${key}`);
    }
    saveSharedRegistry(sharedReg);
  }, [userId]);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    if (!userId) {
      alert('请先登录后再使用中医对话功能');
      return;
    }

    // 额度预检查（与人物库一致）
    if (limitReached) {
      setLimitModalType('daily_limit');
      setShowLimitModal(true);
      return;
    }

    const userMsg: TCMMessage = {
      id: `user-${Date.now()}`,
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
          conversationId: activeConvId || undefined,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '请先登录');
      }

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        // Sync server count BEFORE showing modal so the pre-check next time shows correct number
        if (errData.serverDailyCount !== undefined) {
          syncDailyCount(errData.serverDailyCount);
        }
        throw Object.assign(new Error(errData.error || '今日对话次数已达上限'), { code: 'DAILY_LIMIT_REACHED' });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || '请求失败');
      }

      const data = await res.json();

      // Save the conversationId so future messages continue this conversation
      if (data.conversationId) {
        setActiveConvId(data.conversationId);
      }

      const assistantMsg: TCMMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        personaId: data.personaId,
        personaName: data.personaName,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      setSyncStatus('saved');

      // 更新本地计数：优先使用服务器权威计数立即同步 state
      if (data.serverDailyCount !== undefined) {
        // syncDailyCount 同时更新 localStorage 和 React state，触发立即重渲染
        syncDailyCount(data.serverDailyCount);
      } else {
        incrementCount();
      }
      // 如果服务端扣了积分，同步到本地 store
      if (data.creditsAfter !== undefined) {
        useAuthStore.getState().updateUser({ credits: data.creditsAfter });
      }

      // Push to server via sync endpoint (mirrors persona chat pushSnapshot)
      const conversationKey = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
      const allMessages = [...messages, userMsg, assistantMsg];
      const syncMessages = allMessages.map(m => ({
        id: m.id,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
        personaId: m.personaId,
        timestamp: m.timestamp || new Date().toISOString(),
      }));

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

  function clearChat() {
    const key = `${TCM_CONVERSATION_PREFIX}${selectedPersona.id}`;
    const reg = loadTCMRegistry();
    delete reg.conversations[key];
    saveTCMRegistry(reg);
    setMessages([]);
    setActiveConvId(null);
  }

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

  // ── Export helpers (reuse existing export-chat.ts logic) ──────────────────
  // Map TCMMessage[] → AgentMessage[] for compatibility with export utilities
  const messagesAsAgentMessages: AgentMessage[] = messages.map(m => ({
    id: m.id,
    personaId: m.personaId,
    role: m.role === 'assistant' ? 'agent' : 'user',
    content: m.content,
    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
  }));

  const handleExportAsImage = useCallback(async () => {
    if (messages.length === 0) return;
    setIsExporting(true);
    try {
      await exportChatAsImage(
        messagesAsAgentMessages,
        [selectedPersona.id],
        'solo',
        `向${selectedPersona.nameZh}提问`,
        [selectedPersona as PersonaMeta]
      );
    } catch (error) {
      console.error('[TCM Export] Image export failed:', error);
      alert('图片导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  }, [messages, messagesAsAgentMessages, selectedPersona]);

  const handleExportAsText = useCallback(async () => {
    if (messages.length === 0) return;
    setIsExporting(true);
    try {
      const content = await generateChatText(
        messagesAsAgentMessages,
        [selectedPersona.id],
        'solo',
        [selectedPersona as PersonaMeta]
      );
      const filename = `中医对话_${new Date().toISOString().slice(0, 10)}.txt`;
      await downloadTextViaAPI(content, filename);
    } catch (error) {
      console.error('[TCM Export] Text export failed:', error);
      alert('文本导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  }, [messages, messagesAsAgentMessages, selectedPersona]);

  return (
    <div className={cn('flex flex-row h-screen overflow-hidden', TCM_COLORS.bg)}>
      {/* ── Sidebar: Conversation History ─────────────────── */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-72 flex-shrink-0 flex flex-col border-r border-[#1e2d4a] overflow-hidden"
            style={{ background: TCM_COLORS.surface }}
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#c9a84c]" />
                <span className="text-sm font-semibold text-white">对话历史</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewConversation}
                  className="px-2 py-1 text-xs rounded bg-[#c9a84c]/15 text-[#c9a84c] hover:bg-[#c9a84c]/25 transition-colors border border-[#c9a84c]/30"
                >
                  新对话
                </button>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto py-2">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              ) : conversationList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500">暂无对话记录</p>
                  <p className="text-[10px] text-slate-600 mt-1">开始一段新对话吧</p>
                </div>
              ) : (
                <div className="space-y-0.5 px-2">
                  {conversationList.map(conv => {
                    const personaId = conv.participants?.[0] || selectedPersona.id;
                    const personaName = TCM_PERSONAS[personaId]?.nameZh || personaId;
                    const isActive = conv.id === activeConvId;
                    const dateStr = conv.updatedAt
                      ? new Date(conv.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                      : '';

                    return (
                      <div
                        key={conv.id}
                        className={cn(
                          'group relative rounded-lg p-2.5 cursor-pointer transition-all',
                          isActive
                            ? 'bg-[#c9a84c]/10 border border-[#c9a84c]/30'
                            : 'hover:bg-white/5 border border-transparent'
                        )}
                        onClick={() => loadConversation(conv.id, personaId)}
                      >
                        {/* Delete button */}
                        <button
                          onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        {/* Persona indicator */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{
                              background: `linear-gradient(135deg, ${TCM_PERSONAS[personaId]?.gradientFrom || '#c9a84c'}, ${TCM_PERSONAS[personaId]?.gradientTo || '#b8963e'})`
                            }}
                          >
                            {personaName.slice(0, 1)}
                          </div>
                          <span className="text-xs font-medium text-[#c9a84c]">{personaName}</span>
                        </div>

                        {/* Title */}
                        <p className={cn(
                          'text-xs leading-snug truncate pr-5',
                          isActive ? 'text-white' : 'text-slate-300'
                        )}>
                          {conv.title || '无标题对话'}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-600">{dateStr}</span>
                          <span className="text-[10px] text-slate-600">{conv.messageCount} 条</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">

      {/* Header */}
      <div className={cn('flex items-center gap-3 px-5 py-3 border-b shrink-0', TCM_COLORS.border)}>
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

          {/* Export dropdown */}
          {messages.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowExportPanel(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                  'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-[#1e2d4a]/80',
                  TCM_COLORS.surface
                )}
                title="导出对话记录"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">导出</span>
              </button>

              <AnimatePresence>
                {showExportPanel && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-50"
                  >
                    {/* Backdrop: click outside to close */}
                    <div
                      className="fixed inset-0 z-[-1]"
                      onClick={() => setShowExportPanel(false)}
                    />
                    <div className="bg-[#0d1424] border border-[#1e2d4a] rounded-xl shadow-2xl w-44 overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#1e2d4a]">
                        <p className="text-xs font-semibold text-white">导出对话记录</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{messages.length} 条消息</p>
                      </div>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
                        onClick={handleExportAsImage}
                      >
                        <Image className="w-4 h-4 text-[#c9a84c]" />
                        <span>导出为图片</span>
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 transition-colors"
                        onClick={handleExportAsText}
                      >
                        <FileText className="w-4 h-4 text-[#c9a84c]" />
                        <span>导出为文本</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* History / conversations sidebar toggle */}
          {userId && (
            <button
              onClick={() => setShowSidebar(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                showSidebar
                  ? 'bg-[#c9a84c]/15 border-[#c9a84c]/40 text-[#c9a84c]'
                  : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-[#1e2d4a]/80',
                TCM_COLORS.surface
              )}
              title="对话历史"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">历史</span>
              {conversationList.length > 0 && (
                <span className={cn(
                  'text-[10px] px-1 rounded-full',
                  showSidebar ? 'bg-[#c9a84c]/20' : 'bg-[#1e2d4a]'
                )}>
                  {conversationList.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

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

      {/* 导出面板（与人物库一致） */}
      <ExportPanel
        open={showExportPanel}
        onClose={() => setShowExportPanel(false)}
        messages={messagesAsAgentMessages}
        {...({ mode: 'solo' as Mode })}
        selectedPersonaIds={[selectedPersona.id]}
        personaNames={selectedPersona.nameZh}
        personas={[selectedPersona as PersonaMeta]}
      />
      </div>
    </div>
  );
}
