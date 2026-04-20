'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Plus,
  Eye,
  Copy,
  Check,
  X,
  ChevronRight,
  Zap,
  Heart,
  MessageCircle,
} from 'lucide-react';

const personaOptions = [
  {
    slug: 'smart-assistant',
    name: '智能助手',
    desc: '默认助手风格，有问必答，知识渊博',
    color: '#4d96ff',
    tags: ['通用', '学习', '答疑'],
    features: ['知识问答', '问题分析', '学习辅导'],
  },
  {
    slug: 'customer-service',
    name: '客服小秘',
    desc: '专业友好，每条回复不超过 200 字',
    color: '#6bcb77',
    tags: ['客服', '产品', '服务'],
    features: ['投诉处理', 'FAQ 问答', '服务引导'],
  },
  {
    slug: 'mentor',
    name: '成长导师',
    desc: '启发式引导，帮助你在思考中成长',
    color: '#c77dff',
    tags: ['成长', '教练', '启发'],
    features: ['思维引导', '决策支持', '心态调整'],
  },
  {
    slug: 'entertainer',
    name: '吐槽大师',
    desc: '轻松幽默，适度玩梗，陪你聊',
    color: '#ff9f43',
    tags: ['娱乐', '闲聊', '吐槽'],
    features: ['轻松互动', '幽默陪聊', '缓解气氛'],
  },
  {
    slug: 'strict-moderator',
    name: '严格管理员',
    desc: '简洁直接，规则明确，言出必行',
    color: '#ff6b6b',
    tags: ['管理', '规则', '风控'],
    features: ['广告过滤', '刷屏检测', '违规处理'],
  },
];

const mockGroups = [
  { id: 'g-001', name: 'Alpha 学习群', personaSlug: 'mentor' },
  { id: 'g-002', name: 'Beta 产品群', personaSlug: 'customer-service' },
  { id: 'g-003', name: 'Gamma 闲聊群', personaSlug: 'entertainer' },
];

export default function PersonasPage() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const handleCopy = (slug: string) => {
    navigator.clipboard.writeText(slug).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const activePersona = personaOptions.find((p) => p.slug === selectedPersona);

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
            <h1 className="font-semibold">Persona 管理</h1>
          </div>
          <button className="btn btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            导入自定义
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* 左侧：Persona 列表 */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-medium text-text-muted mb-3">
              内置 Persona ({personaOptions.length})
            </h2>
            {personaOptions.map((persona) => (
              <div
                key={persona.slug}
                onClick={() => setSelectedPersona(persona.slug)}
                className={`card p-4 cursor-pointer transition-all ${
                  selectedPersona === persona.slug
                    ? 'border-prism-4'
                    : 'hover:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-semibold"
                        style={{ color: persona.color }}
                      >
                        {persona.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(persona.slug);
                        }}
                        className="text-text-muted hover:text-white transition-colors"
                        title="复制 slug"
                      >
                        {copiedSlug === persona.slug ? (
                          <Check className="w-3 h-3 text-prism-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mb-2">
                      {persona.desc}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {persona.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${persona.color}15`,
                            color: persona.color,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* 添加自定义 */}
            <div
              className="card p-4 border-dashed cursor-pointer hover:border-white/20 transition-all flex items-center justify-center gap-2 text-text-muted hover:text-white"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">添加自定义 Persona</span>
            </div>
          </div>

          {/* 右侧：详情/预览 */}
          <div className="lg:col-span-3">
            {activePersona ? (
              <div className="space-y-6">
                {/* 基本信息 */}
                <div className="card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2
                        className="text-xl font-bold mb-1"
                        style={{ color: activePersona.color }}
                      >
                        {activePersona.name}
                      </h2>
                      <p className="text-sm text-text-muted">
                        slug: {activePersona.slug}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPreview(activePersona.slug)}
                      className="btn btn-secondary text-sm flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      预览效果
                    </button>
                  </div>

                  <p className="text-sm text-text-secondary mb-4">
                    {activePersona.desc}
                  </p>

                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">核心功能</h3>
                    <div className="flex flex-wrap gap-2">
                      {activePersona.features.map((f) => (
                        <span
                          key={f}
                          className="badge"
                          style={{
                            backgroundColor: `${activePersona.color}15`,
                            color: activePersona.color,
                          }}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="btn btn-secondary text-sm flex-1">
                      编辑配置
                    </button>
                    <button className="btn btn-primary text-sm flex-1">
                      应用到群组
                    </button>
                  </div>
                </div>

                {/* 表达风格预览 */}
                <div className="card p-6">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-prism-5" />
                    表达风格预览
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-bg-elevated rounded-lg p-4">
                      <p className="text-xs text-text-muted mb-2">开场白</p>
                      <p className="text-sm">
                        {activePersona.slug === 'customer-service'
                          ? '您好！请问有什么可以帮到您的？'
                          : activePersona.slug === 'mentor'
                            ? '你好，我是成长导师。有什么困惑想聊聊吗？'
                            : activePersona.slug === 'entertainer'
                              ? '嘿！我是阿皮，今天想吐槽点什么？'
                              : activePersona.slug === 'strict-moderator'
                                ? '群规须知：禁止广告、禁止刷屏、禁止人身攻击。'
                                : '你好！我是小慧，有任何问题随时问我~'}
                      </p>
                    </div>
                    <div className="bg-bg-elevated rounded-lg p-4">
                      <p className="text-xs text-text-muted mb-2">示例回复</p>
                      <p className="text-sm">
                        {activePersona.slug === 'customer-service'
                          ? '非常抱歉给您带来不便，我帮您记录并反馈给团队处理，感谢您的理解。'
                          : activePersona.slug === 'mentor'
                            ? '听起来你正在做一个不容易的选择。你有没有想过，你真正在乎的是什么？'
                            : activePersona.slug === 'entertainer'
                              ? '哈哈哈哈这也太离谱了吧，不过我懂你，说说看？'
                              : activePersona.slug === 'strict-moderator'
                                ? '【警告】禁止发广告。违规两次将移出本群。'
                                : '当然可以！这个问题其实可以从几个方面来看，我来帮你分析一下。'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 绑定到哪些群 */}
                <div className="card p-6">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-prism-1" />
                    当前绑定的群组
                  </h3>
                  <div className="space-y-2">
                    {mockGroups
                      .filter((g) => g.personaSlug === activePersona.slug)
                      .map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg"
                        >
                          <span className="text-sm">{g.name}</span>
                          <span className="badge badge-success text-xs">
                            已启用
                          </span>
                        </div>
                      ))}
                    {mockGroups.filter(
                      (g) => g.personaSlug === activePersona.slug,
                    ).length === 0 && (
                      <p className="text-sm text-text-muted text-center py-4">
                        暂无群组使用此 Persona
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <MessageSquare
                  className="w-12 h-12 text-text-muted mx-auto mb-4"
                />
                <h3 className="text-lg font-medium mb-2">选择 Persona</h3>
                <p className="text-sm text-text-muted">
                  点击左侧的 Persona 查看详情和配置
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
