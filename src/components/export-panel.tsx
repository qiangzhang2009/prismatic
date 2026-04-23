'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Square, Image, FileText, Calendar,
  Download, Loader2, CheckSquare, Search, RotateCcw,
  User, Bot, Cpu, ChevronsUpDown, ArrowUpDown,
  Hash, SlidersHorizontal
} from 'lucide-react';
import type { AgentMessage, Mode } from '@/lib/types';
import { exportChatAsImage, exportChatAsText } from '@/lib/export-chat';

type DateFilter = 'all' | 'today' | 'week';
type ExportFormat = 'image' | 'text';
type RoleFilter = 'all' | 'user' | 'agent' | 'system';

interface ExportPanelProps {
  open: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  mode: Mode;
  selectedPersonaIds: string[];
  personaNames: string;
}

function isToday(ts: Date | number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(ts: Date | number): boolean {
  const dMs = new Date(ts).getTime();
  const nowMs = Date.now();
  const startMs = new Date(nowMs);
  startMs.setDate(startMs.getDate() - startMs.getDay());
  startMs.setHours(0, 0, 0, 0);
  const endMs = startMs.getTime() + 7 * 24 * 60 * 60 * 1000;
  return dMs >= startMs.getTime() && dMs < endMs;
}

function formatTime(ts: Date | number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExportPanel({
  open,
  onClose,
  messages,
  mode,
  selectedPersonaIds,
  personaNames,
}: ExportPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [format, setFormat] = useState<ExportFormat>('image');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Apply all filters
  const filteredMessages = useMemo(() => {
    let result = messages;

    // Date filter
    if (dateFilter !== 'all') {
      result = result.filter((msg) => {
        const ts = msg.timestamp ?? 0;
        if (dateFilter === 'today') return isToday(ts);
        if (dateFilter === 'week') return isThisWeek(ts);
        return true;
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((msg) => msg.role === roleFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((msg) => msg.content.toLowerCase().includes(q));
    }

    // Sort
    if (sortOrder === 'asc') {
      result = [...result].sort((a, b) => {
        const ta = new Date(a.timestamp ?? 0).getTime();
        const tb = new Date(b.timestamp ?? 0).getTime();
        return ta - tb;
      });
    } else {
      result = [...result].sort((a, b) => {
        const ta = new Date(a.timestamp ?? 0).getTime();
        const tb = new Date(b.timestamp ?? 0).getTime();
        return tb - ta;
      });
    }

    return result;
  }, [messages, dateFilter, roleFilter, searchQuery, sortOrder]);

  const allSelected =
    filteredMessages.length > 0 &&
    filteredMessages.every((m) => selected.has(m.id));

  const selectedCount = selected.size;
  const selectableCount = filteredMessages.filter(m => m.role !== 'system').length;
  const userCount = filteredMessages.filter((m) => m.role === 'user').length;
  const agentCount = filteredMessages.filter((m) => m.role === 'agent').length;
  const systemCount = filteredMessages.filter((m) => m.role === 'system').length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredMessages.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredMessages.forEach((m) => next.add(m.id));
        return next;
      });
    }
  }, [allSelected, filteredMessages]);

  const toggleOne = useCallback((id: string, shiftHeld: boolean = false) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (shiftHeld && lastClickedId) {
        // Range selection
        const msgIds = filteredMessages.map(m => m.id);
        const fromIdx = msgIds.indexOf(lastClickedId);
        const toIdx = msgIds.indexOf(id);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
          for (let i = start; i <= end; i++) {
            next.add(msgIds[i]);
          }
        }
        setLastClickedId(id);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setLastClickedId(id);
      }

      return next;
    });
  }, [lastClickedId, filteredMessages]);

  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredMessages.forEach((m) => {
        if (next.has(m.id)) next.delete(m.id);
        else next.add(m.id);
      });
      return next;
    });
  }, [filteredMessages]);

  const selectByRole = useCallback((role: 'user' | 'agent' | 'all') => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredMessages.forEach((m) => {
        if (role === 'all' || m.role === role) {
          next.add(m.id);
        }
      });
      return next;
    });
  }, [filteredMessages]);

  const selectRecent = useCallback((count: number) => {
    const msgs = [...filteredMessages]
      .filter(m => m.role !== 'system')
      .slice(0, count);
    setSelected((prev) => {
      const next = new Set(prev);
      msgs.forEach((m) => next.add(m.id));
      return next;
    });
  }, [filteredMessages]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setLastClickedId(null);
  }, []);

  // Reset filters when panel opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setDateFilter('all');
      setRoleFilter('all');
      setSearchQuery('');
      setLastClickedId(null);
      setShowAdvancedFilters(false);
      setSortOrder('desc');
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        setSelected(new Set(filteredMessages.map(m => m.id)));
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if (ctrl && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, filteredMessages, clearSelection]);

  const handleExport = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);
    try {
      const msgsToExport = messages.filter((m) => selected.has(m.id));
      if (format === 'image') {
        await exportChatAsImage(msgsToExport, selectedPersonaIds, mode);
      } else {
        exportChatAsText(msgsToExport, selectedPersonaIds, mode);
      }
      onClose();
    } catch (err) {
      console.error('[ExportPanel] Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const dateLabels: Record<DateFilter, string> = {
    all: '全部',
    today: '今天',
    week: '本周',
  };

  const roleLabels: Record<RoleFilter, { label: string; count: number }> = {
    all: { label: '全部', count: filteredMessages.length },
    user: { label: '我', count: userCount },
    agent: { label: 'AI', count: agentCount },
    system: { label: '系统', count: systemCount },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">导出对话记录</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  已选 {selectedCount} / {selectableCount} 条消息
                  {selectedCount > 0 && selectedCount !== selectableCount && (
                    <span className="ml-1 text-prism-blue">· 按 Enter 导出</span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Search bar ─────────────────────────────────────── */}
            <div className="flex-shrink-0 px-5 py-2.5 border-b border-border-subtle">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索消息内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs bg-bg-surface border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-prism-blue/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Filter row ──────────────────────────────────────── */}
            <div className="flex-shrink-0 px-5 py-2.5 border-b border-border-subtle flex items-center gap-2 overflow-x-auto scrollbar-none">
              {/* Date filter */}
              <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-0.5 flex-shrink-0">
                {(['all', 'today', 'week'] as DateFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setDateFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      dateFilter === key
                        ? 'bg-prism-blue/20 text-prism-blue'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {dateLabels[key]}
                  </button>
                ))}
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-0.5 flex-shrink-0">
                {(['all', 'user', 'agent', 'system'] as RoleFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRoleFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                      roleFilter === key
                        ? 'bg-prism-blue/20 text-prism-blue'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {key === 'user' && <User className="w-3 h-3" />}
                    {key === 'agent' && <Bot className="w-3 h-3" />}
                    {key === 'system' && <Cpu className="w-3 h-3" />}
                    {key === 'all' && <SlidersHorizontal className="w-3 h-3" />}
                    {roleLabels[key].label}
                    <span className="text-[10px] opacity-60">{roleLabels[key].count}</span>
                  </button>
                ))}
              </div>

              {/* Sort */}
              <button
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors flex-shrink-0 ${
                  sortOrder !== 'desc'
                    ? 'bg-prism-purple/15 text-prism-purple'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title={sortOrder === 'desc' ? '最新在前' : '最旧在前'}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortOrder === 'desc' ? '最新' : '最旧'}
              </button>

              {/* Advanced filters toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors flex-shrink-0 ${
                  showAdvancedFilters
                    ? 'bg-prism-blue/15 text-prism-blue'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <ChevronsUpDown className="w-3 h-3" />
                批量
              </button>

              {/* Clear search hint */}
              {filteredMessages.length > 0 && (
                <span className="ml-auto text-[10px] text-text-muted flex-shrink-0">
                  ⌘F 搜索 · ⌘A 全选 · Esc 清除
                </span>
              )}
            </div>

            {/* ── Advanced filters panel ─────────────────────────── */}
            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 overflow-hidden border-b border-border-subtle"
                >
                  <div className="px-5 py-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-muted">快速选择：</span>

                    <button
                      onClick={toggleAll}
                      className="px-2.5 py-1 rounded-lg text-xs bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-base border border-border-subtle transition-colors"
                    >
                      {allSelected ? '取消全选' : '全选'}
                    </button>

                    <button
                      onClick={invertSelection}
                      className="px-2.5 py-1 rounded-lg text-xs bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-base border border-border-subtle transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      反转
                    </button>

                    <div className="w-px h-4 bg-border-subtle mx-1" />

                    <button
                      onClick={() => selectByRole('user')}
                      className="px-2.5 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      我的 ({userCount})
                    </button>

                    <button
                      onClick={() => selectByRole('agent')}
                      className="px-2.5 py-1 rounded-lg text-xs bg-prism-blue/10 text-prism-blue hover:bg-prism-blue/20 border border-prism-blue/20 transition-colors flex items-center gap-1"
                    >
                      <Bot className="w-3 h-3" />
                      AI ({agentCount})
                    </button>

                    <div className="w-px h-4 bg-border-subtle mx-1" />

                    <button
                      onClick={() => selectRecent(5)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-base border border-border-subtle transition-colors"
                    >
                      最近 5 条
                    </button>

                    <button
                      onClick={() => selectRecent(10)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-base border border-border-subtle transition-colors"
                    >
                      最近 10 条
                    </button>

                    {selectedCount > 0 && (
                      <>
                        <div className="w-px h-4 bg-border-subtle mx-1" />
                        <button
                          onClick={clearSelection}
                          className="px-2.5 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                        >
                          清除 ({selectedCount})
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Message list ────────────────────────────────────────── */}
            <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                  <div className="text-4xl mb-3 opacity-30">
                    {searchQuery ? '🔍' : '📭'}
                  </div>
                  <p className="text-sm">
                    {searchQuery ? '没有找到匹配的消息' : '暂无消息记录'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs text-prism-blue hover:underline"
                    >
                      清除搜索
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-5 py-2 space-y-1">
                  {filteredMessages.map((msg, idx) => {
                    const checked = selected.has(msg.id);
                    const isSystemMsg = msg.role === 'system';
                    const speakerLabel =
                      msg.role === 'user'
                        ? '你'
                        : msg.role === 'system'
                        ? '系统'
                        : (() => {
                            return personaNames.split('、')[0] || 'AI';
                          })();

                    const speakerIcon = msg.role === 'user' ? (
                      <User className="w-3 h-3" />
                    ) : msg.role === 'system' ? (
                      <Cpu className="w-3 h-3" />
                    ) : (
                      <Bot className="w-3 h-3" />
                    );

                    const contentPreview =
                      msg.content.length > 80
                        ? msg.content.slice(0, 80) + '...'
                        : msg.content;
                    const ts = msg.timestamp ?? 0;
                    const timeStr = ts ? formatTime(ts) : '';
                    const roleColorClass =
                      msg.role === 'user'
                        ? 'text-blue-400'
                        : msg.role === 'system'
                        ? 'text-purple-400'
                        : 'text-prism-blue';

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all group ${
                          checked
                            ? 'bg-prism-blue/10 border border-prism-blue/25'
                            : 'hover:bg-bg-surface border border-transparent'
                        } ${isSystemMsg && !checked ? 'opacity-50' : ''}`}
                        onClick={(e) => {
                          if (isSystemMsg) return;
                          toggleOne(msg.id, e.shiftKey);
                        }}
                      >
                        <button
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                            checked
                              ? 'bg-prism-blue border-prism-blue'
                              : 'border-border-subtle group-hover:border-prism-blue/50'
                          } ${isSystemMsg ? 'opacity-30 cursor-not-allowed' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSystemMsg) toggleOne(msg.id, e.shiftKey);
                          }}
                        >
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-semibold ${roleColorClass} flex items-center gap-1`}>
                              {speakerIcon}
                              {speakerLabel}
                            </span>
                            {timeStr && (
                              <span className="text-[10px] text-text-muted">{timeStr}</span>
                            )}
                            {idx === 0 && (
                              <span className="text-[9px] bg-prism-blue/20 text-prism-blue px-1.5 py-0.5 rounded-full font-medium">
                                最新
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                            {contentPreview}
                          </p>
                        </div>

                        {/* Quick select buttons on hover */}
                        {!checked && !isSystemMsg && (
                          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectRecent(5);
                              }}
                              className="text-[10px] text-text-muted hover:text-prism-blue transition-colors px-1.5 py-0.5 rounded bg-bg-surface"
                              title="选中此条及之前的5条"
                            >
                              +5
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer: options + format + button ──────────────────── */}
            <div className="flex-shrink-0 border-t border-border-subtle">
              {/* Export format tabs */}
              <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                <span className="text-xs text-text-muted">导出格式</span>
                <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-0.5">
                  <button
                    onClick={() => setFormat('image')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      format === 'image'
                        ? 'bg-prism-blue/20 text-prism-blue'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Image className="w-3.5 h-3.5" />
                    图片
                  </button>
                  <button
                    onClick={() => setFormat('text')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      format === 'text'
                        ? 'bg-prism-purple/20 text-prism-purple'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    文本
                  </button>
                </div>

                {/* Include metadata toggle */}
                <button
                  onClick={() => setIncludeMetadata((v) => !v)}
                  className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    includeMetadata
                      ? 'bg-prism-blue/10 text-prism-blue border border-prism-blue/25'
                      : 'text-text-muted hover:text-text-primary border border-border-subtle'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  包含元信息
                </button>
              </div>

              {/* Export button */}
              <div className="px-5 pb-5">
                <button
                  onClick={handleExport}
                  disabled={selectedCount === 0 || isExporting}
                  className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    selectedCount === 0
                      ? 'bg-bg-surface text-text-muted cursor-not-allowed border border-border-subtle'
                      : 'bg-gradient-to-r from-prism-blue to-prism-purple text-white hover:opacity-90 active:scale-[0.98] shadow-lg shadow-prism-blue/20'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      正在生成...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {selectedCount > 0
                        ? `导出 ${selectedCount} 条消息`
                        : '请先选择要导出的消息'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
