'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonaCard } from '@/components/persona-card';
import { ModeSelector } from '@/components/mode-selector';
import { PERSONA_LIST, getPersonasByIds, getPersona } from '@/lib/personas';
import type { Mode, Persona, AgentMessage } from '@/lib/types';
import { nanoid } from 'nanoid';

const STORAGE_KEY = 'prismatic-chat-state';

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

  const saved = loadSavedState();

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
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  // Handle mode changes: adjust participant count if needed
  useEffect(() => {
    const minParticipants = mode === 'solo' ? 1 : 2;
    const maxParticipants = mode === 'prism' ? 3 : mode === 'roundtable' ? 8 : 6;

    if (selectedIds.length < minParticipants) {
      const currentSet = new Set(selectedIds);
      for (const p of PERSONA_LIST) {
        if (!currentSet.has(p.id)) {
          currentSet.add(p.id);
          if (currentSet.size >= minParticipants) break;
        }
      }
      setSelectedIds(Array.from(currentSet));
    }

    if (selectedIds.length > maxParticipants) {
      setSelectedIds(selectedIds.slice(0, maxParticipants));
    }
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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          participantIds: selectedIds,
          message: input.trim(),
          conversationId: 'local',
        }),
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();

      // Add agent responses
      if (data.messages) {
        for (const msg of data.messages) {
          setMessages((prev) => [
            ...prev,
            {
              ...msg,
              id: nanoid(),
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Add error message
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
        <div className="flex items-center gap-3 mb-3">
          {/* Mode selector */}
          <ModeSelector value={mode} onChange={setMode} participantCount={selectedIds.length} />

          {/* Persona picker toggle */}
          <button
            className="ml-auto flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setShowPersonaPicker(!showPersonaPicker)}
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
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPersonaPicker && 'rotate-180')} />
          </button>

          {/* Settings */}
          <button
            className="text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Persona picker dropdown */}
        <AnimatePresence>
          {showPersonaPicker && (
            <motion.div
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
        {messages.length === 0 && (
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
                  {message.content}
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
                <div className="text-sm text-text-muted px-4 py-2 rounded-lg bg-bg-elevated">
                  {message.content}
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{persona.nameZh}</span>
                  {message.confidence !== undefined && (
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1 rounded-full bg-bg-elevated overflow-hidden">
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
                  <div className="prose prose-sm prose-invert max-w-none">
                    {message.content}
                  </div>
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
            disabled={!input.trim() || isLoading}
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
