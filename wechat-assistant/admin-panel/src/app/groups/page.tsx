'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  MessageSquare,
  Shield,
  Clock,
  Trash2,
  Edit2,
  Wifi,
  WifiOff,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  wechatId: string;
  platform: string;
  personaId: string | null;
  policy: string;
  keywords: string;
  isActive: boolean;
  createdAt: string;
  persona?: { name: string; slug: string };
}

const personaOptions = [
  { slug: 'smart-assistant', name: '智能助手', color: '#4d96ff' },
  { slug: 'customer-service', name: '客服小秘', color: '#6bcb77' },
  { slug: 'mentor', name: '成长导师', color: '#c77dff' },
  { slug: 'entertainer', name: '吐槽大师', color: '#ff9f43' },
  { slug: 'strict-moderator', name: '严格管理员', color: '#ff6b6b' },
];

function PersonaBadge({ slug }: { slug: string | null }) {
  const persona = personaOptions.find((p) => p.slug === slug);
  if (!persona) return <span className="badge badge-info">{slug || '默认'}</span>;
  return (
    <span
      className="badge text-xs"
      style={{ backgroundColor: `${persona.color}20`, color: persona.color }}
    >
      {persona.name}
    </span>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    wechatId: '',
    platform: 'weixin',
    personaId: 'smart-assistant',
  });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleAdd = async () => {
    if (!formData.name || !formData.wechatId) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ name: '', wechatId: '', platform: 'weixin', personaId: 'smart-assistant' });
        fetchGroups();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该群组？')) return;
    try {
      await fetch(`/api/groups/${id}`, { method: 'DELETE' });
      fetchGroups();
    } catch {
      // ignore
    }
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
            <h1 className="font-semibold">群组配置</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加群组
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Platform status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-prism-4/20">
              <Wifi className="w-4 h-4 text-prism-4" />
            </div>
            <div>
              <p className="text-sm font-medium">个人微信</p>
              <p className="text-xs text-prism-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-3 inline-block" />
                已连接
              </p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-prism-6/20">
              <Wifi className="w-4 h-4 text-prism-6" />
            </div>
            <div>
              <p className="text-sm font-medium">企业微信</p>
              <p className="text-xs text-prism-6 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-6 inline-block" />
                未配置
              </p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <MessageSquare className="w-4 h-4 text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium">管理中的群</p>
              <p className="text-xs text-text-secondary">{groups.length} 个</p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div className="card p-12 text-center mb-8">
            <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无群组</h3>
            <p className="text-sm text-text-muted mb-6">
              添加第一个微信群，开始智能管理
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加群组
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card p-8 text-center mb-8">
            <RefreshCw className="w-8 h-8 text-prism-4 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-text-muted">加载中...</p>
          </div>
        )}

        {/* Group list */}
        {groups.length > 0 && (
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="card p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <PersonaBadge slug={group.personaId} />
                      <span
                        className={`badge text-xs ${group.isActive ? 'badge-success' : 'badge-warning'}`}
                      >
                        {group.isActive ? '启用' : '禁用'}
                      </span>
                      <span className="badge badge-info text-xs">
                        {group.platform === 'weixin' ? '个人微信' : '企业微信'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mb-3">
                      ID: {group.wechatId}
                    </p>
                    <div className="flex items-center gap-6 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        {group.policy === 'open' ? '开放' : group.policy === 'allowlist' ? '白名单' : '禁用'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="btn btn-danger text-sm p-2"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Keywords preview */}
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4 text-xs">
                  <span className="text-text-muted">广告过滤:</span>
                  <span className="text-prism-3 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {group.policy !== 'disabled' ? '开启' : '关闭'}
                  </span>
                  <span className="text-text-muted">刷屏检测:</span>
                  <span className="text-prism-3 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {group.policy !== 'disabled' ? '开启' : '关闭'}
                  </span>
                  <span className="text-text-muted">反馈收集:</span>
                  <span className="text-prism-3 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    开启
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">添加群组</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-text-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  群名称 <span className="text-prism-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：产品反馈群"
                  className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  微信群 ID <span className="text-prism-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.wechatId}
                  onChange={(e) => setFormData({ ...formData, wechatId: e.target.value })}
                  placeholder="在微信群详情页复制"
                  className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">绑定 Persona</label>
                <div className="grid grid-cols-1 gap-2">
                  {personaOptions.map((p) => (
                    <label
                      key={p.slug}
                      className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg cursor-pointer hover:bg-bg-overlay transition-colors"
                    >
                      <input
                        type="radio"
                        name="persona"
                        value={p.slug}
                        checked={formData.personaId === p.slug}
                        onChange={(e) => setFormData({ ...formData, personaId: e.target.value })}
                        className="accent-prism-4"
                      />
                      <span className="text-sm font-medium" style={{ color: p.color }}>
                        {p.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="btn btn-primary flex-1"
                disabled={!formData.name || !formData.wechatId}
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
