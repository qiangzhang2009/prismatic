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
} from 'lucide-react';

interface GatewayState {
  pid: number;
  gateway_state: string;
  active_agents: number;
  platforms: Record<string, { state: string; error_message: string | null }>;
  updated_at: string;
}

interface Personality {
  name: string;
  content: string;
}

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

  const fetchHermes = useCallback(async () => {
    try {
      const [gwRes, perRes, skRes] = await Promise.all([
        fetch('/api/hermes/stats').then((r) => r.json()),
        fetch('/api/hermes/personality').then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch('/api/hermes/skills').then((r) => r.json()),
      ]);

      setGateway(gwRes.gateway);
      setHermesPath(gwRes.hermesPath || '/Users/john/.hermes');
      setPersonality(perRes);
      setSkills(skRes.skills || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
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
              <span className="text-sm">无法连接到 Hermes Gateway</span>
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
                ['channel_directory.json', '通道目录'],
                ['SOUL.md', '人格配置'],
                ['config.yaml', '主配置文件'],
                ['data/wechat-assistant.db', 'WeChat 数据库'],
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
