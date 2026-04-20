'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Search,
  Filter,
  Download,
  MessageSquare,
  Bot,
  User,
  Clock,
  ChevronLeft,
} from 'lucide-react';

const mockMessages = [
  {
    id: 'msg-001',
    userName: '群友A',
    userId: 'wx_user_001',
    groupName: 'Beta 产品群',
    content: '请问怎么设置每日提醒？',
    isFromBot: false,
    createdAt: '2026-04-20 10:32:15',
  },
  {
    id: 'msg-002',
    userName: '客服小秘',
    userId: 'bot',
    groupName: 'Beta 产品群',
    content: '您好！请进入设置 -> 提醒 -> 开启每日提醒，然后设置提醒时间即可。',
    isFromBot: true,
    botPersona: 'customer-service',
    createdAt: '2026-04-20 10:32:18',
  },
  {
    id: 'msg-003',
    userName: '群友A',
    userId: 'wx_user_001',
    groupName: 'Beta 产品群',
    content: '好的，谢谢！',
    isFromBot: false,
    createdAt: '2026-04-20 10:32:25',
  },
  {
    id: 'msg-004',
    userName: '群友B',
    userId: 'wx_user_002',
    groupName: 'Alpha 学习群',
    content: '今天讨论的主题是什么？',
    isFromBot: false,
    createdAt: '2026-04-20 10:31:00',
  },
  {
    id: 'msg-005',
    userName: '成长导师',
    userId: 'bot',
    groupName: 'Alpha 学习群',
    content: '好问题！你有没有想过，你最近最想学习的是什么？',
    isFromBot: true,
    botPersona: 'mentor',
    createdAt: '2026-04-20 10:31:05',
  },
  {
    id: 'msg-006',
    userName: '群友C',
    userId: 'wx_user_003',
    groupName: 'Gamma 闲聊群',
    content: '哈哈哈哈笑死我了这个',
    isFromBot: false,
    createdAt: '2026-04-20 10:30:50',
  },
  {
    id: 'msg-007',
    userName: '吐槽大师',
    userId: 'bot',
    groupName: 'Gamma 闲聊群',
    content: '好家伙，又是哪个沙雕内容，我看看是谁发的',
    isFromBot: true,
    botPersona: 'entertainer',
    createdAt: '2026-04-20 10:30:52',
  },
];

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = mockMessages.filter((msg) => {
    const matchSearch =
      !searchQuery ||
      msg.content.includes(searchQuery) ||
      msg.userName.includes(searchQuery);
    const matchGroup = groupFilter === 'all' || msg.groupName === groupFilter;
    const matchType =
      typeFilter === 'all' ||
      (typeFilter === 'bot' && msg.isFromBot) ||
      (typeFilter === 'user' && !msg.isFromBot);
    return matchSearch && matchGroup && matchType;
  });

  const groups = [...new Set(mockMessages.map((m) => m.groupName))];

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
            <h1 className="font-semibold">消息日志</h1>
          </div>
          <button className="btn btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 筛选栏 */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索消息内容..."
                className="w-full bg-bg-elevated border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-prism-4"
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-prism-4"
            >
              <option value="all">全部群组</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-prism-4"
            >
              <option value="all">全部类型</option>
              <option value="user">用户消息</option>
              <option value="bot">Bot 消息</option>
            </select>
          </div>
        </div>

        {/* 统计 */}
        <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
          <span>共 {filtered.length} 条消息</span>
          <span>
            Bot: {filtered.filter((m) => m.isFromBot).length}
          </span>
          <span>
            用户: {filtered.filter((m) => !m.isFromBot).length}
          </span>
        </div>

        {/* 消息列表 */}
        <div className="space-y-2">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              className="card p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    msg.isFromBot ? 'bg-prism-4/20' : 'bg-bg-elevated'
                  }`}
                >
                  {msg.isFromBot ? (
                    <Bot className="w-4 h-4 text-prism-4" />
                  ) : (
                    <User className="w-4 h-4 text-text-secondary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`font-medium text-sm ${
                        msg.isFromBot ? 'text-prism-4' : ''
                      }`}
                    >
                      {msg.userName}
                    </span>
                    {msg.isFromBot && msg.botPersona && (
                      <span className="badge badge-info text-xs">
                        {msg.botPersona}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {msg.groupName}
                    </span>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {msg.createdAt}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">未找到匹配的消息</p>
          </div>
        )}

        {/* 分页 */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary text-sm p-2 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-muted px-4">
              第 {page} 页
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-secondary text-sm p-2"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
