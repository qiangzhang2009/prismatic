'use client';

/**
 * SyncStatusIndicator — Floating sync status indicator
 *
 * Shows in the bottom-right corner of the screen:
 *  - Idle (green dot): synced
 *  - Syncing (spinning): in progress
 *  - Error (red): sync failed
 *  - Conflict (orange badge): unresolved conflicts
 *
 * Click to expand: shows last sync time, conflict count, manual sync button
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, AlertTriangle, Check, RefreshCw, ChevronUp, X } from 'lucide-react';

interface SyncStatusIndicatorProps {
  deviceId?: string | null;
  syncToken?: string | null;
  lastSyncedAt?: string | null;
  conflicts?: number;
  onSync?: () => void;
  onConflictsClick?: () => void;
}

export function SyncStatusIndicator({
  syncToken,
  lastSyncedAt,
  conflicts = 0,
  onSync,
  onConflictsClick,
}: SyncStatusIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'conflict'>('idle');

  useEffect(() => {
    setStatus(conflicts > 0 ? 'conflict' : 'idle');
  }, [conflicts]);

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="w-3.5 h-3.5 animate-spin text-prism-blue" />;
      case 'error':
        return <CloudOff className="w-3.5 h-3.5 text-red-400" />;
      case 'conflict':
        return (
          <div className="relative">
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            {conflicts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-400 text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                {conflicts > 9 ? '9+' : conflicts}
              </span>
            )}
          </div>
        );
      default:
        return <Cloud className="w-3.5 h-3.5 text-green-400" />;
    }
  };

  const getStatusText = () => {
    if (status === 'syncing') return '同步中...';
    if (status === 'error') return '同步失败';
    if (status === 'conflict') return `${conflicts} 个冲突待解决`;
    if (lastSyncedAt) {
      const ago = formatTimeAgo(lastSyncedAt);
      return `已同步 ${ago}`;
    }
    return '已同步';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'syncing': return 'border-prism-blue/30 bg-prism-blue/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      case 'conflict': return 'border-amber-500/30 bg-amber-500/5';
      default: return 'border-green-500/20 bg-green-500/5';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-gray-900 border border-border-subtle rounded-2xl shadow-2xl w-72 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">同步状态</span>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Status row */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${getStatusColor()}`}>
                    {getStatusIcon()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{getStatusText()}</p>
                    {lastSyncedAt && (
                      <p className="text-xs text-gray-500">
                        上次: {formatDateTime(lastSyncedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Conflict warning */}
                {conflicts > 0 && (
                  <button
                    onClick={() => { onConflictsClick?.(); setExpanded(false); }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm hover:bg-amber-500/15 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{conflicts} 个对话同步冲突，请点击解决</span>
                    <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                  </button>
                )}

                {/* Manual sync button */}
                <button
                  onClick={() => { onSync?.(); }}
                  disabled={status === 'syncing'}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-prism-blue/10 border border-prism-blue/20 text-prism-blue text-sm hover:bg-prism-blue/15 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
                  立即同步
                </button>

                {/* Info */}
                <div className="pt-1 border-t border-gray-800">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    对话自动在登录时和窗口获得焦点时同步。
                    离线时消息保存在本地，上线后自动同步。
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setExpanded(!expanded)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-full
            border backdrop-blur-sm shadow-lg
            transition-all duration-200
            ${getStatusColor()}
            hover:scale-105 active:scale-95
          `}
        >
          {getStatusIcon()}
          <span className="text-xs font-medium text-gray-300">{getStatusText()}</span>
        </motion.button>
      </div>
    </AnimatePresence>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
