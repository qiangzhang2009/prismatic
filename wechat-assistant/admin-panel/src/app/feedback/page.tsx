'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Download,
  Search,
  CheckCircle,
  Eye,
  Tag,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  sentiment: string | null;
  status: string;
  tags: string;
  notes: string | null;
  createdAt: string;
  group?: { name: string };
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    positive: { label: '正面', className: 'badge-success' },
    negative: { label: '负面', className: 'badge-danger' },
    neutral: { label: '中性', className: 'badge-info' },
  };
  const { label, className } =
    map[sentiment || ''] ?? { label: sentiment || '—', className: 'badge-info' };
  return <span className={`badge ${className}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: '待处理', className: 'badge-warning' },
    reviewed: { label: '已查看', className: 'badge-info' },
    resolved: { label: '已解决', className: 'badge-success' },
  };
  const { label, className } =
    map[status] ?? { label: status, className: 'badge-info' };
  return <span className={`badge ${className}`}>{label}</span>;
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/feedback?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status } : f)),
        );
        setSelectedId(null);
      }
    } finally {
      setUpdating(null);
    }
  };

  const filtered = feedbacks.filter((fb) => {
    const matchSearch =
      !searchQuery ||
      fb.content.includes(searchQuery) ||
      fb.userName.includes(searchQuery);
    return matchSearch;
  });

  const selected = feedbacks.find((f) => f.id === selectedId);

  const statusCounts = {
    all: feedbacks.length,
    new: feedbacks.filter((f) => f.status === 'new').length,
    reviewed: feedbacks.filter((f) => f.status === 'reviewed').length,
    resolved: feedbacks.filter((f) => f.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-text-muted hover:text-white text-sm">
              返回首页
            </Link>
            <ChevronRight className="w-4 h-4 text-text-muted" />
            <h1 className="font-semibold">反馈中心</h1>
          </div>
          <button className="btn btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Status counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { key: 'all', label: '全部', color: '#64748b' },
            { key: 'new', label: '待处理', color: '#ff9f43' },
            { key: 'reviewed', label: '已查看', color: '#4d96ff' },
            { key: 'resolved', label: '已解决', color: '#6bcb77' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`card p-4 text-center cursor-pointer transition-all ${
                statusFilter === item.key
                  ? 'border-white/20'
                  : 'hover:border-white/10'
              }`}
            >
              <p
                className="text-2xl font-bold"
                style={{ color: item.color }}
              >
                {statusCounts[item.key as keyof typeof statusCounts]}
              </p>
              <p className="text-xs text-text-muted mt-1">{item.label}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索反馈内容..."
              className="w-full bg-bg-surface border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors"
            />
          </div>
        </div>

        {/* Empty state */}
        {!loading && feedbacks.length === 0 && (
          <div className="card p-12 text-center mb-6">
            <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无反馈数据</h3>
            <p className="text-sm text-text-muted">
              当微信群中的用户发送「投诉」「建议」「问题」等关键词时，Hermes 会自动引导用户提交反馈
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feedback list */}
          {loading ? (
            <div className="card p-8 text-center">
              <RefreshCw className="w-8 h-8 text-prism-4 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-text-muted">加载中...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((fb) => {
                let tags: string[] = [];
                try {
                  tags = JSON.parse(fb.tags || '[]');
                } catch {
                  tags = [];
                }
                return (
                  <div
                    key={fb.id}
                    onClick={() => setSelectedId(fb.id)}
                    className={`card p-4 cursor-pointer transition-all ${
                      selectedId === fb.id
                        ? 'border-prism-4'
                        : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{fb.userName}</span>
                        <SentimentBadge sentiment={fb.sentiment} />
                        <StatusBadge status={fb.status} />
                      </div>
                      <span className="text-xs text-text-muted">
                        {new Date(fb.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                      {fb.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        {fb.group?.name || fb.groupId}
                      </span>
                      <div className="flex gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="badge badge-info text-xs">
                            <Tag className="w-2.5 h-2.5 mr-0.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail panel */}
          <div className="lg:sticky lg:top-24 h-fit">
            {selected ? (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">反馈详情</h2>
                  <span className="text-xs text-text-muted">#{selected.id}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <SentimentBadge sentiment={selected.sentiment} />
                    <StatusBadge status={selected.status} />
                  </div>

                  {[
                    { label: '用户', value: selected.userName },
                    { label: '群组', value: selected.group?.name || selected.groupId },
                    {
                      label: '时间',
                      value: new Date(selected.createdAt).toLocaleString('zh-CN'),
                    },
                  ].map((row) => (
                    <div key={row.label}>
                      <p className="text-xs text-text-muted mb-1">{row.label}</p>
                      <p className="text-sm">{row.value}</p>
                    </div>
                  ))}

                  <div>
                    <p className="text-xs text-text-muted mb-1">反馈内容</p>
                    <p className="text-sm bg-bg-elevated rounded-lg p-3">
                      {selected.content}
                    </p>
                  </div>

                  {selected.status !== 'resolved' && (
                    <div className="flex gap-3 pt-2">
                      {selected.status === 'new' && (
                        <button
                          onClick={() =>
                            handleStatusChange(selected.id, 'reviewed')
                          }
                          disabled={!!updating}
                          className="btn btn-secondary text-sm flex-1 flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          标记已查看
                        </button>
                      )}
                      <button
                        onClick={() =>
                          handleStatusChange(selected.id, 'resolved')
                        }
                        disabled={!!updating}
                        className="btn btn-primary text-sm flex-1 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        标记已解决
                      </button>
                    </div>
                  )}

                  {selected.status === 'resolved' && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() =>
                          handleStatusChange(selected.id, 'new')
                        }
                        disabled={!!updating}
                        className="btn btn-secondary text-sm flex-1"
                      >
                        重新打开
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-muted">选择一条反馈查看详情</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
