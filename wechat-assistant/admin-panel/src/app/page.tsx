'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Users,
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
  Cpu,
  Zap,
  Activity,
  Bot,
  Terminal,
  RefreshCw,
  Shield,
} from 'lucide-react';

// ============================================
// Types
// ============================================
interface GatewayPlatform {
  state: string;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
}

interface GatewayState {
  pid: number;
  kind: string;
  gateway_state: string;
  restart_requested: boolean;
  active_agents: number;
  platforms: Record<string, GatewayPlatform>;
  updated_at: string;
}

interface SessionMeta {
  session_key: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  platform: string;
  chat_type: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  last_prompt_tokens: number;
  estimated_cost_usd: number;
  cost_status: string;
  memory_flushed: boolean;
  suspended: boolean;
  message_count?: number;
  origin: {
    platform: string;
    chat_id: string;
    chat_name: string | null;
    chat_type: string;
    user_id: string;
    user_name: string;
  };
}

interface HermesStats {
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  estimatedCostUsd: number;
  activePlatforms: string[];
  connectedPlatforms: string[];
  disconnectedPlatforms: string[];
  sessions: SessionMeta[];
  lastActivity: string | null;
}

interface ApiResponse {
  stats: HermesStats;
  gateway: GatewayState | null;
  hermesPath: string;
  isLocal: boolean;
}

