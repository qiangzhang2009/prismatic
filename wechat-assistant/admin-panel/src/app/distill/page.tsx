'use client';

/**
 * Prismatic — 蒸馏中心 (Distillation Center)
 * 管理后台第4个Tab · 全自动数字人蒸馏引擎
 */

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Radio, History, Play, RefreshCw, Loader2,
  CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown,
  ChevronRight, Minus, Plus, X, Terminal, Shield,
  Brain, Mic, BookOpen, Lightbulb, TrendingUp,
  Layers, Sparkles, Info, Ban, ChevronLeft,
  Bot, BarChart3,
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
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
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
  pending:   { label: '队列中', color: 'text-gray-400',   bg: 'bg-gray-800 text-gray-400', icon: Clock },
  running:   { label: '运行中', color: 'text-blue-400',   bg: 'bg-blue-900/30 text-blue-400', icon: Loader2 },
  completed: { label: '完成',   color: 'text-green-400',   bg: 'bg-green-900/30 text-green-400', icon: CheckCircle },
  failed:    { label: '失败',   color: 'text-red-400',    bg: 'bg-red-900/30 text-red-400', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-gray-500',   bg: 'bg-gray-800 text-gray-500', icon: Ban },
};

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'A', color: 'text-green-400', bg: 'bg-green-900/30 text-green-400 border border-green-800/50' },
  B: { label: 'B', color: 'text-blue-400', bg: 'bg-blue-900/30 text-blue-400 border border-blue-800/50' },
  C: { label: 'C', color: 'text-yellow-400', bg: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50' },
  D: { label: 'D', color: 'text-orange-400', bg: 'bg-orange-900/30 text-orange-400 border border-orange-800/50' },
  F: { label: 'F', color: 'text-red-400',   bg: 'bg-red-900/30 text-red-400 border border-red-800/50' },
};

const DEPLOY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'ready':        { label: '就绪',   color: 'text-green-400', bg: 'bg-green-900/30 text-green-400 border border-green-800/50', icon: CheckCircle },
  'needs-review': { label: '待审核', color: 'text-yellow-400', bg: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50', icon: AlertTriangle },
  'needs-work':   { label: '需改进', color: 'text-red-400',   bg: 'bg-red-900/30 text-red-400 border border-red-800/50',   icon: XCircle },
};

const DIMENSION_LABELS: Record<keyof DistillScoreBreakdown, { label: string; icon: React.ElementType; color: string }> = {
  voiceFidelity:    { label: '声音还原', icon: Mic,       color: '#c77dff' },
  knowledgeDepth:   { label: '知识深度', icon: BookOpen,  color: '#4d96ff' },
  reasoningPattern: { label: '推理模式', icon: Brain,     color: '#ff9f43' },
  safetyCompliance: { label: '安全合规', icon: Shield,    color: '#6bcb77' },
};

