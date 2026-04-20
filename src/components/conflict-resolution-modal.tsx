'use client';

/**
 * ConflictResolutionModal — Resolves multi-device sync conflicts
 *
 * Shows side-by-side comparison of local vs server conversation versions,
 * with three resolution strategies: keep local, keep server, or merge.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Server, GitMerge, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncConflict, ResolutionStrategy } from '@prisma/client';

export interface ConflictDisplayData {
  id: string;
  conversationKey: string;
  personaNames: string[];
  localSnapshot: {
    title?: string;
    messageCount: number;
    lastUpdatedAt: string;
    preview: string; // first message preview
  };
  serverSnapshot: {
    title?: string;
    messageCount: number;
    lastUpdatedAt: string;
    preview: string;
  };
  conflictType: string;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ConflictDisplayData[];
  currentIndex: number;
  onClose: () => void;
  onResolve: (conflictId: string, strategy: ResolutionStrategy) => Promise<void>;
  onResolveAll?: (strategy: ResolutionStrategy) => Promise<void>;
  resolving?: boolean;
}

export function ConflictResolutionModal({
  isOpen,
  conflicts,
  currentIndex,
  onClose,
  onResolve,
  onResolveAll,
  resolving = false,
}: ConflictResolutionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy>('MERGE_APPEND');
  const [localExpanded, setLocalExpanded] = useState(false);
  const [serverExpanded, setServerExpanded] = useState(false);

  const current = conflicts[currentIndex];

  useEffect(() => {
    if (isOpen) {
      setSelectedStrategy('MERGE_APPEND');
      setLocalExpanded(false);
      setServerExpanded(false);
    }
  }, [isOpen, currentIndex]);

  if (!current) return null;

  const strategies: { value: ResolutionStrategy; label: string; desc: string; icon: typeof Monitor }[] = [
    { value: 'LOCAL_WINS', label: '保留本地', desc: '使用本设备版本，覆盖服务器', icon: Monitor },
    { value: 'SERVER_WINS', label: '保留服务器', desc: '使用服务器版本，覆盖本地', icon: Server },
    { value: 'MERGE_APPEND', label: '智能合并', desc: '按时间戳交错合并，去重', icon: GitMerge },
  ];

  const handleResolve = async () => {
    await onResolve(current.id, selectedStrategy);
  };

  const handleResolveAll = async () => {
    await onResolveAll?.(selectedStrategy);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-3xl max-h-[90vh] bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-100">同步冲突</h2>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    {currentIndex + 1} / {conflicts.length}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">
                  {current.personaNames.join(' + ')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Conflict type badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  {getConflictTypeLabel(current.conflictType)}
                </span>
                <span className="text-xs text-gray-600">
                  ID: {current.id.slice(0, 8)}...
                </span>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Local version */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-blue-500/10 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-300">本设备</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {current.localSnapshot.messageCount} 条消息
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">标题</p>
                      <p className="text-sm text-gray-200">
                        {current.localSnapshot.title || '（无标题）'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">最后更新</p>
                      <p className="text-xs text-gray-400">
                        {new Date(current.localSnapshot.lastUpdatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">首条消息</p>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                        {current.localSnapshot.preview || '（无内容）'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Server version */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-purple-500/10 flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">服务器</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {current.serverSnapshot.messageCount} 条消息
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">标题</p>
                      <p className="text-sm text-gray-200">
                        {current.serverSnapshot.title || '（无标题）'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">最后更新</p>
                      <p className="text-xs text-gray-400">
                        {new Date(current.serverSnapshot.lastUpdatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">首条消息</p>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                        {current.serverSnapshot.preview || '（无内容）'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resolution strategies */}
              <div>
                <p className="text-sm font-medium text-gray-300 mb-3">选择解决方式</p>
                <div className="grid grid-cols-3 gap-3">
                  {strategies.map(({ value, label, desc, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedStrategy(value)}
                      className={cn(
                        'relative flex flex-col items-start p-3.5 rounded-xl border transition-all duration-150 text-left',
                        selectedStrategy === value
                          ? 'border-prism-blue/60 bg-prism-blue/10'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      )}
                    >
                      {selectedStrategy === value && (
                        <span className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-prism-blue" />
                        </span>
                      )}
                      <Icon className={cn(
                        'w-5 h-5 mb-2',
                        selectedStrategy === value ? 'text-prism-blue' : 'text-gray-500'
                      )} />
                      <span className={cn(
                        'text-sm font-medium mb-1',
                        selectedStrategy === value ? 'text-gray-100' : 'text-gray-300'
                      )}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-500 leading-relaxed">
                        {desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution explanation */}
              <div className="rounded-xl bg-gray-800/40 border border-gray-800 p-4">
                <p className="text-sm text-gray-400 leading-relaxed">
                  {selectedStrategy === 'LOCAL_WINS' && (
                    <><strong className="text-gray-200">保留本地</strong> — 将删除服务器上的对话记录，替换为本设备版本。此设备的对话将成为唯一版本，其他设备需要重新同步。
                    </>
                  )}
                  {selectedStrategy === 'SERVER_WINS' && (
                    <><strong className="text-gray-200">保留服务器</strong> — 将覆盖本设备的对话记录，使用服务器版本。本地未同步的内容可能会丢失。
                    </>
                  )}
                  {selectedStrategy === 'MERGE_APPEND' && (
                    <><strong className="text-gray-200">智能合并</strong> — 将两个版本的对话按时间戳交错合并，自动去重最新内容。推荐使用，能最大程度保留双方的对话历史。
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
              {conflicts.length > 1 ? (
                <button
                  onClick={handleResolveAll}
                  disabled={resolving}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
                >
                  对全部 {conflicts.length} 个冲突应用此策略
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  disabled={resolving}
                  className="px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-800 text-sm text-gray-300 transition-colors disabled:opacity-50"
                >
                  稍后解决
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className={cn(
                    'px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                    'bg-prism-blue hover:bg-prism-blue/90 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    resolving && 'opacity-70'
                  )}
                >
                  {resolving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <GitMerge className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <>
                      确认解决 <ArrowRight className="w-4 h-4" />
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

function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CONTENT_OVERWRITE: '内容被覆盖',
    TITLE_CONFLICT: '标题不一致',
    BOTH_CREATED: '双方都新建了对话',
    DELETED_CONFLICT: '一方已删除',
  };
  return labels[type] ?? type;
}