// ============================================
// Helpers
// ============================================
function formatTs(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function timeAgo(ts: string | null): string {
  if (!ts) return '—';
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
  } catch {
    return ts;
  }
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div
        className="p-3 rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{title}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-text-muted mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Platform Status
// ============================================
function PlatformStatus({
  gateway,
}: {
  gateway: GatewayState | null | undefined;
}) {
  const platforms = gateway?.platforms || {};
  const entries = Object.entries(platforms);

  if (entries.length === 0) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <WifiOff className="w-4 h-4 text-text-muted" />
        <div>
          <p className="text-sm font-medium">Gateway</p>
          <p className="text-xs text-text-muted">未运行</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {entries.map(([name, platform]) => (
        <div key={name} className="card p-4 flex items-center gap-3">
          {platform.state === 'connected' ? (
            <Wifi className="w-4 h-4 text-prism-3" />
          ) : (
            <WifiOff className="w-4 h-4 text-prism-1" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium capitalize">{name}</p>
            <p
              className={`text-xs flex items-center gap-1 ${
                platform.state === 'connected'
                  ? 'text-prism-3'
                  : 'text-prism-1'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  backgroundColor:
                    platform.state === 'connected' ? '#6bcb77' : '#ff6b6b',
                }}
              />
              {platform.state === 'connected' ? '已连接' : platform.state}
              {platform.error_message && (
                <span className="text-prism-1 ml-1">
                  — {platform.error_message}
                </span>
              )}
            </p>
          </div>
          {gateway?.active_agents !== undefined && gateway.active_agents > 0 && (
            <span className="badge badge-info text-xs">
              {gateway.active_agents} 活跃
            </span>
          )}
        </div>
      ))}
    </>
  );
}

// ============================================
// Session List
// ============================================
function SessionList({ sessions }: { sessions: SessionMeta[] }) {
  if (sessions.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Bot className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-sm text-text-muted">暂无会话记录</p>
        <p className="text-xs text-text-muted mt-1">
          在微信或 Telegram 发送消息即可开始
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.slice(0, 8).map((session) => (
        <div
          key={session.session_id}
          className="card p-4 hover:border-white/10 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Bot className="w-3.5 h-3.5 text-prism-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  {session.display_name ||
                    session.origin.user_name ||
                    session.session_id.slice(0, 16)}
                </span>
                <span className="badge badge-info text-xs">
                  {session.platform}
                </span>
                <span className="badge badge-info text-xs">
                  {session.chat_type}
                </span>
                {session.suspended && (
                  <span className="badge badge-warning text-xs">已暂停</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span>{formatTs(session.created_at)}</span>
                <span>{session.message_count || 0} 条消息</span>
                <span>
                  {formatTokens(session.total_tokens)} tokens
                </span>
                <span className="text-prism-4">
                  {timeAgo(session.updated_at)}
                </span>
              </div>
            </div>
            <Link
              href={`/sessions/${session.session_id}`}
              className="text-xs text-prism-4 hover:underline flex-shrink-0"
            >
              查看
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Dashboard
// ============================================
export default function DashboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdate(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-prism-4 mx-auto mb-4 animate-spin" />
          <p className="text-text-muted">正在连接 Hermes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-prism-1 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">无法连接 Hermes</h2>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <p className="text-xs text-text-muted mb-4">
            请确保 Hermes Gateway 正在运行：
            <code className="text-prism-4 ml-1">hermes gateway run</code>
          </p>
          <button onClick={fetchData} className="btn btn-primary text-sm">
            重试
          </button>
        </div>
      </div>
    );
  }

  const { stats, gateway } = data || {};
  const isRunning = gateway?.gateway_state === 'running';

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-prism-4 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Hermes Admin</h1>
              <p className="text-xs text-text-muted">
                {isRunning ? (
                  <span className="text-prism-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-prism-3 inline-block" />
                    运行中 · PID {gateway?.pid}
                  </span>
                ) : (
                  <span className="text-prism-1">Gateway 未运行</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted hidden sm:block">
              {lastUpdate.toLocaleTimeString('zh-CN')} · 30s 自动刷新
            </span>
            <button
              onClick={onRefresh}
              className="btn btn-secondary text-sm flex items-center gap-1"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              刷新
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Connection notice */}
        <div className="card p-4 bg-prism-4/5 border-prism-4/20">
          <div className="flex items-start gap-3">
            <Activity className="w-4 h-4 text-prism-4 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-prism-4 mb-0.5">
                本地管理面板
              </p>
              <p className="text-text-secondary text-xs">
                此管理后台运行在本地，从 Hermes 实时读取数据。
                Gateway PID{' '}
                <code className="text-prism-4">{gateway?.pid}</code>，
                数据目录{' '}
                <code className="text-prism-4">{data?.hermesPath}</code>
                。最后活动：{timeAgo(stats?.lastActivity || null)}
              </p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="会话总数"
            value={stats?.totalSessions ?? 0}
            subtitle={`${stats?.connectedPlatforms.length || 0} 个平台已连接`}
            icon={MessageSquare}
            color="#4d96ff"
          />
          <StatCard
            title="消息总数"
            value={formatTokens(stats?.totalMessages ?? 0)}
            subtitle={`${formatTokens(stats?.totalInputTokens || 0)} 输入 / ${formatTokens(stats?.totalOutputTokens || 0)} 输出`}
            icon={Activity}
            color="#6bcb77"
          />
          <StatCard
            title="Token 消耗"
            value={`$${(stats?.estimatedCostUsd ?? 0).toFixed(4)}`}
            subtitle={`缓存读取 ${formatTokens(stats?.totalCacheReadTokens || 0)}`}
            icon={Cpu}
            color="#c77dff"
          />
          <StatCard
            title="活跃 Agent"
            value={gateway?.active_agents ?? 0}
            subtitle={isRunning ? 'Gateway 运行中' : '已停止'}
            icon={Zap}
            color="#ff9f43"
          />
        </div>

        {/* Platform status + Token breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform status */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-medium text-text-muted">
              平台连接状态
            </h2>
            <PlatformStatus gateway={gateway} />
            {stats?.activePlatforms.length === 0 && (
              <p className="text-xs text-text-muted text-center py-2">
                暂无已配置的平台
              </p>
            )}
          </div>

          {/* Token breakdown */}
          <div className="lg:col-span-2 card p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-prism-4" />
              Token 消耗分布
            </h2>
            <div className="space-y-4">
              {[
                {
                  label: '输入 Token',
                  value: stats?.totalInputTokens ?? 0,
                  color: '#4d96ff',
                },
                {
                  label: '输出 Token',
                  value: stats?.totalOutputTokens ?? 0,
                  color: '#c77dff',
                },
                {
                  label: '缓存读取',
                  value: stats?.totalCacheReadTokens ?? 0,
                  color: '#6bcb77',
                },
              ].map((item) => {
                const max = Math.max(
                  stats?.totalInputTokens || 0,
                  stats?.totalOutputTokens || 0,
                  stats?.totalCacheReadTokens || 0,
                  1,
                );
                const pct = Math.round(
                  ((item.value || 0) / max) * 100,
                );
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: item.color }}>{item.label}</span>
                      <span className="text-text-secondary">
                        {formatTokens(item.value)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {stats?.totalSessions === 0 && (
              <p className="text-xs text-text-muted text-center py-4 mt-4">
                发送一条消息后即可看到 Token 消耗统计
              </p>
            )}
          </div>
        </div>

        {/* Session list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-text-muted">
              最近会话
            </h2>
            <span className="text-xs text-text-muted">
              共 {stats?.totalSessions || 0} 个会话
            </span>
          </div>
          <SessionList sessions={stats?.sessions || []} />
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: '/groups', icon: Users, label: '群组配置', color: '#4d96ff' },
            { href: '/personas', icon: Bot, label: 'Persona 管理', color: '#c77dff' },
            { href: '/feedback', icon: AlertCircle, label: '反馈中心', color: '#ff9f43' },
            { href: '/settings', icon: Settings, label: '系统设置', color: '#6bcb77' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="card p-4 flex items-center gap-3 hover:border-white/10 transition-all group"
            >
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
              <span className="text-sm group-hover:text-white transition-colors">
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
