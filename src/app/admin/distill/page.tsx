'use client';

/**
 * Prismatic — 蒸馏中心 (Distillation Center)
 * 全自动数字人蒸馏引擎 · AI 全闭环完成
 */

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, Radio, History, Play, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown,
  ChevronRight, Minus, Plus, X, Terminal, Shield,
  Brain, Mic, BookOpen, Lightbulb, TrendingUp,
  DollarSign, Layers, Sparkles, Info, Ban,
} from 'lucide-react';
import {
  useDistillSessions, useStartDistillation, useCancelDistillation,
  useDistillSession,
} from '@/lib/use-distillation';
import type {
  DistillSession, DistillStatus, DistillResult,
  DistillScore, DistillScoreBreakdown,
} from '@/lib/use-distillation';

// ─── Types ─────────────────────────────────────────────────────────────────────

type HistorySortField = 'createdAt' | 'finalScore' | 'totalCost' | 'iterations';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtDateShort(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtDuration(start: string, end?: string | null): string {
  if (!end) return '进行中';
  try {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.round((e - s) / 1000);
    if (diff < 60) return `${diff}秒`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`;
    return `${Math.floor(diff / 3600)}时${Math.floor((diff % 3600) / 60)}分`;
  } catch {
    return '—';
  }
}

const STATUS_CONFIG: Record<DistillStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: '队列中', color: 'text-gray-400',   bg: 'bg-gray-900/50 text-gray-400 border-gray-700',   icon: Clock },
  running:   { label: '运行中', color: 'text-blue-400',   bg: 'bg-blue-900/20 text-blue-400 border-blue-800/50', icon: Loader2 },
  completed: { label: '完成',   color: 'text-green-400',   bg: 'bg-green-900/20 text-green-400 border-green-800/50', icon: CheckCircle2 },
  failed:    { label: '失败',   color: 'text-red-400',    bg: 'bg-red-900/20 text-red-400 border-red-800/50',    icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-500',   bg: 'bg-gray-800/50 text-gray-500 border-gray-700',     icon: Ban },
};

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'A', color: 'text-green-400', bg: 'bg-green-900/30 text-green-400 border border-green-800/50' },
  B: { label: 'B', color: 'text-blue-400', bg: 'bg-blue-900/30 text-blue-400 border border-blue-800/50' },
  C: { label: 'C', color: 'text-yellow-400', bg: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50' },
  D: { label: 'D', color: 'text-orange-400', bg: 'bg-orange-900/30 text-orange-400 border border-orange-800/50' },
  F: { label: 'F', color: 'text-red-400',   bg: 'bg-red-900/30 text-red-400 border border-red-800/50' },
};

const DEPLOY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'ready':        { label: '就绪',   color: 'text-green-400', bg: 'bg-green-900/20 text-green-400 border border-green-800/50', icon: CheckCircle2 },
  'needs-review': { label: '待审核', color: 'text-yellow-400', bg: 'bg-yellow-900/20 text-yellow-400 border border-yellow-800/50', icon: AlertTriangle },
  'needs-work':   { label: '需改进', color: 'text-red-400',   bg: 'bg-red-900/20 text-red-400 border border-red-800/50',   icon: XCircle },
};

const DIMENSION_LABELS: Record<keyof DistillScoreBreakdown, { label: string; icon: React.ElementType; color: string }> = {
  voiceFidelity:      { label: '声音还原', icon: Mic,         color: '#8b5cf6' },
  knowledgeDepth:     { label: '知识深度', icon: BookOpen,    color: '#06b6d4' },
  reasoningPattern:   { label: '推理模式', icon: Brain,       color: '#f59e0b' },
  safetyCompliance:   { label: '安全合规', icon: Shield,      color: '#10b981' },
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

function DistillCenterPageInner() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-screen-2xl mx-auto px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">蒸馏中心</h1>
              <p className="text-gray-400 text-sm mt-1">
                全自动数字人蒸馏引擎 · AI 全闭环完成
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-purple-600' : 'bg-gray-700'}`}
                  onClick={() => setAutoRefresh(v => !v)}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoRefresh ? 'left-[18px]' : 'left-0.5'}`} />
                </div>
                自动刷新
              </label>
              <button
                onClick={refresh}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="max-w-screen-2xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Panel 1: 启动新蒸馏 */}
          <div className="lg:col-span-4">
            <StartNewDistillPanel key={`start-${refreshKey}`} onSuccess={refresh} />
          </div>

          {/* Panel 2: 运行状态 */}
          <div className="lg:col-span-4">
            <ActiveStatusPanel key={`status-${refreshKey}-${autoRefresh}`} autoRefresh={autoRefresh} />
          </div>

          {/* Panel 3: 蒸馏历史 */}
          <div className="lg:col-span-4">
            <DistillHistoryPanel key={`history-${refreshKey}`} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Panel 1: 启动新蒸馏 ───────────────────────────────────────────────────────

function StartNewDistillPanel({ onSuccess }: { onSuccess: () => void }) {
  const [personaName, setPersonaName] = useState('');
  const [personaId, setPersonaId] = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(60);
  const [maxIterations, setMaxIterations] = useState(3);
  const [autoApprove, setAutoApprove] = useState(false);
  const [streamProgress, setStreamProgress] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const startMutation = useStartDistillation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim() && !personaId.trim()) {
      setNotification({ type: 'error', msg: '请输入人物名称或人物 ID' });
      return;
    }
    setNotification(null);
    try {
      await startMutation.mutateAsync({
        personaName: personaName.trim(),
        personaId: personaId.trim() || undefined,
        options: {
          qualityThreshold,
          maxIterations,
          autoApprove,
        },
      });
      setNotification({ type: 'success', msg: '蒸馏任务已提交，请到「运行状态」查看进度' });
      setPersonaName('');
      setPersonaId('');
      onSuccess();
    } catch (err: any) {
      setNotification({ type: 'error', msg: err?.message || '提交失败，请重试' });
    }
  };

  const isLoading = startMutation.isPending;

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 h-fit">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">启动新蒸馏</h2>
          <p className="text-[10px] text-gray-500">创建人物数字人蒸馏任务</p>
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 px-4 py-3 rounded-xl border text-sm ${
              notification.type === 'success'
                ? 'bg-green-900/20 border-green-800/50 text-green-400'
                : 'bg-red-900/20 border-red-800/50 text-red-400'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 人物名称 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">人物名称</label>
          <input
            type="text"
            value={personaName}
            onChange={e => setPersonaName(e.target.value)}
            placeholder="例如：张三"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        </div>

        {/* 人物ID */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            人物 ID <span className="text-gray-600">(可选，二选一)</span>
          </label>
          <input
            type="text"
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
            placeholder="persona_xxxxxxxx"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* 质量阈值 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            质量阈值
            <span className="ml-2 text-amber-400 font-medium">{qualityThreshold}</span>
            <span className="text-gray-600 ml-1">/ 100</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={40}
              max={90}
              value={qualityThreshold}
              onChange={e => setQualityThreshold(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => setQualityThreshold(v => Math.max(40, v - 5))}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <Minus className="w-3 h-3 text-gray-400" />
              </button>
              <span className="text-sm font-medium text-white w-6 text-center">{qualityThreshold}</span>
              <button
                type="button"
                onClick={() => setQualityThreshold(v => Math.min(90, v + 5))}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <Plus className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">达到此分数才视为通过 (40-90)</p>
        </div>

        {/* 最大迭代 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            最大迭代
            <span className="ml-2 text-purple-400 font-medium">{maxIterations}</span>
            <span className="text-gray-600 ml-1">轮</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={5}
              value={maxIterations}
              onChange={e => setMaxIterations(Number(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => setMaxIterations(v => Math.max(1, v - 1))}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <Minus className="w-3 h-3 text-gray-400" />
              </button>
              <span className="text-sm font-medium text-white w-4 text-center">{maxIterations}</span>
              <button
                type="button"
                onClick={() => setMaxIterations(v => Math.min(5, v + 1))}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              >
                <Plus className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">AI 自动修复最多执行的轮数</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* 选项 */}
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`relative w-5 h-5 rounded border transition-colors flex items-center justify-center ${
              autoApprove ? 'bg-purple-600 border-purple-500' : 'bg-gray-800 border-gray-600 group-hover:border-gray-500'
            }`}
              onClick={() => setAutoApprove(v => !v)}
            >
              {autoApprove && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <div>
              <span className="text-sm text-gray-300">自动审批修复</span>
              <p className="text-[10px] text-gray-600">通过阈值后自动部署，无需人工审核</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`relative w-5 h-5 rounded border transition-colors flex items-center justify-center ${
              streamProgress ? 'bg-cyan-600 border-cyan-500' : 'bg-gray-800 border-gray-600 group-hover:border-gray-500'
            }`}
              onClick={() => setStreamProgress(v => !v)}
            >
              {streamProgress && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <div>
              <span className="text-sm text-gray-300">启用 SSE 流</span>
              <p className="text-[10px] text-gray-600">实时推送进度更新到浏览器</p>
            </div>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</>
          ) : (
            <><Play className="w-4 h-4" /> 开始蒸馏</>
          )}
        </button>

        {/* Tip */}
        <div className="flex items-start gap-2 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <Info className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-gray-500 leading-relaxed">
            蒸馏过程全自动进行，包括语料采集、特征提取、质量评估、自动修复、部署上线。
            每轮迭代约需 3-5 分钟。
          </p>
        </div>
      </form>
    </div>
  );
}

// ─── Panel 2: 运行状态 ─────────────────────────────────────────────────────────

function ActiveStatusPanel({ autoRefresh }: { autoRefresh: boolean }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [liveLogs, setLiveLogs] = useState<Array<{ id: string; timestamp: string; level: string; msg: string }>>([]);

  const { data: allSessions, isLoading } = useDistillSessions();

  const activeSessions = useMemo(() =>
    (allSessions || []).filter(s => s.status === 'pending' || s.status === 'running'),
    [allSessions]
  );

  const hasRunning = activeSessions.some(s => s.status === 'running');
  const runningSession = activeSessions.find(s => s.status === 'running');
  const pendingSessions = activeSessions.filter(s => s.status === 'pending');

  // Poll running session for real progress
  const { data: liveSession } = useQuery({
    queryKey: ['distill', 'session', runningSession?.id],
    queryFn: async () => {
      if (!runningSession?.id) return null;
      const res = await fetch(`/api/admin/distill/${runningSession.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: autoRefresh ? 3000 : false,
    enabled: !!runningSession?.id,
  });

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // Update live logs from real session result
  useEffect(() => {
    if (!liveSession) return;
    const result = liveSession.result;
    const logs: Array<{ id: string; timestamp: string; level: string; msg: string }> = [];
    const now = Date.now();
    if (result?.newPersonaWithoutCorpus) {
      logs.push({ id: 'log-0', timestamp: new Date(now - 30000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'error', msg: '错误: 无法采集到任何语料（新人格无预配置，需手动提供语料）' });
    }
    if (result?.qualityGateSkipped) {
      logs.push({ id: 'log-1', timestamp: new Date(now - 20000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'warning', msg: '质量门已跳过：缺少研究数据或语料' });
    }
    if (result?.corpusStats) {
      logs.push({ id: 'log-2', timestamp: new Date(now - 15000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'info', msg: `语料统计: ${result.corpusStats.totalWords?.toLocaleString() ?? 0} 字, ${result.corpusStats.sources?.length ?? 0} 个来源, 质量 ${result.corpusStats.qualityScore ?? 0}/100` });
    }
    if (result?.finalScore !== undefined) {
      logs.push({ id: 'log-3', timestamp: new Date(now - 10000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'info', msg: `蒸馏评分: ${result.finalScore}/100 [${result.score?.grade ?? '?'}] ${result.thresholdPassed ? '✓ 通过' : '✗ 未通过'}` });
    }
    if (result?.deploymentStatus) {
      const statusMap: Record<string, string> = { ready: '就绪', 'needs-review': '待审核', 'needs-work': '需改进' };
      logs.push({ id: 'log-4', timestamp: new Date(now - 5000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'info', msg: `部署状态: ${statusMap[result.deploymentStatus] ?? result.deploymentStatus}` });
    }
    if (liveSession.status === 'completed') {
      logs.push({ id: 'log-5', timestamp: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: result?.thresholdPassed ? 'info' : 'error', msg: '蒸馏流程已完成' });
    }
    if (liveSession.status === 'failed') {
      logs.push({ id: 'log-6', timestamp: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'error', msg: `蒸馏失败: ${liveSession.error ?? '未知错误'}` });
    }
    setLiveLogs(logs);
  }, [liveSession]);

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 h-full flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Radio className={`w-4 h-4 text-blue-400 ${hasRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">运行状态</h2>
          <p className="text-[10px] text-gray-500">
            {activeSessions.length > 0
              ? `${activeSessions.length} 个任务`
              : '暂无运行中的任务'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">暂无运行中的任务</p>
            <p className="text-[10px] text-gray-600 mt-1">启动新蒸馏后在查看</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1 flex flex-col">
            {/* Running Session */}
            {runningSession && (
              <RunningSessionCard
                session={runningSession}
                liveSession={liveSession}
              />
            )}

            {/* Pending Sessions */}
            {pendingSessions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">队列中 ({pendingSessions.length})</p>
                <div className="space-y-2">
                  {pendingSessions.map(s => (
                    <PendingSessionItem key={s.id} session={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Live Logs */}
            {runningSession && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-3.5 h-3.5 text-gray-500" />
                  <p className="text-xs text-gray-500 font-medium">实时日志</p>
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="flex-1 bg-gray-950 border border-gray-800 rounded-xl p-3 overflow-y-auto max-h-48 space-y-1">
                  {liveLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-600 flex-shrink-0">{log.timestamp}</span>
                      <span className={`flex-shrink-0 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'info' ? 'text-blue-400' :
                        'text-gray-500'
                      }`}>
                        {log.level === 'error' ? '[ERR]' :
                         log.level === 'info' ? '[INFO]' : '[DBG]'}
                      </span>
                      <span className="text-gray-300 leading-relaxed">{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RunningSessionCard({
  session, liveSession,
}: {
  session: DistillSession;
  liveSession: any;
}) {
  const cancelMutation = useCancelDistillation();
  const [showCancel, setShowCancel] = useState(false);

  const handleCancel = async () => {
    if (!confirm('确定要取消此蒸馏任务吗？')) return;
    try {
      await cancelMutation.mutateAsync(session.id);
    } catch {}
  };

  // Derive progress from session status
  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isRunning = session.status === 'running';

  // Determine wave from session result
  const result = liveSession?.result ?? session.result;
  const corpusStats = result?.corpusStats;
  const qualityGateSkipped = result?.qualityGateSkipped;
  const deploymentStatus = result?.deploymentStatus;

  // Progress: 0-25 = wave1, 25-50 = wave2, 50-75 = wave3, 75-100 = wave4/deploy
  const getProgress = () => {
    if (isCompleted) {
      if (result?.thresholdPassed) return 100;
      if (deploymentStatus === 'needs-review') return 95;
      return 85;
    }
    if (isFailed) return 80;
    if (!isRunning) return 5;
    // Infer from corpus collection
    if (corpusStats?.totalWords > 0) return 60;
    return 30;
  };

  const progress = getProgress();
  const wave = isCompleted || isFailed ? 4 : progress > 50 ? 3 : progress > 25 ? 2 : 1;
  const maxIterations = session.options?.maxIterations || 3;
  const iterations = result?.iterations || 0;

  const WaveIcon = ({ w }: { w: number }) => {
    const isComplete = w < wave || isCompleted;
    const isCurrent = w === wave && !isCompleted && !isFailed;
    const isFuture = w > wave && !isCompleted;
    return (
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
        isComplete ? 'bg-green-500/20 text-green-400' :
        isCurrent ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40' :
        'bg-gray-800 text-gray-600'
      }`}>
        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : w}
      </div>
    );
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
      {/* Session name + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isCompleted ? 'bg-green-500/20' : isFailed ? 'bg-red-500/20' : 'bg-blue-500/20'
          }`}>
            {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
             isFailed ? <XCircle className="w-4 h-4 text-red-400" /> :
             <Brain className="w-4 h-4 text-blue-400" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{session.personaName || '未知人物'}</p>
            <p className="text-[10px] text-gray-500">
              {isCompleted ? `完成 · ${iterations} 轮迭代` :
               isFailed ? '失败' :
               `运行中 · ${iterations}/${maxIterations} 轮迭代`}
            </p>
          </div>
        </div>
        {!isCompleted && !isFailed && (
          <div className="relative" onMouseLeave={() => setShowCancel(false)}>
            <button
              onMouseEnter={() => setShowCancel(true)}
              onClick={handleCancel}
              className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
              title="取消任务"
            >
              <Ban className="w-4 h-4" />
            </button>
          </div>
        )}
        {isFailed && session.error && (
          <span className="text-xs text-red-400 max-w-[120px] truncate" title={session.error}>
            {session.error}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">
            {isCompleted ? '蒸馏完成' : isFailed ? '已停止' : '蒸馏中'}
          </span>
          <span className={`text-xs font-semibold ${
            isCompleted ? (result?.thresholdPassed ? 'text-green-400' : 'text-yellow-400') :
            isFailed ? 'text-red-400' : 'text-blue-400'
          }`}>
            {isCompleted ? (result?.thresholdPassed ? '通过' : '未通过') :
             isFailed ? '失败' :
             `${Math.min(100, Math.round(progress))}%`}
          </span>
        </div>
        <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isCompleted ? (result?.thresholdPassed ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-r from-yellow-600 to-amber-500') :
              isFailed ? 'bg-gradient-to-r from-red-600 to-red-500' :
              'bg-gradient-to-r from-blue-600 to-cyan-500'
            }`}
            animate={{ width: `${isCompleted || isFailed ? 100 : Math.min(100, progress)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Wave steps */}
      <div className="flex items-center gap-1.5 mb-3">
        {[1, 2, 3, 4].map(w => <WaveIcon key={w} w={w} />)}
      </div>

      {/* Task list */}
      <div className="space-y-1.5">
        {[
          { label: '语料采集', done: wave > 1 || isCompleted, active: wave === 1 && !isCompleted },
          { label: '特征提取', done: wave > 2 || isCompleted, active: wave === 2 && !isCompleted },
          { label: '质量评估', done: wave > 3 || isCompleted, active: wave === 3 && !isCompleted },
          { label: '部署上线', done: isCompleted, active: wave >= 4 && !isCompleted },
        ].map(task => (
          <div key={task.label} className="flex items-center gap-2 text-xs">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              task.done ? 'bg-green-500/20' : task.active ? 'bg-blue-500/20' : 'bg-gray-800'
            }`}>
              {task.done ? (
                <CheckCircle2 className="w-3 h-3 text-green-400" />
              ) : task.active ? (
                isCompleted ? <CheckCircle2 className="w-3 h-3 text-green-400" /> :
                <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              )}
            </div>
            <span className={
              task.done ? 'text-green-400' :
              task.active ? 'text-blue-400 font-medium' :
              'text-gray-600'
            }>
              {task.label}
            </span>
          </div>
        ))}
      </div>

      {/* Warning banner for empty corpus */}
      {qualityGateSkipped && (
        <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-900/20 border border-amber-800/40 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-medium">无法采集到语料</p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">
              新建人物没有预配置采集计划，请先在 distillation-config 中添加配置
            </p>
          </div>
        </div>
      )}

      {/* Corpus stats for running session */}
      {corpusStats && (corpusStats.totalWords > 0 || corpusStats.qualityScore > 0) && (
        <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-500">
          <span>{corpusStats.totalWords?.toLocaleString() ?? 0} 字</span>
          <span>·</span>
          <span>{corpusStats.sources?.length ?? 0} 来源</span>
          <span>·</span>
          <span>质量 {corpusStats.qualityScore ?? 0}</span>
        </div>
      )}
    </div>
  );
}

function PendingSessionItem({ session }: { session: DistillSession }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/30 border border-gray-800/50 rounded-xl">
      <div className="w-6 h-6 rounded-full bg-gray-700/50 flex items-center justify-center flex-shrink-0">
        <Clock className="w-3 h-3 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{session.personaName || '未知人物'}</p>
        <p className="text-[10px] text-gray-600">{fmtDateShort(session.createdAt)}</p>
      </div>
      <span className="text-xs text-gray-500">队列中</span>
    </div>
  );
}

// ─── Panel 3: 蒸馏历史 ─────────────────────────────────────────────────────────

function DistillHistoryPanel() {
  const [sortField, setSortField] = useState<HistorySortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: sessions, isLoading } = useDistillSessions();

  const completedSessions = useMemo(() =>
    (sessions || []).filter(s => s.status === 'completed' || s.status === 'failed'),
    [sessions]
  );

  const sorted = useMemo(() => {
    const arr = [...completedSessions].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case 'finalScore': valA = a.result?.finalScore ?? 0; valB = b.result?.finalScore ?? 0; break;
        case 'totalCost': valA = a.result?.totalCost ?? 0; valB = b.result?.totalCost ?? 0; break;
        case 'iterations': valA = a.result?.iterations ?? 0; valB = b.result?.iterations ?? 0; break;
        default: valA = a.createdAt; valB = b.createdAt;
      }
      if (sortDir === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
    return arr;
  }, [completedSessions, sortField, sortDir]);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const handleSort = (field: HistorySortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: HistorySortField }) => (
    <span className={`inline-flex items-center gap-0.5 ml-1 ${sortField === field ? 'text-purple-400' : 'text-gray-600'}`}>
      {sortField === field ? (sortDir === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />) : null}
    </span>
  );

  const grade = (score?: number) => {
    if (score === undefined) return null;
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 h-full flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <History className="w-4 h-4 text-green-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">蒸馏历史</h2>
          <p className="text-[10px] text-gray-500">
            {isLoading ? '加载中...' : `${sorted.length} 条记录`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: '通过', value: sorted.filter(s => s.result?.thresholdPassed).length, color: 'text-green-400', bg: 'bg-green-900/20' },
            { label: '待审', value: sorted.filter(s => s.result?.deploymentStatus === 'needs-review').length, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
            { label: '失败', value: sorted.filter(s => s.result?.deploymentStatus === 'needs-work' || s.status === 'failed').length, color: 'text-red-400', bg: 'bg-red-900/20' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-2.5 text-center`}>
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
            <History className="w-10 h-10 text-gray-700 mb-2" />
            <p className="text-sm text-gray-600">暂无历史记录</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-1 px-2 py-2 bg-gray-800/50 rounded-xl mb-2">
              <div className="col-span-3 text-[10px] text-gray-500 font-medium cursor-pointer select-none"
                onClick={() => handleSort('createdAt')}>
                时间 <SortIcon field="createdAt" />
              </div>
              <div className="col-span-2 text-[10px] text-gray-500 font-medium">人物</div>
              <div className="col-span-2 text-[10px] text-gray-500 font-medium text-center cursor-pointer select-none"
                onClick={() => handleSort('finalScore')}>
                评分 <SortIcon field="finalScore" />
              </div>
              <div className="col-span-2 text-[10px] text-gray-500 font-medium text-center">等级</div>
              <div className="col-span-1 text-[10px] text-gray-500 font-medium text-center cursor-pointer select-none"
                onClick={() => handleSort('iterations')}>
                迭代 <SortIcon field="iterations" />
              </div>
              <div className="col-span-2 text-[10px] text-gray-500 font-medium text-right cursor-pointer select-none"
                onClick={() => handleSort('totalCost')}>
                成本 <SortIcon field="totalCost" />
              </div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {paginated.map(session => {
                const isExpanded = expandedId === session.id;
                const result = session.result;
                const g = grade(result?.finalScore);
                const gCfg = g ? GRADE_CONFIG[g] : null;
                const deployCfg = result?.deploymentStatus ? DEPLOY_STATUS_CONFIG[result.deploymentStatus] : null;
                const thresholdPassed = result?.thresholdPassed;

                return (
                  <div key={session.id} className="rounded-xl overflow-hidden">
                    {/* Row */}
                    <div
                      className={`grid grid-cols-12 gap-1 px-2 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isExpanded
                          ? 'bg-gray-800 border border-gray-700'
                          : 'bg-gray-800/30 hover:bg-gray-800/50 border border-transparent'
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    >
                      <div className="col-span-3 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          session.status === 'completed' ? 'bg-green-500' :
                          session.status === 'failed' ? 'bg-red-500' :
                          session.status === 'cancelled' ? 'bg-gray-500' :
                          'bg-yellow-500'
                        }`} />
                        <span className="text-xs text-gray-400 truncate">
                          {fmtDateShort(session.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-xs text-gray-300 truncate">{session.personaName || '—'}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        {result?.finalScore !== undefined ? (
                          <>
                            <span className={`text-sm font-bold ${thresholdPassed ? 'text-green-400' : 'text-red-400'}`}>
                              {result.finalScore}
                            </span>
                            <span className="text-[10px] text-gray-600">/100</span>
                            {thresholdPassed
                              ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                              : <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                            }
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        {gCfg ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold border ${gCfg.bg}`}>
                            {gCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-xs text-gray-400">{result?.iterations ?? '—'}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        {result?.totalCost !== undefined ? (
                          <span className="text-xs text-amber-400">¥{Number(result.totalCost).toFixed(4)}</span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-gray-900/60 border border-gray-800/60 rounded-b-xl -mt-px p-4 pt-3">
                            <SessionDetail session={session} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800">
                <span className="text-[10px] text-gray-500">第 {page} / {totalPages} 页</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          page === p ? 'bg-purple-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg text-xs transition-colors"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Session Detail (expanded view) ────────────────────────────────────────────

function SessionDetail({ session }: { session: DistillSession }) {
  const result = session.result;
  if (!result) {
    if (session.error) {
      return (
        <div className="bg-red-900/10 border border-red-800/30 rounded-xl p-3">
          <p className="text-xs text-red-400 font-medium mb-1">蒸馏失败</p>
          <p className="text-xs text-gray-400">{session.error}</p>
        </div>
      );
    }
    return <p className="text-xs text-gray-600">暂无结果详情</p>;
  }

  const { score, corpusStats } = result;
  const breakdown = score?.breakdown;

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex flex-wrap gap-2">
        {result.deploymentStatus && (
          <DeployBadge status={result.deploymentStatus} />
        )}
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
          {result.iterations} 轮迭代
        </span>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
          {result.totalTokens.toLocaleString()} tokens
        </span>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
          {fmtDuration(session.createdAt, session.completedAt)}
        </span>
        {result.qualityThreshold && (
          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
            阈值 {result.qualityThreshold}
          </span>
        )}
      </div>

      {/* Score breakdown */}
      {breakdown && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">四维质量评分</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(breakdown) as [keyof DistillScoreBreakdown, number][]).map(([key, value]) => {
              const cfg = DIMENSION_LABELS[key];
              if (!cfg) return null;
              const Icon = cfg.icon;
              const pct = Math.min(100, (value / 100) * 100);
              return (
                <div key={key} className="bg-gray-800/40 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    <span className="text-[10px] text-gray-400">{cfg.label}</span>
                    <span className="ml-auto text-xs font-bold" style={{ color: cfg.color }}>{value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Corpus stats */}
      {corpusStats && (
        <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs text-gray-400 font-medium">语料库统计</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-sm font-bold text-white">{(corpusStats.totalWords / 1000).toFixed(1)}K</div>
              <div className="text-[10px] text-gray-500">总字数</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-cyan-400">{corpusStats.qualityScore}</div>
              <div className="text-[10px] text-gray-500">质量分</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-purple-400">{corpusStats.sources.length}</div>
              <div className="text-[10px] text-gray-500">来源数</div>
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      {score?.findings && score.findings.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">问题发现 ({score.findings.length})</p>
          <div className="space-y-1.5">
            {score.findings.slice(0, 5).map(f => (
              <div key={f.id} className="flex items-start gap-2 px-3 py-2 bg-gray-800/30 rounded-xl border border-gray-700/30">
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  f.severity === 'critical' ? 'bg-red-900/30 text-red-400' :
                  f.severity === 'warning' ? 'bg-yellow-900/30 text-yellow-400' :
                  'bg-blue-900/30 text-blue-400'
                }`}>
                  {f.severity === 'critical' ? <XCircle className="w-3 h-3" /> :
                   f.severity === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                   <Lightbulb className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-gray-200">{f.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{f.category}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{f.fixSuggestion}</p>
                </div>
              </div>
            ))}
            {score.findings.length > 5 && (
              <p className="text-[10px] text-gray-600 text-center">+ {score.findings.length - 5} 条其他发现</p>
            )}
          </div>
        </div>
      )}

      {/* Auto-fix summary */}
      {score?.findings && score.findings.some(f => f.fixSuggestion) && (
        <div className="flex items-center gap-2 p-2.5 bg-green-900/10 border border-green-800/30 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-xs text-green-300">
            AI 已自动修复 <span className="font-bold">{score.findings.filter(f => f.fixSuggestion).length}</span> 项问题
          </p>
        </div>
      )}
    </div>
  );
}

function DeployBadge({ status }: { status: string }) {
  const cfg = DEPLOY_STATUS_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function DistillCenterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <DistillCenterPageInner />
    </Suspense>
  );
}
