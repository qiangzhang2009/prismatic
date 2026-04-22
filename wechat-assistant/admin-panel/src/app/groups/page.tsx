'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  MessageSquare,
  Shield,
  Trash2,
  Wifi,
  WifiOff,
  Check,
  X,
  RefreshCw,
  Search,
  Copy,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';

interface ChannelEntry {
  id: string;
  name: string;
  type: string;
  thread_id: string | null;
}

interface ChannelDirectory {
  updated_at: string;
  platforms: Record<string, ChannelEntry[]>;
}

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    wechatId: '',
    platform: 'weixin',
    personaId: 'smart-assistant',
  });

  // --- 发现群组状态 ---
  const [channels, setChannels] = useState<ChannelDirectory | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setGroups(data.groups || []);
      setFetchError(null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/hermes/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch {
      // ignore
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // 发现群组：从 Hermes channel_directory.json 读取已知的群
  const discoveredGroups: ChannelEntry[] = (channels?.platforms?.weixin || [])
    .filter((e) => e.type === 'group')
    .filter((e) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return e.name.toLowerCase().includes(term) || e.id.toLowerCase().includes(term);
    });

  // 已添加的群 ID 集合（用于标记"已添加"状态）
  const addedWechatIds = new Set(groups.map((g) => g.wechatId));

  const handleAdd = async () => {
    if (!formData.name || !formData.wechatId) return;
    setAddError(null);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ name: '', wechatId: '', platform: 'weixin', personaId: 'smart-assistant' });
        setShowDiscovery(false);
        fetchGroups();
      } else {
        const err = await res.json();
        setAddError(err.error || '添加失败');
      }
    } catch {
      setAddError('网络错误，请重试');
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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 从发现列表选择一个群：自动填入表单
  const handleSelectDiscovered = (entry: ChannelEntry) => {
    setFormData({ ...formData, name: entry.name, wechatId: entry.id });
    setShowDiscovery(false);
    setSearchTerm('');
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
            onClick={() => {
              setShowAddModal(true);
              setShowDiscovery(false);
              setAddError(null);
            }}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加群组
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Platform status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* 发现群组提示 */}
        <div className="card p-4 border-prism-4/20 bg-prism-4/5">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-prism-4 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-prism-4 mb-1">如何获取微信群 ID？</p>
              <p className="text-text-secondary text-xs leading-relaxed mb-3">
                微信群 ID 不是群名，而是一个由字母和数字组成的唯一标识符（如 <code className="text-prism-4">R:xxxxxxxxx</code>）。
                Hermes 已连接微信后，会自动记录你加入的群组。点击下方按钮，Hermes 会从已记录的群列表中获取真实 ID。
              </p>
              <button
                onClick={() => {
                  setShowDiscovery(!showDiscovery);
                  if (!channels) fetchChannels();
                }}
                className="btn btn-secondary text-xs"
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                {showDiscovery ? '关闭发现面板' : '从 Hermes 发现群组'}
              </button>
            </div>
          </div>
        </div>

        {/* 发现群组面板 */}
        {showDiscovery && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">Hermes 记录的微信群</h2>
              <button
                onClick={fetchChannels}
                disabled={channelsLoading}
                className="btn btn-secondary text-xs p-1.5"
                title="刷新"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${channelsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {channelsLoading && (
              <div className="flex items-center gap-2 text-sm text-text-muted py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                正在从 Hermes 读取群组数据...
              </div>
            )}

            {!channelsLoading && channels && discoveredGroups.length === 0 && (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">
                  {searchTerm ? '没有找到匹配的群' : '尚未发现任何微信群'}
                </p>
                {!searchTerm && (
                  <p className="text-xs text-text-muted mt-1">
                    请先确保 Hermes Gateway 正在运行，且你已加入至少一个微信群
                  </p>
                )}
              </div>
            )}

            {!channelsLoading && discoveredGroups.length > 0 && (
              <>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索群名称或 ID..."
                    className="w-full bg-bg-elevated border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-prism-4 transition-colors"
                  />
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {discoveredGroups.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg hover:bg-bg-overlay transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.name || '(无名称)'}</p>
                        <p className="text-xs text-text-muted font-mono truncate mt-0.5">{entry.id}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <button
                          onClick={() => handleCopyId(entry.id)}
                          className="btn btn-secondary text-xs p-1.5"
                          title="复制 ID"
                        >
                          {copiedId === entry.id ? (
                            <Check className="w-3.5 h-3.5 text-prism-3" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {addedWechatIds.has(entry.id) ? (
                          <span className="badge badge-success text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            已添加
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSelectDiscovered(entry)}
                            className="btn btn-primary text-xs"
                          >
                            使用此群
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-3">
                  共 {discoveredGroups.length} 个群，来源：Hermes channel_directory.json（最后更新：{channels?.updated_at ? new Date(channels.updated_at).toLocaleString('zh-CN') : '未知'}）
                </p>
              </>
            )}

            {!channelsLoading && channels && channels.platforms?.weixin?.filter((e) => e.type === 'group').length === 0 && (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">尚未发现任何微信群</p>
                <p className="text-xs text-text-muted mt-1">
                  确认 Hermes Gateway 已运行，且微信机器人在群中收到了消息
                </p>
              </div>
            )}
          </div>
        )}

        {fetchError && (
          <div className="card p-4 bg-prism-1/10 border border-prism-1/20">
            <p className="text-sm text-prism-1">加载失败: {fetchError}</p>
            <p className="text-xs text-text-muted mt-1">
              请检查数据库连接（DATABASE_URL）是否正确配置
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div className="card p-12 text-center">
            <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无群组</h3>
            <p className="text-sm text-text-muted mb-6">
              点击上方「添加群组」，从 Hermes 发现的群列表中选择，或手动输入群 ID
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
          <div className="card p-8 text-center">
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
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                    <p className="text-xs text-text-muted mb-3 font-mono">
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
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">添加群组</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowDiscovery(false);
                  setAddError(null);
                }}
                className="text-text-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ID 说明提示 */}
            <div className="mb-4 p-3 bg-prism-4/10 border border-prism-4/20 rounded-lg">
              <p className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-prism-4">提示：</strong>微信群 ID 是由 Hermes 自动记录的内部标识，
                不是群的显示名称。推荐先点击「从 Hermes 发现」获取真实 ID，
                再填写群名称后提交。
              </p>
              <button
                onClick={() => {
                  setShowDiscovery(!showDiscovery);
                  if (!channels) fetchChannels();
                }}
                className="btn btn-secondary text-xs mt-2"
              >
                <Search className="w-3.5 h-3.5 mr-1" />
                从 Hermes 发现群组
              </button>
            </div>

            {/* 内联发现面板（收起在表单内） */}
            {showDiscovery && (
              <div className="mb-4 p-3 bg-bg-elevated rounded-lg border border-white/10">
                <p className="text-xs text-text-muted mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  选择一个群后，ID 会自动填入下方表单
                </p>
                {channelsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    加载中...
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {discoveredGroups.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-2">无记录</p>
                    ) : (
                      discoveredGroups.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-bg-overlay transition-colors ${
                            formData.wechatId === entry.id ? 'border border-prism-4 bg-prism-4/10' : ''
                          }`}
                          onClick={() => handleSelectDiscovered(entry)}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{entry.name || '(无名称)'}</p>
                            <p className="text-xs text-text-muted font-mono truncate">{entry.id}</p>
                          </div>
                          {formData.wechatId === entry.id && (
                            <CheckCircle className="w-3.5 h-3.5 text-prism-4 flex-shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

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
                  placeholder="点击「发现群组」获取，或手动粘贴 ID"
                  className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors font-mono"
                />
                <p className="text-xs text-text-muted mt-1">
                  格式示例：<code className="text-prism-4">R:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
                </p>
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

            {addError && (
              <div className="mt-3 p-2.5 bg-prism-1/10 border border-prism-1/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-prism-1 flex-shrink-0" />
                <p className="text-xs text-prism-1">{addError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowDiscovery(false);
                  setAddError(null);
                }}
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
