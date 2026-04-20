'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Play,
  Pause,
  Clock,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';

const mockTasks = [
  {
    id: 'task-001',
    name: '每日摘要',
    cron: '0 9 * * 1-5',
    cronLabel: '每个工作日 09:00',
    personaId: 'smart-assistant',
    personaName: '智能助手',
    groups: ['Alpha 学习群', 'Beta 产品群'],
    enabled: true,
    lastRun: '2026-04-18 09:00',
    lastStatus: 'success',
  },
  {
    id: 'task-002',
    name: '每周报告',
    cron: '0 10 * * 1',
    cronLabel: '每周一 10:00',
    personaId: 'smart-assistant',
    personaName: '智能助手',
    groups: ['所有群'],
    enabled: true,
    lastRun: '2026-04-14 10:00',
    lastStatus: 'success',
  },
  {
    id: 'task-003',
    name: '潜水提醒',
    cron: '0 20 * * 5',
    cronLabel: '每周五 20:00',
    personaId: 'strict-moderator',
    personaName: '严格管理员',
    groups: ['Alpha 学习群'],
    enabled: false,
    lastRun: '2026-04-11 20:00',
    lastStatus: 'failed',
  },
];

function CronBadge({ cron, label }: { cron: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-text-muted" />
      <div>
        <p className="text-sm font-mono text-prism-4">{cron}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockTasks);
  const [showAddModal, setShowAddModal] = useState(false);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    );
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
            <h1 className="font-semibold">定时任务</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 说明 */}
        <div className="card p-4 mb-6 flex items-start gap-3">
          <Zap className="w-4 h-4 text-prism-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-white mb-1">Cron 表达式说明</p>
            <p>
              格式: <code className="text-prism-4">分 时 日 月 周</code>
              。例如 <code className="text-prism-4">0 9 * * 1-5</code>{' '}
              表示每个工作日的 09:00。
            </p>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{task.name}</h3>
                    <span
                      className={`badge ${task.enabled ? 'badge-success' : 'badge-warning'}`}
                    >
                      {task.enabled ? '已启用' : '已暂停'}
                    </span>
                    <span
                      className={`badge ${
                        task.lastStatus === 'success'
                          ? 'badge-success'
                          : 'badge-danger'
                      }`}
                    >
                      {task.lastStatus === 'success' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          上次成功
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          上次失败
                        </>
                      )}
                    </span>
                  </div>

                  <CronBadge cron={task.cron} label={task.cronLabel} />

                  <div className="flex items-center gap-4 mt-3 text-sm text-text-secondary">
                    <span>使用: {task.personaName}</span>
                    <span>目标: {task.groups.join(', ')}</span>
                  </div>

                  <p className="text-xs text-text-muted mt-2">
                    上次执行: {task.lastRun}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`btn text-sm p-2 ${
                      task.enabled ? 'btn-secondary' : 'btn-primary'
                    }`}
                    title={task.enabled ? '暂停' : '启用'}
                  >
                    {task.enabled ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button className="btn btn-secondary text-sm p-2" title="编辑">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="btn btn-danger text-sm p-2" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="card p-12 text-center">
            <Clock className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无定时任务</h3>
            <p className="text-sm text-text-muted mb-6">
              创建第一个定时任务，实现自动化管理
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建任务
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
