'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Bot,
  User,
  Terminal,
  Clock,
  Cpu,
  Zap,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

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
  cache_write_tokens: number;
  total_tokens: number;
  last_prompt_tokens: number;
  estimated_cost_usd: number;
  cost_status: string;
  memory_flushed: boolean;
  suspended: boolean;
  origin: {
    platform: string;
    chat_id: string;
    chat_name: string | null;
    chat_type: string;
    user_id: string;
    user_name: string;
    thread_id: string | null;
    chat_topic: string | null;
  };
}

interface HermesMessage {
  role: string;
  content: string | null;
  timestamp: string;
  reasoning?: string | null;
  finish_reason?: string | null;
  tool_calls?: unknown[] | null;
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function SessionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [data, setData] = useState<{
    meta: SessionMeta;
    messages: HermesMessage[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hermes/sessions?sessionId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const copyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-prism-4 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">会话不存在</p>
          <Link href="/" className="text-prism-4 text-sm mt-2 block">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const { meta, messages } = data;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-text-muted hover:text-white text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              返回
            </Link>
            <ChevronRight className="w-4 h-4 text-text-muted" />
            <h1 className="font-semibold text-sm">会话详情</h1>
          </div>
          <span className="badge badge-info text-xs">{meta.platform}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Session meta */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-prism-4" />
            会话信息
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: '用户',
                value: meta.display_name || meta.origin.user_name || '—',
                icon: User,
              },
              {
                label: '平台',
                value: `${meta.platform} / ${meta.chat_type}`,
                icon: Zap,
              },
              {
                label: '消息数',
                value: String(messages.length),
                icon: Clock,
              },
              {
                label: '总 Token',
                value: formatTokens(meta.total_tokens),
                icon: Cpu,
              },
              {
                label: '输入 Token',
                value: formatTokens(meta.input_tokens),
                icon: Cpu,
              },
              {
                label: '输出 Token',
                value: formatTokens(meta.output_tokens),
                icon: Cpu,
              },
              {
                label: '缓存读取',
                value: formatTokens(meta.cache_read_tokens),
                icon: Cpu,
              },
              {
                label: '费用',
                value: `$${meta.estimated_cost_usd.toFixed(4)}`,
                icon: Zap,
              },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-text-muted">
              开始时间：{formatTs(meta.created_at)} · 最后更新：
              {formatTs(meta.updated_at)} · Session ID:{' '}
              <code className="text-prism-4">{meta.session_id}</code>
            </p>
          </div>
        </div>

        {/* Messages */}
        <div>
          <h2 className="font-semibold mb-3 text-sm text-text-muted">
            对话记录 ({messages.length} 条)
          </h2>
          <div className="space-y-3">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isTool = msg.role === 'tool';
              const hasToolCalls = msg.tool_calls && (msg.tool_calls as unknown[]).length > 0;

              return (
                <div
                  key={idx}
                  className={`card p-4 ${
                    isTool ? 'border-l-2 border-prism-2 ml-4' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {isUser ? (
                        <User className="w-3.5 h-3.5 text-text-secondary" />
                      ) : isTool ? (
                        <Terminal className="w-3.5 h-3.5 text-prism-2" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-prism-4" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          isUser
                            ? 'text-text-secondary'
                            : isTool
                              ? 'text-prism-2'
                              : 'text-prism-4'
                        }`}
                      >
                        {isUser ? '用户' : isTool ? '工具' : '助手'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatTs(msg.timestamp)}
                      </span>
                      {msg.finish_reason && !isUser && (
                        <span className="badge badge-info text-xs">
                          {msg.finish_reason}
                        </span>
                      )}
                    </div>
                    {msg.content && (
                      <button
                        onClick={() => copyContent(String(idx), msg.content || '')}
                        className="text-text-muted hover:text-white transition-colors"
                      >
                        {copiedId === String(idx) ? (
                          <Check className="w-3.5 h-3.5 text-prism-3" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Tool calls */}
                  {hasToolCalls && (
                    <div className="mb-2 space-y-1">
                      {(msg.tool_calls as Array<{ function?: { name: string; arguments: string } }>).map((tc, tci) => (
                        <div
                          key={tci}
                          className="bg-bg-elevated rounded px-3 py-2 text-xs"
                        >
                          <span className="text-prism-5 font-mono">
                            → {tc.function?.name}
                          </span>
                          {tc.function?.arguments && (
                            <pre className="text-text-muted mt-1 whitespace-pre-wrap font-mono">
                              {tc.function.arguments}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  {msg.content && (
                    <pre
                      className={`text-sm whitespace-pre-wrap break-words font-sans ${
                        isTool ? 'text-prism-2' : 'text-text-secondary'
                      }`}
                    >
                      {msg.content}
                    </pre>
                  )}

                  {/* Reasoning */}
                  {msg.reasoning && (
                    <details className="mt-2">
                      <summary className="text-xs text-text-muted cursor-pointer">
                        查看推理过程
                      </summary>
                      <pre className="mt-1 text-xs text-text-muted bg-bg-elevated rounded p-2 whitespace-pre-wrap">
                        {msg.reasoning}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
