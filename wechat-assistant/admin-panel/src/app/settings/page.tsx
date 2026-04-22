'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  Wifi,
  WifiOff,
  Zap,
  Database,
  Shield,
  Key,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Bot,
  Activity,
  Users,
  MessageSquare,
  Save,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface GatewayState {
  pid: number;
  gateway_state: string;
  active_agents: number;
  platforms: Record<string, { state: string; error_message: string | null }>;
  updated_at: string;
}

interface HermesSettings {
  WEIXIN_ACCOUNT_ID: string;
  WEIXIN_TOKEN: string;
  WEIXIN_DM_POLICY: string;
  WEIXIN_ALLOWED_USERS: string;
  WEIXIN_GROUP_POLICY: string;
  WEIXIN_GROUP_ALLOWED_USERS: string;
  WEIXIN_HOME_CHANNEL: string;
  WEIXIN_HOME_CHANNEL_NAME: string;
}

interface Personality {
  name: string;
  content: string;
}

const dmPolicyOptions = [
  { value: 'open', label: '开放', desc: '响应所有私聊' },
  { value: 'allowlist', label: '白名单', desc: '仅响应指定用户' },
  { value: 'pairing', label: '配对模式', desc: '用户配对后响应' },
  { value: 'disabled', label: '禁用', desc: '不响应任何私聊' },
];

const groupPolicyOptions = [
  { value: 'open', label: '开放', desc: '响应所有群消息' },
  { value: 'allowlist', label: '白名单', desc: '仅响应指定群' },
  { value: 'disabled', label: '禁用', desc: '不响应群消息（默认）' },
];