function gradeFromScore(score?: number): string {
  if (score === undefined) return '?';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function DistillCenterPageInner() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                返回首页
              </Link>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-prism-6/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-prism-6" />
                </div>
                <div>
                  <h1 className="font-semibold text-base">蒸馏中心</h1>
                  <p className="text-[10px] text-text-muted">全自动数字人蒸馏引擎 · AI 全闭环完成</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
                <span>自动刷新</span>
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    autoRefresh ? 'bg-prism-4' : 'bg-bg-elevated'
                  }`}
                  onClick={() => setAutoRefresh(v => !v)}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      autoRefresh ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </div>
              </label>
              <button
                onClick={refresh}
                className="btn btn-secondary text-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                刷新
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 3-Panel Layout */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Panel 1: 启动新蒸馏 */}
          <div className="lg:col-span-4">
            <StartNewDistillPanel key={`start-${refreshKey}`} onSuccess={refresh} />
          </div>

          {/* Panel 2: 运行状态 */}
          <div className="lg:col-span-4">
            <ActiveStatusPanel key={`status-${refreshKey}`} autoRefresh={autoRefresh} />
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
    } catch (err: unknown) {
      setNotification({ type: 'error', msg: err instanceof Error ? err.message : '提交失败，请重试' });
    }
  };

  const isLoading = startMutation.isPending;

  return (
    <div className="card bg-bg-surface border-white/5 p-6">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-prism-6/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-prism-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold">启动新蒸馏</h2>
          <p className="text-[10px] text-text-muted">创建人物数字人蒸馏任务</p>
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
                ? 'bg-prism-3/10 border-prism-3/20 text-prism-3'
                : 'bg-prism-1/10 border-prism-1/20 text-prism-1'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 人物名称 */}
        <div>
          <label className="block text-xs text-text-secondary mb-1.5">人物名称</label>
          <input
            type="text"
            value={personaName}
            onChange={e => setPersonaName(e.target.value)}
            placeholder="例如：张三、李飞飞、查理·芒格"
            className="w-full bg-bg-elevated border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-prism-4 transition-colors"
          />
        </div>

        {/* 人物ID */}
        <div>
          <label className="block text-xs text-text-secondary mb-1.5">
            人物 ID <span className="text-text-muted">(可选，二选一)</span>
          </label>
          <input
            type="text"
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
            placeholder="persona_xxxxxxxx"
            className="w-full bg-bg-elevated border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-prism-4 transition-colors font-mono"
          />
        </div>

        <div className="border-t border-white/5" />

        {/* 质量阈值 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-secondary">质量阈值</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQualityThreshold(v => Math.max(40, v - 5))}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <Minus className="w-3 h-3 text-text-muted" />
              </button>
              <span className="text-sm font-semibold text-prism-6 w-8 text-center">{qualityThreshold}</span>
              <button
                type="button"
                onClick={() => setQualityThreshold(v => Math.min(90, v + 5))}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <Plus className="w-3 h-3 text-text-muted" />
              </button>
              <span className="text-[10px] text-text-muted">/100</span>
            </div>
          </div>
          <input
            type="range"
            min={40}
            max={90}
            value={qualityThreshold}
            onChange={e => setQualityThreshold(Number(e.target.value))}
            className="w-full accent-prism-6"
          />
          <p className="text-[10px] text-text-muted mt-1">达到此分数才视为通过 (40-90)</p>
        </div>

        {/* 最大迭代 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-secondary">最大迭代</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMaxIterations(v => Math.max(1, v - 1))}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <Minus className="w-3 h-3 text-text-muted" />
              </button>
              <span className="text-sm font-semibold text-prism-5 w-6 text-center">{maxIterations}</span>
              <button
                type="button"
                onClick={() => setMaxIterations(v => Math.min(5, v + 1))}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <Plus className="w-3 h-3 text-text-muted" />
              </button>
              <span className="text-[10px] text-text-muted">轮</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={maxIterations}
            onChange={e => setMaxIterations(Number(e.target.value))}
            className="w-full accent-prism-5"
          />
          <p className="text-[10px] text-text-muted mt-1">AI 自动修复最多执行的轮数</p>
        </div>

        <div className="border-t border-white/5" />

        {/* 选项 */}
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                autoApprove
                  ? 'bg-prism-5 border-prism-5'
                  : 'bg-bg-elevated border-white/20 hover:border-white/40'
              }`}
              onClick={() => setAutoApprove(v => !v)}
            >
              {autoApprove && <CheckCircle className="w-3.5 h-3.5 text-white" />}
            </div>
            <div>
              <span className="text-sm text-text-primary">自动审批部署</span>
              <p className="text-[10px] text-text-muted">通过阈值后自动部署，无需人工审核</p>
            </div>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-prism-6 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 提交中...</>
          ) : (
            <><Play className="w-4 h-4" /> 开始蒸馏</>
          )}
        </button>

        {/* Tip */}
        <div className="flex items-start gap-2 p-3 bg-bg-elevated rounded-xl">
          <Info className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-text-muted leading-relaxed">
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
  const { data: liveSession } = useDistillSession(
    runningSession?.id ?? '',
  );

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
    <div className="card bg-bg-surface border-white/5 p-6 flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-prism-4/20 flex items-center justify-center">
          <Radio className={`w-4 h-4 text-prism-4 ${hasRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <h2 className="text-base font-semibold">运行状态</h2>
          <p className="text-[10px] text-text-muted">
            {activeSessions.length > 0
              ? `${activeSessions.length} 个任务`
              : '暂无运行中的任务'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-prism-4 animate-spin" />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-12">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-text-muted" />
            </div>
            <p className="text-sm">暂无运行中的任务</p>
            <p className="text-[10px] text-text-muted mt-1">启动新蒸馏后在查看</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1 flex flex-col">
            {/* Running Session */}
            {runningSession && (
              <RunningSessionCard session={runningSession} liveSession={liveSession} />
            )}

            {/* Pending Sessions */}
            {pendingSessions.length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-2 font-medium">队列中 ({pendingSessions.length})</p>
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
                  <Terminal className="w-3.5 h-3.5 text-text-muted" />
                  <p className="text-xs text-text-muted font-medium">实时日志</p>
                  <div className="ml-auto w-2 h-2 rounded-full bg-prism-3 animate-pulse" />
                </div>
                <div className="flex-1 bg-bg-elevated border border-white/5 rounded-xl p-3 overflow-y-auto max-h-48 space-y-1">
                  {liveLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span className="text-text-muted flex-shrink-0">{log.timestamp}</span>
                      <span className={`flex-shrink-0 ${
                        log.level === 'error' ? 'text-prism-1' :
                        log.level === 'info' ? 'text-prism-4' :
                        'text-yellow-400'
                      }`}>
                        {log.level === 'error' ? '[ERR]' :
                         log.level === 'info' ? '[INFO]' : '[WARN]'}
                      </span>
                      <span className="text-text-secondary leading-relaxed">{log.msg}</span>
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
  liveSession: DistillSession | undefined;
}) {
  const cancelMutation = useCancelDistillation();

  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isRunning = session.status === 'running';

  const result = liveSession?.result ?? session.result;
  const corpusStats = result?.corpusStats;
  const qualityGateSkipped = result?.qualityGateSkipped;
  const deploymentStatus = result?.deploymentStatus;

  const getProgress = () => {
    if (isCompleted) {
      if (result?.thresholdPassed) return 100;
      if (deploymentStatus === 'needs-review') return 95;
      return 85;
    }
    if (isFailed) return 80;
    if (!isRunning) return 5;
    if (corpusStats?.totalWords && corpusStats.totalWords > 0) return 60;
    return 30;
  };

  const progress = getProgress();
  const wave = isCompleted || isFailed ? 4 : progress > 50 ? 3 : progress > 25 ? 2 : 1;
  const iterations = result?.iterations ?? 0;

  const WaveIcon = ({ w }: { w: number }) => {
    const isComplete = w < wave || isCompleted;
    const isCurrent = w === wave && !isCompleted && !isFailed;
    return (
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
        isComplete ? 'bg-prism-3/20 text-prism-3' :
        isCurrent ? 'bg-prism-4/20 text-prism-4 ring-1 ring-prism-4/40' :
        'bg-bg-elevated text-text-muted'
      }`}>
        {isComplete ? <CheckCircle className="w-4 h-4" /> : w}
      </div>
    );
  };

  return (
    <div className="bg-bg-elevated border border-white/5 rounded-2xl p-4">
      {/* Session name + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isCompleted ? 'bg-prism-3/20' : isFailed ? 'bg-prism-1/20' : 'bg-prism-4/20'
          }`}>
            {isCompleted ? <CheckCircle className="w-4 h-4 text-prism-3" /> :
             isFailed ? <XCircle className="w-4 h-4 text-prism-1" /> :
             <Brain className="w-4 h-4 text-prism-4" />}
          </div>
          <div>
            <p className="text-sm font-medium">{session.personaName || '未知人物'}</p>
            <p className="text-[10px] text-text-muted">
              {isCompleted ? `完成 · ${iterations} 轮迭代` :
               isFailed ? '失败' :
               `运行中 · ${iterations}/${session.options?.maxIterations || 3} 轮迭代`}
            </p>
          </div>
        </div>
        {!isCompleted && !isFailed && (
          <button
            onClick={async () => {
              if (!confirm('确定要取消此蒸馏任务吗？')) return;
              try { await cancelMutation.mutateAsync(session.id); } catch {}
            }}
            className="p-1.5 rounded-lg hover:bg-prism-1/10 text-text-muted hover:text-prism-1 transition-colors"
            title="取消任务"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
        {isFailed && session.error && (
          <span className="text-xs text-prism-1 max-w-[120px] truncate" title={session.error}>
            {session.error}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-secondary">
            {isCompleted ? '蒸馏完成' : isFailed ? '已停止' : '蒸馏中'}
          </span>
          <span className={`text-xs font-semibold ${
            isCompleted ? (result?.thresholdPassed ? 'text-prism-3' : 'text-yellow-400') :
            isFailed ? 'text-prism-1' : 'text-prism-4'
          }`}>
            {isCompleted ? (result?.thresholdPassed ? '通过' : '未通过') :
             isFailed ? '失败' :
             `${Math.min(100, Math.round(progress))}%`}
          </span>
        </div>
        <div className="h-2 bg-bg-base rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isCompleted ? (result?.thresholdPassed ? 'bg-prism-3' : 'bg-yellow-400') :
              isFailed ? 'bg-prism-1' :
              'bg-prism-4'
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
              task.done ? 'bg-prism-3/20' : task.active ? 'bg-prism-4/20' : 'bg-bg-elevated'
            }`}>
              {task.done ? (
                <CheckCircle className="w-3 h-3 text-prism-3" />
              ) : task.active ? (
                <Loader2 className="w-3 h-3 text-prism-4 animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
              )}
            </div>
            <span className={
              task.done ? 'text-prism-3' :
              task.active ? 'text-prism-4 font-medium' :
              'text-text-muted'
            }>
              {task.label}
            </span>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {qualityGateSkipped && (
        <div className="mt-3 flex items-start gap-2 p-2.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-yellow-400 font-medium">无法采集到语料</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              新建人物没有预配置采集计划，请先在 distillation-config 中添加配置
            </p>
          </div>
        </div>
      )}

      {/* Corpus stats */}
      {corpusStats && (corpusStats.totalWords > 0 || corpusStats.qualityScore > 0) && (
        <div className="mt-3 flex items-center gap-3 text-[10px] text-text-muted">
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
    <div className="flex items-center gap-3 px-3 py-2 bg-bg-elevated border border-white/5 rounded-xl">
      <div className="w-6 h-6 rounded-full bg-bg-overlay flex items-center justify-center flex-shrink-0">
        <Clock className="w-3 h-3 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-secondary truncate">{session.personaName || '未知人物'}</p>
        <p className="text-[10px] text-text-muted">{fmtDateShort(session.createdAt)}</p>
      </div>
      <span className="text-xs text-text-muted">队列中</span>
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
    (sessions || []).filter(s => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled'),
    [sessions]
  );

  const sorted = useMemo(() => {
    const arr = [...completedSessions].sort((a, b) => {
      let valA: number | string, valB: number | string;
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
    <span className={`inline-flex items-center gap-0.5 ml-1 ${sortField === field ? 'text-prism-5' : 'text-text-muted'}`}>
      {sortField === field ? (
        sortDir === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />
      ) : null}
    </span>
  );

  return (
    <div className="card bg-bg-surface border-white/5 p-6 flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-prism-3/20 flex items-center justify-center">
          <History className="w-4 h-4 text-prism-3" />
        </div>
        <div>
          <h2 className="text-base font-semibold">蒸馏历史</h2>
          <p className="text-[10px] text-text-muted">
            {isLoading ? '加载中...' : `${sorted.length} 条记录`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: '通过', value: sorted.filter(s => s.result?.thresholdPassed).length, color: 'text-prism-3', bg: 'bg-prism-3/10' },
            { label: '待审', value: sorted.filter(s => s.result?.deploymentStatus === 'needs-review').length, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: '失败', value: sorted.filter(s => s.result?.deploymentStatus === 'needs-work' || s.status === 'failed').length, color: 'text-prism-1', bg: 'bg-prism-1/10' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-2.5 text-center`}>
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-prism-3 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-12">
            <History className="w-10 h-10 text-text-muted mb-2" />
            <p className="text-sm">暂无历史记录</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-1 px-2 py-2 bg-bg-elevated rounded-xl mb-2">
              <div className="col-span-3 text-[10px] text-text-muted font-medium cursor-pointer select-none"
                onClick={() => handleSort('createdAt')}>
                时间 <SortIcon field="createdAt" />
              </div>
              <div className="col-span-2 text-[10px] text-text-muted font-medium">人物</div>
              <div className="col-span-2 text-[10px] text-text-muted font-medium text-center cursor-pointer select-none"
                onClick={() => handleSort('finalScore')}>
                评分 <SortIcon field="finalScore" />
              </div>
              <div className="col-span-2 text-[10px] text-text-muted font-medium text-center">等级</div>
              <div className="col-span-1 text-[10px] text-text-muted font-medium text-center cursor-pointer select-none"
                onClick={() => handleSort('iterations')}>
                迭代 <SortIcon field="iterations" />
              </div>
              <div className="col-span-2 text-[10px] text-text-muted font-medium text-right cursor-pointer select-none"
                onClick={() => handleSort('totalCost')}>
                成本 <SortIcon field="totalCost" />
              </div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {paginated.map(session => {
                const isExpanded = expandedId === session.id;
                const result = session.result;
                const g = gradeFromScore(result?.finalScore);
                const gCfg = GRADE_CONFIG[g];
                const deployCfg = result?.deploymentStatus ? DEPLOY_STATUS_CONFIG[result.deploymentStatus] : null;
                const thresholdPassed = result?.thresholdPassed;

                return (
                  <div key={session.id} className="rounded-xl overflow-hidden">
                    {/* Row */}
                    <div
                      className={`grid grid-cols-12 gap-1 px-2 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isExpanded
                          ? 'bg-bg-elevated border border-white/10'
                          : 'hover:bg-bg-elevated border border-transparent'
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    >
                      <div className="col-span-3 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          session.status === 'completed' ? 'bg-prism-3' :
                          session.status === 'failed' ? 'bg-prism-1' :
                          session.status === 'cancelled' ? 'bg-text-muted' :
                          'bg-yellow-400'
                        }`} />
                        <span className="text-xs text-text-muted truncate">
                          {fmtDateShort(session.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <div className="w-5 h-5 rounded-md bg-prism-5/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-3 h-3 text-prism-5" />
                        </div>
                        <span className="text-xs text-text-secondary truncate">{session.personaName || '—'}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        {result?.finalScore !== undefined ? (
                          <>
                            <span className={`text-sm font-bold ${
                              thresholdPassed ? 'text-prism-3' : 'text-prism-1'
                            }`}>
                              {result.finalScore}
                            </span>
                            <span className="text-[10px] text-text-muted">/100</span>
                            {thresholdPassed
                              ? <CheckCircle className="w-3 h-3 text-prism-3 flex-shrink-0" />
                              : <AlertTriangle className="w-3 h-3 text-prism-1 flex-shrink-0" />
                            }
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        {gCfg ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${gCfg.bg}`}>
                            {gCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="text-xs text-text-muted">{result?.iterations ?? '—'}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        {result?.totalCost !== undefined ? (
                          <span className="text-xs text-prism-6">${Number(result.totalCost).toFixed(4)}</span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
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
                          <div className="bg-bg-elevated border border-white/5 rounded-b-xl -mt-px p-4 pt-3">
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
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                <span className="text-[10px] text-text-muted">第 {page} / {totalPages} 页</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 bg-bg-elevated hover:bg-bg-overlay disabled:opacity-30 rounded-lg text-xs transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          page === p ? 'bg-prism-4 text-white' : 'bg-bg-elevated hover:bg-bg-overlay text-text-muted'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 bg-bg-elevated hover:bg-bg-overlay disabled:opacity-30 rounded-lg text-xs transition-colors"
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
        <div className="bg-prism-1/10 border border-prism-1/20 rounded-xl p-3">
          <p className="text-xs text-prism-1 font-medium mb-1">蒸馏失败</p>
          <p className="text-xs text-text-muted">{session.error}</p>
        </div>
      );
    }
    return <p className="text-xs text-text-muted">暂无结果详情</p>;
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
        <span className="text-xs px-2 py-0.5 bg-bg-overlay text-text-muted rounded-full">
          {result.iterations} 轮迭代
        </span>
        <span className="text-xs px-2 py-0.5 bg-bg-overlay text-text-muted rounded-full">
          {(result.totalTokens ?? 0).toLocaleString()} tokens
        </span>
        <span className="text-xs px-2 py-0.5 bg-bg-overlay text-text-muted rounded-full">
          {fmtDuration(session.createdAt, session.completedAt)}
        </span>
        {result.qualityThreshold && (
          <span className="text-xs px-2 py-0.5 bg-bg-overlay text-text-muted rounded-full">
            阈值 {result.qualityThreshold}
          </span>
        )}
      </div>

      {/* Score breakdown */}
      {breakdown && (
        <div>
          <p className="text-xs text-text-muted font-medium mb-2">四维质量评分</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(breakdown) as [keyof DistillScoreBreakdown, number][]).map(([key, value]) => {
              const cfg = DIMENSION_LABELS[key];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div key={key} className="bg-bg-overlay rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    <span className="text-[10px] text-text-muted">{cfg.label}</span>
                    <span className="ml-auto text-xs font-bold" style={{ color: cfg.color }}>{value}</span>
                  </div>
                  <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, value)}%`, backgroundColor: cfg.color }}
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
        <div className="bg-bg-overlay rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5 text-text-muted" />
            <p className="text-xs text-text-muted font-medium">语料库统计</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-sm font-bold text-text-primary">{(corpusStats.totalWords / 1000).toFixed(1)}K</div>
              <div className="text-[10px] text-text-muted">总字数</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-prism-4">{corpusStats.qualityScore}</div>
              <div className="text-[10px] text-text-muted">质量分</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-prism-5">{corpusStats.sources.length}</div>
              <div className="text-[10px] text-text-muted">来源数</div>
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      {score?.findings && score.findings.length > 0 && (
        <div>
          <p className="text-xs text-text-muted font-medium mb-2">问题发现 ({score.findings.length})</p>
          <div className="space-y-1.5">
            {score.findings.slice(0, 5).map((f, i) => (
              <div key={f.id ?? i} className="flex items-start gap-2 px-3 py-2 bg-bg-overlay rounded-xl border border-white/5">
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  f.severity === 'critical' ? 'bg-prism-1/20 text-prism-1' :
                  f.severity === 'warning' ? 'bg-yellow-400/20 text-yellow-400' :
                  'bg-prism-4/20 text-prism-4'
                }`}>
                  {f.severity === 'critical' ? <XCircle className="w-3 h-3" /> :
                   f.severity === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                   <Lightbulb className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-text-primary">{f.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{f.category}</span>
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed">{f.fixSuggestion}</p>
                </div>
              </div>
            ))}
            {score.findings.length > 5 && (
              <p className="text-[10px] text-text-muted text-center">+ {score.findings.length - 5} 条其他发现</p>
            )}
          </div>
        </div>
      )}

      {/* Auto-fix summary */}
      {score?.findings && score.findings.some(f => f.fixSuggestion) && (
        <div className="flex items-center gap-2 p-2.5 bg-prism-3/10 border border-prism-3/20 rounded-xl">
          <CheckCircle className="w-4 h-4 text-prism-3 flex-shrink-0" />
          <p className="text-xs text-prism-3">
            AI 已自动修复 <span className="font-bold">{score.findings.filter(f => f.fixSuggestion).length}</span> 项问题
          </p>
        </div>
      )}
    </div>
  );
}

// Fix reference to deployCfg in SessionDetail
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
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 text-prism-4 animate-spin" />
    </div>}>
      <DistillCenterPageInner />
    </Suspense>
  );
}