export default function SettingsPage() {
  const [gateway, setGateway] = useState<GatewayState | null>(null);
  const [personality, setPersonality] = useState<Personality | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hermesPath, setHermesPath] = useState('/Users/john/.hermes');
  const [editingPersona, setEditingPersona] = useState(false);
  const [personaContent, setPersonaContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Hermes 权限配置状态
  const [settings, setSettings] = useState<HermesSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Partial<HermesSettings>>({});

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchHermes = useCallback(async () => {
    setFetchError(null);
    try {
      const results = await Promise.allSettled([
        fetch('/api/hermes/stats').then((r) => r.json()),
        fetch('/api/hermes/personality').then((r) => r.ok ? r.json() : Promise.resolve(null)),
        fetch('/api/hermes/skills').then((r) => r.json()),
        fetch('/api/hermes/settings').then((r) => r.ok ? r.json() : Promise.resolve(null)),
      ]);

      const [gwRes, perRes, skRes, settingsRes] = results.map((r) =>
        r.status === 'fulfilled' ? r.value : {}
      );

      if (gwRes.gateway !== undefined || gwRes.gateway !== null) {
        setGateway(gwRes.gateway ?? null);
      }
      setHermesPath(gwRes.hermesPath || '/Users/john/.hermes');
      setPersonality(perRes?.name != null ? perRes : null);
      setSkills(skRes?.skills || []);
      if (settingsRes?.settings) {
        setSettings(settingsRes.settings);
        setSettingsDraft(settingsRes.settings);
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setLoading(false);
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHermes();
  }, [fetchHermes]);

  const onEditPersona = () => {
    if (personality) {
      setPersonaContent(personality.content);
      setEditingPersona(true);
    }
  };

  const onSavePersona = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/hermes/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: personaContent }),
      });
      if (res.ok) {
        setSaveMsg({ type: 'ok', text: '人格已保存，下次对话生效' });
        setEditingPersona(false);
        fetchHermes();
      } else {
        setSaveMsg({ type: 'err', text: '保存失败' });
      }
    } catch {
      setSaveMsg({ type: 'err', text: '保存失败' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const onSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/hermes/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsDraft),
      });
      if (res.ok) {
        setSettingsMsg({ type: 'ok', text: '配置已保存，Gateway 重启后生效' });
        setSettingsEditing(false);
        fetchHermes();
      } else {
        const err = await res.json();
        setSettingsMsg({ type: 'err', text: err.error || '保存失败' });
      }
    } catch {
      setSettingsMsg({ type: 'err', text: '网络错误，请重试' });
    } finally {
      setSettingsSaving(false);
      setTimeout(() => setSettingsMsg(null), 4000);
    }
  };

  const isRunning = gateway?.gateway_state === 'running';

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-white/5 bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-text-muted hover:text-white text-sm">
            返回首页
          </Link>
          <ChevronRight className="w-4 h-4 text-text-muted" />
          <h1 className="font-semibold">系统设置</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Gateway 状态 */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-prism-4" />
            Gateway 运行状态
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-text-muted">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : gateway ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {isRunning ? (
                      <CheckCircle className="w-4 h-4 text-prism-3" />
                    ) : (
                      <XCircle className="w-4 h-4 text-prism-1" />
                    )}
                    Gateway {isRunning ? '运行中' : '已停止'}
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    PID: {gateway.pid} · 活跃 Agent: {gateway.active_agents} · 更新于{' '}
                    {new Date(gateway.updated_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <span className={`badge ${isRunning ? 'badge-success' : 'badge-danger'}`}>
                  {isRunning ? '在线' : '离线'}
                </span>
              </div>
              {Object.entries(gateway.platforms).map(([name, p]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{name}</p>
                    <p className="text-xs text-text-muted">{p.state}</p>
                    {p.error_message && (
                      <p className="text-xs text-prism-1 mt-0.5">{p.error_message}</p>
                    )}
                  </div>
                  <span
                    className={`badge ${p.state === 'connected' ? 'badge-success' : 'badge-danger'}`}
                  >
                    {p.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-prism-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">
                {fetchError ? `连接失败: ${fetchError}` : '无法连接到 Hermes Gateway'}
              </span>
            </div>
          )}
        </div>

        {/* Hermes 微信权限配置 */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-prism-1" />
              微信权限配置
            </h2>
            {!settingsEditing ? (
              <button
                onClick={() => {
                  setSettingsEditing(true);
                  setSettingsDraft(settings || {});
                }}
                className="btn btn-secondary text-sm"
                disabled={settingsLoading}
              >
                <Key className="w-3.5 h-3.5 mr-1.5" />
                编辑配置
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSettingsEditing(false);
                    setSettingsMsg(null);
                  }}
                  className="btn btn-secondary text-sm"
                  disabled={settingsSaving}
                >
                  取消
                </button>
                <button
                  onClick={onSaveSettings}
                  className="btn btn-primary text-sm flex items-center gap-1.5"
                  disabled={settingsSaving}
                >
                  <Save className="w-3.5 h-3.5" />
                  {settingsSaving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>

          {settingsLoading && !settings && (
            <div className="flex items-center gap-2 text-text-muted">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">加载配置...</span>
            </div>
          )}

          {/* 配置说明 */}
          <div className="mb-4 p-3 bg-prism-4/10 border border-prism-4/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-prism-4 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-text-secondary leading-relaxed">
                <p className="mb-1">
                  <strong className="text-prism-4">配置说明：</strong>这些设置控制 Hermes 机器人对微信消息的响应权限。
                  修改后需重启 Gateway 才能生效。
                </p>
                <p>
                  白名单模式下，需填写允许的用户 ID（私聊）或群 ID（群聊），多个 ID 用英文逗号分隔。
                </p>
              </div>
            </div>
          </div>

          {settingsMsg && (
            <div className={`mb-4 p-2.5 rounded-lg flex items-center gap-2 ${
              settingsMsg.type === 'ok'
                ? 'bg-prism-3/10 border border-prism-3/20'
                : 'bg-prism-1/10 border border-prism-1/20'
            }`}>
              {settingsMsg.type === 'ok' ? (
                <CheckCircle className="w-4 h-4 text-prism-3 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-prism-1 flex-shrink-0" />
              )}
              <p className={`text-xs ${settingsMsg.type === 'ok' ? 'text-prism-3' : 'text-prism-1'}`}>
                {settingsMsg.text}
              </p>
            </div>
          )}

          {settingsEditing ? (
            <div className="space-y-5">
              {/* 私聊策略 */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-prism-4" />
                  私聊策略
                  <span className="badge badge-info text-xs ml-1">DM</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  {dmPolicyOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-3 rounded-lg cursor-pointer transition-colors ${
                        settingsDraft.WEIXIN_DM_POLICY === opt.value
                          ? 'bg-prism-4/10 border border-prism-4/30'
                          : 'bg-bg-elevated hover:bg-bg-overlay border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="dmPolicy"
                        value={opt.value}
                        checked={settingsDraft.WEIXIN_DM_POLICY === opt.value}
                        onChange={() =>
                          setSettingsDraft({ ...settingsDraft, WEIXIN_DM_POLICY: opt.value })
                        }
                        className="accent-prism-4 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-text-muted">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {settingsDraft.WEIXIN_DM_POLICY === 'allowlist' && (
                  <input
                    type="text"
                    value={settingsDraft.WEIXIN_ALLOWED_USERS || ''}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, WEIXIN_ALLOWED_USERS: e.target.value })
                    }
                    placeholder="允许的微信用户 ID，多个用逗号分隔"
                    className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors"
                  />
                )}
              </div>

              {/* 群策略 */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-prism-5" />
                  群策略
                  <span className="badge badge-info text-xs ml-1">Group</span>
                  <span className="badge badge-warning text-xs ml-1">默认禁用</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                  {groupPolicyOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        settingsDraft.WEIXIN_GROUP_POLICY === opt.value
                          ? 'bg-prism-4/10 border border-prism-4/30'
                          : 'bg-bg-elevated hover:bg-bg-overlay border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="groupPolicy"
                        value={opt.value}
                        checked={settingsDraft.WEIXIN_GROUP_POLICY === opt.value}
                        onChange={() =>
                          setSettingsDraft({ ...settingsDraft, WEIXIN_GROUP_POLICY: opt.value })
                        }
                        className="accent-prism-4 mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-text-muted">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {settingsDraft.WEIXIN_GROUP_POLICY === 'allowlist' && (
                  <input
                    type="text"
                    value={settingsDraft.WEIXIN_GROUP_ALLOWED_USERS || ''}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        WEIXIN_GROUP_ALLOWED_USERS: e.target.value,
                      })
                    }
                    placeholder="允许的微信群 ID，多个用逗号分隔"
                    className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors font-mono"
                  />
                )}
              </div>

              {/* 管理员通知通道 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  管理员通知通道
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={settingsDraft.WEIXIN_HOME_CHANNEL || ''}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, WEIXIN_HOME_CHANNEL: e.target.value })
                    }
                    placeholder="管理员私聊的 chat_id（选填）"
                    className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors font-mono"
                  />
                  <input
                    type="text"
                    value={settingsDraft.WEIXIN_HOME_CHANNEL_NAME || ''}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, WEIXIN_HOME_CHANNEL_NAME: e.target.value })
                    }
                    placeholder="管理员显示名称（选填）"
                    className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-prism-4 transition-colors"
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">
                  定时任务输出和系统通知将发送到此处
                </p>
              </div>
            </div>
          ) : (
            /* 只读展示模式 */
            <div className="space-y-4">
              {/* 私聊策略 */}
              <div className="p-4 bg-bg-elevated rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-prism-4" />
                    <span className="text-sm font-medium">私聊策略</span>
                  </div>
                  <span className={`badge ${
                    settings?.WEIXIN_DM_POLICY === 'open' ? 'badge-success' :
                    settings?.WEIXIN_DM_POLICY === 'allowlist' ? 'badge-info' :
                    settings?.WEIXIN_DM_POLICY === 'pairing' ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {dmPolicyOptions.find((o) => o.value === settings?.WEIXIN_DM_POLICY)?.label || '未知'}
                  </span>
                </div>
                {settings?.WEIXIN_DM_POLICY === 'allowlist' && settings?.WEIXIN_ALLOWED_USERS && (
                  <p className="text-xs text-text-muted font-mono truncate">
                    白名单用户：{settings.WEIXIN_ALLOWED_USERS}
                  </p>
                )}
              </div>

              {/* 群策略 */}
              <div className="p-4 bg-bg-elevated rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-prism-5" />
                    <span className="text-sm font-medium">群策略</span>
                  </div>
                  <span className={`badge ${
                    settings?.WEIXIN_GROUP_POLICY === 'open' ? 'badge-success' :
                    settings?.WEIXIN_GROUP_POLICY === 'allowlist' ? 'badge-info' : 'badge-danger'
                  }`}>
                    {groupPolicyOptions.find((o) => o.value === settings?.WEIXIN_GROUP_POLICY)?.label || '未知'}
                  </span>
                </div>
                {settings?.WEIXIN_GROUP_POLICY === 'disabled' && (
                  <div className="flex items-start gap-2 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-prism-1 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-prism-1">
                      群消息功能已禁用。如需启用，请点击右上角「编辑配置」，将群策略改为「开放」或「白名单」
                    </p>
                  </div>
                )}
                {settings?.WEIXIN_GROUP_POLICY === 'allowlist' && settings?.WEIXIN_GROUP_ALLOWED_USERS && (
                  <p className="text-xs text-text-muted font-mono truncate">
                    白名单群：{settings.WEIXIN_GROUP_ALLOWED_USERS}
                  </p>
                )}
              </div>

              {/* 管理员通知 */}
              <div className="p-4 bg-bg-elevated rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-prism-2" />
                  <span className="text-sm font-medium">管理员通知通道</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted">Home Channel ID</span>
                    <span className="font-mono text-text-secondary truncate ml-4">
                      {settings?.WEIXIN_HOME_CHANNEL || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted">显示名称</span>
                    <span className="text-text-secondary">
                      {settings?.WEIXIN_HOME_CHANNEL_NAME || '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-prism-1/5 border border-prism-1/20 rounded-lg">
                <p className="text-xs text-text-secondary leading-relaxed">
                  <strong className="text-prism-1">重要：</strong>
                  如需修改权限配置，点击右上角「编辑配置」。配置写入 <code className="text-prism-4">~/.hermes/.env</code> 文件，
                  修改后需执行 <code className="text-prism-4">hermes gateway restart</code> 重启 Gateway 生效。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 数据目录 */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-prism-6" />
            Hermes 数据目录
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg">
              <div>
                <p className="font-medium">Hermes Home</p>
                <p className="text-sm text-text-muted font-mono">{hermesPath}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-prism-3" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['sessions/', '会话记录'],
                ['gateway_state.json', 'Gateway 状态'],
                ['channel_directory.json', '群组/联系人目录'],
                ['SOUL.md', '人格配置'],
                ['.env', '权限策略配置'],
                ['data/wechat-assistant.db', 'SQLite 数据库'],
              ].map(([path, label]) => (
                <div
                  key={path}
                  className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-prism-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono text-prism-4">{path}</p>
                    <p className="text-xs text-text-muted">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 当前人格 */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-prism-5" />
              当前人格 (SOUL.md)
            </h2>
            {!editingPersona && (
              <button
                onClick={onEditPersona}
                className="btn btn-secondary text-sm"
              >
                编辑人格
              </button>
            )}
          </div>

          {editingPersona ? (
            <div className="space-y-3">
              <textarea
                value={personaContent}
                onChange={(e) => setPersonaContent(e.target.value)}
                rows={16}
                className="w-full bg-bg-elevated border border-white/10 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-prism-4 resize-none"
                placeholder="编辑 SOUL.md 内容..."
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingPersona(false)}
                  className="btn btn-secondary text-sm"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  onClick={onSavePersona}
                  className="btn btn-primary text-sm"
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
              {saveMsg && (
                <p
                  className={`text-xs ${saveMsg.type === 'ok' ? 'text-prism-3' : 'text-prism-1'}`}
                >
                  {saveMsg.text}
                </p>
              )}
            </div>
          ) : personality ? (
            <div className="space-y-3">
              <pre className="text-xs text-text-secondary bg-bg-elevated rounded-lg p-4 whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto font-mono">
                {personality.content}
              </pre>
              <p className="text-xs text-text-muted">
                人格修改后，下次对话立即生效，无需重启 Gateway
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              SOUL.md 文件不存在，使用默认人格
            </p>
          )}
        </div>

        {/* Skills */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-prism-2" />
            当前 Skills ({skills.length})
          </h2>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="badge badge-info text-xs">
                  {skill.replace('.md', '')}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">暂无加载的 Skills</p>
          )}
        </div>

        {/* 安全设置 */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-prism-1" />
            安全设置
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg">
              <div>
                <p className="font-medium">Hermes 本地访问</p>
                <p className="text-xs text-text-muted mt-1">
                  此管理后台需要本地运行才能访问 Hermes 数据
                </p>
              </div>
              <CheckCircle className="w-4 h-4 text-prism-3" />
            </div>
            <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg">
              <div>
                <p className="font-medium">会话隔离</p>
                <p className="text-xs text-text-muted mt-1">
                  每个用户在群组中有独立会话，不会共享上下文
                </p>
              </div>
              <CheckCircle className="w-4 h-4 text-prism-3" />
            </div>
          </div>
        </div>

        {/* 文档链接 */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">相关文档</h2>
          <div className="space-y-2">
            {[
              {
                label: 'Hermes Agent 文档',
                url: 'https://hermes-agent.nousresearch.com/',
              },
              {
                label: '微信接入指南',
                url: 'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin',
              },
              {
                label: 'MCP 集成文档',
                url: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp',
              },
            ].map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg hover:bg-bg-overlay transition-colors"
              >
                <span className="text-sm">{link.label}</span>
                <ExternalLink className="w-4 h-4 text-text-muted" />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
